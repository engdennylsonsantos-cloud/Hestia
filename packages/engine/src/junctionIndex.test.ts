import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project } from '@hestia/model';
import { horizontaisDoProjeto } from './junctionIndex.ts';

/** Horizontais por projeto: pisos, lajes, escadas e telhados do projeto inteiro, na ordem do projeto; cache por snapshot. */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function projeto(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f2', typeId: 'ft_ceram', levelId: 'lv_1', boundary: rect(0, 0, 4, 3) }) });
  return s.project;
}

describe('horizontais do projeto (junctionIndex)', () => {
  it('lista pisos do projeto inteiro, na ordem do projeto, sem paredes', () => {
    expect(horizontaisDoProjeto(projeto()).map((e) => e.id)).toEqual(['f1', 'f2']);
  });

  it('cache por snapshot: o mesmo projeto devolve a mesma lista; projeto novo monta outra', () => {
    const p = projeto();
    const q: Project = { ...p, elements: { ...p.elements } };
    expect(horizontaisDoProjeto(p)).toBe(horizontaisDoProjeto(p));
    expect(horizontaisDoProjeto(q)).not.toBe(horizontaisDoProjeto(p));
  });
});
