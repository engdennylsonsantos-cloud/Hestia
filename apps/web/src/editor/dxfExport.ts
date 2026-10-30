import { openingSymbolPaths, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { buildOpeningModel, computeSection, junctionLevel, resolveCeilings, resolveLevel, levelFrames, openingGeometry, resolveFloors, resolveRoofs, resolveRooms, resolveRampsOnLevel, resolveSlabs, resolveStairsOnLevel, type ResolvedRamp, type ResolvedStair, type JunctionLevel, type SectionOrigin, type ViewClass } from '@hestia/engine';
import { buildPlanGeometry, climbWalk, levelBox, LIGHT, openingPlanWorldPaths, ownerOf, planViewOf, resolverZoom, risersInClimbOrder, roofFootprint, roomFullText, roomLabelAt, spiralByComponent, spiralPostRing, stairCut, type PlanOps, type PlanView, type StairCut } from '@hestia/render';
import {
  DXF_BLOCKS_SECTION,
  DXF_STYLE_TABLE,
  dxfEscapeText,
  dxfGenericRecords,
  dxfLayersOf,
  dxfLineRoleOf,
  dxfRecorder,
  DXF_LAYER_RAMP_TEXT,
  DXF_LAYER_ROOM_TEXT,
  dxfLineWeight,
  dxfSectionLayersOf,
  dxfSectionLineRoleOf,
  exportDxf,
  exportSectionDxf,
  notesDxfOf,
  sectionMarksDxfOf,
  type DxfLevelGeometry,
  type DxfOpening,
  type DxfPoint,
  type DxfSectionGeometry,
  type DxfSectionItem,
  type DxfSymbolPath,
  type DxfViewState,
} from '@hestia/io';
import { areaPlanOf, DIM_TEXT_MM, dimensionGeometry, dimensionPoints, dimensionText, openingTypeById, unitsOf, GRAPHICS_CATEGORIES, formatRampSlope, graphicsOf, levelGraphicsOf, lineWeightMm, openingAngle2d, openingLeafPlan, openingPlanDisplay, openingShowSwing, openingSwingStyle, openingsOfWall, planAnnotationsOf, sectionGraphicsOf, sectionPoints, sectionTitleOf, type AreaPlan, type GraphicsCategory, type Id, type Project } from '@hestia/model';
import { saveText } from './saveText.ts';

/**
 * Região de um piso ou laje para o DXF (F7.1, 0023 §6): a região resolvida pela junção quando houve corte; sem corte, a camada
 * de cima (como a planta, para o término por camada valer também no DXF).
 */
function resolvedRegion(jl: JunctionLevel, id: Id, polygon: MultiPolygon): MultiPolygon {
  const el = jl.elements.get(id);
  return el?.cut ? el.region : polygon;
}

type StairDxf = NonNullable<DxfLevelGeometry['stairs']>[number];
type RampDxf = NonNullable<DxfLevelGeometry['ramps']>[number];

/** Tolerância (m) nas comparações de cota, como na tela (a borda exata conta como dentro). */
const EPS = 1e-9;

/**
 * Zoom usado no símbolo de corte da escada: `stairCut` dá 8 px de avanço em cada lado; com zoom 80 são 0,10 m, em metros.
 * Os dentes do zigue-zague seguem `cutSymbol` da planta (4 px de amplitude, zoom 80: 0,05 m).
 */
const STAIR_CUT_ZOOM = 80;

/**
 * Seta de subida ao longo da caminhada `pts` (do primeiro ao último espelho, como a tela): um LINE por trecho da haste e,
 * no fim, as duas pontas a 30° da última direção, de 0,20 m ou um quarto do comprimento total (o menor). Pontos repetidos
 * e vértices no meio de um trecho reto saem (os pontos médios de um lance reto são colineares: a seta fica um só trecho,
 * como antes). Vazia sem comprimento.
 */
export function arrowOfPath(pts: DxfPoint[]): Array<[DxfPoint, DxfPoint]> {
  const distinct = pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1]!.x, q.y - pts[i - 1]!.y) > 1e-9);
  const path = distinct.filter((q, i) => {
    if (i === 0 || i === distinct.length - 1) return true;
    const a = distinct[i - 1]!;
    const c = distinct[i + 1]!;
    const ux = q.x - a.x;
    const uy = q.y - a.y;
    const vx = c.x - q.x;
    const vy = c.y - q.y;
    const straight = Math.abs(ux * vy - uy * vx) < 1e-9 && ux * vx + uy * vy > 0;
    return !straight;
  });
  if (path.length < 2) return [];
  const shaft: Array<[DxfPoint, DxfPoint]> = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    shaft.push([a, b]);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const tip = path[path.length - 1]!;
  const before = path[path.length - 2]!;
  const dx = tip.x - before.x;
  const dy = tip.y - before.y;
  const len = Math.hypot(dx, dy);
  const bx = -dx / len;
  const by = -dy / len;
  const L = Math.min(0.2, total * 0.25);
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  // Gira a direção de volta de ±30° para as duas pontas.
  const barb = (sg: 1 | -1): DxfPoint => ({ x: tip.x + (bx * c - sg * by * s) * L, y: tip.y + (sg * bx * s + by * c) * L });
  return [...shaft, [tip, barb(1)], [tip, barb(-1)]];
}

