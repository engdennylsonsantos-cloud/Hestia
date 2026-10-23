import { describe, expect, it } from 'vitest';
import { multiArea, ringArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, isSlab, makeSlab, makeWall, type Layer, type Project, type WallType } from '@hestia/model';
import { outerPerimeter, resetCircuitCache, resolveBoundary } from './index.ts';
import { resolveSlabs } from './slabs.ts';

/** Decisão 0026 (T7): perímetro pela face externa do NÚCLEO e cache por nível + extensão. */

const MITER = { kind: 'miter' as const, flip: false };
/** Retângulo 4 × 3 em sentido HORÁRIO: a face externa da parede cai para fora do retângulo. */
const RECT_CW: [number, number][] = [[0, 0], [0, 3], [4, 3], [4, 0]];

const camada = (fn: Layer['function'], materialId: string, thickness: number, extra: Partial<Layer> = {}): Layer => ({ function: fn, materialId, thickness, wraps: false, ...extra });

/** Parede de 0,20 m: acabamento 2 cm, estrutura 16 cm, acabamento 2 cm. Núcleo de 0,02 a 0,18 m da face externa. */
const PAREDE: Layer[] = [camada('finish1', 'mat_argamassa', 0.02), camada('structure', 'mat_bloco14', 0.16), camada('finish1', 'mat_argamassa', 0.02)];

function wallType(base: Project, id: string, layers: Layer[] = PAREDE): WallType {
  return { ...base.wallTypes.wt_alv14!, id, name: id, code: id, layers };
}

/** Quatro paredes de núcleo, todas com a linha de localização na face externa do núcleo (o eixo é essa face). */
function build(layers: Layer[] = PAREDE): ProjectStore {
  resetCircuitCache();
  const base = createEmptyProject();
  base.wallTypes.wt_core = wallType(base, 'wt_core', layers);
  const s = new ProjectStore(base);
  RECT_CW.forEach(([x, y], i) => {
    const [x2, y2] = RECT_CW[(i + 1) % RECT_CW.length]!;
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: `w${i}`, typeId: 'wt_core', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, locationLine: 'coreExterior', joinStart: MITER, joinEnd: MITER }),
    });
  });
  return s;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Área absoluta do anel devolvido pelo perímetro (null quando não há edificação). */
const perimeterArea = (p: Project, near: Vec2 | undefined, extend: 'finish' | 'core' = 'finish'): number => Math.abs(ringArea(outerPerimeter(p, 'lv_0', near, extend)!));

const slabOf = (p: Project, id: string) => {
  const el = p.elements[id];
  if (!isSlab(el)) throw new Error(`laje ${id} ausente`);
  return el;
};

/** Área do polígono resolvido de uma laje de perímetro; exige que o circuito não tenha problema. */
function resolvedArea(p: Project, id: string): number {
  const r = resolveBoundary(p, 'lv_0', slabOf(p, id));
  expect(r.problem).toBeNull();
  return multiArea([r.polygon!]);
}

const AREA_FINISH = 4.04 * 3.04; // 12,2816 m²: eixo 4 × 3 mais 0,02 m de acabamento para fora em cada lado.
const AREA_CORE = 4 * 3; // 12,0 m²: a face externa do núcleo cai no eixo.

