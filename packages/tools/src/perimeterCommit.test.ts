import { describe, expect, it } from 'vitest';
import { polygonArea, type SketchDraft, type Vec2 } from '@hestia/geom';
import { DEFAULT_CEILING_HEIGHT, createEmptyProject, floorArea, floorsOnLevel, ProjectStore, roofsOnLevel, type Command, type Project, type Roof, type Floor } from '@hestia/model';
import { resolveRoofs } from '@hestia/engine';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { draftFromElement, commitPerimeter, perimeterOptionsOf } from './perimeterCommit.ts';
import type { CommitPerimeterResult } from './perimeterCommitTypes.ts';
import { OUTLINE_LOCKED_MSG } from './outlineEdit.ts';

const rectSegs = (x0: number, y0: number, x1: number, y1: number): NewSeg[] => [
  { a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
  { a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
  { a: { x: x1, y: y1 }, b: { x: x0, y: y1 } },
  { a: { x: x0, y: y1 }, b: { x: x0, y: y0 } },
];

const draftOf = (target: SketchDraft['target'], segs: NewSeg[]): SketchDraft => addSegs(newDraft(target), segs);

/** Resultado de sucesso; falha o teste com o motivo da recusa. */
function ok(r: CommitPerimeterResult): Extract<CommitPerimeterResult, { ok: true }> {
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  return r;
}

/** Aplica os comandos de um resultado de sucesso ao projeto da loja. */
function apply(store: ProjectStore, r: CommitPerimeterResult): void {
  for (const c of ok(r).commands) store.exec(c);
}

function addedOf<K extends 'addRoof' | 'addFloor' | 'addSlab' | 'addCeiling'>(r: CommitPerimeterResult, type: K): Extract<Command, { type: K }> {
  const c = ok(r).commands[0];
  if (c?.type !== type) throw new Error(`esperava ${type}, veio ${c?.type}`);
  return c as Extract<Command, { type: K }>;
}

function patchOf(r: CommitPerimeterResult): Record<string, unknown> {
  const c = ok(r).commands[0];
  if (c?.type !== 'updateElements') throw new Error(`esperava updateElements, veio ${c?.type}`);
  return c.patch as Record<string, unknown>;
}

/** Cria um telhado de retângulo pela API e o aplica à loja; devolve o id. */
function roofInStore(store: ProjectStore, segs: NewSeg[] = rectSegs(0, 0, 6, 4), opts: Parameters<typeof commitPerimeter>[2] = {}): string {
  const r = commitPerimeter(store.project, draftOf('roof', segs), { typeId: 'rt_ceramica', levelId: 'lv_0', ...opts });
  apply(store, r);
  return ok(r).id;
}

const roofOf = (p: Project, id: string): Roof => {
  const r = p.elements[id];
  if (r?.kind !== 'roof') throw new Error('não é telhado');
  return r;
};

const closeTo = (a: Vec2[], b: Vec2[]): void => {
  expect(a).toHaveLength(b.length);
  a.forEach((q, i) => {
    expect(q.x).toBeCloseTo(b[i]!.x, 9);
    expect(q.y).toBeCloseTo(b[i]!.y, 9);
  });
};

describe('perímetro: criar telhado', () => {
  it('retângulo de quatro arestas vira telhado com águas, beiral de 0,5 m e inclinação padrão', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('roof', rectSegs(0, 0, 6, 4)), { typeId: 'rt_ceramica', levelId: 'lv_0' });
    const roof = addedOf(r, 'addRoof').roof;
    expect(roof.edgeSlopes).toEqual([30, 30, 30, 30]);
    expect(roof.edgeOverhangs).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(polygonArea([roof.footprint!])).toBeCloseTo(24, 6);
    expect(polygonArea([roof.boundary])).toBeCloseTo(35, 6);
    apply(store, r);
    expect(roofsOnLevel(store.project, 'lv_0')).toHaveLength(1);
    expect(resolveRoofs(store.project, 'lv_0')[0]!.planes.length).toBeGreaterThan(0);
  });

  it('telhado cuja geometria não gera águas é recusado, sem comando nem alteração', () => {
    const store = new ProjectStore(createEmptyProject());
    let d = draftOf('roof', rectSegs(0, 0, 6, 4));
    for (const s of d.segs) d = setSegSlope(d, s.id, { definesSlope: false });
    const r = commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0' });
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty('commands');
    expect(r.ok === false && r.message).toContain('nenhuma aresta define inclinação');
    expect(roofsOnLevel(store.project, 'lv_0')).toHaveLength(0);
  });

  it('inclinação e balanço por aresta vão para edgeSlopes e edgeOverhangs na ordem do contorno', () => {
    const store = new ProjectStore(createEmptyProject());
    let d = draftOf('roof', rectSegs(0, 0, 6, 4));
    d = setSegSlope(d, 's1', { overhang: 1.2, slopePct: 45 });
    d = setSegSlope(d, 's3', { definesSlope: false });
    const roof = addedOf(commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0' }), 'addRoof').roof;
    expect(roof.edgeOverhangs).toEqual([1.2, 0.5, 0.5, 0.5]);
    expect(roof.edgeSlopes).toEqual([45, 30, null, 30]);
  });

  it('balanço e inclinação das opções substituem o padrão do rascunho nas arestas sem valor próprio', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('roof', rectSegs(0, 0, 6, 4)), { typeId: 'rt_ceramica', levelId: 'lv_0', overhang: 0.8, slopePct: 22 });
    const roof = addedOf(r, 'addRoof').roof;
    expect(roof.edgeOverhangs).toEqual([0.8, 0.8, 0.8, 0.8]);
    expect(roof.edgeSlopes).toEqual([22, 22, 22, 22]);
  });

  it('sem nível ao criar, recusa', () => {
    const r = commitPerimeter(createEmptyProject(), draftOf('roof', rectSegs(0, 0, 6, 4)), { typeId: 'rt_ceramica' });
    expect(r.ok).toBe(false);
  });
});