/** Seta de subida de um só trecho de `a` a `b` (haste e duas pontas). Caso particular de `arrowOfPath`. */
export function stairArrow(a: DxfPoint, b: DxfPoint): Array<[DxfPoint, DxfPoint]> {
  return arrowOfPath([a, b]);
}

/** Símbolo de corte em zigue-zague de oito dentes, em metros (espelha `cutSymbol` da planta). */
function cutSymbolDxf(c: StairCut): DxfPoint[] {
  const teeth = 8;
  const amp = 4 / STAIR_CUT_ZOOM;
  return Array.from({ length: teeth + 1 }, (_, j) => {
    const s = -c.half + (2 * c.half * j) / teeth;
    const k = j % 2 === 0 ? -amp : amp;
    return { x: c.at.x + c.across.x * s + c.walk.x * k, y: c.at.y + c.across.y * s + c.walk.y * k };
  });
}

/**
 * Escada resolvida em geometria de DXF, na vista do nível (decisão 0013 §4): degraus até o topo do intervalo, divididos
 * pela cota de corte (cheios até ela, tracejados acima); espelhos e seta só até o topo; símbolo de corte quando o plano
 * cruza a escada. A seta segue a caminhada da tela (`climbWalk`: a explícita do lance, senão os pontos médios). Caracol:
 * o poste (círculo de `rInner`, `spiralPostRing`) na cota de corte ou abaixo, senão acima (tracejado, como os degraus).
 */
export function stairDxf(p: Project, r: ResolvedStair, view: { cutZ: number; topZ: number }): StairDxf {
  const risers = risersInClimbOrder(r).filter((k) => k.z1 <= view.topZ + EPS);
  const steps = r.steps.filter((st) => st.z <= view.topZ + EPS);
  const outline = (st: (typeof steps)[number]): DxfPoint[] => st.polygon.map((q) => ({ x: q.x, y: q.y }));
  const cut = stairCut(r, risers, STAIR_CUT_ZOOM, view.cutZ);
  const walk: Vec2[] = climbWalk(p, r, risers);
  const posts = [...spiralByComponent(p, r).values()].map((sp) => ({ pts: spiralPostRing(sp.center, sp.rInner), above: r.baseZ > view.cutZ + EPS }));
  return {
    outlines: steps.filter((st) => st.z <= view.cutZ + EPS).map(outline),
    outlinesAbove: steps.filter((st) => st.z > view.cutZ + EPS).map(outline),
    risers: risers.map((k): [DxfPoint, DxfPoint] => [k.a, k.b]),
    arrow: arrowOfPath(walk),
    cut: cut ? cutSymbolDxf(cut) : undefined,
    ...(posts.length > 0 ? { posts } : {}),
  };
}

/**
 * Rampa resolvida em geometria de DXF: lances e patamares até o topo do intervalo, divididos pela cota de corte (cheios
 * até ela, tracejados acima); seta por lance no eixo `start → end`; linha de corte transversal no lance cruzado e o texto
 * da inclinação no meio do primeiro lance, girado com o eixo. O lance que cruza o corte aparece nas duas camadas.
 */
