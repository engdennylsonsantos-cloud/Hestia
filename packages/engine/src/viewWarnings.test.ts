import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_RANGE, ProjectStore, createEmptyProject, makeFloor, makeRoof, makeWall, type Opening, type Project, type ViewRange } from '@hestia/model';
import { viewRangeWarnings } from './viewWarnings.ts';

const R = DEFAULT_VIEW_RANGE;
const DEEP: ViewRange = { top: 2.3, cut: 1.2, bottom: 0, depth: -1, direction: 'down' };

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

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

describe('viewRangeWarnings', () => {
  it('projeto dentro do intervalo não gera aviso', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addWall', wall: wall('w2', { height: 0.9, a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
      s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3) }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', R)).toEqual([]);
  });

  it('janela com peitoril 2,40 gera aviso de abertura oculta, no singular', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 2.4 }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', R)).toEqual([
      { category: 'opening', kind: 'hidden', count: 1, ids: ['j1'], message: '1 abertura fora do intervalo de vista.' },
    ]);
  });

  it('paredes acima do topo: contagem e plural em pt-BR', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: 2.5, height: 1 }) });
      s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1, a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', R)).toEqual([
      { category: 'wall', kind: 'hidden', count: 2, ids: ['w1', 'w2'], message: '2 paredes fora do intervalo de vista.' },
    ]);
  });

  it('parede abaixo da base dentro da profundidade gera aviso "além" (beyond)', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: -0.5, height: 0.3 }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', DEEP)).toEqual([
      { category: 'wall', kind: 'beyond', count: 1, ids: ['w1'], message: '1 parede abaixo da base do intervalo de vista.' },
    ]);
  });

  it('telhado acima do topo também avisa (quem decide mostrar é a interface)', () => {
    const p = project((s) => {
      s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3 }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', R)).toEqual([
      { category: 'roof', kind: 'hidden', count: 1, ids: ['r1'], message: '1 telhado fora do intervalo de vista.' },
    ]);
  });

  it('pisos nunca avisam, mesmo bem abaixo da base', () => {
    const p = project((s) => {
      s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 3, 3), heightOffset: -5 }) });
    });
    expect(viewRangeWarnings(p, 'lv_0', R)).toEqual([]);
  });

  it('um aviso por categoria e estado, na ordem parede, abertura, piso, laje, telhado, escada, com ids ordenados', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w3', { baseOffset: 2.5, height: 1, a: { x: 0, y: 6 }, b: { x: 3, y: 6 } }) });
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: 2.5, height: 1 }) });
      s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1, a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
      s.exec({ type: 'addWall', wall: wall('wb', { baseOffset: -0.5, height: 0.3, a: { x: 0, y: 9 }, b: { x: 3, y: 9 } }) });
      // Base da parede em -0,50 m: peitoril 3,00 m põe o vão em 2,50 m, acima do topo (2,30 m).
      s.exec({ type: 'addOpening', opening: opening('jz', 'wb', 'ot_j120', 'window', { sillOverride: 3 }) });
    });
    const out = viewRangeWarnings(p, 'lv_0', DEEP);
    expect(out.map((w) => [w.category, w.kind, w.ids])).toEqual([
      ['wall', 'hidden', ['w1', 'w2', 'w3']],
      ['wall', 'beyond', ['wb']],
      ['opening', 'hidden', ['jz']],
    ]);
  });

  it('determinismo: a ordem de criação não muda os avisos', () => {
    const forward = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: 2.5, height: 1 }) });
      s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1, a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
    });
    const reversed = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w2', { baseOffset: 2.5, height: 1, a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
      s.exec({ type: 'addWall', wall: wall('w1', { baseOffset: 2.5, height: 1 }) });
    });
    expect(viewRangeWarnings(reversed, 'lv_0', R)).toEqual(viewRangeWarnings(forward, 'lv_0', R));
  });
});
