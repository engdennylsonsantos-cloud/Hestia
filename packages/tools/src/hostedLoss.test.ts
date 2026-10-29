import { describe, expect, it } from 'vitest';
import { frameOfWall } from '@hestia/engine';
import { createEmptyProject, isOpening, makeWall, ProjectStore, type Id, type Project } from '@hestia/model';
import {
  endsFromCommands,
  hostedLoss,
  hostedLossMessage,
  hostedLossOfCommands,
  openingLabel,
  type EndsPatch,
} from './hostedLoss.ts';

/** Parede `h` de 0 a 6 com a porta P-02 (0,80) em 5,50 e a janela JX (1,20) em 1,50. */
function cena(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 5.5, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-02' } });
  s.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: null, mark: 'JX' } });
  return s.project;
}

const ends = (patch: EndsPatch): Map<Id, EndsPatch> => new Map([['h', patch]]);

describe('hostedLoss', () => {
  it('encurtar até a porta continuar inteira não perde nada', () => {
    expect(hostedLoss(cena(), ends({ b: { x: 5.9, y: 0 } }))).toEqual([]);
  });

  it('encurtar a parede com a porta na ponta lista a porta', () => {
    const loss = hostedLoss(cena(), ends({ b: { x: 5.5, y: 0 } }));
    expect(loss.map((l) => l.id)).toEqual(['d1']);
    expect(loss[0]!.label).toBe('P-02');
  });

  it('abertura parcialmente fora também conta', () => {
    expect(hostedLoss(cena(), ends({ b: { x: 5.6, y: 0 } })).map((l) => l.id)).toEqual(['d1']);
  });

  it('encurtar muito perde as duas aberturas', () => {
    expect(hostedLoss(cena(), ends({ b: { x: 2, y: 0 } })).map((l) => l.id)).toEqual(['d1', 'j1']);
  });

  it('translação (comprimento mantido) não perde abertura', () => {
    expect(hostedLossOfCommands(cena(), [{ type: 'transform', ids: ['h'], transform: { kind: 'translate', d: { x: 3, y: 0 } } }])).toEqual([]);
  });

  it('parede curva: encurtar o arco tira a abertura perto do fim', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'c', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, sag: 0.6 }) });
    const frame = frameOfWall(s.project, 'c')!;
    s.exec({ type: 'addOpening', opening: { id: 'd2', kind: 'door', typeId: 'ot_p80', hostId: 'c', offset: frame.length - 0.2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'PC' } });
    expect(hostedLossOfCommands(s.project, [{ type: 'setWallEnds', id: 'c', b: { x: 4, y: 0 } }]).map((l) => l.id)).toEqual(['d2']);
  });

  it('lê pontas e flecha de lotes e de updateElements', () => {
    const map = endsFromCommands([
      { type: 'batch', commands: [{ type: 'setWallEnds', id: 'h', b: { x: 5, y: 0 } }] },
      { type: 'updateElements', ids: ['h'], patch: { a: { x: 0.5, y: 0 } } },
      { type: 'updateElements', ids: ['h'], patch: { sag: 0.2 } },
    ]);
    expect(map.get('h')).toEqual({ a: { x: 0.5, y: 0 }, b: { x: 5, y: 0 }, sag: 0.2 });
  });

  it('mensagem única cita a contagem e a lista de marcas', () => {
    const loss = hostedLoss(cena(), ends({ b: { x: 2, y: 0 } }));
    expect(hostedLossMessage(loss)).toBe('Esta alteração deixa 2 elemento(s) fora da parede: P-02, JX. Eles serão excluídos. Continuar?');
  });

  it('sem marca, usa o código do tipo; sem tipo conhecido, "Porta"/"Janela"', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '  ' } });
    s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'nao-existe', hostId: 'h', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const door = s.project.elements.d;
    const window = s.project.elements.j;
    expect(door && isOpening(door) ? openingLabel(s.project, door) : '').toBe('P-02');
    expect(window && isOpening(window) ? openingLabel(s.project, window) : '').toBe('Janela');
  });
});
