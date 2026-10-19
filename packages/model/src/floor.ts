import { multiArea, type Polygon, type Vec2 } from '@hestia/geom';
import { isFloor, type Floor, type FloorType, type Id, type Layer, type Project } from './types.ts';

type FloorInput = { id: Id; typeId: Id; levelId: Id; boundary: Vec2[] } & Partial<Omit<Floor, 'order' | 'kind'>>;

/** Constrói um piso com os campos padrão; `order` é atribuído pelo comando addFloor. */
export function makeFloor(f: FloorInput): Omit<Floor, 'order'> {
  return { kind: 'floor', holes: [], heightOffset: 0, mark: '', comments: '', ...f };
}

export const floorsOnLevel = (p: Project, levelId: Id): Floor[] =>
  Object.values(p.elements)
    .filter(isFloor)
    .filter((f) => f.levelId === levelId)
    .sort((a, b) => a.order - b.order);

export const floorTypeThickness = (t: FloorType): number => t.layers.reduce((s, l) => s + l.thickness, 0);

/** Polígono do piso (contorno + furos) para as operações de geometria. */
export const floorPolygon = (f: Floor): Polygon => [f.boundary, ...f.holes];

/** Área líquida em planta (contorno menos furos), m². */
export function floorArea(f: Floor): number {
  return multiArea([floorPolygon(f)]);
}

const L = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });

const ft = (id: string, name: string, code: string, description: string, layers: Layer[], cost = 0): FloorType => ({ id, name, code, description, layers, cost });

/** Tipos de piso iniciais (camadas do topo para baixo). */
export const DEFAULT_FLOOR_TYPES: FloorType[] = [
  ft('ft_ceram', 'Cerâmico sobre contrapiso', 'PS-01', 'Revestimento cerâmico, argamassa colante e contrapiso sobre laje', [
    L('finish1', 'mat_ceramica', 0.01),
    L('substrate', 'mat_argamassa', 0.02),
    L('substrate', 'mat_argamassa', 0.04),
    L('structure', 'mat_concreto', 0.12),
  ], 160),
  ft('ft_laje12', 'Laje de concreto 12', 'PS-02', 'Laje maciça de concreto armado com regularização', [
    L('substrate', 'mat_argamassa', 0.03),
    L('structure', 'mat_concreto', 0.12),
  ], 120),
  ft('ft_madeira', 'Madeira sobre contrapiso', 'PS-03', 'Assoalho de madeira sobre contrapiso e laje', [
    L('finish1', 'mat_madeira', 0.02),
    L('substrate', 'mat_argamassa', 0.04),
    L('structure', 'mat_concreto', 0.12),
  ], 260),
];
