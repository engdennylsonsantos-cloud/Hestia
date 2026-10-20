import { describe, expect, it } from 'vitest';
import { asMulti, offsetMulti, pointInMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { defaultExtrusionProfile, extrusionFrame, presetDenteSerra, presetMansarda, resolveRoofs, roofThickness, roofTopAt, shiftProfile, type ResolvedRoof, type ResolvedRoofPlane } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof, type RoofEave } from '@hestia/model';
import { buildEaveSolids, FASCIA_THICKNESS } from './eaveSolids.ts';
import type { SolidBatch } from './solids.ts';

/**
 * Invariantes do beiral (C5) em todas as formas de telhado, com testeira e calha ligadas. Medidos na malha que
 * `buildEaveSolids` entrega, sem depender de como ela foi montada:
 *  - cobertura: em cada ponto amostrado da faixa (testeira: 2,5 cm para dentro; calha: 10 cm para fora) há uma e só
 *    uma face superior daquele material, e nenhuma onde não deve haver (empena, fora da faixa);
 *  - topologia: as arestas da superfície superior só ficam em bordas do contorno, da faixa ou no corte de empena; uma
 *    aresta aberta no meio da faixa é fresta ou ponta cega, e aresta compartilhada por três faces é sobreposição;
 *  - cota: a face superior da testeira é a água sob o ponto menos T; a calha segue a cota do beiral (piso 7 cm abaixo);
 *  - prumo e caixa: a testeira tem a altura do tipo na vertical, e nenhum vértice passa para dentro do telhado nem
 *    acima do beiral.
 * A faixa de cada ponto vem do próprio contorno deslocado (esquadria do Clipper, como o beiral sempre foi), e a
 * classe de cada aresta (beiral ou empena) vem da inclinação da água que a encosta, não do tipo de linha do motor.
 */

const EAVE: RoofEave = { fascia: true, fasciaHeight: 0.2, gutter: true, soffit: false };
/** Calha: profundidade para fora do contorno (m) e degraus do fundo (parede interna 1 cm, piso, parede externa). */
const GUTTER_DEPTH = 0.1;
const FLOOR_FROM = 0.01;
const FLOOR_TO = 0.09;
const FLOOR_DROP = 0.07;
/** Tolerância de cota e de posição (m), a do enunciado. */
const TOL = 1e-6;
/** Distância (m) abaixo da qual um ponto amostrado cai na borda e é descartado (a faixa é ambígua ali). */
const NEAR_EDGE = 2e-4;

const P = (x: number, y: number): Vec2 => ({ x, y });
const RECT: Vec2[] = [P(0, 0), P(8, 0), P(8, 6), P(0, 6)];
const L_SHAPE: Vec2[] = [P(0, 0), P(8, 0), P(8, 3), P(4, 3), P(4, 6), P(0, 6)];
const T_SHAPE: Vec2[] = [P(0, 4), P(3, 4), P(3, 0), P(6, 0), P(6, 4), P(9, 4), P(9, 8), P(0, 8)];
const U_SHAPE: Vec2[] = [P(0, 0), P(9, 0), P(9, 6), P(6, 6), P(6, 2), P(3, 2), P(3, 6), P(0, 6)];
const SQUARE: Vec2[] = [P(0, 0), P(10, 0), P(10, 8), P(0, 8)];
const HOLE: Vec2[] = [P(4, 3), P(6, 3), P(6, 5), P(4, 5)];
/** Contorno com um vértice a mais no meio da aresta inferior: a mudança de água ocorre sobre a aresta. */
const FREE_BOUNDARY: Vec2[] = [P(0, 0), P(4, 0), P(8, 0), P(8, 6), P(0, 6)];

interface Fixture {
  name: string;
  roof: Partial<Roof> & { boundary: Vec2[] };
  extrusion?: boolean;
}

const dirY = P(0, 1);
const extFrame = extrusionFrame(RECT, dirY)!;

