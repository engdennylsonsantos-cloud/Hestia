import { describe, expect, it } from 'vitest';
import { multiArea, unionClipper, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Project } from '@hestia/model';
import { computeSection, type SectionResult } from './index.ts';

/**
 * Corte: a junção decide quem fica com a zona comum de piso (ou laje) e parede (decisão 0023 §3, regra B, igual ao Revit
 * e ao ArchiCAD). O elemento de prioridade maior mantém a zona e o outro perde só essa parte. A parede que sai do piso
 * continua visível do lado de fora. Os totais do corte não somam duas vezes a zona comum.
 */

const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const LINE = { a: { x: 3, y: -1 }, b: { x: 3, y: 5 }, depth: 2 };

/** Projeto com piso ft_ceram (z de -0,19 a 0) e, opcionalmente, uma parede de z -0,10 a -0,05 cruzando a linha. */
function project(withWall: boolean, withFloor = true): Project {
  const s = new ProjectStore(createEmptyProject());
  if (withFloor) s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
  if (withWall) {
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 2 }, b: { x: 6, y: 2 }, height: 0.05, baseOffset: -0.1 }),
    });
  }
  return s.project;
}

const areaOf = (polygons: MultiPolygon): number => multiArea(polygons);
const cutTotal = (r: SectionResult): number => areaOf(unionClipper(...r.cut.map((c) => c.polygons)));
const wallCut = (r: SectionResult, wallId: string): number =>
  r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin.wallId === wallId).reduce((s, q) => s + areaOf(q.polygons), 0), 0);

describe('corte: a cota decide o que fica por cima (P6)', () => {
  it('parede embutida no piso: o piso fica com a zona comum (regra B) e o total do conjunto é a união', () => {
    const alone = computeSection(project(true, false), LINE);
    const floorAlone = computeSection(project(false), LINE);
    const both = computeSection(project(true), LINE);

    const wallAlone = wallCut(alone, 'w1');
    expect(wallAlone).toBeGreaterThan(0);
    // a parede perde a zona em que a estrutura do piso vence: o corte dela fica menor que sozinha
    expect(wallCut(both, 'w1')).toBeLessThan(wallAlone - 1e-9);
    // a zona comum aparece uma vez só: parede + piso somam a união, e a união é o próprio piso (a parede está dentro dele)
    expect(cutTotal(both)).toBeCloseTo(cutTotal(floorAlone), 6);
  });

  it('parede que sai do piso: fora do piso a parede fica inteira; dentro, cede à zona comum', () => {
    const wallOut = (): Project => {
      const t = new ProjectStore(createEmptyProject());
      t.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
      t.exec({
        type: 'addWall',
        wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -2, y: 2 }, b: { x: 6, y: 2 }, height: 0.05, baseOffset: -0.1 }),
      });
      return t.project;
    };
    const wallOnly = (): Project => {
      const t = new ProjectStore(createEmptyProject());
      t.exec({
        type: 'addWall',
        wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -2, y: 2 }, b: { x: 6, y: 2 }, height: 0.05, baseOffset: -0.1 }),
      });
      return t.project;
    };
    const LINE_OUT = { a: { x: -1, y: -1 }, b: { x: -1, y: 5 }, depth: 2 };
    // fora do piso (x = -1): a parede aparece inteira, como sozinha
    expect(wallCut(computeSection(wallOut(), LINE_OUT), 'w1')).toBeCloseTo(wallCut(computeSection(wallOnly(), LINE_OUT), 'w1'), 6);
    // dentro do piso (x = 3): a parede cede à zona comum
    expect(wallCut(computeSection(wallOut(), LINE), 'w1')).toBeLessThan(wallCut(computeSection(wallOnly(), LINE), 'w1') - 1e-9);
  });

  it('a ordem de inserção não muda o resultado: parede antes ou depois do piso no projeto', () => {
    const s1 = new ProjectStore(createEmptyProject());
    s1.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
    s1.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 2 }, b: { x: 6, y: 2 }, height: 0.05, baseOffset: -0.1 }) });
    const s2 = new ProjectStore(createEmptyProject());
    s2.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 2 }, b: { x: 6, y: 2 }, height: 0.05, baseOffset: -0.1 }) });
    s2.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
    const r1 = computeSection(s1.project, LINE);
    const r2 = computeSection(s2.project, LINE);
    expect(wallCut(r1, 'w1')).toBeCloseTo(wallCut(r2, 'w1'), 9);
    expect(cutTotal(r1)).toBeCloseTo(cutTotal(r2), 9);
    expect(wallCut(r2, 'w1')).toBeGreaterThan(0);
  });

  it('piso mais alto sobre laje mais baixa (sobreposição de cota): regra B, a laje estrutural corta o piso na faixa comum', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, heightOffset: 0.12 }) });
    const r = computeSection(s.project, LINE);
    const floorArea = r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin.floorId === 'f1').reduce((x, q) => x + areaOf(q.polygons), 0), 0);
    const slabArea = r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin.slabId === 'l1').reduce((x, q) => x + areaOf(q.polygons), 0), 0);
    const slabOnly = new ProjectStore(createEmptyProject());
    slabOnly.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
    const slabAlone = computeSection(slabOnly.project, LINE);
    const floorAlone = computeSection(project(false), LINE);
    // laje (topo 0) vence o piso (topo 0,12) na faixa comum (regra B, 0023 §1.3): a laje sai inteira e o piso perde essa faixa
    expect(slabArea).toBeCloseTo(cutTotal(slabAlone), 6);
    expect(floorArea).toBeLessThan(cutTotal(floorAlone) - 1e-9);
    expect(floorArea + slabArea).toBeCloseTo(cutTotal(r), 6);
  });
});
