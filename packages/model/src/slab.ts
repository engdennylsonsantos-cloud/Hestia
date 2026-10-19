import { multiArea, type Polygon, type Vec2 } from '@hestia/geom';
import { isSlab, type Id, type Layer, type Project, type Slab, type SlabType } from './types.ts';

type SlabInput = { id: Id; typeId: Id; levelId: Id; boundary: Vec2[] } & Partial<Omit<Slab, 'order' | 'kind'>>;

/** Constrói uma laje com os campos padrão; `order` é atribuído pelo comando addSlab. */
export function makeSlab(s: SlabInput): Omit<Slab, 'order'> {
  return { kind: 'slab', holes: [], heightOffset: 0, slope: null, mark: '', comments: '', ...s };
}

export const slabsOnLevel = (p: Project, levelId: Id): Slab[] =>
  Object.values(p.elements)
    .filter(isSlab)
    .filter((s) => s.levelId === levelId)
    .sort((a, b) => a.order - b.order);

export const slabTypeThickness = (t: SlabType): number => t.layers.reduce((s, l) => s + l.thickness, 0);

export const slabPolygon = (s: Slab): Polygon => [s.boundary, ...s.holes];

/** Área líquida em planta (contorno menos furos), m². */
export const slabArea = (s: Slab): number => multiArea([slabPolygon(s)]);

const L = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });

const st = (id: string, name: string, code: string, description: string, layers: Layer[], cost = 0): SlabType => ({ id, name, code, description, layers, cost });

/** Tipos de laje iniciais (camadas do topo para baixo). */
export const DEFAULT_SLAB_TYPES: SlabType[] = [
  st('ls_mac12', 'Laje maciça 12', 'LJ-12', 'Laje maciça de concreto armado, 12 cm', [L('structure', 'mat_concreto', 0.12)], 190),
  st('ls_mac15', 'Laje maciça 15', 'LJ-15', 'Laje maciça de concreto armado, 15 cm, com regularização', [
    L('substrate', 'mat_argamassa', 0.02),
    L('structure', 'mat_concreto', 0.15),
  ], 240),
  st('ls_cobertura', 'Laje de cobertura 10', 'LJ-10C', 'Laje de cobertura com impermeabilização e proteção mecânica', [
    L('finish1', 'mat_argamassa', 0.03),
    L('membrane', 'mat_argamassa', 0),
    L('structure', 'mat_concreto', 0.1),
  ], 210),
];
