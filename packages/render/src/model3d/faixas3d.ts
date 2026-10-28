import * as THREE from 'three';
import type { Id } from '@hestia/model';
import { GestorRecursosGpu, type OpcoesAtualizacao, type OpcoesGestor, type ResultadoGestor } from '../gpu/gestorRecursos.ts';
import { OrcamentoVram, TETO_VRAM_PADRAO } from '../gpu/orcamento.ts';
import type { EntradaNivel } from './cacheMalhas3d.ts';

/**
 * Faixas verticais de níveis (culling por frustum, Fase 2.3). O gestor do R1 junta os níveis em lotes globais por
 * categoria e material; um lote global atravessa o prédio inteiro, então o culling do three nunca descarta nada: o objeto
 * é sempre intersectado pelo frustum, mesmo que só um pavimento apareça.
 *
 * Aqui os níveis são divididos em faixas (pavimentos vizinhos, por ordem do projeto) e cada faixa tem o seu próprio
 * `GestorRecursosGpu`. O resultado são lotes por faixa: um objeto por categoria/material dentro da faixa, com caixa
 * própria — o culling do three (no passe de cor **e** no passe de sombra) passa a descartar faixas fora do frustum. O teto
 * de VRAM é um só para a cena, com o contador de cada faixa somado.
 *
 * Custo: as draw calls de uma vista que mostra o prédio inteiro passam de ~14 para ~14 por faixa (5 faixas em 60
 * pavimentos = ~62, muito abaixo do teto de 500); ao aproximar, só as faixas visíveis desenham. Nenhum buffer é copiado
 * nem duplicado: cada nível vive na faixa dele, como vivia no lote global.
 */

/** Níveis por faixa (padrão): 60 pavimentos viram 5 faixas de 12; 20 pavimentos, 2 faixas. */
export const NIVEIS_POR_FAIXA = 12;
/** Teto de faixas: um prédio muito alto não multiplica draw calls sem limite. */
export const FAIXAS_MAX = 12;

/** Uma faixa: os níveis que ela contém, o gestor próprio e o que a cena precisa para anexar e orçar a sombra. */
export interface Faixa3D {
  readonly indice: number;
  readonly niveis: Id[];
  readonly gestor: GestorRecursosGpu;
  /** Caixa (mundo) das malhas da faixa; vazia enquanto não há geometria. */
  caixa: THREE.Box3;
  /** Triângulos das malhas de face da faixa (o que o passe de sombra desenharia). */
  triangulos: number;
  solidas: THREE.Mesh[];
  instanciadas: THREE.InstancedMesh[];
  arestas: THREE.LineSegments | null;
}

/** O que a cena anexa ao modelo depois de uma atualização. */
export interface ResultadoFaixas {
  solidas: THREE.Mesh[];
  instanciadas: THREE.InstancedMesh[];
  arestas: THREE.LineSegments[];
  faixas: readonly Faixa3D[];
}

export interface OpcoesFaixas extends OpcoesGestor {
  /** Níveis por faixa (padrão `NIVEIS_POR_FAIXA`). */
  niveisPorFaixa?: number;
  /** Teto de faixas (padrão `FAIXAS_MAX`). */
  faixasMax?: number;
}

/**
 * Faixa de cada nível: blocos de `niveisPorFaixa` na ordem do projeto (que é a ordem de cota), de modo que incluir ou
 * remover um pavimento só mexe na faixa dele (edição incremental). Acima do teto de faixas a divisão fica equilibrada
 * (senão a última faixa absorveria o prédio inteiro). Com 1 faixa o resultado é o do R1 (lote global). Índice fora da
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

/** Quantidade de faixas para `total` níveis. */
export function contarFaixas(total: number, niveisPorFaixa = NIVEIS_POR_FAIXA, faixasMax = FAIXAS_MAX): number {
  if (total <= 0) return 0;
  const porFaixa = Math.max(1, Math.floor(niveisPorFaixa));
  return Math.max(1, Math.min(Math.max(1, Math.floor(faixasMax)), Math.ceil(total / porFaixa)));
}

