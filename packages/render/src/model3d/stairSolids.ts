import { add, mul, norm, perp, ringArea, sub, type Ring, type Vec2 } from '@hestia/geom';
import { pieceBottomZ, stairBody, type ResolvedStair, type ResolvedStairRiser, type ResolvedStairStep, type StairBodyPiece } from '@hestia/engine';
import type { Id, StairType } from '@hestia/model';
import { riserPoints } from '../stairRisers.ts';
import { extrudeCaps, pushWall, type SolidBatch } from './solids.ts';

/** Tolerância (m) para reconhecer a cota de um degrau igual à de um espelho. */
const Z_TOL = 1e-9;

/** Tolerância (m, m²) das comparações de cota e de área (sinal de diferenças e sobreposições). */
const EPS = 1e-9;

/** Espessura mínima (m) de uma peça monolítica: o fundo nunca alcança o topo (decisão 0012 §2). */
const MIN_PIECE_THICKNESS = 1e-4;

/** Distância (m) para dois vértices serem o mesmo, ou para um vértice cair sobre uma aresta (T-junction). */
const VERTEX_TOL = 1e-6;

/** Lado (m) da célula da grade de vértices que acha os vértices sobre cada aresta. */
const GRID_CELL = 0.25;

/** Centroide simples (média dos vértices): basta para degraus, que são polígonos quase convexos. */
const centroid = (r: Ring): Vec2 => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length });

/** Normal à esquerda em cada vértice da polilinha (tangente pela diferença central; unilateral nas pontas). */
function leftNormals(pts: Vec2[]): Vec2[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    return perp(norm(sub(b, a)));
  });
}

/**
 * Lado para o qual a espessura do espelho cresce: para trás, onde fica o degrau de cota z0 (o anterior, mais baixo).
 * Sem degrau de cota z0 (primeiro espelho), vai para o lado oposto ao degrau de cota z1. Retorna +1 (esquerda) ou −1.
 */
function behindSide(s: ResolvedStair, r: ResolvedStairRiser, mid: Vec2, n: Vec2): 1 | -1 {
  const stepAt = (z: number): ResolvedStairStep | undefined => s.steps.find((st) => Math.abs(st.z - z) < Z_TOL);
  const below = stepAt(r.z0);
  if (below) return dotSign(n, sub(centroid(below.polygon), mid)) >= 0 ? 1 : -1;
  const above = stepAt(r.z1);
  if (above) return dotSign(n, sub(centroid(above.polygon), mid)) >= 0 ? -1 : 1;
  return 1;
}

const dotSign = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/**
 * Seção do espelho com espessura `t` atrás da linha (para o lado do degrau anterior): a polilinha da linha do espelho
 * seguida da mesma polilinha deslocada. Assim o espelho não invade o degrau de cota superior nem o de baixo.
 */
export function riserSlab(s: ResolvedStair, r: ResolvedStairRiser, t: number): Ring {
  const pts = riserPoints(r);
  const ns = leftNormals(pts);
  const n0 = ns[Math.floor(ns.length / 2)]!;
  const mid = pts[Math.floor(pts.length / 2)]!;
  const side = behindSide(s, r, mid, n0);
  const off = pts.map((p, i) => add(p, mul(ns[i]!, side * t)));
  return [...pts, ...off.reverse()];
}

/** Lote do material `m` dentro do mapa, criado na primeira vez. */
function batchOf(byMat: Map<Id, SolidBatch>, m: Id): SolidBatch {
  let b = byMat.get(m);
  if (!b) {
    b = { materialId: m, positions: [], normals: [], indices: [] };
    byMat.set(m, b);
  }
  return b;
}

/** Anel no sentido anti-horário (interior à esquerda), para a normal de cada aresta apontar para fora. */
const counterClockwise = (r: Ring): Ring => (ringArea(r) > 0 ? r : [...r].reverse());

/** Chave de vértice na planta (1e-6 m): duas peças que dividem uma aresta a têm com a mesma chave. */
const planKey = (p: Vec2): string => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;

