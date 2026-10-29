import { describe, expect, it } from 'vitest';
import { dist, type Vec2 } from '@hestia/geom';
import { createEmptyProject, dimensionSettingsOf, makeWall, ProjectStore, wallsOnLevel, type Project } from '@hestia/model';
import { wallDimProvider } from './wall.ts';
import type { TempDim } from '../types.ts';

type Seg = [string, [number, number], [number, number]];
interface Join {
  w1: string;
  e1: 'a' | 'b';
  w2: string;
  e2: 'a' | 'b';
}

const V = ([x, y]: [number, number]): Vec2 => ({ x, y });

function cena(segs: Seg[]): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  for (const [id, a, b] of segs) s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: V(a), b: V(b) }) });
  return s;
}

/** Todos os pares de pontas coincidentes no projeto (a junção a preservar). */
function joinsOf(p: Project): Join[] {
  const ws = wallsOnLevel(p, 'lv_0');
  const out: Join[] = [];
  for (const [i, w1] of ws.entries()) {
    for (const w2 of ws.slice(i + 1)) {
      for (const e1 of ['a', 'b'] as const) for (const e2 of ['a', 'b'] as const) if (dist(w1[e1], w2[e2]) < 1e-6) out.push({ w1: w1.id, e1, w2: w2.id, e2 });
    }
  }
  return out;
}

/** Maior folga entre as pontas que estavam unidas. */
function gap(p: Project, joins: Join[]): number {
  const pos = (id: string, e: 'a' | 'b'): Vec2 => {
    const w = p.elements[id];
    if (!w || w.kind !== 'wall') throw new Error(`parede ${id} sumiu`);
    return w[e];
  };
  return Math.max(0, ...joins.map((j) => dist(pos(j.w1, j.e1), pos(j.w2, j.e2))));
}

const dimsOf = (s: ProjectStore, id: string): TempDim[] =>
  wallDimProvider.compute({ project: s.project, levelId: 'lv_0', settings: dimensionSettingsOf(s.project), overrides: {} }, { wallId: id });

/** Edita a cota `key` da parede `id` para `v` num único passo de desfazer; devolve a mensagem e o valor remedido. */
function edita(s: ProjectStore, id: string, key: string, v: number): { note?: string; after: number | undefined } {
  const r = dimsOf(s, id).find((d) => d.key.endsWith(key))!.edit!(v);
  if (!('commands' in r)) throw new Error(r.error);
  s.transaction('Alterar cota', () => r.commands.forEach((c) => s.exec(c)));
  return { ...(r.note ? { note: r.note } : {}), after: dimsOf(s, id).find((d) => d.key.endsWith(key))?.value };
}

const wallAt = (s: ProjectStore, id: string): { a: Vec2; b: Vec2 } => {
  const w = s.project.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`parede ${id} sumiu`);
  return w;
};

const RETANGULO: Seg[] = [
  ['b', [0, 0], [6, 0]],
  ['r', [6, 0], [6, 4]],
  ['t', [6, 4], [0, 4]],
  ['l', [0, 4], [0, 0]],
];

