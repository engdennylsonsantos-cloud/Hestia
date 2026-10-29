import { dist, dot, multiArea, mid, sub, type Vec2 } from '@hestia/geom';
import { roofPlanArea, type Id, type Project, type Roof, type RoofShape } from '@hestia/model';
import { crossingParams, planeHas } from './roofGeom.ts';
import { extrusionGableArea } from './roofExtrusion.ts';
import { planeZ, resolveRoofs, roofThickness, type ResolvedRoof, type ResolvedRoofPlane, type RoofLine } from './roofs.ts';
import { expandRoofArcs } from './roofArcs.ts';
import { edgeSlopesOf } from './roofShapes.ts';

/**
 * Quantitativos dos telhados de um nível. Área em planta = contorno menos furos e menos a parte unida a outro telhado.
 * Área real de uma água = área da água em planta / cos(atan(percentual / 100)). Volume de uma camada = área em planta ×
 * espessura vertical (a camada acompanha a inclinação, como nas lajes). Comprimentos em 3D: cada trecho de linha tem
 * comprimento em planta `L` e desnível `Δz` = (percentual / 100) × dot(trecho, direção de subida) da água que contém o
 * trecho; comprimento 3D = √(L² + Δz²). Cumeeira horizontal tem Δz = 0 e vale o comprimento em planta.
 * Empena (aresta sem inclinação): comprimento em planta; área = trapézio vertical sob a água vizinha, medido a partir
 * da cota do beiral (aproximação do frontão: a água é plana em cada trecho, então a área é exata para essa altura).
 * Extrusão: as extremidades que cortam o eixo com seção acima do beiral são empenas (comprimento em planta, como acima);
 * a área é a seção do perfil na extremidade, integrada ao longo da aresta.
 */

export interface RoofPlaneQuantity {
  /** Área da água em planta (metros quadrados). */
  planArea: number;
  /** Área real da água sobre a inclinação (metros quadrados). */
  faceArea: number;
  percent: number;
}

export interface RoofLayerQuantity {
  roofId: Id;
  layerIndex: number;
  materialId: Id;
  /** Espessura vertical (m). */
  thickness: number;
  /** Área em planta do telhado (metros quadrados). */
  planArea: number;
  /** Volume da camada (metros cúbicos) = área em planta × espessura vertical. */
  volume: number;
}

export interface RoofQuantity {
  roofId: Id;
  typeId: Id;
  levelId: Id;
  shape: RoofShape;
  mark: string;
  /** Área líquida em planta: contorno menos furos e menos a parte unida a outro telhado (metros quadrados). */
  planArea: number;
  /** Soma das áreas reais das águas (metros quadrados). */
  faceArea: number;
  planes: RoofPlaneQuantity[];
  /** Perímetro do contorno do beiral, em planta (m). */
  perimeter: number;
  /** Soma dos perímetros dos furos, em planta (m). */
  holesPerimeter: number;
  /** Espessura total vertical (m). */
  thickness: number;
  /** Volume total (metros cúbicos) = soma das camadas. */
  volume: number;
  /** Comprimento 3D das cumeeiras (m). */
  ridgeLength: number;
  /** Comprimento 3D dos espigões (m). */
  hipLength: number;
  /** Comprimento 3D dos rincões (m). */
  valleyLength: number;
  /** Comprimento 3D do beiral (m). */
  eaveLength: number;
  /** Comprimento em planta das empenas, arestas sem inclinação (m). */
  gableLength: number;
  /** Área das empenas (metros quadrados): frontão vertical sob as águas vizinhas, a partir da cota do beiral. */
  gableArea: number;
  /** Arestas que definem inclinação (beirais); null nas águas livres e na extrusão. */
  slopedEdges: number | null;
  /** Cota máxima das cumeeiras (m, absoluta); null sem cumeeira. */
  ridgeHeight: number | null;
  /** Cota máxima da face superior (m, absoluta). */
  maxHeight: number;
  layers: RoofLayerQuantity[];
}

export interface RoofQuantities {
  roofs: RoofQuantity[];
  /** Soma das áreas em planta dos telhados do nível (metros quadrados). */
  totalPlanArea: number;
  /** Soma das áreas reais (metros quadrados). */
  totalFaceArea: number;
  /** Volume total do nível (metros cúbicos). */
  totalVolume: number;
  /** Volume (metros cúbicos) por material. */
  volumeByMaterial: Record<Id, number>;
}

/** 1 / cos(atan(|percentual| / 100)): razão entre área real e área em planta de uma água. */
const slopeFactor = (percent: number): number => 1 / Math.cos(Math.atan(Math.abs(percent) / 100));

const ringLength = (r: Vec2[]): number => r.reduce((s, q, i) => s + dist(q, r[(i + 1) % r.length]!), 0);

/**
 * Comprimento 3D de um segmento: trechos separados onde ele cruza as águas, cada um com a água que o contém. `planes` vem
 * com as águas do próprio telhado antes das de outros telhados do nível (a junção pode pôr uma divisa na borda de outro).
 */
export function segmentLength3D(a: Vec2, b: Vec2, planes: ResolvedRoofPlane[]): number {
  const ts = crossingParams(a, b, planes.flatMap((pl) => pl.polygon));
  const ab = sub(b, a);
  let total = 0;
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i]!;
    const t1 = ts[i + 1]!;
    if (t1 - t0 < 1e-12) continue;
    const p = { x: a.x + ab.x * t0, y: a.y + ab.y * t0 };
    const q = { x: a.x + ab.x * t1, y: a.y + ab.y * t1 };
    const plan = dist(p, q);
    const pl = planes.find((x) => planeHas(x.polygon, mid(p, q)));
    const dz = pl ? (pl.percent / 100) * dot(sub(q, p), pl.up) : 0;
    total += Math.sqrt(plan * plan + dz * dz);
  }
  return total;
}

