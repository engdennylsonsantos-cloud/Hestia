import { isCeiling, levelElevation, type Id, type Project, type ResolvedUnits } from '@hestia/model';
import { csvDocument, csvText } from './csv.ts';
import { scheduleCsvCell, scheduleCsvHeader } from './scheduleCsv.ts';
import { quantifyCeilings } from './ceilingQuantities.ts';
import { resolveCeilings } from './ceilings.ts';

/** Um forro na tabela. Valores em metros (SI). */
export interface CeilingScheduleRow {
  ceilingId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  levelId: Id;
  levelName: string;
  /** Ambiente de origem (texto), vazio quando o forro foi desenhado livremente. */
  roomName: string;
  area: number;
  perimeter: number;
  thickness: number;
  volume: number;
  /** Cota do topo do forro em relação ao nível (m). */
  heightOffset: number;
  /** Cota da face inferior (visível) em relação ao nível (m). */
  underside: number;
}

export interface CeilingScheduleTotals {
  count: number;
  area: number;
  perimeter: number;
  volume: number;
}

export interface CeilingSchedule {
  rows: CeilingScheduleRow[];
  totals: CeilingScheduleTotals;
}

export interface CeilingScheduleFilter {
  typeId?: Id;
  levelId?: Id;
}

/** Tabela de forros do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). */
export function buildCeilingSchedule(p: Project): CeilingSchedule {
  const rows: CeilingScheduleRow[] = [];
  for (const level of p.levels) {
    const resolved = new Map(resolveCeilings(p, level.id).map((r) => [r.ceilingId, r]));
    for (const q of quantifyCeilings(p, level.id).ceilings) {
      const e = p.elements[q.ceilingId];
      if (!isCeiling(e)) continue;
      const t = p.ceilingTypes[q.typeId];
      const room = e.roomId ? p.elements[e.roomId] : undefined;
      const bottom = resolved.get(q.ceilingId)?.bottomZ ?? levelElevation(p, level.id) + e.heightOffset;
      rows.push({
        ceilingId: q.ceilingId,
        mark: e.mark,
        typeId: q.typeId,
        typeName: t?.name ?? q.typeId,
        typeCode: t?.code ?? '',
        levelId: q.levelId,
        levelName: level.name,
        roomName: room && room.kind === 'room' ? room.name || room.number : '',
        area: q.area,
        perimeter: q.perimeter,
        thickness: q.thickness,
        volume: q.volume,
        heightOffset: e.heightOffset,
        underside: bottom - levelElevation(p, level.id),
      });
    }
  }
  return { rows, totals: sumCeilingRows(rows) };
}

/** Linhas que passam pelos filtros de tipo e de nível (sem filtro, todas). */
export const filterCeilingRows = (rows: CeilingScheduleRow[], f: CeilingScheduleFilter): CeilingScheduleRow[] =>
  rows.filter((r) => (f.typeId === undefined || r.typeId === f.typeId) && (f.levelId === undefined || r.levelId === f.levelId));

/** Somatórios de um conjunto de linhas. */
export function sumCeilingRows(rows: CeilingScheduleRow[]): CeilingScheduleTotals {
  return rows.reduce<CeilingScheduleTotals>(
    (t, r) => ({ count: t.count + 1, area: t.area + r.area, perimeter: t.perimeter + r.perimeter, volume: t.volume + r.volume }),
    { count: 0, area: 0, perimeter: 0, volume: 0 },
  );
}

const csvHeader = (u: ResolvedUnits): string[] => [
  'Marca',
  'Tipo',
  'Código',
  'Nível',
  'Ambiente',
  scheduleCsvHeader(u, 'Área', 'area'),
  scheduleCsvHeader(u, 'Perímetro', 'length'),
  scheduleCsvHeader(u, 'Espessura', 'smallLength'),
  scheduleCsvHeader(u, 'Volume', 'volume'),
  scheduleCsvHeader(u, 'Topo', 'length'),
  scheduleCsvHeader(u, 'Face inferior', 'length'),
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato das outras tabelas).
 * Uma linha por forro, seguida de uma linha de total.
 */
export function ceilingScheduleToCsv(rows: CeilingScheduleRow[], totals: CeilingScheduleTotals, units: ResolvedUnits): string {
  const n = (q: 'length' | 'smallLength' | 'area' | 'volume', v: number, d: number): string => scheduleCsvCell(units, q, v, d);
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.levelName),
    csvText(r.roomName),
    n('area', r.area, 2),
    n('length', r.perimeter, 2),
    n('smallLength', r.thickness, 3),
    n('volume', r.volume, 3),
    n('length', r.heightOffset, 3),
    n('length', r.underside, 3),
  ]);
  const total = ['Total', '', '', '', '', n('area', totals.area, 2), n('length', totals.perimeter, 2), '', n('volume', totals.volume, 3), '', ''];
  return csvDocument([csvHeader(units), ...body, total]);
}