export function rampDxf(_p: Project, rr: ResolvedRamp, view: { cutZ: number; topZ: number }): RampDxf {
  const outline = (ring: { x: number; y: number }[]): DxfPoint[] => ring.map((q) => ({ x: q.x, y: q.y }));
  const outlines: DxfPoint[][] = [];
  const outlinesAbove: DxfPoint[][] = [];
  for (const f of rr.flights) {
    const poly = outline(f.polygon);
    if (f.z0 <= view.cutZ + EPS) outlines.push(poly);
    if (f.z1 > view.cutZ + EPS && f.z1 <= view.topZ + EPS) outlinesAbove.push(poly);
  }
  for (const l of rr.landings) {
    if (l.z > view.topZ + EPS) continue;
    if (l.z <= view.cutZ + EPS) outlines.push(outline(l.polygon));
    else outlinesAbove.push(outline(l.polygon));
  }
  const arrow = rr.flights.flatMap((f) => stairArrow({ x: f.start.x, y: f.start.y }, { x: f.end.x, y: f.end.y }));
  const cut = rr.flights
    .filter((f) => f.z0 < view.cutZ && view.cutZ < f.z1)
    .map((f): [DxfPoint, DxfPoint] => {
      const t = (view.cutZ - f.z0) / (f.z1 - f.z0);
      const at = (a: { x: number; y: number }, b: { x: number; y: number }): DxfPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return [at(f.startEdge[0], f.endEdge[0]), at(f.startEdge[1], f.endEdge[1])];
    });
  const first = rr.flights[0];
  const texts = first
    ? [
        {
          at: { x: (first.start.x + first.end.x) / 2, y: (first.start.y + first.end.y) / 2 },
          text: formatRampSlope(rr.slope),
          height: ROOM_TEXT_HEIGHT_M,
          rotation: (Math.atan2(first.end.y - first.start.y, first.end.x - first.start.x) * 180) / Math.PI,
          layer: DXF_LAYER_RAMP_TEXT,
        },
      ]
    : [];
  return { outlines, outlinesAbove, arrow, cut, texts };
}

/**
 * Estado de um elemento para o DXF, a partir da vista da tela: `null` quando está fora do intervalo (não sai). Sem
 * classificação, vale o corte (o vão desenhado como antes).
 */
function dxfStateOf(cls: ViewClass | undefined): DxfViewState | null {
  if (cls === undefined || cls === 'cut') return 'cut';
  if (cls === 'hidden') return null;
  return cls;
}

/**
 * Largura de linha (centésimos de mm) de cada camada da planta: o peso da categoria na escala da vista (decisão 0015 §2
 * item 7). Corte e projeção usam o peso próprio; a substituição da vista (`overrides[cat].cutWeight` e `projectionWeight`)
 * vale sobre o do projeto. A escala da vista entra pela tabela `lineWeightMm`. Marcas de escada saem com 0.
 */
export function lineWeightsOf(p: Project, levelId: Id, geo: DxfLevelGeometry): Record<string, number> {
  const pg = graphicsOf(p);
  const vg = levelGraphicsOf(p, levelId);
  const out: Record<string, number> = {};
  for (const layer of dxfLayersOf(p, geo)) {
    const role = dxfLineRoleOf(layer);
    if (role === undefined) continue;
    if (role === 'annotation') {
      out[layer] = 0;
      continue;
    }
    const over = vg.overrides[role.category];
    const base = pg.categories[role.category];
    const weight = role.view === 'cut' ? (over.cutWeight ?? base.cutWeight) : (over.projectionWeight ?? base.projectionWeight);
    out[layer] = dxfLineWeight(lineWeightMm(pg.lineWeights, weight, vg.scale) * 100);
  }
  return out;
}