describe('perímetro: roundtrip de edição', () => {
  it('telhado sem mudanças: draftFromElement -> commitPerimeter devolve o mesmo beiral, pegada, furos e flags', () => {
    const store = new ProjectStore(createEmptyProject());
    const segs = [...rectSegs(0, 0, 10, 8), ...rectSegs(3, 3, 5, 5)];
    const id = roofInStore(store, segs, { overhang: 0.6 });
    const before = roofOf(store.project, id);
    expect(before.holes).toHaveLength(1);
    const d = draftFromElement(store.project, id);
    expect(d).not.toBeNull();
    const patch = patchOf(commitPerimeter(store.project, d!));
    closeTo(patch.boundary as Vec2[], before.boundary);
    closeTo(patch.footprint as Vec2[], before.footprint!);
    expect(patch.edgeSlopes).toEqual(before.edgeSlopes);
    expect(patch.edgeOverhangs).toEqual(before.edgeOverhangs);
    expect(patch.holes).toHaveLength(1);
    closeTo((patch.holes as Vec2[][])[0]!, before.holes[0]!);
    expect(patch).not.toHaveProperty('typeId');
    expect(patch).not.toHaveProperty('levelId');
    expect(patch).not.toHaveProperty('heightOffset');
  });

  it('telhado antigo sem pegada: a pegada sai do beiral e o beiral recalculado volta igual', () => {
    const store = new ProjectStore(createEmptyProject());
    const id = roofInStore(store, rectSegs(0, 0, 6, 4), { overhang: 0.7 });
    const old = roofOf(store.project, id);
    const legacy: Project = { ...store.project, elements: { ...store.project.elements, [id]: { ...old, footprint: undefined } } };
    const d = draftFromElement(legacy, id);
    expect(d).not.toBeNull();
    const patch = patchOf(commitPerimeter(legacy, d!));
    closeTo(patch.boundary as Vec2[], old.boundary);
    expect(polygonArea([patch.footprint as Vec2[]])).toBeCloseTo(24, 6);
  });

  it('editar uma aresta altera só o balanço dela, e preserva id, tipo, nível e cota', () => {
    const store = new ProjectStore(createEmptyProject());
    const id = roofInStore(store, rectSegs(0, 0, 6, 4), { heightOffset: 3.1 });
    const d = setSegSlope(draftFromElement(store.project, id)!, `${id}:o1`, { overhang: 2 });
    const r = commitPerimeter(store.project, d);
    const patch = patchOf(r);
    expect(patch.edgeOverhangs).toEqual([0.5, 2, 0.5, 0.5]);
    expect(patch).not.toHaveProperty('typeId');
    expect(patch).not.toHaveProperty('heightOffset');
    apply(store, r);
    const after = roofOf(store.project, id);
    expect(after.id).toBe(id);
    expect(after.typeId).toBe('rt_ceramica');
    expect(after.levelId).toBe('lv_0');
    expect(after.heightOffset).toBe(3.1);
  });

  it('editar telhado que perde as arestas que geram águas é recusado e não altera o elemento', () => {
    const store = new ProjectStore(createEmptyProject());
    const id = roofInStore(store, rectSegs(0, 0, 6, 4));
    let d = draftFromElement(store.project, id)!;
    for (const s of d.segs) d = setSegSlope(d, s.id, { definesSlope: false });
    const r = commitPerimeter(store.project, d);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('nenhuma aresta define inclinação');
  });

  it('draftFromElement de id inexistente ou de telhado livre devolve null', () => {
    expect(draftFromElement(createEmptyProject(), 'nao_existe')).toBeNull();
  });

  it('opções da barra: balanço, inclinação padrão e cota vêm do elemento', () => {
    const store = new ProjectStore(createEmptyProject());
    const id = roofInStore(store, rectSegs(0, 0, 6, 4), { overhang: 0.5, slopePct: 35, heightOffset: 2.9 });
    expect(perimeterOptionsOf(store.project, id)).toEqual({ overhang: 0.5, slopePct: 35, extendToCore: false, heightOffset: 2.9 });
    expect(perimeterOptionsOf(store.project, 'nao_existe')).toBeNull();
  });
});