describe('perímetro pelo núcleo (decisão 0026, T7)', () => {
  it('acabamento (padrão): 4,04 × 3,04 = 12,2816 m², igual ao modo explícito', () => {
    // 0,02 m de acabamento FORA do eixo em cada lado: (4 + 0,04) × (3 + 0,04).
    const p = build().project;
    expect(perimeterArea(p, undefined)).toBeCloseTo(AREA_FINISH, 6);
    expect(perimeterArea(p, undefined, 'finish')).toBeCloseTo(AREA_FINISH, 6);
  });

  it('núcleo: 4 × 3 = 12,0 m², com o anel 0,02 m para dentro de cada lado', () => {
    // A face externa do núcleo coincide com o eixo: 4 × 3. O acabamento fica fora do contorno.
    const p = build().project;
    const finish = perimeterArea(p, undefined, 'finish');
    const core = perimeterArea(p, undefined, 'core');
    expect(core).toBeCloseTo(AREA_CORE, 6);
    expect(finish).toBeCloseTo(AREA_FINISH, 6);
    expect(core).toBeLessThan(finish);
    expect(finish - core).toBeCloseTo(AREA_FINISH - AREA_CORE, 6);
  });

  it('cache por nível + extensão: acabamento e núcleo não se reaproveitam, em qualquer ordem', () => {
    // Um cache só por nível devolveria 12,0 para o segundo `finish` (ou o contrário); os dois valores convivem.
    const p1 = build().project;
    expect(perimeterArea(p1, undefined, 'finish')).toBeCloseTo(AREA_FINISH, 6);
    expect(perimeterArea(p1, undefined, 'core')).toBeCloseTo(AREA_CORE, 6);
    expect(perimeterArea(p1, undefined, 'finish')).toBeCloseTo(AREA_FINISH, 6);

    const p2 = build().project;
    expect(perimeterArea(p2, undefined, 'core')).toBeCloseTo(AREA_CORE, 6);
    expect(perimeterArea(p2, undefined, 'finish')).toBeCloseTo(AREA_FINISH, 6);
    expect(perimeterArea(p2, undefined, 'core')).toBeCloseTo(AREA_CORE, 6);
  });

  it('semente fora da edificação devolve null; dentro, o anel do núcleo', () => {
    // A semente a 100 m fica fora do alcance PERIMETER_REACH (1,5 m) do contorno.
    const p = build().project;
    expect(outerPerimeter(p, 'lv_0', { x: 100, y: 100 }, 'core')).toBeNull();
    expect(perimeterArea(p, { x: 2, y: 1.5 }, 'core')).toBeCloseTo(AREA_CORE, 6);
  });

  it('resolveBoundary repassa o extend do perímetro da laje; ausente vale finish', () => {
    const store = build();
    const source = (extend?: 'finish' | 'core') => ({
      mode: 'perimeter' as const,
      seed: { x: 2, y: 1.5 },
      linked: true,
      ...(extend ? { extend } : {}),
    });
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 's_core', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), outlineSource: source('core') }) });
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 's_finish', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), outlineSource: source('finish') }) });
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 's_omisso', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), outlineSource: source() }) });

    expect(resolvedArea(store.project, 's_core')).toBeCloseTo(AREA_CORE, 6);
    expect(resolvedArea(store.project, 's_finish')).toBeCloseTo(AREA_FINISH, 6);
    expect(resolvedArea(store.project, 's_omisso')).toBeCloseTo(AREA_FINISH, 6);
  });
});

/** Camada fora do núcleo para na face interna: (4 − 0,36) × (3 − 0,36), com 0,16 de núcleo + 0,02 de acabamento interno. */
const AREA_FACE_INTERNA = 3.64 * 2.64; // 9,6096 m²

/**
 * Projeto com uma laje de perímetro no núcleo (`extend: 'core'`), de tipo `typeId`, no nível `lv_0`. O topo em 0,15 m
 * faz todas as camadas cruzarem a altura das paredes.
 */
function montarLaje(store: ProjectStore, typeId: string, layers: Layer[]): ProjectStore {
  store.exec({ type: 'upsertSlabType', slabType: { ...store.project.slabTypes.ls_mac12!, id: typeId, name: typeId, code: typeId, layers } });
  store.exec({
    type: 'addSlab',
    slab: makeSlab({
      id: 's1',
      typeId,
      levelId: 'lv_0',
      boundary: rect(0, 0, 4, 3),
      heightOffset: 0.15,
      outlineSource: { mode: 'perimeter', seed: { x: 2, y: 1.5 }, linked: true, extend: 'core' },
    }),
  });
  return store;
}

/** Áreas por camada da laje de perímetro resolvida. */
function areasDaPerimetro(typeId: string, layers: Layer[], parede: Layer[] = PAREDE): number[] {
  const store = montarLaje(build(parede), typeId, layers);
  const slab = resolveSlabs(store.project, 'lv_0').find((s) => s.slabId === 's1')!;
  expect(slab.problem).toBeNull();
  return slab.layers.map((l) => multiArea(l.polygon));
}