/**
 * Geometria do nível para o DXF, na mesma vista da planta na tela (decisão 0013 §4, `planViewOf`): paredes e aberturas
 * pela geometria com o plano de corte da vista, paredes fora do corte como contorno de projeção, pisos, lajes, telhados e
 * escadas com a cota de corte e o topo do intervalo. O que está fora do intervalo não sai, exceto a projeção do telhado
 * (a tela a mostra tracejada por padrão, só com a preferência "Mostrar projeção da cobertura" ligada; `showRoofProjection`
 * reflete essa preferência). Categoria oculta na vista (`overrides[cat].visible === false`, decisão 0015 §2 item 4) não
 * sai. Cada camada leva a largura de linha da categoria na escala da vista (`lineWeightsOf`). O io não importa o engine,
 * então a montagem fica aqui, no web.
 */
export function dxfGeometryOf(p: Project, levelId: Id, showRoofProjection = true): DxfLevelGeometry {
  const view: PlanView = planViewOf(p, levelId);
  const { hidden } = view;
  const vg = levelGraphicsOf(p, levelId);
  const shown = (c: GraphicsCategory): boolean => vg.overrides[c].visible !== false;
  const openings: DxfOpening[] = levelFrames(p, levelId).flatMap((f) =>
    openingsOfWall(p, f.wall.id).flatMap((o) => {
      const state = shown(o.kind) ? dxfStateOf(view.cls.get(o.id)) : null;
      if (state === null) return [];
      const g = openingGeometry(p, o, f);
      // Planta da esquadria pelo modelo único (spec E §4.1), no nível médio: o mesmo desenho da tela. O DXF põe a
      // camada; o desenho vem de `openingPlanPaths` e vale no corte (ABERTURAS) e na projeção (ABERTURA_*).
      const type = openingTypeById(p, o.typeId);
      const model = type ? buildOpeningModel(p, o, g, f) : null;
      // No corte, a cota local desconta a base da parede e a soleira; na projeção, corta no meio do modelo.
      const cutZ = state === 'cut' ? view.cutZ - (f.z?.z0 ?? 0) - g.sill : (model?.height ?? 0) / 2;
      const symbol: DxfSymbolPath[] = type && model
        ? openingPlanWorldPaths(g, model, {
            detail: 'mid',
            angle: (openingAngle2d(type) * Math.PI) / 180,
            planDisplay: openingPlanDisplay(type),
            showSwing: openingShowSwing(type),
            swingStyle: openingSwingStyle(type),
            leafPlan: openingLeafPlan(type),
            cutZ,
          }).map((s) => ({ pts: s.pts, closed: s.closed, dashed: s.dash !== undefined }))
        : openingSymbolPaths(g).map((s) => ({ pts: s.pts, closed: s.closed, dashed: s.dash !== undefined }));
      return [{ center: g.center, u: g.u, width: g.width, thickness: g.thickness, state, symbol }];
    }),
  );
  const roofs = resolveRoofs(p, levelId);
  const jl = junctionLevel(p, levelId);
  // Ambientes (decisão 0018, 0037): contorno em AMBIENTES e rótulo completo (nome, número, área) em AMBIENTES_TEXTO; sem circuito, nada sai.
  const rooms = shown('room') ? resolveRooms(p, levelId).filter((r) => r.polygon && !hidden.has(r.roomId)) : [];
  const geo: DxfLevelGeometry = {
    rooms: rooms.map((r) => ({ outline: r.polygon![0] ?? [], holes: r.polygon!.slice(1) })),
    roomTexts: rooms.flatMap((r) => {
      const at = roomLabelAt(r);
      return at ? [{ at, text: roomFullText(r, unitsOf(p)), height: ROOM_TEXT_HEIGHT_M, rotation: 0, layer: DXF_LAYER_ROOM_TEXT }] : [];
    }),
    clusters: shown('wall') ? view.geo.clusters : [],
    openings,
    wallOutlines: shown('wall') ? view.outlines.map((o) => ({ state: o.cls, polygons: o.shape })) : [],
    roofProjections: shown('roof') && showRoofProjection ? roofs.filter((r) => hidden.has(r.roofId)).flatMap((r) => roofFootprint(r)) : [],
    floors: shown('floor')
      ? resolveFloors(p, levelId)
          .filter((f) => !hidden.has(f.floorId))
          .flatMap((f) => resolvedRegion(jl, f.floorId, f.layers.find((l) => !l.membrane)?.polygon ?? f.polygon).map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.floorTypes[f.typeId]?.code ?? '' })))
      : [],
    // Forros: só na planta de forro (decisão 0021); na planta baixa ficam acima do topo e não saem.
    ceilings: shown('floor') && view.range.direction === 'up'
      ? resolveCeilings(p, levelId)
          .filter((c) => !hidden.has(c.ceilingId))
          .flatMap((c) => c.polygon.map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1) })))
      : [],
    slabs: shown('slab')
      ? resolveSlabs(p, levelId)
          .filter((s) => !hidden.has(s.slabId))
          .flatMap((s) => resolvedRegion(jl, s.slabId, s.layers.find((l) => !l.membrane)?.polygon ?? s.polygon).map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.slabTypes[s.typeId]?.code ?? '' })))
      : [],
    // Escadas: degraus e patamares (contorno), espelhos, seta de subida e símbolo de corte, com a cota de corte da vista.
    stairs: shown('stair')
      ? resolveStairsOnLevel(p, levelId)
          .filter((s) => !hidden.has(s.id))
          .map((s) => stairDxf(p, s, { cutZ: view.cutZ, topZ: view.topZ }))
      : [],
    // Rampas: mesma categoria gráfica da escada; contornos, seta, corte e inclinação.
    ramps: shown('stair')
      ? resolveRampsOnLevel(p, levelId)
          .filter((rr) => !hidden.has(rr.id))
          .map((rr) => rampDxf(p, rr, { cutZ: view.cutZ, topZ: view.topZ }))
      : undefined,
    // Telhado: contorno do beiral e linhas de cumeeira, espigão e rincão (as de beiral já estão no contorno).
    roofs: shown('roof')
      ? roofs
          .filter((r) => !hidden.has(r.roofId))
          .map((r) => ({
            outline: p.elements[r.roofId]?.kind === 'roof' ? (p.elements[r.roofId] as { boundary: Array<{ x: number; y: number }> }).boundary : [],
            ridges: r.lines.filter((l) => l.kind !== 'eave' && l.kind !== 'gable' && l.kind !== 'break').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
            gables: r.lines.filter((l) => l.kind === 'gable').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
            breaks: r.lines.filter((l) => l.kind === 'break').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
            typeCode: p.roofTypes[r.typeId]?.code ?? '',
          }))
      : [],
  };
  // Cotas, textos (decisão 0019) e marcas de corte/elevação seguem a visibilidade da categoria 'anotação' e a escala.
  const withNotes: DxfLevelGeometry = {
    ...geo,
    ...(shown('annotation')
      ? { notes: notesDxfOf(p, levelId, vg.scale), sectionMarks: sectionMarksDxfOf(p, vg.scale) }
      : {}),
  };
  return { ...withNotes, lineWeights: lineWeightsOf(p, levelId, withNotes) };
}

