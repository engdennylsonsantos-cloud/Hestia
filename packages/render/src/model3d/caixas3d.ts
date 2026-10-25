import * as THREE from 'three';
import type { Ring } from '@hestia/geom';

/**
 * Caixas parametrizadas (desempenho 3D): paredes retas e peças de esquadria são prismas retangulares, e um prisma retangular é a
 * caixa unitária centrada na origem levada ao mundo por uma matriz (centro, giro em z e dimensões). A GPU desenha todas as
 * caixas de um material numa chamada só (`InstancedMesh`), cada uma com a sua matriz; a CPU não gera vértice nenhum.
 * Aqui ficam as contas puras: matriz, retângulo de um anel, separação entre duas caixas, arestas e geometria de picking.
 */

/** Matriz 4×4 em colunas (a ordem do `THREE.Matrix4.elements`): 16 números. */
export type MatrizCaixa = ArrayLike<number>;

/** Tolerância (m) para os lados de um anel formarem um retângulo, e para duas caixas se tocarem. */
export const TOLERANCIA_CAIXA = 1e-6;
/** Dimensão mínima (m) de uma caixa de parede: abaixo disso a peça é fina demais para ser instância (fica na geometria). */
export const DIMENSAO_MINIMA = 1e-4;

/** Matriz de uma caixa: centro `(cx, cy, cz)`, giro `ang` em torno de z, dimensões `w` (eixo u), `d` (eixo v) e `h` (vertical). */
export function matrizDaCaixa(cx: number, cy: number, cz: number, ang: number, w: number, d: number, h: number): number[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [c * w, s * w, 0, 0, -s * d, c * d, 0, 0, 0, 0, h, 0, cx, cy, cz, 1];
}

/** Retângulo de planta: centro, giro do eixo do lado `w`, e os dois lados. */
export interface Retangulo {
  cx: number;
  cy: number;
  ang: number;
  w: number;
  d: number;
}

/** O anel sem vértices repetidos nem colineares (o contorno é o mesmo; sobra só o que é canto). */
function cantosDoAnel(r: Ring): Array<{ x: number; y: number }> {
  let pts = r.slice();
  let mudou = true;
  while (mudou && pts.length > 3) {
    mudou = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!;
      const p = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const cruz = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
      const lado = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.hypot(p.x - a.x, p.y - a.y) < TOLERANCIA_CAIXA || (lado > 0 && Math.abs(cruz) / lado < TOLERANCIA_CAIXA)) {
        pts = pts.filter((_, k) => k !== i);
        mudou = true;
        break;
      }
    }
  }
  return pts;
}

/**
 * O anel como retângulo, ou null se não for um (mais ou menos de 4 cantos, lados que não fecham, ângulo que não é reto, lado
 * mais curto que `DIMENSAO_MINIMA`). Qualquer giro e qualquer sentido (horário ou anti-horário) valem.
 */
export function retanguloDoAnel(ring: Ring): Retangulo | null {
  const p = cantosDoAnel(ring);
  if (p.length !== 4) return null;
  const [p0, p1, p2, p3] = p as [(typeof p)[0], (typeof p)[0], (typeof p)[0], (typeof p)[0]];
  const e1 = { x: p1.x - p0.x, y: p1.y - p0.y };
  const e2 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const e3 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const e4 = { x: p0.x - p3.x, y: p0.y - p3.y };
  const w = Math.hypot(e1.x, e1.y);
  const d = Math.hypot(e2.x, e2.y);
  if (w < DIMENSAO_MINIMA || d < DIMENSAO_MINIMA) return null;
  if (Math.hypot(e1.x + e3.x, e1.y + e3.y) > TOLERANCIA_CAIXA || Math.hypot(e2.x + e4.x, e2.y + e4.y) > TOLERANCIA_CAIXA) return null;
  if (Math.abs(e1.x * e2.x + e1.y * e2.y) / w > TOLERANCIA_CAIXA) return null;
  return { cx: (p0.x + p1.x + p2.x + p3.x) / 4, cy: (p0.y + p1.y + p2.y + p3.y) / 4, ang: Math.atan2(e1.y, e1.x), w, d };
}

/** Caixa de parede: retângulo de planta mais a cota de base e a altura. */
export interface CaixaPlanta extends Retangulo {
  z0: number;
  h: number;
}

/** Intervalo da projeção de uma caixa sobre o eixo (ax, ay): centro e meia-extensão. */
function projecao(c: CaixaPlanta, ax: number, ay: number): { m: number; r: number } {
  const ux = Math.cos(c.ang);
  const uy = Math.sin(c.ang);
  return { m: c.cx * ax + c.cy * ay, r: (c.w / 2) * Math.abs(ux * ax + uy * ay) + (c.d / 2) * Math.abs(-uy * ax + ux * ay) };
}

