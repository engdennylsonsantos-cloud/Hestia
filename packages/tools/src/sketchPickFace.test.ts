import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcPointAt, dist, type SketchSeg, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeCeiling, makeFloor, makeSlab, makeWall } from '@hestia/model';
import { faceAt, faceCandidates, faceSegments } from './sketchPickFace.ts';
import type { SketchCtx } from './sketchPickFaceGeom.ts';

const wall = (id: string, a: Vec2, b: Vec2, sag = 0) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, sag });

/** Parede reta (0,0)→(6,0), parede curva (0,0)→(0,4) com flecha 1 m para a esquerda, e um piso, laje e forro longe. */
function scene(hidden: string[] = []) {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addWall', wall: wall('w_reta', { x: 0, y: 0 }, { x: 6, y: 0 }) });
  store.exec({ type: 'addWall', wall: wall('w_arco', { x: 0, y: 0 }, { x: 0, y: 4 }, 1) });
  store.exec({ type: 'addFloor', floor: makeFloor({ id: 'pi', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 10, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 3 }, { x: 10, y: 3 }] }) });
  store.exec({ type: 'addSlab', slab: makeSlab({ id: 'la', typeId: 'ls_mac12', levelId: 'lv_0', boundary: [{ x: 20, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 3 }] }) });
  store.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'fo', typeId: 'ct_gesso', levelId: 'lv_0', boundary: [{ x: 30, y: 0 }, { x: 34, y: 0 }, { x: 34, y: 3 }, { x: 30, y: 3 }] }) });
  const ctx: SketchCtx = { project: () => store.project, levelId: () => 'lv_0', hiddenInView: () => new Set(hidden) };
  return { store, ctx };
}

const near = (a: Vec2, b: Vec2, tol = 1e-6): boolean => dist(a, b) <= tol;

describe('captura de face, eixo e borda (faceAt)', () => {
  it('parede reta: a face externa fica à esquerda de a→b, e a interna à direita', () => {
    const { ctx } = scene();
    const ext = faceAt(ctx, { x: 3, y: 0.092 }, 0.005);
    expect(ext?.kind).toBe('face');
    expect(ext?.hostId).toBe('w_reta');
    expect(ext?.which).toBe('ext');
    expect(ext?.label).toMatch(/externa/);
    const int = faceAt(ctx, { x: 3, y: -0.092 }, 0.005);
    expect(int?.kind).toBe('face');
    expect(int?.which).toBe('int');
  });

  it('o eixo ganha quando o cursor está sobre a linha de locação', () => {
    const { ctx } = scene();
    const axis = faceAt(ctx, { x: 3, y: 0 }, 0.02);
    expect(axis?.kind).toBe('axis');
    expect(axis?.hostId).toBe('w_reta');
    expect(axis?.seg.sag).toBeUndefined();
  });

  it('fora da tolerância não há referência', () => {
    const { ctx } = scene();
    expect(faceAt(ctx, { x: 3, y: 1 }, 0.1)).toBeNull();
  });

  it('elemento oculto na planta não é alvo', () => {
    const { ctx } = scene(['w_reta']);
    expect(faceAt(ctx, { x: 3, y: 0 }, 0.02)?.hostId).not.toBe('w_reta');
  });

  it('Tab (cycle) percorre os candidatos por distância e volta ao primeiro', () => {
    const { ctx } = scene();
    const c = faceCandidates(ctx, { x: 3, y: 0 }, 0.1);
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(c[0]!.kind).toBe('axis');
    expect(faceAt(ctx, { x: 3, y: 0 }, 0.1, 1)).toEqual(expect.objectContaining({ kind: c[1]!.kind, which: c[1]!.which }));
    expect(faceAt(ctx, { x: 3, y: 0 }, 0.1, c.length)?.kind).toBe('axis');
  });

  it('parede curva: o eixo é um arco com flecha, e a face externa é outro arco mais afastado do centro', () => {
    const { ctx } = scene();
    const axis = faceAt(ctx, { x: -1, y: 2 }, 0.02);
    expect(axis?.kind).toBe('axis');
    expect(axis?.hostId).toBe('w_arco');
    expect(axis?.seg.sag).toBeCloseTo(1, 6);
    const ext = faceAt(ctx, { x: -1.092, y: 2 }, 0.005);
    expect(ext?.kind).toBe('face');
    expect(ext?.which).toBe('ext');
    expect(ext?.seg.sag).toBeGreaterThan(1);
    expect(ext?.seg.sag).toBeLessThan(1.1);
  });

  it('borda de piso, laje e forro entram com o anel e o índice da aresta', () => {
    const { ctx, store } = scene();
    const floorId = 'pi';
    const e = faceAt(ctx, { x: 12, y: 0 }, 0.02);
    expect(e?.kind).toBe('edge');
    expect(e?.hostId).toBe(floorId);
    expect(e?.which).toEqual({ ring: 0, edge: 0 });
    expect(e?.label).toMatch(/piso/);
    expect(faceAt(ctx, { x: 22, y: 0 }, 0.02)?.hostId).toBe('la');
    expect(faceAt(ctx, { x: 30, y: 1.5 }, 0.02)?.hostId).toBe('fo');
    expect(store.project.elements[floorId]?.kind).toBe('floor');
  });
});

describe('linhas prontas para o rascunho (faceSegments)', () => {
  it('eixo e face externa de parede reta saem como uma linha com as pontas corretas', () => {
    const { ctx } = scene();
    const [axis] = faceSegments(ctx, 'w_reta', 'axis');
    expect(near(axis!.a, { x: 0, y: 0 })).toBe(true);
    expect(near(axis!.b, { x: 6, y: 0 })).toBe(true);
    // Pontas da face: esquadria com a parede do arco em (0,0), então o x da ponta a não é 0.
    const [ext] = faceSegments(ctx, 'w_reta', 'ext');
    expect(ext!.a.y).toBeCloseTo(0.092, 6);
    expect(near(ext!.b, { x: 6, y: 0.092 }, 1e-6)).toBe(true);
  });

  it('parede curva: a face externa sai como arco, concêntrico ao eixo', () => {
    const { ctx } = scene();
    const [ext] = faceSegments(ctx, 'w_arco', 'ext');
    expect(ext!.sag).toBeGreaterThan(1);
    const arc = arcFromSagitta(ext!.a, ext!.b, ext!.sag!);
    expect(arc).not.toBeNull();
    const mid = arcPointAt(arc!, arc!.length / 2);
    expect(mid.x).toBeLessThan(-1);
  });

  it('piso: uma aresta, ou o anel inteiro quando a aresta não é dada', () => {
    const { ctx } = scene();
    const one = faceSegments(ctx, 'pi', { ring: 0, edge: 1 });
    expect(one).toHaveLength(1);
    expect(near(one[0]!.a, { x: 14, y: 0 })).toBe(true);
    expect(near(one[0]!.b, { x: 14, y: 3 })).toBe(true);
    expect(faceSegments(ctx, 'pi', { ring: 0 })).toHaveLength(4);
    expect(faceSegments(ctx, 'pi', { ring: 3 })).toEqual([]);
    expect(faceSegments(ctx, 'inexistente', { ring: 0 })).toEqual([]);
  });

  it('ids dos segmentos são novos a cada chamada (o rascunho não recebe ids repetidos)', () => {
    const { ctx } = scene();
    const a: SketchSeg[] = faceSegments(ctx, 'w_reta', 'axis');
    const b: SketchSeg[] = faceSegments(ctx, 'w_reta', 'axis');
    expect(a[0]!.id).not.toBe(b[0]!.id);
  });
});
