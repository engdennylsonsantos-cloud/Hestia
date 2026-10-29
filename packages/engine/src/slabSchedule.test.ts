import { describe, expect, it } from 'vitest';
import { defaultUnits, ProjectStore, createEmptyProject, makeSlab, type Project, type Slab } from '@hestia/model';
import { buildSlabSchedule, filterSlabRows, slabScheduleToCsv, sumSlabRows } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(slabs: Array<Partial<Slab> & Pick<Slab, 'id' | 'boundary'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const x of slabs) s.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_mac12', levelId: 'lv_0', ...x }) });
  return s.project;
}

const project = build([
  { id: 's1', boundary: rect(0, 0, 4, 3), mark: 'L1' },
  { id: 's2', boundary: rect(5, 0, 6, 2), mark: 'L;2', typeId: 'ls_cobertura', heightOffset: 0.05, slope: { origin: { x: 5, y: 0 }, dir: { x: 1, y: 0 }, percent: 2 } },
  { id: 's3', boundary: rect(0, 0, 2, 2), levelId: 'lv_1', mark: 'L3', typeId: 'ls_mac12' },
]);
const schedule = buildSlabSchedule(project);

describe('E2 · tabela de lajes', () => {
  it('uma linha por laje, nível a nível e na ordem de criação', () => {
    expect(schedule.rows.map((r) => r.slabId)).toEqual(['s1', 's2', 's3']);
    expect(schedule.rows.map((r) => r.levelName)).toEqual(['Térreo', 'Térreo', 'Pavimento 2']);
  });

  it('colunas: marca, tipo, código, áreas, perímetro, espessura, volume, inclinação e deslocamento', () => {
    const r = schedule.rows[0]!;
    expect(r).toMatchObject({ mark: 'L1', typeName: 'Laje maciça 12', typeCode: 'LJ-12', planArea: 12, faceArea: 12, perimeter: 14, slopePercent: 0, heightOffset: 0 });
    expect(r.thickness).toBeCloseTo(0.12, 9);
    expect(r.volume).toBeCloseTo(12 * 0.12, 9);
    const sloped = schedule.rows[1]!;
    expect(sloped.slopePercent).toBe(2);
    expect(sloped.faceArea).toBeGreaterThan(sloped.planArea);
    expect(sloped.heightOffset).toBeCloseTo(0.05, 9);
  });

  it('totais fecham com a soma das linhas', () => {
    expect(schedule.totals.count).toBe(3);
    expect(schedule.totals.planArea).toBeCloseTo(12 + 2 + 4, 9);
    expect(schedule.totals.volume).toBeCloseTo(schedule.rows.reduce((s, r) => s + r.volume, 0), 9);
    expect(sumSlabRows(schedule.rows.slice(0, 2)).count).toBe(2);
  });

  it('filtra por tipo e por nível, separadamente e juntos', () => {
    expect(filterSlabRows(schedule.rows, { typeId: 'ls_mac12' }).map((r) => r.slabId)).toEqual(['s1', 's3']);
    expect(filterSlabRows(schedule.rows, { levelId: 'lv_0' }).map((r) => r.slabId)).toEqual(['s1', 's2']);
    expect(filterSlabRows(schedule.rows, { typeId: 'ls_mac12', levelId: 'lv_1' }).map((r) => r.slabId)).toEqual(['s3']);
    expect(filterSlabRows(schedule.rows, {})).toHaveLength(3);
  });

  it('laje com tipo ausente não entra na tabela', () => {
    const base = build([{ id: 'ok', boundary: rect(0, 0, 1, 1) }]);
    const bad = { ...makeSlab({ id: 'bad', typeId: 'ls_nao_existe', levelId: 'lv_0', boundary: rect(0, 0, 1, 1) }), order: 9 };
    const p = { ...base, elements: { ...base.elements, bad } };
    expect(buildSlabSchedule(p).rows.map((r) => r.slabId)).toEqual(['ok']);
  });
});

describe('CSV da tabela de lajes', () => {
  const text = slabScheduleToCsv(schedule.rows, schedule.totals, defaultUnits());
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('BOM UTF-8, separador ";", uma linha por laje mais cabeçalho e total', () => {
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(lines).toHaveLength(schedule.rows.length + 2);
    expect(lines[0]).toBe('Marca;Tipo;Código;Nível;Área em planta (m²);Área real (m²);Perímetro (m);Espessura (cm);Volume (m³);Inclinação (%);Deslocamento (m)');
    expect(lines.at(-1)!.startsWith('Total;')).toBe(true);
  });

  it('decimal com vírgula; texto com ";" entre aspas; inclinação e deslocamento na linha', () => {
    expect(lines[1]).toBe('L1;Laje maciça 12;LJ-12;Térreo;12,00;12,00;14,00;12,000;1,440;0,00;0,000');
    expect(lines[2]!.startsWith('"L;2";')).toBe(true);
    expect(lines[2]!.endsWith(';2,00;0,050')).toBe(true);
  });

  it('a linha de total traz as áreas e o volume somados', () => {
    expect(lines.at(-1)).toBe(
      `Total;;;;${schedule.totals.planArea.toFixed(2).replace('.', ',')};${schedule.totals.faceArea.toFixed(2).replace('.', ',')};${schedule.totals.perimeter.toFixed(2).replace('.', ',')};;${schedule.totals.volume.toFixed(3).replace('.', ',')};;`,
    );
  });
});
