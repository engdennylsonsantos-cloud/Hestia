import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, validateProject, type WallType } from '@hestia/model';
import { cornerMiterCommands } from './cornerFix.ts';

const W = (id: string, a: [number, number], b: [number, number], extra: Record<string, unknown> = {}) =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, ...extra });

/** Tipo de parede sem acabamento: só a camada estrutural do PA-14. */
function bareType(store: ProjectStore): WallType {
  const base = store.project.wallTypes['wt_alv14']!;
  return { ...base, id: 'wt_bare', layers: base.layers.filter((l) => l.function === 'structure') };
}

function store(): ProjectStore {
  return new ProjectStore(createEmptyProject());
}

describe('cornerMiterCommands (quinas em encosto com acabamento)', () => {
  it('uma quina L com acabamento vira um setJoin em esquadria nas duas pontas', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    const cmds = cornerMiterCommands(s.project);
    expect(cmds).toEqual([
      { type: 'setJoin', ends: [{ wallId: 'a', end: 'b' }, { wallId: 'b', end: 'a' }], config: { kind: 'miter', flip: false } },
    ]);
  });

  it('aplicar os comandos zera o aviso e a segunda chamada devolve lista vazia (idempotente)', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    for (const c of cornerMiterCommands(s.project)) s.exec(c);
    expect(s.project.elements['a']).toMatchObject({ joinEnd: { kind: 'miter' } });
    expect(s.project.elements['b']).toMatchObject({ joinStart: { kind: 'miter' } });
    expect(validateProject(s.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('sem acabamento em nenhuma das paredes não gera comandos', () => {
    const s = store();
    s.exec({ type: 'upsertWallType', wallType: bareType(s) });
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { typeId: 'wt_bare' }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3], { typeId: 'wt_bare' }) });
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('acabamento em só uma das paredes basta', () => {
    const s = store();
    s.exec({ type: 'upsertWallType', wallType: bareType(s) });
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { typeId: 'wt_bare' }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    expect(cornerMiterCommands(s.project)).toHaveLength(1);
  });

  it('T e paredes colineares não entram', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('c', [2, 0], [2, 3]) }); // T: nenhuma ponta coincide
    s.exec({ type: 'addWall', wall: W('d', [4, 0], [8, 0]) }); // colinear
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('quina já em esquadria (ou em ângulo agudo) não entra', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: { kind: 'miter', flip: false } }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    expect(cornerMiterCommands(s.project)).toEqual([]);
    const t = store();
    t.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    t.exec({ type: 'addWall', wall: W('b', [4, 0], [0, 3]) }); // ~37°: fora de 70°–110°
    expect(cornerMiterCommands(t.project)).toEqual([]);
  });

  it('filtra por nível: só as quinas do nível pedido', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    s.exec({ type: 'addWall', wall: W('c', [0, 0], [0, 3], { levelId: 'lv_1' }) });
    s.exec({ type: 'addWall', wall: W('d', [0, 3], [4, 3], { levelId: 'lv_1' }) });
    expect(cornerMiterCommands(s.project, 'lv_1').map((c) => c.ends.map((e) => e.wallId))).toEqual([['c', 'd']]);
    expect(cornerMiterCommands(s.project, 'lv_0')).toHaveLength(1);
    expect(cornerMiterCommands(s.project)).toHaveLength(2);
  });

  it('filtra por parede: só as quinas que tocam a parede pedida', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    s.exec({ type: 'addWall', wall: W('c', [4, 3], [0, 3]) });
    expect(cornerMiterCommands(s.project, undefined, 'c')).toHaveLength(1);
    expect(cornerMiterCommands(s.project, undefined, 'b')).toHaveLength(2);
    expect(cornerMiterCommands(s.project, undefined, 'zz')).toEqual([]);
  });
});

describe('cornerMiterCommands (quinas em esquadro com acabamento, decisão 0009 #10)', () => {
  const SQ = { kind: 'square' as const, flip: false };
  const MITER_ENDS = { type: 'setJoin', config: { kind: 'miter', flip: false } };

  it('esquadro 90° com acabamento vira setJoin em esquadria nas duas pontas', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3], { joinStart: SQ }) });
    expect(cornerMiterCommands(s.project)).toEqual([{ ...MITER_ENDS, ends: [{ wallId: 'a', end: 'b' }, { wallId: 'b', end: 'a' }] }]);
  });

  it('esquadro com encosto do outro lado também converte', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    expect(cornerMiterCommands(s.project)).toHaveLength(1);
  });

  it('esquadro sem acabamento em nenhuma das paredes não gera comandos', () => {
    const s = store();
    s.exec({ type: 'upsertWallType', wallType: bareType(s) });
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { typeId: 'wt_bare', joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3], { typeId: 'wt_bare', joinStart: SQ }) });
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('esquadro com ângulo de 45° não entra', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [1, 3], { joinStart: SQ }) });
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('T e colineares com esquadro não entram', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('c', [2, 0], [2, 3], { joinStart: SQ }) });
    s.exec({ type: 'addWall', wall: W('d', [4, 0], [8, 0], { joinStart: SQ }) });
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });

  it('lote em esquadro: aplicar zera o aviso e a segunda chamada devolve lista vazia (idempotente)', () => {
    const s = store();
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0], { joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3], { joinStart: SQ }) });
    for (const c of cornerMiterCommands(s.project)) s.exec(c);
    expect(s.project.elements['a']).toMatchObject({ joinEnd: { kind: 'miter' } });
    expect(s.project.elements['b']).toMatchObject({ joinStart: { kind: 'miter' } });
    expect(validateProject(s.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
    expect(cornerMiterCommands(s.project)).toEqual([]);
  });
});
