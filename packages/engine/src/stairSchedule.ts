import { stairTopLevel, stairsOnLevel, type Id, type Level, type Project, type Stair } from '@hestia/model';
import { csvDocument, csvText, formatDecimal } from './csv.ts';
import { stairQuantities, type StairQuantities } from './stairQuantities.ts';
import { resolveStairs } from './stairs.ts';

/** Uma escada na tabela. Unidades: m, m² e m³. */
export interface StairScheduleRow {
  stairId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  typeCode: string;
  /** Nível de base (o da escada). */
  baseLevelId: Id;
  baseLevelName: string;
  /** Nível de topo efetivo (explícito ou o imediatamente acima); vazio sem nível de topo. */
  topLevelId: Id | null;
  topLevelName: string;
  riserCount: number;
  riserHeight: number;
  treadMean: number;
  width: number;
  /** Área em planta (m²). */
  planArea: number;
  volume: number;
}

export interface StairScheduleTotals {
  count: number;
  planArea: number;
  volume: number;
}

export interface StairSchedule {
  rows: StairScheduleRow[];
  totals: StairScheduleTotals;
}

export interface StairScheduleFilter {
  typeId?: Id;
  /** Nível de base da escada. */
  levelId?: Id;
}

/** Linha de uma escada a partir dos quantitativos dela. */
function rowOf(p: Project, base: Level, s: Stair, q: StairQuantities): StairScheduleRow {
  const t = p.stairTypes[q.typeId];
  const top = stairTopLevel(p, s);
  return {
    stairId: s.id,
    mark: s.mark,
    typeId: q.typeId,
    typeName: t?.name ?? q.typeId,
    typeCode: t?.code ?? '',
    baseLevelId: base.id,
    baseLevelName: base.name,
    topLevelId: top?.id ?? null,
    topLevelName: top?.name ?? '',
    riserCount: q.riserCount,
    riserHeight: q.riserHeight,
    treadMean: q.treadMean,
    width: q.width,
    planArea: q.planArea,
    volume: q.volume,
  };
}

/**
 * Tabela de escadas do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). Escada sem tipo válido
 * não entra (ela não resolve).
 */
export function buildStairSchedule(p: Project): StairSchedule {
  const resolved = new Map(resolveStairs(p).map((r) => [r.id, r] as const));
  const rows: StairScheduleRow[] = [];
  for (const level of p.levels) {
    for (const s of stairsOnLevel(p, level.id)) {
      const r = resolved.get(s.id);
      if (!r) continue;
      rows.push(rowOf(p, level, s, stairQuantities(r)));
    }
  }
  return { rows, totals: sumStairRows(rows) };
}

/** Linhas que passam pelos filtros de tipo e de nível de base (sem filtro, todas). */
export const filterStairRows = (rows: StairScheduleRow[], f: StairScheduleFilter): StairScheduleRow[] =>
  rows.filter((r) => (f.typeId === undefined || r.typeId === f.typeId) && (f.levelId === undefined || r.baseLevelId === f.levelId));

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumStairRows(rows: StairScheduleRow[]): StairScheduleTotals {
  return rows.reduce<StairScheduleTotals>(
    (t, r) => ({ count: t.count + 1, planArea: t.planArea + r.planArea, volume: t.volume + r.volume }),
    { count: 0, planArea: 0, volume: 0 },
  );
}

const CSV_HEADER = [
  'Marca',
  'Tipo',
  'Código',
  'Nível de base',
  'Nível de topo',
  'Espelhos',
  'Altura do espelho (m)',
  'Piso médio (m)',
  'Largura (m)',
  'Área em planta (m²)',
  'Volume (m³)',
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato das tabelas de lajes
 * e telhados). Uma linha por escada, seguida de uma linha de total.
 */
export function stairScheduleToCsv(rows: StairScheduleRow[], totals: StairScheduleTotals): string {
  const n = formatDecimal;
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.typeCode),
    csvText(r.baseLevelName),
    csvText(r.topLevelName),
    String(r.riserCount),
    n(r.riserHeight, 3),
    n(r.treadMean, 3),
    n(r.width, 2),
    n(r.planArea, 2),
    n(r.volume, 3),
  ]);
  const total = ['Total', '', '', '', '', '', '', '', '', n(totals.planArea, 2), n(totals.volume, 3)];
  return csvDocument([CSV_HEADER, ...body, total]);
}
