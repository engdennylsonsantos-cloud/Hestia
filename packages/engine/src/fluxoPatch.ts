import type { Element, Id, Project } from '@hestia/model';
import { caixaDe, empacotarMultis, type CaixaPlana, type GeometriaEmpacotada } from './fluxoGeometria.ts';
import { niveisAfetados, nivelDe, type NiveisAfetados } from './resolveLevels.ts';
import type { ResolvedCluster, ResolvedLevel, ResolvedWall } from './types.ts';

/**
 * Contrato do fluxo incremental de edição (motor). Uma edição vira, em ordem:
 *
 *  1. `AlteracaoProjeto`: quais elementos mudaram e quais níveis a resolução exata precisa refazer (`calcularAlteracao`,
 *     que usa `niveisAfetados`). Vale para qualquer comando: a diferença vem dos elementos, não do tipo do comando.
 *  2. `PatchProvisorio` por nível: geometria barata do que foi editado, sem junção (ver `fluxoProvisorio.ts`), para a
 *     interface responder na hora. Provisória: some quando o patch exato do nível chega.
 *  3. `PatchNivel` por nível: o resultado exato, só com as paredes e os agrupamentos que mudaram. `gerarPatchNivel`
 *     compara com o último resultado do nível; `aplicarPatchNivel` monta o `ResolvedLevel` novo reaproveitando os
 *     objetos que não mudaram (a identidade deles segue estável, então caches por objeto da planta e da 3D valem).
 *  4. Descarte por versão: cada patch leva a `versao` do projeto de que saiu; quem recebe ignora o patch de um nível
 *     cuja versão mínima válida é maior (ver `apps/web/src/editor/fluxoEdicao.ts`).
 *
 * Tudo aqui é dado puro e clonável (`structuredClone`): objetos simples e arrays tipados. A geometria nova dos elementos
 * (`ElementoGeometrico`) vai em arrays tipados cujos buffers são transferíveis (`colherBuffers`, em `worker/protocolo.ts`).
 * As paredes resolvidas (`ResolvedWall`) seguem como objetos, porque os desenhistas da planta e da 3D consomem esse formato.
 */

/** Versão do projeto: o contador de mudanças do `ProjectStore` (`store.version`). Cresce a cada edição, desfazer e carga. */
export type VersaoProjeto = number;

/** O que mudou entre dois projetos (passo 1 do fluxo). */
export interface AlteracaoProjeto {
  /** Versão do projeto depois da edição. */
  versao: VersaoProjeto;
  /** Versão do projeto antes da edição. */
  versaoAnterior: VersaoProjeto;
  adicionados: Id[];
  alterados: Id[];
  removidos: Id[];
  /** Níveis que a resolução exata refaz, ou `'todos'` quando algo global mudou (tipos, níveis, configurações). */
  niveis: NiveisAfetados;
}

/**
 * Geometria nova de um elemento, em planta e com a faixa de cota (absoluta). `provisorio` verdadeiro: contorno barato,
 * sem junção (uma parede é o retângulo do eixo e da espessura). Falso: contorno exato do resultado resolvido.
 */
export interface ElementoGeometrico {
  id: Id;
  kind: Element['kind'];
  provisorio: boolean;
  z0: number;
  z1: number;
  geometria: GeometriaEmpacotada;
  /** `[xMin, yMin, xMax, yMax]` da geometria: dá a área suja a repintar sem varrer os vértices. */
  caixa: CaixaPlana;
}

/** Resposta imediata de um nível (passo 2). `elementos` substituem, por id, o que a interface mostrava; `removidos` saem. */
export interface PatchProvisorio {
  nivel: Id;
  versao: VersaoProjeto;
  elementos: ElementoGeometrico[];
  removidos: Id[];
}

/**
 * Resultado exato de um nível (passo 3). Com `base` nulo o patch é completo (traz o nível inteiro) e se aplica sem estado
 * anterior. Com `base` numérico ele só vale sobre o resultado do nível na versão `base`; sobre outro, `aplicarPatchNivel`
 * devolve `null` e quem recebe pede um patch completo.
 */