/** Altura (m de desenho) do texto do ambiente no DXF. */
const ROOM_TEXT_HEIGHT_M = 0.2;

/** Fim do arquivo que `exportDxf` devolve: o `ENDSEC` da seção ENTITIES seguido do `EOF`. */
const DXF_END = '\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n';

/**
 * Põe registros no fim da seção ENTITIES, antes do `ENDSEC` (sem abrir outra `SECTION`). Sem registros, devolve o arquivo
 * como veio: o DXF sem objetos importados é byte a byte o de antes.
 */
function withEntityRecords(dxf: string, records: string[]): string {
  if (records.length === 0) return dxf;
  if (!dxf.endsWith(DXF_END)) throw new Error('DXF sem o fim esperado (ENDSEC/EOF)');
  return `${dxf.slice(0, -DXF_END.length)}\r\n${records.join('\r\n')}${DXF_END}`;
}

/**
 * Texto DXF da planta do nível, na vista do intervalo. Os objetos importados (`Generic`) entram como o contorno em planta
 * de cada um, na camada `IMPORTADO`; a categoria `generic` oculta na vista não sai, como as demais.
 */
/** Layer de um traço da planta de área: referência, chamada ou contorno. */
const areaLayerOf = (color: string, pts: number): string => (color === '#4b5563' ? 'AMBIENTES_REFERENCIA' : color === '#111827' && pts === 2 ? 'AMBIENTES_CHAMADA' : 'AMBIENTES');

