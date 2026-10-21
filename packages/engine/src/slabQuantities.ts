import { dist, multiArea, type Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveSlabs, type ResolvedSlab } from './slabs.ts';

/**
 * Uma camada de uma laje. A espessura é vertical e igual em todo o plano (a camada acompanha a inclinação), então o
 * volume é a área em planta vezes a espessura. A área real é a da face da camada sobre a inclinação.
 */
export interface SlabLayerQuantity {
  slabId: Id;
  layerIndex: number;
  materialId: Id;
  /** Espessura vertical da camada (m). */
  thickness: number;
  /** Área em planta, igual para todas as camadas da laje (m²). */
  planArea: number;
  /** Área real da face da camada sobre a inclinação (m²); igual à área em planta sem inclinação. */
  faceArea: number;
  /** Volume da camada (m³) = área em planta × espessura vertical. */
  volume: number;
}

export interface SlabQuantity {
  slabId: Id;
  typeId: Id;
  levelId: Id;
  /** Área líquida em planta: contorno menos furos (m²). */
  planArea: number;
  /** Área real da face superior (m²) = área em planta / cos(atan(percentual / 100)). */
  faceArea: number;
  /** Comprimento do contorno externo, em planta (m). */
  perimeter: number;
  /** Soma dos comprimentos dos furos, em planta (m). */
  holesPerimeter: number;
  /** Espessura total vertical (m). */
  thickness: number;
  /** Inclinação da face superior em % (0 sem inclinação). */
  slopePercent: number;
  /** Volume total (m³) = soma das camadas. */
  volume: number;
  layers: SlabLayerQuantity[];
}

export interface SlabQuantities {
  slabs: SlabQuantity[];
  layers: SlabLayerQuantity[];
  /** Soma das áreas em planta das lajes do nível (m²). */
  totalPlanArea: number;
  /** Soma das áreas reais das faces superiores (m²). */
  totalFaceArea: number;
  /** Volume total do nível (m³). */
  totalVolume: number;
  /** Volume (m³) por material. */
  volumeByMaterial: Record<Id, number>;
  /** Área real (m²) por material: soma das áreas reais das camadas daquele material. */
  faceAreaByMaterial: Record<Id, number>;
}

/** Comprimento de um anel fechado (o último ponto liga-se ao primeiro). */
const ringLength = (r: Vec2[]): number => r.reduce((s, p, i) => s + dist(p, r[(i + 1) % r.length]!), 0);

/** Área real sobre área em planta de um plano com esse percentual: 1 / cos(atan(|percentual| / 100)). */
const slopeFactor = (percent: number): number => 1 / Math.cos(Math.atan(Math.abs(percent) / 100));

function quantifySlab(rs: ResolvedSlab): { slab: SlabQuantity; layers: SlabLayerQuantity[] } {
  const planArea = multiArea(rs.polygon);
  const slopePercent = rs.slope?.percent ?? 0;
  const faceArea = planArea * slopeFactor(slopePercent);
  const layers = rs.layers.map<SlabLayerQuantity>((l) => {
    const thickness = l.z1 - l.z0;
    return { slabId: rs.slabId, layerIndex: l.layerIndex, materialId: l.materialId, thickness, planArea, faceArea, volume: planArea * thickness };
  });
  const volume = layers.reduce((s, l) => s + l.volume, 0);
  const slab: SlabQuantity = {
    slabId: rs.slabId,
    typeId: rs.typeId,
    levelId: rs.levelId,
    planArea,
    faceArea,
    // Com furo de escada a laje pode virar mais de um polígono: soma o contorno de todos e de todos os furos.
    perimeter: rs.polygon.reduce((s, poly) => s + ringLength(poly[0]!), 0),
    holesPerimeter: rs.polygon.reduce((s, poly) => s + poly.slice(1).reduce((t, h) => t + ringLength(h), 0), 0),
    thickness: rs.topZ - rs.bottomZ,
    slopePercent,
    volume,
    layers,
  };
  return { slab, layers };
}

/**
 * Quantitativos das lajes de um nível. A geometria vem de `resolveSlabs`, então área e volume são os mesmos do 3D e da
 * planta. Lajes sem tipo válido ou com contorno de menos de 3 pontos não entram (a validação aponta).
 */
export function quantifySlabs(p: Project, levelId: Id): SlabQuantities {
  const slabs: SlabQuantity[] = [];
  const layers: SlabLayerQuantity[] = [];
  const volumeByMaterial: Record<Id, number> = {};
  const faceAreaByMaterial: Record<Id, number> = {};
  for (const rs of resolveSlabs(p, levelId)) {
    const q = quantifySlab(rs);
    slabs.push(q.slab);
    for (const l of q.layers) {
      layers.push(l);
      volumeByMaterial[l.materialId] = (volumeByMaterial[l.materialId] ?? 0) + l.volume;
      faceAreaByMaterial[l.materialId] = (faceAreaByMaterial[l.materialId] ?? 0) + l.faceArea;
    }
  }
  return {
    slabs,
    layers,
    totalPlanArea: slabs.reduce((s, x) => s + x.planArea, 0),
    totalFaceArea: slabs.reduce((s, x) => s + x.faceArea, 0),
    totalVolume: slabs.reduce((s, x) => s + x.volume, 0),
    volumeByMaterial,
    faceAreaByMaterial,
  };
}
