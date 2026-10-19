import { multiArea } from '@hestia/geom';
import { openingSill, openingType, openingsOfWall, wallHeight, wallLength, type Id, type Project } from '@hestia/model';
import type { ResolvedLevel } from './types.ts';

export interface LayerQuantity {
  wallId: Id;
  layerIndex: number;
  materialId: Id;
  /** Área da camada em planta (m²). */
  planArea: number;
  /** Volume (m³): planta × altura, mais as peças acima/abaixo dos vãos. */
  volume: number;
}

export interface WallQuantity {
  wallId: Id;
  length: number;
  height: number;
  grossFaceArea: number;
  openingsArea: number;
  netFaceArea: number;
  volume: number;
}

export interface Quantities {
  layers: LayerQuantity[];
  walls: WallQuantity[];
  /** Volume total por material. */
  volumeByMaterial: Record<Id, number>;
  /** Área de face por material (volume ÷ espessura somado das camadas). */
  faceAreaByMaterial: Record<Id, number>;
}

/** Quantitativos por camada: o acabamento vem da própria parede (docs/02 §1). */
export function quantifyLevel(p: Project, r: ResolvedLevel): Quantities {
  const layers: LayerQuantity[] = [];
  const walls: WallQuantity[] = [];
  const volumeByMaterial: Record<Id, number> = {};
  const faceAreaByMaterial: Record<Id, number> = {};
  for (const rw of Object.values(r.walls)) {
    const w = p.elements[rw.wallId];
    if (!w || w.kind !== 'wall') continue;
    const H = wallHeight(p, w);
    let total = 0;
    for (const l of rw.layers) {
      const vol = l.bands.reduce((s, b) => s + multiArea(b.poly) * (b.z1 - b.z0), 0);
      total += vol;
      layers.push({ wallId: rw.wallId, layerIndex: l.layerIndex, materialId: l.materialId, planArea: multiArea(l.cut), volume: vol });
      volumeByMaterial[l.materialId] = (volumeByMaterial[l.materialId] ?? 0) + vol;
      const thick = p.wallTypes[w.typeId]?.layers[l.layerIndex]?.thickness ?? 0;
      if (thick > 0) faceAreaByMaterial[l.materialId] = (faceAreaByMaterial[l.materialId] ?? 0) + vol / thick;
    }
    const gross = wallLength(w) * H;
    const openings = openingsOfWall(p, w.id).reduce((s, o) => {
      const t = openingType(p, o);
      const clipped = Math.max(0, Math.min(t.height, H - openingSill(t, o)));
      return s + t.width * clipped;
    }, 0);
    walls.push({ wallId: w.id, length: wallLength(w), height: H, grossFaceArea: gross, openingsArea: openings, netFaceArea: gross - openings, volume: total });
  }
  return { layers, walls, volumeByMaterial, faceAreaByMaterial };
}
