import { describe, expect, it } from 'vitest';
import { pointInMulti, type Vec2 } from '@hestia/geom';
import { ProjectStore, buildTemplate, createEmptyProject, makeWall, validateProject, wallsOnLevel, type JoinKind } from '@hestia/model';
import { resolveLevel } from './index.ts';

/** Ponto dentro da ponta que o encosto deixava exposta: o núcleo da parede que passa chega à face externa da outra. */
const CAP: Vec2 = { x: -0.05, y: -0.118 };

describe('quinas externas (decisão 0009)', () => {
  it('a casa padrão tem as quatro quinas externas em esquadria e nenhum aviso de encosto', () => {
    const p = buildTemplate('house2');
    const corners = wallsOnLevel(p, 'lv_0').filter((w) => ['h_w', 'h_n', 'h_e', 'h_s'].includes(w.id));
    for (const w of corners) expect([w.joinStart.kind, w.joinEnd.kind].includes('miter'), w.id).toBe(true);
    expect(validateProject(p).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
  });

  it('a quina externa da casa padrão não deixa o núcleo da parede que passa na face externa', () => {
    const p = buildTemplate('house2');
    const r = resolveLevel(p, 'lv_0', new Map());
    const bloco = r.walls['h_w']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(pointInMulti(CAP, bloco.cut)).toBe(false);
  });

  it('o mesmo canto em encosto deixa o núcleo aparecer (o caso que motivou a correção)', () => {
    const p = buildTemplate('house2');
    const butt: JoinKind = 'butt';
    const hw = { ...p.elements['h_w']!, joinStart: { kind: butt, flip: false }, joinEnd: { kind: butt, flip: false } } as typeof p.elements['h_w'];
    const hs = { ...p.elements['h_s']!, joinStart: { kind: butt, flip: false }, joinEnd: { kind: butt, flip: false } } as typeof p.elements['h_s'];
    const q = { ...p, elements: { ...p.elements, h_w: hw, h_s: hs } };
    const r = resolveLevel(q, 'lv_0', new Map());
    const bloco = r.walls['h_w']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(pointInMulti(CAP, bloco.cut)).toBe(true);
  });

  it('aviso de quina em encosto: 90° com acabamento sim, T e paredes colineares não', () => {
    const s = new ProjectStore(createEmptyProject());
    const W = (id: string, a: [number, number], b: [number, number]) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } });
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    expect(validateProject(s.project).filter((i) => i.code === 'wall-corner-butt-finish')).toHaveLength(1);
    const t = new ProjectStore(createEmptyProject());
    t.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    t.exec({ type: 'addWall', wall: W('c', [2, 0], [2, 3]) });
    expect(validateProject(t.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
    const c = new ProjectStore(createEmptyProject());
    c.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    c.exec({ type: 'addWall', wall: W('d', [4, 0], [8, 0]) });
    expect(validateProject(c.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
  });
});
