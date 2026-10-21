import { difference, ringArea, triangulate, union, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { bandTopAt, fuseBands, planeZ, slabRiseAt, type LayerBand, type ResolvedFloor, type ResolvedLevel, type ResolvedRoof, type ResolvedSlab } from '@hestia/engine';
import type { GraphicsCategory, Id } from '@hestia/model';

/**
 * Faixa de `indices` de um lote que pertence a um elemento: `indices[start .. start + count)`, sempre múltiplo de 3
 * (triângulos inteiros). Um elemento pode ter várias faixas no mesmo lote (uma por camada ou por peça).
 */
export interface ElementRange {
  id: Id;
  start: number;
  count: number;
}

/** Malha de um material: vértices próprios por face (sombreamento chapado, arestas nítidas). */
export interface SolidBatch {
  materialId: Id;
  /** Categoria gráfica da peça (visibilidade, transparência e meio-tom da vista 3D, decisão 0015 §2.4). */
  category: GraphicsCategory;
  positions: number[];
  normals: number[];
  indices: number[];
  /** Elemento de cada faixa de `indices` (picking e realce na vista 3D, decisão 0016). */
  ids: ElementRange[];
}

/** Registra as faixas de `indices` que `fn` acrescenta ao lote `b` como pertencentes ao elemento `id`. */
export function ofElement(b: SolidBatch, id: Id, fn: () => void): void {
  const start = b.indices.length;
  fn();
  if (b.indices.length > start) b.ids.push({ id, start, count: b.indices.length - start });
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
  extrudeCaps(b, poly, z0, z1, topAt, bottomAt);
  const zBot = (x: number, y: number): number => (bottomAt ? bottomAt(x, y) : z0);
  const zTop = (x: number, y: number): number => (topAt ? topAt(x, y) : z1);
  for (const ring of poly.map((r, i) => oriented(r, i === 0))) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      pushWall(b, p, q, zBot(p.x, p.y), zBot(q.x, q.y), zTop(p.x, p.y), zTop(q.x, q.y));
    }
  }
}

/**
 * Parede vertical entre p e q, com cota de fundo (bp, bq) e de topo (tp, tq) em cada extremo. O anel deve andar no
 * sentido anti-horário: a normal aponta para fora, à direita de p→q.
 */
export function pushWall(b: SolidBatch, p: Vec2, q: Vec2, bp: number, bq: number, tp: number, tq: number): void {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return;
  push(b, [p.x, p.y, bp, q.x, q.y, bq, q.x, q.y, tq, p.x, p.y, tp], [dy / L, -dx / L, 0], [0, 1, 2, 0, 2, 3]);
}

/** Topo e base de uma extrusão (sem as paredes): a triangulação do polígono com furos, na cota de cada ponto. */
export function extrudeCaps(
  b: SolidBatch,
  poly: Polygon,
  z0: number,
  z1: number,
  topAt?: (x: number, y: number) => number,
  bottomAt?: (x: number, y: number) => number,
): void {
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
}

/** Tolerância (m) para duas arestas de planta estarem sobre a mesma reta; e (m) para cotas iguais. */
const LINE_EPS = 1e-6;
const Z_EPS = 1e-9;

/**
 * Divide as arestas dos triângulos da camada nos vértices da própria camada que caem sobre elas (T-junctions). Uma
 * aresta longa de um triângulo pode passar por um vértice de outra face (ou de um canto de vão na mesma cota), e a
 * face vizinha usa os pedaços: sem isso a malha tem arestas sem par. O vértice novo leva a normal da face que o
 * recebe, então o sombreamento continua chapado.
 */