/** Sinal de uma diferença de cotas, com a tolerância EPS: 1, −1 ou 0 (coincidentes). */
const sgn = (v: number): number => (v > EPS ? 1 : v < -EPS ? -1 : 0);

/** Fundo da peça por ponto: o plano, limitado a `topo − 1e-4` para a espessura nunca ser nula ou negativa. */
function bottomOf(piece: StairBodyPiece): (x: number, y: number) => number {
  return (x, y) => Math.min(pieceBottomZ(piece, x, y), piece.zTop - MIN_PIECE_THICKNESS);
}

/** Corpo da escada para a extrusão: polígono da planta, fundo por ponto, topo (constante) e material da peça. */
interface Body {
  polygon: Ring;
  bot: (x: number, y: number) => number;
  top: number;
  materialId: Id;
}

/** Trechos de [loA, hiA] fora de [loB, hiB], para cotas de um mesmo ponto da aresta: a parte de baixo e a de cima. */
function uncovered(loA: number, hiA: number, loB: number, hiB: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (Math.min(hiA, loB) > loA + EPS) out.push([loA, Math.min(hiA, loB)]);
  if (hiA > Math.max(loA, hiB) + EPS) out.push([Math.max(loA, hiB), hiA]);
  return out;
}

/** Sinais das seis comparações entre as cotas de duas peças. Se forem iguais nos dois extremos, não há cruzamento. */
const orderOf = (loA: number, hiA: number, loB: number, hiB: number): string =>
  [loA - hiA, loA - loB, loA - hiB, hiA - loB, hiA - hiB, loB - hiB].map(sgn).join(',');

/**
 * Faixas da parede de `a` na aresta p→q que ficam expostas: a parede inteira menos o trecho que coincide com a parede
 * da peça vizinha `b` (a mesma aresta, no sentido oposto). Cada faixa tem a cota de fundo e de topo em p e em q. Se a
 * ordem das cotas muda entre p e q (o encontro não é um prisma), nada é cortado e as duas paredes ficam inteiras.
 */
function exposedSpans(a: Body, b: Body | undefined, p: Vec2, q: Vec2): Array<{ p: [number, number]; q: [number, number] }> {
  const loP = a.bot(p.x, p.y);
  const loQ = a.bot(q.x, q.y);
  if (!b) return [{ p: [loP, a.top], q: [loQ, a.top] }];
  const bP = b.bot(p.x, p.y);
  const bQ = b.bot(q.x, q.y);
  if (orderOf(loP, a.top, bP, b.top) !== orderOf(loQ, a.top, bQ, b.top)) return [{ p: [loP, a.top], q: [loQ, a.top] }];
  const sp = uncovered(loP, a.top, bP, b.top);
  const sq = uncovered(loQ, a.top, bQ, b.top);
  return sp.map((s, i) => ({ p: s, q: sq[i]! }));
}

/**
 * Extrusão dos corpos de uma escada: topo e fundo de cada um, e a parede só onde a face fica exposta. Uma aresta da
 * planta que dois corpos dividem (espelho entre degraus, corte pelo piso base) não tem parede nessa parte: as duas
 * paredes coincidentes são internas e se cancelam no volume. Assim o desenho de arestas não marca emendas.
 */
function extrudeBodies(b: SolidBatch, input: Body[]): void {
  // Corpo sem espessura não entra: não deve cortar a parede de vizinho.
  const bodies = input.filter((c) => c.top - Math.min(...c.polygon.map((p) => c.bot(p.x, p.y))) > 1e-6);
  const rings = bodies.map((c) => counterClockwise(c.polygon));
  // Aresta p→q de cada corpo; a do corpo vizinho aparece no sentido oposto, q→p.
  const owner = new Map<string, number>();
  rings.forEach((r, i) => r.forEach((p, e) => owner.set(`${planKey(p)}>${planKey(r[(e + 1) % r.length]!)}`, i)));
  bodies.forEach((c, i) => {
    const zMin = Math.min(...c.polygon.map((p) => c.bot(p.x, p.y)));
    extrudeCaps(b, [c.polygon], zMin, c.top, undefined, c.bot);
    const r = rings[i]!;
    r.forEach((p, e) => {
      const q = r[(e + 1) % r.length]!;
      const j = owner.get(`${planKey(q)}>${planKey(p)}`);
      for (const s of exposedSpans(c, j === undefined ? undefined : bodies[j], p, q)) pushWall(b, p, q, s.p[0], s.q[0], s.p[1], s.q[1]);
    });
  });
}

