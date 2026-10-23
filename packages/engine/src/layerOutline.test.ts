import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type LayerTermino, type Project, type WallType, type FloorType } from '@hestia/model';
import { resolveFloors, type ResolvedFloor } from './floors.ts';
import { quantifyFloors } from './floorQuantities.ts';

/** Decisão 0023 §2 e §9 (P8): contorno por camada de piso vinculado às paredes. Paredes de 14 cm: 2 cm de acabamento, 10 cm de núcleo, 2 cm. */

type Pt = { x: number; y: number };
const pts = (list: [number, number][]): Pt[] => list.map(([x, y]) => ({ x, y }));
const RECT: [number, number][] = [[0, 0], [4, 0], [4, 3], [0, 3]];
const L: [number, number][] = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
const SEED_RECT: Pt = { x: 2, y: 1.5 };
const SEED_L: Pt = { x: 1, y: 1 };
/** Esquadria nas duas pontas de cada parede (os cantos externos ficam fechados). */
const MITER = { kind: 'miter' as const, flip: false };

/** Tipo de parede com acabamento `f` de cada lado e núcleo `c`: a espessura total é `c + 2f`. */
function wallType(base: Project, id: string, f: number, c = 0.1): WallType {
  const layer = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });
  return { ...base.wallTypes.wt_alv14!, id, name: id, code: id, layers: [layer('finish1', 'mat_argamassa', f), layer('structure', 'mat_bloco14', c), layer('finish1', 'mat_argamassa', f)] };
}

