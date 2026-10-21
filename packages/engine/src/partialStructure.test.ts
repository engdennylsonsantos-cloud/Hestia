import { describe, expect, it } from 'vitest';
import { closeGapsSafe, multiArea, offsetMulti, ringArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type PartialStructure, type Project, type Wall, type WallType } from '@hestia/model';
import { applyPartialStructure, resolveLevel, type ResolvedLevel } from './index.ts';

const MODOS: PartialStructure[] = ['entire', 'noFinishes', 'coreOnly'];
const KINDS: JoinKind[] = ['miter', 'butt'];

/** Projeto com um tipo de parede dado e uma parede de `len` m no lv_0. */
function umaParede(tipo: WallType, len = 4): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertWallType', wallType: tipo });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: tipo.id, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: len, y: 0 }, height: 3 }) });
  return s;
}

/** Tipo padrão da biblioteca (tinta / reboco de substrato / bloco / reboco / tinta). */
const alv14 = (): WallType => createEmptyProject().wallTypes.wt_alv14!;

/** Parede de 3 camadas: reboco (acabamento) / bloco (estrutura) / reboco (acabamento). Espessura 0,18 m. */
const tresCamadas = (): WallType => ({
  id: 'wt_rbb',
  name: 'Reboco-bloco-reboco',
  code: 'T3',
  description: 'teste',
  layers: [
    { function: 'finish1', materialId: 'mat_reboco', thickness: 0.02, wraps: false },
    { function: 'structure', materialId: 'mat_bloco14', thickness: 0.14, wraps: false },
    { function: 'finish1', materialId: 'mat_reboco', thickness: 0.02, wraps: false },
  ],
  wrapInserts: 'none',
  wrapEnds: 'none',
  strips: [],
  cost: 0,
  thermalU: null,
  acousticRw: null,
  fireRating: null,
  manufacturer: '',
});

/** Área da silhueta do nível (união dos conjuntos). */
const areaSilhueta = (lv: ResolvedLevel): number => multiArea(union(...lv.clusters.map((c) => c.silhouette)));
const camadas = (lv: ResolvedLevel, id = 'w'): number => lv.walls[id]!.layers.length;

describe('parede de 3 camadas (reboco / bloco / reboco)', () => {
  const p = umaParede(tresCamadas()).project;
  const lv = resolveLevel(p, 'lv_0', new Map());

  it('entire devolve o mesmo objeto', () => {
    expect(applyPartialStructure(p, lv, 'entire')).toBe(lv);
  });

  it('entire: 3 camadas e silhueta de 4 × 0,18 m²', () => {
    expect(camadas(lv)).toBe(3);
    expect(areaSilhueta(lv)).toBeCloseTo(4 * 0.18, 5);
  });

  it('noFinishes: sai o reboco de acabamento, fica só o bloco (1 camada, 4 × 0,14 m²)', () => {
    const r = applyPartialStructure(p, lv, 'noFinishes');
    expect(camadas(r)).toBe(1);
    expect(r.walls.w!.layers[0]!.materialId).toBe('mat_bloco14');
    expect(areaSilhueta(r)).toBeCloseTo(4 * 0.14, 5);
  });

  it('coreOnly: só o núcleo (1 camada, 4 × 0,14 m²)', () => {
    const r = applyPartialStructure(p, lv, 'coreOnly');
    expect(camadas(r)).toBe(1);
    expect(r.walls.w!.layers[0]!.materialId).toBe('mat_bloco14');
    expect(areaSilhueta(r)).toBeCloseTo(4 * 0.14, 5);
  });

  it('a região do material sai junto com a última camada dele', () => {
    const r = applyPartialStructure(p, lv, 'noFinishes');
    expect(r.clusters[0]!.regions.map((g) => g.materialId)).toEqual(['mat_bloco14']);
  });
});

