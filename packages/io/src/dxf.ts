import type { GraphicsCategory, Id, Project } from '@hestia/model';
import { DXF_LAYER_COTAS, DXF_LAYER_DETALHE, DXF_LAYER_ETIQUETAS, DXF_LAYER_TEXTOS, dxfTextRecords, type DxfNoteText, type DxfNotes } from './dxfNotes.ts';

/** Ponto em metros: x para a direita, y para cima (planta). */
export interface DxfPoint {
  x: number;
  y: number;
}

/** Polígonos no formato do MultiPolygon do geom: cada polígono é [contorno, ...furos]. */
export type DxfPolygons = DxfPoint[][][];

/** Subconjunto de ResolvedCluster (engine): regiões por material e contorno externo. */
export interface DxfCluster {
  regions: Array<{ materialId: Id; polygons: DxfPolygons }>;
  silhouette: DxfPolygons;
}

/**
 * Estado de um elemento na vista da planta (decisão 0013 §2), sem o `hidden`: quem monta a geometria não manda os ocultos.
 * `cut` atravessa o plano de corte (camadas normais). Os demais ficam fora do corte, dentro do intervalo, e saem em camadas
 * de projeção próprias: acima do corte (tracejado), abaixo do corte, ou "além" (abaixo da base, na profundidade).
 */
export type DxfViewState = 'cut' | 'projection-above' | 'projection-below' | 'beyond';

/** Linha de uma marca de corte/elevação, já com a camada (`CORTES` ou `ELEVACOES`). */
export interface DxfSectionMarkLine {
  a: DxfPoint;
  b: DxfPoint;
  layer: string;
}

/** Marcas de corte/elevação em planta para o DXF: hastes, setas e rótulos. */
export interface DxfSectionMarks {
  lines: DxfSectionMarkLine[];
  texts: DxfNoteText[];
}

/** Traço do símbolo de planta de um vão: polilinha aberta ou fechada; `dashed` põe o tracejado no próprio traço. */
export interface DxfSymbolPath {
  pts: DxfPoint[];
  closed: boolean;
  dashed?: boolean;
}

/** Vão em planta: retângulo com `width` ao longo de `u` (vetor unitário) e `thickness` na perpendicular. */
export interface DxfOpening {
  center: DxfPoint;
  u: DxfPoint;
  width: number;
  thickness: number;
  /** Estado na vista. Ausente vale `cut` (vão de corte, na camada `ABERTURAS`). */
  state?: DxfViewState;
  /**
   * Símbolo de planta do vão (folhas, arcos, caixilho e bordas do vão livre; o mesmo da tela, `openingSymbolPaths` do geom). Sai em todos
   * os estados. Sem ele, o vão sai como retângulo fechado (`ABERTURAS` no corte, a camada do estado na projeção).
   */
  symbol?: DxfSymbolPath[];
}

/**
 * Geometria resolvida de um nível. Quem chama obtém com `resolveLevel` e `openingGeometry` do @hestia/engine:
 * o pacote io não pode importar o engine (docs/01 §1), então recebe só os dados.
 */