/** Índices desenhados de uma malha (respeita o `drawRange`, como o picking e a contagem de triângulos do S1). */
export function indicesDesenhados(geo: THREE.BufferGeometry): number {
  const total = geo.index ? geo.index.count : (geo.getAttribute('position')?.count ?? 0);
  const inicio = Number.isFinite(geo.drawRange.start) ? Math.max(0, geo.drawRange.start) : 0;
  const contagem = Number.isFinite(geo.drawRange.count) ? geo.drawRange.count : total - inicio;
  return Math.max(0, Math.min(contagem, total - inicio));
}

/** Triângulos que uma malha desenha (instâncias multiplicam). */
export function triangulosDaMalha(malha: THREE.Mesh | THREE.InstancedMesh): number {
  const porInstancia = Math.floor(indicesDesenhados(malha.geometry) / 3);
  const instancias = (malha as THREE.InstancedMesh).isInstancedMesh ? Math.max(0, (malha as THREE.InstancedMesh).count) : 1;
  return porInstancia * instancias;
}

/** Caixa (mundo) de um resultado do gestor: os limites que as malhas já calcularam (geometria e instâncias). */
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

/** Triângulos de face de um resultado do gestor (o que o passe de sombra rasteriza). */
export function triangulosDoResultado(r: ResultadoGestor): number {
  let total = 0;
  for (const m of r.solidas) if (m.visible) total += triangulosDaMalha(m);
  for (const m of r.instanciadas) if (m.visible) total += triangulosDaMalha(m);
  return total;
}

/**
 * Lotes por faixa: um `GestorRecursosGpu` por faixa vertical. O orçamento de VRAM é um só para a cena: cada faixa tem o
 * seu contador interno (as chaves do R1 são `categoria|material` e se repetiriam entre faixas) e o total é somado aqui,
 * contra um único teto.
 */
export class LotesPorFaixa {
  readonly niveisPorFaixa: number;
  readonly faixasMax: number;
  /** Teto de VRAM da cena inteira (todas as faixas). */
  readonly teto: number;
  private _faixas: Faixa3D[] = [];
  /** Total de faixas criadas (o índice estável de cada nível é o da lista de níveis da atualização). */
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

  /** Orçamento de VRAM da cena (um teto, o usado somado das faixas). */
  get orcamento(): { usado: number; teto: number; livre: number; excedido: boolean } {
    const usado = this.bytes;
    return { usado, teto: this.teto, livre: Math.max(0, this.teto - usado), excedido: usado > this.teto };
  }

  get quantidade(): number {
    return this._faixas.length;
  }

  /**
   * Sincroniza as faixas com os níveis dados. `fecharMontagem` vale para cada faixa que já tem todos os níveis dela
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
    // Faixas que sobraram (o projeto encolheu): sai tudo delas e elas são descartadas.
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

  /** Níveis já aplicados em cada faixa (para testes e diagnóstico). */
  get distribuicao(): readonly (readonly Id[])[] {
    return this.ultimaDistribuicao;
  }

  dispose(): void {
    for (const f of this._faixas) f.gestor.dispose();
    this._faixas = [];
    this.ultimaDistribuicao = [];
  }

  /** Agrupa os níveis por faixa, preservando a ordem do projeto dentro de cada uma. */
  private distribuir(ids: readonly Id[]): Id[][] {
    if (!ids.length) return [];
    const total = ids.length;
    const faixas = contarFaixas(total, this.niveisPorFaixa, this.faixasMax);
    const out: Id[][] = Array.from({ length: faixas }, () => []);
    ids.forEach((id, i) => out[indiceDaFaixa(i, total, this.niveisPorFaixa, this.faixasMax)]!.push(id));
    return out;
  }

  /** Faixa do índice, criando o gestor na primeira vez. */
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
        // Contador próprio por faixa (as chaves do R1 se repetem entre faixas); o teto é o da cena, em `orcamento`.
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
