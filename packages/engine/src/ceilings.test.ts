import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_CEILING_TYPES, ProjectStore, createEmptyProject, makeCeiling, makeRoom, makeWall, type Project } from '@hestia/model';
import { buildCeilingSchedule, ceilingDraftsFromRooms, ceilingIssues, ceilingScheduleToCsv, quantifyCeilings, resolveCeilings } from './index.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x0, y: y1 },
  { x: x1, y: y1 },
  { x: x1, y: y0 },
];

/** Paredes de um retângulo (face interna = anel), como em rooms.test.ts. */
function walls(s: ProjectStore, pts: Vec2[], prefix: string, levelId = 'lv_0'): void {
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `${prefix}_${i}`, typeId: 'wt_alv14', levelId, a, b, locationLine: 'finishInterior' }) });
  });
}

const gesso = DEFAULT_CEILING_TYPES.find((t) => t.id === 'ct_gesso')!;
const gessoThickness = gesso.layers.reduce((t, l) => t + l.thickness, 0);

function withCeiling(extra: Partial<ReturnType<typeof makeCeiling>> = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(0, 0, 4, 5), ...extra }) });
  return s.project;
}

/** Projeto com um forro gravado direto, sem a validação do comando (como um arquivo malformado). */
function rawCeiling(extra: Partial<ReturnType<typeof makeCeiling>>): Project {
  const p = createEmptyProject();
  p.elements.c1 = { ...makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(0, 0, 4, 5), ...extra }), order: 1 };
  return p;
}

describe('resolveCeilings', () => {
  it('o topo fica na cota do nível mais o deslocamento; as camadas descem a partir dele', () => {
    const p = withCeiling({ heightOffset: 2.6 });
    const [r] = resolveCeilings(p, 'lv_0');
    expect(r).toBeDefined();
    expect(r!.topZ).toBeCloseTo(2.6, 9);
    expect(r!.bottomZ).toBeCloseTo(2.6 - gessoThickness, 9);
    expect(r!.layers[0]).toMatchObject({ layerIndex: 0, materialId: 'mat_perfil' });
    expect(r!.layers[0]!.z1).toBeCloseTo(2.6, 9);
  });

  it('a cota do nível entra: forro no pavimento 2 (elevação 3 m)', () => {
    const p = withCeiling({ levelId: 'lv_1', heightOffset: 2.6 });
    expect(resolveCeilings(p, 'lv_1')[0]!.topZ).toBeCloseTo(5.6, 9);
  });

  it('tipo ausente ou contorno com menos de 3 pontos não geram geometria', () => {
    expect(resolveCeilings(rawCeiling({ typeId: 'nao_existe' }), 'lv_0')).toHaveLength(0);
    expect(resolveCeilings(rawCeiling({ boundary: sq(0, 0, 1, 1).slice(0, 2) }), 'lv_0')).toHaveLength(0);
  });

  it('camada de espessura zero não entra na pilha', () => {
    const p = withCeiling({ typeId: 'ct_laje' });
    const [r] = resolveCeilings(p, 'lv_0');
    expect(r!.layers).toHaveLength(1);
  });
});

