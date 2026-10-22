import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeCeiling, makeRoom, makeWall, type Ceiling } from '@hestia/model';
import { ceilingDraftsFromRooms } from '@hestia/engine';
import { ceilingOutlineView, detachCeilingOutlines, relinkCeilingOutlines } from './CeilingOutlineGroup.tsx';

const sala = (): ProjectStore => {
  const s = new ProjectStore(createEmptyProject());
  const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  pts.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b: pts[(i + 1) % 4]! }) }));
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 } }) });
  const [d] = ceilingDraftsFromRooms(s.project, 'lv_0', 'ct_gesso', () => 'c1');
  s.exec({ type: 'addCeiling', ceiling: d! });
  return s;
};

const ceilingOf = (s: ProjectStore): Ceiling => s.project.elements.c1 as Ceiling;

describe('grupo Contorno do forro (decisão 0023 §13, P-5)', () => {
  it('forro no ambiente: diz que acompanha o ambiente e pode ser solto', () => {
    const s = sala();
    const v = ceilingOutlineView(s.project, [ceilingOf(s)]);
    expect(v.text).toBe('Acompanha o ambiente «101»');
    expect(v.detachIds).toEqual(['c1']);
    expect(v.relinkIds).toEqual([]);
  });

  it('ambiente apagado ou aberto: aviso com o último contorno', () => {
    const s = sala();
    s.exec({ type: 'deleteElements', ids: ['r1'] });
    expect(ceilingOutlineView(s.project, [ceilingOf(s)]).text).toBe('Ambiente apagado: mantém o último contorno');
  });

  it('forro desenhado à mão não tem ações; solto tem Revincular', () => {
    const s = sala();
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c2', typeId: 'ct_gesso', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }) });
    const hand = ceilingOutlineView(s.project, [s.project.elements.c2 as Ceiling]);
    expect(hand).toEqual({ text: 'Sem ambiente (desenhado à mão)', detachIds: [], relinkIds: [] });
    detachCeilingOutlines(s, ['c1']);
    const solto = ceilingOutlineView(s.project, [ceilingOf(s)]);
    expect(solto.text).toBe('Estático (editado à mão)');
    expect(solto.relinkIds).toEqual(['c1']);
  });

  it('soltar congela o contorno visível e é um só desfazer', () => {
    const s = sala();
    const before = ceilingOf(s).boundary;
    detachCeilingOutlines(s, ['c1']);
    expect(ceilingOf(s)).toMatchObject({ roomLinked: false, boundary: before });
    s.undo();
    expect(ceilingOf(s).roomLinked).toBeUndefined();
  });

  it('revincular volta ao ambiente de origem; sem ambiente que sirva, avisa e não muda', () => {
    const s = sala();
    detachCeilingOutlines(s, ['c1']);
    expect(relinkCeilingOutlines(s, ['c1'])).toBe(1);
    expect(ceilingOf(s)).toMatchObject({ roomId: 'r1', roomLinked: true });
    detachCeilingOutlines(s, ['c1']);
    s.exec({ type: 'deleteElements', ids: ['r1', 'w0', 'w1', 'w2', 'w3'] });
    expect(relinkCeilingOutlines(s, ['c1'])).toBe(0);
    expect(ceilingOf(s).roomLinked).toBe(false);
  });
});
