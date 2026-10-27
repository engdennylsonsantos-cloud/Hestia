import * as THREE from 'three';
import type { Id } from '@hestia/model';
import { GestorRecursosGpu, type OpcoesAtualizacao, type OpcoesGestor, type ResultadoGestor } from '../gpu/gestorRecursos.ts';
import { OrcamentoVram, TETO_VRAM_PADRAO } from '../gpu/orcamento.ts';
import type { EntradaNivel } from './cacheMalhas3d.ts';

/**
 * Faixas verticais de nÃ­veis (culling por frustum, Fase 2.3). O gestor do R1 junta os nÃ­veis em lotes globais por
 * categoria e material; um lote global atravessa o prÃ©dio inteiro, entÃ£o o culling do three nunca descarta nada: o objeto
 * Ã© sempre intersectado pelo frustum, mesmo que sÃ³ um pavimento apareÃ§a.
 *
 * Aqui os nÃ­veis sÃ£o divididos em faixas (pavimentos vizinhos, por ordem do projeto) e cada faixa tem o seu prÃ³prio
 * `GestorRecursosGpu`. O resultado sÃ£o lotes por faixa: um objeto por categoria/material dentro da faixa, com caixa
 * prÃ³pria â€” o culling do three (no passe de cor **e** no passe de sombra) passa a descartar faixas fora do frustum. O
 * orÃ§amento de VRAM Ã© um sÃ³, compartilhado por todas as faixas.
 *
 * Custo: as draw calls de uma vista que mostra o prÃ©dio inteiro passam de ~14 para ~14 por faixa (6 faixas em 60
 * pavimentos = ~84, muito abaixo do teto de 500); ao aproximar, sÃ³ as faixas visÃ­veis desenham. Nenhum buffer Ã© copiado
 * nem duplicado: cada nÃ­vel vive na faixa dele, como vivia no lote global.
 */

/** NÃ­veis por faixa (padrÃ£o): 60 pavimentos viram 6 faixas de 10. */
export const NIVEIS_POR_FAIXA = 20;
/** Teto de faixas: um prÃ©dio muito alto nÃ£o multiplica draw calls sem limite. */
export const FAIXAS_MAX = 12;

/** Uma faixa: os nÃ­veis que ela contÃ©m, o gestor prÃ³prio e o que a cena precisa para anexar e orÃ§ar a sombra. */
export interface Faixa3D {
  readonly indice: number;
  readonly niveis: Id[];
  readonly gestor: GestorRecursosGpu;
  /** Caixa (mundo) das malhas da faixa; vazia enquanto nÃ£o hÃ¡ geometria. */
  caixa: THREE.Box3;
  /** TriÃ¢ngulos das malhas de face da faixa (o que o passe de sombra desenharia). */
  triangulos: number;
  solidas: THREE.Mesh[];
  instanciadas: THREE.InstancedMesh[];
  arestas: THREE.LineSegments | null;
}

/** O que a cena anexa ao modelo depois de uma atualizaÃ§Ã£o. */
export interface ResultadoFaixas {
  solidas: THREE.Mesh[];
  instanciadas: THREE.InstancedMesh[];
  arestas: THREE.LineSegments[];
  faixas: readonly Faixa3D[];
}

export interface OpcoesFaixas extends OpcoesGestor {
  /** NÃ­veis por faixa (padrÃ£o `NIVEIS_POR_FAIXA`). */
  niveisPorFaixa?: number;
  /** Teto de faixas (padrÃ£o `FAIXAS_MAX`). */
  faixasMax?: number;
}

/**
 * Faixa de cada nÃ­vel: blocos de `niveisPorFaixa` na ordem do projeto (que Ã© a ordem de cota), de modo que incluir ou
 * remover um pavimento sÃ³ mexe na faixa dele (ediÃ§Ã£o incremental). Acima do teto de faixas a divisÃ£o fica equilibrada
 * (senÃ£o a Ãºltima faixa absorveria o prÃ©dio inteiro). Com 1 faixa o resultado Ã© o do R1 (lote global). Ãndice fora da
 * lista: -1.
 */
export function indiceDaFaixa(i: number, total: number, niveisPorFaixa = NIVEIS_POR_FAIXA, faixasMax = FAIXAS_MAX): number {
  if (total <= 0 || i < 0 || i >= total) return -1;
  const porFaixa = Math.max(1, Math.floor(niveisPorFaixa));
  const maximo = Math.max(1, Math.floor(faixasMax));
  const natural = Math.ceil(total / porFaixa);
  if (natural <= maximo) return Math.min(natural - 1, Math.floor(i / porFaixa));
  return Math.min(maximo - 1, Math.floor((i * maximo) / total));
}

