// Abertura de um projeto com o cache de geometria (ver geometryCache.ts). Na abertura, restaura do cache os níveis já
// calculados e os põe como prontos da resolução; sem cache, grava cada nível assim que ele fica pronto em segundo plano (um
// nível pronto não espera os outros: numa abertura de 60 pavimentos o Worker leva dezenas de segundos). Só a abertura grava:
// uma edição não escreve no cache. O caminho síncrono do editor segue como fallback, então um cache vazio ou ilegível só
// deixa a abertura como era.

import type { ResolvedLevel } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { CacheGeometria, chaveDaLista, hashDoConteudo } from './geometryCache.ts';

/** Teto do cache de geometria (bytes de texto serializado). */
export const TETO_GEOMETRIA_BYTES = 32 * 1024 * 1024;
/** Intervalo (ms) entre as conferências de "níveis prontos" antes de gravar. */
export const INTERVALO_GRAVACAO_MS = 100;
/** Conferências antes de desistir da gravação (cerca de um minuto). */
const TENTATIVAS_GRAVACAO = 600;
/** Nome da lista de um nível no cache (ver `chaveDaLista`). Sobe de versão quando o formato de `ResolvedLevel` muda. */
const LISTA_NIVEL = 'nivel-1';

/** O que a abertura precisa do editor. Funções, para o módulo não depender do controller. */
export interface PortasAbertura {
  cache: CacheGeometria;
  /** Projeto atual do editor: a abertura só age enquanto for o mesmo objeto que abriu. */
  atual(): Project;
  /** Resultado de um nível já calculado (pronto ou calculado na hora), ou `null`. */
  lerNivel(id: Id): ResolvedLevel | null;
  /** Verdadeiro enquanto o nível ainda vai ser calculado em segundo plano. */
  pendente(id: Id): boolean;
  /** Põe um nível restaurado do cache como pronto (ver `ResolucaoProgressiva.semear`). */
  semear(id: Id, valor: ResolvedLevel): void;
  /** Põe vários níveis restaurados de uma vez (ver `ResolucaoProgressiva.semearVarios`). */
  semearVarios?(itens: ReadonlyArray<readonly [Id, ResolvedLevel]>): number;
  /** Agenda uma tarefa daqui a `ms`. Padrão: `setTimeout`. */
  agendar?(tarefa: () => void, ms: number): void;
}

/** Chave do projeto no cache: o hash do conteúdo (mudou o conteúdo, muda a chave). */
export function chaveDoProjeto(p: Project): string {
  return hashDoConteudo(JSON.stringify(p));
}

/** Chave de um nível do projeto dentro do cache. */
export function chaveDoNivel(chaveProjeto: string, id: Id): string {
  return chaveDaLista(chaveProjeto, id, LISTA_NIVEL);
}

/**
 * Abre `p` com o cache: restaura os níveis achados e agenda a gravação dos que faltam. Não lança; a promessa resolve
 * quando a restauração termina (a gravação segue em segundo plano) e devolve os níveis que **não** estavam no cache.
 */
export async function abrirComCache(portas: PortasAbertura, p: Project): Promise<Id[]> {
  const chave = chaveDoProjeto(p);
  const ids = p.levels.map((l) => l.id);
  const achados = await portas.cache.obterVarios(ids.map((id) => chaveDoNivel(chave, id)));
  if (portas.atual() !== p) return ids;
  const faltam: Id[] = [];
  const prontos: [Id, ResolvedLevel][] = [];
  ids.forEach((id, i) => {
    const r = achados[i];
    if (r?.achou) prontos.push([id, r.valor as ResolvedLevel]);
    else faltam.push(id);
  });
  if (prontos.length > 0) {
    if (portas.semearVarios) {
      portas.semearVarios(prontos);
    } else {
      for (const [id, valor] of prontos) portas.semear(id, valor);
    }
  }
  if (faltam.length > 0) gravarQuandoProntos(portas, p, chave, faltam, TENTATIVAS_GRAVACAO);
  return faltam;
}

/**
 * Abre os níveis de `p` com o cache: com o cache carregado e com conteúdo, tenta restaurar os níveis antes de resolver
 * (o visível e o vizinho só são calculados se faltarem); sem cache, resolve na hora e agenda a gravação para depois das
 * primeiras pinturas (a chave do projeto e as leituras não seguram a abertura). `resolver` é o cálculo síncrono do editor.
 */
export function abrirNiveisComCache(portas: PortasAbertura, p: Project, ids: readonly Id[], resolver: (id: Id) => void): void {
  const cache = portas.cache;
  if (!cache.carregado || cache.quantidade === 0) {
    // Caminho de sempre: sem cache não há o que restaurar. A gravação não precisa entrar na abertura.
    for (const id of ids) resolver(id);
    if (!cache.carregado) void abrirComCache(portas, p);
    else depoisDaPintura(() => {
      if (portas.atual() === p) void abrirComCache(portas, p);
    });
    return;
  }
  void restaurarNiveis(portas, p, ids, resolver);
}

/** Restaura os níveis do cache e resolve só os que faltam. Se o projeto mudar no meio, não resolve nada. */
async function restaurarNiveis(portas: PortasAbertura, p: Project, ids: readonly Id[], resolver: (id: Id) => void): Promise<void> {
  let faltam: Id[] | null = null;
  try {
    faltam = await abrirComCache(portas, p);
  } catch {
    /* o cache é aceleração, nunca a fonte da verdade: sem ele, a abertura segue pelo cálculo */
  }
  if (portas.atual() !== p) return;
  const daVez = faltam ?? ids;
  for (const id of ids) if (daVez.includes(id) && portas.pendente(id)) resolver(id);
}

/** Roda `tarefa` depois de duas pinturas. Sem `requestAnimationFrame` (testes), um temporizador. */
function depoisDaPintura(tarefa: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(tarefa, 32);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(tarefa));
}

/**
 * Confere os níveis em falta e grava cada um **assim que fica pronto**, sem esperar os outros (antes, só gravava quando
 * todos ficavam prontos, o que numa abertura grande raramente chegava a acontecer). Para se o projeto mudar.
 */
function gravarQuandoProntos(portas: PortasAbertura, p: Project, chave: string, faltam: Id[], restantes: number): void {
  const agendar = portas.agendar ?? ((tarefa: () => void, ms: number) => setTimeout(tarefa, ms));
  if (portas.atual() !== p) return;
  const ainda: Id[] = [];
  for (const id of faltam) {
    if (portas.pendente(id)) {
      ainda.push(id);
      continue;
    }
    const valor = portas.lerNivel(id);
    if (valor) void portas.cache.gravar(chaveDoNivel(chave, id), valor).catch(() => false);
    else ainda.push(id);
  }
  if (ainda.length > 0 && restantes > 0) agendar(() => gravarQuandoProntos(portas, p, chave, ainda, restantes - 1), INTERVALO_GRAVACAO_MS);
}