describe('ceilingDraftsFromRooms (forro por ambiente)', () => {
  it('cria um rascunho por ambiente com o contorno e o pé-direito do ambiente', () => {
    const s = new ProjectStore(createEmptyProject());
    walls(s, sq(0, 0, 4, 5), 'w');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 }, ceilingHeight: 2.9 }) });
    const drafts = ceilingDraftsFromRooms(s.project, 'lv_0', 'ct_gesso', (i) => `fx${i}`);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id: 'fx0', kind: 'ceiling', typeId: 'ct_gesso', levelId: 'lv_0', roomId: 'r1', heightOffset: 2.9, mark: '101' });
    expect(drafts[0]!.holes).toEqual([]);
  });

  it('ambiente sem circuito fechado não gera forro', () => {
    const s = new ProjectStore(createEmptyProject());
    // Duas paredes só: poligonal aberta, sem circuito fechado em volta do ponto.
    s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, locationLine: 'finishInterior' }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'b', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 5 }, locationLine: 'finishInterior' }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 2, y: 2 } }) });
    expect(ceilingDraftsFromRooms(s.project, 'lv_0', 'ct_gesso', (i) => `fx${i}`)).toHaveLength(0);
  });

  it('o lote do comando cria os forros com um só desfazer', () => {
    const s = new ProjectStore(createEmptyProject());
    walls(s, sq(0, 0, 4, 5), 'w');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 2, y: 2.5 } }) });
    const drafts = ceilingDraftsFromRooms(s.project, 'lv_0', 'ct_gesso', (i) => `fx${i}`);
    s.exec({ type: 'addCeilings', ceilings: drafts });
    expect(buildCeilingSchedule(s.project).rows).toHaveLength(1);
    s.undo();
    expect(buildCeilingSchedule(s.project).rows).toHaveLength(0);
  });
});

describe('quantitativos e tabela', () => {
  it('área líquida desconta furos; volume é a soma das camadas', () => {
    const p = withCeiling({ holes: [sq(1, 1, 2, 2)] });
    const q = quantifyCeilings(p, 'lv_0');
    expect(q.totalArea).toBeCloseTo(19, 9);
    expect(q.totalVolume).toBeCloseTo(19 * gessoThickness, 9);
    expect(q.ceilings[0]!.layers.reduce((s, l) => s + l.volume, 0)).toBeCloseTo(q.totalVolume, 9);
  });

  it('a tabela traz tipo, ambiente, topo e face inferior; o total soma as áreas', () => {
    const p = withCeiling({ roomId: 'r1', mark: 'F1' });
    const sch = buildCeilingSchedule(p);
    expect(sch.rows[0]).toMatchObject({ mark: 'F1', typeName: gesso.name, typeCode: 'FR-01', levelName: 'Térreo', roomName: '', heightOffset: 2.6 });
    expect(sch.rows[0]!.underside).toBeCloseTo(2.6 - gessoThickness, 9);
    expect(sch.totals.count).toBe(1);
    expect(sch.totals.area).toBeCloseTo(20, 9);
  });

  it('CSV com ponto e vírgula, decimal com vírgula, BOM e linha de total', () => {
    const csv = ceilingScheduleToCsv(buildCeilingSchedule(withCeiling({ mark: 'F;1' })).rows, buildCeilingSchedule(withCeiling()).totals);
    expect(csv.startsWith('﻿Marca;Tipo;Código;Nível;Ambiente;Área (m²);')).toBe(true);
    expect(csv).toContain('"F;1";Forro de gesso 12,5 mm;FR-01;Térreo;;20,00;');
    expect(csv.trimEnd().split('\r\n').at(-1)).toMatch(/^Total;;;;;20,00;/);
  });
});

describe('ceilingIssues', () => {
  it('sem avisos para um forro normal, abaixo das paredes', () => {
    const s = new ProjectStore(createEmptyProject());
    walls(s, sq(0, 0, 4, 5), 'w');
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(0, 0, 4, 5) }) });
    expect(ceilingIssues(s.project)).toEqual([]);
  });

  it('avisa forro acima da parede mais baixa do nível', () => {
    const s = new ProjectStore(createEmptyProject());
    walls(s, sq(0, 0, 4, 5), 'w');
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(0, 0, 4, 5), heightOffset: 3.2 }) });
    expect(ceilingIssues(s.project)).toEqual([expect.objectContaining({ severity: 'warning', code: 'ceiling-above-wall', elementId: 'c1' })]);
  });

  it('erro para contorno curto e para tipo ausente (o comando já impede, mas um arquivo pode trazer)', () => {
    expect(ceilingIssues(rawCeiling({ boundary: [{ x: 0, y: 0 }] })).map((i) => i.code)).toEqual(['ceiling-no-boundary']);
    expect(ceilingIssues(rawCeiling({ typeId: 'nao_existe' })).map((i) => i.code)).toEqual(['ceiling-type-missing']);
  });
});
