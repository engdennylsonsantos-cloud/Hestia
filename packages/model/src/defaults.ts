import { DEFAULT_FLOOR_TYPES } from './floor.ts';
import { DEFAULT_SLAB_TYPES } from './slab.ts';
import { DEFAULT_ROOF_TYPES } from './roof.ts';
import { SCHEMA_VERSION, type Layer, type Material, type OpeningType, type Project, type WallType } from './types.ts';

const mat = (id: string, name: string, color: string, hatch: Material['hatch'], extra: Partial<Material> = {}): Material => ({
  id,
  name,
  color,
  hatch,
  gloss: 0.1,
  opacity: 1,
  cost: 0,
  unit: 'm2',
  ...extra,
});

export const DEFAULT_MATERIALS: Material[] = [
  mat('mat_tinta', 'Tinta branca', '#f4f1ea', 'none'),
  mat('mat_reboco', 'Reboco', '#d9d2c5', 'dots', { cost: 38 }),
  mat('mat_bloco14', 'Bloco cerâmico 14', '#c0693f', 'diagonal', { unit: 'm2', cost: 62 }),
  mat('mat_bloco9', 'Bloco cerâmico 9', '#c9784c', 'diagonal', { cost: 52 }),
  mat('mat_bloco19', 'Bloco cerâmico 19', '#b45f38', 'diagonal', { cost: 74 }),
  mat('mat_concreto', 'Concreto', '#8f9296', 'cross', { unit: 'm3', cost: 640 }),
  mat('mat_argamassa', 'Argamassa', '#cdbfa9', 'dots', { cost: 30 }),
  mat('mat_ceramica', 'Revestimento cerâmico', '#e9e4da', 'none', { gloss: 0.6, cost: 85 }),
  mat('mat_gesso', 'Placa de gesso', '#ece9e2', 'none', { cost: 44 }),
  mat('mat_la', 'Lã mineral', '#e5d27a', 'dots', { cost: 28 }),
  mat('mat_perfil', 'Perfil de aço', '#9aa0a6', 'cross', { cost: 20 }),
  mat('mat_madeira', 'Madeira', '#a9794a', 'diagonal', { cost: 150 }),
  mat('mat_vidro', 'Vidro', '#a9d6e5', 'none', { gloss: 0.9, opacity: 0.35, cost: 220 }),
  mat('mat_aluminio', 'Alumínio', '#b8bdc2', 'solid', { gloss: 0.7, unit: 'm' }),
  mat('mat_telha_ceramica', 'Telha cerâmica', '#b5522d', 'diagonal', { cost: 85 }),
  mat('mat_fibrocimento', 'Fibrocimento', '#9ea3a8', 'cross', { cost: 55 }),
  mat('mat_telha_metalica', 'Telha metálica', '#8e99a3', 'solid', { gloss: 0.6, cost: 140 }),
];

const L = (fn: Layer['function'], materialId: string, thickness: number, wraps = false): Layer => ({
  function: fn,
  materialId,
  thickness,
  wraps,
});

const wt = (id: string, name: string, code: string, description: string, layers: Layer[]): WallType => ({
  id,
  name,
  code,
  description,
  layers,
  wrapInserts: 'both',
  wrapEnds: 'none',
  strips: [],
  cost: 0,
  thermalU: null,
  acousticRw: null,
  fireRating: null,
  manufacturer: '',
});

export const DEFAULT_WALL_TYPES: WallType[] = [
  wt('wt_alv14', 'Alvenaria 14 + reboco', 'PA-14', 'Bloco cerâmico 14 cm com reboco e pintura nas duas faces', [
    L('finish2', 'mat_tinta', 0.002, true),
    L('substrate', 'mat_reboco', 0.02, true),
    L('structure', 'mat_bloco14', 0.14),
    L('substrate', 'mat_reboco', 0.02, true),
    L('finish2', 'mat_tinta', 0.002, true),
  ]),
  wt('wt_alv9', 'Alvenaria 9 (divisória)', 'PA-09', 'Bloco cerâmico 9 cm com reboco e pintura', [
    L('finish2', 'mat_tinta', 0.002, true),
    L('substrate', 'mat_reboco', 0.015, true),
    L('structure', 'mat_bloco9', 0.09),
    L('substrate', 'mat_reboco', 0.015, true),
    L('finish2', 'mat_tinta', 0.002, true),
  ]),
  wt('wt_ext19', 'Externa 19 + cerâmica', 'PE-19', 'Bloco 19 cm, revestimento cerâmico externo e pintura interna', [
    L('finish1', 'mat_ceramica', 0.01, true),
    L('substrate', 'mat_argamassa', 0.02, true),
    L('structure', 'mat_bloco19', 0.19),
    L('substrate', 'mat_reboco', 0.02, true),
    L('finish2', 'mat_tinta', 0.002, true),
  ]),
  wt('wt_dry', 'Drywall 7', 'DW-07', 'Placas de gesso acartonado sobre perfil de aço com lã mineral', [
    L('finish1', 'mat_gesso', 0.0125, true),
    L('structure', 'mat_perfil', 0.048),
    L('finish1', 'mat_gesso', 0.0125, true),
  ]),
  wt('wt_conc15', 'Concreto 15', 'PC-15', 'Parede de concreto armado 15 cm com reboco', [
    L('finish2', 'mat_tinta', 0.002, true),
    L('substrate', 'mat_reboco', 0.015, true),
    L('structure', 'mat_concreto', 0.15),
    L('substrate', 'mat_reboco', 0.015, true),
    L('finish2', 'mat_tinta', 0.002, true),
  ]),
];