function splitTJunctions(b: SolidBatch, firstTri: number, firstVert: number): void {
  const pos = b.positions;
  const onSeg = (p: number, x: number, y: number): boolean => {
    const ax = pos[x * 3]!;
    const ay = pos[x * 3 + 1]!;
    const az = pos[x * 3 + 2]!;
    const dx = pos[y * 3]! - ax;
    const dy = pos[y * 3 + 1]! - ay;
    const dz = pos[y * 3 + 2]! - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    const px = pos[p * 3]! - ax;
    const py = pos[p * 3 + 1]! - ay;
    const pz = pos[p * 3 + 2]! - az;
    const t = (px * dx + py * dy + pz * dz) / l2;
    // Um ponto quase coincidente com um extremo não divide a aresta (vértices duplicados de arcos, 1e-9 m de diferença).
    if (t * t * l2 < 1e-12 || (1 - t) * (1 - t) * l2 < 1e-12 || t <= 0 || t >= 1) return false;
    const ex = px - t * dx;
    const ey = py - t * dy;
    const ez = pz - t * dz;
    return ex * ex + ey * ey + ez * ez < 1e-14;
  };
  const pts: number[] = [];
  for (let i = firstVert; i < pos.length / 3; i++) pts.push(i);
  const stack: number[][] = [];
  for (let t = firstTri; t < b.indices.length; t += 3) stack.push([b.indices[t]!, b.indices[t + 1]!, b.indices[t + 2]!]);
  const out: number[][] = [];
  while (stack.length) {
    const t = stack.pop()!;
    let split = false;
    for (let e = 0; e < 3 && !split; e++) {
      const x = t[e]!;
      const y = t[(e + 1) % 3]!;
      const z = t[(e + 2) % 3]!;
      for (const q of pts) {
        if (q === x || q === y || q === z || !onSeg(q, x, y)) continue;
        const k = pos.length / 3;
        pos.push(pos[q * 3]!, pos[q * 3 + 1]!, pos[q * 3 + 2]!);
        b.normals.push(b.normals[x * 3]!, b.normals[x * 3 + 1]!, b.normals[x * 3 + 2]!);
        stack.push([x, k, z], [k, y, z]);
        split = true;
        break;
      }
    }
    if (!split) out.push(t);
  }
  b.indices.length = firstTri;
  for (const t of out) b.indices.push(t[0]!, t[1]!, t[2]!);
}

/** Triângulos com a normal voltada para `n` (a ordem dos vértices é corrigida pelo produto vetorial). */
function emitFace(b: SolidBatch, poly: MultiPolygon, to3: (u: number, v: number) => [number, number, number], n: [number, number, number]): void {
  for (const p of poly) {
    if (!p[0]) continue;
    const m = triangulate(p);
    const v: number[] = [];
    for (let i = 0; i < m.positions.length; i += 2) v.push(...to3(m.positions[i]!, m.positions[i + 1]!));
    const tris: number[] = [];
    for (let i = 0; i < m.indices.length; i += 3) {
      const a = m.indices[i]!;
      let bb = m.indices[i + 1]!;
      let c = m.indices[i + 2]!;
      const ax = v[a * 3]!;
      const ay = v[a * 3 + 1]!;
      const az = v[a * 3 + 2]!;
      const ux = v[bb * 3]! - ax;
      const uy = v[bb * 3 + 1]! - ay;
      const uz = v[bb * 3 + 2]! - az;
      const wx = v[c * 3]! - ax;
      const wy = v[c * 3 + 1]! - ay;
      const wz = v[c * 3 + 2]! - az;
      const cr = (uy * wz - uz * wy) * n[0] + (uz * wx - ux * wz) * n[1] + (ux * wy - uy * wx) * n[2];
      if (Math.abs(cr) < 1e-18) continue;
      if (cr < 0) [bb, c] = [c, bb];
      tris.push(a, bb, c);
    }
    push(b, v, n, tris);
  }
}

/** União que pula a booleana quando há no máximo uma região (o caso comum de uma face só). */
const unionAll = (ms: MultiPolygon[]): MultiPolygon => {
  const parts = ms.filter((m) => m.length > 0);
  if (parts.length === 0) return [];
  return parts.length === 1 ? parts[0]! : union(...parts);
};

/** Reta de planta com as faces voltadas para +m (`plus`) e para -m (`minus`), em coordenadas (s, z). */
interface PlanLine {
  m: Vec2;
  c: number;
  plus: MultiPolygon[];
  minus: MultiPolygon[];
}