describe('cota lateral da parede: as junções acompanham', () => {
  it.each([5, 3, 1.5])('retângulo: afastar/aproximar a parede de baixo (cota %s) estica os lados e mantém as quatro junções', (v) => {
    const s = cena(RETANGULO);
    const joins = joinsOf(s.project);
    expect(joins).toHaveLength(4);
    const before = JSON.stringify(s.project.elements);
    const { after } = edita(s, 'b', ':right', v);
    expect(Math.abs(after! - v)).toBeLessThan(1e-6);
    expect(gap(s.project, joins)).toBeLessThan(1e-6);
    // Um só passo de desfazer devolve tudo.
    s.undo();
    expect(JSON.stringify(s.project.elements)).toBe(before);
  });

  it('retângulo girado a 30 graus: a junção continua fechada e a medida confere', () => {
    const rot = (x: number, y: number): [number, number] => [x * Math.cos(Math.PI / 6) - y * Math.sin(Math.PI / 6), x * Math.sin(Math.PI / 6) + y * Math.cos(Math.PI / 6)];
    const s = cena(RETANGULO.map(([id, a, b]): Seg => [id, rot(...a), rot(...b)]));
    const joins = joinsOf(s.project);
    expect(joins).toHaveLength(4);
    const { after } = edita(s, 'b', ':right', 5);
    expect(Math.abs(after! - 5)).toBeLessThan(1e-6);
    expect(gap(s.project, joins)).toBeLessThan(1e-6);
  });

  it('junção oblíqua numa ponta: a junção continua fechada', () => {
    const s = cena([['h', [0, 0], [6, 0]], ['o', [6, 0], [8, 3]], ['p', [0, 3], [6, 3]], ['q', [0, 3], [0, 0]]]);
    const joins = joinsOf(s.project);
    const { after } = edita(s, 'h', ':right', 4);
    expect(Math.abs(after! - 4)).toBeLessThan(1e-6);
    expect(gap(s.project, joins)).toBeLessThan(1e-6);
  });

  it('ponta ligada a mais de uma parede: todas acompanham', () => {
    const s = cena([...RETANGULO, ['x', [6, 0], [9, -2]]]);
    const joins = joinsOf(s.project);
    expect(joins).toHaveLength(6);
    edita(s, 'b', ':right', 5);
    expect(gap(s.project, joins)).toBeLessThan(1e-6);
  });

  it('junção em T: a haste que termina no corpo da parede movida estica até a nova linha', () => {
    const s = cena([['h', [0, 0], [6, 0]], ['haste', [3, 0], [3, 3]], ['topo', [0, 3], [6, 3]]]);
    const { after } = edita(s, 'h', ':right', 5);
    expect(Math.abs(after! - 5)).toBeLessThan(1e-6);
    expect(wallAt(s, 'haste').a.y).toBeCloseTo(-2.184, 9);
    expect(wallAt(s, 'haste').a.x).toBeCloseTo(3, 9);
    expect(wallAt(s, 'haste').b).toEqual({ x: 3, y: 3 });
  });

  it('T pela ponta da haste: mover a parede da ponta mantém o encontro', () => {
    const s = cena([['haste', [3, 0], [3, 3]], ['h', [0, 3], [6, 3]], ['base', [0, 0], [6, 0]]]);
    const { after } = edita(s, 'base', ':right', 5);
    expect(Math.abs(after! - 5)).toBeLessThan(1e-6);
    expect(wallAt(s, 'haste').a.y).toBeCloseTo(-2.184, 9);
  });

  it('parede colinear ligada não é esticada: avisa e a parede movida segue o valor digitado', () => {
    const s = cena([['m', [0, 0], [3, 0]], ['c', [3, 0], [6, 0]], ['alvo', [0, 4], [3, 4]]]);
    const { note, after } = edita(s, 'm', ':right', 2);
    expect(note).toMatch(/alinhada/);
    expect(Math.abs(after! - 2)).toBeLessThan(1e-6);
    expect(wallAt(s, 'c')).toMatchObject({ a: { x: 3, y: 0 }, b: { x: 6, y: 0 } });
  });

  it('vizinha que ficaria com comprimento zero é solta, com aviso', () => {
    const s = cena([['b', [0, 0], [6, 0]], ['r', [6, 0], [6, 1]], ['t', [0, 3], [6, 3]]]);
    const { note } = edita(s, 'b', ':right', 1.816);
    expect(note).toMatch(/comprimento zero/);
  });

  it('deslocamento axial (cota da ponta até a perpendicular): a vizinha colinear acompanha', () => {
    const s = cena([['h', [0, 0], [6, 0]], ['c', [-3, 0], [0, 0]], ['p', [8, -2], [8, 2]]]);
    const joins = joinsOf(s.project);
    const key = dimsOf(s, 'h')[0]!.key;
    const { after } = edita(s, 'h', key.slice(key.lastIndexOf(':')), 1.5);
    expect(Math.abs(after! - 1.5)).toBeLessThan(1e-6);
    expect(gap(s.project, joins)).toBeLessThan(1e-6);
  });
});