describe('parede padrão (wt_alv14: tinta, reboco de substrato, bloco, reboco, tinta)', () => {
  const s = umaParede(alv14());
  const lv = resolveLevel(s.project, 'lv_0', new Map());

  it('o substrato (reboco da biblioteca) não é acabamento: noFinishes tira só a tinta', () => {
    const r = applyPartialStructure(s.project, lv, 'noFinishes');
    expect(r.walls.w!.layers.map((l) => l.materialId)).toEqual(['mat_reboco', 'mat_bloco14', 'mat_reboco']);
    expect(areaSilhueta(r)).toBeCloseTo(4 * 0.18, 5);
  });

  it('coreOnly deixa só o bloco; as camadas fora do núcleo saem', () => {
    const r = applyPartialStructure(s.project, lv, 'coreOnly');
    expect(r.walls.w!.layers.map((l) => l.materialId)).toEqual(['mat_bloco14']);
    expect(areaSilhueta(r)).toBeCloseTo(4 * 0.14, 5);
  });
});

describe('membranas e faixas verticais', () => {
  it('membrana (função membrane) fica em noFinishes e sai em coreOnly, por estar fora do núcleo', () => {
    const t: WallType = {
      ...tresCamadas(),
      id: 'wt_mem',
      layers: [
        { function: 'structure', materialId: 'mat_bloco14', thickness: 0.14, wraps: false },
        { function: 'membrane', materialId: 'mat_argamassa', thickness: 0, wraps: false },
      ],
    };
    const p = umaParede(t).project;
    const lv = resolveLevel(p, 'lv_0', new Map());
    expect(lv.walls.w!.membranes).toHaveLength(1);
    expect(applyPartialStructure(p, lv, 'noFinishes').walls.w!.membranes).toHaveLength(1);
    expect(applyPartialStructure(p, lv, 'coreOnly').walls.w!.membranes).toHaveLength(0);
  });

  it('faixa vertical (rodapé) é acabamento: some nos dois modos parciais', () => {
    const s = umaParede({ ...alv14(), strips: [{ id: 'st0', name: 'rodapé', side: 'interior' as const, materialId: 'mat_ceramica', thickness: 0.01, z0: 0, z1: 0.1 }] });
    const lv = resolveLevel(s.project, 'lv_0', new Map());
    expect(lv.walls.w!.layers.some((l) => l.layerIndex < 0)).toBe(true);
    for (const modo of ['noFinishes', 'coreOnly'] as const) {
      expect(applyPartialStructure(s.project, lv, modo).walls.w!.layers.every((l) => l.layerIndex >= 0)).toBe(true);
    }
  });
});

describe('imutabilidade e projeto vazio', () => {
  it('o nível original não muda ao aplicar os modos', () => {
    const p = umaParede(tresCamadas()).project;
    const lv = resolveLevel(p, 'lv_0', new Map());
    const antes = JSON.stringify(lv);
    const nCamadas = lv.walls.w!.layers.length;
    const cortes = lv.clusters.map((c) => c.silhouette);
    applyPartialStructure(p, lv, 'noFinishes');
    applyPartialStructure(p, lv, 'coreOnly');
    expect(JSON.stringify(lv)).toBe(antes);
    expect(lv.walls.w!.layers).toHaveLength(nCamadas);
    expect(lv.clusters.map((c) => c.silhouette)).toEqual(cortes);
  });

  it('projeto sem paredes: os modos parciais devolvem um nível vazio, entire o mesmo objeto', () => {
    const p = createEmptyProject();
    const lv = resolveLevel(p, 'lv_0', new Map());
    expect(applyPartialStructure(p, lv, 'entire')).toBe(lv);
    for (const modo of ['noFinishes', 'coreOnly'] as const) {
      expect(applyPartialStructure(p, lv, modo)).toEqual({ levelId: 'lv_0', walls: {}, clusters: [] });
    }
  });
});

