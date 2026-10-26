import * as THREE from 'three';
import { caixaDePosicoes, unirCaixas, type Caixa } from './loteGeometria.ts';
import type { OrcamentoVram } from './orcamento.ts';

/**
 * Linha única com as arestas de todos os níveis (pares de pontos). Mesmo princípio do lote de geometria: um segmento por
 * nível e envio parcial quando só um nível muda. Separada de `loteGeometria.ts` para manter cada módulo pequeno.
 */

interface SegmentoLinha {
  inicio: number;
  n: number;
  posicoes: Float32Array;
  caixa: Caixa | null;
}

export class LoteLinhasGpu {
  readonly linhas: THREE.LineSegments;
  private segmentos = new Map<string, SegmentoLinha>();
  private posicoes = new Float32Array(0);
  private cap = 0;
  private n = 0;
  private geometria: THREE.BufferGeometry;
  private sujo = false;
  private completo = false;
  private chaveOrcamento: string;

  constructor(
    material: THREE.Material,
    private readonly orcamento: OrcamentoVram,
  ) {
    this.chaveOrcamento = 'linhas:arestas';
    this.geometria = this.criarGeometria();
    this.linhas = new THREE.LineSegments(this.geometria, material);
    this.linhas.matrixAutoUpdate = false;
    this.linhas.visible = false;
  }

  get(levelId: string): boolean {
    return this.segmentos.has(levelId);
  }

  get vazio(): boolean {
    return this.segmentos.size === 0;
  }

  get bytes(): number {
    return this.posicoes.byteLength;
  }

  /** Define as arestas de um nível (pares x, y, z). */
  definir(levelId: string, dados: Float32Array): void {
    const n = Math.floor(dados.length / 3);
    const velho = this.segmentos.get(levelId);
    if (velho && velho.n === n) {
      this.posicoes.set(dados, velho.inicio * 3);
      (this.geometria.getAttribute('position') as THREE.BufferAttribute).addUpdateRange(velho.inicio * 3, n * 3);
      velho.posicoes = dados;
      velho.caixa = caixaDePosicoes(dados);
      this.sujo = true;
      return;
    }
    if (velho) this.remover(levelId);
    const cresceu = this.garantir(this.n + n);
    if (cresceu) this.completo = true;
    this.posicoes.set(dados, this.n * 3);
    this.segmentos.set(levelId, { inicio: this.n, n, posicoes: dados, caixa: caixaDePosicoes(dados) });
    this.n += n;
    if (!this.completo) (this.geometria.getAttribute('position') as THREE.BufferAttribute).addUpdateRange((this.n - n) * 3, n * 3);
    this.sujo = true;
  }

  remover(levelId: string): boolean {
    if (!this.segmentos.delete(levelId)) return false;
    this.remontar();
    return true;
  }

  /** Ordena os segmentos pela ordem do projeto e corta a capacidade para o tamanho exato. */
  consolidar(ordem: readonly string[]): void {
    if (this.segmentos.size) {
      const novo = new Map<string, SegmentoLinha>();
      for (const id of ordem) {
        const s = this.segmentos.get(id);
        if (s) novo.set(id, s);
      }
      for (const [id, s] of this.segmentos) if (!novo.has(id)) novo.set(id, s);
      this.segmentos = novo;
    }
    const total = this.n;
    const antiga = this.geometria;
    this.posicoes = new Float32Array(total * 3);
    this.cap = total;
    this.geometria = this.criarGeometria();
    this.linhas.geometry = this.geometria;
    antiga.dispose();
    let inicio = 0;
    for (const s of this.segmentos.values()) {
      s.inicio = inicio;
      s.caixa = caixaDePosicoes(s.posicoes);
      this.posicoes.set(s.posicoes, inicio * 3);
      inicio += s.n;
    }
    this.completo = true;
    this.sujo = true;
  }

  finalizar(): boolean {
    if (!this.sujo) return false;
    this.geometria.setDrawRange(0, this.n);
    this.linhas.visible = this.n > 0;
    this.atualizarCaixa();
    const pos = this.geometria.getAttribute('position') as THREE.BufferAttribute;
    if (this.completo) pos.clearUpdateRanges();
    pos.needsUpdate = true;
    this.orcamento.definir(this.chaveOrcamento, this.bytes);
    this.sujo = false;
    this.completo = false;
    return true;
  }

  /** Material da linha (a vista pode trocar tema/estilo). */
  aplicarMaterial(material: THREE.Material): void {
    if (this.linhas.material !== material) this.linhas.material = material;
  }

  /** Liga/desliga a linha sem descartar as arestas (o próximo `definir` volta a preencher). */
  definirVisivel(visivel: boolean): void {
    this.linhas.visible = visivel && this.n > 0;
  }

  dispose(): void {
    this.orcamento.remover(this.chaveOrcamento);
    this.geometria.dispose();
    this.segmentos.clear();
  }

  private criarGeometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posicoes, 3));
    g.setDrawRange(0, this.n);
    return g;
  }

  private garantir(necessario: number): boolean {
    if (necessario <= this.cap) return false;
    const cap = Math.max(necessario, Math.ceil(this.cap * 1.5), 512);
    const pos = new Float32Array(cap * 3);
    pos.set(this.posicoes.subarray(0, this.n * 3));
    this.posicoes = pos;
    this.cap = cap;
    const antiga = this.geometria;
    this.geometria = this.criarGeometria();
    this.linhas.geometry = this.geometria;
    antiga.dispose();
    return true;
  }

  private remontar(): void {
    let total = 0;
    for (const s of this.segmentos.values()) total += s.n;
    this.garantir(total);
    let inicio = 0;
    for (const s of this.segmentos.values()) {
      s.inicio = inicio;
      this.posicoes.set(s.posicoes, inicio * 3);
      s.caixa = caixaDePosicoes(s.posicoes);
      inicio += s.n;
    }
    this.n = total;
    this.completo = true;
    this.sujo = true;
  }

  private atualizarCaixa(): void {
    let caixa: Caixa | null = null;
    for (const s of this.segmentos.values()) caixa = unirCaixas(caixa, s.caixa);
    if (!caixa) {
      this.geometria.boundingBox = null;
      this.geometria.boundingSphere = null;
      return;
    }
    const box = new THREE.Box3(new THREE.Vector3(caixa[0], caixa[1], caixa[2]), new THREE.Vector3(caixa[3], caixa[4], caixa[5]));
    this.geometria.boundingBox = box;
    this.geometria.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  }
}
