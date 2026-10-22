import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Floor, type Project, type Wall } from '@hestia/model';
import { wallFloorIssues } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;

function build(walls: W[], floors: Array<Omit<Floor, 'order'>> = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  return s.project;
}

/** Parede de 4 m de (0,0) a (4,0), térreo. */
const wall4 = (extra: Partial<W> = {}): W => makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, ...extra });
const piso = (boundary: Array<{ x: number; y: number }>): Omit<Floor, 'order'> => makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary, heightOffset: 0.05 });

describe('P9 · avisos de parede anexada a piso ou laje', () => {
  it('piso cobre só metade do eixo: wall-floor-partial informativo, com a frase de trecho', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [piso(rect(-1, -1, 2, 1))]);
    const issues = wallFloorIssues(p);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'info', code: 'wall-floor-partial', elementId: 'w1' });
    expect(issues[0]!.message).toContain('só 2,00 m dos 4,00 m');
    expect(issues[0]!.message).toContain('só o trecho coberto foi ajustado');
  });

  it('anexada sem nenhum piso sobre o eixo: wall-attach-none (aviso)', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [piso(rect(10, 10, 12, 12))]);
    expect(wallFloorIssues(p)).toEqual([expect.objectContaining({ severity: 'warning', code: 'wall-attach-none', elementId: 'w1' })]);
  });

  it('parede totalmente coberta não avisa', () => {
    const p = build([wall4({ attachBottomToFloor: true })], [piso(rect(-1, -1, 5, 1))]);
    expect(wallFloorIssues(p)).toEqual([]);
  });

  it('sem o anexo não avisa, mesmo sem piso sobre o eixo', () => {
    const p = build([wall4({ attachBottomToFloor: false })], [piso(rect(10, 10, 12, 12))]);
    expect(wallFloorIssues(p)).toEqual([]);
  });

  it('topo anexado sem laje no nível de topo: wall-attach-none com a frase do topo', () => {
    const p = build([wall4({ topLevelId: 'lv_1', attachTopToFloor: true })]);
    const issues = wallFloorIssues(p);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'wall-attach-none' });
    expect(issues[0]!.message).toContain('topo');
  });

  it('topo ajustado ao telhado não é avaliado pelo aviso de piso', () => {
    const p = build([wall4({ topLevelId: 'lv_1', attachTopToFloor: true, attachTopToRoof: true })]);
    expect(wallFloorIssues(p)).toEqual([]);
  });
});