export interface DxfLevelGeometry {
  clusters: DxfCluster[];
  openings: DxfOpening[];
  /**
   * Paredes fora do corte e dentro do intervalo: o contorno inteiro, sem furos, na camada de projeção do estado
   * (`PAREDE_PROJECAO_ACIMA`, `PAREDE_PROJECAO_ABAIXO` ou `PAREDE_ALEM`). Não entram nos clusters.
   */
  wallOutlines?: Array<{ state: Exclude<DxfViewState, 'cut'>; polygons: DxfPolygons }>;
  /** Projeção (contorno) dos telhados fora do intervalo, tracejada na camada `TELHADO_PROJECAO`. */
  roofProjections?: DxfPolygons;
  /** Pisos do nível: contorno e furos em planta; `typeCode` é o código do tipo (vira a camada `PISO_<código>`). */
  floors?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][]; typeCode: string }>;
  /** Lajes do nível: contorno e furos em planta; `typeCode` vira a camada `LAJE_<código>`. A inclinação não aparece na planta. */
  slabs?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][]; typeCode: string }>;
  /** Forros da planta de forro (decisão 0021): contorno e furos, na camada `FORRO`. Vazio na planta baixa. */
  ceilings?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][] }>;
  /**
   * Telhados do nível: contorno do beiral (POLYLINE fechada na camada `TELHADO_<código>`), segmentos de cumeeira,
   * espigão e rincão em planta (LINE na camada `TELHADO_CUMEEIRA`, todos juntos) e de empena (LINE na camada
   * `TELHADO_EMPENA`). Quem monta a geometria é o engine.
   */
  roofs?: Array<{ outline: DxfPoint[]; ridges: Array<[DxfPoint, DxfPoint]>; gables?: Array<[DxfPoint, DxfPoint]>; breaks?: Array<[DxfPoint, DxfPoint]>; typeCode: string }>;
  /**
   * Escadas do nível: contornos dos degraus e patamares até a cota de corte (POLYLINE fechada na camada `ESCADA`),
   * os que estão acima dela e até o topo do intervalo (`outlinesAbove`, camada `ESCADA_ACIMA`, tracejada), linhas de espelho
   * (LINE em `ESCADA_ESPELHO`), seta de subida (LINE em `ESCADA_SETA`: um trecho por segmento da caminhada e as duas pontas
   * no fim; a caminhada é a explícita do lance, quando há, senão os pontos médios dos espelhos) e o símbolo de corte
   * (POLYLINE aberta em `ESCADA_CORTE`), quando o plano de corte cruza a escada. Caracol: `posts`, o círculo do poste
   * (POLYLINE fechada em `ESCADA_POSTE`; acima do corte, em `ESCADA_ACIMA`). Quem monta a geometria é o engine.
   */
  stairs?: Array<{
    outlines: DxfPoint[][];
    outlinesAbove?: DxfPoint[][];
    risers: Array<[DxfPoint, DxfPoint]>;
    arrow: Array<[DxfPoint, DxfPoint]>;
    cut?: DxfPoint[];
    /** Poste central de cada caracol do lance: anel de 24 a 48 lados e se fica acima da cota de corte. */
    posts?: Array<{ pts: DxfPoint[]; above: boolean }>;
  }>;
  /**
   * Largura de linha de cada camada, em centésimos de mm (código 370 da tabela LAYER; arredondada ao valor DXF válido).
   * Ausente: a tabela não leva 370 e o arquivo é o de antes. Presente: a camada sem entrada sai com -3 (padrão).
   * Quem monta a geometria preenche com `lineWeightsOf` (apps/web), a partir de `dxfLayersOf` e `dxfLineRoleOf`.
   */
  lineWeights?: Partial<Record<string, number>>;
  /** Cotas e textos de anotação do nível (decisão 0019): ver `notesDxfOf`. Ausente = nenhum. */
  notes?: DxfNotes;
  /** Marcas de corte/elevação em planta (linhas, setas e rótulos), ver `sectionMarksDxfOf`. Ausente = nenhuma. */
  sectionMarks?: DxfSectionMarks;
  /** Ambientes do nível: contorno e furos em planta (POLYLINE fechada na camada `AMBIENTES`). Ausente = nenhum. */
  rooms?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][] }>;
  /** Textos dos ambientes (nome, número e área) na camada `AMBIENTES_TEXTO`. Ausente = nenhum. */
  roomTexts?: DxfNoteText[];
}

