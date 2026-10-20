import type { Id, Project } from '@hestia/model';

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

/** Vão em planta: retângulo com `width` ao longo de `u` (vetor unitário) e `thickness` na perpendicular. */
export interface DxfOpening {
  center: DxfPoint;
  u: DxfPoint;
  width: number;
  thickness: number;
}

/**
 * Geometria resolvida de um nível. Quem chama obtém com `resolveLevel` e `openingGeometry` do @hestia/engine:
 * o pacote io não pode importar o engine (docs/01 §1), então recebe só os dados.
 */
export interface DxfLevelGeometry {
  clusters: DxfCluster[];
  openings: DxfOpening[];
  /** Pisos do nível: contorno e furos em planta; `typeCode` é o código do tipo (vira a camada `PISO_<código>`). */
  floors?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][]; typeCode: string }>;
  /** Lajes do nível: contorno e furos em planta; `typeCode` vira a camada `LAJE_<código>`. A inclinação não aparece na planta. */
  slabs?: Array<{ outline: DxfPoint[]; holes: DxfPoint[][]; typeCode: string }>;
  /**
   * Telhados do nível: contorno do beiral (POLYLINE fechada na camada `TELHADO_<código>`) e segmentos de cumeeira,
   * espigão e rincão em planta (LINE na camada `TELHADO_CUMEEIRA`, todos juntos). Quem monta a geometria é o engine.
   */
  roofs?: Array<{ outline: DxfPoint[]; ridges: Array<[DxfPoint, DxfPoint]>; typeCode: string }>;
}

export const DXF_LAYER_CONTOUR = 'PAREDE_CONTORNO';
export const DXF_LAYER_OPENINGS = 'ABERTURAS';
/** Camada das linhas de cumeeira, espigão e rincão (LINE). */
export const DXF_LAYER_ROOF_RIDGE = 'TELHADO_CUMEEIRA';

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
}

interface Line {
  layer: string;
  a: DxfPoint;
  b: DxfPoint;
}

/** Linhas de cumeeira, espigão e rincão dos telhados do nível (LINE). */
function linesOf(geo: DxfLevelGeometry): Line[] {
  return (geo.roofs ?? []).flatMap((r) => r.ridges.map(([a, b]) => ({ layer: DXF_LAYER_ROOF_RIDGE, a, b })));
}

/** Polilinhas fechadas do nível: por cluster, as regiões de material e depois o contorno; depois os pisos, as lajes, os telhados e, por último, os vãos. */
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
  for (const f of geo.floors ?? []) push(dxfLayerOfFloor(f.typeCode), [[f.outline, ...f.holes]]);
  for (const s of geo.slabs ?? []) push(dxfLayerOfSlab(s.typeCode), [[s.outline, ...s.holes]]);
  for (const r of geo.roofs ?? []) push(dxfLayerOfRoof(r.typeCode), [[r.outline]]);
  for (const o of geo.openings) out.push({ layer: DXF_LAYER_OPENINGS, pts: openingRect(o) });
  return out;
}

/**
 * Planta de um nível em DXF ASCII (AC1009, o R12): unidades em metros ($INSUNITS 6), uma camada por material
 * (`PAREDE_<material>`), `PAREDE_CONTORNO` para o contorno externo e `ABERTURAS` para os vãos.
 * Cada anel é uma POLYLINE fechada (flag 1): LWPOLYLINE só existe a partir do AutoCAD R14.
 */
export function exportDxf(project: Project, levelId: Id, geo: DxfLevelGeometry): string {
  if (!project.levels.some((l) => l.id === levelId)) throw new Error(`Nível ausente: ${levelId}`);
  const shapes = shapesOf(project, geo);
  const lines = linesOf(geo);
  const layers = [...new Set(['0', ...shapes.map((s) => s.layer), ...lines.map((l) => l.layer)])].sort();
  const all = [...shapes.flatMap((s) => s.pts), ...lines.flatMap((l) => [l.a, l.b])];
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
  rec(0, 'ENDSEC');
  rec(0, 'EOF');
  return `${out.join('\r\n')}\r\n`;
}
