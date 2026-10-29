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

/** Área líquida em planta (contorno menos furos), metros quadrados. */
export function floorArea(f: Floor): number {
  return multiArea([floorPolygon(f)]);
}

const L = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });

/** Camada com término explícito nas paredes (decisão 0025): o padrão do piso único. */
const LT = (fn: Layer['function'], materialId: string, thickness: number, termino: Layer['termino']): Layer => ({ ...L(fn, materialId, thickness), termino });

const ft = (id: string, name: string, code: string, description: string, layers: Layer[], cost = 0): FloorType => ({ id, name, code, description, layers, cost });

/** Tipos de piso iniciais (camadas do topo para baixo). */
export const DEFAULT_FLOOR_TYPES: FloorType[] = [
  ft('ft_ceram', 'Cerâmico sobre contrapiso', 'PS-01', 'Revestimento cerâmico, argamassa colante e contrapiso sobre laje', [
    L('finish1', 'mat_ceramica', 0.01),
    L('substrate', 'mat_argamassa', 0.02),
    L('substrate', 'mat_argamassa', 0.04),
    L('structure', 'mat_concreto', 0.12),
  ], 160),
  ft('ft_acab', 'Acabamento sobre laje', 'PS-04', 'Revestimento cerâmico, assentamento e contrapiso sobre laje, sem camada estrutural (a laje já tem o concreto)', [
    L('finish1', 'mat_ceramica', 0.01),
    L('substrate', 'mat_argamassa', 0.01),
    L('substrate', 'mat_argamassa', 0.02),
  ], 90),
  ft('ft_laje12', 'Laje de concreto 12', 'PS-02', 'Laje maciça de concreto armado com regularização', [
    L('substrate', 'mat_argamassa', 0.03),
    L('structure', 'mat_concreto', 0.12),
  ], 120),
  ft('ft_madeira', 'Madeira sobre contrapiso', 'PS-03', 'Assoalho de madeira sobre contrapiso e laje', [
    L('finish1', 'mat_madeira', 0.02),
    L('substrate', 'mat_argamassa', 0.04),
    L('structure', 'mat_concreto', 0.12),
  ], 260),
  ft('ft_unico', 'Piso único (obra inteira)', 'PS-05', 'Acabamento, assentamento e contrapiso param na face das paredes; a estrutura de concreto passa por baixo delas. Para um piso que cobre a obra inteira', [
    LT('finish1', 'mat_ceramica', 0.01, 'face'),
    LT('substrate', 'mat_argamassa', 0.02, 'face'),
    LT('substrate', 'mat_argamassa', 0.04, 'face'),
    LT('structure', 'mat_concreto', 0.12, 'passa'),
  ], 250),
];