export const DXF_LAYER_CONTOUR = 'PAREDE_CONTORNO';
/** Camada dos forros da planta de forro (decisão 0021). */
export const DXF_LAYER_CEILING = 'FORRO';
/** Vãos que cortam o plano de corte (furam a parede): retângulo na camada `ABERTURAS` quando não há símbolo. */
export const DXF_LAYER_OPENINGS = 'ABERTURAS';
/** Símbolo de planta do vão de corte (folhas, arcos, bordas do vão livre), em camada própria com o peso de corte da categoria. */
export const DXF_LAYER_OPENING_SYMBOL = 'ABERTURA_SIMBOLO';
/** Vãos acima do corte (peitoril acima do plano): símbolo tracejado, a parede fica inteira. */
export const DXF_LAYER_OPENING_ABOVE = 'ABERTURA_ACIMA';
/** Vãos abaixo do corte e acima da base: símbolo leve, a parede fica inteira. */
export const DXF_LAYER_OPENING_BELOW = 'ABERTURA_ABAIXO';
/** Vãos "além" (abaixo da base, dentro da profundidade): símbolo leve. */
export const DXF_LAYER_OPENING_BEYOND = 'ABERTURA_ALEM';
/** Paredes inteiras acima do corte (projeção): contorno tracejado. */
export const DXF_LAYER_WALL_ABOVE = 'PAREDE_PROJECAO_ACIMA';
/** Paredes abaixo do corte (projeção): contorno leve. */
export const DXF_LAYER_WALL_BELOW = 'PAREDE_PROJECAO_ABAIXO';
/** Paredes "além" (fora do intervalo na base): contorno leve. */
export const DXF_LAYER_WALL_BEYOND = 'PAREDE_ALEM';
/** Projeção da cobertura de telhados fora do intervalo: contorno tracejado. */
export const DXF_LAYER_ROOF_PROJECTION = 'TELHADO_PROJECAO';
/** Camada das linhas de cumeeira, espigão e rincão (LINE). */
export const DXF_LAYER_ROOF_RIDGE = 'TELHADO_CUMEEIRA';
/** Camada das linhas de empena (aresta sem inclinação, LINE), separada da cumeeira. */
export const DXF_LAYER_ROOF_GABLE = 'TELHADO_EMPENA';
/** Camada da linha de desnível da mansarda (divisa entre a faixa íngreme e a suave, LINE), separada da cumeeira. */
export const DXF_LAYER_ROOF_BREAK = 'TELHADO_DESNIVEL';
/** Escadas: contorno dos degraus e patamares até a cota de corte (POLYLINE), linhas de espelho e seta de subida (LINE). */
export const DXF_LAYER_STAIR = 'ESCADA';
/** Degraus e patamares acima da cota de corte e até o topo: contorno tracejado (POLYLINE). */
export const DXF_LAYER_STAIR_ABOVE = 'ESCADA_ACIMA';
export const DXF_LAYER_STAIR_RISER = 'ESCADA_ESPELHO';
export const DXF_LAYER_STAIR_ARROW = 'ESCADA_SETA';
/** Símbolo de corte da escada: polilinha aberta em zigue-zague, só quando o plano de corte cruza a escada. */
export const DXF_LAYER_STAIR_CUT = 'ESCADA_CORTE';
/** Poste central do caracol: círculo fechado (POLYLINE) de 24 a 48 lados, abaixo ou na cota de corte. */
export const DXF_LAYER_ROOM = 'AMBIENTES';
/** Textos de ambiente (nome, número e área), no centro de cada ambiente. */
export const DXF_LAYER_ROOM_TEXT = 'AMBIENTES_TEXTO';
export const DXF_LAYER_STAIR_POST = 'ESCADA_POSTE';
/** Marcas de corte e elevação em planta (linha, setas e rótulo), separadas por tipo. */
export const DXF_LAYER_CORTES = 'CORTES';
export const DXF_LAYER_ELEVACOES = 'ELEVACOES';

/** Camada de cada estado de vão e de parede fora do corte. */
const OPENING_LAYER: Record<DxfViewState, string> = {
  cut: DXF_LAYER_OPENINGS,
  'projection-above': DXF_LAYER_OPENING_ABOVE,
  'projection-below': DXF_LAYER_OPENING_BELOW,
  beyond: DXF_LAYER_OPENING_BEYOND,
};
const WALL_LAYER: Record<Exclude<DxfViewState, 'cut'>, string> = {
  'projection-above': DXF_LAYER_WALL_ABOVE,
  'projection-below': DXF_LAYER_WALL_BELOW,
  beyond: DXF_LAYER_WALL_BEYOND,
};

