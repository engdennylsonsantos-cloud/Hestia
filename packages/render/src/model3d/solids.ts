import { difference, intersection, multiArea, ringArea, triangulate, unionClipper, type MultiPolygon, type Polygon, type Ring } from '@hestia/geom';
import { bandTopAt, planeZ, slabRiseAt, type LayerBand, type ResolvedFloor, type ResolvedLevel, type ResolvedRoof, type ResolvedSlab } from '@hestia/engine';
import type { Id } from '@hestia/model';

/** Malha de um material: vértices próprios por face (sombreamento chapado, arestas nítidas). */
export interface SolidBatch {
  materialId: Id;
  positions: number[];
  normals: number[];
  indices: number[];
}

function oriented(r: Ring, ccw: boolean): Ring {
  const a = ringArea(r);
  return (a > 0) === ccw ? r : [...r].reverse();
}

function push(b: SolidBatch, v: number[], n: [number, number, number], tris: number[]): void {
  const base = b.positions.length / 3;
  for (let i = 0; i < v.length; i += 3) {
    b.positions.push(v[i]!, v[i + 1]!, v[i + 2]!);
    b.normals.push(n[0], n[1], n[2]);
  }
  for (const t of tris) b.indices.push(base + t);
}

/**
 * Extrusão vertical de um polígono com furos entre z0 e z1. Com `topAt`/`bottomAt` (cota por ponto, planos
 * inclinados), o topo e a base seguem essas funções em vez de z1 e z0; a espessura vertical é a mesma em todo lugar.
 */
export function extrudePolygon(
  b: SolidBatch,
  poly: Polygon,
  z0: number,
  z1: number,
  topAt?: (x: number, y: number) => number,
  bottomAt?: (x: number, y: number) => number,
): void {
  if (z1 - z0 < 1e-6 || !poly[0]) return;
  const rings = poly.map((r, i) => oriented(r, i === 0));
  const norm: Polygon = rings;
  const m = triangulate(norm);
  const top: number[] = [];
  const bottom: number[] = [];
  const zTop = (x: number, y: number): number => (topAt ? topAt(x, y) : z1);
  const zBot = (x: number, y: number): number => (bottomAt ? bottomAt(x, y) : z0);
  for (let i = 0; i < m.positions.length; i += 2) {
    top.push(m.positions[i]!, m.positions[i + 1]!, zTop(m.positions[i]!, m.positions[i + 1]!));
    bottom.push(m.positions[i]!, m.positions[i + 1]!, zBot(m.positions[i]!, m.positions[i + 1]!));
  }
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    let a = m.indices[i]!;
    let bb = m.indices[i + 1]!;
    const c = m.indices[i + 2]!;
    const cr = (m.positions[bb * 2]! - m.positions[a * 2]!) * (m.positions[c * 2 + 1]! - m.positions[a * 2 + 1]!) - (m.positions[bb * 2 + 1]! - m.positions[a * 2 + 1]!) * (m.positions[c * 2]! - m.positions[a * 2]!);
    if (cr < 0) [a, bb] = [bb, a];
    up.push(a, bb, c);
    down.push(a, c, bb);
  }
  // Normais dos planos (lineares por construção): com z = g·p + c, a de cima é (-gx, -gy, 1) e a de baixo (gx, gy, -1).
  const o = poly[0]![0]!;
  const gradient = (at: (x: number, y: number) => number): [number, number] => [at(o.x + 1, o.y) - at(o.x, o.y), at(o.x, o.y + 1) - at(o.x, o.y)];
  let topN: [number, number, number] = [0, 0, 1];
  if (topAt) {
    const [gx, gy] = gradient(topAt);
    const l = Math.hypot(gx, gy, 1);
    topN = [-gx / l, -gy / l, 1 / l];
  }
  let bottomN: [number, number, number] = [0, 0, -1];
  if (bottomAt) {
    const [gx, gy] = gradient(bottomAt);
    const l = Math.hypot(gx, gy, 1);
    bottomN = [gx / l, gy / l, -1 / l];
  }
  push(b, top, topN, up);
  push(b, bottom, bottomN, down);
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      const nx = dy / L;
      const ny = -dx / L;
      push(b, [p.x, p.y, zBot(p.x, p.y), q.x, q.y, zBot(q.x, q.y), q.x, q.y, zTop(q.x, q.y), p.x, p.y, zTop(p.x, p.y)], [nx, ny, 0], [0, 1, 2, 0, 2, 3]);
    }
  }
}

