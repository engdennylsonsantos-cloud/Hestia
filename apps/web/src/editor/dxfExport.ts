import { levelFrames, openingGeometry, resolveFloors, resolveRoofs, resolveSlabs, resolveStairsOnLevel, type ResolvedStair, type ViewClass } from '@hestia/engine';
import { planViewOf, risersInClimbOrder, roofFootprint, stairCut, type PlanView, type StairCut } from '@hestia/render';
import { exportDxf, type DxfLevelGeometry, type DxfOpening, type DxfPoint, type DxfViewState } from '@hestia/io';
import { openingsOfWall, type Id, type Project } from '@hestia/model';
import { saveText } from './saveText.ts';

type StairDxf = NonNullable<DxfLevelGeometry['stairs']>[number];

/** Tolerância (m) nas comparações de cota, como na tela (a borda exata conta como dentro). */
const EPS = 1e-9;

/**
 * Zoom usado no símbolo de corte da escada: `stairCut` dá 8 px de avanço em cada lado; com zoom 80 são 0,10 m, em metros.
 * Os dentes do zigue-zague seguem `cutSymbol` da planta (4 px de amplitude, zoom 80: 0,05 m).
 */
const STAIR_CUT_ZOOM = 80;

/** Seta de subida: haste de `a` a `b` e duas pontas a 30° no fim (LINE, camada ESCADA_SETA). Vazia sem comprimento. */
export function stairArrow(a: DxfPoint, b: DxfPoint): Array<[DxfPoint, DxfPoint]> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const bx = -dx / len;
  const by = -dy / len;
  const L = Math.min(0.2, len * 0.25);
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  // Gira a direção de volta de ±30° para as duas pontas.
  const barb = (sg: 1 | -1): DxfPoint => ({ x: b.x + (bx * c - sg * by * s) * L, y: b.y + (sg * bx * s + by * c) * L });
  return [
    [a, b],
    [b, barb(1)],
    [b, barb(-1)],
  ];
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
 * cruza a escada.
 */
export function stairDxf(r: ResolvedStair, view: { cutZ: number; topZ: number }): StairDxf {
  const mid = (k: { a: DxfPoint; b: DxfPoint }): DxfPoint => ({ x: (k.a.x + k.b.x) / 2, y: (k.a.y + k.b.y) / 2 });
  const risers = risersInClimbOrder(r).filter((k) => k.z1 <= view.topZ + EPS);
  const first = risers[0];
  const last = risers.at(-1);
  const steps = r.steps.filter((st) => st.z <= view.topZ + EPS);
  const outline = (st: (typeof steps)[number]): DxfPoint[] => st.polygon.map((q) => ({ x: q.x, y: q.y }));
  const cut = stairCut(r, risers, STAIR_CUT_ZOOM, view.cutZ);
  return {
    outlines: steps.filter((st) => st.z <= view.cutZ + EPS).map(outline),
    outlinesAbove: steps.filter((st) => st.z > view.cutZ + EPS).map(outline),
    risers: risers.map((k): [DxfPoint, DxfPoint] => [k.a, k.b]),
    arrow: first && last && risers.length > 1 ? stairArrow(mid(first), mid(last)) : [],
    cut: cut ? cutSymbolDxf(cut) : undefined,
  };
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
 * Geometria do nível para o DXF, na mesma vista da planta na tela (decisão 0013 §4, `planViewOf`): paredes e aberturas
 * pela geometria com o plano de corte da vista, paredes fora do corte como contorno de projeção, pisos, lajes, telhados e
 * escadas com a cota de corte e o topo do intervalo. O que está fora do intervalo não sai, exceto a projeção do telhado
 * (a tela a mostra tracejada por padrão). O io não importa o engine, então a montagem fica aqui, no web.
 */
export function dxfGeometryOf(p: Project, levelId: Id): DxfLevelGeometry {
  const view: PlanView = planViewOf(p, levelId);
  const { hidden } = view;
  const openings: DxfOpening[] = levelFrames(p, levelId).flatMap((f) =>
    openingsOfWall(p, f.wall.id).flatMap((o) => {
      const state = dxfStateOf(view.cls.get(o.id));
      if (state === null) return [];
      const g = openingGeometry(p, o, f);
      return [{ center: g.center, u: g.u, width: g.width, thickness: g.thickness, state }];
    }),
  );
  const roofs = resolveRoofs(p, levelId);
  return {
    clusters: view.geo.clusters,
    openings,
    wallOutlines: view.outlines.map((o) => ({ state: o.cls, polygons: o.shape })),
    roofProjections: roofs.filter((r) => hidden.has(r.roofId)).flatMap((r) => roofFootprint(r)),
    floors: resolveFloors(p, levelId)
      .filter((f) => !hidden.has(f.floorId))
      .flatMap((f) => f.polygon.map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.floorTypes[f.typeId]?.code ?? '' }))),
    slabs: resolveSlabs(p, levelId)
      .filter((s) => !hidden.has(s.slabId))
      .flatMap((s) => s.polygon.map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.slabTypes[s.typeId]?.code ?? '' }))),
    // Escadas: degraus e patamares (contorno), espelhos, seta de subida e símbolo de corte, com a cota de corte da vista.
    stairs: resolveStairsOnLevel(p, levelId)
      .filter((s) => !hidden.has(s.id))
      .map((s) => stairDxf(s, { cutZ: view.cutZ, topZ: view.topZ })),
    // Telhado: contorno do beiral e linhas de cumeeira, espigão e rincão (as de beiral já estão no contorno).
    roofs: roofs
      .filter((r) => !hidden.has(r.roofId))
      .map((r) => ({
        outline: p.elements[r.roofId]?.kind === 'roof' ? (p.elements[r.roofId] as { boundary: Array<{ x: number; y: number }> }).boundary : [],
        ridges: r.lines.filter((l) => l.kind !== 'eave' && l.kind !== 'gable').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
        gables: r.lines.filter((l) => l.kind === 'gable').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
        typeCode: p.roofTypes[r.typeId]?.code ?? '',
      })),
  };
}

/** Texto DXF da planta do nível, na vista do intervalo. */
export function planDxf(p: Project, levelId: Id): string {
  return exportDxf(p, levelId, dxfGeometryOf(p, levelId));
}

/** Entrega o DXF pelo mesmo caminho do CSV (`saveText`) e devolve a frase de status. */
export function savePlanDxf(p: Project, levelId: Id): Promise<string> {
  const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
  const level = (p.levels.find((l) => l.id === levelId)?.name ?? levelId).replace(/[^\w\- ]+/g, '').trim() || 'nivel';
  return saveText(`${base}-${level}.dxf`, planDxf(p, levelId));
}
