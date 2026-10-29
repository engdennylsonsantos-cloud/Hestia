import {
  createEmptyProject,
  makeWall,
  ProjectStore,
  type CasingSpec,
  type CellNode,
  type CompositionNode,
  type LeafOptions,
  type Opening,
  type OpeningComposition,
  type OpeningType,
  type Project,
  type SplitNode,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningModel } from './openingModelTypes.ts';

/*
 * Casos da composição de esquadrias (spec docs/aberturas/F1-spec-composicao.md §1, Ex. 1 a 5), para os testes de planta,
 * corte e elevação. Mesmos exemplos do aceite (openingComposition.accept.test.ts), sem as asserções.
 */

const BAT = { presetId: 'prf_mad_batente_5x9' };
const DIV = { presetId: 'prf_mad_divisor_5x9' };
const CASING: CasingSpec = { faces: 'both', width: 0.07, thickness: 0.015, setback: 0 };

export const leafC = (id: string, extra: Record<string, unknown> = {}, door = true): CellNode => ({
  kind: 'cell',
  id,
  content: door
    ? { kind: 'leaf', family: 'door_swing', plan: 'swing', leaves: 1, options: extra as LeafOptions }
    : { kind: 'leaf', family: 'window_hinged', plan: 'hinged', leaves: 1, options: extra as LeafOptions },
});
export const glassC = (id: string): CellNode => ({ kind: 'cell', id, content: { kind: 'glass', glass: { kind: 'clear', thickness: 0.012, mounting: 'rebate' } } });
export const fixo = (value: number, node: CompositionNode) => ({ size: { mode: 'fixed' as const, value }, node });
export const fill = (node: CompositionNode) => ({ size: { mode: 'fill' as const }, node });
export const split = (id: string, axis: 'cols' | 'rows', children: SplitNode['children']): SplitNode => ({ kind: 'split', id, axis, divider: DIV, children });
export const comp = (layout: CompositionNode, over: Partial<OpeningComposition> = {}): OpeningComposition => ({
  version: 1,
  nominal: { ref: 'leaf', width: 0.9, height: 2.1, gap: { w: 0.08, h: 0.05 } },
  frame: { style: 'rebate', profile: BAT, depthMode: 'core' },
  layout,
  casing: CASING,
  ...over,
});

export const EX2 = comp(split('rows', 'rows', [fill(leafC('folha')), fixo(0.4, glassC('band'))]));
export const EX3 = comp(split('cols', 'cols', [fixo(0.4, glassC('lat-e')), fill(leafC('folha')), fixo(0.4, glassC('lat-d'))]));
export const EX4 = comp(
  split('rows', 'rows', [
    fill(split('cols', 'cols', [fixo(0.4, glassC('lat-e')), fill(leafC('folha')), fixo(0.4, glassC('lat-d'))])),
    fixo(0.4, glassC('band')),
  ]),
);
export const EX5 = comp(
  split('cols', 'cols', [fixo(0.6, glassC('fixa')), fill(leafC('abrir', {}, false))]),
  { nominal: { ref: 'opening', width: 1.6, height: 1.2 } },
);

export interface CenaEsquadria {
  p: Project;
  t: OpeningType;
  m: OpeningModel;
}

/** Parede 0,20 com núcleo 0,09 (de x 0 a 4, y 0), vão `v` no offset 2 (centro em x = 2). */
export function cenaEsquadria(base: 'ot_p90' | 'ot_j120', comp?: OpeningComposition): CenaEsquadria {
  const s = new ProjectStore(createEmptyProject());
  const base0 = s.project.openingTypes[base];
  if (!base0) throw new Error(`tipo padrão ausente: ${base}`);
  const alv = s.project.wallTypes['wt_alv14']!;
  const layers = (sub: number) => [
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'structure' as const, materialId: 'mat_bloco14', thickness: 0.09, wraps: false },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
  ];
  s.exec({ type: 'upsertWallType', wallType: { ...alv, id: 'wt_x20', layers: layers(0.053) } });
  s.exec({
    type: 'upsertOpeningType',
    // Com composição, o tipo declara `nominalRef` 'leaf' (como o `nominal` da composição): o vão do motor é o da composição.
    openingType: { ...base0, id: 'ot_x', ...(comp ? { composition: comp, nominalRef: 'leaf' as const } : {}) },
  });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_x20', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: base0.kind, typeId: 'ot_x', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  const g = openingGeometry(p, o, f);
  return { p, t: p.openingTypes.ot_x!, m: buildOpeningModel(p, o, g, f) };
}