/** Cotas (absolutas) das duas pontas de uma linha, pela água que contém o ponto médio dela. */
function lineHeights(l: RoofLine, planes: ResolvedRoofPlane[]): number[] {
  const pl = planes.find((x) => planeHas(x.polygon, mid(l.a, l.b)));
  return pl ? [planeZ(pl, l.a), planeZ(pl, l.b)] : [];
}

function sumKind(r: ResolvedRoof, kind: RoofLine['kind'], planes: ResolvedRoofPlane[]): number {
  return r.lines.filter((l) => l.kind === kind).reduce((s, l) => s + segmentLength3D(l.a, l.b, planes), 0);
}

/** Área das empenas: para cada trecho de empena, o trapézio entre a cota do beiral e a água que o toca. */
function gableAreaOf(rr: ResolvedRoof): number {
  return rr.lines
    .filter((l) => l.kind === 'gable')
    .reduce((s, l) => {
      const pl = rr.planes.find((x) => planeHas(x.polygon, mid(l.a, l.b)));
      if (!pl) return s;
      const h = (planeZ(pl, l.a) - rr.eaveZ + planeZ(pl, l.b) - rr.eaveZ) / 2;
      return s + dist(l.a, l.b) * Math.max(0, h);
    }, 0);
}

/** Arestas que definem inclinação na forma (null nas águas livres e na extrusão, que não têm uma lista por aresta). */
function slopedEdgesOf(r: Roof): number | null {
  if (r.shape === 'free' || r.shape === 'extrusion') return null;
  return edgeSlopesOf(r).filter((s) => s !== null && s > 0).length;
}

/** Quantitativos de um telhado; `planes` tem as águas do próprio telhado primeiro, depois as dos outros do nível. */
function quantifyOne(p: Project, rr: ResolvedRoof, planes: ResolvedRoofPlane[]): RoofQuantity {
  const orig = p.elements[rr.roofId] as Roof;
  const r = expandRoofArcs(orig);
  const planArea = roofPlanArea(r) - rr.joinedArea;
  const planesQ: RoofPlaneQuantity[] = rr.planes.map((pl) => {
    const area = multiArea(pl.polygon);
    return { planArea: area, faceArea: area * slopeFactor(pl.percent), percent: pl.percent };
  });
  const thickness = roofThickness(rr);
  const layers: RoofLayerQuantity[] = rr.layers.map((l) => ({
    roofId: rr.roofId,
    layerIndex: l.layerIndex,
    materialId: l.materialId,
    thickness: l.thickness,
    planArea,
    volume: planArea * l.thickness,
  }));
  const heights = rr.lines.filter((l) => l.kind === 'ridge').flatMap((l) => lineHeights(l, planes));
  const tops = rr.planes.flatMap((pl) => pl.polygon.flatMap((poly) => poly.flatMap((ring) => ring.map((v) => planeZ(pl, v)))));
  return {
    roofId: rr.roofId,
    typeId: rr.typeId,
    levelId: rr.levelId,
    shape: r.shape,
    mark: r.mark,
    planArea,
    faceArea: planesQ.reduce((s, x) => s + x.faceArea, 0),
    planes: planesQ,
    perimeter: ringLength(r.boundary),
    holesPerimeter: r.holes.reduce((s, h) => s + (h.length >= 3 ? ringLength(h) : 0), 0),
    thickness,
    volume: layers.reduce((s, l) => s + l.volume, 0),
    ridgeLength: sumKind(rr, 'ridge', planes),
    hipLength: sumKind(rr, 'hip', planes),
    valleyLength: sumKind(rr, 'valley', planes),
    eaveLength: sumKind(rr, 'eave', planes),
    gableLength: rr.lines.filter((l) => l.kind === 'gable').reduce((s, l) => s + dist(l.a, l.b), 0),
    // Extrusão: a empena é a seção do perfil na extremidade (integral exata); as outras formas usam o trapézio por trecho.
    gableArea: r.shape === 'extrusion' ? extrusionGableArea(r) : gableAreaOf(rr),
    slopedEdges: slopedEdgesOf(orig),
    ridgeHeight: heights.length ? Math.max(...heights) : null,
    maxHeight: tops.length ? Math.max(...tops) : rr.eaveZ,
    layers,
  };
}

/** Quantitativos dos telhados de um nível. Telhado sem tipo válido ou contorno de menos de 3 pontos não entra. */
export function quantifyRoofs(p: Project, levelId: Id): RoofQuantities {
  const resolved = resolveRoofs(p, levelId);
  const roofs = resolved.map((rr) => {
    const others = resolved.filter((o) => o !== rr).flatMap((o) => o.planes);
    return quantifyOne(p, rr, [...rr.planes, ...others]);
  });
  const volumeByMaterial: Record<Id, number> = {};
  for (const r of roofs) for (const l of r.layers) volumeByMaterial[l.materialId] = (volumeByMaterial[l.materialId] ?? 0) + l.volume;
  return {
    roofs,
    totalPlanArea: roofs.reduce((s, r) => s + r.planArea, 0),
    totalFaceArea: roofs.reduce((s, r) => s + r.faceArea, 0),
    totalVolume: roofs.reduce((s, r) => s + r.volume, 0),
    volumeByMaterial,
  };
}