/** Texto para nome de camada: sem acentos, em maiúsculas, símbolos viram `_`. */
function layerSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Camada DXF de um material: `PAREDE_` + nome em maiúsculas, sem acentos nem símbolos. */
export function dxfLayerOfMaterial(name: string): string {
  return `PAREDE_${layerSafe(name) || 'SEM_NOME'}`;
}

/** Camada DXF de um tipo de piso: `PISO_` + código sem acentos nem símbolos (PS-01 vira PISO_PS_01). */
export function dxfLayerOfFloor(typeCode: string): string {
  return `PISO_${layerSafe(typeCode) || 'SEM_CODIGO'}`;
}

/** Camada DXF de um tipo de laje: `LAJE_` + código sem acentos nem símbolos (LJ-12 vira LAJE_LJ_12). */
export function dxfLayerOfSlab(typeCode: string): string {
  return `LAJE_${layerSafe(typeCode) || 'SEM_CODIGO'}`;
}

/** Camada DXF do contorno de um tipo de telhado: `TELHADO_` + código (TL-01 vira TELHADO_TL_01). */
export function dxfLayerOfRoof(typeCode: string): string {
  return `TELHADO_${layerSafe(typeCode) || 'SEM_CODIGO'}`;
}

const EPS = 1e-9;
/** Coordenadas com 6 casas (1 µm); zero negativo vira zero. */
const fmt = (v: number): string => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6);

/** Anel sem o vértice de fechamento repetido. Com menos de 3 vértices não há área: devolve null. */
function openRing(ring: DxfPoint[]): DxfPoint[] | null {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const repeated = ring.length > 1 && first !== undefined && last !== undefined && Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS;
  const pts = repeated ? ring.slice(0, -1) : ring;
  return pts.length >= 3 ? pts : null;
}

/** Retângulo do vão: o eixo do vão é `u`; a espessura vale para os dois lados do eixo do vão. */
function openingRect(o: DxfOpening): DxfPoint[] {
  const { u } = o;
  const n = { x: -u.y, y: u.x };
  const hw = o.width / 2;
  const ht = o.thickness / 2;
  const at = (s: number, t: number): DxfPoint => ({ x: o.center.x + u.x * s + n.x * t, y: o.center.y + u.y * s + n.y * t });
  return [at(-hw, -ht), at(hw, -ht), at(hw, ht), at(-hw, ht)];
}

interface Shape {
  layer: string;
  pts: DxfPoint[];
  /** Polilinha fechada (padrão); a aberta serve ao símbolo de corte da escada e aos traços abertos dos vãos. */
  closed?: boolean;
  /** Tracejado no próprio traço (além da camada, quando a camada é contínua). */
  dashed?: boolean;
}

interface Line {
  layer: string;
  a: DxfPoint;
  b: DxfPoint;
}

/** Tipo de linha de uma camada: contínua, ou tracejada nas camadas de projeção acima do corte. */
type LineType = 'CONTINUOUS' | 'DASHED';

interface LayerStyle {
  linetype: LineType;
  /** Cor ACI: 7 (preto/branco) é o padrão; 8 (cinza) para as camadas de projeção leves. */
  color: number;
}

/** Camadas com tipo de linha ou cor próprios. As demais são contínuas e de cor 7, como sempre foram. */
const LAYER_STYLE: Record<string, LayerStyle> = {
  [DXF_LAYER_OPENING_ABOVE]: { linetype: 'DASHED', color: 7 },
  [DXF_LAYER_OPENING_BELOW]: { linetype: 'CONTINUOUS', color: 8 },
  [DXF_LAYER_OPENING_BEYOND]: { linetype: 'CONTINUOUS', color: 8 },
  [DXF_LAYER_WALL_ABOVE]: { linetype: 'DASHED', color: 7 },
  [DXF_LAYER_WALL_BELOW]: { linetype: 'CONTINUOUS', color: 8 },
  [DXF_LAYER_WALL_BEYOND]: { linetype: 'CONTINUOUS', color: 8 },
  [DXF_LAYER_ROOF_PROJECTION]: { linetype: 'DASHED', color: 7 },
  [DXF_LAYER_STAIR_ABOVE]: { linetype: 'DASHED', color: 7 },
};
const styleOf = (layer: string): LayerStyle => LAYER_STYLE[layer] ?? { linetype: 'CONTINUOUS', color: 7 };

