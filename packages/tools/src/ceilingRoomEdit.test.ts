import { describe, expect, it } from 'vitest';
import { ceilingDraftsFromRooms, ceilingOutline, resolveCeilings } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeCeiling, makeRoom, makeWall, type Ceiling } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { ceilingGripAt } from './ceilingPick.ts';
import { CEILING_DETACHED_MSG, commitCeilingBoundary } from './outlineEdit.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import type { ToolEnv } from './types.ts';

const wall = (id: string, a: Vec2, b: Vec2) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b });

/** Sala 4 × 3 com um ambiente e o forro criado a partir dele; o ambiente e o forro ficam prontos para a ferramenta. */
function salaComForro() {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addWall', wall: wall('wb', { x: 0, y: 0 }, { x: 4, y: 0 }) });
  store.exec({ type: 'addWall', wall: wall('wr', { x: 4, y: 0 }, { x: 4, y: 3 }) });
  store.exec({ type: 'addWall', wall: wall('wt', { x: 4, y: 3 }, { x: 0, y: 3 }) });
  store.exec({ type: 'addWall', wall: wall('wl', { x: 0, y: 3 }, { x: 0, y: 0 }) });
  store.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 } }) });
  const [d] = ceilingDraftsFromRooms(store.project, 'lv_0', 'ct_gesso', () => 'c1');
  store.exec({ type: 'addCeiling', ceiling: d! });
  const ctx = makeEnv(store);
  const msgs: string[] = [];
  const env: ToolEnv = { ...ctx.env, say: (m) => msgs.push(m) };
  env.setSelection(['c1']);
  return { store, env, msgs, options: ctx.options };
}

const ceilingOf = (store: ProjectStore): Ceiling => store.project.elements.c1 as Ceiling;

describe('forro que acompanha o ambiente: edição pelas alças (decisão 0023 §13, P-5)', () => {
  it('a alça de vértice cai no contorno do ambiente (o efetivo), não no gravado', () => {
    const { store, env } = salaComForro();
    const v = ceilingOutline(store.project, ceilingOf(store)).boundary[0]!;
    const g = ceilingGripAt(store.project, ['c1'], v, 0.01);
    expect(g).toMatchObject({ ceilingId: 'c1', kind: 'vertex', index: 0 });
    expect(env.selection()).toEqual(['c1']);
  });

  it('editar um vértice solta o forro do ambiente no mesmo passo de desfazer, e avisa', () => {
    const { store, env, msgs } = salaComForro();
    const before = ceilingOutline(store.project, ceilingOf(store)).boundary;
    const ring = before.map((q, i) => (i === 0 ? { x: q.x + 0.2, y: q.y } : q));
    commitCeilingBoundary(env, 'c1', ring);
    expect(ceilingOf(store).roomLinked).toBe(false);
    expect(ceilingOf(store).roomId).toBe('r1');
    expect(ceilingOf(store).boundary).toEqual(ring);
    expect(msgs).toEqual([CEILING_DETACHED_MSG]);
    store.undo();
    expect(ceilingOf(store).roomLinked).toBeUndefined();
    expect(ceilingOf(store).boundary).toEqual(before);
  });

  it('forro solto que foi editado mantém o contorno editado mesmo quando o ambiente muda', () => {
    const { store, env } = salaComForro();
    const ring = [{ x: 0.5, y: 0.5 }, { x: 3, y: 0.5 }, { x: 3, y: 2.5 }];
    commitCeilingBoundary(env, 'c1', ring);
    store.exec({ type: 'updateElements', ids: ['wr'], patch: { a: { x: 5, y: 0 }, b: { x: 5, y: 3 } } });
    expect(resolveCeilings(store.project, 'lv_0').find((r) => r.ceilingId === 'c1')!.problem).toBeNull();
    expect(ceilingOutline(store.project, ceilingOf(store)).boundary).toEqual(ring);
  });

  it('furo num forro que acompanha o ambiente solta o forro e grava o furo, num só desfazer', () => {
    const { store, env, options } = salaComForro();
    options.ceilingMode = 'hole';
    const h = tool('ceiling', env);
    clickAt(h, 1, 1);
    clickAt(h, 2, 1);
    clickAt(h, 2, 2);
    clickAt(h, 1, 2);
    clickAt(h, 1, 1);
    expect(ceilingOf(store).roomLinked).toBe(false);
    expect(ceilingOf(store).holes).toHaveLength(1);
    store.undo();
    expect(ceilingOf(store).roomLinked).toBeUndefined();
    expect(ceilingOf(store).holes).toHaveLength(0);
  });

  it('forro desenhado à mão, sem ambiente, edita sem soltar nem avisar', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c2', typeId: 'ct_gesso', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] }) });
    const ctx = makeEnv(store);
    const msgs: string[] = [];
    const env: ToolEnv = { ...ctx.env, say: (m) => msgs.push(m) };
    commitCeilingBoundary(env, 'c2', [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }]);
    expect((store.project.elements.c2 as Ceiling).boundary[1]).toEqual({ x: 3, y: 0 });
    expect(msgs).toEqual([]);
  });
});
