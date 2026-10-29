import { describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf, makeWall, ProjectStore, type Project } from '@hestia/model';
import { openingDimProvider, type OpeningDimSubject } from './opening.ts';
import { neighborOpeningTargets } from './openingNeighbors.ts';
import { frameOfWall } from '@hestia/engine';
import type { DimContext } from '../types.ts';

/** Hospedeira `h` (0,0)-(6,0); perpendiculares em x = 1 e x = 5; porta d1 em 3 e outras (0,80) nos `offsets` dados. */
function cena(vizinhas: Array<[string, number]>): Project {
  const s = new ProjectStore(createEmptyProject());
  const wall = (id: string, a: [number, number], b: [number, number]) =>
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }) });
  wall('h', [0, 0], [6, 0]);
  wall('v1', [1, 0], [1, 3]);
  wall('v2', [5, 0], [5, -3]);
  for (const [id, offset] of [['d1', 3] as [string, number], ...vizinhas]) {
    s.exec({ type: 'addOpening', opening: { id, kind: 'door', typeId: 'ot_p80', hostId: 'h', offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  }
  return s.project;
}

const ctxOf = (p: Project): DimContext => ({ project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} });
const subject: OpeningDimSubject = { hostId: 'h', offset: 3, typeId: 'ot_p80', flipFacing: false, id: 'd1', side: 1 };

describe('cota da esquadria com vizinhas na mesma parede', () => {
  it('a vizinha mais próxima de cada lado vira o alvo (vão externo 0,80)', () => {
    const [esq, dir] = openingDimProvider.compute(ctxOf(cena([['d2', 1.8], ['d3', 4.3]])), subject);
    // Esquerda: borda da d1 em 2,6; borda direita da d2 em 2,2.
    expect(esq!.value).toBeCloseTo(0.4, 6);
    expect(esq!.ends[0].kind).toBe('opening');
    expect(esq!.a.x).toBeCloseTo(2.2, 6);
    // Direita: borda da d1 em 3,4; borda esquerda da d3 em 3,9.
    expect(dir!.value).toBeCloseTo(0.5, 6);
    expect(dir!.ends[0].kind).toBe('opening');
  });

  it('só uma vizinha: o outro lado continua na parede perpendicular', () => {
    const [esq, dir] = openingDimProvider.compute(ctxOf(cena([['d2', 1.8]])), subject);
    expect(esq!.ends[0].kind).toBe('opening');
    expect(dir!.ends[0].kind).toBe('wall');
    expect(dir!.value).toBeCloseTo(4.908 - 3.4, 6);
  });

  it('vizinha mais longe que a parede perpendicular não é alvo', () => {
    // Esquadria encostada na ponta esquerda, atrás da perpendicular v1 (face em 1,092).
    const [esq] = openingDimProvider.compute(ctxOf(cena([['d2', 0.5]])), subject);
    expect(esq!.ends[0].kind).toBe('wall');
    expect(esq!.value).toBeCloseTo(2.6 - 1.092, 6);
  });

  it('editar a medida até a vizinha reposiciona a esquadria', () => {
    const [esq] = openingDimProvider.compute(ctxOf(cena([['d2', 1.8]])), subject);
    const r = esq!.edit!(0.6);
    expect(r).toMatchObject({ commands: [{ type: 'updateElements', ids: ['d1'], patch: { offset: 2.2 + 0.6 + 0.4 } }] });
  });

  it('medida zero encosta a esquadria na vizinha; menor que isso sobrepõe e é recusada', () => {
    const [esq] = openingDimProvider.compute(ctxOf(cena([['d2', 1.8]])), subject);
    expect(esq!.edit!(0)).toMatchObject({ commands: [{ patch: { offset: 2.6 } }] });
    expect(esq!.edit!(-0.1)).toEqual({ error: expect.stringContaining('inválida') });
  });

  it('neighborOpeningTargets: sem vizinhas devolve null dos dois lados e ignora a própria', () => {
    const p = cena([]);
    const f = frameOfWall(p, 'h')!;
    expect(neighborOpeningTargets(p, f, 3, 'd1', 'frame', 1)).toEqual({ left: null, right: null });
    const r = neighborOpeningTargets(p, f, 3, undefined, 'frame', 1);
    // Sem excluir a própria, d1 (offset == 3) conta como vizinha da direita.
    expect(r.right?.ownerId).toBe('d1');
  });
});