/** Formas de telhado cobertas pelo teste (decisão 0008 e paridade C5). */
export const FIXTURES: Fixture[] = [
  { name: 'uma água', roof: { boundary: RECT, shape: 'shed', slopePercent: 30, dir: dirY } },
  { name: 'duas águas', roof: { boundary: RECT, shape: 'gable', slopePercent: 30, dir: P(1, 0) } },
  { name: 'quatro águas', roof: { boundary: RECT, shape: 'hip', slopePercent: 30 } },
  { name: 'contorno L', roof: { boundary: L_SHAPE, shape: 'edges', edgeSlopes: L_SHAPE.map(() => 30) } },
  { name: 'contorno T', roof: { boundary: T_SHAPE, shape: 'edges', edgeSlopes: T_SHAPE.map(() => 30) } },
  { name: 'contorno U', roof: { boundary: U_SHAPE, shape: 'edges', edgeSlopes: U_SHAPE.map(() => 30) } },
  { name: 'com furo', roof: { boundary: SQUARE, holes: [HOLE], shape: 'hip', slopePercent: 30 } },
  { name: 'L com empenas e inclinações diferentes', roof: { boundary: L_SHAPE, shape: 'edges', edgeSlopes: [30, null, 20, 30, null, 30] } },
  {
    name: 'águas livres com mudança de inclinação na aresta',
    roof: {
      boundary: FREE_BOUNDARY,
      shape: 'free',
      planes: [
        { polygon: [P(0, 0), P(4, 0), P(8, 6), P(0, 6)], origin: P(0, 0), up: P(0, 1), percent: 30, z0: 0 },
        { polygon: [P(4, 0), P(8, 0), P(8, 6)], origin: P(4, 0), up: P(0.6, 0.8), percent: 25, z0: 0 },
      ],
    },
  },
  { name: 'extrusão arco', roof: { boundary: RECT, shape: 'extrusion', dir: dirY, profile: defaultExtrusionProfile(RECT, dirY, 1) }, extrusion: true },
  {
    name: 'extrusão mansarda',
    roof: { boundary: RECT, shape: 'extrusion', dir: dirY, profile: shiftProfile(presetMansarda(8, 1, 2, 2.5), extFrame.tMin) },
    extrusion: true,
  },
  {
    name: 'extrusão dente de serra',
    roof: { boundary: RECT, shape: 'extrusion', dir: dirY, profile: shiftProfile(presetDenteSerra(8, 2, 1), extFrame.tMin) },
    extrusion: true,
  },
];

/** Projeto com o telhado do caso (criado pelo comando addRoof, como na aplicação) e o telhado resolvido. */
function build(fx: Fixture): { r: ResolvedRoof; p: Project } {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', eave: EAVE, ...fx.roof }) });
  const p = s.project;
  return { r: resolveRoofs(p, 'lv_0')[0]!, p };
}

type Mat = 'fascia' | 'gutter';
interface V3 {
  x: number;
  y: number;
  z: number;
}
type Tri = [V3, V3, V3];

const matOf = (b: SolidBatch): Mat | null => (b.materialId.includes('testeira') ? 'fascia' : b.materialId === 'mat_aluminio' ? 'gutter' : null);

/** Triângulos da face superior (normal para cima) de cada material. */
function topTris(batches: SolidBatch[]): Record<Mat, Tri[]> {
  const out: Record<Mat, Tri[]> = { fascia: [], gutter: [] };
  for (const b of batches) {
    const m = matOf(b);
    if (!m) continue;
    const v = (k: number): V3 => ({ x: b.positions[3 * k]!, y: b.positions[3 * k + 1]!, z: b.positions[3 * k + 2]! });
    for (let i = 0; i < b.indices.length; i += 3) {
      const ks = [b.indices[i]!, b.indices[i + 1]!, b.indices[i + 2]!];
      if (ks.every((k) => b.normals[3 * k + 2]! > 1e-9)) out[m].push([v(ks[0]!), v(ks[1]!), v(ks[2]!)]);
    }
  }
  return out;
}

/** Cotas z dos triângulos da face superior que contêm (x, y) estritamente: uma por face sobreposta. */
function coverAt(tris: Tri[], x: number, y: number): number[] {
  const zs: number[] = [];
  for (const [a, b, c] of tris) {
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-18) continue;
    const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d;
    const l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 > 1e-9 && l2 > 1e-9 && l3 > 1e-9) zs.push(l1 * a.z + l2 * b.z + l3 * c.z);
  }
  return zs;
}

