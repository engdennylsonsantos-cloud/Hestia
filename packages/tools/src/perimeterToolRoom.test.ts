import { describe, expect, it } from 'vitest';
import { newDraft, addSegs } from './perimeterSession.ts';
import { roomClick, roomHover } from './perimeterToolPick.ts';
import type { Vec2 } from '@hestia/geom';
import { createEmptyProject, makeRoom, makeWall, ProjectStore } from '@hestia/model';
import type { SketchCtx } from './sketchPickFaceGeom.ts';

function house(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts: Vec2[] = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }];
  pts.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b: pts[(i + 1) % 4]! }) }));
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 4, y: 2.5 } }) });
  return s;
}

const ctx = (s: ProjectStore): SketchCtx => ({ project: () => s.project, levelId: () => 'lv_0', hiddenInView: () => new Set<string>() });

describe('Por ambiente: prévia e clique da ferramenta de perímetro', () => {
  it('a prévia mostra o contorno do ambiente com o nome; fora de ambiente, nada', () => {
    const s = house();
    const inside = roomHover(ctx(s), { x: 4, y: 2.5 });
    expect(inside.items.length).toBeGreaterThanOrEqual(4);
    expect(inside.items.at(-1)).toMatchObject({ kind: 'label', text: 'Sala' });
    expect(roomHover(ctx(s), { x: 40, y: 40 }).items).toEqual([]);
  });

  it('o clique adiciona o contorno ao rascunho, devolve o id do ambiente, e não repete as linhas', () => {
    const s = house();
    const first = roomClick(ctx(s), { x: 4, y: 2.5 }, newDraft('ceiling'));
    expect(first.roomId).toBe('r1');
    expect(first.draft.segs.length).toBeGreaterThanOrEqual(4);
    const again = roomClick(ctx(s), { x: 4, y: 2.5 }, first.draft);
    expect(again.draft.segs).toHaveLength(first.draft.segs.length);
    expect(again.say).toContain('já está');
  });

  it('clique fora de ambiente não muda o rascunho', () => {
    const s = house();
    const d = addSegs(newDraft('ceiling'), [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }]);
    const r = roomClick(ctx(s), { x: 40, y: 40 }, d);
    expect(r.draft).toBe(d);
    expect(r.roomId).toBeUndefined();
  });
});
