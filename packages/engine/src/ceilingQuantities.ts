import { dist, multiArea, type Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveCeilings, type ResolvedCeiling } from './ceilings.ts';

/** Uma camada de um forro. A área é a da face superior da camada (a mesma área em planta do forro). */
export interface CeilingLayerQuantity {
  ceilingId: Id;
  layerIndex: number;
  materialId: Id;
  thickness: number;
  /** Área líquida do forro (m²). */
  area: number;
  /** Volume da camada (m³) = área × espessura. */
  volume: number;
}

export interface CeilingQuantity {
  ceilingId: Id;
  typeId: Id;
  levelId: Id;
  /** Área líquida em planta: contorno menos furos (m²). */
  area: number;
  /** Comprimento do contorno externo (m). */
  perimeter: number;
  /** Espessura total do forro (m). */
  thickness: number;
  /** Volume total (m³) = soma das camadas. */
  volume: number;
  layers: CeilingLayerQuantity[];
}

export interface CeilingQuantities {
  ceilings: CeilingQuantity[];
  layers: CeilingLayerQuantity[];
  totalArea: number;
  totalVolume: number;
  volumeByMaterial: Record<Id, number>;
  faceAreaByMaterial: Record<Id, number>;
}

const ringLength = (r: Vec2[]): number => r.reduce((s, p, i) => s + dist(p, r[(i + 1) % r.length]!), 0);

function quantifyCeiling(rc: ResolvedCeiling): CeilingQuantity {
  const area = multiArea(rc.polygon);
  const layers = rc.layers.map<CeilingLayerQuantity>((l) => {
    const thickness = l.z1 - l.z0;
    return { ceilingId: rc.ceilingId, layerIndex: l.layerIndex, materialId: l.materialId, thickness, area, volume: area * thickness };
  });
  return {
    ceilingId: rc.ceilingId,
    typeId: rc.typeId,
    levelId: rc.levelId,
    area,
    perimeter: rc.polygon.reduce((s, poly) => s + ringLength(poly[0]!), 0),
    thickness: rc.topZ - rc.bottomZ,
    volume: layers.reduce((s, l) => s + l.volume, 0),
    layers,
  };
}

/** Quantitativos dos forros de um nível: a geometria vem de `resolveCeilings`, como nos pisos. */
export function quantifyCeilings(p: Project, levelId: Id): CeilingQuantities {
  const ceilings: CeilingQuantity[] = [];
  const volumeByMaterial: Record<Id, number> = {};
  const faceAreaByMaterial: Record<Id, number> = {};
  for (const rc of resolveCeilings(p, levelId)) {
    const q = quantifyCeiling(rc);
    ceilings.push(q);
    for (const l of q.layers) {
      volumeByMaterial[l.materialId] = (volumeByMaterial[l.materialId] ?? 0) + l.volume;
      faceAreaByMaterial[l.materialId] = (faceAreaByMaterial[l.materialId] ?? 0) + l.area;
    }
  }
  return {
    ceilings,
    layers: ceilings.flatMap((c) => c.layers),
    totalArea: ceilings.reduce((s, c) => s + c.area, 0),
    totalVolume: ceilings.reduce((s, c) => s + c.volume, 0),
    volumeByMaterial,
    faceAreaByMaterial,
  };
}