/** Larguras de linha válidas do DXF (código 370, em centésimos de mm). */
export const DXF_LINE_WEIGHTS: readonly number[] = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
/** Largura padrão do DXF (-3): a camada sem entrada em `lineWeights` sai com ela e não passa pelo arredondamento. */
export const DXF_LINE_WEIGHT_DEFAULT = -3;

/** Arredonda uma largura em centésimos de mm ao valor DXF válido mais próximo (empate: o maior; fora de 0 a 211, o limite). */
export function dxfLineWeight(centi: number): number {
  let best = DXF_LINE_WEIGHTS[0]!;
  for (const w of DXF_LINE_WEIGHTS) if (Math.abs(w - centi) <= Math.abs(best - centi)) best = w;
  return best;
}

/**
 * Papel de uma camada na largura de linha (decisão 0015 §2 item 7): a categoria gráfica e se o peso é o de corte ou o de
 * projeção. `annotation` são as marcas de escada (seta e símbolo de corte), que saem com 0 (estreita).
 */
export type DxfLineRole = { category: GraphicsCategory; view: 'cut' | 'projection' } | 'annotation';

const cut = (category: GraphicsCategory): DxfLineRole => ({ category, view: 'cut' });
const projection = (category: GraphicsCategory): DxfLineRole => ({ category, view: 'projection' });

/** Papel das camadas com nome fixo. As de material, piso, laje e telhado do tipo são pelo prefixo (`dxfLineRoleOf`). */
const FIXED_LINE_ROLE = new Map<string, DxfLineRole>([
  [DXF_LAYER_CONTOUR, cut('wall')],
  [DXF_LAYER_CEILING, cut('floor')],
  // Portas e janelas saem juntas: a camada leva o peso da janela (o DXF não separa os dois).
  [DXF_LAYER_OPENINGS, cut('window')],
  [DXF_LAYER_OPENING_SYMBOL, cut('window')],
  [DXF_LAYER_OPENING_ABOVE, projection('window')],
  [DXF_LAYER_OPENING_BELOW, projection('window')],
  [DXF_LAYER_OPENING_BEYOND, projection('window')],
  [DXF_LAYER_WALL_ABOVE, projection('wall')],
  [DXF_LAYER_WALL_BELOW, projection('wall')],
  [DXF_LAYER_WALL_BEYOND, projection('wall')],
  [DXF_LAYER_ROOF_PROJECTION, projection('roof')],
  [DXF_LAYER_ROOF_RIDGE, cut('roof')],
  [DXF_LAYER_ROOF_GABLE, cut('roof')],
  [DXF_LAYER_ROOF_BREAK, cut('roof')],
  [DXF_LAYER_STAIR, cut('stair')],
  [DXF_LAYER_STAIR_ABOVE, projection('stair')],
  [DXF_LAYER_STAIR_RISER, cut('stair')],
  [DXF_LAYER_STAIR_POST, cut('stair')],
  [DXF_LAYER_ROOM, cut('room')],
  [DXF_LAYER_ROOM_TEXT, 'annotation'],
  [DXF_LAYER_STAIR_ARROW, 'annotation'],
  [DXF_LAYER_STAIR_CUT, 'annotation'],
  [DXF_LAYER_COTAS, 'annotation'],
  [DXF_LAYER_TEXTOS, 'annotation'],
  [DXF_LAYER_DETALHE, 'annotation'],
  [DXF_LAYER_ETIQUETAS, 'annotation'],
  // A marca é desenho, não texto: usa o peso de corte da categoria 'anotação' (as camadas de texto ficam em 0).
  [DXF_LAYER_CORTES, cut('annotation')],
  [DXF_LAYER_ELEVACOES, cut('annotation')],
]);

