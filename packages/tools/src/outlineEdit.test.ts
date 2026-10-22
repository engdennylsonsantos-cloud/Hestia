import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { floorsOnLevel, type Floor } from '@hestia/model';
import { commitOutlineBoundary } from './outlineEdit.ts';
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

const floor = (store: ReturnType<typeof makeEnv>['store']): Floor | undefined => floorsOnLevel(store.project, 'lv_0')[0];

describe('ferramentas gravam a origem do contorno (decisão 0023 §8.2a)', () => {
  it('Piso por paredes (face de acabamento) grava walls-finish com a semente', () => {
    const ctx = rectHouse(4, 3);
    ctx.options.floorMode = 'walls';
    const f = tool('floor', ctx.env);
    clickAt(f, 2, 1.5);
    expect(floor(ctx.store)!.outlineSource).toEqual({ mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true });
  });

  it('Piso por paredes + Estender até o núcleo grava walls-core', () => {
    const ctx = rectHouse(4, 3);
    ctx.options.floorMode = 'walls';
    ctx.options.floorCore = true;
    const f = tool('floor', ctx.env);
    clickAt(f, 2, 1.5);
    expect(floor(ctx.store)!.outlineSource).toMatchObject({ mode: 'walls-core', linked: true });
  });

  it('Piso por paredes + Tab grava perímetro externo', () => {
    const ctx = rectHouse(4, 3);
    ctx.options.floorMode = 'walls';
    const f = tool('floor', ctx.env);
    f.move({ raw: { x: 2, y: 1.5 }, shift: false, ctrl: false, alt: false });
    f.tab();
    clickAt(f, 2, 1.5);
    expect(floor(ctx.store)!.outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
  });

  it('Piso por perímetro grava perímetro externo', () => {
    const ctx = rectHouse(6, 4);
    ctx.options.floorMode = 'perimetro';
    const f = tool('floor', ctx.env);
    clickAt(f, 6, 2);
    expect(floor(ctx.store)!.outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
  });

  it('Laje por perímetro grava a origem', () => {
    const ctx = rectHouse(6, 4);
    ctx.options.slabMode = 'perimetro';
    const s = tool('slab', ctx.env);
    clickAt(s, 6, 2);
    const slab = Object.values(ctx.store.project.elements).find((e) => e.kind === 'slab');
    expect(slab).toBeDefined();
    expect((slab as { outlineSource?: unknown }).outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
  });
});

describe('alças de vértice soltam o vínculo (decisão 0023 §8.2b)', () => {
  it('commitOutlineBoundary solta o vínculo e troca o contorno num único passo de desfazer', () => {
    const ctx = rectHouse(4, 3);
    const id = 'f1';
    ctx.store.exec({ type: 'addFloor', floor: { id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 0.1, y: 2.9 }], holes: [], heightOffset: 0, mark: '', comments: '', outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } } });
    const ring: Vec2[] = [{ x: 0.2, y: 0.2 }, { x: 3.8, y: 0.2 }, { x: 3.8, y: 2.8 }, { x: 0.2, y: 2.8 }];
    commitOutlineBoundary(ctx.env, id, ring);
    const f = ctx.store.project.elements[id] as Floor;
    expect(f.outlineSource!.linked).toBe(false);
    expect(multiArea([[f.boundary]])).toBeCloseTo(3.6 * 2.6, 6);
    ctx.store.undo();
    const back = ctx.store.project.elements[id] as Floor;
    expect(back.outlineSource!.linked).toBe(true);
    expect(back.boundary[0]).toEqual({ x: 0.1, y: 0.1 });
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
