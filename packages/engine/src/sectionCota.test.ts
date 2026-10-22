import { describe, expect, it } from 'vitest';
import { multiArea, unionClipper, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Project } from '@hestia/model';
import { computeSection, type SectionResult } from './index.ts';

/**
 * Corte: regiões de elementos diferentes no mesmo plano se ocultam pela cota, não pela ordem de inserção (decisão
 * 0023 §3, P6). A parede embutida no piso (contida na faixa de cotas dele) continua visível no corte; o piso perde
 * só a parte em comum e a área total do conjunto não cai.
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
  it('parede embutida no piso: a parede mantém corte > 0 e o total do conjunto não perde área', () => {
    const alone = computeSection(project(true, false), LINE);
    const floorAlone = computeSection(project(false), LINE);
    const both = computeSection(project(true), LINE);

    const wallAlone = wallCut(alone, 'w1');
    expect(wallAlone).toBeGreaterThan(0);
    // a parede aparece inteira, como sozinha
    expect(wallCut(both, 'w1')).toBeCloseTo(wallAlone, 6);
    // o piso perde só a faixa da parede: o total é a união das duas, que é o próprio piso (a parede está dentro dele)
    expect(cutTotal(both)).toBeCloseTo(cutTotal(floorAlone), 6);
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

  it('piso mais alto sobre laje mais baixa (sobreposição de cota): o piso fica por cima e a laje perde a faixa comum', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RECT }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, heightOffset: 0.12 }) });
    const r = computeSection(s.project, LINE);
    const floorArea = r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin.floorId === 'f1').reduce((x, q) => x + areaOf(q.polygons), 0), 0);
    const slabArea = r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin.slabId === 'l1').reduce((x, q) => x + areaOf(q.polygons), 0), 0);
    const floorAlone = computeSection(project(false), LINE);
    // o piso (topo 0,12) cobre a laje (topo 0) na faixa comum de -0,07 a 0 m. A laje vence o empate de prioridade pelo
    // tipo (laje corta piso, como nos quantitativos): a camada estrutural do piso perde 0,07 m × 4 m de corte (P7c, o
    // `cut` agora é por volume); acabamento e substrato, acima de 0, ficam inteiros. A laje fica inteira.
    expect(floorArea).toBeCloseTo(cutTotal(floorAlone) - 0.07 * 4, 6);
    expect(slabArea).toBeGreaterThan(0);
    expect(floorArea + slabArea).toBeCloseTo(cutTotal(r), 6);
  });
});
