import type { TrianguloMundo } from './fixturesInstanciada3d.ts';

/** Medidas de comparação entre duas cenas (triângulos e segmentos no mundo). Apoio dos testes; não é um teste. */

/** Caixa delimitadora por categoria: [xmin, ymin, zmin, xmax, ymax, zmax]. */
export function caixaPorCategoria(tris: readonly TrianguloMundo[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of tris) {
    let b = out.get(t.kind);
    if (!b) {
      b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      out.set(t.kind, b);
    }
    for (let i = 0; i < 9; i += 3) {
      for (let k = 0; k < 3; k++) {
        b[k] = Math.min(b[k]!, t.v[i + k]!);
        b[k + 3] = Math.max(b[k + 3]!, t.v[i + k]!);
      }
    }
  }
  return out;
}

/** Volume assinado por categoria (teorema da divergência): o das superfícies fechadas da categoria. */
export function volumePorCategoria(tris: readonly TrianguloMundo[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of tris) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.v as [number, number, number, number, number, number, number, number, number];
    const v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    out.set(t.kind, (out.get(t.kind) ?? 0) + v);
  }
  return out;
}

/** Vértices únicos (arredondados a 1e-3 para a chave) dos triângulos de uma categoria. */
function vertices(tris: readonly TrianguloMundo[]): number[][] {
  const vistos = new Map<string, number[]>();
  for (const t of tris) {
    for (let i = 0; i < 9; i += 3) {
      const p = [t.v[i]!, t.v[i + 1]!, t.v[i + 2]!];
      vistos.set(p.map((x) => Math.round(x * 1000)).join(','), p);
    }
  }
  return [...vistos.values()];
}

/** Vértices de `a` sem nenhum vértice de `b` a menos de `tol` (busca em grade de 1 cm). */
export function verticesSemPar(a: readonly TrianguloMundo[], b: readonly TrianguloMundo[], tol: number): number[][] {
  const grade = new Map<string, number[][]>();
  const cel = (p: number[]): number[] => p.map((x) => Math.floor(x / 0.01));
  for (const p of vertices(b)) {
    const k = cel(p).join(',');
    const l = grade.get(k);
    if (l) l.push(p);
    else grade.set(k, [p]);
  }
  const sem: number[][] = [];
  for (const p of vertices(a)) {
    const [ci, cj, ck] = cel(p) as [number, number, number];
    let achou = false;
    for (let i = -1; i <= 1 && !achou; i++) {
      for (let j = -1; j <= 1 && !achou; j++) {
        for (let k = -1; k <= 1 && !achou; k++) {
          const l = grade.get(`${ci + i},${cj + j},${ck + k}`);
          achou = !!l?.some((q) => Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!, q[2]! - p[2]!) <= tol);
        }
      }
    }
    if (!achou) sem.push(p);
  }
  return sem;
}

/** Gerador pseudoaleatório determinístico (LCG) em [0, 1). */
export function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Quantos triângulos o raio de `p` na direção +x atravessa (Möller–Trumbore); a paridade diz se `p` está dentro de um sólido fechado. */
export function cruzamentos(tris: readonly TrianguloMundo[], p: readonly [number, number, number]): number {
  let n = 0;
  for (const t of tris) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.v as [number, number, number, number, number, number, number, number, number];
    if ((ay < p[1] && by < p[1] && cy < p[1]) || (ay > p[1] && by > p[1] && cy > p[1])) continue;
    if ((az < p[2] && bz < p[2] && cz < p[2]) || (az > p[2] && bz > p[2] && cz > p[2])) continue;
    if (ax < p[0] && bx < p[0] && cx < p[0]) continue;
    // Raio (1, 0, 0): h = d × e2, com d = (1,0,0).
    const e1 = [bx - ax, by - ay, bz - az];
    const e2 = [cx - ax, cy - ay, cz - az];
    const h = [0, -e2[2]!, e2[1]!];
    const det = e1[0]! * h[0]! + e1[1]! * h[1]! + e1[2]! * h[2]!;
    if (Math.abs(det) < 1e-14) continue;
    const s = [p[0] - ax, p[1] - ay, p[2] - az];
    const u = (s[0]! * h[0]! + s[1]! * h[1]! + s[2]! * h[2]!) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
    const v = q[0]! / det;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det;
    if (dist > 0) n++;
  }
  return n;
}

/** Distância do ponto ao segmento [a, b]. */
function distanciaAoSegmento(p: readonly number[], s: readonly number[]): number {
  const d = [s[3]! - s[0]!, s[4]! - s[1]!, s[5]! - s[2]!];
  const w = [p[0]! - s[0]!, p[1]! - s[1]!, p[2]! - s[2]!];
  const l2 = d[0]! * d[0]! + d[1]! * d[1]! + d[2]! * d[2]!;
  const t = l2 < 1e-18 ? 0 : Math.min(1, Math.max(0, (w[0]! * d[0]! + w[1]! * d[1]! + w[2]! * d[2]!) / l2));
  return Math.hypot(w[0]! - t * d[0]!, w[1]! - t * d[1]!, w[2]! - t * d[2]!);
}

/**
 * Comprimento (m) dos segmentos de `a` que não estão cobertos pelos de `b` (amostra de 9 pontos por segmento; um ponto
 * descoberto a mais de `tol` conta 1/8 do comprimento do segmento). Mede se as arestas desenhadas são as mesmas.
 */
export function comprimentoDescoberto(a: readonly number[][], b: readonly number[][], tol: number): number {
  const grade = new Map<string, number[][]>();
  const cel = (x: number, y: number, z: number): string => `${Math.floor(x / 0.5)},${Math.floor(y / 0.5)},${Math.floor(z / 0.5)}`;
  for (const s of b) {
    const k = new Set<string>();
    for (let t = 0; t <= 8; t++) k.add(cel(s[0]! + ((s[3]! - s[0]!) * t) / 8, s[1]! + ((s[4]! - s[1]!) * t) / 8, s[2]! + ((s[5]! - s[2]!) * t) / 8));
    for (const key of k) {
      const l = grade.get(key);
      if (l) l.push(s);
      else grade.set(key, [s]);
    }
  }
  let total = 0;
  for (const s of a) {
    const len = Math.hypot(s[3]! - s[0]!, s[4]! - s[1]!, s[5]! - s[2]!);
    let fora = 0;
    for (let t = 0; t <= 8; t++) {
      const p = [s[0]! + ((s[3]! - s[0]!) * t) / 8, s[1]! + ((s[4]! - s[1]!) * t) / 8, s[2]! + ((s[5]! - s[2]!) * t) / 8];
      let coberto = false;
      for (let i = -1; i <= 1 && !coberto; i++) {
        for (let j = -1; j <= 1 && !coberto; j++) {
          for (let k = -1; k <= 1 && !coberto; k++) {
            const l = grade.get(cel(p[0]! + i * 0.5, p[1]! + j * 0.5, p[2]! + k * 0.5));
            coberto = !!l?.some((q) => distanciaAoSegmento(p, q) <= tol);
          }
        }
      }
      if (!coberto) fora++;
    }
    total += (len * fora) / 9;
  }
  return total;
}