const segsOf = (ring: Vec2[]): Array<[Vec2, Vec2]> => ring.map((a, i) => [a, ring[(i + 1) % ring.length]!] as [Vec2, Vec2]);
const segsOfMulti = (m: MultiPolygon): Array<[Vec2, Vec2]> => m.flatMap((poly) => poly.flatMap((ring) => segsOf(ring)));

/** Distância de p ao segmento, com o parâmetro não limitado u (0..1 dentro do segmento). */
function segDist(p: Vec2, a: Vec2, b: Vec2): { d: number; u: number; foot: Vec2 } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const u = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  const c = Math.min(1, Math.max(0, u));
  const foot = { x: a.x + dx * c, y: a.y + dy * c };
  return { d: Math.hypot(p.x - foot.x, p.y - foot.y), u, foot };
}

const ringDist = (p: Vec2, segs: Array<[Vec2, Vec2]>): number => segs.reduce((m, [a, b]) => Math.min(m, segDist(p, a, b).d), Infinity);
const lineDist = (p: Vec2, a: Vec2, b: Vec2): number => {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  return L > 0 ? Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L : Math.hypot(p.x - a.x, p.y - a.y);
};
const unit = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** Cota do topo da água sob p; a gradiente da água é a subida por metro (percentual × direção de subida). */
const gradOf = (pl: ResolvedRoofPlane): Vec2 => ({ x: (pl.percent / 100) * pl.up.x, y: (pl.percent / 100) * pl.up.y });

interface Edge {
  eave: boolean;
  /** Normal unitária para dentro do telhado. */
  nIn: Vec2;
}

/** Aresta é beiral quando a água que a encosta desce para fora dela; sem inclinação para fora é empena. */
function classify(r: ResolvedRoof, a: Vec2, b: Vec2): Edge {
  const t = unit(sub(b, a));
  const left = P(-t.y, t.x);
  const m = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  for (const s of [1, -1]) {
    const n = P(left.x * s, left.y * s);
    const q = P(m.x + n.x * 1e-4, m.y + n.y * 1e-4);
    const pl = r.planes.find((x) => pointInMulti(q, x.polygon));
    if (pl) return { eave: dot(gradOf(pl), P(-n.x, -n.y)) < -1e-9, nIn: n };
  }
  return { eave: false, nIn: left };
}

/** Cota da face superior do telhado no ponto da borda (a água que contém o ponto; na quina, qualquer uma delas). */
const topOn = (r: ResolvedRoof, q: Vec2): number => roofTopAt(r, q) ?? NaN;

interface Ctx {
  name: string;
  extrusion: boolean;
  r: ResolvedRoof;
  p: Project;
  bnd: Vec2[];
  T: number;
  eave: Edge[];
  outline: MultiPolygon;
  fascia: MultiPolygon;
  gutter: MultiPolygon;
  tris: Record<Mat, Tri[]>;
  batches: SolidBatch[];
  /** Segmentos das bordas de cada faixa, para testar a topologia. */
  allowedRings: Record<Mat, Array<[Vec2, Vec2]>>;
  gableSegs: Array<[Vec2, Vec2]>;
}

function makeCtx(fx: Fixture): Ctx {
  const { r, p } = build(fx);
  const bnd = fx.roof.boundary;
  const n = bnd.length;
  const eave = bnd.map((a, i) => classify(r, a, bnd[(i + 1) % n]!));
  const outline = asMulti(bnd);
  const fascia = offsetMulti(outline, -FASCIA_THICKNESS);
  const gutter = offsetMulti(outline, GUTTER_DEPTH);
  const gutterFloor = [offsetMulti(outline, FLOOR_FROM), offsetMulti(outline, FLOOR_TO)];
  const batches = buildEaveSolids(p, [r]).batches;
  const gableSegs = bnd.flatMap((a, i) => (eave[i]!.eave ? [] : [[a, bnd[(i + 1) % n]!] as [Vec2, Vec2]]));
  return {
    name: fx.name,
    extrusion: !!fx.extrusion,
    r,
    p,
    bnd,
    T: roofThickness(r),
    eave,
    outline,
    fascia,
    gutter,
    tris: topTris(batches),
    batches,
    allowedRings: {
      fascia: [...segsOfMulti(outline), ...segsOfMulti(fascia)],
      gutter: [...segsOfMulti(outline), ...segsOfMulti(gutterFloor[0]!), ...segsOfMulti(gutterFloor[1]!), ...segsOfMulti(gutter)],
    },
    gableSegs,
  };
}