/**
 * Peças do lance monolítico (decisão 0012) e do poste (decisão 0014 §8) como corpos: topo plano e fundo em rampa ou plano.
 * O poste central (`post`) vai no material `postMaterialId`; os degraus e patamares, no material do tipo.
 */
const monolithicBodies = (pieces: StairBodyPiece[], type: StairType): Body[] =>
  pieces.map((p) => ({ polygon: p.polygon, bot: bottomOf(p), top: p.zTop, materialId: p.kind === 'post' ? type.postMaterialId : type.materialId }));

/**
 * Corpos do lance montado: cada degrau e patamar é um prisma de topo em `z` e base `treadThickness` (ou
 * `landingThickness`) abaixo; cada espelho é o prisma de `riserThickness` atrás da linha, de `z0` a `z1`.
 */
function assembledBodies(s: ResolvedStair): Body[] {
  const { treadThickness, landingThickness, riserThickness, materialId } = s.type;
  const bodies: Body[] = s.steps.map((st) => {
    const z0 = st.z - (st.kind === 'landing' ? landingThickness : treadThickness);
    return { polygon: st.polygon, bot: () => z0, top: st.z, materialId };
  });
  if (riserThickness > 0) for (const r of s.risers) bodies.push({ polygon: riserSlab(s, r, riserThickness), bot: () => r.z0, top: r.z1, materialId });
  return bodies;
}

/**
 * Insere, nas arestas dos triângulos, os vértices de outras faces que caem sobre elas (T-junction). Assim cada aresta
 * real casa com a da face vizinha e o desenho de arestas não marca emendas. Só divide triângulos: a superfície não muda.
 */
