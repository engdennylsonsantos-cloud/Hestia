import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, totalThickness, type Floor, type Project, type Slab, type Wall } from '@hestia/model';
import { quantifyLevel, resolveAllSlabs, resolveLevel, wallZRange } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;
type F = Omit<Floor, 'order'>;
type S = Omit<Slab, 'order'>;

/** Projeto com paredes, pisos e lajes, montados pelos comandos (como na aplicação). */
function build(walls: W[], floors: F[] = [], slabs: S[] = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  for (const sl of slabs) s.exec({ type: 'addSlab', slab: sl });
  return s.project;
}

/** Parede de 4 m de (0,0) a (4,0), térreo, altura 3 m. */
const wall4 = (extra: Partial<W> = {}): W => makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, ...extra });
/** Piso sobre a metade inicial da parede (x de -1 a 2), face superior em +0,05. */
const pisoMetade = (extra: Partial<F> = {}): F => makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), heightOffset: 0.05, ...extra });

const zOf = (p: Project) => wallZRange(p, p.elements.w1 as Wall);

describe('P9 · base por trecho: piso cobre só metade da parede', () => {
  it('a base sobe em degrau a 2 m: 0,05 m sobre o piso e 0 m fora dele; z0 é a menor base', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [pisoMetade()]);
    const z = zOf(p);
    expect(z.z0).toBe(0);
    expect(z.height).toBeCloseTo(3, 12);
    expect(z.profile).toBeUndefined();
    expect(z.bottomProfile).toEqual([
      { t: 0, h: 0.05 },
      { t: 2, h: 0.05 },
      { t: 2, h: 0 },
      { t: 4, h: 0 },
    ]);
  });

  it('volume e área da parede: 2 m a 2,95 m e 2 m a 3,00 m (faces e volume à mão)', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [pisoMetade()]);
    const rw = resolveLevel(p, 'lv_0').walls.w1!;
    const espessura = totalThickness(p.wallTypes.wt_alv14!);
    const q = quantifyLevel(p, resolveLevel(p, 'lv_0')).walls[0]!;
    const areaEsperada = 2 * 2.95 + 2 * 3;
    expect(rw.profileBottom).toEqual([
      { t: 0, h: 0.05 },
      { t: 2, h: 0.05 },
      { t: 2, h: 0 },
      { t: 4, h: 0 },
    ]);
    expect(q.grossFaceArea).toBeCloseTo(areaEsperada, 9);
    expect(q.height).toBeCloseTo(areaEsperada / 4, 9);
    expect(q.grossVolume).toBeCloseTo(espessura * areaEsperada, 9);
    // Piso e parede não se tocam em volume (a parede começa na face superior do piso), então o líquido é o bruto.
    expect(q.volume).toBeCloseTo(espessura * areaEsperada, 9);
  });

  it('a camada começa em 0,05 m sobre o piso e em 0 m fora dele (faixas da planta de corte)', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [pisoMetade()]);
    const camadas = resolveLevel(p, 'lv_0').walls.w1!.layers;
    expect(camadas.length).toBeGreaterThan(0);
    for (const l of camadas) {
      for (const b of l.bands) {
        const x = b.poly.flat(2);
        const xs = x.map((q) => q.x);
        const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
        // Faixa sobre o piso (t < 2) começa em 0,05; faixa fora dele começa em 0.
        expect(b.z0).toBeCloseTo(mid < 2 ? 0.05 : 0, 9);
      }
    }
  });
});

describe('P9 · parede totalmente coberta e sem cobertura: como antes', () => {
  it('piso cobrindo a parede toda: base na face superior, sem perfil', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [pisoMetade({ boundary: rect(-1, -1, 5, 1) })]);
    expect(zOf(p)).toEqual({ z0: 0.05, height: 2.95 });
    expect(resolveLevel(p, 'lv_0').walls.w1!.profileBottom).toBeUndefined();
  });

  it('sem nenhum piso sob a parede: modelo, sem perfil', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [pisoMetade({ boundary: rect(10, 10, 12, 12) })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });
});

describe('P9 · laje inclinada: a cota da face em cada trecho', () => {
  it('laje inclinada cobre a metade: degrau com a face no ponto médio do trecho coberto (0,05 + 0,20 = 0,25 m)', () => {
    // Subida de 10 % a partir de x = -1: no ponto médio do trecho coberto (1; 0) sobe 0,20 m; face superior = 0,05 + 0,20.
    const slab = makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), heightOffset: 0.05, slope: { origin: { x: -1, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    const p = build([wall4({ attachBottomToFloor: true })], [], [slab]);
    const z = zOf(p);
    expect(z.z0).toBe(0);
    expect(z.bottomProfile).toEqual([
      { t: 0, h: expect.closeTo(0.25, 9) },
      { t: 2, h: expect.closeTo(0.25, 9) },
      { t: 2, h: 0 },
      { t: 4, h: 0 },
    ]);
  });
});

describe('P9 · topo anexado à face inferior da laje do nível de topo, por trecho', () => {
  it('a metade coberta desce até a face inferior da laje do pavimento 2; a outra metade segue a altura normal', () => {
    const p0 = build([wall4({ topLevelId: 'lv_1', attachTopToFloor: true })], [], [makeSlab({ id: 's2', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 2, 1), heightOffset: 0 })]);
    const bottomZ = resolveAllSlabs(p0)[0]!.bottomZ;
    const z = zOf(p0);
    expect(z.z0).toBe(0);
    expect(z.height).toBeCloseTo(3, 12);
    expect(z.profile).toEqual([
      { t: 0, h: expect.closeTo(bottomZ, 9) },
      { t: 2, h: expect.closeTo(bottomZ, 9) },
      { t: 2, h: 3 },
      { t: 4, h: 3 },
    ]);
  });
});

describe('P9 · propriedade em 10 sementes: a base por trecho nunca aumenta o volume', () => {
  /** Gerador determinístico (mesmo de netQuantities.test.ts). */
  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  for (let seed = 1; seed <= 10; seed++) {
    it(`semente ${seed}: piso aleatório sobre a parede; volume e área ≤ sem anexo, iguais sem cobertura`, () => {
      const r = rng(seed);
      const L = 2 + r() * 6;
      const x0 = -1 + r() * (L + 1);
      const x1 = x0 + 0.5 + r() * 4;
      const off = r() * 0.2;
      const wall = wall4({ a: { x: 0, y: 0 }, b: { x: L, y: 0 }, attachBottomToFloor: true });
      const floor = pisoMetade({ boundary: rect(x0, -1, x1, 1), heightOffset: off });
      const semAnexo = build([{ ...wall, attachBottomToFloor: false }], [floor]);
      const comAnexo = build([wall], [floor]);
      const q0 = quantifyLevel(semAnexo, resolveLevel(semAnexo, 'lv_0')).walls[0]!;
      const q1 = quantifyLevel(comAnexo, resolveLevel(comAnexo, 'lv_0')).walls[0]!;
      expect(q1.grossVolume).toBeLessThanOrEqual(q0.grossVolume + 1e-9);
      expect(q1.volume).toBeLessThanOrEqual(q1.grossVolume + 1e-9);
      expect(q1.grossFaceArea).toBeLessThanOrEqual(q0.grossFaceArea + 1e-9);
      const coberto = Math.max(0, Math.min(x1, L) - Math.max(x0, 0));
      if (coberto < 1e-6 || off < 1e-9) expect(q1.grossVolume).toBeCloseTo(q0.grossVolume, 9);
      else expect(q1.grossVolume).toBeLessThan(q0.grossVolume);
    });
  }
});