/** Cadeia de paredes com juntas; mesma montagem de `juntasInvariantes.test.ts`. */
interface Seg {
  id: string;
  type: string;
  a: Vec2;
  b: Vec2;
}
const P = (x: number, y: number): Vec2 => ({ x, y });
const rad = (d: number): number => (d * Math.PI) / 180;
const F = 'wt_alv14';
const G = 'wt_ext19';

function montar(segs: Seg[], kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const g of segs) s.exec({ type: 'addWall', wall: makeWall({ id: g.id, typeId: g.type, levelId: 'lv_0', a: g.a, b: g.b, height: 3 }) });
  const el = { ...s.project.elements } as Record<string, Wall>;
  for (const g of segs) el[g.id] = { ...(el[g.id] as Wall), joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } };
  return { ...s.project, elements: el } as unknown as Project;
}

/** Anéis externos, furos reais e fresta (fecho de 1,5 mm) da união dos `cut` do nível. */
function medir(lv: ResolvedLevel): { rings: number; holes: number; fresta: number } {
  const polys: MultiPolygon = Object.values(lv.walls).flatMap((w) => w.layers.flatMap((l) => l.cut));
  const u = closeGapsSafe(union(...polys.map((poly) => [poly] as MultiPolygon)), 2e-5, 1e-4);
  const fecho = offsetMulti(offsetMulti(u, 0.0015), -0.0015);
  let holes = 0;
  for (const poly of u) {
    for (const h of poly.slice(1)) {
      const a = Math.abs(ringArea(h));
      let per = 0;
      for (let i = 0; i < h.length; i++) per += Math.hypot(h[(i + 1) % h.length]!.x - h[i]!.x, h[(i + 1) % h.length]!.y - h[i]!.y);
      if (a > 1e-9 && (2 * a) / Math.max(per, 1e-12) >= 1e-6) holes += 1;
    }
  }
  return { rings: u.length, holes, fresta: multiArea(fecho) - multiArea(u) };
}

describe('L com junção: a silhueta fecha sem fresta nos três modos', () => {
  for (const kind of KINDS) {
    for (const [ta, tb, ang] of [
      [F, F, 90],
      [G, F, 60],
    ] as const) {
      it(`L ${ta}+${tb} a ${ang}° em ${kind}`, () => {
        const segs: Seg[] = [
          { id: 'g', type: ta, a: P(0, 0), b: P(4, 0) },
          { id: 'f', type: tb, a: P(4, 0), b: P(4 + 3 * Math.cos(rad(ang)), 3 * Math.sin(rad(ang))) },
        ];
        const p = montar(segs, kind);
        const lv = resolveLevel(p, 'lv_0', new Map());
        for (const modo of MODOS) {
          const r = medir(applyPartialStructure(p, lv, modo));
          expect(r.rings, `${modo}: anéis externos`).toBe(1);
          expect(r.holes, `${modo}: furos`).toBe(0);
          expect(r.fresta, `${modo}: fresta aberta`).toBeLessThan(2e-5);
        }
      });
    }
  }

  it('as camadas que ficam mantêm o mesmo corte que em entire (prioridade padrão: nada as corta)', () => {
    const segs: Seg[] = [
      { id: 'g', type: G, a: P(0, 0), b: P(4, 0) },
      { id: 'f', type: F, a: P(4, 0), b: P(4, 3) },
    ];
    const p = montar(segs, 'miter');
    const lv = resolveLevel(p, 'lv_0', new Map());
    for (const modo of ['noFinishes', 'coreOnly'] as const) {
      const r = applyPartialStructure(p, lv, modo);
      for (const [id, w] of Object.entries(r.walls)) {
        for (const l of w.layers) {
          const orig = lv.walls[id]!.layers.find((o) => o.layerIndex === l.layerIndex)!;
          expect(multiArea(l.cut), `${modo}: ${id}#${l.layerIndex}`).toBeCloseTo(multiArea(orig.cut), 9);
        }
      }
    }
  });
});
