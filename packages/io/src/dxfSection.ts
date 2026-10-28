import type { GraphicsCategory, Id, Project } from '@hestia/model';
import { DXF_LINE_WEIGHT_DEFAULT, dxfLineWeight, type DxfPoint, type DxfPolygons } from './dxf.ts';

/**
 * DXF do corte e da elevação (decisão 0015 §2.7). O desenho é (t, z), com z para cima; cada camada leva a largura do
 * peso da categoria na escala da vista (código 370), como a planta. O io não conhece o motor: quem monta a geometria é
 * o app, que entrega os polígonos já visíveis e a categoria de cada um.
 */

/** Categoria de uma camada do corte/elevação e se o peso é o de corte ou o de projeção. */
export type DxfSectionRole = { category: GraphicsCategory; view: 'cut' | 'projection' };

/** Item do desenho: polígonos em (t, z) e a categoria gráfica que dá cor/peso à camada. */
export interface DxfSectionItem {
  category: GraphicsCategory;
  polygons: DxfPolygons;
}

/** Geometria do corte/elevação para o DXF. */
export interface DxfSectionGeometry {
  /** Regiões atravessadas pelo plano de corte (peso de corte). */
  cut: DxfSectionItem[];
  /** O que está além do plano, visível (peso de projeção). */
  beyond: DxfSectionItem[];
  /** Vãos visíveis: corte ou projeção, com a categoria porta/janela. */
  openings?: Array<DxfSectionItem & { cut: boolean }>;
  /** Contorno externo do desenho (peso de corte da parede). */
  silhouette?: DxfPolygons;
  /**
   * Largura de linha de cada camada, em centésimos de mm (código 370; arredondada ao valor DXF válido). Ausente: a
   * tabela não leva 370. Quem monta preenche com `sectionLineWeightsOf` (apps/web), na escala da vista.
   */
  lineWeights?: Partial<Record<string, number>>;
}

const CATEGORY_LAYER: Record<GraphicsCategory, string> = {
  wall: 'CORTE_PAREDE',
  door: 'CORTE_PORTA',
  window: 'CORTE_JANELA',
  floor: 'CORTE_PISO',
  slab: 'CORTE_LAJE',
  roof: 'CORTE_TELHADO',
  stair: 'CORTE_ESCADA',
  room: 'CORTE_AMBIENTE',
  annotation: 'CORTE_ANOTACAO',
};

/** Contorno externo do corte/elevação (união das regiões visíveis). */
export const DXF_SECTION_LAYER_SILHOUETTE = 'CORTE_CONTORNO';
/** Linhas de nível: anotação, sem largura de linha (0). */
export const DXF_SECTION_LAYER_LEVELS = 'CORTE_NIVEIS';

/** Camada de uma categoria no corte (`view = 'cut'`) ou na projeção (`view = 'projection'`). */
export function dxfSectionLayerOf(category: GraphicsCategory, view: 'cut' | 'projection' = 'cut'): string {
  const base = CATEGORY_LAYER[category];
  return view === 'projection' ? `${base}_PROJECAO` : base;
}

/** Categoria e papel de uma camada do corte/elevação; `annotation` para os níveis; `undefined` para a camada 0. */
export function dxfSectionLineRoleOf(layer: string): DxfSectionRole | 'annotation' | undefined {
  if (layer === DXF_SECTION_LAYER_LEVELS) return 'annotation';
  if (layer === DXF_SECTION_LAYER_SILHOUETTE) return { category: 'wall', view: 'cut' };
  for (const category of Object.keys(CATEGORY_LAYER) as GraphicsCategory[]) {
    if (layer === CATEGORY_LAYER[category]) return { category, view: 'cut' };
    if (layer === `${CATEGORY_LAYER[category]}_PROJECAO`) return { category, view: 'projection' };
  }
  return undefined;
}

// units-ok: coordenada DXF (formato de máquina)
const fmt = (v: number): string => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6);

/** Anel sem o vértice de fechamento repetido; com menos de 3 vértices não há área. */
function openRing(ring: DxfPoint[]): DxfPoint[] | null {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const repeated = ring.length > 1 && first !== undefined && last !== undefined && Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9;
  const pts = repeated ? ring.slice(0, -1) : ring;
  return pts.length >= 3 ? pts : null;
}

interface Shape {
  layer: string;
  pts: DxfPoint[];
}

/** Polilinhas fechadas do desenho, na ordem de pintura (projeção antes do corte). */
function shapesOf(geo: DxfSectionGeometry): Shape[] {
  const out: Shape[] = [];
  const push = (layer: string, polygons: DxfPolygons): void => {
    for (const poly of polygons) {
      for (const ring of poly) {
        const pts = openRing(ring);
        if (pts) out.push({ layer, pts });
      }
    }
  };
  for (const b of geo.beyond) push(dxfSectionLayerOf(b.category, 'projection'), b.polygons);
  for (const o of geo.openings ?? []) push(dxfSectionLayerOf(o.category, o.cut ? 'cut' : 'projection'), o.polygons);
  for (const c of geo.cut) push(dxfSectionLayerOf(c.category), c.polygons);
  if (geo.silhouette) push(DXF_SECTION_LAYER_SILHOUETTE, geo.silhouette);
  return out;
}

/** Nomes das camadas que `exportSectionDxf` põe na tabela (a base de `lineWeights`). */
export function dxfSectionLayersOf(geo: DxfSectionGeometry): string[] {
  return [...new Set(['0', ...shapesOf(geo).map((s) => s.layer)])].sort();
}

/**
 * Corte ou elevação em DXF ASCII (AC1009, R12), unidades em metros, z para cima. As camadas seguem a categoria
 * (`CORTE_PAREDE`, `CORTE_PISO`, …, `_PROJECAO` para o que está além) e o contorno externo vai em `CORTE_CONTORNO`.
 * Com `geo.lineWeights`, cada camada leva o código 370; sem ele, a tabela é a de antes.
 */
export function exportSectionDxf(project: Project, viewId: Id, geo: DxfSectionGeometry): string {
  if (!project.views.some((v) => v.id === viewId)) throw new Error(`Vista ausente: ${viewId}`);
  const shapes = shapesOf(geo);
  const layers = [...new Set(['0', ...shapes.map((s) => s.layer)])].sort();
  const all = shapes.flatMap((s) => s.pts);
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
  rec(70, 1);
  rec(0, 'LTYPE');
  rec(2, 'CONTINUOUS');
  rec(70, 0);
  rec(3, 'Solid line');
  rec(72, 65);
  rec(73, 0);
  rec(40, '0.0');
  rec(0, 'ENDTAB');
  rec(0, 'TABLE');
  rec(2, 'LAYER');
  rec(70, layers.length);
  for (const name of layers) {
    rec(0, 'LAYER');
    rec(2, name);
    rec(70, 0);
    rec(62, 7);
    rec(6, 'CONTINUOUS');
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
    rec(66, 1);
    rec(10, '0.000000');
    rec(20, '0.000000');
    rec(70, 1);
    for (const p of s.pts) {
      rec(0, 'VERTEX');
      rec(8, s.layer);
      rec(10, fmt(p.x));
      rec(20, fmt(p.y));
    }
    rec(0, 'SEQEND');
    rec(8, s.layer);
  }
  rec(0, 'ENDSEC');
  rec(0, 'EOF');
  return `${out.join('\r\n')}\r\n`;
}
