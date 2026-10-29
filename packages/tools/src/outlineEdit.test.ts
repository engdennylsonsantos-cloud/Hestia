import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { type Floor } from '@hestia/model';
import { OUTLINE_LOCKED_MSG, commitOutlineBoundary } from './outlineEdit.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Paredes de um retângulo w × h (eixo nas bordas), desenhadas pela ferramenta Parede (forma retângulo). */
function rectHouse(w: number, h: number) {
  const ctx = makeEnv();
  ctx.options.wallShape = 'rect';
  const wt = tool('wall', ctx.env);
  clickAt(wt, 0, 0);
  clickAt(wt, w, h);
  ctx.options.wallShape = 'line';
  return ctx;
}

describe('contorno travado nas paredes (decisão 0031)', () => {
  it('editar contorno vinculado é recusado: nada muda e o vínculo continua', () => {
    const ctx = rectHouse(4, 3);
    const id = 'f1';
    ctx.store.exec({ type: 'addFloor', floor: { id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }], holes: [], heightOffset: 0, mark: '', comments: '', outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } } });
    const ring: Vec2[] = [{ x: 0.2, y: 0.2 }, { x: 3.8, y: 0.2 }, { x: 3.8, y: 2.8 }, { x: 0.2, y: 2.8 }];
    expect(commitOutlineBoundary(ctx.env, id, ring)).toBe(false);
    const f = ctx.store.project.elements[id] as Floor;
    expect(f.outlineSource!.linked).toBe(true);
    expect(f.boundary[0]).toEqual({ x: 0.1, y: 0.1 });
  });

  it('depois de Desvincular, a mesma edição grava o contorno', () => {
    const ctx = rectHouse(4, 3);
    const id = 'f1';
    ctx.store.exec({ type: 'addFloor', floor: { id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }], holes: [], heightOffset: 0, mark: '', comments: '', outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } } });
    ctx.store.exec({ type: 'detachOutline', id });
    const ring: Vec2[] = [{ x: 0.2, y: 0.2 }, { x: 3.8, y: 0.2 }, { x: 3.8, y: 2.8 }, { x: 0.2, y: 2.8 }];
    expect(commitOutlineBoundary(ctx.env, id, ring)).toBe(true);
    const f = ctx.store.project.elements[id] as Floor;
    expect(f.outlineSource!.linked).toBe(false);
    expect(multiArea([[f.boundary]])).toBeCloseTo(3.6 * 2.6, 6);
  });

  it('a barra de status pede Desvincular ao recusar a edição', () => {
    const ctx = rectHouse(4, 3);
    ctx.store.exec({ type: 'addFloor', floor: { id: 'f1', kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }], holes: [], heightOffset: 0, mark: '', comments: '', outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } } });
    const said: string[] = [];
    ctx.env.say = (m: string) => said.push(m);
    commitOutlineBoundary(ctx.env, 'f1', [{ x: 0.2, y: 0.2 }, { x: 3.8, y: 0.2 }, { x: 3.8, y: 2.8 }]);
    expect(said).toEqual([OUTLINE_LOCKED_MSG]);
    expect(OUTLINE_LOCKED_MSG).toContain('Desvincular');
  });

  it('contorno sem vínculo só troca o boundary (sem detachOutline)', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addFloor', floor: { id: 'f1', kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], holes: [], heightOffset: 0, mark: '', comments: '' } });
    const ring: Vec2[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }];
    commitOutlineBoundary(ctx.env, 'f1', ring);
    expect((ctx.store.project.elements.f1 as Floor).outlineSource).toBeUndefined();
    expect((ctx.store.project.elements.f1 as Floor).boundary).toEqual(ring);
  });
});