/**
 * Sólido de uma camada de parede a partir das suas faixas (já fundidas). Em vez de um prisma por faixa, cada face
 * lateral vira UMA região em (s, z) sobre a reta de planta, e as faces coplanares de faixas vizinhas se unem nela:
 * a parede fica inteira de base a topo, e o vão só aparece como furo na face (contorno dele, sem prolongamento).
 *
 * Faces voltadas para +m e -m numa mesma reta são subtraídas uma da outra: uma aresta compartilhada por duas
 * peças da camada é interna e some. Topo e base são as áreas planas expostas de cada cota; topo inclinado segue
 * o plano do perfil. O volume é o das faixas (mesmos polígonos, nenhuma área criada ou perdida).
 */
function extrudeLayer(b: SolidBatch, bands: LayerBand[], baseZ: number): void {
  const firstTri = b.indices.length;
  const firstVert = b.positions.length / 3;
  const lines: PlanLine[] = [];
  const flatTops: Array<{ z: number; poly: MultiPolygon }> = [];
  const bottoms: Array<{ z: number; poly: MultiPolygon }> = [];
  const zs: number[] = [];
  const addZ = (z: number): void => {
    if (!zs.some((q) => Math.abs(q - z) < Z_EPS)) zs.push(z);
  };

  for (const band of bands) {
    if (band.poly.length === 0) continue;
    const z0 = baseZ + band.z0;
    const flatTop = baseZ + band.z1;
    const slope = band.slope;
    const topAt = slope ? (x: number, y: number): number => baseZ + bandTopAt(band, { x, y }) : undefined;
    const zTop = (x: number, y: number): number => (topAt ? topAt(x, y) : flatTop);
    bottoms.push({ z: z0, poly: band.poly });
    addZ(z0);
    if (slope) {
      // Plano do perfil: z = gx·x + gy·y + c, com g = k·d (k = Δh/Δt). A normal aponta para cima.
      const k = (slope.h1 - slope.h0) / (slope.t1 - slope.t0);
      const gx = k * slope.d.x;
      const gy = k * slope.d.y;
      const l = Math.hypot(gx, gy, 1);
      emitFace(b, band.poly, (x, y) => [x, y, zTop(x, y)], [-gx / l, -gy / l, 1 / l]);
    } else {
      flatTops.push({ z: flatTop, poly: band.poly });
      addZ(flatTop);
    }

    for (const poly of band.poly) {
      for (const ring of poly.map((r, i) => oriented(r, i === 0))) {
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i]!;
          const q = ring[(i + 1) % ring.length]!;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const L = Math.hypot(dx, dy);
          if (L < 1e-9) continue;
          // Normal para fora: à direita de p→q (anéis externos anti-horários, furos horários).
          let nx = dy / L;
          let ny = -dx / L;
          let plus = true;
          if (nx < -1e-12 || (Math.abs(nx) <= 1e-12 && ny < 0)) {
            nx = -nx;
            ny = -ny;
            plus = false;
          }
          const m: Vec2 = { x: nx, y: ny };
          const c = nx * p.x + ny * p.y;
          const onLine = (ln: PlanLine): boolean =>
            Math.abs(ln.m.x * ny - ln.m.y * nx) < LINE_EPS &&
            Math.abs(ln.m.x * p.x + ln.m.y * p.y - ln.c) < LINE_EPS &&
            Math.abs(ln.m.x * q.x + ln.m.y * q.y - ln.c) < LINE_EPS;
          let ln = lines.find(onLine);
          if (!ln) {
            ln = { m, c, plus: [], minus: [] };
            lines.push(ln);
          }
          // Coordenadas da reta: s ao longo de d = (-m.y, m.x); z de topo nas duas pontas.
          const sp = -ln.m.y * p.x + ln.m.x * p.y;
          const sq = -ln.m.y * q.x + ln.m.x * q.y;
          const tp = zTop(p.x, p.y);
          const tq = zTop(q.x, q.y);
          const [sLo, sHi, tLo, tHi] = sp <= sq ? [sp, sq, tp, tq] : [sq, sp, tq, tp];
          if (sHi - sLo < 1e-9 || (tLo - z0 < Z_EPS && tHi - z0 < Z_EPS)) continue;
          const ring2: Ring = [
            { x: sLo, y: z0 },
            { x: sHi, y: z0 },
            { x: sHi, y: tHi },
            { x: sLo, y: tLo },
          ];
          (plus ? ln.plus : ln.minus).push([[ring2]]);
        }
      }
    }
  }

  // Faces laterais: por reta, a parte voltada para +m menos a voltada para -m (as arestas compartilhadas somem).
  for (const ln of lines) {
    const pl = unionAll(ln.plus);
    const mi = unionAll(ln.minus);
    const d: Vec2 = { x: -ln.m.y, y: ln.m.x };
    const to3 = (s: number, z: number): [number, number, number] => [ln.c * ln.m.x + s * d.x, ln.c * ln.m.y + s * d.y, z];
    if (pl.length) emitFace(b, mi.length ? difference(pl, mi) : pl, to3, [ln.m.x, ln.m.y, 0]);
    if (mi.length) emitFace(b, pl.length ? difference(mi, pl) : mi, to3, [-ln.m.x, -ln.m.y, 0]);
  }

  // Topo e base planos: em cada cota, o que é topo de uma faixa e não tem faixa por cima (e o simétrico na base).
  for (const Z of zs) {
    const tops = unionAll(flatTops.filter((f) => Math.abs(f.z - Z) < Z_EPS).map((f) => f.poly));
    const bots = unionAll(bottoms.filter((f) => Math.abs(f.z - Z) < Z_EPS).map((f) => f.poly));
    emitFace(b, tops.length && bots.length ? difference(tops, bots) : tops, (x, y) => [x, y, Z], [0, 0, 1]);
    emitFace(b, bots.length && tops.length ? difference(bots, tops) : bots, (x, y) => [x, y, Z], [0, 0, -1]);
  }
  splitTJunctions(b, firstTri, firstVert);
}

