import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, type Floor, type Project } from '@hestia/model';
import { buildFloorSchedule, filterFloorRows, floorScheduleToCsv, sumFloorRows } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(floors: Array<Partial<Floor> & Pick<Floor, 'id' | 'boundary'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const f of floors) s.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_ceram', levelId: 'lv_0', ...f }) });
  return s.project;
}

const project = build([
  { id: 'f1', boundary: rect(0, 0, 4, 3), mark: 'P1' },
  { id: 'f2', boundary: rect(5, 0, 6, 2), mark: 'P;2', typeId: 'ft_laje12', heightOffset: 0.05 },
  { id: 'f3', boundary: rect(0, 0, 2, 2), levelId: 'lv_1', mark: 'P3', typeId: 'ft_ceram' },
]);
const schedule = buildFloorSchedule(project);

describe('tabela de pisos', () => {
  it('uma linha por piso, nível a nível e na ordem de criação', () => {
    expect(schedule.rows.map((r) => r.floorId)).toEqual(['f1', 'f2', 'f3']);
    expect(schedule.rows.map((r) => r.levelName)).toEqual(['Térreo', 'Térreo', 'Pavimento 2']);
  });

  it('colunas: marca, tipo, código, área, perímetro, espessura, volume e deslocamento', () => {
    const r = schedule.rows[0]!;
    expect(r).toMatchObject({ mark: 'P1', typeName: 'Cerâmico sobre contrapiso', typeCode: 'PS-01', area: 12, perimeter: 14, heightOffset: 0 });
    expect(r.thickness).toBeCloseTo(0.19, 9);
    expect(r.volume).toBeCloseTo(12 * 0.19, 9);
    expect(schedule.rows[1]!.heightOffset).toBeCloseTo(0.05, 9);
  });

  it('totais fecham com a soma das linhas', () => {
    expect(schedule.totals.count).toBe(3);
    expect(schedule.totals.area).toBeCloseTo(12 + 2 + 4, 9);
    expect(schedule.totals.volume).toBeCloseTo(schedule.rows.reduce((s, r) => s + r.volume, 0), 9);
    expect(sumFloorRows(schedule.rows.slice(0, 2)).count).toBe(2);
  });

  it('filtra por tipo e por nível, separadamente e juntos', () => {
    expect(filterFloorRows(schedule.rows, { typeId: 'ft_ceram' }).map((r) => r.floorId)).toEqual(['f1', 'f3']);
    expect(filterFloorRows(schedule.rows, { levelId: 'lv_0' }).map((r) => r.floorId)).toEqual(['f1', 'f2']);
    expect(filterFloorRows(schedule.rows, { typeId: 'ft_ceram', levelId: 'lv_1' }).map((r) => r.floorId)).toEqual(['f3']);
    expect(filterFloorRows(schedule.rows, {})).toHaveLength(3);
  });

  it('piso com tipo ausente não entra na tabela', () => {
    const base = build([{ id: 'ok', boundary: rect(0, 0, 1, 1) }]);
    const bad = { ...makeFloor({ id: 'bad', typeId: 'ft_nao_existe', levelId: 'lv_0', boundary: rect(0, 0, 1, 1) }), order: 9 };
    const p = { ...base, elements: { ...base.elements, bad } };
    expect(buildFloorSchedule(p).rows.map((r) => r.floorId)).toEqual(['ok']);
  });
});

describe('CSV da tabela de pisos', () => {
  const text = floorScheduleToCsv(schedule.rows, schedule.totals);
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('tem BOM UTF-8, separador ";" e uma linha por piso mais cabeçalho e total', () => {
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(lines).toHaveLength(schedule.rows.length + 2);
    expect(lines[0]).toBe('Marca;Tipo;Código;Nível;Área (m²);Perímetro (m);Espessura (m);Volume (m³);Deslocamento (m)');
    expect(lines.at(-1)!.startsWith('Total;')).toBe(true);
  });

  it('decimal com vírgula e texto com ";" entre aspas', () => {
    expect(lines[1]).toBe('P1;Cerâmico sobre contrapiso;PS-01;Térreo;12,00;14,00;0,190;2,280;0,000');
    expect(lines[2]!.startsWith('"P;2";')).toBe(true);
    expect(lines[2]!.endsWith(';0,050')).toBe(true);
  });

  it('a linha de total traz área e volume somados', () => {
    expect(lines.at(-1)).toBe(`Total;;;;${schedule.totals.area.toFixed(2).replace('.', ',')};${schedule.totals.perimeter.toFixed(2).replace('.', ',')};;${schedule.totals.volume.toFixed(3).replace('.', ',')};`);
  });
});
