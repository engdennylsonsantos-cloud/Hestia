import { describe, expect, it } from 'vitest';
import { resolveBoundary } from '@hestia/engine';
import { createEmptyProject, makeRoom, makeWall, ProjectStore, type Ceiling, type Command, type Floor } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { addSegs, newDraft, type NewSeg } from './perimeterSession.ts';
import { commitPerimeter, draftFromElement, perimeterOptionsOf } from './perimeterCommit.ts';
import type { CommitPerimeterResult } from './perimeterCommitTypes.ts';
import { OUTLINE_LOCKED_MSG } from './outlineEdit.ts';
import { perimeterFromBox } from './sketchByPerimeter.ts';
import { roomAt, roomPolygon } from './sketchPickRoom.ts';
import type { SketchCtx } from './sketchPickFaceGeom.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): NewSeg[] => [
  { a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
  { a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
  { a: { x: x1, y: y1 }, b: { x: x0, y: y1 } },
  { a: { x: x0, y: y1 }, b: { x: x0, y: y0 } },
];

const ok = (r: CommitPerimeterResult): Extract<CommitPerimeterResult, { ok: true }> => {
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  return r;
};

const refused = (r: CommitPerimeterResult): string => {
  if (r.ok) throw new Error('esperava recusa');
  return r.message;
};

function apply(store: ProjectStore, r: CommitPerimeterResult): string {
  const res = ok(r);
  for (const c of res.commands) store.exec(c);
  return res.id;
}

/** Casa de 8 × 5 m (paredes de eixo), com um ambiente no meio. */
function house(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts: Vec2[] = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 4, y: 2.5 } }) });
  return s;
}

const ctxOf = (s: ProjectStore, hidden: string[] = []): SketchCtx => ({ project: () => s.project, levelId: () => 'lv_0', hiddenInView: () => new Set(hidden) });

/** Esboço da caixa sobre as paredes (o caminho de "Por perímetro"), como o modo monta. */
function byPerimeter(s: ProjectStore, type: 'floor' | 'slab') {
  const r = perimeterFromBox(ctxOf(s), { x: -2, y: -2 }, { x: 10, y: 10 });
  expect(r.warnings).toEqual([]);
  return addSegs(newDraft(type), r.segs);
}

