import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { roofsOnLevel, type Project, type ProjectStore, type Roof } from '@hestia/model';
import { resolveRoofs, roofTopAt } from '@hestia/engine';
import { roofProblem, roofPatchProblem } from './roofCheck.ts';
import { commitPerimeter } from './perimeterCommit.ts';
import type { CommitPerimeterOptions, CommitPerimeterResult } from './perimeterCommitTypes.ts';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { makeEnv, P, tool } from './testEnv.ts';

/** Contorno em L de 6 × 4 com o degrau de 4 × 2 (anti-horário). */
const L = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 0, y: 4 },
];

const roofs = (p: Project): Roof[] => roofsOnLevel(p, 'lv_0');

/** Lados de um anel, na ordem do contorno: cada lado vai de um vértice ao seguinte. */
const sidesOf = (ring: Vec2[]): NewSeg[] => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }));
const retangulo = (w: number, h: number): Vec2[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];

/**
 * Cria o telhado pelo commit do perímetro (o caminho da faixa) e o aplica à loja. `semAguas` são os índices dos lados
 * que não definem inclinação (a forma "duas águas" deixava as curtas de fora).
 */
function criar(store: ProjectStore, segs: NewSeg[], opts: CommitPerimeterOptions = {}, semAguas: number[] = []): CommitPerimeterResult {
  let d = addSegs(newDraft('roof'), segs);
  for (const i of semAguas) d = setSegSlope(d, d.segs[i]!.id, { definesSlope: false });
  const r = commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0', ...opts });
  if (r.ok) for (const c of r.commands) store.exec(c);
  return r;
}

describe('telhado nunca some (A12): criação', () => {
  it('L com todas as arestas sem inclinação: telhado plano, aceito (sem recusa)', () => {
    const ctx = makeEnv();
    const r = { ...roofBase(), boundary: L, edgeSlopes: L.map(() => null), shape: 'edges' as const };
    expect(roofProblem(ctx.store.project, [{ ...r, order: 0 }])).toBeNull();
  });

  it('L com duas águas (só as arestas paralelas ao eixo x definem): a envoltória fecha e cria', () => {
    const ctx = makeEnv();
    // Só as arestas paralelas ao eixo x definem inclinação (as verticais ficam sem): antes o esqueleto não fechava.
    const r = criar(ctx.store, sidesOf(L), {}, [1, 3, 5]);
    expect(r.ok).toBe(true);
    expect(roofs(ctx.store.project)).toHaveLength(1);
    expect(resolveRoofs(ctx.store.project, 'lv_0')[0]!.problem).toBeUndefined();
  });

  it('L com os dois lados internos sem inclinação (Revit): cria pelo perímetro e a cota confere', () => {
    // Lados 2 e 3 do esboço são os internos do L (o degrau de 4 × 2 do canto). Sem balanço (overhang 0), a água sobe 30 %
    // da distância ao lado de fora mais próximo: em (1; 1) e (4; 1) a cota é 0,3 m acima do beiral.
    const ctx = makeEnv();
    const r = criar(ctx.store, sidesOf(L), { overhang: 0 }, [2, 3]);
    expect(r.ok).toBe(true);
    const [roof] = resolveRoofs(ctx.store.project, 'lv_0');
    expect(roof!.problem).toBeUndefined();
    expect(roof!.steps).toBeUndefined();
    expect(roofTopAt(roof!, { x: 1, y: 1 })! - roof!.eaveZ).toBeCloseTo(0.3, 6);
    expect(roofTopAt(roof!, { x: 4, y: 1 })! - roof!.eaveZ).toBeCloseTo(0.3, 6);
  });

  it('L com quatro águas (todas as arestas definem): cria com 6 águas', () => {
    const ctx = makeEnv();
    const r = criar(ctx.store, sidesOf(L));
    expect(r.ok).toBe(true);
    expect(roofs(ctx.store.project)).toHaveLength(1);
    expect(resolveRoofs(ctx.store.project, 'lv_0')[0]!.planes).toHaveLength(6);
    expect(r.message).toMatch(/6 águas/);
  });

  it('duas águas: as arestas curtas ficam sem inclinação (empenas) e as longas definem', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(8, 6)), {}, [1, 3]);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.shape).toBe('edges');
    expect(r.edgeSlopes).toEqual([30, null, 30, null]);
  });
});

describe('telhado nunca some (A12): edição', () => {
  it('alterar a aresta que deixaria o telhado sem inclinação é aceito: vira plano, sem recusa', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(8, 6)), {}, [1, 3]);
    const id = roofs(ctx.store.project)[0]!.id;
    expect(roofPatchProblem(ctx.store.project, [id], { edgeSlopes: [null, null, null, null] })).toBeNull();
    expect(roofPatchProblem(ctx.store.project, [id], { mark: 'A-1' })).toBeNull();
  });
});

/** Telhado de referência sem contorno (o teste põe o seu). */
function roofBase(): Omit<Roof, 'order'> {
  return { id: 'r', kind: 'roof', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: L, holes: [], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, planes: [], edgeSlopes: [30, null, 30, null, 30, null], edgeOverhangs: [0, 0, 0, 0, 0, 0], profile: [], joinOthers: true, rafterCut: 'plumb', eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false }, mark: '', comments: '' };
}

describe('vértices e vetor por aresta (A11)', () => {
  it('inserir vértice no meio da aresta 0 divide a aresta e duplica a inclinação dela', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(8, 6)), { overhang: 0 }, [1, 3]);
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