const cache = new Map<string, Ctx>();
const ctxOf = (fx: Fixture): Ctx => {
  let c = cache.get(fx.name);
  if (!c) {
    c = makeCtx(fx);
    cache.set(fx.name, c);
  }
  return c;
};

/** Faixa da testeira: dentro do contorno e a menos de 2,5 cm dele (contorno deslocado). */
const inBand = (c: Ctx, mat: Mat, q: Vec2): boolean =>
  mat === 'fascia' ? pointInMulti(q, c.outline) && !pointInMulti(q, c.fascia) : !pointInMulti(q, c.outline) && pointInMulti(q, c.gutter);

interface Hit {
  p: Vec2;
  /** Índice da aresta (quando o ponto está na frente dela) ou null (ponto mais perto de um vértice). */
  seg: number | null;
  /** Índice do vértice (quando o ponto é mais perto de um vértice). */
  vtx: number | null;
  foot: Vec2;
  dmin: number;
}

/** Aresta mais perto do ponto; empate entre duas arestas só vale quando as duas param no mesmo vértice. */
function locate(c: Ctx, q: Vec2): Hit | null {
  const n = c.bnd.length;
  const ds = c.bnd.map((a, i) => ({ i, ...segDist(q, a, c.bnd[(i + 1) % n]!) }));
  const dmin = Math.min(...ds.map((x) => x.d));
  if (dmin < NEAR_EDGE) return null;
  const best = ds.filter((x) => x.d <= dmin + 1e-9);
  if (best.length === 1) {
    const x = best[0]!;
    if (x.u > 1e-9 && x.u < 1 - 1e-9) return { p: q, seg: x.i, vtx: null, foot: x.foot, dmin };
    return null;
  }
  const ends = best.map((x) => (x.u <= 1e-9 ? x.i : x.u >= 1 - 1e-9 ? (x.i + 1) % n : -1));
  if (ends.every((e) => e >= 0 && e === ends[0])) return { p: q, seg: null, vtx: ends[0]!, foot: c.bnd[ends[0]!]!, dmin };
  return null;
}

/** Categoria do ponto: 'seg' (frente de aresta), 'vtx-ee' (quina de dois beirais), 'vtx-eg' (beiral e empena), 'vtx-gg'. */
function categoryOf(c: Ctx, h: Hit): string {
  if (h.seg !== null) return 'seg';
  const n = c.bnd.length;
  const prev = c.eave[(h.vtx! - 1 + n) % n]!.eave;
  const next = c.eave[h.vtx!]!.eave;
  return prev && next ? 'vtx-ee' : prev || next ? 'vtx-eg' : 'vtx-gg';
}

/** Distância do ponto ao beiral mais próximo (ignora empenas). */
function nearestEaveDist(c: Ctx, q: Vec2): number {
  const n = c.bnd.length;
  let best = Infinity;
  c.bnd.forEach((a, i) => {
    if (c.eave[i]!.eave) best = Math.min(best, segDist(q, a, c.bnd[(i + 1) % n]!).d);
  });
  return best;
}

