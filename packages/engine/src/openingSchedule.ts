import {
  compositionCells,
  compositionKind,
  isOpening,
  leafSizeOf,
  nominalCellOf,
  openingCompositionOf,
  openingSpanOf,
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
  formatQuantity,
  spanTypeOf,
  type CellNode,
  type CompositionNode,
  type Id,
  type Opening,
  type OpeningComposition,
  type OpeningLeaves,
  type OpeningLintel,
  type OpeningType,
  type Project,
  type ResolvedUnits,
  unitsOf,
} from '@hestia/model';
import { csvDocument, csvText } from './csv.ts';
import { scheduleCsvCell, scheduleCsvHeader } from './scheduleCsv.ts';

/**
 * Uma linha da tabela de portas e janelas: um TIPO de abertura (Revit: Type) com a contagem das instâncias dele no
 * projeto. É aqui que aparece o código do tipo (Revit: Type Mark). Valores em metros (SI).
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
  /** Área do vão unitária (metros quadrados) = largura × altura. */
  unitArea: number;
  /** Área do vão total (metros quadrados) = unitArea × count. */
  totalArea: number;
  /** Material do batente (nome do material do tipo); vazio quando o material não existe no projeto. */
  frameMaterial: string;
  /** Sentido de abertura das instâncias do tipo, distintos e separados por "; "; vazio no vão livre (sem folha). */
  sense: string;
  /** Material da folha (nome do material do tipo, `leafMaterialId`); vazio quando o tipo não informa ou o material não existe. */
  leafMaterial: string;
  /** Ferragens que a família do tipo oferece (openingSupport), em texto curto; vazio quando nada se aplica (vão livre, janela).
   * Em composição de 2+ células, só as das células `leaf`. */
  hardware: string;
  /** Resumo da composição de 2+ células ("porta + 2 laterais + bandeira superior"); vazio com uma célula só. */
  composition: string;
}

