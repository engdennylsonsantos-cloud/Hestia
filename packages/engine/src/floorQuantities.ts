import { dist, multiArea, type Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveFloors, type ResolvedFloor } from './floors.ts';
import { adjacentCutters, coveredFaceArea, cutVolume, floorCutters, floorLayerPiece, slabCutters, wallCutters, type CutterSolid } from './junctionNet.ts';

/** Uma camada de um piso. A área é a da face superior da camada, líquida: sem o que a laje ocupa (decisão 0023 §4). */
export interface FloorLayerQuantity {
  floorId: Id;
  layerIndex: number;
  materialId: Id;
  thickness: number;
  /** Área líquida da face superior da camada (m²), com o contorno da camada (P8). Sem corte, igual à da camada. Membrana também tem área. */
  area: number;
  /** Volume líquido da camada (m³) = área bruta × espessura menos o que a laje ocupa; zero na membrana (decisão 0023 §5). */
  volume: number;
  /** Volume bruto da camada (m³), antes do desconto da laje. */
  grossVolume: number;
  /** Membrana: aparece com área de face e volume zero. */
  membrane: boolean;
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
  /** Volume líquido total (m³) = soma das camadas. */
  volume: number;
  /** Volume bruto (m³), sem o desconto da laje. Igual a `volume` quando não há corte. */
  grossVolume: number;
  /** Área líquida da face superior (m²): a área da primeira camada, sem o que a laje ocupa. */
  netArea: number;
  layers: FloorLayerQuantity[];
}

export interface FloorQuantities {
  floors: FloorQuantity[];
  layers: FloorLayerQuantity[];
  /** Área líquida somada de todos os pisos do nível (m²). */
  totalArea: number;
  /** Volume líquido total do nível (m³). */
  totalVolume: number;
  /** Volume (m³) por material. */
  volumeByMaterial: Record<Id, number>;
  /** Área de face superior (m²) por material: soma das áreas das camadas daquele material. */
  faceAreaByMaterial: Record<Id, number>;
}

/** Comprimento de um anel fechado (o último ponto liga-se ao primeiro). */
const ringLength = (r: Vec2[]): number => r.reduce((s, p, i) => s + dist(p, r[(i + 1) % r.length]!), 0);

function quantifyFloor(rf: ResolvedFloor, cutters: CutterSolid[]): { floor: FloorQuantity; layers: FloorLayerQuantity[] } {
  const area = multiArea(rf.polygon);
  const layers = rf.layers.map<FloorLayerQuantity>((l) => {
    const thickness = l.z1 - l.z0;
    const piece = floorLayerPiece(rf, l);
    // Área da própria camada (P8): pode ir ao núcleo da parede ou recuar à face. Só o volume que a laje ocupa sai do piso
    // (padrão por tipo, §1.3). A membrana não tem volume a descontar.
    const layerArea = multiArea(l.polygon);
    const grossVolume = l.membrane ? 0 : layerArea * thickness;
    const volume = l.membrane ? 0 : Math.max(0, grossVolume - cutVolume(piece, 'floor', cutters));
    const faceArea = l.membrane ? Math.max(0, layerArea - coveredFaceArea(piece, 'floor', cutters)) : thickness > 0 ? volume / thickness : layerArea;
    return {
      floorId: rf.floorId,
      layerIndex: l.layerIndex,
      materialId: l.materialId,
      thickness,
      area: faceArea,
      volume,
      grossVolume,
      membrane: l.membrane,
    };
  });
  const volume = layers.reduce((s, l) => s + l.volume, 0);
  const floor: FloorQuantity = {
    floorId: rf.floorId,
    typeId: rf.typeId,
    levelId: rf.levelId,
    area,
    // Com furo de escada o piso pode virar mais de um polígono: soma o contorno de todos e de todos os furos.
    perimeter: rf.polygon.reduce((s, poly) => s + ringLength(poly[0]!), 0),
    holesPerimeter: rf.polygon.reduce((s, poly) => s + poly.slice(1).reduce((t, h) => t + ringLength(h), 0), 0),
    thickness: rf.topZ - rf.bottomZ,
    volume,
    grossVolume: layers.reduce((s, l) => s + l.grossVolume, 0),
    netArea: layers[0]?.area ?? area,
    layers,
  };
  return { floor, layers };
}

/**
 * Quantitativos dos pisos de um nível. A geometria vem de `resolveFloors`, então área e volume são os mesmos do
 * 3D e da planta. O volume e a área de face são líquidos: descontam a interseção com as lajes do nível (decisão 0023
 * §4). A área em planta (`area`) continua sendo a do contorno. Pisos sem tipo válido ou com contorno de menos de 3
 * pontos não entram (a validação aponta).
 */
export function quantifyFloors(p: Project, levelId: Id): FloorQuantities {
  const floors: FloorQuantity[] = [];
  const layers: FloorLayerQuantity[] = [];
  const volumeByMaterial: Record<Id, number> = {};
  const faceAreaByMaterial: Record<Id, number> = {};
  const cutters = [...slabCutters(p, levelId), ...floorCutters(p, levelId), ...wallCutters(p, levelId), ...adjacentCutters(p, levelId, 'horizontal')];
  for (const rf of resolveFloors(p, levelId)) {
    const q = quantifyFloor(rf, cutters);
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
