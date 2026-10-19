import { dist, multiArea, type Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveFloors, type ResolvedFloor } from './floors.ts';

/** Uma camada de um piso. A área é a da face superior da camada (a mesma área em planta do piso). */
export interface FloorLayerQuantity {
  floorId: Id;
  layerIndex: number;
  materialId: Id;
  thickness: number;
  /** Área da face superior da camada (m²) = área líquida do piso. */
  area: number;
  /** Volume da camada (m³) = área × espessura. */
  volume: number;
}

export interface FloorQuantity {
  floorId: Id;
  typeId: Id;
  levelId: Id;
  /** Área líquida em planta: contorno menos furos (m²). */
  area: number;
  /** Comprimento do contorno externo (m). */
  perimeter: number;
  /** Soma dos comprimentos dos furos (m). */
  holesPerimeter: number;
  /** Espessura total do piso (m). */
  thickness: number;
  /** Volume total (m³) = soma das camadas. */
  volume: number;
  layers: FloorLayerQuantity[];
}

export interface FloorQuantities {
  floors: FloorQuantity[];
  layers: FloorLayerQuantity[];
  /** Área líquida somada de todos os pisos do nível (m²). */
  totalArea: number;
  /** Volume total do nível (m³). */
  totalVolume: number;
  /** Volume (m³) por material. */
  volumeByMaterial: Record<Id, number>;
  /** Área de face superior (m²) por material: soma das áreas das camadas daquele material. */
  faceAreaByMaterial: Record<Id, number>;
}

/** Comprimento de um anel fechado (o último ponto liga-se ao primeiro). */
const ringLength = (r: Vec2[]): number => r.reduce((s, p, i) => s + dist(p, r[(i + 1) % r.length]!), 0);

function quantifyFloor(rf: ResolvedFloor): { floor: FloorQuantity; layers: FloorLayerQuantity[] } {
  const poly = rf.polygon[0]!;
  const area = multiArea(rf.polygon);
  const layers = rf.layers.map<FloorLayerQuantity>((l) => {
    const thickness = l.z1 - l.z0;
    return { floorId: rf.floorId, layerIndex: l.layerIndex, materialId: l.materialId, thickness, area, volume: area * thickness };
  });
  const volume = layers.reduce((s, l) => s + l.volume, 0);
  const floor: FloorQuantity = {
    floorId: rf.floorId,
    typeId: rf.typeId,
    levelId: rf.levelId,
    area,
    perimeter: ringLength(poly[0]!),
    holesPerimeter: poly.slice(1).reduce((s, h) => s + ringLength(h), 0),
    thickness: rf.topZ - rf.bottomZ,
    volume,
    layers,
  };
  return { floor, layers };
}

/**
 * Quantitativos dos pisos de um nível. A geometria vem de `resolveFloors`, então área e volume são os mesmos do
 * 3D e da planta. Pisos sem tipo válido ou com contorno de menos de 3 pontos não entram (a validação aponta).
 */
export function quantifyFloors(p: Project, levelId: Id): FloorQuantities {
  const floors: FloorQuantity[] = [];
  const layers: FloorLayerQuantity[] = [];
  const volumeByMaterial: Record<Id, number> = {};
  const faceAreaByMaterial: Record<Id, number> = {};
  for (const rf of resolveFloors(p, levelId)) {
    const q = quantifyFloor(rf);
    floors.push(q.floor);
    for (const l of q.layers) {
      layers.push(l);
      volumeByMaterial[l.materialId] = (volumeByMaterial[l.materialId] ?? 0) + l.volume;
      faceAreaByMaterial[l.materialId] = (faceAreaByMaterial[l.materialId] ?? 0) + l.area;
    }
  }
  return {
    floors,
    layers,
    totalArea: floors.reduce((s, f) => s + f.area, 0),
    totalVolume: floors.reduce((s, f) => s + f.volume, 0),
    volumeByMaterial,
    faceAreaByMaterial,
  };
}