/**
 * DXF R12 (AC1009) da planta de área, no mesmo formato de `exportDxf`: HEADER, TABLES (LTYPE, LAYER, STYLE), BLOCKS vazia
 * e ENTITIES com LINE e TEXT. Antes declarava AC1015 sem a estrutura do R2000 (handles, BLOCK_RECORD…) e o AutoCAD o
 * recusava ("DXF read error"); o 370 das camadas também não existe no R12.
 */
function opsToDxf(ops: PlanOps, zoom: number): string {
  const out: string[] = [];
  const rec = dxfRecorder(out);
  const layers = new Set<string>(['AMBIENTES_TEXTO']);
  for (const s of ops.strokes) layers.add(areaLayerOf(s.color, s.pts.length));
  rec(0, 'SECTION'); rec(2, 'HEADER'); rec(9, '$ACADVER'); rec(1, 'AC1009'); rec(9, '$INSUNITS'); rec(70, 6); rec(9, '$MEASUREMENT'); rec(70, 1); rec(0, 'ENDSEC');
  rec(0, 'SECTION'); rec(2, 'TABLES');
  rec(0, 'TABLE'); rec(2, 'LTYPE'); rec(70, 1); rec(0, 'LTYPE'); rec(2, 'CONTINUOUS'); rec(70, 0); rec(3, 'Solid line'); rec(72, 65); rec(73, 0); rec(40, 0); rec(0, 'ENDTAB');
  rec(0, 'TABLE'); rec(2, 'LAYER'); rec(70, layers.size);
  for (const name of layers) { rec(0, 'LAYER'); rec(2, name); rec(70, 0); rec(62, 7); rec(6, 'CONTINUOUS'); }
  rec(0, 'ENDTAB');
  for (const [c, v] of DXF_STYLE_TABLE) rec(c, v);
  rec(0, 'ENDSEC');
  for (const [c, v] of DXF_BLOCKS_SECTION) rec(c, v);
  rec(0, 'SECTION'); rec(2, 'ENTITIES');
  for (const s of ops.strokes) {
    const layer = areaLayerOf(s.color, s.pts.length);
    const pts = s.closed && s.pts.length > 2 ? [...s.pts, s.pts[0]!] : s.pts;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      rec(0, 'LINE'); rec(8, layer); rec(10, a.x); rec(20, a.y); rec(30, 0); rec(11, b.x); rec(21, b.y); rec(31, 0);
    }
  }
  for (const l of ops.labels) {
    if (l.maskBoundary || !l.text) continue;
    const h = (l.fontPx ?? 12) / zoom;
    rec(0, 'TEXT'); rec(8, 'AMBIENTES_TEXTO'); rec(10, l.at.x); rec(20, l.at.y); rec(30, 0); rec(40, h); rec(1, dxfEscapeText(l.text)); rec(50, l.rotation ?? 0);
  }
  rec(0, 'ENDSEC'); rec(0, 'EOF');
  return `${out.join('\r\n')}\r\n`;
}

/** Põe registros no fim da seção ENTITIES do DXF mínimo de `opsToDxf` (antes do `ENDSEC`). */
function appendAreaRecords(dxf: string, records: string[]): string {
  if (records.length === 0) return dxf;
  if (!dxf.endsWith(DXF_END)) throw new Error('DXF sem o fim esperado (ENDSEC/EOF)');
  return `${dxf.slice(0, -DXF_END.length)}\r\n${records.join('\r\n')}${DXF_END}`;
}

const samePoint = (a: Vec2, b: Vec2): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/**
 * Registros DXF das anotações da planta de área (cotas, textos e detalhes). A geometria da planta já as desenha
 * quando o render da área passou a incluí-las; o que ainda não estiver nas operações é escrito aqui, sem duplicar.
 */
