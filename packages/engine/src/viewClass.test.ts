import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW_RANGE,
  ProjectStore,
  createEmptyProject,
  makeFloor,
  makeRoof,
  makeSlab,
  makeStair,
  makeWall,
  type Opening,
  type Project,
  type ViewRange,
} from '@hestia/model';
import { classifyLevelEntries, classifyLevelForView, elementZRange, viewClassOf, viewContextOf } from './viewClass.ts';

const R = DEFAULT_VIEW_RANGE;
/** Intervalo com base e profundidade abaixo do nível: deixa aparecer o estado "além". */
const DEEP: ViewRange = { top: 2.3, cut: 1.2, bottom: 0, depth: -1, direction: 'down' };

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Projeto montado pelos comandos, como na aplicação. */
function project(build: (s: ProjectStore) => void): Project {
  const s = new ProjectStore(createEmptyProject());
  build(s);
  return s.project;
}

const wall = (id: string, extra: Partial<Parameters<typeof makeWall>[0]> = {}) =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, height: 2.8, ...extra });

const opening = (id: string, hostId: string, typeId: string, kind: 'door' | 'window', extra: Partial<Opening> = {}): Opening => ({
  id,
  kind,
  typeId,
  hostId,
  offset: 1.5,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
  ...extra,
});

describe('viewClassOf · os cinco estados (intervalo padrão, nível em 0)', () => {
  it.each([
    ['corta o plano de corte', 0.9, 2.1, 'cut'],
    ['entre o corte e o topo', 1.5, 2.7, 'projection-above'],
    ['abaixo do corte, acima da base', -0.3, 0.9, 'projection-below'],
    ['acima do topo', 2.4, 3.4, 'hidden'],
    ['abaixo da base e da profundidade (base = profundidade)', -0.5, -0.2, 'hidden'],
  ] as const)('%s', (_, z0, z1, cls) => {
    expect(viewClassOf(R, 0, z0, z1)).toBe(cls);
  });

  it('estado "além" só existe com profundidade abaixo da base', () => {
    expect(viewClassOf(DEEP, 0, -0.5, -0.2)).toBe('beyond');
    expect(viewClassOf(R, 0, -0.5, -0.2)).toBe('hidden');
  });

  it('bordas exatas: corte, topo e base contam como dentro', () => {
    expect(viewClassOf(R, 0, 0, 1.2)).toBe('cut'); // z1 = corte
    expect(viewClassOf(R, 0, 1.2, 2.0)).toBe('cut'); // z0 = corte
    expect(viewClassOf(R, 0, 1.3, 2.3)).toBe('projection-above'); // z1 = topo: visível
    expect(viewClassOf(R, 0, -0.3, 0)).toBe('projection-below'); // z1 = base: visível
    expect(viewClassOf(DEEP, 0, -1.5, -1)).toBe('beyond'); // z1 = profundidade
  });

  it('bordas exatas: o que passa só um pouco do limite fica de fora', () => {
    expect(viewClassOf(R, 0, 2.3 + 1e-6, 3)).toBe('hidden'); // base acima do topo
    expect(viewClassOf(R, 0, -0.3, -1e-6)).toBe('hidden'); // z1 abaixo da profundidade (0)
    expect(viewClassOf(DEEP, 0, -1.5, -1 - 1e-6)).toBe('hidden');
  });

  it('elemento que começa abaixo do topo e passa dele continua visível (cortado no topo, como o Revit)', () => {
    expect(viewClassOf(R, 0, 1.3, 2.3 + 1e-6)).toBe('projection-above');
    expect(viewClassOf(R, 0, 1.3, 3.5)).toBe('projection-above');
  });

  it('tolerância de 1e-9: cotas que diferem só por ruído de ponto flutuante', () => {
    expect(viewClassOf(R, 0, 0, 1.2 - 1e-12)).toBe('cut');
    expect(viewClassOf(R, 0, 1.2 + 1e-12, 2)).toBe('cut');
    expect(viewClassOf(R, 0, 2.3 + 1e-12, 3)).toBe('projection-above');
  });

  it('a cota do nível desloca o intervalo inteiro', () => {
    expect(viewClassOf(R, 3, 3.9, 5.1)).toBe('cut');
    expect(viewClassOf(R, 3, 0, 1)).toBe('hidden');
    expect(viewClassOf(R, 3, 2.9, 3.9)).toBe('projection-below'); // corte absoluto em 4,20
    expect(viewClassOf(R, 3, 4.3, 5.0)).toBe('projection-above');
  });

  it('intervalo personalizado: corte e topo mudam a classe', () => {
    const custom: ViewRange = { top: 2.0, cut: 1.0, bottom: 0, depth: 0, direction: 'down' };
    expect(viewClassOf(custom, 0, 0.9, 2.1)).toBe('cut');
    expect(viewClassOf(custom, 0, 1.5, 2.1)).toBe('projection-above');
    expect(viewClassOf(custom, 0, 2.1, 2.5)).toBe('hidden');
  });

  it('extendBelow (piso, laje, escada): abaixo da base nunca fica oculto nem "além"', () => {
    expect(viewClassOf(R, 0, -5, -4)).toBe('hidden');
    expect(viewClassOf(R, 0, -5, -4, { extendBelow: true })).toBe('projection-below');
    expect(viewClassOf(DEEP, 0, -5, -4, { extendBelow: true })).toBe('projection-below');
    // Acima do topo continua oculto mesmo com extendBelow.
    expect(viewClassOf(R, 0, 2.5, 3, { extendBelow: true })).toBe('hidden');
  });
});