export interface LevelSolids {
  batches: SolidBatch[];
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

const FUSE_EPS_Z = 1e-6;
const FUSE_MIN_AREA = 1e-12;

/** Chave do topo inclinado: duas faixas só se fundem se seguem exatamente o mesmo plano. */
const slopeKey = (s: LayerBand['slope']): string => (s ? JSON.stringify(s) : '');

const hasArea = (m: MultiPolygon): boolean => m.length > 0 && multiArea(m) > FUSE_MIN_AREA;

/**
 * Limpa o resultado de uma booleana: a diferença/interseção pode deixar anéis degenerados (espículas de largura zero
 * que voltam ao longo da própria borda). Sem área, mas as arestas delas viram linhas falsas no 3D. A união pelo
 * Clipper descarta essas espículas e devolve só as regiões de área positiva.
 */
const clean = (m: MultiPolygon): MultiPolygon => (m.length ? unionClipper(m) : m);

/**
 * Funde as faixas de uma camada em prismas contínuos no sentido vertical. Cada região em planta sobrevive enquanto
 * estiver presente nas faixas consecutivas (mesma chave de inclinação); só se divide onde a planta muda, isto é, na
 * borda do vão. Assim a parede fora do vão é um prisma só de base a topo, e a soleira e a verga aparecem apenas
 * onde o vão existe, sem faces horizontais coplanares que emendam a parede inteira. O volume é o mesmo: as regiões
 * de cada faixa continuam particionadas (sem sobreposição) e nenhuma área é criada nem perdida.
 */
export function fuseBands(bands: LayerBand[]): LayerBand[] {
  const out: LayerBand[] = [];
  let open: LayerBand[] = [];
  let zEnd = 0;
  for (const b of [...bands].sort((x, y) => x.z0 - y.z0)) {
    // Quebra de continuidade vertical: fecha tudo o que estava aberto.
    if (open.length && Math.abs(b.z0 - zEnd) > FUSE_EPS_Z) {
      out.push(...open);
      open = [];
    }
    const key = slopeKey(b.slope);
    const next: LayerBand[] = [];
    const kept: MultiPolygon[] = [];
    for (const o of open) {
      if (slopeKey(o.slope) !== key) {
        out.push(o);
        continue;
      }
      // A parte da região que sai na faixa nova fecha em `b.z0`; a que continua segue com a faixa nova.
      const rest = clean(difference(o.poly, b.poly));
      if (!hasArea(rest)) {
        next.push({ ...o, z1: b.z1 });
        kept.push(o.poly);
        continue;
      }
      out.push({ z0: o.z0, z1: b.z0, poly: rest, slope: o.slope });
      const inside = clean(intersection(o.poly, b.poly));
      if (hasArea(inside)) {
        next.push({ z0: o.z0, z1: b.z1, poly: inside, slope: o.slope });
        kept.push(inside);
      }
    }
    // Região nova da faixa (ainda não coberta pelas que continuam) abre a partir de `b.z0`.
    const fresh = kept.length ? clean(difference(b.poly, ...kept)) : b.poly;
    if (hasArea(fresh)) next.push({ z0: b.z0, z1: b.z1, poly: fresh, slope: b.slope });
    open = next;
    zEnd = b.z1;
  }
  out.push(...open);
  return out;
}

/** Sólidos de todas as camadas das paredes do nível, por material. */
export function buildLevelSolids(r: ResolvedLevel): LevelSolids {
  const byMat = new Map<Id, SolidBatch>();
  for (const rw of Object.values(r.walls)) {
    for (const l of rw.layers) {
      const b = batchOf(byMat, l.materialId);
      for (const band of fuseBands(l.bands)) {
        const topAt = band.slope ? slopeTop(band, rw.baseZ) : undefined;
        for (const poly of band.poly) extrudePolygon(b, poly, rw.baseZ + band.z0, rw.baseZ + band.z1, topAt);
      }
    }
  }
  return { batches: [...byMat.values()] };
}

/** Sólidos dos pisos: uma extrusão por camada entre as cotas absolutas (furos incluídos), agrupada por material. */
export function buildFloorSolids(floors: ResolvedFloor[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const f of floors) {
    for (const l of f.layers) {
      const b = batchOf(byMat, l.materialId);
      for (const poly of f.polygon) extrudePolygon(b, poly, l.z0, l.z1);
    }
  }
  return [...byMat.values()];
}

/**
 * Sólidos das lajes (D2): uma extrusão por camada, por material, com furos. Com inclinação, topo e base da camada
 * seguem o mesmo plano (a subida de `slabRiseAt`), então a espessura vertical fica constante.
 */
export function buildSlabSolids(slabs: ResolvedSlab[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const s of slabs) {
    const sl = s.slope;
    for (const l of s.layers) {
      const b = batchOf(byMat, l.materialId);
      const topAt = sl ? (x: number, y: number): number => l.z1 + slabRiseAt(sl, { x, y }) : undefined;
      const bottomAt = sl ? (x: number, y: number): number => l.z0 + slabRiseAt(sl, { x, y }) : undefined;
      for (const poly of s.polygon) extrudePolygon(b, poly, l.z0, l.z1, topAt, bottomAt);
    }
  }
  return [...byMat.values()];
}

/**
 * Sólidos dos telhados (D2): por água e por camada, uma extrusão cujo topo segue o plano da água menos `below` e cuja
 * base está `thickness` abaixo, na vertical. Empenas não entram aqui: a parede ajusta o topo no motor.
 */
export function buildRoofSolids(roofs: ResolvedRoof[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const r of roofs) {
    for (const pl of r.planes) {
      for (const l of r.layers) {
        if (l.thickness < 1e-6) continue;
        const b = batchOf(byMat, l.materialId);
        const topAt = (x: number, y: number): number => planeZ(pl, { x, y }) - l.below;
        const bottomAt = (x: number, y: number): number => topAt(x, y) - l.thickness;
        // z0 = 0 e z1 = espessura só passam pelo guarda de extrusão; a cota vem de topAt e bottomAt.
        for (const poly of pl.polygon) extrudePolygon(b, poly, 0, l.thickness, topAt, bottomAt);
      }
    }
  }
  return [...byMat.values()];
}

const slopeTop = (band: LayerBand, baseZ: number) => (x: number, y: number): number => baseZ + bandTopAt(band, { x, y });
