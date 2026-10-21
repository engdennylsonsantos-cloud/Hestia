import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_RANGE, ProjectStore, createEmptyProject, makeWall, type Opening, type Project } from '@hestia/model';
import { openingsCrossingCut } from './planWallCuts.ts';

const R = DEFAULT_VIEW_RANGE;

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

describe('openingsCrossingCut · aberturas que furam a parede na planta', () => {
  it('janela baixa (peitoril 0,90, altura 1,20) e porta furam; peitoril acima do corte e verga abaixo dele não furam', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addWall', wall: wall('w2', { a: { x: 0, y: 3 }, b: { x: 3, y: 3 } }) });
      s.exec({ type: 'addOpening', opening: opening('janela_baixa', 'w1', 'ot_j120', 'window', { sillOverride: 0.9, offset: 1.5 }) });
      s.exec({ type: 'addOpening', opening: opening('porta', 'w1', 'ot_p80', 'door', { offset: 0.45 }) });
      s.exec({ type: 'addOpening', opening: opening('janela_alta', 'w2', 'ot_j120', 'window', { sillOverride: 1.5, offset: 1.5 }) });
    });
    expect([...openingsCrossingCut(p, 'lv_0', R)].sort()).toEqual(['janela_baixa', 'porta']);
  });

  it('verga abaixo do corte (vão entre 0,10 e 0,70 m) não fura a parede', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('basculante', 'w1', 'ot_j60', 'window', { sillOverride: 0.1 }) });
    });
    expect(openingsCrossingCut(p, 'lv_0', R).size).toBe(0);
  });

  it('abertura acima do topo também não fura (está oculta)', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('j1', 'w1', 'ot_j120', 'window', { sillOverride: 2.4, offset: 1.0 }) });
    });
    expect(openingsCrossingCut(p, 'lv_0', R).size).toBe(0);
  });

  it('abertura de parede de outro nível não entra', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w9', { levelId: 'lv_1' }) });
      s.exec({ type: 'addOpening', opening: opening('p9', 'w9', 'ot_p80', 'door') });
    });
    expect(openingsCrossingCut(p, 'lv_0', R).size).toBe(0);
    expect(openingsCrossingCut(p, 'lv_1', R)).toEqual(new Set(['p9']));
  });

  it('não altera o projeto', () => {
    const p = project((s) => {
      s.exec({ type: 'addWall', wall: wall('w1') });
      s.exec({ type: 'addOpening', opening: opening('porta', 'w1', 'ot_p80', 'door') });
    });
    const before = JSON.stringify(p);
    openingsCrossingCut(p, 'lv_0', R);
    expect(JSON.stringify(p)).toBe(before);
  });
});