describe('perímetro: vínculo do piso às paredes (Por perímetro + Vincular às paredes)', () => {
  it('esboço por perímetro com a opção: grava a origem vinculada, com o contorno das paredes', () => {
    const s = house();
    const r = commitPerimeter(s.project, byPerimeter(s, 'floor'), { typeId: 'ft_ceram', levelId: 'lv_0', linkToWalls: true, origin: { walls: true } });
    const id = apply(s, r);
    const floor = s.project.elements[id] as Floor;
    expect(floor.outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
    expect(floor.outlineSource?.extend).toBeUndefined();
    expect(floor.outlineSource?.seed).toBeDefined();
    const outline = resolveBoundary(s.project, 'lv_0', floor);
    expect(outline.problem).toBeNull();
    expect(outline.polygon?.[0]).toHaveLength(floor.boundary.length);
  });

  it('sem a origem "Por perímetro" (esboço à mão), a opção não vincula e a mensagem diz por quê', () => {
    const s = house();
    const r = ok(commitPerimeter(s.project, addSegs(newDraft('floor'), rect(0, 0, 8, 5)), { typeId: 'ft_ceram', levelId: 'lv_0', linkToWalls: true }));
    const floor = r.commands[0] as Extract<Command, { type: 'addFloor' }>;
    expect(floor.floor.outlineSource).toBeUndefined();
    expect(r.message).toContain('Sem vínculo');
  });

  it('vincular com "Estender até o núcleo" é recusado com o motivo', () => {
    const s = house();
    const msg = refused(commitPerimeter(s.project, byPerimeter(s, 'floor'), { typeId: 'ft_ceram', levelId: 'lv_0', linkToWalls: true, extendToCore: true, origin: { walls: true } }));
    expect(msg).toContain('núcleo');
  });

  it('esboço que não cobre a edificação inteira não vincula: recusa, e nada é criado', () => {
    const s = house();
    const r = perimeterFromBox(ctxOf(s), { x: -2, y: -2 }, { x: 3, y: 0.2 });
    const draft = addSegs(newDraft('floor'), r.segs);
    const msg = refused(commitPerimeter(s.project, draft, { typeId: 'ft_ceram', levelId: 'lv_0', linkToWalls: true, origin: { walls: true } }));
    expect(msg).toContain('não coincide');
  });

  it('piso estático ganha o vínculo ao ser editado com um esboço por perímetro; a opção lê o estado do elemento', () => {
    const s = house();
    const id = apply(s, commitPerimeter(s.project, addSegs(newDraft('floor'), rect(-1, -1, 9, 6)), { typeId: 'ft_ceram', levelId: 'lv_0' }));
    expect(perimeterOptionsOf(s.project, id)?.linkToWalls).toBe(false);
    const r = commitPerimeter(s.project, { ...byPerimeter(s, 'floor'), editing: id }, { ...perimeterOptionsOf(s.project, id), linkToWalls: true, origin: { walls: true } });
    const res = ok(r);
    const patch = (res.commands[0] as Extract<Command, { type: 'updateElements' }>).patch as Partial<Floor>;
    expect(patch.outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
    apply(s, r);
    expect(perimeterOptionsOf(s.project, id)?.linkToWalls).toBe(true);
  });

  it('piso vinculado não se edita pelo perímetro: a recusa é a de contorno travado', () => {
    const s = house();
    const id = apply(s, commitPerimeter(s.project, byPerimeter(s, 'floor'), { typeId: 'ft_ceram', levelId: 'lv_0', linkToWalls: true, origin: { walls: true } }));
    const draft = draftFromElement(s.project, id)!;
    expect(refused(commitPerimeter(s.project, draft))).toBe(OUTLINE_LOCKED_MSG);
  });

  it('laje: o mesmo vínculo', () => {
    const s = house();
    const r = commitPerimeter(s.project, byPerimeter(s, 'slab'), { typeId: 'ls_mac12', levelId: 'lv_0', linkToWalls: true, origin: { walls: true } });
    const cmd = ok(r).commands[0] as Extract<Command, { type: 'addSlab' }>;
    expect(cmd.slab.outlineSource).toMatchObject({ mode: 'perimeter', linked: true });
  });
});

describe('perímetro: forro acompanha o ambiente (Por ambiente + Acompanhar o ambiente)', () => {
  it('roomAt devolve o contorno do ambiente como linhas e o id do ambiente; oculto ou fora não entra', () => {
    const s = house();
    const pick = roomAt(ctxOf(s), { x: 4, y: 2.5 });
    expect(pick?.roomId).toBe('r1');
    expect(pick?.name).toBe('Sala');
    expect(pick?.segs).toHaveLength(4);
    expect(roomAt(ctxOf(s, ['r1']), { x: 4, y: 2.5 })).toBeNull();
    expect(roomAt(ctxOf(s), { x: 20, y: 20 })).toBeNull();
  });

  it('forro pelo ambiente: cria com roomId e o contorno do ambiente, e segue o ambiente', () => {
    const s = house();
    const pick = roomAt(ctxOf(s), { x: 4, y: 2.5 })!;
    const r = commitPerimeter(s.project, addSegs(newDraft('ceiling'), pick.segs), { typeId: 'ct_gesso', levelId: 'lv_0', followRoom: true, origin: { roomId: 'r1' } });
    const c = (ok(r).commands[0] as Extract<Command, { type: 'addCeiling' }>).ceiling;
    expect(c.roomId).toBe('r1');
    expect(c.roomLinked).toBe(true);
    const id = apply(s, r);
    const outline = roomPolygon(s.project, 'lv_0', 'r1')!;
    expect((s.project.elements[id] as Ceiling).boundary).toHaveLength(outline[0]!.length);
  });

  it('acompanhar sem o contorno do ambiente é recusado; com contorno diferente também', () => {
    const s = house();
    expect(refused(commitPerimeter(s.project, addSegs(newDraft('ceiling'), rect(1, 1, 5, 4)), { typeId: 'ct_gesso', levelId: 'lv_0', followRoom: true }))).toContain('Por ambiente');
    expect(refused(commitPerimeter(s.project, addSegs(newDraft('ceiling'), rect(1, 1, 5, 4)), { typeId: 'ct_gesso', levelId: 'lv_0', followRoom: true, origin: { roomId: 'r1' } }))).toContain('não é o do ambiente');
  });

  it('sem a opção, o forro sai solto do ambiente (static, sem roomId)', () => {
    const s = house();
    const pick = roomAt(ctxOf(s), { x: 4, y: 2.5 })!;
    const r = commitPerimeter(s.project, addSegs(newDraft('ceiling'), pick.segs), { typeId: 'ct_gesso', levelId: 'lv_0', origin: { roomId: 'r1' } });
    const c = (ok(r).commands[0] as Extract<Command, { type: 'addCeiling' }>).ceiling;
    expect(c.roomId).toBeFalsy();
  });

  it('editar forro que acompanha: sem mudanças não solta (um comando só); desmarcar a opção solta', () => {
    const s = house();
    const pick = roomAt(ctxOf(s), { x: 4, y: 2.5 })!;
    const id = apply(s, commitPerimeter(s.project, addSegs(newDraft('ceiling'), pick.segs), { typeId: 'ct_gesso', levelId: 'lv_0', followRoom: true, origin: { roomId: 'r1' } }));
    const opts = perimeterOptionsOf(s.project, id);
    expect(opts?.followRoom).toBe(true);
    const keep = ok(commitPerimeter(s.project, draftFromElement(s.project, id)!, opts ?? {}));
    expect(keep.commands.map((c) => c.type)).toEqual(['updateElements']);
    const absent = ok(commitPerimeter(s.project, draftFromElement(s.project, id)!));
    expect(absent.commands.map((c) => c.type)).toEqual(['updateElements']);
    const free = ok(commitPerimeter(s.project, draftFromElement(s.project, id)!, { ...opts, followRoom: false }));
    expect(free.commands[0]?.type).toBe('detachCeilingRoom');
  });
});