describe('elementZRange e classificação por categoria (valores do modelo)', () => {
  it('janela com peitoril 0,90 e altura 1,20 corta o plano de corte', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 0.9 }) });
    });
    expect(elementZRange(p, p.elements.j1!)).toEqual({ z0: 0.9, z1: 0.9 + 1.2 });
    expect(classifyLevelForView(p, 'lv_0', R).get('j1')).toBe('cut');
  });

  it('janela com peitoril 1,50 fica acima do corte (tracejada)', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 1.5 }) });
    });
    expect(classifyLevelForView(p, 'lv_0', R).get('j1')).toBe('projection-above');
  });

  it('janela com peitoril 2,40 fica oculta, com topo em 2,30', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 2.4 }) });
    });
    expect(R.top).toBe(2.3);
    expect(classifyLevelForView(p, 'lv_0', R).get('j1')).toBe('hidden');
  });

  it('porta (peitoril 0, altura 2,10) corta o plano de corte', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('p1', 'w1', 'ot_p80', 'door') });
    });
    expect(elementZRange(p, p.elements.p1!)).toEqual({ z0: 0, z1: 2.1 });
    expect(classifyLevelForView(p, 'lv_0', R).get('p1')).toBe('cut');
  });

  it('parede de 0,90 m fica abaixo do corte (1,20), não cortada', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1', { height: 0.9 }) });
    });
    expect(elementZRange(p, p.elements.w1!)).toEqual({ z0: 0, z1: 0.9 });
    expect(classifyLevelForView(p, 'lv_0', R).get('w1')).toBe('projection-below');
  });

  it('parede de 2,80 m corta o plano de corte', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
    });
    expect(classifyLevelForView(p, 'lv_0', R).get('w1')).toBe('cut');
  });

  it('parede com base em 2,50 (acima do topo) fica oculta', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: 2.5, height: 1 }) });
    });
    expect(classifyLevelForView(p, 'lv_0', R).get('w1')).toBe('hidden');
  });

  it('piso do nível fica abaixo do corte e nunca oculto, mesmo bem abaixo da base', () => {
    const p = project((s) => {
      s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3) }) });
      s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f2', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3), heightOffset: -5 }) });
    });
    // Piso ceramico: 0,01 + 0,02 + 0,04 + 0,12 = 0,19 m de espessura, topo na cota do nível.
    expect(elementZRange(p, p.elements.f1!)!.z0).toBeCloseTo(-0.19, 9);
    expect(elementZRange(p, p.elements.f1!)!.z1).toBeCloseTo(0, 9);
    const m = classifyLevelForView(p, 'lv_0', R);
    expect(m.get('f1')).toBe('projection-below');
    expect(m.get('f2')).toBe('projection-below');
  });

  it('laje do próprio nível acima do topo fica oculta', () => {
    const p = project((s) => {
      s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 3, 3), heightOffset: 2.5 }) });
    });
    expect(classifyLevelForView(p, 'lv_0', R).get('l1')).toBe('hidden');
  });

  it('laje do nível acima fica oculta quando vista pelo nível de baixo', () => {
    const p = project((s) => {
      s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(0, 0, 3, 3) }) });
    });
    // Laje do pavimento 2 (cota 3 m): face inferior 2,88 m, acima do topo do térreo (2,30 m).
    expect(viewClassOf(R, 0, elementZRange(p, p.elements.l1!)!.z0, elementZRange(p, p.elements.l1!)!.z1, { extendBelow: true })).toBe('hidden');
  });

  it('telhado com beiral em 0,50 corta o plano de corte (cumeeira em 1,40)', () => {
    const p = project((s) => {
      s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 0.5 }) });
    });
    const z = elementZRange(p, p.elements.r1!)!;
    // Beiral em 0,50 m; cumeeira a 0,30 × 3 m acima dele = 1,40 m; face inferior 0,095 m abaixo do beiral.
    expect(z.z0).toBeCloseTo(0.405, 6);
    expect(z.z1).toBeCloseTo(1.4, 6);
    expect(classifyLevelForView(p, 'lv_0', R).get('r1')).toBe('cut');
  });

  it('telhado com beiral em 3,00 m fica oculto (face inferior acima do topo)', () => {
    const p = project((s) => {
      s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3 }) });
    });
    expect(elementZRange(p, p.elements.r1!)!.z0).toBeCloseTo(3 - 0.095, 6);
    expect(classifyLevelForView(p, 'lv_0', R).get('r1')).toBe('hidden');
  });

  it('escada do térreo para o pavimento 2 corta o plano de corte e nunca fica oculta por baixo', () => {
    const p = project((s) => {
      s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
    });
    expect(elementZRange(p, p.elements.st1!)).toEqual({ z0: 0, z1: 3 });
    expect(classifyLevelForView(p, 'lv_0', R).get('st1')).toBe('cut');
  });

  it('escada que começa acima do topo fica oculta', () => {
    const p = project((s) => {
      s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', baseOffset: 2.5 }) });
    });
    expect(classifyLevelForView(p, 'lv_0', R).get('st1')).toBe('hidden');
  });

  it('parede com topo anexado ao telhado: a faixa vai até a face inferior do telhado', () => {
    // Beiral em 3 m: a parede sob o beiral (y = 0) tem topo na face inferior, 3 − 0,095 = 2,905 m.
    const p = project((s) => {
      s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3 }) });
      s.exec({ type: 'addWall', wall: wall('w1', { attachTopToRoof: true, a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3 }) });
    });
    expect(elementZRange(p, p.elements.w1!)!.z1).toBeCloseTo(3 - 0.095, 6);
  });

  it('abertura cujo host não é parede ou cujo tipo não existe não tem faixa', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
    });
    const orphan = opening('j9', 'w1', 'ot_nao_existe', 'window');
    expect(elementZRange(p, orphan)).toBeNull();
  });
});

