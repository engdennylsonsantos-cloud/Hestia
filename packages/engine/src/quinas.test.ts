import { describe, expect, it } from 'vitest';
import { intersection, multiArea, pointInMulti, type Vec2 } from '@hestia/geom';
import { ProjectStore, buildTemplate, createEmptyProject, makeWall, validateProject, wallType, wallsOnLevel, type JoinKind, type Wall } from '@hestia/model';
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

  it('L em esquadria entre parede de 19 cm e de 14 cm: o acabamento da fina para na face da grossa', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'g', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'f', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 } }) });
    const p = s.project;
    const miter: JoinKind = 'miter';
    const q = {
      ...p,
      elements: {
        ...p.elements,
        g: { ...p.elements['g']!, joinEnd: { kind: miter, flip: false } },
        f: { ...p.elements['f']!, joinStart: { kind: miter, flip: false } },
      },
    } as typeof p;
    const r = resolveLevel(q, 'lv_0', new Map());
    const acabamentos = (id: string) => {
      const t = wallType(q, q.elements[id] as Wall);
      return r.walls[id]!.layers.filter((l) => l.layerIndex < 0 || ['finish1', 'finish2'].includes(t.layers[l.layerIndex]!.function));
    };
    const fina = acabamentos('f');
    const grossa = acabamentos('g');
    expect(fina.length).toBeGreaterThan(0);
    expect(grossa.length).toBeGreaterThan(0);
    for (const a of fina) {
      for (const b of grossa) {
        expect(multiArea(intersection(a.cut, b.cut)), `${a.materialId} x ${b.materialId}`).toBeLessThan(1e-6);
      }
    }
  });
});