/** Quantidade de faixas para `total` nÃ­veis. */
export function contarFaixas(total: number, niveisPorFaixa = NIVEIS_POR_FAIXA, faixasMax = FAIXAS_MAX): number {
  if (total <= 0) return 0;
  const porFaixa = Math.max(1, Math.floor(niveisPorFaixa));
  return Math.max(1, Math.min(Math.max(1, Math.floor(faixasMax)), Math.ceil(total / porFaixa)));
}

/** Ãndices desenhados de uma malha (respeita o `drawRange`, como o picking e a contagem de triÃ¢ngulos do S1). */
export function indicesDesenhados(geo: THREE.BufferGeometry): number {
  const total = geo.index ? geo.index.count : (geo.getAttribute('position')?.count ?? 0);
  const inicio = Number.isFinite(geo.drawRange.start) ? Math.max(0, geo.drawRange.start) : 0;
  const contagem = Number.isFinite(geo.drawRange.count) ? geo.drawRange.count : total - inicio;
  return Math.max(0, Math.min(contagem, total - inicio));
}

/** TriÃ¢ngulos que uma malha desenha (instÃ¢ncias multiplicam). */
export function triangulosDaMalha(malha: THREE.Mesh | THREE.InstancedMesh): number {
  const porInstancia = Math.floor(indicesDesenhados(malha.geometry) / 3);
  const instancias = (malha as THREE.InstancedMesh).isInstancedMesh ? Math.max(0, (malha as THREE.InstancedMesh).count) : 1;
  return porInstancia * instancias;
}

/** Caixa (mundo) de um resultado do gestor: os limites que as malhas jÃ¡ calcularam (geometria e instÃ¢ncias). */
export function caixaDoResultado(r: ResultadoGestor): THREE.Box3 {
  const caixa = new THREE.Box3();
  for (const m of r.solidas) {
    if (!m.visible) continue;
    const b = m.geometry.boundingBox;
    if (b && !b.isEmpty()) caixa.union(b);
  }
  for (const m of r.instanciadas) {
    if (!m.visible) continue;
    const b = m.boundingBox ?? m.geometry.boundingBox;
    if (b && !b.isEmpty()) caixa.union(b);
  }
  return caixa;
}

/** TriÃ¢ngulos de face de um resultado do gestor (o que o passe de sombra rasteriza). */
export function triangulosDoResultado(r: ResultadoGestor): number {
  let total = 0;
  for (const m of r.solidas) if (m.visible) total += triangulosDaMalha(m);
  for (const m of r.instanciadas) if (m.visible) total += triangulosDaMalha(m);
  return total;
}

/**
 * Lotes por faixa: um `GestorRecursosGpu` por faixa vertical. O orÃ§amento de VRAM Ã© um sÃ³ para a cena: cada faixa tem o
 * seu contador interno (as chaves do R1 sÃ£o `categoria|material` e se repetiriam entre faixas) e o total Ã© somado aqui,
 * contra um Ãºnico teto.
 */
export class LotesPorFaixa {
  readonly niveisPorFaixa: number;
  readonly faixasMax: number;
  /** Teto de VRAM da cena inteira (todas as faixas). */
  readonly teto: number;
  private _faixas: Faixa3D[] = [];
  /** Total de faixas criadas (o Ã­ndice estÃ¡vel de cada nÃ­vel Ã© o da lista de nÃ­veis da atualizaÃ§Ã£o). */
  private ultimaDistribuicao: Id[][] = [];

  constructor(private readonly op: OpcoesFaixas) {
    this.teto = op.orcamento?.teto ?? op.tetoBytes ?? TETO_VRAM_PADRAO;
    this.niveisPorFaixa = op.niveisPorFaixa ?? NIVEIS_POR_FAIXA;
    this.faixasMax = op.faixasMax ?? FAIXAS_MAX;
  }

  get faixas(): readonly Faixa3D[] {
    return this._faixas;
  }

  /** Bytes contabilizados nas faixas (soma de todas). */
  get bytes(): number {
    let total = 0;
    for (const f of this._faixas) total += f.gestor.orcamento.usado;
    return total;
  }

