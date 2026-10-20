import { isRoof, type Id, type Project, type RoofShape } from '@hestia/model';
import { csvDocument, csvText, formatDecimal } from './csv.ts';
import { quantifyRoofs, type RoofQuantity } from './roofQuantities.ts';

/** Rótulo da forma na tabela. */
export const ROOF_SHAPE_LABEL: Record<RoofShape, string> = {
  shed: 'Uma água',
  gable: 'Duas águas',
  hip: 'Quatro águas',
  free: 'Águas livres',
};

/** Um telhado na tabela. Unidades: m, m² e m³. */
export interface RoofScheduleRow {
  roofId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  levelId: Id;
  levelName: string;
  shape: RoofShape;
  shapeLabel: string;
  /** Inclinação única em % (null nas águas livres, que têm uma inclinação por água). */
  slopePercent: number | null;
  /** Área líquida em planta (m²). */
  planArea: number;
  /** Soma das áreas reais das águas (m²). */
  faceArea: number;
  volume: number;
  /** Comprimento 3D das cumeeiras (m). */
  ridgeLength: number;
  /** Comprimento 3D do beiral (m). */
  eaveLength: number;
}

export interface RoofScheduleTotals {
  count: number;
  planArea: number;
  faceArea: number;
  volume: number;
  ridgeLength: number;
  eaveLength: number;
}

export interface RoofSchedule {
  rows: RoofScheduleRow[];
  totals: RoofScheduleTotals;
}

export interface RoofScheduleFilter {
  typeId?: Id;
  levelId?: Id;
  shape?: RoofShape;
}

/** Linha de um telhado a partir dos quantitativos dele. */
function rowOf(p: Project, q: RoofQuantity): RoofScheduleRow {
  const e = p.elements[q.roofId];
  const t = p.roofTypes[q.typeId];
  const level = p.levels.find((l) => l.id === q.levelId);
  const slope = isRoof(e) && e.shape !== 'free' ? e.slopePercent : null;
  return {
    roofId: q.roofId,
    mark: q.mark,
    typeId: q.typeId,
    typeName: t?.name ?? q.typeId,
    typeCode: t?.code ?? '',
    levelId: q.levelId,
    levelName: level?.name ?? q.levelId,
    shape: q.shape,
    shapeLabel: ROOF_SHAPE_LABEL[q.shape],
    slopePercent: slope,
    planArea: q.planArea,
    faceArea: q.faceArea,
    volume: q.volume,
    ridgeLength: q.ridgeLength,
    eaveLength: q.eaveLength,
  };
}

/** Tabela de telhados do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). */
export function buildRoofSchedule(p: Project): RoofSchedule {
  const rows = p.levels.flatMap((level) => quantifyRoofs(p, level.id).roofs.map((q) => rowOf(p, q)));
  return { rows, totals: sumRoofRows(rows) };
}

/** Linhas que passam pelos filtros de tipo, nível e forma (sem filtro, todas). */
export const filterRoofRows = (rows: RoofScheduleRow[], f: RoofScheduleFilter): RoofScheduleRow[] =>
  rows.filter(
    (r) => (f.typeId === undefined || r.typeId === f.typeId) && (f.levelId === undefined || r.levelId === f.levelId) && (f.shape === undefined || r.shape === f.shape),
  );

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumRoofRows(rows: RoofScheduleRow[]): RoofScheduleTotals {
  return rows.reduce<RoofScheduleTotals>(
    (t, r) => ({
      count: t.count + 1,
      planArea: t.planArea + r.planArea,
      faceArea: t.faceArea + r.faceArea,
      volume: t.volume + r.volume,
      ridgeLength: t.ridgeLength + r.ridgeLength,
      eaveLength: t.eaveLength + r.eaveLength,
    }),
    { count: 0, planArea: 0, faceArea: 0, volume: 0, ridgeLength: 0, eaveLength: 0 },
  );
}

const CSV_HEADER = [
  'Marca',
  'Tipo',
  'Código',
  'Nível',
  'Forma',
  'Inclinação (%)',
  'Área em planta (m²)',
  'Área real (m²)',
  'Volume (m³)',
  'Cumeeira (m)',
  'Beiral (m)',
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato das tabelas de pisos e
 * lajes). Uma linha por telhado, seguida de uma linha de total. Inclinação vazia nas águas livres.
 */
export function roofScheduleToCsv(rows: RoofScheduleRow[], totals: RoofScheduleTotals): string {
  const n = formatDecimal;
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.levelName),
    csvText(r.shapeLabel),
    r.slopePercent === null ? '' : n(r.slopePercent, 2),
    n(r.planArea, 2),
    n(r.faceArea, 2),
    n(r.volume, 3),
    n(r.ridgeLength, 2),
    n(r.eaveLength, 2),
  ]);
  const total = ['Total', '', '', '', '', '', n(totals.planArea, 2), n(totals.faceArea, 2), n(totals.volume, 3), n(totals.ridgeLength, 2), n(totals.eaveLength, 2)];
  return csvDocument([CSV_HEADER, ...body, total]);
}
