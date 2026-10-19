import { isFloor, type Id, type Project } from '@hestia/model';
import { csvDocument, csvText, formatDecimal } from './csv.ts';
import { quantifyFloors } from './floorQuantities.ts';

/** Um piso na tabela. Unidades: m, m² e m³. */
export interface FloorScheduleRow {
  floorId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  levelId: Id;
  levelName: string;
  area: number;
  perimeter: number;
  thickness: number;
  volume: number;
  /** Deslocamento do topo em relação ao nível (m). */
  heightOffset: number;
}

export interface FloorScheduleTotals {
  count: number;
  area: number;
  perimeter: number;
  volume: number;
}

export interface FloorSchedule {
  rows: FloorScheduleRow[];
  totals: FloorScheduleTotals;
}

export interface FloorScheduleFilter {
  typeId?: Id;
  levelId?: Id;
}

/** Tabela de pisos do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). */
export function buildFloorSchedule(p: Project): FloorSchedule {
  const rows: FloorScheduleRow[] = [];
  for (const level of p.levels) {
    for (const q of quantifyFloors(p, level.id).floors) {
      const e = p.elements[q.floorId];
      if (!isFloor(e)) continue;
      const t = p.floorTypes[q.typeId];
      rows.push({
        floorId: q.floorId,
        mark: e.mark,
        typeId: q.typeId,
        typeName: t?.name ?? q.typeId,
        typeCode: t?.code ?? '',
        levelId: q.levelId,
        levelName: level.name,
        area: q.area,
        perimeter: q.perimeter,
        thickness: q.thickness,
        volume: q.volume,
        heightOffset: e.heightOffset,
      });
    }
  }
  return { rows, totals: sumFloorRows(rows) };
}

/** Linhas que passam pelos filtros de tipo e de nível (sem filtro, todas). */
export const filterFloorRows = (rows: FloorScheduleRow[], f: FloorScheduleFilter): FloorScheduleRow[] =>
  rows.filter((r) => (f.typeId === undefined || r.typeId === f.typeId) && (f.levelId === undefined || r.levelId === f.levelId));

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumFloorRows(rows: FloorScheduleRow[]): FloorScheduleTotals {
  return rows.reduce<FloorScheduleTotals>(
    (t, r) => ({ count: t.count + 1, area: t.area + r.area, perimeter: t.perimeter + r.perimeter, volume: t.volume + r.volume }),
    { count: 0, area: 0, perimeter: 0, volume: 0 },
  );
}

const CSV_HEADER = ['Marca', 'Tipo', 'Código', 'Nível', 'Área (m²)', 'Perímetro (m)', 'Espessura (m)', 'Volume (m³)', 'Deslocamento (m)'];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato da tabela de
 * paredes). Uma linha por piso, seguida de uma linha de total.
 */
export function floorScheduleToCsv(rows: FloorScheduleRow[], totals: FloorScheduleTotals): string {
  const n = formatDecimal;
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.levelName),
    n(r.area, 2),
    n(r.perimeter, 2),
    n(r.thickness, 3),
    n(r.volume, 3),
    n(r.heightOffset, 3),
  ]);
  const total = ['Total', '', '', '', n(totals.area, 2), n(totals.perimeter, 2), '', n(totals.volume, 3), ''];
  return csvDocument([CSV_HEADER, ...body, total]);
}
