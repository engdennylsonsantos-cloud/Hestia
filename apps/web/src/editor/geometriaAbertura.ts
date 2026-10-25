// Abertura de um projeto com o cache de geometria (ver geometryCache.ts). Na abertura, restaura do cache os níveis já
// calculados e os põe como prontos da resolução; sem cache, grava os níveis quando ficam prontos em segundo plano. Só a
// abertura grava: uma edição não escreve no cache. O caminho síncrono do editor segue como fallback, então um cache
// vazio ou ilegível só deixa a abertura como era.

import type { ResolvedLevel } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { CacheGeometria, chaveDaLista, hashDoConteudo } from './geometryCache.ts';

/** Teto do cache de geometria (bytes de texto serializado). */
export const TETO_GEOMETRIA_BYTES = 32 * 1024 * 1024;
/** Intervalo (ms) entre as conferências de "níveis prontos" antes de gravar. */
export const INTERVALO_GRAVACAO_MS = 100;
/** Conferências antes de desistir da gravação (cerca de um minuto). */
const TENTATIVAS_GRAVACAO = 600;
/** Nome da lista de um nível no cache (ver `chaveDaLista`). */
const LISTA_NIVEL = 'nivel';

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
 * quando a restauração termina (a gravação segue em segundo plano).
 */
export async function abrirComCache(portas: PortasAbertura, p: Project): Promise<void> {
  const chave = chaveDoProjeto(p);
  const ids = p.levels.map((l) => l.id);
  const achados = await Promise.all(ids.map((id) => portas.cache.obter(chaveDoNivel(chave, id)).then((r) => ({ id, r }))));
  if (portas.atual() !== p) return;
  const faltam: Id[] = [];
  for (const { id, r } of achados) {
    if (r.achou) portas.semear(id, r.valor as ResolvedLevel);
    else faltam.push(id);
  }
  if (faltam.length > 0) gravarQuandoProntos(portas, p, chave, faltam, TENTATIVAS_GRAVACAO);
}

/** Espera os níveis em falta ficarem prontos (sem pendência) e grava cada um. Para se o projeto mudar. */
function gravarQuandoProntos(portas: PortasAbertura, p: Project, chave: string, faltam: Id[], restantes: number): void {
  const agendar = portas.agendar ?? ((tarefa: () => void, ms: number) => setTimeout(tarefa, ms));
  if (portas.atual() !== p) return;
  if (faltam.some((id) => portas.pendente(id))) {
    if (restantes > 0) agendar(() => gravarQuandoProntos(portas, p, chave, faltam, restantes - 1), INTERVALO_GRAVACAO_MS);
    return;
  }
  for (const id of faltam) {
    const valor = portas.lerNivel(id);
    if (valor) void portas.cache.gravar(chaveDoNivel(chave, id), valor).catch(() => false);
  }
}
