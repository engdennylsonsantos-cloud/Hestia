import { describe, expect, it } from 'vitest';
import { dist, multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type RoofShape } from '@hestia/model';
import { resolveRoofs, roofTopAt, type ResolvedRoof } from './index.ts';
import { planeHas } from './roofGeom.ts';

/** Gerador determinístico (mulberry32): mesma semente, mesmos contornos em qualquer execução. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261019;
const COUNT = 30;
const SHAPES: RoofShape[] = ['hip', 'gable', 'shed'];

/** Envoltória convexa (cadeia monótona), em sentido anti-horário. */
function hull(pts: Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Vec2[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** 30 contornos convexos aleatórios (5 a 9 vértices, 6 a 20 m) e um eixo de cumeeira por contorno. */
function randomCases(): Array<{ ring: Vec2[]; dir: Vec2; percent: number; shape: RoofShape }> {
  const rand = rng(SEED);
  const out: Array<{ ring: Vec2[]; dir: Vec2; percent: number; shape: RoofShape }> = [];
  while (out.length < COUNT) {
    const n = 5 + Math.floor(rand() * 5);
    const pts = Array.from({ length: n }, () => ({ x: rand() * 14, y: rand() * 10 }));
    const ring = hull(pts);
    if (ring.length < 3) continue;
    const a = rand() * 2 * Math.PI;
    out.push({
      ring,
      dir: { x: Math.cos(a), y: Math.sin(a) },
      percent: 10 + rand() * 50,
      shape: SHAPES[out.length % SHAPES.length]!,
    });
  }
  return out;
}

const EAVE_Z = 2.5;
const area = (ring: Vec2[]): number => Math.abs(multiArea([[ring]]));

function resolveCase(c: ReturnType<typeof randomCases>[number]): { p: Project; r: ResolvedRoof } {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: c.ring, shape: c.shape, slopePercent: c.percent, dir: c.dir, heightOffset: EAVE_Z }),
  });
  return { p: s.project, r: resolveRoofs(s.project, 'lv_0')[0]! };
}

/** Pontos de amostra ao longo de cada divisa interna (ridge, hip, valley) e cotas de todas as águas que a contêm. */
function internalSamples(r: ResolvedRoof): Array<{ p: Vec2; zs: number[] }> {
  const out: Array<{ p: Vec2; zs: number[] }> = [];
  for (const l of r.lines) {
    if (l.kind === 'eave' || l.kind === 'gable') continue;
    for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const q = { x: l.a.x + (l.b.x - l.a.x) * k, y: l.a.y + (l.b.y - l.a.y) * k };
      const zs = r.planes.filter((pl) => planeHas(pl.polygon, q)).map((pl) => pl.z0 + (pl.percent / 100) * ((q.x - pl.origin.x) * pl.up.x + (q.y - pl.origin.y) * pl.up.y));
      out.push({ p: q, zs });
    }
  }
  return out;
}

describe('G4 · propriedades do telhado com contornos convexos aleatórios (semente fixa)', () => {
  const cases = randomCases();

  it('gera 30 contornos convexos e resolve todos sem exceção', () => {
    expect(cases).toHaveLength(COUNT);
    expect(cases.every((c) => c.ring.length >= 3)).toBe(true);
    expect(() => cases.map(resolveCase)).not.toThrow();
  });

  it('soma das áreas em planta das águas = área do contorno (1e-4)', () => {
    for (const c of cases) {
      const { r } = resolveCase(c);
      const sum = r.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0);
      expect(sum).toBeCloseTo(area(c.ring), 4);
    }
  });

  it('altura contínua: nas divisas internas as cotas das águas vizinhas coincidem (1e-6)', () => {
    let checked = 0;
    for (const c of cases) {
      const { r } = resolveCase(c);
      for (const s of internalSamples(r)) {
        if (s.zs.length < 2) continue;
        checked++;
        expect(Math.max(...s.zs) - Math.min(...s.zs)).toBeLessThanOrEqual(1e-6);
      }
    }
    // Sem esta conta o teste passaria vazio se nenhuma divisa fosse gerada.
    expect(checked).toBeGreaterThan(100);
  });

  it('beiral: a cota mínima do contorno é eaveZ (1e-6)', () => {
    for (const c of cases) {
      const { r } = resolveCase(c);
      let low = Infinity;
      c.ring.forEach((a, i) => {
        const b = c.ring[(i + 1) % c.ring.length]!;
        for (const k of [0, 0.25, 0.5, 0.75]) {
          const z = roofTopAt(r, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
          if (z !== null) low = Math.min(low, z);
        }
      });
      expect(low).toBeCloseTo(EAVE_Z, 6);
    }
  });

  it('quatro águas: altura = eaveZ + % × distância à reta da aresta mais próxima (pontos internos)', () => {
    const hips = cases.filter((c) => c.shape === 'hip');
    expect(hips.length).toBeGreaterThan(0);
    for (const c of hips) {
      const { r } = resolveCase(c);
      const n = c.ring.length;
      for (let k = 0; k < 10; k++) {
        // Ponto interior (corda entre dois vértices não vizinhos) puxado para um vértice: continua dentro do convexo.
        const v = c.ring[k % n]!;
        const m = { x: (c.ring[0]!.x + c.ring[Math.floor(n / 2)]!.x) / 2, y: (c.ring[0]!.y + c.ring[Math.floor(n / 2)]!.y) / 2 };
        const w = 0.05 * k;
        const q = { x: m.x * (1 - w) + v.x * w, y: m.y * (1 - w) + v.y * w };
        const dmin = Math.min(
          ...c.ring.map((a, i) => {
            const b = c.ring[(i + 1) % n]!;
            const L = dist(a, b);
            return Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) / L;
          }),
        );
        const z = roofTopAt(r, q);
        expect(z).not.toBeNull();
        expect(z!).toBeCloseTo(EAVE_Z + (c.percent / 100) * dmin, 6);
      }
    }
  });
});