export interface PatchNivel {
  nivel: Id;
  /** Versão do projeto de que o resultado saiu. */
  versao: VersaoProjeto;
  /** Versão do resultado de nível sobre o qual o patch se aplica; `null` = completo. */
  base: VersaoProjeto | null;
  /** Ids de todas as paredes do nível, na ordem do resultado (as que não estão em `paredes` vêm do estado anterior). */
  ordemParedes: Id[];
  /** Paredes trocadas ou novas (todas, no patch completo). */
  paredes: Record<Id, ResolvedWall>;
  /** Paredes que existiam na base e não existem mais. */
  removidas: Id[];
  /** Chaves (ver `chaveDoAgrupamento`) de todos os agrupamentos do nível, na ordem do resultado. */
  ordemAgrupamentos: string[];
  /** Agrupamentos trocados ou novos (todos, no patch completo). */
  agrupamentos: Record<string, ResolvedCluster>;
  /** Contorno exato (arrays tipados) das paredes trocadas: dá a caixa suja e troca o provisório por id. */
  geometrias: ElementoGeometrico[];
}

/** Chave estável de um agrupamento: os ids das paredes, em ordem. Agrupamentos partem as paredes, então não se repetem. */
export const chaveDoAgrupamento = (c: ResolvedCluster): string => [...c.wallIds].sort().join('|');

/**
 * Elementos que mudaram entre dois projetos e níveis a refazer. Compara os elementos por referência (o motor é
 * imutável: o que não foi editado mantém o objeto). `versao` e `versaoAnterior` vêm de quem controla as versões.
 */
export function calcularAlteracao(antes: Project, depois: Project, versao: VersaoProjeto, versaoAnterior: VersaoProjeto): AlteracaoProjeto {
  const adicionados: Id[] = [];
  const alterados: Id[] = [];
  const removidos: Id[] = [];
  if (antes.elements !== depois.elements) {
    for (const id of Object.keys(depois.elements)) {
      const a = antes.elements[id];
      const b = depois.elements[id];
      if (a === b) continue;
      (a ? alterados : adicionados).push(id);
    }
    for (const id of Object.keys(antes.elements)) if (!depois.elements[id]) removidos.push(id);
  }
  return { versao, versaoAnterior, adicionados, alterados, removidos, niveis: niveisAfetados(antes, depois) };
}

/** Nível do elemento no projeto dado (o da parede hospedeira, para abertura); `null` se não há como saber. */
export const nivelDoElemento = (p: Project, id: Id): Id | null => {
  const e = p.elements[id];
  return e ? nivelDe(p, e) : null;
};

/** Igualdade profunda de dados de resolução (objetos simples, arrays, arrays tipados); chave ausente vale `undefined`. */
export function igualProfundo(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Object.is(a, b);
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!igualProfundo(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.byteLength !== b.byteLength) return false;
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  for (const k of Object.keys(oa)) if (!igualProfundo(oa[k], ob[k])) return false;
  for (const k of Object.keys(ob)) if (!(k in oa) && ob[k] !== undefined) return false;
  return true;
}

/** Contorno exato de uma parede resolvida: os fragmentos de todas as camadas, empacotados (sem união booleana). */
export function geometriaDaParede(w: ResolvedWall): ElementoGeometrico {
  const geometria = empacotarMultis(w.layers.map((l) => l.fragment));
  return { id: w.wallId, kind: 'wall', provisorio: false, z0: w.baseZ, z1: w.baseZ + w.height, geometria, caixa: caixaDe(geometria) };
}

/** Patch completo: o nível inteiro, sem depender de estado anterior. */
export function patchCompleto(nivel: ResolvedLevel, versao: VersaoProjeto): PatchNivel {
  const ordemParedes = Object.keys(nivel.walls);
  const agrupamentos: Record<string, ResolvedCluster> = {};
  for (const c of nivel.clusters) agrupamentos[chaveDoAgrupamento(c)] = c;
  return {
    nivel: nivel.levelId,
    versao,
    base: null,
    ordemParedes,
    paredes: { ...nivel.walls },
    removidas: [],
    ordemAgrupamentos: nivel.clusters.map(chaveDoAgrupamento),
    agrupamentos,
    geometrias: ordemParedes.map((id) => geometriaDaParede(nivel.walls[id]!)),
  };
}

