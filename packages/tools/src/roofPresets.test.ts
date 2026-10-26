import { describe, expect, it } from 'vitest';
import { roofsOnLevel, type Project, type Roof } from '@hestia/model';
import { resolveRoofs } from '@hestia/engine';
import { roofProblem, roofPatchProblem } from './roofCheck.ts';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import type { RoofMode } from './types.ts';

/** Contorno em L de 6 × 4 com o degrau de 4 × 2 (anti-horário). */
const L = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 0, y: 4 },
];

function roofCtx(mode: RoofMode, shape: 'shed' | 'gable' | 'hip' | 'edges' = 'gable') {
  const ctx = makeEnv();
  ctx.options.roofMode = mode;
  ctx.options.roofShape = shape;
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs };
}

const roofs = (p: Project): Roof[] => roofsOnLevel(p, 'lv_0');

describe('telhado nunca some (A12): criação', () => {
  it('L com todas as arestas sem inclinação: não cria e diz o motivo', () => {
    const ctx = roofCtx('poly');
    const r = { ...roofBase(), boundary: L, edgeSlopes: L.map(() => null), shape: 'edges' as const };
    expect(roofProblem(ctx.store.project, [{ ...r, order: 0 }])).toMatch(/nenhuma aresta define inclinação/);
  });

  it('L com duas águas: cria e tem águas', () => {
    const ctx = roofCtx('poly', 'gable');
    const t = tool('roof', ctx.env);
    for (const q of L) clickAt(t, q.x, q.y);
    clickAt(t, 0, 0);
    expect(roofs(ctx.store.project)).toHaveLength(1);
    const res = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(res.planes.length).toBeGreaterThan(0);
    expect(res.problem).toBeUndefined();
    expect(ctx.msgs.at(-1)).toMatch(/Telhado criado/);
  });

  it('L com quatro águas (todas as arestas definem): cria com 6 águas', () => {
    const ctx = roofCtx('poly', 'hip');
    const t = tool('roof', ctx.env);
    for (const q of L) clickAt(t, q.x, q.y);
    clickAt(t, 0, 0);
    expect(roofs(ctx.store.project)).toHaveLength(1);
    expect(resolveRoofs(ctx.store.project, 'lv_0')[0]!.planes).toHaveLength(6);
    expect(ctx.msgs.at(-1)).toMatch(/6 águas/);
  });

  it('a forma da barra vira predefinições por aresta: duas águas com empenas nas arestas curtas', () => {
    const ctx = roofCtx('rect', 'gable');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 8, 6);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.shape).toBe('edges');
    expect(r.edgeSlopes).toEqual([30, null, 30, null]);
  });
});

describe('telhado nunca some (A12): edição', () => {
  it('alterar a aresta que deixaria o telhado sem águas não aplica', () => {
    const ctx = roofCtx('rect', 'gable');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 8, 6);
    const id = roofs(ctx.store.project)[0]!.id;
    const before = roofs(ctx.store.project)[0]!.edgeSlopes;
    expect(roofPatchProblem(ctx.store.project, [id], { edgeSlopes: [null, null, null, null] })).toMatch(/nenhuma aresta/);
    expect(roofPatchProblem(ctx.store.project, [id], { mark: 'A-1' })).toBeNull();
    expect(roofs(ctx.store.project)[0]!.edgeSlopes).toEqual(before);
  });
});

/** Telhado de referência sem contorno (o teste põe o seu). */
function roofBase(): Omit<Roof, 'order'> {
  return { id: 'r', kind: 'roof', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: L, holes: [], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, planes: [], edgeSlopes: [30, null, 30, null, 30, null], edgeOverhangs: [0, 0, 0, 0, 0, 0], profile: [], joinOthers: true, rafterCut: 'plumb', eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false }, mark: '', comments: '' };
}

describe('vértices e vetor por aresta (A11)', () => {
  it('inserir vértice no meio da aresta 0 divide a aresta e duplica a inclinação dela', () => {
    const ctx = roofCtx('rect', 'gable');
    ctx.options.roofOverhang = 0;
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 8, 6);
    const id = roofs(ctx.store.project)[0]!.id;
    ctx.env.setSelection([id]);
    const sel = tool('select', ctx.env);
    sel.move(P(4, 0));
    sel.down?.(P(4, 0));
    sel.drag?.(P(4, -1));
    sel.up?.(P(4, -1));
    const r = ctx.store.project.elements[id] as Roof;
    expect(r.boundary).toHaveLength(5);
    expect(r.edgeSlopes).toEqual([30, 30, null, 30, null]);
    expect(r.edgeOverhangs).toHaveLength(5);
  });
});