export interface OpeningScheduleTotals {
  /** Instâncias no total (portas + janelas). */
  count: number;
  /** Instâncias de porta. */
  doorCount: number;
  /** Instâncias de janela. */
  windowCount: number;
  /** Área de vão total (metros quadrados). */
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
function hardwareText(t: OpeningType, u: ResolvedUnits): string {
  const sup = openingOptionSupport(openingFamilyOf(t)?.id);
  const parts: string[] = [];
  if (sup.handle) parts.push(`maçaneta a ${formatQuantity(u, 'length', openingHandleHeight(t), { decimals: 2 })}`);
  const hinges = openingHinges(t);
  if (sup.hinges && hinges > 0) parts.push(`${hinges} ${hinges === 1 ? 'dobradiça' : 'dobradiças'}`);
  if (sup.leafUndercut) parts.push(`folga inferior ${formatQuantity(u, 'smallLength', openingLeafUndercut(t), { decimals: 1 })}`);
  const sill = sup.threshold ? openingThreshold(t) : null;
  if (sill) parts.push(`soleira ${formatQuantity(u, 'smallLength', sill.thickness, { decimals: 1 })}`);
  return parts.join('; ');
}

/** Ferragens de uma composição: só as das células `leaf`, cada uma como um tipo de uma folha, sem repetir (sem soleira: é do quadro). */
function compositionHardware(t: OpeningType, cells: CellNode[], u: ResolvedUnits): string {
  const texts = cells.flatMap((x) => (x.content.kind === 'leaf' ? [x.content] : []));
  const parts = texts.map((l) => hardwareText({ ...t, ...l.options, plan: l.plan, leaves: l.leaves, threshold: undefined }, u));
  return [...new Set(parts.filter((x) => x !== ''))].join(' / ');
}

/** Nome do módulo numa composição de janela ("fixa + abrir"). */
const MODULE_NAME: Record<CellNode['content']['kind'], string> = { leaf: 'abrir', glass: 'fixa', panel: 'painel', louver: 'veneziana' };

/** Lado de uma peça fora da célula principal: lateral (divisão em colunas), superior ou inferior (em linhas). */
type Side = 'side' | 'above' | 'below';
const SIDE_ORDER: Record<Side, number> = { side: 0, above: 1, below: 2 };
/** Nome do grupo de peças por lado e tipo de célula: [singular, plural]; conjunto = divisão aninhada. */
const PART_NAMES: Record<Side, Record<string, [string, string]>> = {
  side: {
    leaf: ['folha lateral', 'folhas laterais'],
    glass: ['lateral', 'laterais'],
    panel: ['painel lateral', 'painéis laterais'],
    louver: ['veneziana lateral', 'venezianas laterais'],
    other: ['conjunto lateral', 'conjuntos laterais'],
  },
  above: {
    leaf: ['folha superior', 'folhas superiores'],
    glass: ['bandeira superior', 'bandeiras superiores'],
    panel: ['painel superior', 'painéis superiores'],
    louver: ['veneziana superior', 'venezianas superiores'],
    other: ['conjunto superior', 'conjuntos superiores'],
  },
  below: {
    leaf: ['folha inferior', 'folhas inferiores'],
    glass: ['bandeira inferior', 'bandeiras inferiores'],
    panel: ['painel inferior', 'painéis inferiores'],
    louver: ['veneziana inferior', 'venezianas inferiores'],
    other: ['conjunto inferior', 'conjuntos inferiores'],
  },
};

const containsCell = (n: CompositionNode, id: string): boolean => (n.kind === 'cell' ? n.id === id : n.children.some((ch) => containsCell(ch.node, id)));

/** Peças ao redor da célula `mainId`, de cada divisão do caminho até ela (colunas: laterais; linhas: acima ou abaixo). */
function outerParts(n: CompositionNode, mainId: string, out: Array<[Side, string]>): void {
  if (n.kind === 'cell') return;
  const idx = n.children.findIndex((ch) => containsCell(ch.node, mainId));
  if (idx < 0) return;
  n.children.forEach((ch, j) => {
    if (j === idx) return;
    const kind = ch.node.kind === 'cell' ? ch.node.content.kind : 'other';
    out.push([n.axis === 'cols' ? 'side' : j > idx ? 'above' : 'below', kind]);
  });
  outerParts(n.children[idx]!.node, mainId, out);
}

/**
 * Resumo legível de uma composição de 2+ células: porta com a folha como principal ("porta + 2 laterais + bandeira
 * superior"); janela, módulo a módulo ("janela 2 módulos (fixa + abrir)"). Vazio com uma célula só.
 */
export function compositionSummary(c: OpeningComposition): string {
  const cells = compositionCells(c);
  if (cells.length < 2) return '';
  const nominal = nominalCellOf(c);
  const leaf = nominal?.content.kind === 'leaf' ? nominal : cells.find((x) => x.content.kind === 'leaf');
  if (compositionKind(c) === 'window' || !leaf) return `janela ${cells.length} módulos (${cells.map((x) => MODULE_NAME[x.content.kind]).join(' + ')})`;
  const parts: Array<[Side, string]> = [];
  outerParts(c.layout, leaf.id, parts);
  parts.sort((a, b) => SIDE_ORDER[a[0]] - SIDE_ORDER[b[0]]);
  const groups = new Map<string, number>();
  for (const [side, kind] of parts) groups.set(`${side}|${kind}`, (groups.get(`${side}|${kind}`) ?? 0) + 1);
  const texts = [...groups].map(([key, n]) => {
    const [side, kind] = key.split('|') as [Side, string];
    const [one, many] = PART_NAMES[side][kind] ?? PART_NAMES[side].other!;
    return n === 1 ? one : `${n} ${many}`;
  });
  return ['porta', ...texts].join(' + ');
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
  const u = unitsOf(p);
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
    const t = { ...spanTypeOf(raw), ...openingSpanOf(raw) }; // vão: a composição manda quando há 2+ células
    const leaf = leafSizeOf(raw);
    const unitArea = t.width * t.height;
    const rough = openingRough(t);
    const lintel = openingLintel(t);
    const sillBeam = openingSillBeam(t);
    const comp = openingCompositionOf(raw);
    const cells = compositionCells(comp);
    const multi = cells.length >= 2;
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
      hardware: multi ? compositionHardware(t, cells, u) : hardwareText(t, u),
      composition: multi ? compositionSummary(comp) : '',
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

const csvHeader = (u: ResolvedUnits): string[] => [
  'Código',
  'Tipo',
  'Família',
  'Categoria',
  scheduleCsvHeader(u, 'Largura', 'length'),
  scheduleCsvHeader(u, 'Altura', 'length'),
  scheduleCsvHeader(u, 'Largura bruta', 'length'),
  scheduleCsvHeader(u, 'Altura bruta', 'length'),
  scheduleCsvHeader(u, 'Peitoril', 'length'),
  'Folhas',
  scheduleCsvHeader(u, 'Verga', 'length'),
  scheduleCsvHeader(u, 'Contraverga', 'length'),
  'Quantidade',
  scheduleCsvHeader(u, 'Área unitária', 'area'),
  scheduleCsvHeader(u, 'Área total', 'area'),
  scheduleCsvHeader(u, 'Folha largura', 'length'),
  scheduleCsvHeader(u, 'Folha altura', 'length'),
  'Material do batente',
  'Sentido',
  'Material da folha',
  'Ferragens',
];
/** Coluna extra, no fim, só quando algum tipo é composição de 2+ células (o CSV de projetos sem composição não muda). */
const COMPOSITION_HEADER = 'Composição';

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8 (o mesmo formato das outras tabelas).
 * Uma linha por tipo, seguida de uma linha de total (quantidade de instâncias e área total).
 */
export function openingScheduleToCsv(rows: OpeningScheduleRow[], totals: OpeningScheduleTotals, units: ResolvedUnits): string {
  const n = (q: 'length' | 'area', v: number, d: number): string => scheduleCsvCell(units, q, v, d);
  const withComposition = rows.some((r) => r.composition !== '');
  const body = rows.map((r) => [
    csvText(r.code),
    csvText(r.typeName),
    csvText(r.familyName),
    csvText(r.kind === 'door' ? 'Porta' : 'Janela'),
    n('length', r.width, 2),
    n('length', r.height, 2),
    n('length', r.roughWidth, 2),
    n('length', r.roughHeight, 2),
    n('length', r.sill, 2),
    String(r.leaves),
    n('length', r.lintelLength, 2),
    n('length', r.sillBeamLength, 2),
    String(r.count),
    n('area', r.unitArea, 2),
    n('area', r.totalArea, 2),
    n('length', r.leafWidth, 2),
    n('length', r.leafHeight, 2),
    csvText(r.frameMaterial),
    csvText(r.sense),
    csvText(r.leafMaterial),
    csvText(r.hardware),
    ...(withComposition ? [csvText(r.composition)] : []),
  ]);
  const total = ['Total', '', '', '', '', '', '', '', '', '', '', '', String(totals.count), '', n('area', totals.totalArea, 2), '', '', '', '', '', '', ...(withComposition ? [''] : [])];
  const header = csvHeader(units);
  if (withComposition) header.push(COMPOSITION_HEADER);
  return csvDocument([header, ...body, total]);
}
