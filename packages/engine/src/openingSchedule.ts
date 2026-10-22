import { isOpening, openingFamilyName, openingLintel, openingRough, openingSillBeam, type Id, type OpeningLeaves, type OpeningLintel, type Project } from '@hestia/model';
import { csvDocument, csvText, formatDecimal } from './csv.ts';

/**
 * Uma linha da tabela de portas e janelas: um TIPO de abertura (Revit: Type) com a contagem das instâncias dele no
 * projeto. É aqui que aparece o código do tipo (Revit: Type Mark). Unidades: m e m².
 */
export interface OpeningScheduleRow {
  typeId: Id;
  kind: 'door' | 'window';
  /** Código do tipo (Revit: Type Mark), como "P-01"; vazio quando não informado. */
  code: string;
  typeName: string;
  /** Nome da família (openingFamilyName), como "Porta de giro"; vazio quando a combinação (símbolo × folhas) não existe. */
  familyName: string;
  width: number;
  height: number;
  /** Vão bruto (furo na parede): largura e altura do tipo mais a folga `roughOversize`. */
  roughWidth: number;
  roughHeight: number;
  sill: number;
  leaves: OpeningLeaves;
  /** Verga e contraverga do tipo (transpasse e altura); null quando o tipo não as tem. */
  lintel: OpeningLintel | null;
  sillBeam: OpeningLintel | null;
  /** Comprimento total das peças no projeto (m) = (largura + 2 × transpasse) × quantidade. */
  lintelLength: number;
  sillBeamLength: number;
  /** Quantidade de instâncias deste tipo no projeto. */
  count: number;
  /** Área do vão unitária (m²) = largura × altura. */
  unitArea: number;
  /** Área do vão total (m²) = unitArea × count. */
  totalArea: number;
}

export interface OpeningScheduleTotals {
  /** Instâncias no total (portas + janelas). */
  count: number;
  /** Instâncias de porta. */
  doorCount: number;
  /** Instâncias de janela. */
  windowCount: number;
  /** Área de vão total (m²). */
  totalArea: number;
}

export interface OpeningSchedule {
  rows: OpeningScheduleRow[];
  totals: OpeningScheduleTotals;
}

/** Filtro da tabela: só portas, só janelas, ou tudo. */
export interface OpeningScheduleFilter {
  kind?: 'door' | 'window';
}

/** Ordem das categorias na tabela: portas antes de janelas. */
const kindOrder = (k: 'door' | 'window'): number => (k === 'door' ? 0 : 1);

/** Ordenação estável: portas antes de janelas; dentro da categoria, pelo código, depois pelo nome e pelo id do tipo. */
function compareRows(a: OpeningScheduleRow, b: OpeningScheduleRow): number {
  if (a.kind !== b.kind) return kindOrder(a.kind) - kindOrder(b.kind);
  const byCode = a.code.localeCompare(b.code, 'pt-BR', { numeric: true });
  if (byCode !== 0) return byCode;
  const byName = a.typeName.localeCompare(b.typeName, 'pt-BR', { numeric: true });
  if (byName !== 0) return byName;
  return a.typeId.localeCompare(b.typeId);
}

/**
 * Tabela de portas e janelas do projeto: uma linha por TIPO usado (portas e janelas juntos, ordenados), com a
 * quantidade de instâncias. Tipo de abertura inexistente não conta (a instância aponta para um tipo ausente).
 */
export function buildOpeningSchedule(p: Project): OpeningSchedule {
  const counts = new Map<Id, number>();
  for (const e of Object.values(p.elements)) {
    if (!isOpening(e)) continue;
    if (!p.openingTypes[e.typeId]) continue;
    counts.set(e.typeId, (counts.get(e.typeId) ?? 0) + 1);
  }
  const rows: OpeningScheduleRow[] = [];
  for (const [typeId, count] of counts) {
    const t = p.openingTypes[typeId];
    if (!t) continue;
    const unitArea = t.width * t.height;
    const rough = openingRough(t);
    const lintel = openingLintel(t);
    const sillBeam = openingSillBeam(t);
    rows.push({
      typeId,
      kind: t.kind,
      code: t.code ?? '',
      typeName: t.name,
      familyName: openingFamilyName(t) ?? '',
      width: t.width,
      height: t.height,
      roughWidth: rough.width,
      roughHeight: rough.height,
      sill: t.sill,
      leaves: t.leaves,
      lintel,
      sillBeam,
      lintelLength: lintel ? (t.width + 2 * lintel.over) * count : 0,
      sillBeamLength: sillBeam ? (t.width + 2 * sillBeam.over) * count : 0,
      count,
      unitArea,
      totalArea: unitArea * count,
    });
  }
  rows.sort(compareRows);
  return { rows, totals: sumOpeningRows(rows) };
}

/** Linhas que passam pelo filtro de categoria (sem filtro, portas e janelas). */
export const filterOpeningRows = (rows: OpeningScheduleRow[], f: OpeningScheduleFilter): OpeningScheduleRow[] =>
  rows.filter((r) => f.kind === undefined || r.kind === f.kind);

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumOpeningRows(rows: OpeningScheduleRow[]): OpeningScheduleTotals {
  return rows.reduce<OpeningScheduleTotals>(
    (t, r) => ({
      count: t.count + r.count,
      doorCount: t.doorCount + (r.kind === 'door' ? r.count : 0),
      windowCount: t.windowCount + (r.kind === 'window' ? r.count : 0),
      totalArea: t.totalArea + r.totalArea,
    }),
    { count: 0, doorCount: 0, windowCount: 0, totalArea: 0 },
  );
}

const CSV_HEADER = [
  'Código',
  'Tipo',
  'Família',
  'Categoria',
  'Largura (m)',
  'Altura (m)',
  'Largura bruta (m)',
  'Altura bruta (m)',
  'Peitoril (m)',
  'Folhas',
  'Verga (m)',
  'Contraverga (m)',
  'Quantidade',
  'Área unitária (m²)',
  'Área total (m²)',
];

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato das outras tabelas).
 * Uma linha por tipo, seguida de uma linha de total (quantidade de instâncias e área total).
 */
export function openingScheduleToCsv(rows: OpeningScheduleRow[], totals: OpeningScheduleTotals): string {
  const n = formatDecimal;
  const body = rows.map((r) => [
    csvText(r.code),
    csvText(r.typeName),
    csvText(r.familyName),
    csvText(r.kind === 'door' ? 'Porta' : 'Janela'),
    n(r.width, 2),
    n(r.height, 2),
    n(r.roughWidth, 2),
    n(r.roughHeight, 2),
    n(r.sill, 2),
    String(r.leaves),
    n(r.lintelLength, 2),
    n(r.sillBeamLength, 2),
    String(r.count),
    n(r.unitArea, 2),
    n(r.totalArea, 2),
  ]);
  const total = ['Total', '', '', '', '', '', '', '', '', '', '', '', String(totals.count), '', n(totals.totalArea, 2)];
  return csvDocument([CSV_HEADER, ...body, total]);
}