/**
 * Folga entre duas caixas: o maior intervalo livre entre as projeções nos eixos das duas e em z. Positiva = separadas por esse
 * tanto; perto de zero = encostadas; negativa = uma entra na outra (a profundidade da penetração).
 */
export function folgaEntreCaixas(a: CaixaPlanta, b: CaixaPlanta): number {
  let melhor = -Infinity;
  for (const c of [a, b]) {
    for (const [ax, ay] of [[Math.cos(c.ang), Math.sin(c.ang)], [-Math.sin(c.ang), Math.cos(c.ang)]] as const) {
      const pa = projecao(a, ax, ay);
      const pb = projecao(b, ax, ay);
      melhor = Math.max(melhor, Math.abs(pa.m - pb.m) - pa.r - pb.r);
    }
  }
  const za = a.z0 + a.h / 2;
  const zb = b.z0 + b.h / 2;
  return Math.max(melhor, Math.abs(za - zb) - a.h / 2 - b.h / 2);
}

/** Cantos da caixa unitária, em ordem de bit: índice = ix + 2·iy + 4·iz (cada bit escolhe −½ ou +½). */
const SINAL = [-0.5, 0.5];

/** Posição (mundo) do canto `i` (0..7) da caixa de matriz `m`, a partir do deslocamento `o` de `m`. */
function canto(m: MatrizCaixa, o: number, i: number): [number, number, number] {
  const x = SINAL[i & 1]!;
  const y = SINAL[(i >> 1) & 1]!;
  const z = SINAL[(i >> 2) & 1]!;
  return [m[o]! * x + m[o + 4]! * y + m[o + 8]! * z + m[o + 12]!, m[o + 1]! * x + m[o + 5]! * y + m[o + 9]! * z + m[o + 13]!, m[o + 2]! * x + m[o + 6]! * y + m[o + 10]! * z + m[o + 14]!];
}

/** As 12 arestas da caixa: pares de cantos que diferem em um só bit. */
const ARESTAS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Acrescenta a `saida` as 12 arestas (pares de pontos) de cada caixa de `matrizes` (16 números por caixa). */
export function arestasDasCaixas(matrizes: MatrizCaixa, saida: number[]): void {
  for (let o = 0; o + 16 <= matrizes.length; o += 16) {
    const c = Array.from({ length: 8 }, (_, i) => canto(matrizes, o, i));
    for (const [a, b] of ARESTAS) saida.push(...c[a]!, ...c[b]!);
  }
}

let modelo: { posicoes: Float32Array; indices: Uint16Array } | null = null;
/** Vértices (24) e índices (36) da caixa unitária de `THREE.BoxGeometry`: a mesma que a cena instancia, com a mesma orientação das faces. */
function caixaModelo(): { posicoes: Float32Array; indices: Uint16Array } {
  if (!modelo) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    modelo = { posicoes: Float32Array.from(g.getAttribute('position').array), indices: Uint16Array.from(g.index!.array) };
    g.dispose();
  }
  return modelo;
}

/** Geometria de picking e realce de um conjunto de caixas: os triângulos de cada uma levados ao mundo (36 índices por caixa). */
export function geometriaDeCaixas(matrizes: MatrizCaixa): THREE.BufferGeometry {
  const { posicoes, indices } = caixaModelo();
  const n = Math.floor(matrizes.length / 16);
  const pos = new Float32Array(n * posicoes.length);
  const idx = new Uint32Array(n * indices.length);
  for (let k = 0; k < n; k++) {
    const o = k * 16;
    for (let v = 0; v < posicoes.length; v += 3) {
      const x = posicoes[v]!;
      const y = posicoes[v + 1]!;
      const z = posicoes[v + 2]!;
      const d = k * posicoes.length + v;
      pos[d] = matrizes[o]! * x + matrizes[o + 4]! * y + matrizes[o + 8]! * z + matrizes[o + 12]!;
      pos[d + 1] = matrizes[o + 1]! * x + matrizes[o + 5]! * y + matrizes[o + 9]! * z + matrizes[o + 13]!;
      pos[d + 2] = matrizes[o + 2]! * x + matrizes[o + 6]! * y + matrizes[o + 10]! * z + matrizes[o + 14]!;
    }
    for (let i = 0; i < indices.length; i++) idx[k * indices.length + i] = indices[i]! + k * (posicoes.length / 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Índices por caixa na geometria de picking (`geometriaDeCaixas`). */
export const INDICES_POR_CAIXA = 36;

/** A caixa unitária que a cena instancia: centrada na origem, lado 1. */
export function criarCaixaUnitaria(): THREE.BoxGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}