/** Cobertura esperada (1 ou 0) do material no ponto; null quando a fronteira é ambígua. */
function expected(c: Ctx, mat: Mat, h: Hit): 0 | 1 | null {
  if (h.seg !== null) {
    if (c.eave[h.seg]!.eave) return inBand(c, mat, h.p) ? 1 : 0;
    // Frente de empena: a testeira do beiral vizinho ainda cobre o canto até o plano da empena; a calha nunca.
    if (mat === 'gutter') return 0;
    return inBand(c, mat, h.p) && nearestEaveDist(c, h.p) < FASCIA_THICKNESS ? 1 : 0;
  }
  const n = c.bnd.length;
  const V = c.bnd[h.vtx!]!;
  const prevIdx = (h.vtx! - 1 + n) % n;
  const nextIdx = h.vtx!;
  const ePrev = c.eave[prevIdx]!.eave;
  const eNext = c.eave[nextIdx]!.eave;
  if (ePrev && eNext) return inBand(c, mat, h.p) ? 1 : 0;
  if (!ePrev && !eNext) return 0;
  // Quina de beiral com empena: o beiral termina no plano da empena, do lado do beiral.
  const eaveIdx = ePrev ? prevIdx : nextIdx;
  const gableIdx = ePrev ? nextIdx : prevIdx;
  const uE = unit(sub(c.bnd[(eaveIdx + (ePrev ? 0 : 1)) % n]!, V));
  const uG = unit(sub(c.bnd[(gableIdx + (ePrev ? 1 : 0)) % n]!, V));
  let nG = P(-uG.y, uG.x);
  if (dot(nG, uE) < 0) nG = P(-nG.x, -nG.y);
  const s = dot(sub(h.p, V), nG);
  if (Math.abs(s) < 1e-6) return null;
  return s > 0 && inBand(c, mat, h.p) ? 1 : 0;
}

