import { multiArea, type Polygon, type Vec2 } from '@hestia/geom';
import { isRoof, type Id, type Layer, type Project, type Roof, type RoofType } from './types.ts';

type RoofInput = { id: Id; typeId: Id; levelId: Id; boundary: Vec2[] } & Partial<Omit<Roof, 'order' | 'kind'>>;

/** Constrói um telhado com os campos padrão (duas águas de 30%, cumeeira ao longo de x); `order` vem do comando addRoof. */
export function makeRoof(r: RoofInput): Omit<Roof, 'order'> {
  return { kind: 'roof', holes: [], heightOffset: 0, shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, planes: [], mark: '', comments: '', ...r };
}

export const roofsOnLevel = (p: Project, levelId: Id): Roof[] =>
  Object.values(p.elements)
    .filter(isRoof)
    .filter((r) => r.levelId === levelId)
    .sort((a, b) => a.order - b.order);

export const roofTypeThickness = (t: RoofType): number => t.layers.reduce((s, l) => s + l.thickness, 0);

export const roofPolygon = (r: Roof): Polygon => [r.boundary, ...r.holes];

/** Área em planta (contorno menos furos), m². */
export const roofPlanArea = (r: Roof): number => multiArea([roofPolygon(r)]);

const L = (fn: Layer['function'], materialId: string, thickness: number): Layer => ({ function: fn, materialId, thickness, wraps: false });

const rt = (id: string, name: string, code: string, description: string, layers: Layer[], cost = 0): RoofType => ({ id, name, code, description, layers, cost });

/** Tipos de telhado iniciais (camadas do topo para baixo; espessura vertical). */
export const DEFAULT_ROOF_TYPES: RoofType[] = [
  rt('rt_ceramica', 'Telha cerâmica sobre madeiramento', 'TL-01', 'Telha cerâmica, ripas e caibros de madeira', [
    L('finish1', 'mat_telha_ceramica', 0.015),
    L('substrate', 'mat_madeira', 0.03),
    L('structure', 'mat_madeira', 0.05),
  ], 180),
  rt('rt_fibro', 'Telha de fibrocimento', 'TL-02', 'Telha ondulada de fibrocimento sobre terças de madeira', [
    L('finish1', 'mat_fibrocimento', 0.008),
    L('structure', 'mat_madeira', 0.075),
  ], 95),
  rt('rt_metalica', 'Telha metálica sanduíche', 'TL-03', 'Telha termoacústica com núcleo isolante sobre estrutura metálica', [
    L('finish1', 'mat_telha_metalica', 0.05),
    L('structure', 'mat_perfil', 0.1),
  ], 260),
];