function areaAnnotationRecords(p: Project, plan: AreaPlan, ops: PlanOps): string[] {
  const a = planAnnotationsOf(plan);
  if (a.dimensions.length + a.texts.length + a.detailLines.length + a.detailRegions.length === 0) return [];
  const out: string[] = [];
  const rec = dxfRecorder(out);
  const line = (layer: string, start: Vec2, end: Vec2): void => {
    rec(0, 'LINE'); rec(8, layer); rec(10, start.x); rec(20, start.y); rec(30, 0); rec(11, end.x); rec(21, end.y); rec(31, 0);
  };
  const text = (layer: string, at: Vec2, height: number, value: string, rotation = 0): void => {
    rec(0, 'TEXT'); rec(8, layer); rec(10, at.x); rec(20, at.y); rec(30, 0); rec(40, height); rec(1, dxfEscapeText(value)); rec(50, rotation);
  };
  const rendered = new Set(ops.labels.map((l) => l.text).filter((x): x is string => !!x));
  const mPerMm = plan.scale / 1000;
  for (const d of a.dimensions) {
    const value = dimensionText(p, d, unitsOf(p));
    if (rendered.has(value)) continue;
    const { a: pa, b: pb } = dimensionPoints(p, d);
    const textMm = d.textHeight ?? DIM_TEXT_MM;
    const g = dimensionGeometry(pa, pb, d.offset, mPerMm, textMm, d.textAt);
    for (const seg of [g.line, ...g.extensions, ...g.ticks]) line('ANOTACOES', seg[0], seg[1]);
    text('ANOTACOES_TEXTO', g.textAt, (textMm * plan.scale) / 1000, value, g.textRotation);
  }
  for (const t of a.texts) {
    if (rendered.has(t.text)) continue;
    text('ANOTACOES_TEXTO', t.at, (t.height * plan.scale) / 1000, t.text, t.rotation);
  }
  const hasSegment = (start: Vec2, end: Vec2): boolean =>
    ops.strokes.some((s) => s.pts.length === 2 && samePoint(s.pts[0]!, start) && samePoint(s.pts[1]!, end));
  for (const x of a.detailLines) if (!hasSegment(x.a, x.b)) line('ANOTACOES_DETALHE', x.a, x.b);
  for (const x of a.detailRegions) {
    const drawn = ops.strokes.some((s) => s.pts.length === x.boundary.length && x.boundary.every((q, i) => samePoint(s.pts[i]!, q)));
    if (drawn) continue;
    for (let i = 0; i < x.boundary.length; i++) line('ANOTACOES_DETALHE', x.boundary[i]!, x.boundary[(i + 1) % x.boundary.length]!);
  }
  return out;
}