/** Amostras: ao longo de cada aresta (dentro e fora, em várias profundidades) e uma grade em volta de cada vértice. */
function samplesOf(c: Ctx): Vec2[] {
  const out: Vec2[] = [];
  const depths = [-0.12, -0.1007, -0.0993, -0.0907, -0.06, -0.035, -0.0255, -0.0247, -0.0213, -0.0118, -0.003, -0.0007, 0.0007, 0.003, 0.0118, 0.0213, 0.0247, 0.0255, 0.035, 0.06, 0.0907, 0.0993, 0.1007, 0.12];
  const n = c.bnd.length;
  c.bnd.forEach((a, i) => {
    const b = c.bnd[(i + 1) % n]!;
    const nIn = c.eave[i]!.nIn;
    for (let k = 0; k <= 16; k++) {
      const u = 0.03 + (0.94 * k) / 16;
      const base = P(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
      for (const s of depths) out.push(P(base.x + nIn.x * s, base.y + nIn.y * s));
    }
  });
  for (const V of c.bnd) {
    for (let i = -20; i <= 20; i++) {
      for (let j = -20; j <= 20; j++) out.push(P(V.x + i * 0.0065, V.y + j * 0.0065));
    }
  }
  return out;
}

/** Falhas de cobertura, sobreposição e cota, com a categoria do ponto no rótulo. */
function sampleFailures(c: Ctx): string[] {
  const rings: Record<Mat, Array<[Vec2, Vec2]>> = c.allowedRings;
  const fails: string[] = [];
  for (const q of samplesOf(c)) {
    const h = locate(c, q);
    if (!h) continue;
    if (ringDist(q, [...rings.fascia, ...rings.gutter]) < 1e-5) continue;
    const cat = categoryOf(c, h);
    for (const mat of ['fascia', 'gutter'] as Mat[]) {
      const e = expected(c, mat, h);
      if (e === null) continue;
      const zs = coverAt(c.tris[mat], q.x, q.y);
      const at = `(${q.x.toFixed(4)}, ${q.y.toFixed(4)})`;
      if (zs.length > 1) fails.push(`[${cat}/${mat}/overlap] ${at} coberto ${zs.length}×`);
      else if (zs.length !== e) fails.push(`[${cat}/${mat}/cover] ${at} esperado ${e}, achado ${zs.length}`);
      else if (e === 1) {
        if (mat === 'fascia') {
          const want = topOn(c.r, q) - c.T;
          if (Number.isFinite(want) && Math.abs(zs[0]! - want) > TOL) fails.push(`[${cat}/fascia/height] ${at} z ${zs[0]!.toFixed(6)} ≠ água ${want.toFixed(6)}`);
        } else if (h.seg !== null) {
          const floor = h.dmin > FLOOR_FROM + 5e-4 && h.dmin < FLOOR_TO - 5e-4;
          const want = topOn(c.r, h.foot) - c.T - (floor ? FLOOR_DROP : 0);
          if (Number.isFinite(want) && Math.abs(zs[0]! - want) > TOL) fails.push(`[seg/gutter/height] ${at} z ${zs[0]!.toFixed(6)} ≠ beiral ${want.toFixed(6)}`);
        }
      }
    }
  }
  return fails;
}

/** Arestas da superfície superior: aberta fora das bordas da faixa ou do corte de empena (fresta/ponta); ≥ 3 faces, sobreposição. */
function topologyFailures(c: Ctx, mat: Mat): string[] {
  const counts = new Map<string, { n: number; p: V3; q: V3 }>();
  const key = (v: V3): string => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)},${Math.round(v.z * 1e6)}`;
  for (const [a, b, d] of c.tris[mat]) {
    for (const [u, w] of [[a, b], [b, d], [d, a]] as Array<[V3, V3]>) {
      const ku = key(u);
      const kw = key(w);
      const k = ku < kw ? `${ku}|${kw}` : `${kw}|${ku}`;
      const e = counts.get(k) ?? { n: 0, p: u, q: w };
      e.n++;
      counts.set(k, e);
    }
  }
  const fails: string[] = [];
  const allowed = c.allowedRings[mat];
  const depths = mat === 'fascia' ? [FASCIA_THICKNESS] : [-FLOOR_FROM, -FLOOR_TO, -GUTTER_DEPTH];
  const n = c.bnd.length;
  const alongEave = (m: Vec2): boolean =>
    c.bnd.some((a, i) => {
      const edge = c.eave[i]!;
      if (!edge.eave) return false;
      const b = c.bnd[(i + 1) % n]!;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const t = P((b.x - a.x) / L, (b.y - a.y) / L);
      const dep = dot(sub(m, a), edge.nIn);
      const u = dot(sub(m, a), t);
      // Tolerância de 2e-5 m: a faixa do gerador tem 1e-5 m de folga (SIDE_MARGIN) além da profundidade nominal.
      return depths.some((d) => Math.abs(dep - d) < 2e-5) && u > -1e-6 && u < L + 1e-6;
    });
  for (const e of counts.values()) {
    if (e.n >= 3) fails.push(`[${mat}/overlap-edge] aresta em (${e.p.x.toFixed(4)}, ${e.p.y.toFixed(4)}) com ${e.n} faces`);
    if (e.n !== 1) continue;
    const m = P((e.p.x + e.q.x) / 2, (e.p.y + e.q.y) / 2);
    const onRing = ringDist(m, allowed) < 2e-6;
    const onCut = c.gableSegs.some(([a, b]) => lineDist(m, a, b) < 2e-6);
    if (!onRing && !onCut && !alongEave(m)) fails.push(`[${mat}/open-edge] aresta aberta em (${m.x.toFixed(4)}, ${m.y.toFixed(4)}), fresta ou ponta`);
  }
  return fails;
}

/** Prumo: a testeira sobe e desce na vertical, com o topo a `h` acima da base em cada (x, y). */
function prumoFailures(c: Ctx): string[] {
  const b = c.batches.find((x) => matOf(x) === 'fascia');
  if (!b) return [];
  const top = new Set<string>();
  const bot = new Set<string>();
  const key = (x: number, y: number, z: number): string => `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
  const pts: Array<[number, number, number, boolean]> = [];
  for (let k = 0; k < b.positions.length / 3; k++) {
    const x = b.positions[3 * k]!;
    const y = b.positions[3 * k + 1]!;
    const z = b.positions[3 * k + 2]!;
    const up = b.normals[3 * k + 2]! > 1e-9;
    const down = b.normals[3 * k + 2]! < -1e-9;
    if (up) top.add(key(x, y, z));
    if (down) bot.add(key(x, y, z));
    if (up || down) pts.push([x, y, z, up]);
  }
  const h = EAVE.fasciaHeight;
  const fails: string[] = [];
  for (const [x, y, z, up] of pts) {
    const other = up ? bot : top;
    const want = up ? key(x, y, z - h) : key(x, y, z + h);
    if (!other.has(want)) fails.push(`[fascia/prumo] (${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}) sem par a ${h} m`);
    if (fails.length >= 5) break;
  }
  return fails;
}