/** Papel de uma camada pelo nome. `undefined` = sem categoria (sai com -3). `PAREDE_<material>` é corte de parede. */
export function dxfLineRoleOf(layer: string): DxfLineRole | undefined {
  const fixed = FIXED_LINE_ROLE.get(layer);
  if (fixed !== undefined) return fixed;
  if (layer.startsWith('PAREDE_')) return cut('wall');
  if (layer.startsWith('PISO_')) return cut('floor');
  if (layer.startsWith('LAJE_')) return cut('slab');
  if (layer.startsWith('TELHADO_')) return cut('roof');
  return undefined;
}

/** Linhas de cumeeira, espigão e rincão dos telhados do nível (LINE), e as de espelho e seta das escadas. */
function linesOf(geo: DxfLevelGeometry): Line[] {
  const notes = (geo.notes?.lines ?? []).map(([a, b]): Line => ({ layer: DXF_LAYER_COTAS, a, b }));
  const noteLeaders = (geo.notes?.otherLines ?? []).map((l): Line => ({ layer: l.layer, a: l.a, b: l.b }));
  const roof = (geo.roofs ?? []).flatMap((r) => [
    ...r.ridges.map(([a, b]): Line => ({ layer: DXF_LAYER_ROOF_RIDGE, a, b })),
    ...(r.gables ?? []).map(([a, b]): Line => ({ layer: DXF_LAYER_ROOF_GABLE, a, b })),
    ...(r.breaks ?? []).map(([a, b]): Line => ({ layer: DXF_LAYER_ROOF_BREAK, a, b })),
  ]);
  const stair = (geo.stairs ?? []).flatMap((s) => [
    ...s.risers.map(([a, b]): Line => ({ layer: DXF_LAYER_STAIR_RISER, a, b })),
    ...s.arrow.map(([a, b]): Line => ({ layer: DXF_LAYER_STAIR_ARROW, a, b })),
  ]);
  const marks = (geo.sectionMarks?.lines ?? []).map((l): Line => ({ layer: l.layer, a: l.a, b: l.b }));
  return [...roof, ...stair, ...marks, ...notes, ...noteLeaders];
}

/**
 * Polilinhas do nível: por cluster, as regiões de material e depois o contorno; depois as projeções de parede, os pisos,
 * as lajes, os telhados (e a projeção dos fora do intervalo), as escadas e, por último, os vãos.
 */
function shapesOf(project: Project, geo: DxfLevelGeometry): Shape[] {
  const out: Shape[] = [];
  const push = (layer: string, polygons: DxfPolygons): void => {
    for (const poly of polygons) {
      for (const ring of poly) {
        const pts = openRing(ring);
        if (pts) out.push({ layer, pts });
      }
    }
  };
  for (const c of geo.clusters) {
    for (const r of c.regions) {
      const name = project.materials[r.materialId]?.name ?? r.materialId;
      push(dxfLayerOfMaterial(name), r.polygons);
    }
    push(DXF_LAYER_CONTOUR, c.silhouette);
  }
  for (const w of geo.wallOutlines ?? []) push(WALL_LAYER[w.state], w.polygons);
  for (const f of geo.floors ?? []) push(dxfLayerOfFloor(f.typeCode), [[f.outline, ...f.holes]]);
  for (const s of geo.slabs ?? []) push(dxfLayerOfSlab(s.typeCode), [[s.outline, ...s.holes]]);
  for (const r of geo.rooms ?? []) push(DXF_LAYER_ROOM, [[r.outline, ...r.holes]]);
  for (const c of geo.ceilings ?? []) push(DXF_LAYER_CEILING, [[c.outline, ...c.holes]]);
  for (const r of geo.roofs ?? []) push(dxfLayerOfRoof(r.typeCode), [[r.outline]]);
  if (geo.roofProjections) push(DXF_LAYER_ROOF_PROJECTION, geo.roofProjections);
  for (const s of geo.stairs ?? []) {
    for (const o of s.outlines) push(DXF_LAYER_STAIR, [[o]]);
    for (const o of s.outlinesAbove ?? []) push(DXF_LAYER_STAIR_ABOVE, [[o]]);
    for (const post of s.posts ?? []) out.push({ layer: post.above ? DXF_LAYER_STAIR_ABOVE : DXF_LAYER_STAIR_POST, pts: post.pts });
    if (s.cut && s.cut.length >= 2) out.push({ layer: DXF_LAYER_STAIR_CUT, pts: s.cut, closed: false });
  }
  for (const o of geo.openings) {
    const state = o.state ?? 'cut';
    // Decisão X1 (docs/aberturas/A-pesquisa.md §5): o símbolo de planta vale em todas as camadas de vãos, corte
    // (ABERTURAS) e projeção (ABERTURA_*). Sem símbolo, o vão sai como retângulo fechado, como antes.
    if (!o.symbol) {
      out.push({ layer: OPENING_LAYER[state], pts: openingRect(o) });
      continue;
    }
    // O símbolo do corte vai à `ABERTURA_SIMBOLO`; o da projeção, à camada do estado (tracejado, cinza, ...).
    const layer = state === 'cut' ? DXF_LAYER_OPENING_SYMBOL : OPENING_LAYER[state];
    for (const s of o.symbol) out.push({ layer, pts: s.pts, closed: s.closed, dashed: s.dashed === true });
  }
  for (const boundary of geo.notes?.regions ?? []) if (boundary.length >= 3) push(DXF_LAYER_DETALHE, [[boundary]]);
  return out;
}