  /** OrÃ§amento de VRAM da cena (um teto, o usado somado das faixas). */
  get orcamento(): { usado: number; teto: number; livre: number; excedido: boolean } {
    const usado = this.bytes;
    return { usado, teto: this.teto, livre: Math.max(0, this.teto - usado), excedido: usado > this.teto };
  }

  get quantidade(): number {
    return this._faixas.length;
  }

  /**
   * Sincroniza as faixas com os nÃ­veis dados. `fecharMontagem` vale para cada faixa que jÃ¡ tem todos os nÃ­veis dela
   * (o fecho do R1 reordena os segmentos e corta a capacidade, faixa por faixa).
   */
  atualizar(niveis: readonly EntradaNivel[], op: OpcoesAtualizacao, fecharMontagem = false): ResultadoFaixas {
    const distribuicao = this.distribuir(niveis.map((n) => n.levelId));
    const porId = new Map(niveis.map((n) => [n.levelId, n] as const));
    const solidas: THREE.Mesh[] = [];
    const instanciadas: THREE.InstancedMesh[] = [];
    const arestas: THREE.LineSegments[] = [];

    for (let f = 0; f < distribuicao.length; f++) {
      const ids = distribuicao[f]!;
      const faixa = this.faixa(f);
      faixa.niveis.length = 0;
      faixa.niveis.push(...ids);
      const entrada = ids.map((id) => porId.get(id)!);
      const res = faixa.gestor.atualizar(entrada, op, fecharMontagem);
      faixa.caixa = caixaDoResultado(res);
      faixa.triangulos = triangulosDoResultado(res);
      faixa.solidas = res.solidas;
      faixa.instanciadas = res.instanciadas;
      faixa.arestas = res.arestas;
      solidas.push(...res.solidas);
      instanciadas.push(...res.instanciadas);
      if (res.arestas) arestas.push(res.arestas);
    }
    // Faixas que sobraram (o projeto encolheu): sai tudo delas e elas sÃ£o descartadas.
    for (let f = distribuicao.length; f < this._faixas.length; f++) {
      const faixa = this._faixas[f]!;
      faixa.gestor.atualizar([], op, false);
      faixa.gestor.dispose();
      faixa.niveis.length = 0;
      faixa.solidas = [];
      faixa.instanciadas = [];
      faixa.arestas = null;
      faixa.caixa = new THREE.Box3();
      faixa.triangulos = 0;
    }
    this._faixas.length = distribuicao.length;
    this.ultimaDistribuicao = distribuicao;
    return { solidas, instanciadas, arestas, faixas: this._faixas };
  }

  /** NÃ­veis jÃ¡ aplicados em cada faixa (para testes e diagnÃ³stico). */
  get distribuicao(): readonly (readonly Id[])[] {
    return this.ultimaDistribuicao;
  }

  dispose(): void {
    for (const f of this._faixas) f.gestor.dispose();
    this._faixas = [];
    this.ultimaDistribuicao = [];
  }

  /** Agrupa os nÃ­veis por faixa, preservando a ordem do projeto dentro de cada uma. */
  private distribuir(ids: readonly Id[]): Id[][] {
    if (!ids.length) return [];
    const total = ids.length;
    const faixas = contarFaixas(total, this.niveisPorFaixa, this.faixasMax);
    const out: Id[][] = Array.from({ length: faixas }, () => []);
    ids.forEach((id, i) => out[indiceDaFaixa(i, total, this.niveisPorFaixa, this.faixasMax)]!.push(id));
    return out;
  }

  /** Faixa do Ã­ndice, criando o gestor na primeira vez. */
  private faixa(indice: number): Faixa3D {
    const existente = this._faixas[indice];
    if (existente) return existente;
    const nova: Faixa3D = {
      indice,
      niveis: [],
      gestor: new GestorRecursosGpu({
        caixaUnitaria: this.op.caixaUnitaria,
        material: this.op.material,
        materialArestas: this.op.materialArestas,
        // Contador prÃ³prio por faixa (as chaves do R1 se repetem entre faixas); o teto Ã© o da cena, em `orcamento`.
        orcamento: new OrcamentoVram(Number.POSITIVE_INFINITY),
      }),
      caixa: new THREE.Box3(),
      triangulos: 0,
      solidas: [],
      instanciadas: [],
      arestas: null,
    };
    this._faixas[indice] = nova;
    return nova;
  }
}