/** Tipo de piso de três camadas (topo para baixo): acabamento 1 cm, substrato 2 cm, estrutura 10 cm. */
function floorType(base: Project, termos: (LayerTermino | undefined)[] = []): FloorType {
  const L3: Layer[] = [
    { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false },
    { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false },
  ];
  const layers = L3.map((l, i) => {
    const t = termos[i];
    return t === undefined ? l : { ...l, termino: t };
  });
  return { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste', code: 'T', layers };
}

interface Opts {
  outline?: [number, number][];
  seed?: Pt;
  mode?: 'walls-finish' | 'walls-core' | 'perimeter';
  linked?: boolean;
  termos?: (LayerTermino | undefined)[];
  wallF?: number;
  wallF2?: number;
  mats?: string;
}

/** Projeto no térreo: paredes ao longo do contorno (linha de centro) e um piso com o contorno pedido. */
function build(o: Opts = {}): Project {
  const base = createEmptyProject();
  const outline = o.outline ?? RECT;
  base.wallTypes.wt_t = wallType(base, 'wt_t', o.wallF ?? 0.02);
  base.wallTypes.wt_t2 = wallType(base, 'wt_t2', 0.03);
  base.floorTypes.ft_t = floorType(base, o.termos);
  const s = new ProjectStore(base);
  outline.forEach(([x, y], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_t', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, joinStart: MITER, joinEnd: MITER }) });
  });
  const linked = o.linked ?? true;
  const floor = makeFloor({
    id: 'f1',
    typeId: 'ft_t',
    levelId: 'lv_0',
    boundary: pts([[0, 0], [4, 0], [4, 3], [0, 3]]),
    ...(linked ? { outlineSource: { mode: o.mode ?? 'walls-finish', seed: o.seed ?? SEED_RECT, linked: true } } : {}),
  });
  s.exec({ type: 'addFloor', floor });
  return s.project;
}

const floorOf = (p: Project): ResolvedFloor => resolveFloors(p, 'lv_0')[0]!;
const areas = (p: Project): number[] => floorOf(p).layers.map((l) => multiArea(l.polygon));
const RECT_FINISH = (4 - 0.14) * (3 - 0.14); // 11,0396 m²: centro menos a meia espessura total (7 cm por lado).
const RECT_CORE = (4 - 0.1) * (3 - 0.1); // 11,31 m²: centro menos o núcleo (5 cm por lado).
// União dos dois braços deslocados para dentro de d = meia espessura. O canto reentrante do circuito de paredes (já
// existente, antes de P8) não é preenchido: sobra um quadrado d × d que entra no cômodo. Por isso o + d².
const L_FINISH = 2 * (4 - 0.14) * (2 - 0.14) - (2 - 0.14) ** 2 + 0.07 ** 2;
const L_CORE = 2 * (4 - 0.1) * (2 - 0.1) - (2 - 0.1) ** 2 + 0.05 ** 2;

describe('contorno por camada: automático (decisão 0023 §2, P8)', () => {
  it('retângulo: a estrutura (dentro do núcleo) vai até o núcleo da parede; acabamento e substrato param na face', () => {
    const a = areas(build());
    expect(a[0]).toBeCloseTo(RECT_FINISH, 6);
    expect(a[1]).toBeCloseTo(RECT_FINISH, 6);
    expect(a[2]).toBeCloseTo(RECT_CORE, 6);
  });

  it('L: mesma regra no canto interno', () => {
    const p = build({ outline: L, seed: SEED_L });
    const a = areas(p);
    expect(a[0]).toBeCloseTo(L_FINISH, 6);
    expect(a[2]).toBeCloseTo(L_CORE, 6);
    expect(floorOf(p).polygon.reduce((s, poly) => s + multiArea([poly]), 0)).toBeCloseTo(L_FINISH, 6);
  });

  it('volumes por camada: área da própria camada vezes a espessura', () => {
    const q = quantifyFloors(build(), 'lv_0').floors[0]!;
    expect(q.layers[0]!.volume).toBeCloseTo(RECT_FINISH * 0.01, 9);
    expect(q.layers[2]!.volume).toBeCloseTo(RECT_CORE * 0.1, 9);
    expect(q.volume).toBeCloseTo(RECT_FINISH * 0.03 + RECT_CORE * 0.1, 9);
    expect(q.area).toBeCloseTo(RECT_FINISH, 6);
  });

  it('associativo: trocar a espessura do acabamento da parede move só a face (a estrutura segue no núcleo)', () => {
    const p = build();
    const q = structuredClone(p);
    for (const w of Object.values(q.elements)) if (w.kind === 'wall') (w as { typeId: string }).typeId = 'wt_t2';
    const a = areas(q);
    expect(a[0]).toBeCloseTo((4 - 0.16) * (3 - 0.16), 6);
    expect(a[2]).toBeCloseTo(RECT_CORE, 6);
  });
});

describe('contorno por camada: término explícito (decisão 0023 §2, P8)', () => {
  it('nucleo: todas as camadas até o núcleo', () => {
    const a = areas(build({ termos: ['nucleo', 'nucleo', 'nucleo'] }));
    expect(a.every((x) => Math.abs(x - RECT_CORE) < 1e-6)).toBe(true);
  });

  it('face: todas as camadas na face, inclusive a estrutura', () => {
    const a = areas(build({ termos: ['face', 'face', 'face'] }));
    expect(a.every((x) => Math.abs(x - RECT_FINISH) < 1e-6)).toBe(true);
  });

  it('mistura: cada camada tem o seu término', () => {
    const a = areas(build({ termos: ['face', 'nucleo', 'auto'] }));
    expect(a[0]).toBeCloseTo(RECT_FINISH, 6);
    expect(a[1]).toBeCloseTo(RECT_CORE, 6);
    expect(a[2]).toBeCloseTo(RECT_CORE, 6);
  });

  it('deslocamento positivo avança 1 cm sobre a parede a partir da face; negativo recua', () => {
    const plus = areas(build({ termos: [{ cm: 1 }, { cm: 1 }, { cm: 1 }] }));
    expect(plus[0]).toBeCloseTo((4 - 0.14 + 0.02) * (3 - 0.14 + 0.02), 6);
    const minus = areas(build({ termos: [{ cm: -1 }, { cm: -1 }, { cm: -1 }] }));
    expect(minus[2]).toBeCloseTo((4 - 0.14 - 0.02) * (3 - 0.14 - 0.02), 6);
    const zero = areas(build({ termos: [{ cm: 0 }, undefined, undefined] }));
    expect(zero[0]).toBeCloseTo(RECT_FINISH, 6);
  });

  it('deslocamento no L: positivo cresce, negativo recua em relação à face', () => {
    const face = areas(build({ outline: L, seed: SEED_L, termos: ['face', 'face', 'face'] }))[0]!;
    const plus = areas(build({ outline: L, seed: SEED_L, termos: [{ cm: 2 }, undefined, undefined] }))[0]!;
    const minus = areas(build({ outline: L, seed: SEED_L, termos: [{ cm: -2 }, undefined, undefined] }))[0]!;
    expect(plus).toBeGreaterThan(face);
    expect(minus).toBeLessThan(face);
  });
});

describe('contorno por camada: estático e casos sem vínculo (decisão 0023 §2, compatibilidade)', () => {
  it('piso estático: o deslocamento segue ignorado; só a camada em contato com a parede é recortada (decisão 0025, revista)', () => {
    const p = build({ linked: false, termos: ['nucleo', 'face', { cm: 2 }] });
    const f = floorOf(p);
    // Camada com `cm` em elemento sem vínculo: contorno do elemento, como antes (identidade preservada).
    expect(f.layers[2]!.polygon).toBe(f.polygon);
    // Parede de 14 cm com a base no topo do piso: toca só a camada de acabamento (índice 0). O substrato `face`
    // (índice 1) e a estrutura ou o `cm` abaixo dele não são recortados (0025 §2, revisão de 2026-10-22).
    // Núcleo: 5 cm por dentro × perímetro de 14 m, menos o canto (0,05² × 4).
    const area = (i: number): number => multiArea(f.layers[i]!.polygon);
    expect(multiArea(f.polygon) - area(0)).toBeCloseTo(0.05 * 14 - 0.05 * 0.05 * 4, 2);
    expect(multiArea(f.polygon) - area(1)).toBeCloseTo(0, 9);
    expect(area(1)).toBeGreaterThan(area(0));
  });

  it('modo perímetro externo: a regra explícita recorta só a camada tocada e o automático segue o contorno do elemento (decisão 0025, revista)', () => {
    const p = build({ mode: 'perimeter', termos: ['nucleo', 'face', 'auto'] });
    const f = floorOf(p);
    const area = (i: number): number => multiArea(f.layers[i]!.polygon);
    expect(area(2)).toBeCloseTo(multiArea(f.polygon), 9);
    // Contorno externo (paredes inteiras dentro dele) e base da parede no topo do piso: o núcleo de 10 cm sai da
    // camada de acabamento (índice 0); a camada `face` (índice 1), abaixo dela, continua com o contorno inteiro.
    // Antes da revisão de 2026-10-22 a faixa do elemento inteiro recortava as duas.
    expect(multiArea(f.polygon) - area(0)).toBeCloseTo(0.1 * 14, 2);
    expect(multiArea(f.polygon) - area(1)).toBeCloseTo(0, 9);
  });

  it('circuito aberto: mantém o último contorno e todas as camadas usam ele', () => {
    const p = build({ seed: { x: 10, y: 10 } });
    const f = floorOf(p);
    expect(f.problem).not.toBeNull();
    for (const l of f.layers) expect(l.polygon).toBe(f.polygon);
  });
});

describe('contorno por camada: independência e propriedades (decisão 0023 §9, P-6)', () => {
  it('trocar nomes de tipo e materiais das camadas não muda nenhuma área', () => {
    const p = build({ termos: ['face', 'nucleo', 'auto'] });
    const q = structuredClone(p);
    for (const t of Object.values(q.floorTypes)) for (const l of t.layers) l.materialId = `zz_${l.materialId}`;
    for (const t of Object.values(q.wallTypes)) t.name = `nome ${t.id}`;
    expect(areas(q)).toEqual(areas(p));
  });

  it('quantitativos por camada somam o total do piso', () => {
    const p = build({ outline: L, seed: SEED_L, termos: ['face', 'nucleo', 'auto'] });
    const q = quantifyFloors(p, 'lv_0');
    const f = q.floors[0]!;
    expect(f.layers.reduce((s, l) => s + l.volume, 0)).toBeCloseTo(f.volume, 12);
    expect(f.layers.reduce((s, l) => s + l.grossVolume, 0)).toBeCloseTo(f.grossVolume, 12);
  });

  it('dez sementes: áreas exatas por camada em retângulo com espessuras e términos sorteados', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 10; k++) {
      const w = 2 + rnd() * 4;
      const h = 2 + rnd() * 4;
      const f = 0.01 + rnd() * 0.02;
      const c = 0.05 + rnd() * 0.1;
      const cm = Math.round((rnd() * 4 - 2) * 10) / 10;
      const outline: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
      const base = createEmptyProject();
      base.wallTypes.wt_t = wallType(base, 'wt_t', f, c);
      base.floorTypes.ft_t = floorType(base, ['face', 'nucleo', { cm }]);
      const st = new ProjectStore(base);
      outline.forEach(([x, y], i) => {
        const [x2, y2] = outline[(i + 1) % outline.length]!;
        st.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_t', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, joinStart: MITER, joinEnd: MITER }) });
      });
      st.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_t', levelId: 'lv_0', boundary: pts(outline), outlineSource: { mode: 'walls-finish', seed: { x: w / 2, y: h / 2 }, linked: true } }) });
      const a = areas(st.project);
      const t = c + 2 * f;
      expect(a[0]).toBeCloseTo((w - t) * (h - t), 4);
      expect(a[1]).toBeCloseTo((w - c) * (h - c), 4);
      expect(a[2]).toBeCloseTo((w - t + 2 * cm / 100) * (h - t + 2 * cm / 100), 4); // offset por Clipper: precisão de 5e-5 m²
    }
  });
});