function splitTJunctions(b: SolidBatch): void {
  type V = [number, number, number];
  const corner = (k: number): V => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!];
  const cellOf = (v: V): string => `${Math.floor(v[0] / GRID_CELL)},${Math.floor(v[1] / GRID_CELL)},${Math.floor(v[2] / GRID_CELL)}`;
  const grid = new Map<string, V[]>();
  const seen = new Set<string>();
  for (let k = 0; k < b.positions.length / 3; k++) {
    const v = corner(k);
    const key = v.map((c) => Math.round(c * 1e6)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = cellOf(v);
    const list = grid.get(cell);
    if (list) list.push(v);
    else grid.set(cell, [v]);
  }
  /** Vértices da grade sobre o segmento a→c (sem os extremos), de a para c. */
  const onEdge = (a: V, c: V): V[] => {
    const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const L = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (L < VERTEX_TOL) return [];
    const u = [d[0]! / L, d[1]! / L, d[2]! / L];
    const lo = [0, 1, 2].map((k) => Math.floor((Math.min(a[k]!, c[k]!) - VERTEX_TOL) / GRID_CELL));
    const hi = [0, 1, 2].map((k) => Math.floor((Math.max(a[k]!, c[k]!) + VERTEX_TOL) / GRID_CELL));
    const found: Array<{ t: number; v: V }> = [];
    for (let i = lo[0]!; i <= hi[0]!; i++)
      for (let j = lo[1]!; j <= hi[1]!; j++)
        for (let k = lo[2]!; k <= hi[2]!; k++)
          for (const v of grid.get(`${i},${j},${k}`) ?? []) {
            const w = [v[0] - a[0], v[1] - a[1], v[2] - a[2]];
            const t = w[0]! * u[0]! + w[1]! * u[1]! + w[2]! * u[2]!;
            if (t <= VERTEX_TOL || t >= L - VERTEX_TOL) continue;
            const off = Math.hypot(w[0]! - t * u[0]!, w[1]! - t * u[1]!, w[2]! - t * u[2]!);
            if (off < VERTEX_TOL) found.push({ t, v });
          }
    return found.sort((x, y) => x.t - y.t).map((f) => f.v);
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const emit = (tri: [V, V, V], n: number[]): void => {
    for (const v of tri) {
      indices.push(positions.length / 3);
      positions.push(v[0], v[1], v[2]);
      normals.push(n[0]!, n[1]!, n[2]!);
    }
  };
  for (let i = 0; i < b.indices.length; i += 3) {
    const [i0, i1, i2] = [b.indices[i]!, b.indices[i + 1]!, b.indices[i + 2]!];
    const n = [b.normals[i0 * 3]!, b.normals[i0 * 3 + 1]!, b.normals[i0 * 3 + 2]!];
    const [A, B, C] = [corner(i0), corner(i1), corner(i2)];
    const poly: V[] = [A, ...onEdge(A, B), B, ...onEdge(B, C), C, ...onEdge(C, A)];
    if (poly.length === 3) {
      emit([A, B, C], n);
      continue;
    }
    // Leque a partir do centroide do triângulo: ele não cai sobre nenhum lado, então todo trecho de lado vira aresta.
    const O: V = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
    for (let k = 0; k < poly.length; k++) emit([O, poly[k]!, poly[(k + 1) % poly.length]!], n);
  }
  b.positions = positions;
  b.normals = normals;
  b.indices = indices;
}

/**
 * Sólidos das escadas (3D), por material (decisão 0011 §1). Lance monolítico (decisão 0012): o corpo são as
 * peças de `stairBody` (degraus, patamares e chegada), cada uma com topo plano e fundo plano ou em rampa; os espelhos
 * são a face de trás das peças, então não há placas. As paredes entre peças vizinhas só existem onde a face está
 * exposta, e os vértices soltos sobre as arestas são inseridos (`extrudeBodies`, `splitTJunctions`). Lance montado:
 * degrau de `z − treadThickness` a `z`; espelho de `riserThickness` atrás da linha; patamar de `landingThickness`.
 * Poste (decisão 0014 §8): degraus soltos (sem espelho) no material do tipo, e o poste central (cilindro de 24 faces) no
 * `postMaterialId`; cada material vai ao seu lote, e cada peça fecha as próprias paredes onde expostas.
 * Escada com erro (issue `error`) ou sem degraus não gera malha. `arrivalTopOf` dá a cota do topo da chegada de cada
 * escada (`stairArrivalTopZ`, a face inferior da laje que cobre o último espelho); `null` ou sem callback: topo − 0,15 m.
 */
export function buildStairSolids(stairs: ResolvedStair[], arrivalTopOf: (s: ResolvedStair) => number | null = () => null): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const s of stairs) {
    if (s.steps.length === 0 || s.issues.some((i) => i.severity === 'error')) continue;
    const bodies =
      s.type.runStyle === 'monolithic' || s.type.runStyle === 'post'
        ? monolithicBodies(stairBody(s, { arrivalTopZ: arrivalTopOf(s) ?? undefined }).pieces, s.type)
        : assembledBodies(s);
    // Um lote por material: cada chamada de `extrudeBodies` só pareia paredes entre peças do mesmo material (cada peça fecha o próprio corpo).
    const byBodyMaterial = new Map<Id, Body[]>();
    for (const body of bodies) byBodyMaterial.set(body.materialId, [...(byBodyMaterial.get(body.materialId) ?? []), body]);
    if (byBodyMaterial.size === 0) batchOf(byMat, s.type.materialId);
    for (const [materialId, list] of byBodyMaterial) extrudeBodies(batchOf(byMat, materialId), list);
  }
  const batches = [...byMat.values()];
  for (const b of batches) splitTJunctions(b);
  return batches;
}