/** Textos da planta: os de anotação (cotas e textos do usuário) e os dos ambientes. */
const textsOf = (geo: DxfLevelGeometry): DxfNoteText[] => [...(geo.notes?.texts ?? []), ...(geo.sectionMarks?.texts ?? []), ...(geo.roomTexts ?? [])];

/** Camadas da tabela LAYER: `0` e as das polilinhas e das linhas, sem repetição e em ordem. */
function layerNamesOf(shapes: Shape[], lines: Line[], texts: DxfNoteText[]): string[] {
  return [...new Set(['0', ...shapes.map((s) => s.layer), ...lines.map((l) => l.layer), ...texts.map((t) => t.layer)])].sort();
}

/** Nomes das camadas que `exportDxf` põe na tabela LAYER para esta geometria (a base de `lineWeights`). */
export function dxfLayersOf(project: Project, geo: DxfLevelGeometry): string[] {
  return layerNamesOf(shapesOf(project, geo), linesOf(geo), textsOf(geo));
}

/**
 * Planta de um nível em DXF ASCII (AC1009, o R12): unidades em metros ($INSUNITS 6), uma camada por material
 * (`PAREDE_<material>`), `PAREDE_CONTORNO` para o contorno externo e `ABERTURAS` para os vãos de corte. Elementos fora do
 * corte entram nas camadas de projeção (`PAREDE_PROJECAO_*`, `ABERTURA_*`, `ESCADA_ACIMA`, `TELHADO_PROJECAO`), com tipo de
 * linha tracejado quando estão acima do corte; os vãos de projeção saem com o símbolo de planta (`DxfOpening.symbol`). Cada anel é uma POLYLINE fechada (flag 1): LWPOLYLINE só existe a partir do
 * AutoCAD R14. A tabela de tipos de linha só leva `DASHED` quando alguma camada o usa, então o arquivo sem projeções é o mesmo.
 * Com `geo.lineWeights`, cada camada leva o código 370 (largura arredondada ao valor DXF válido; sem entrada, -3); sem ele, a
 * tabela não tem 370.
 */
