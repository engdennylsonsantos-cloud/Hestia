import { isSlab, type Id, type Project } from '@hestia/model';
import { csvDocument, csvText, formatDecimal } from './csv.ts';
import { quantifySlabs } from './slabQuantities.ts';

/** Uma laje na tabela. Unidades: m, m² e m³. */
export interface SlabScheduleRow {
  slabId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  levelId: Id;
  levelName: string;
  /** Área líquida em planta (m²). */
  planArea: number;
  /** Área real da face superior, com a inclinação (m²). */
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

const CSV_HEADER = [
  'Marca',
  'Tipo',
  'Código',
  'Nível',
  'Área em planta (m²)',
  'Área real (m²)',
  'Perímetro (m)',
  'Espessura (m)',
  'Volume (m³)',
  'Inclinação (%)',
  'Deslocamento (m)',
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato da tabela de pisos).
 * Uma linha por laje, seguida de uma linha de total.
 */
export function slabScheduleToCsv(rows: SlabScheduleRow[], totals: SlabScheduleTotals): string {
  const n = formatDecimal;
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.levelName),
    n(r.planArea, 2),
    n(r.faceArea, 2),
    n(r.perimeter, 2),
    n(r.thickness, 3),
    n(r.volume, 3),
    n(r.slopePercent, 2),
    n(r.heightOffset, 3),
  ]);
  const total = ['Total', '', '', '', n(totals.planArea, 2), n(totals.faceArea, 2), n(totals.perimeter, 2), '', n(totals.volume, 3), '', ''];
  return csvDocument([CSV_HEADER, ...body, total]);
}