describe('perímetro: piso, laje e forro', () => {
  it('piso com furo: cria o piso com o contorno e o furo dentro dele', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('floor', [...rectSegs(0, 0, 10, 6), ...rectSegs(2, 2, 4, 3)]), { typeId: 'ft_ceram', levelId: 'lv_0' });
    const floor = addedOf(r, 'addFloor').floor;
    expect(floor.boundary).toHaveLength(4);
    expect(floor.holes).toHaveLength(1);
    expect(floor.levelId).toBe('lv_0');
    apply(store, r);
    const f = floorsOnLevel(store.project, 'lv_0')[0] as Floor;
    expect(floorArea(f)).toBeCloseTo(58, 6);
  });

  it('furo fora do contorno é recusado pelo esboço, com o código do problema', () => {
    const r = commitPerimeter(createEmptyProject(), draftOf('floor', [...rectSegs(0, 0, 10, 6), ...rectSegs(8, 2, 12, 3)]), { typeId: 'ft_ceram', levelId: 'lv_0' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.issues?.some((i) => i.code === 'hole-outside')).toBe(true);
  });

  it('roundtrip de piso com furo: contorno e furo voltam iguais, sem trocar o tipo', () => {
    const store = new ProjectStore(createEmptyProject());
    const first = commitPerimeter(store.project, draftOf('floor', [...rectSegs(0, 0, 10, 6), ...rectSegs(2, 2, 4, 3)]), { typeId: 'ft_ceram', levelId: 'lv_0' });
    apply(store, first);
    const id = ok(first).id;
    const old = store.project.elements[id] as Floor;
    const d = draftFromElement(store.project, id)!;
    const r = commitPerimeter(store.project, d);
    const patch = patchOf(r);
    closeTo(patch.boundary as Vec2[], old.boundary);
    closeTo((patch.holes as Vec2[][])[0]!, old.holes[0]!);
    expect(patch).not.toHaveProperty('typeId');
    apply(store, r);
    expect((store.project.elements[id] as Floor).levelId).toBe('lv_0');
  });

  it('editar piso: acrescentar um furo e manter a cota do piso', () => {
    const store = new ProjectStore(createEmptyProject());
    const id = roofLessFloor(store);
    const d = addSegs(draftFromElement(store.project, id)!, rectSegs(2, 2, 4, 3));
    const r = commitPerimeter(store.project, d);
    const patch = patchOf(r);
    expect((patch.holes as Vec2[][]).length).toBe(1);
    expect(patch).not.toHaveProperty('heightOffset');
    apply(store, r);
    expect((store.project.elements[id] as Floor).heightOffset).toBe(-0.1);
  });

  it('piso vinculado às paredes não é editado: recusa com a mensagem de contorno travado', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({
      type: 'addFloor',
      floor: { id: 'f_vinc', kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rectSegs(0, 0, 4, 4).map((s) => s.a), holes: [], heightOffset: 0, mark: '', comments: '', outlineSource: { mode: 'walls-finish', linked: true, seed: { x: 2, y: 2 } } },
    });
    const d = draftFromElement(store.project, 'f_vinc')!;
    const r = commitPerimeter(store.project, d);
    expect(r.ok === false && r.message).toBe(OUTLINE_LOCKED_MSG);
  });

  it('estender até o núcleo cria a origem do contorno no núcleo, e a barra mostra a opção', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('floor', rectSegs(0, 0, 10, 6)), { typeId: 'ft_ceram', levelId: 'lv_0', extendToCore: true });
    const floor = addedOf(r, 'addFloor').floor;
    expect(floor.outlineSource).toEqual({ mode: 'perimeter', linked: false, extend: 'core' });
    apply(store, r);
    expect(perimeterOptionsOf(store.project, ok(r).id)?.extendToCore).toBe(true);
  });

  it('laje: criação e roundtrip sem mudanças', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('slab', rectSegs(0, 0, 8, 5)), { typeId: 'ls_mac12', levelId: 'lv_0', heightOffset: -0.2 });
    const slab = addedOf(r, 'addSlab').slab;
    expect(slab.heightOffset).toBe(-0.2);
    apply(store, r);
    const id = ok(r).id;
    const patch = patchOf(commitPerimeter(store.project, draftFromElement(store.project, id)!));
    closeTo(patch.boundary as Vec2[], slab.boundary);
  });

  it('forro: criação com a cota padrão e roundtrip sem mudanças', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, draftOf('ceiling', rectSegs(1, 1, 5, 4)), { typeId: 'ct_gesso', levelId: 'lv_0' });
    const c = addedOf(r, 'addCeiling').ceiling;
    expect(c.heightOffset).toBe(DEFAULT_CEILING_HEIGHT);
    expect(c.roomId ?? null).toBeNull();
    apply(store, r);
    const id = ok(r).id;
    const patch = patchOf(commitPerimeter(store.project, draftFromElement(store.project, id)!));
    closeTo(patch.boundary as Vec2[], c.boundary);
    expect(patch).not.toHaveProperty('roomId');
  });
});

/** Piso retangular com cota -0,1 m, aplicado à loja; devolve o id. */
function roofLessFloor(store: ProjectStore): string {
  const r = commitPerimeter(store.project, draftOf('floor', rectSegs(0, 0, 10, 6)), { typeId: 'ft_ceram', levelId: 'lv_0', heightOffset: -0.1 });
  apply(store, r);
  return ok(r).id;
}