describe('camadas do auto no perímetro pelo núcleo (decisão 0026, D3)', () => {
  it('ls_a: só estrutura — a camada do núcleo fica no contorno do elemento (12,0 m²)', () => {
    // Elemento inteiro é núcleo: a camada acompanha a face externa do núcleo, que cai no eixo (4 × 3).
    const areas = areasDaPerimetro('ls_a', [camada('structure', 'mat_concreto', 0.12)]);
    expect(areas[0]).toBeCloseTo(AREA_CORE, 6);
  });

  it('ls_b: substrato para na face interna (9,6096 m²) e estrutura vai até o núcleo (12,0 m²)', () => {
    // 3,64 × 2,64 = 9,6096; a estrutura é núcleo, então fica no contorno 4 × 3 = 12,0.
    const areas = areasDaPerimetro('ls_b', [camada('substrate', 'mat_argamassa', 0.02), camada('structure', 'mat_concreto', 0.15)]);
    expect(areas[0]).toBeCloseTo(AREA_FACE_INTERNA, 6);
    expect(areas[1]).toBeCloseTo(AREA_CORE, 6);
  });

  it('ls_c: acabamento e membrana param na face interna (9,6096 m² cada); estrutura até o núcleo (12,0 m²)', () => {
    // A membrana (espessura zero) também é camada fora do núcleo: 3,64 × 2,64. Só a estrutura é núcleo.
    const areas = areasDaPerimetro('ls_c', [camada('finish1', 'mat_argamassa', 0.03), camada('membrane', 'mat_argamassa', 0), camada('structure', 'mat_concreto', 0.1)]);
    expect(areas[0]).toBeCloseTo(AREA_FACE_INTERNA, 6);
    expect(areas[1]).toBeCloseTo(AREA_FACE_INTERNA, 6);
    expect(areas[2]).toBeCloseTo(AREA_CORE, 6);
  });

  it('ls_d: sem camada estrutura — o elemento inteiro é núcleo e todas as camadas ficam em 12,0 m²', () => {
    // Sem estrutura, `layerCoreFlags` marca todas as camadas como núcleo: nenhuma para na face interna.
    const areas = areasDaPerimetro('ls_d', [camada('finish1', 'mat_argamassa', 0.01), camada('substrate', 'mat_argamassa', 0.03)]);
    expect(areas[0]).toBeCloseTo(AREA_CORE, 6);
    expect(areas[1]).toBeCloseTo(AREA_CORE, 6);
  });

  it('ls_e: `passa` é término explícito e continua vencendo — a camada não é recortada (12,0 m²)', () => {
    // O `passa` retorna antes do ramo do perímetro core: substrato e estrutura ficam no contorno 4 × 3.
    const areas = areasDaPerimetro('ls_e', [camada('substrate', 'mat_argamassa', 0.02, { termino: 'passa' }), camada('structure', 'mat_concreto', 0.15)]);
    expect(areas[0]).toBeCloseTo(AREA_CORE, 6);
    expect(areas[1]).toBeCloseTo(AREA_CORE, 6);
  });

  it('associatividade: o acabamento externo engrossa e a área da laje não muda (só o perímetro de acabamento)', () => {
    // Acabamento externo de 3 cm: a face interna continua a 0,16 + 0,02 = 0,18 m do eixo, então núcleo = 12,0 e
    // camada fora do núcleo = 3,64 × 2,64 = 9,6096. O perímetro de acabamento é que muda: (4 + 0,06) × (3 + 0,06).
    const parede3: Layer[] = [camada('finish1', 'mat_argamassa', 0.03), camada('structure', 'mat_bloco14', 0.16), camada('finish1', 'mat_argamassa', 0.02)];
    const store = montarLaje(build(parede3), 'ls_b', [camada('substrate', 'mat_argamassa', 0.02), camada('structure', 'mat_concreto', 0.15)]);
    const areas = resolveSlabs(store.project, 'lv_0').find((s) => s.slabId === 's1')!.layers.map((l) => multiArea(l.polygon));
    expect(areas[0]).toBeCloseTo(AREA_FACE_INTERNA, 6);
    expect(areas[1]).toBeCloseTo(AREA_CORE, 6);
    expect(perimeterArea(store.project, undefined, 'core')).toBeCloseTo(AREA_CORE, 6);
    expect(perimeterArea(store.project, undefined, 'finish')).toBeCloseTo(4.06 * 3.06, 6);
  });
});
