import { describe, expect, it } from 'vitest';
import { applyTransform, arcFromSagitta, arcPointAt, sagFromThreePoints, type Vec2 } from '@hestia/geom';
import { frameOfWall, openingGeometry, pointAt } from '@hestia/engine';
import {
  createEmptyProject,
  dimensionSettingsOf,
  isOpening,
  makeWall,
  ProjectStore,
  type Project,
} from '@hestia/model';
import { wallDimProvider } from './dims/providers/wall.ts';
import { copyWalls, moveWalls } from './edit.ts';
import { gripHoldAt } from './selectGrips.ts';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import { patchCommands } from './trimPreview.ts';

const V = (x: number, y: number): Vec2 => ({ x, y });

interface WorldOpening {
  center: Vec2;
  left: Vec2;
  right: Vec2;
}

/** Centro e bordas do vão no mundo, a partir do modelo realmente desenhado. */
function worldOf(p: Project, id: string): WorldOpening {
  const o = p.elements[id];
  if (!o || !isOpening(o)) throw new Error(`abertura ${id} não existe`);
  const frame = frameOfWall(p, o.hostId);
  if (!frame) throw new Error(`parede ${o.hostId} não existe`);
  const g = openingGeometry(p, o, frame);
  const half = g.width / 2;
  return { center: g.center, left: pointAt(frame, o.offset - half, frame.sMid), right: pointAt(frame, o.offset + half, frame.sMid) };
}

function samePoint(actual: Vec2, expected: Vec2): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

function sameOpening(actual: WorldOpening, expected: WorldOpening): void {
  samePoint(actual.center, expected.center);
  samePoint(actual.left, expected.left);
  samePoint(actual.right, expected.right);
}

function snapshot(p: Project, ids: string[]): Map<string, WorldOpening> {
  return new Map(ids.map((id) => [id, worldOf(p, id)]));
}

function keepAll(p: Project, before: Map<string, WorldOpening>): void {
  for (const [id, expected] of before) sameOpening(worldOf(p, id), expected);
}

/** Parede h de 0 a 8 com a porta em 2 e a janela em 6. */
function cena(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(8, 0) }) });
  s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-01' } });
  s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 6, flipHand: false, flipFacing: false, sillOverride: null, mark: 'J-01' } });
  return s;
}

const IDs = ['d', 'j'];

/** Parede h (0..8) e referência vertical v (x=5), com uma abertura em cada. */
function cenaAparar() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(8, 0) }) });
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'v', typeId: 'wt_alv9', levelId: 'lv_0', a: V(5, -2), b: V(5, 2) }) });
  ctx.store.exec({ type: 'addOpening', opening: { id: 'dh', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-01' } });
  ctx.store.exec({ type: 'addOpening', opening: { id: 'dv', kind: 'door', typeId: 'ot_p80', hostId: 'v', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-02' } });
  return ctx;
}

function dimsOf(s: ProjectStore, id: string) {
  return wallDimProvider.compute({ project: s.project, levelId: 'lv_0', settings: dimensionSettingsOf(s.project), overrides: {} }, { wallId: id });
}

function edita(s: ProjectStore, id: string, key: string, value: number): void {
  const r = dimsOf(s, id).find((d) => d.key.endsWith(key))!.edit!(value);
  if (!('commands' in r)) throw new Error(r.error);
  s.transaction('Alterar cota', () => r.commands.forEach((c) => s.exec(c)));
}

function wallA(s: ProjectStore, id: string): Vec2 {
  const w = s.project.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`parede ${id} sumiu`);
  return w.a;
}

function translated(before: WorldOpening, d: Vec2): WorldOpening {
  const t = { kind: 'translate' as const, d };
  return { center: applyTransform(t, before.center), left: applyTransform(t, before.left), right: applyTransform(t, before.right) };
}

describe('mudar as pontas da parede não move a abertura no mundo', () => {
  it('(a) estender b mantém as aberturas', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'setWallEnds', id: 'h', b: V(10, 0) });
    keepAll(s.project, before);
  });

  it('(a) estender b por updateElements mantém as aberturas', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'updateElements', ids: ['h'], patch: { b: V(10, 0) } });
    keepAll(s.project, before);
  });

  it('(b) estender a mantém as aberturas', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'setWallEnds', id: 'h', a: V(-2, 0) });
    keepAll(s.project, before);
  });

  it('(c) encurtar b mantém as aberturas que ainda cabem', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'setWallEnds', id: 'h', b: V(7, 0) });
    keepAll(s.project, before);
  });

  it('(c) encurtar a mantém as aberturas que ainda cabem', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'setWallEnds', id: 'h', a: V(1, 0) });
    keepAll(s.project, before);
  });

  it('estender as duas pontas na mesma direção preserva a posição projetada', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    s.exec({ type: 'setWallEnds', id: 'h', a: V(-2, 0), b: V(10, 0) });
    keepAll(s.project, before);
  });

  it('(h) girar em torno de b mantém a distância à ponta fixa', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    const wall = s.project.elements.h;
    if (!wall || wall.kind !== 'wall') throw new Error('parede h sumiu');
    s.exec({ type: 'setWallEnds', id: 'h', b: V(0, 8) });
    const angle = Math.PI / 2;
    keepAll(s.project, new Map([...before].map(([id, w]) => [id, {
      center: applyTransform({ kind: 'rotate', about: wall.a, angle }, w.center),
      left: applyTransform({ kind: 'rotate', about: wall.a, angle }, w.left),
      right: applyTransform({ kind: 'rotate', about: wall.a, angle }, w.right),
    }])));
    expect((s.project.elements.d as { offset: number }).offset).toBeCloseTo(2, 9);
  });
});

