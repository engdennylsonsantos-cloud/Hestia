import { cross, dot, len, sub, type Vec2 } from '@hestia/geom';
import type { Roof, RoofShape } from '@hestia/model';

/** Formas que viram predefinições por aresta (Revit: Define Slope). Free e extrusion têm cálculo próprio. */
export type EdgePresetShape = 'shed' | 'gable' | 'hip' | 'edges';

/** Ponto médio da aresta i (de boundary[i] a boundary[i+1]). */
const midOf = (ring: Vec2[], i: number): Vec2 => ({ x: (ring[i]!.x + ring[(i + 1) % ring.length]!.x) / 2, y: (ring[i]!.y + ring[(i + 1) % ring.length]!.y) / 2 });

/** Vetor unitário de `d`, ou null quando é nulo. */
const unitOrNull = (d: Vec2): Vec2 | null => {
  const l = len(d);
  return l < 1e-9 ? null : { x: d.x / l, y: d.y / l };
};

/**
 * Predefinições por aresta a partir da forma da barra de opções. Uma água: só a aresta mais baixa em relação a `dir`
 * (subida) define inclinação. Duas águas: as arestas paralelas a `dir` (cumeeira) definem e as outras são empenas.
 * Quatro águas e "por arestas": todas definem. Devolve uma entrada por aresta: número = define (%), null = empena.
 */
export function presetEdgeSlopes(boundary: Vec2[], shape: EdgePresetShape, dir: Vec2, slopePercent: number): Array<number | null> {
  if (shape === 'hip' || shape === 'edges') return boundary.map(() => slopePercent);
  const d = unitOrNull(dir) ?? { x: 1, y: 0 };
  if (shape === 'shed') {
    let low = 0;
    let lowT = Infinity;
    boundary.forEach((_, i) => {
      const t = dot(midOf(boundary, i), d);
      if (t < lowT - 1e-12) {
        lowT = t;
        low = i;
      }
    });
    return boundary.map((_, i) => (i === low ? slopePercent : null));
  }
  return boundary.map((a, i) => {
    const e = unitOrNull(sub(boundary[(i + 1) % boundary.length]!, a));
    if (!e) return null;
    // Paralela ao eixo quando o ângulo com `dir` é menor que 45°.
    return Math.abs(dot(e, d)) > Math.abs(cross(e, d)) ? slopePercent : null;
  });
}

/**
 * Predefinição de forma (duas águas, uma água ou quatro águas) que reproduz exatamente as inclinações por aresta do
 * telhado, com a mesma direção e inclinação; null quando não corresponde a nenhuma (inclinações editadas por aresta).
 * A Propriedades usa para mostrar a forma escolhida na barra, em vez de "Por arestas".
 */
export function roofPresetOf(r: Roof): EdgePresetShape | null {
  for (const s of ['gable', 'shed', 'hip'] as const) {
    const want = presetEdgeSlopes(r.boundary, s, r.dir, r.slopePercent);
    const same = want.length === r.edgeSlopes.length && want.every((v, i) => (v === null ? r.edgeSlopes[i] === null : r.edgeSlopes[i] !== null && Math.abs(r.edgeSlopes[i]! - v) < 1e-9));
    if (same) return s;
  }
  return null;
}

/**
 * Desloca só a aresta `i` do contorno em `delta` metros: positivo para fora, negativo para dentro. Os vértices vizinhos
 * andam ao longo das arestas adjacentes (cantos em esquadria). Null quando a aresta é nula ou as vizinhas são paralelas a ela.
 */
export function offsetEdge(boundary: Vec2[], i: number, delta: number): Vec2[] | null {
  const n = boundary.length;
  if (n < 3) return null;
  const a = boundary[i]!;
  const b = boundary[(i + 1) % n]!;
  const u = unitOrNull(sub(b, a));
  if (!u) return null;
  // Contorno anti-horário (área positiva): a normal para fora é a direita da aresta; no sentido horário, a esquerda.
  const area = boundary.reduce((s, p, k) => s + cross(p, boundary[(k + 1) % n]!), 0);
  const out = area >= 0 ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
  const p = { x: a.x + out.x * delta, y: a.y + out.y * delta };
  const start = lineHit(p, u, boundary[(i - 1 + n) % n]!, sub(a, boundary[(i - 1 + n) % n]!));
  const end = lineHit(p, u, b, sub(boundary[(i + 2) % n]!, b));
  if (!start || !end) return null;
  return boundary.map((q, k) => (k === i ? start : k === (i + 1) % n ? end : q));
}

