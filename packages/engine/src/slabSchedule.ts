import { isSlab, type Id, type Project, type ResolvedUnits } from '@hestia/model';
import { csvDocument, csvText } from './csv.ts';
import { scheduleCsvCell, scheduleCsvHeader } from './scheduleCsv.ts';
import { quantifySlabs } from './slabQuantities.ts';

/** Uma laje na tabela. Valores em metros (SI). */
export interface SlabScheduleRow {
  slabId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  levelId: Id;
  levelName: string;
  /** Área líquida em planta (metros quadrados). */
  planArea: number;
  /** Área real da face superior, com a inclinação (metros quadrados). */
  faceArea: number;
  perimeter: number;
  thickness: number;
  volume: number;
  /** Inclinação da face superior em % (0 sem inclinação). */
  slopePercent: number;
  /** Deslocamento do topo em relação ao nível (m). */
  heightOffset: number;
}

export interface SlabScheduleTotals {
  count: number;
  planArea: number;
  faceArea: number;
  perimeter: number;
  volume: number;
}

export interface SlabSchedule {
  rows: SlabScheduleRow[];
  totals: SlabScheduleTotals;
}

export interface SlabScheduleFilter {
  typeId?: Id;
  levelId?: Id;
}

/** Tabela de lajes do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). */
export function buildSlabSchedule(p: Project): SlabSchedule {
  const rows: SlabScheduleRow[] = [];
  for (const level of p.levels) {
    for (const q of quantifySlabs(p, level.id).slabs) {
      const e = p.elements[q.slabId];
      if (!isSlab(e)) continue;
      const t = p.slabTypes[q.typeId];
      rows.push({
        slabId: q.slabId,
        mark: e.mark,
        typeId: q.typeId,
        typeName: t?.name ?? q.typeId,
        typeCode: t?.code ?? '',
        levelId: q.levelId,
        levelName: level.name,
        planArea: q.planArea,
        faceArea: q.faceArea,
        perimeter: q.perimeter,
        thickness: q.thickness,
        volume: q.volume,
        slopePercent: q.slopePercent,
        heightOffset: e.heightOffset,
      });
    }
  }
  return { rows, totals: sumSlabRows(rows) };
}

/** Linhas que passam pelos filtros de tipo e de nível (sem filtro, todas). */
export const filterSlabRows = (rows: SlabScheduleRow[], f: SlabScheduleFilter): SlabScheduleRow[] =>
  rows.filter((r) => (f.typeId === undefined || r.typeId === f.typeId) && (f.levelId === undefined || r.levelId === f.levelId));

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumSlabRows(rows: SlabScheduleRow[]): SlabScheduleTotals {
  return rows.reduce<SlabScheduleTotals>(
    (t, r) => ({
      count: t.count + 1,
      planArea: t.planArea + r.planArea,
      faceArea: t.faceArea + r.faceArea,
      perimeter: t.perimeter + r.perimeter,
      volume: t.volume + r.volume,
    }),
    { count: 0, planArea: 0, faceArea: 0, perimeter: 0, volume: 0 },
  );
}

const csvHeader = (u: ResolvedUnits): string[] => [
  'Marca',
  'Tipo',
  'Código',
  'Nível',
  scheduleCsvHeader(u, 'Área em planta', 'area'),
  scheduleCsvHeader(u, 'Área real', 'area'),
  scheduleCsvHeader(u, 'Perímetro', 'length'),
  scheduleCsvHeader(u, 'Espessura', 'smallLength'),
  scheduleCsvHeader(u, 'Volume', 'volume'),
  scheduleCsvHeader(u, 'Inclinação', 'slope'),
  scheduleCsvHeader(u, 'Deslocamento', 'length'),
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato da tabela de pisos).
 * Uma linha por laje, seguida de uma linha de total.
 */
export function slabScheduleToCsv(rows: SlabScheduleRow[], totals: SlabScheduleTotals, units: ResolvedUnits): string {
  const n = (q: 'length' | 'smallLength' | 'area' | 'volume' | 'slope', v: number, d: number): string => scheduleCsvCell(units, q, v, d);
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.levelName),
    n('area', r.planArea, 2),
    n('area', r.faceArea, 2),
    n('length', r.perimeter, 2),
    n('smallLength', r.thickness, 3),
    n('volume', r.volume, 3),
    n('slope', r.slopePercent / 100, 2),
    n('length', r.heightOffset, 3),
  ]);
  const total = ['Total', '', '', '', n('area', totals.planArea, 2), n('area', totals.faceArea, 2), n('length', totals.perimeter, 2), '', n('volume', totals.volume, 3), '', ''];
  return csvDocument([csvHeader(units), ...body, total]);
}