describe('(i) translação e rotação da parede inteira levam as aberturas', () => {
  it('transladar acompanha a abertura', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    const t = { kind: 'translate' as const, d: V(3, 4) };
    s.exec({ type: 'transform', ids: ['h'], transform: t });
    keepAll(s.project, new Map([...before].map(([id, w]) => [id, {
      center: applyTransform(t, w.center),
      left: applyTransform(t, w.left),
      right: applyTransform(t, w.right),
    }])));
  });

  it('girar acompanha a abertura', () => {
    const s = cena();
    const before = snapshot(s.project, IDs);
    const t = { kind: 'rotate' as const, about: V(1, 1), angle: 0.7 };
    s.exec({ type: 'transform', ids: ['h'], transform: t });
    keepAll(s.project, new Map([...before].map(([id, w]) => [id, {
      center: applyTransform(t, w.center),
      left: applyTransform(t, w.left),
      right: applyTransform(t, w.right),
    }])));
  });
});

describe('(e) alça da ponta da parede', () => {
  function cenaAlca() {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(8, 0) }) });
    ctx.store.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-01' } });
    ctx.env.setSelection(['h']);
    return ctx;
  }

  it('arrastar a ponta b mantém a abertura', () => {
    const ctx = cenaAlca();
    const before = snapshot(ctx.store.project, ['d']);
    const hold = gripHoldAt(ctx.env, V(8, 0));
    if (!hold) throw new Error('alça b não encontrada');
    hold.drag(P(10, 0), () => V(10, 0));
    hold.release(P(10, 0), () => {});
    keepAll(ctx.store.project, before);
  });

  it('arrastar a ponta a mantém a abertura', () => {
    const ctx = cenaAlca();
    const before = snapshot(ctx.store.project, ['d']);
    const hold = gripHoldAt(ctx.env, V(0, 0));
    if (!hold) throw new Error('alça a não encontrada');
    hold.drag(P(-2, 0), () => V(-2, 0));
    hold.release(P(-2, 0), () => {});
    keepAll(ctx.store.project, before);
  });
});

describe('(d) Aparar nos três modos', () => {
  it('canto: parede aparada e referência mantêm as aberturas', () => {
    const ctx = cenaAparar();
    const before = snapshot(ctx.store.project, ['dh', 'dv']);
    ctx.options.trimMode = 'canto';
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    clickAt(t, 5, 1);
    keepAll(ctx.store.project, before);
  });

  it('um elemento: só a parede escolhida muda e a abertura fica', () => {
    const ctx = cenaAparar();
    const before = snapshot(ctx.store.project, ['dh', 'dv']);
    ctx.options.trimMode = 'unico';
    const t = tool('trim', ctx.env);
    clickAt(t, 5, 1);
    clickAt(t, 1, 0);
    keepAll(ctx.store.project, before);
  });

  it('vários: a lista é aparada e as aberturas ficam', () => {
    const ctx = cenaAparar();
    const before = snapshot(ctx.store.project, ['dh', 'dv']);
    ctx.options.trimMode = 'varios';
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0, { shift: true });
    clickAt(t, 5, 1);
    keepAll(ctx.store.project, before);
  });
});