export interface LevelSolids {
  batches: SolidBatch[];
}

/** Lote do material `m` (e da categoria `cat`) dentro do mapa, criado na primeira vez. */
function batchOf(byMat: Map<Id, SolidBatch>, m: Id, cat: GraphicsCategory): SolidBatch {
  let b = byMat.get(m);
  if (!b) {
    b = { materialId: m, category: cat, positions: [], normals: [], indices: [], ids: [] };
    byMat.set(m, b);
  }
  return b;
}

/** Sólidos de todas as camadas das paredes do nível, por material. */
export function buildLevelSolids(r: ResolvedLevel): LevelSolids {
  const byMat = new Map<Id, SolidBatch>();
  for (const rw of Object.values(r.walls)) {
    for (const l of rw.layers) {
      const b = batchOf(byMat, l.materialId, 'wall');
      ofElement(b, rw.wallId, () => extrudeLayer(b, fuseBands(l.bands), rw.baseZ));
    }
  }
  return { batches: [...byMat.values()] };
}

/** Sólidos dos pisos: uma extrusão por camada entre as cotas absolutas (furos incluídos), agrupada por material. */
export function buildFloorSolids(floors: ResolvedFloor[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const f of floors) {
    for (const l of f.layers) {
      const b = batchOf(byMat, l.materialId, 'floor');
      ofElement(b, f.floorId, () => {
        for (const poly of f.polygon) extrudePolygon(b, poly, l.z0, l.z1);
      });
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
      const b = batchOf(byMat, l.materialId, 'slab');
      const topAt = sl ? (x: number, y: number): number => l.z1 + slabRiseAt(sl, { x, y }) : undefined;
      const bottomAt = sl ? (x: number, y: number): number => l.z0 + slabRiseAt(sl, { x, y }) : undefined;
      ofElement(b, s.slabId, () => {
        for (const poly of s.polygon) extrudePolygon(b, poly, l.z0, l.z1, topAt, bottomAt);
      });
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
        const b = batchOf(byMat, l.materialId, 'roof');
        const topAt = (x: number, y: number): number => planeZ(pl, { x, y }) - l.below;
        const bottomAt = (x: number, y: number): number => topAt(x, y) - l.thickness;
        // z0 = 0 e z1 = espessura só passam pelo guarda de extrusão; a cota vem de topAt e bottomAt.
        ofElement(b, r.roofId, () => {
          for (const poly of pl.polygon) extrudePolygon(b, poly, 0, l.thickness, topAt, bottomAt);
        });
      }
    }
  }
  return [...byMat.values()];
}