const ot = (o: Omit<OpeningType, 'frameMaterialId' | 'glassMaterialId' | 'closure'>, frame = 'mat_madeira'): OpeningType => ({
  ...o,
  frameMaterialId: frame,
  glassMaterialId: 'mat_vidro',
  closure: 'inherit',
});

export const DEFAULT_OPENING_TYPES: OpeningType[] = [
  ot({ id: 'ot_p80', kind: 'door', name: 'Porta 80 x 210', width: 0.8, height: 2.1, sill: 0, leaves: 1, plan: 'swing' }),
  ot({ id: 'ot_p90', kind: 'door', name: 'Porta 90 x 210', width: 0.9, height: 2.1, sill: 0, leaves: 1, plan: 'swing' }),
  ot({ id: 'ot_p70', kind: 'door', name: 'Porta 70 x 210', width: 0.7, height: 2.1, sill: 0, leaves: 1, plan: 'swing' }),
  ot({ id: 'ot_p160', kind: 'door', name: 'Porta dupla 160 x 210', width: 1.6, height: 2.1, sill: 0, leaves: 2, plan: 'double' }),
  ot({ id: 'ot_vao90', kind: 'door', name: 'Vão livre 90 x 210', width: 0.9, height: 2.1, sill: 0, leaves: 0, plan: 'swing' }),
  ot({ id: 'ot_j120', kind: 'window', name: 'Janela 120 x 120', width: 1.2, height: 1.2, sill: 1.1, leaves: 2, plan: 'sliding' }, 'mat_aluminio'),
  ot({ id: 'ot_j150', kind: 'window', name: 'Janela 150 x 100', width: 1.5, height: 1.0, sill: 1.1, leaves: 2, plan: 'sliding' }, 'mat_aluminio'),
  ot({ id: 'ot_j60', kind: 'window', name: 'Janela 60 x 60', width: 0.6, height: 0.6, sill: 1.5, leaves: 1, plan: 'casement' }, 'mat_aluminio'),
  ot({ id: 'ot_j200', kind: 'window', name: 'Janela 200 x 120', width: 2.0, height: 1.2, sill: 1.0, leaves: 2, plan: 'sliding' }, 'mat_aluminio'),
];

const toRecord = <T extends { id: string }>(list: T[]): Record<string, T> =>
  Object.fromEntries(list.map((x) => [x.id, x]));

export function createEmptyProject(name = 'Projeto sem título'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    levels: [
      { id: 'lv_0', name: 'Térreo', elevation: 0 },
      { id: 'lv_1', name: 'Pavimento 2', elevation: 3 },
    ],
    materials: toRecord(DEFAULT_MATERIALS),
    wallTypes: toRecord(DEFAULT_WALL_TYPES),
    floorTypes: toRecord(DEFAULT_FLOOR_TYPES),
    slabTypes: toRecord(DEFAULT_SLAB_TYPES),
    roofTypes: toRecord(DEFAULT_ROOF_TYPES),
    openingTypes: toRecord(DEFAULT_OPENING_TYPES),
    elements: {},
    nextOrder: 1,
    settings: { joinTolerance: 0.02, showTags: false, debugJoins: false, detail: 'medium' },
    views: [],
    defaults: { wallTypeId: 'wt_alv14', doorTypeId: 'ot_p80', windowTypeId: 'ot_j120', wallHeight: 2.8 },
  };
}