describe('(f) cota axial e lateral', () => {
  function retangulo(): ProjectStore {
    const s = new ProjectStore(createEmptyProject());
    const segs: Array<[string, Vec2, Vec2]> = [['b', V(0, 0), V(6, 0)], ['r', V(6, 0), V(6, 4)], ['t', V(6, 4), V(0, 4)], ['l', V(0, 4), V(0, 0)]];
    for (const [id, a, b] of segs) s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b }) });
    s.exec({ type: 'addOpening', opening: { id: 'db', kind: 'door', typeId: 'ot_p80', hostId: 'b', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    s.exec({ type: 'addOpening', opening: { id: 'dr', kind: 'door', typeId: 'ot_p80', hostId: 'r', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    s.exec({ type: 'addOpening', opening: { id: 'dl', kind: 'door', typeId: 'ot_p80', hostId: 'l', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    return s;
  }

  it('cota lateral: as vizinhas esticam sem mover as aberturas', () => {
    const s = retangulo();
    const beforeR = worldOf(s.project, 'dr');
    const beforeL = worldOf(s.project, 'dl');
    const beforeB = worldOf(s.project, 'db');
    const beforeA = wallA(s, 'b');
    edita(s, 'b', ':right', 5);
    const move = { x: wallA(s, 'b').x - beforeA.x, y: wallA(s, 'b').y - beforeA.y };
    sameOpening(worldOf(s.project, 'dr'), beforeR);
    sameOpening(worldOf(s.project, 'dl'), beforeL);
    sameOpening(worldOf(s.project, 'db'), translated(beforeB, move));
  });

  it('cota axial: a parede transladada leva a abertura', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(6, 0) }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'r', typeId: 'wt_alv14', levelId: 'lv_0', a: V(8, -2), b: V(8, 2) }) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const before = worldOf(s.project, 'd');
    const beforeA = wallA(s, 'h');
    const gap = dimsOf(s, 'h').find((d) => d.key.endsWith(':axisB'));
    if (!gap) throw new Error('cota axial ausente');
    edita(s, 'h', ':axisB', gap.value + 1);
    const move = { x: wallA(s, 'h').x - beforeA.x, y: wallA(s, 'h').y - beforeA.y };
    sameOpening(worldOf(s.project, 'd'), translated(before, move));
  });
});

describe('(g) vizinhas e cópias', () => {
  function cenaL() {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'm', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(6, 0) }) });
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'v', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(0, 4) }) });
    ctx.store.exec({ type: 'addOpening', opening: { id: 'dm', kind: 'door', typeId: 'ot_p80', hostId: 'm', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    ctx.store.exec({ type: 'addOpening', opening: { id: 'dv', kind: 'door', typeId: 'ot_p80', hostId: 'v', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    return ctx;
  }

  it('mover a parede estica a vizinha sem mover a abertura dela', () => {
    const ctx = cenaL();
    const beforeV = worldOf(ctx.store.project, 'dv');
    const beforeM = worldOf(ctx.store.project, 'dm');
    moveWalls(ctx.env, ['m'], V(0, 1));
    sameOpening(worldOf(ctx.store.project, 'dv'), beforeV);
    sameOpening(worldOf(ctx.store.project, 'dm'), {
      center: applyTransform({ kind: 'translate', d: V(0, 1) }, beforeM.center),
      left: applyTransform({ kind: 'translate', d: V(0, 1) }, beforeM.left),
      right: applyTransform({ kind: 'translate', d: V(0, 1) }, beforeM.right),
    });
  });

  it('copiar leva a abertura no mesmo deslocamento', () => {
    const ctx = cenaL();
    const before = worldOf(ctx.store.project, 'dm');
    const [nova] = copyWalls(ctx.env, ['m'], { kind: 'translate', d: V(0, 3) });
    const copia = Object.values(ctx.store.project.elements).find((e) => isOpening(e) && e.hostId === nova);
    if (!copia) throw new Error('abertura copiada não encontrada');
    sameOpening(worldOf(ctx.store.project, copia.id), {
      center: applyTransform({ kind: 'translate', d: V(0, 3) }, before.center),
      left: applyTransform({ kind: 'translate', d: V(0, 3) }, before.left),
      right: applyTransform({ kind: 'translate', d: V(0, 3) }, before.right),
    });
  });
});

describe('(j) parede curva: regra pelo comprimento de arco', () => {
  function cenaArco(): { s: ProjectStore; arc: NonNullable<ReturnType<typeof arcFromSagitta>>; offset: number } {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'c', typeId: 'wt_alv14', levelId: 'lv_0', a: V(0, 0), b: V(8, 0), sag: 1 }) });
    const arc = arcFromSagitta(V(0, 0), V(8, 0), 1);
    if (!arc) throw new Error('arco inválido');
    const offset = arc.length / 2;
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'c', offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    return { s, arc, offset };
  }

  it('aparar b na mesma circunferência mantém a abertura no mundo', () => {
    const { s, arc, offset } = cenaArco();
    const before = worldOf(s.project, 'd');
    const corte = arcPointAt(arc, 6);
    const sag = sagFromThreePoints(V(0, 0), arcPointAt(arc, 3), corte);
    for (const c of patchCommands([{ id: 'c', patch: { b: corte, sag } }])) s.exec(c);
    sameOpening(worldOf(s.project, 'd'), before);
    expect((s.project.elements.d as { offset: number }).offset).toBeCloseTo(offset, 9);
  });

  it('aparar a na mesma circunferência mantém a abertura no mundo', () => {
    const { s, arc } = cenaArco();
    const before = worldOf(s.project, 'd');
    const corte = arcPointAt(arc, 2);
    const sag = sagFromThreePoints(corte, arcPointAt(arc, 5), V(8, 0));
    for (const c of patchCommands([{ id: 'c', patch: { a: corte, sag } }])) s.exec(c);
    sameOpening(worldOf(s.project, 'd'), before);
  });

  it('estender só b mantém o comprimento de arco até a', () => {
    const { s, arc, offset } = cenaArco();
    s.exec({ type: 'setWallEnds', id: 'c', b: V(10, 0) });
    const d = s.project.elements.d;
    if (!d || !isOpening(d)) throw new Error('abertura sumiu');
    expect(d.offset).toBeCloseTo(offset, 9);
    expect(arc.length).toBeGreaterThan(offset);
  });
});