/** Patch da diferença entre dois resultados do mesmo nível: só as paredes e os agrupamentos que mudaram de conteúdo. */
export function diferencaNivel(anterior: ResolvedLevel, novo: ResolvedLevel, versao: VersaoProjeto, base: VersaoProjeto): PatchNivel {
  const ordemParedes = Object.keys(novo.walls);
  const paredes: Record<Id, ResolvedWall> = {};
  for (const id of ordemParedes) {
    const w = novo.walls[id]!;
    if (!igualProfundo(anterior.walls[id], w)) paredes[id] = w;
  }
  const removidas = Object.keys(anterior.walls).filter((id) => !novo.walls[id]);
  const antigos = new Map<string, ResolvedCluster>();
  for (const c of anterior.clusters) antigos.set(chaveDoAgrupamento(c), c);
  const agrupamentos: Record<string, ResolvedCluster> = {};
  const ordemAgrupamentos = novo.clusters.map((c) => {
    const chave = chaveDoAgrupamento(c);
    if (!igualProfundo(antigos.get(chave), c)) agrupamentos[chave] = c;
    return chave;
  });
  return {
    nivel: novo.levelId,
    versao,
    base,
    ordemParedes,
    paredes,
    removidas,
    ordemAgrupamentos,
    agrupamentos,
    geometrias: Object.values(paredes).map(geometriaDaParede),
  };
}

/**
 * Aplica um patch sobre o resultado anterior do nível. Devolve `null` quando o patch não cabe (precisa de base e não há
 * anterior, ou falta parede ou agrupamento): quem recebe pede um patch completo. Os objetos que não mudaram são os mesmos.
 */
export function aplicarPatchNivel(anterior: ResolvedLevel | null, patch: PatchNivel): ResolvedLevel | null {
  if (patch.base !== null && !anterior) return null;
  const walls: Record<Id, ResolvedWall> = {};
  for (const id of patch.ordemParedes) {
    const w = patch.paredes[id] ?? anterior?.walls[id];
    if (!w) return null;
    walls[id] = w;
  }
  const antigos = new Map<string, ResolvedCluster>();
  if (anterior) for (const c of anterior.clusters) antigos.set(chaveDoAgrupamento(c), c);
  const clusters: ResolvedCluster[] = [];
  for (const chave of patch.ordemAgrupamentos) {
    const c = patch.agrupamentos[chave] ?? antigos.get(chave);
    if (!c) return null;
    clusters.push(c);
  }
  return { levelId: patch.nivel, walls, clusters };
}

/**
 * Último resultado de cada nível que um produtor de patches entregou, com a versão do projeto. Fica de quem produz
 * (o worker, ou o cliente na thread principal): a comparação precisa do resultado anterior, e guardá-lo aqui evita
 * reenviá-lo. Um resultado por nível, então a memória cresce com o número de níveis.
 */
export class MemoriaPatch {
  private readonly ultimos = new Map<Id, { versao: VersaoProjeto; valor: ResolvedLevel }>();

  get(nivel: Id): { versao: VersaoProjeto; valor: ResolvedLevel } | undefined {
    return this.ultimos.get(nivel);
  }

  set(nivel: Id, versao: VersaoProjeto, valor: ResolvedLevel): void {
    this.ultimos.set(nivel, { versao, valor });
  }

  clear(): void {
    this.ultimos.clear();
  }

  get size(): number {
    return this.ultimos.size;
  }
}

/**
 * Patch exato de um nível já resolvido. Com `base` igual à versão que a memória guarda para o nível, devolve só a
 * diferença; com qualquer outra (nula, ou que a memória não tem), o patch completo. Guarda o resultado na memória.
 */
export function gerarPatchNivel(memoria: MemoriaPatch, resolvido: ResolvedLevel, versao: VersaoProjeto, base: VersaoProjeto | null): PatchNivel {
  const guardado = memoria.get(resolvido.levelId);
  memoria.set(resolvido.levelId, versao, resolvido);
  if (base !== null && guardado && guardado.versao === base) return diferencaNivel(guardado.valor, resolvido, versao, base);
  return patchCompleto(resolvido, versao);
}