/** DXF da planta de área, com as camadas AMBIENTES, AMBIENTES_REFERENCIA, AMBIENTES_CHAMADA e AMBIENTES_TEXTO. */
export function areaPlanDxf(p: Project, planId: Id): string {
  const plan = areaPlanOf(p, planId);
  if (!plan) throw new Error('Planta de área inexistente');
  const box = levelBox(p, plan.levelId) ?? { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  const zoom = 100;
  const width = Math.max(400, (box.maxX - box.minX) * zoom + 200);
  const height = Math.max(300, (box.maxY - box.minY) * zoom + 200);
  const ops = buildPlanGeometry({
    project: p,
    levelId: plan.levelId,
    resolved: resolveLevel(p, plan.levelId),
    below: null,
    areaPlan: plan,
    viewport: { cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, zoom, width, height },
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
  });
  // Cotas/textos/detalhes de `plan.annotations`: o render da área pode já desenhá-los; o que faltar entra aqui.
  return appendAreaRecords(opsToDxf(resolverZoom(ops, zoom), zoom), areaAnnotationRecords(p, plan, ops));
}

/** Exporta a planta de área atual e devolve o nome do arquivo salvo. */
export async function saveAreaPlanDxf(p: Project, planId: Id): Promise<string> {
  const plan = areaPlanOf(p, planId);
  if (!plan) throw new Error('Planta de área inexistente');
  const name = `${p.name || 'projeto'}-${plan.name}.dxf`;
  await saveText(name, areaPlanDxf(p, planId));
  return name;
}

export function planDxf(p: Project, levelId: Id, showRoofProjection = true): string {
  const dxf = exportDxf(p, levelId, dxfGeometryOf(p, levelId, showRoofProjection));
  const shown = levelGraphicsOf(p, levelId).overrides.generic.visible !== false;
  return withEntityRecords(dxf, shown ? dxfGenericRecords(p, levelId) : []);
}

/** Entrega o DXF pelo mesmo caminho do CSV (`saveText`) e devolve a frase de status. */
export function savePlanDxf(p: Project, levelId: Id, showRoofProjection = true): Promise<string> {
  const base = p.name.trim() || 'projeto';
  const level = (p.levels.find((l) => l.id === levelId)?.name ?? levelId).trim() || 'nivel';
  return saveText(`${base}-${level}.dxf`, planDxf(p, levelId, showRoofProjection));
}

/** Categoria gráfica de uma origem do corte (parede, piso, laje, telhado ou escada). */
function sectionCategoryOf(o: SectionOrigin): GraphicsCategory {
  return ownerOf(o)?.kind ?? 'wall';
}

/**
 * Largura de linha (centésimos de mm) de cada camada do corte/elevação: o peso da categoria na escala da vista
 * (decisão 0015 §2.7), com a substituição da vista valendo sobre o peso do projeto. Níveis são anotação (0).
 */
export function sectionLineWeightsOf(p: Project, geo: DxfSectionGeometry): Record<string, number> {
  const pg = graphicsOf(p);
  const vg = sectionGraphicsOf(p);
  const out: Record<string, number> = {};
  for (const layer of dxfSectionLayersOf(geo)) {
    const role = dxfSectionLineRoleOf(layer);
    if (role === undefined) continue;
    if (role === 'annotation') {
      out[layer] = 0;
      continue;
    }
    const over = vg.overrides[role.category];
    const base = pg.categories[role.category];
    const weight = role.view === 'cut' ? (over.cutWeight ?? base.cutWeight) : (over.projectionWeight ?? base.projectionWeight);
    out[layer] = dxfLineWeight(lineWeightMm(pg.lineWeights, weight, vg.scale) * 100);
  }
  return out;
}

/**
 * Geometria do corte/elevação para o DXF, a partir do mesmo `computeSection` da tela. Categoria oculta na vista
 * (`sectionGraphics.overrides[cat].visible === false`) não sai. As camadas levam a largura da categoria na escala.
 */
export function sectionDxfGeometryOf(p: Project, sectionId: Id): DxfSectionGeometry {
  const view = p.views.find((v) => v.id === sectionId);
  if (!view) throw new Error(`Vista ausente: ${sectionId}`);
  const pts = sectionPoints(p, view);
  const section = computeSection(p, { a: pts.a, b: pts.b, depth: view.depth });
  const vg = sectionGraphicsOf(p);
  const shown = (c: GraphicsCategory): boolean => vg.overrides[c].visible !== false;
  const cut: DxfSectionItem[] = [];
  for (const r of section.cut) {
    const cats = [...new Set(r.sources.map(sectionCategoryOf))];
    const cat = cats.find(shown);
    if (cat) cut.push({ category: cat, polygons: r.polygons });
  }
  const beyond: DxfSectionItem[] = section.beyond.flatMap((b) => {
    const cat = sectionCategoryOf(b);
    return shown(cat) ? [{ category: cat, polygons: b.polygons }] : [];
  });
  const openings = section.openings.flatMap((o) => (shown(o.kind) ? [{ category: o.kind, polygons: o.polygons, cut: o.cut }] : []));
  const allShown = GRAPHICS_CATEGORIES.every(shown);
  const geo: DxfSectionGeometry = { cut, beyond, openings, ...(allShown ? { silhouette: section.silhouette } : {}) };
  return { ...geo, lineWeights: sectionLineWeightsOf(p, geo) };
}

/** Texto DXF do corte/elevação, com as camadas e as larguras de linha da vista. */
export function sectionDxf(p: Project, sectionId: Id): string {
  return exportSectionDxf(p, sectionId, sectionDxfGeometryOf(p, sectionId));
}

/** Entrega o DXF do corte pelo mesmo caminho da planta e devolve a frase de status. */
export function saveSectionDxf(p: Project, sectionId: Id): Promise<string> {
  const base = p.name.trim() || 'projeto';
  const found = p.views.find((v) => v.id === sectionId);
  const view = (found ? sectionTitleOf(found) : sectionId).trim() || 'vista';
  return saveText(`${base}-${view}.dxf`, sectionDxf(p, sectionId));
}
