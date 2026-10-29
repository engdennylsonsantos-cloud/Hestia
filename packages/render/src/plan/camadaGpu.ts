import * as THREE from 'three';
import type { LoteGpu } from './lotesGpu.ts';

/**
 * Folga de capacidade ao crescer um buffer: quando o uso passa da capacidade, o buffer novo tem esta vez o uso. Assim, uma
 * edição que aumenta pouco não obriga a alocar de novo a cada quadro.
 */
export const FOLGA_CAPACIDADE = 1.5;
/** Capacidade mínima de um buffer (itens), para não crescer de dez em dez no início. */
const CAPACIDADE_MINIMA = 64;
/** Quantas malhas livres (fora do grupo) a camada guarda para reuso. Acima disso, a geometria é liberada. */
export const MALHAS_LIVRES_MAX = 16;

/**
 * Capacidade de um buffer para `necessario` valores: o uso com a folga, nunca abaixo do mínimo. `itens` é o número de valores por
 * vértice (3 nas posições): a capacidade fecha em múltiplo dele, senão o three enxerga um vértice fracionário, lê além do array
 * e `computeBoundingSphere` devolve raio NaN.
 */
export function capacidadeDe(necessario: number, itens = 1): number {
  const bruta = Math.max(CAPACIDADE_MINIMA, Math.ceil(necessario * FOLGA_CAPACIDADE));
  return Math.ceil(bruta / itens) * itens;
}

/** Geometria sem vértices nem índices: o ponto de partida de uma malha da camada. */
function geometriaVazia(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(0), 3));
  g.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(0), 1));
  return g;
}

/**
 * Escreve um atributo por vértice (`itens` valores por vértice) no buffer da geometria. Com capacidade suficiente,
 * reaproveita o buffer e envia só o trecho usado (bufferSubData, por faixa de atualização); senão, aloca com a folga.
 * Devolve se alocou.
 */
export function escreverAtributo(g: THREE.BufferGeometry, nome: string, valores: readonly number[], itens: number): boolean {
  let attr = g.getAttribute(nome) as THREE.BufferAttribute | undefined;
  let alocou = false;
  if (!attr || attr.array.length < valores.length) {
    attr = new THREE.Float32BufferAttribute(new Float32Array(capacidadeDe(valores.length, itens)), itens);
    g.setAttribute(nome, attr);
    alocou = true;
  }
  (attr.array as Float32Array).set(valores);
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, valores.length);
  attr.needsUpdate = true;
  return alocou;
}

/** Escreve as posições de um lote (três valores por vértice). Ver `escreverAtributo`. */
export function escreverPosicoes(g: THREE.BufferGeometry, pos: readonly number[]): boolean {
  return escreverAtributo(g, 'position', pos, 3);
}

/**
 * Escreve os índices de um lote e fixa a faixa de desenho ao uso (o buffer pode ter mais capacidade). Mesma regra de
 * capacidade que as posições. Devolve se alocou.
 */
export function escreverIndices(g: THREE.BufferGeometry, idx: readonly number[]): boolean {
  let attr = g.index;
  let alocou = false;
  if (!attr || attr.array.length < idx.length) {
    attr = new THREE.Uint32BufferAttribute(new Uint32Array(capacidadeDe(idx.length)), 1);
    g.setIndex(attr);
    alocou = true;
  }
  (attr.array as Uint32Array).set(idx);
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, idx.length);
  attr.needsUpdate = true;
  g.setDrawRange(0, idx.length);
  return alocou;
}

/** Malha de um lote: a material é da cena (por chave), a ordem de desenho é a posição do lote na camada. */
export type FabricaMaterial = (lote: LoteGpu) => THREE.Material;

/**
 * Uma camada da planta na GPU (preenchimentos, grade, traços...). Mantém as malhas entre atualizações: um lote que existe
 * de novo reaproveita a malha e o buffer (ver `escreverPosicoes`); só malhas e buffers que faltam são criados. Lotes que
 * sobram saem do grupo e ficam livres para reuso (até `MALHAS_LIVRES_MAX`).
 */
export class CamadaGpu {
  private ativas: THREE.Mesh[] = [];
  private livres: THREE.Mesh[] = [];

  constructor(
    private readonly grupo: THREE.Group,
    private readonly material: FabricaMaterial,
    private readonly ordemBase: number,
  ) {}

  /** Malhas no grupo (uma por lote). */
  get tamanho(): number {
    return this.ativas.length;
  }

  /** Escreve os buffers de um lote na malha dele (posições, índices e os atributos de traço/marcador). */
  private escrever(m: THREE.Mesh, lote: LoteGpu): void {
    escreverPosicoes(m.geometry, lote.pos);
    escreverIndices(m.geometry, lote.idx);
    if (lote.traco) {
      escreverAtributo(m.geometry, 'aExt', lote.traco.ext, 4);
      escreverAtributo(m.geometry, 'aDir', lote.traco.dir, 3);
      escreverAtributo(m.geometry, 'aPadrao', lote.traco.padrao, 3);
      if (lote.traco.desl) escreverAtributo(m.geometry, 'aDesl', lote.traco.desl, 2);
      if (lote.traco.banda) escreverAtributo(m.geometry, 'aBanda', lote.traco.banda, 1);
    } else if (lote.desl) {
      escreverAtributo(m.geometry, 'aDesl', lote.desl, 2);
    }
  }

  /** Refaz a camada com estes lotes: a ordem é a do vetor. Lista vazia limpa a camada (as malhas ficam livres). */
  aplicar(lotes: readonly LoteGpu[]): void {
    lotes.forEach((lote, i) => {
      let m = this.ativas[i];
      if (!m) {
        m = this.livres.pop() ?? new THREE.Mesh(geometriaVazia());
        m.frustumCulled = false;
        this.ativas.push(m);
        this.grupo.add(m);
      }
      this.escrever(m, lote);
      m.material = this.material(lote);
      m.renderOrder = this.ordemBase + i;
      m.userData.lote = lote.key;
    });
    while (this.ativas.length > lotes.length) {
      const m = this.ativas.pop()!;
      this.grupo.remove(m);
      this.livres.push(m);
    }
    while (this.livres.length > MALHAS_LIVRES_MAX) this.livres.shift()!.geometry.dispose();
  }

  /** Libera as geometrias (no grupo e livres). O grupo fica vazio; os materiais são da cena. */
  dispose(): void {
    for (const m of [...this.ativas, ...this.livres]) m.geometry.dispose();
    this.grupo.clear();
    this.ativas = [];
    this.livres = [];
  }
}
