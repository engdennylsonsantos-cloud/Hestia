import {
  isOpening,
  leafSizeOf,
  openingFamilyName,
  openingFamilyOf,
  openingHandleHeight,
  openingHinges,
  openingLeafUndercut,
  openingLintel,
  openingOptionSupport,
  openingRough,
  openingSillBeam,
  openingThreshold,
  spanTypeOf,
  type Id,
  type Opening,
  type OpeningLeaves,
  type OpeningLintel,
  type OpeningType,
  type Project,
} from '@hestia/model';
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
  /** Vão (m): com `nominalRef` 'leaf' é a folha mais a folga; nos demais, o próprio `width`/`height` do tipo. */
  width: number;
  height: number;
  /** Folha nominal (m): a "80 x 210" do comércio. Igual ao vão menos a folga quando o tipo é dado pelo vão. */
  leafWidth: number;
  leafHeight: number;
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
  /** Material do batente (nome do material do tipo); vazio quando o material não existe no projeto. */
  frameMaterial: string;
  /** Sentido de abertura das instâncias do tipo, distintos e separados por "; "; vazio no vão livre (sem folha). */
  sense: string;
  /** Material da folha (nome do material do tipo, `leafMaterialId`); vazio quando o tipo não informa ou o material não existe. */
  leafMaterial: string;
  /** Ferragens que a família do tipo oferece (openingSupport), em texto curto; vazio quando nada se aplica (vão livre, janela). */
  hardware: string;
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

/**
 * Sentido de uma instância: dobradiça (flipHand) e lado para onde a folha gira em relação ao eixo a→b da parede
 * (flipFacing; `true` gira para a direita de a→b, como em templateCasaAltoPadrao.ts).
 */
const senseText = (o: Opening): string =>
  `${o.flipHand ? 'dobradiça invertida' : 'dobradiça padrão'}, abre à ${o.flipFacing ? 'direita' : 'esquerda'} de a→b`;

/**
 * Ferragens do tipo, só as que a família oferece (openingSupport): maçaneta com a altura, dobradiças, folga inferior e
 * soleira. Ex.: "maçaneta a 1,00 m; 3 dobradiças; folga inferior 7 mm".
 */
function hardwareText(t: OpeningType): string {
  const sup = openingOptionSupport(openingFamilyOf(t)?.id);
  const parts: string[] = [];
  if (sup.handle) parts.push(`maçaneta a ${formatDecimal(openingHandleHeight(t), 2)} m`);
  const hinges = openingHinges(t);
  if (sup.hinges && hinges > 0) parts.push(`${hinges} ${hinges === 1 ? 'dobradiça' : 'dobradiças'}`);
  if (sup.leafUndercut) parts.push(`folga inferior ${formatDecimal(openingLeafUndercut(t) * 1000, 0)} mm`);
  const sill = sup.threshold ? openingThreshold(t) : null;
  if (sill) parts.push(`soleira ${formatDecimal(sill.thickness * 1000, 0)} mm`);
  return parts.join('; ');
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
  const senses = new Map<Id, Set<string>>();
  for (const e of Object.values(p.elements)) {
    if (!isOpening(e)) continue;
    if (!p.openingTypes[e.typeId]) continue;
    counts.set(e.typeId, (counts.get(e.typeId) ?? 0) + 1);
    const set = senses.get(e.typeId) ?? new Set<string>();
    set.add(senseText(e));
    senses.set(e.typeId, set);
  }
  const rows: OpeningScheduleRow[] = [];
  for (const [typeId, count] of counts) {
    const raw = p.openingTypes[typeId];
    if (!raw) continue;
    const t = spanTypeOf(raw);
    const leaf = leafSizeOf(raw);
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
      leafWidth: leaf.width,
      leafHeight: leaf.height,
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
      frameMaterial: p.materials[t.frameMaterialId]?.name ?? '',
      sense: t.leaves === 0 ? '' : [...(senses.get(typeId) ?? [])].join('; '),
      leafMaterial: (t.leafMaterialId && p.materials[t.leafMaterialId]?.name) || '',
      hardware: hardwareText(t),
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
  'Folha largura (m)',
  'Folha altura (m)',
  'Material do batente',
  'Sentido',
  'Material da folha',
  'Ferragens',
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
    n(r.leafWidth, 2),
    n(r.leafHeight, 2),
    csvText(r.frameMaterial),
    csvText(r.sense),
    csvText(r.leafMaterial),
    csvText(r.hardware),
  ]);
  const total = ['Total', '', '', '', '', '', '', '', '', '', '', '', String(totals.count), '', n(totals.totalArea, 2), '', '', '', '', '', ''];
  return csvDocument([CSV_HEADER, ...body, total]);
}