/** Caixa e cotas: nenhum vértice fora da caixa do contorno com balanço, nem acima do beiral, nem dentro do telhado. */
function boxFailures(c: Ctx): string[] {
  const xs = c.bnd.map((v) => v.x);
  const ys = c.bnd.map((v) => v.y);
  const box = { x0: Math.min(...xs) - 0.15, x1: Math.max(...xs) + 0.15, y0: Math.min(...ys) - 0.15, y1: Math.max(...ys) + 0.15 };
  const segs = segsOf(c.bnd);
  const fails: string[] = [];
  for (const mat of ['fascia', 'gutter'] as Mat[]) {
    const b = c.batches.find((x) => matOf(x) === mat);
    if (!b) continue;
    for (let k = 0; k < b.positions.length / 3; k++) {
      const v = P(b.positions[3 * k]!, b.positions[3 * k + 1]!);
      const z = b.positions[3 * k + 2]!;
      const at = `${mat} (${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${z.toFixed(4)})`;
      if (v.x < box.x0 || v.x > box.x1 || v.y < box.y0 || v.y > box.y1) fails.push(`[box] ${at} fora da caixa`);
      let q = v;
      let bestD = Infinity;
      for (const [a, bb] of segs) {
        const s = segDist(v, a, bb);
        if (s.d < bestD) {
          bestD = s.d;
          q = s.foot;
        }
      }
      const cap = topOn(c.r, q) - c.T;
      const outside = !pointInMulti(v, c.outline);
      if (outside && Number.isFinite(cap) && z > cap + TOL && bestD > TOL) fails.push(`[above] ${at} acima do beiral (${cap.toFixed(4)})`);
      if (mat === 'fascia' && bestD > TOL && pointInMulti(v, c.outline)) {
        const roofBelow = roofTopAt(c.r, v);
        if (roofBelow !== null && z > roofBelow - c.T + TOL) fails.push(`[into] ${at} entra no telhado (água ${roofBelow.toFixed(4)})`);
      }
      if (fails.length >= 8) return fails;
    }
  }
  return fails;
}

/** Relatório: contagem e as primeiras falhas (a asserção compara com lista vazia). */
const report = (fails: string[], filter: (f: string) => boolean): { count: number; first: string[] } => {
  const hits = fails.filter(filter);
  return { count: hits.length, first: hits.slice(0, 4) };
};
const NONE = { count: 0, first: [] as string[] };

describe.each(FIXTURES.map((f) => ({ name: f.name, fx: f })))('beiral: $name', ({ fx }) => {
  const c = () => ctxOf(fx);

  it('1 · cada aresta de beiral recebe testeira e calha; empena não recebe calha', () => {
    const f = sampleFailures(c());
    expect(report(f, (s) => s.startsWith('[seg/') && s.includes('/cover'))).toEqual(NONE);
  });

  it('2 · cantos de beiral entre dois segmentos: sem fresta, sem sobreposição, bordas coincidentes', () => {
    const cx = c();
    const f = sampleFailures(cx);
    const topo = [...topologyFailures(cx, 'fascia'), ...topologyFailures(cx, 'gutter')];
    expect(report(f, (s) => s.startsWith('[vtx-ee/') && s.includes('/cover'))).toEqual(NONE);
    expect(report([...f, ...topo], (s) => s.includes('/overlap]') || s.includes('/open-edge]') || s.includes('/overlap-edge]'))).toEqual(NONE);
  });

  it('3 · mudança de inclinação: a testeira fecha na água sob o ponto (esquadria pelo ângulo 3D)', () => {
    expect(report(sampleFailures(c()), (s) => s.startsWith('[') && s.includes('/fascia/height]'))).toEqual(NONE);
  });

  it('4 · nenhum vértice fora da caixa do balanço, acima do beiral ou dentro do telhado', () => {
    expect(report(boxFailures(c()), () => true)).toEqual(NONE);
  });

  it('5 · quina de beiral com empena: o beiral termina no plano da empena, sem sobra nem falta', () => {
    expect(report(sampleFailures(c()), (s) => s.startsWith('[vtx-eg/') || s.startsWith('[vtx-gg/'))).toEqual(NONE);
  });

  it('6 · calha na cota do beiral (monótona, piso 7 cm abaixo) e testeira em prumo com a altura do tipo', () => {
    const cx = c();
    expect({ g: report(sampleFailures(cx), (s) => s.includes('/gutter/height]')), prumo: prumoFailures(cx) }).toEqual({ g: NONE, prumo: [] });
  });
});