/** Interseção da reta (p, direção d unitária) com a reta (q, direção e), ou null quando são paralelas. */
function lineHit(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12 * Math.max(1, len(e))) return null;
  const t = cross(sub(q, p), e) / den;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

/** Operação de vértice no contorno, e como o vetor por aresta (edgeSlopes, edgeOverhangs) acompanha. */
export type RingEdit = { kind: 'insert'; edge: number } | { kind: 'remove'; vertex: number };

/**
 * Vetor por aresta depois de uma edição de vértice. Inserir um vértice na aresta `edge` divide a aresta: as duas metades
 * herdam o valor. Remover o vértice `vertex` funde as arestas `vertex-1` e `vertex`: a aresta fundida fica com o valor
 * da primeira (`vertex-1`, cíclico).
 */
export function editRingEdges<T>(values: readonly T[], edit: RingEdit): T[] {
  if (edit.kind === 'insert') {
    const out = [...values];
    out.splice(edit.edge + 1, 0, values[edit.edge]!);
    return out;
  }
  // Remover o vértice v apaga a aresta v; a aresta v-1 (cíclica) segue de v-1 até v+1 e mantém o seu valor.
  return values.filter((_, k) => k !== edit.vertex);
}

/**
 * Patch de um telhado depois de uma edição de vértice: o vetor por aresta (inclinação e balanço) acompanha a inserção na
 * aresta ou a remoção de vértice (`edit`). Sem `edit` (vértice movido), só o contorno muda.
 */
export function roofRingPatch(r: Roof, ring: Vec2[], edit: RingEdit | null): Partial<Roof> {
  if (!edit) return { boundary: ring };
  return { boundary: ring, edgeSlopes: editRingEdges(r.edgeSlopes, edit), edgeOverhangs: editRingEdges(r.edgeOverhangs, edit) };
}

/** Vértice mais baixo do contorno em relação à subida `up` (ponto de origem da água). */
export function lowestVertex(ring: Vec2[], up: Vec2): Vec2 {
  let low = ring[0]!;
  let lowT = Infinity;
  for (const q of ring) {
    const t = dot(q, up);
    if (t < lowT) {
      lowT = t;
      low = q;
    }
  }
  return low;
}

/**
 * Patch de forma pelo seletor da Propriedades. Uma água, duas águas, quatro águas e por arestas viram 'edges' com as
 * predefinições (a cumeeira gira 90° quando a troca é entre uma água e duas águas, para manter a orientação). 'free'
 * vira águas livres com uma água sobre o contorno inteiro, sem mudar o que já é livre.
 */
export function roofShapePatch(r: Roof, shape: RoofShape, slopePercent: number = r.slopePercent): Partial<Roof> {
  if (shape === 'extrusion' || shape === r.shape) return {};
  if (shape === 'free') {
    const up = unitOrNull(r.dir) ?? { x: 1, y: 0 };
    return { shape: 'free', slopePercent, planes: [{ polygon: r.boundary, origin: lowestVertex(r.boundary, up), up, percent: slopePercent, z0: 0 }] };
  }
  const switchesRidge = (r.shape === 'shed' && shape === 'gable') || (r.shape === 'gable' && shape === 'shed');
  // `+ 0` tira o -0 da rotação, para que o JSON e as comparações do projeto fiquem estáveis.
  const dir = switchesRidge ? { x: -r.dir.y + 0, y: r.dir.x + 0 } : r.dir;
  return { shape: 'edges', slopePercent, dir, edgeSlopes: presetEdgeSlopes(r.boundary, shape, dir, slopePercent) };
}