describe('classifyLevelForView · o nível inteiro', () => {
  it('classifica paredes, aberturas, pisos, lajes, telhados e escadas do nível, e só dele', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1 }) });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 0.9 }) });
      s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3) }) });
      s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 3, 3), heightOffset: 2.5 }) });
      s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
      s.exec({ type: 'addWall', wall: wall('w9', { levelId: 'lv_1' }) });
    });
    const m = classifyLevelForView(p, 'lv_0', R);
    expect([...m.entries()].sort()).toEqual([
      ['f1', 'projection-below'],
      ['j1', 'cut'],
      ['l1', 'hidden'],
      ['st1', 'cut'],
      ['w1', 'cut'],
      ['w2', 'hidden'],
    ]);
  });

  it('o contexto pré-resolvido dá o mesmo resultado que o padrão', () => {
    const p = project((s) => {
      s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3 }) });
      s.exec({ type: 'addWall', wall: wall('w1', { attachTopToRoof: true, a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3 }) });
    });
    const ctx = viewContextOf(p);
    expect(classifyLevelEntries(p, 'lv_0', R, ctx)).toEqual(classifyLevelEntries(p, 'lv_0', R));
    expect(elementZRange(p, p.elements.w1!, ctx)).toEqual(elementZRange(p, p.elements.w1!));
  });

  it('determinismo: a ordem de criação dos elementos não muda o resultado', () => {
    const walls: Array<(s: ProjectStore) => void> = [
      (s) => s.exec({ type: 'addWall', wall: wall('w1') }),
      (s) => s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1 }) }),
      (s) => s.exec({ type: 'addWall', wall: wall('w3', { a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) }),
    ];
    // Aberturas e piso dependem das paredes, então vêm depois; só a ordem entre itens do mesmo grupo muda.
    const rest: Array<(s: ProjectStore) => void> = [
      (s) => s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 2.4 }) }),
      (s) => s.exec({ type: 'addOpening', opening: opening('p1', 'w3', 'ot_p80', 'door') }),
      (s) => s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3) }) }),
    ];
    const forward = project((s) => [...walls, ...rest].forEach((f) => f(s)));
    const reversed = project((s) => [...[...walls].reverse(), ...[...rest].reverse()].forEach((f) => f(s)));
    const a = [...classifyLevelForView(forward, 'lv_0', R).entries()];
    const b = [...classifyLevelForView(reversed, 'lv_0', R).entries()];
    expect(a.sort()).toEqual(b.sort());
    // O mapa sai em ordem de id, não de inserção.
    expect([...classifyLevelForView(reversed, 'lv_0', R).keys()]).toEqual([...classifyLevelForView(forward, 'lv_0', R).keys()]);
    expect([...classifyLevelForView(forward, 'lv_0', R).keys()]).toEqual(['f1', 'j1', 'p1', 'w1', 'w2', 'w3']);
  });
});