export function exportDxf(project: Project, levelId: Id, geo: DxfLevelGeometry): string {
  if (!project.levels.some((l) => l.id === levelId)) throw new Error(`Nível ausente: ${levelId}`);
  const shapes = shapesOf(project, geo);
  const lines = linesOf(geo);
  const texts = textsOf(geo);
  const layers = layerNamesOf(shapes, lines, texts);
  // Tipo DASHED na tabela se alguma camada o usa ou se algum traço o põe sozinho (símbolo de vão em camada contínua).
  const dashed = layers.some((name) => styleOf(name).linetype === 'DASHED') || shapes.some((s) => s.dashed === true);
  const all = [...shapes.flatMap((s) => s.pts), ...lines.flatMap((l) => [l.a, l.b]), ...texts.map((t) => t.at)];
  const lo = all.reduce((m, p) => ({ x: Math.min(m.x, p.x), y: Math.min(m.y, p.y) }), { x: 0, y: 0 });
  const hi = all.reduce((m, p) => ({ x: Math.max(m.x, p.x), y: Math.max(m.y, p.y) }), { x: 0, y: 0 });

  const out: string[] = [];
  const rec = (code: number, value: string | number): void => {
    out.push(String(code), String(value));
  };

  rec(0, 'SECTION');
  rec(2, 'HEADER');
  rec(9, '$ACADVER');
  rec(1, 'AC1009');
  rec(9, '$INSUNITS');
  rec(70, 6);
  rec(9, '$MEASUREMENT');
  rec(70, 1);
  rec(9, '$EXTMIN');
  rec(10, fmt(lo.x));
  rec(20, fmt(lo.y));
  rec(30, '0.000000');
  rec(9, '$EXTMAX');
  rec(10, fmt(hi.x));
  rec(20, fmt(hi.y));
  rec(30, '0.000000');
  rec(0, 'ENDSEC');

  rec(0, 'SECTION');
  rec(2, 'TABLES');
  rec(0, 'TABLE');
  rec(2, 'LTYPE');
  rec(70, dashed ? 2 : 1);
  rec(0, 'LTYPE');
  rec(2, 'CONTINUOUS');
  rec(70, 0);
  rec(3, 'Solid line');
  rec(72, 65);
  rec(73, 0);
  rec(40, '0.0');
  if (dashed) {
    // Traço de 0,25 m e espaço de 0,125 m (unidades do desenho, em metros).
    rec(0, 'LTYPE');
    rec(2, 'DASHED');
    rec(70, 0);
    rec(3, 'Dashed line');
    rec(72, 65);
    rec(73, 2);
    rec(40, '0.375');
    rec(49, '0.25');
    rec(49, '-0.125');
  }
  rec(0, 'ENDTAB');
  rec(0, 'TABLE');
  rec(2, 'LAYER');
  rec(70, layers.length);
  for (const name of layers) {
    const style = styleOf(name);
    rec(0, 'LAYER');
    rec(2, name);
    rec(70, 0);
    rec(62, style.color);
    rec(6, style.linetype);
    if (geo.lineWeights) {
      const w = geo.lineWeights[name];
      rec(370, w === undefined ? DXF_LINE_WEIGHT_DEFAULT : dxfLineWeight(w));
    }
  }
  rec(0, 'ENDTAB');
  rec(0, 'ENDSEC');

  rec(0, 'SECTION');
  rec(2, 'ENTITIES');
  for (const s of shapes) {
    rec(0, 'POLYLINE');
    rec(8, s.layer);
    if (s.dashed) rec(6, 'DASHED');
    rec(66, 1);
    rec(10, '0.000000');
    rec(20, '0.000000');
    rec(70, s.closed === false ? 0 : 1);
    for (const p of s.pts) {
      rec(0, 'VERTEX');
      rec(8, s.layer);
      rec(10, fmt(p.x));
      rec(20, fmt(p.y));
    }
    rec(0, 'SEQEND');
    rec(8, s.layer);
  }
  for (const l of lines) {
    rec(0, 'LINE');
    rec(8, l.layer);
    rec(10, fmt(l.a.x));
    rec(20, fmt(l.a.y));
    rec(30, '0.000000');
    rec(11, fmt(l.b.x));
    rec(21, fmt(l.b.y));
    rec(31, '0.000000');
  }
  for (const t of texts) for (const [c, v] of dxfTextRecords(t)) rec(c, v);
  rec(0, 'ENDSEC');
  rec(0, 'EOF');
  return `${out.join('\r\n')}\r\n`;
}
