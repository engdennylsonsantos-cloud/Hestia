import {
  createEmptyProject,
  makeWall,
  ProjectStore,
  type CasingSpec,
  type CellNode,
  type CompositionNode,
  type Opening,
  type OpeningComposition,
  type OpeningType,
  type Project,
  type ProfileRef,
  type SplitNode,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';

/*
 * Cenas dos testes do motor de composição: os 5 exemplos de docs/aberturas/F1-spec-composicao.md §1, com perfis soltos
 * (batente e divisor 5×9 sem rebaixo de vidro) para que os números da spec valham sem depender dos presets.
 */

export const BAT: ProfileRef = { inline: { material: 'wood', section: 'rect_rebate', visibleWidth: 0.05, depth: 0.09, stopWidth: 0.015 } };
export const DIV: ProfileRef = { inline: { material: 'wood', section: 'T', visibleWidth: 0.05, depth: 0.09, stopWidth: 0.015 } };
export const CASING: CasingSpec = { faces: 'both', width: 0.07, thickness: 0.015, setback: 0 };

export const leafC = (id: string, door = true): CellNode => ({
  kind: 'cell',
  id,
  content: door
    ? { kind: 'leaf', family: 'door_swing', plan: 'swing', leaves: 1, options: {} }
    : { kind: 'leaf', family: 'window_hinged', plan: 'hinged', leaves: 1, options: {} },
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

const COLS3 = (): SplitNode => split('cols', 'cols', [fixo(0.4, glassC('lat-e')), fill(leafC('folha')), fixo(0.4, glassC('lat-d'))]);
export const EX1 = comp(leafC('folha'));
export const EX2 = comp(split('rows', 'rows', [fill(leafC('folha')), fixo(0.4, glassC('band'))]));
export const EX3 = comp(COLS3());
export const EX4 = comp(split('rows', 'rows', [fill(COLS3()), fixo(0.4, glassC('band'))]));
export const EX5 = comp(split('cols', 'cols', [fixo(0.6, glassC('fixa')), fill(leafC('abrir', false))]), {
  nominal: { ref: 'opening', width: 1.6, height: 1.2 },
});

/** Parede de 0,20 com núcleo de 0,09 e um vão no meio com a composição dada (gravada direto no tipo, sem a ponte de upsert). */
export function cenaComposicao(
  base: 'ot_p90' | 'ot_j120',
  c: OpeningComposition,
  extra: Partial<OpeningType> = {},
  flips = { flipHand: false, flipFacing: false },
): { p: Project; m: OpeningModel } {
  const s = new ProjectStore(createEmptyProject());
  const t0 = s.project.openingTypes[base]!;
  const alv = s.project.wallTypes['wt_alv14']!;
  const sub = 0.053;
  const layers = [
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'structure' as const, materialId: 'mat_bloco14', thickness: 0.09, wraps: false },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
  ];
  s.exec({ type: 'upsertWallType', wallType: { ...alv, id: 'wt_x20', layers } });
  s.exec({ type: 'upsertOpeningType', openingType: { ...t0, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_x20', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'v', kind: t0.kind, typeId: 'ot_x', hostId: 'w', offset: 2, ...flips, sillOverride: null, mark: '' } });
  const tipo = { ...s.project.openingTypes.ot_x!, composition: c };
  const p: Project = { ...s.project, openingTypes: { ...s.project.openingTypes, ot_x: tipo } };
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, m: buildOpeningModel(p, o, openingGeometry(p, o, f), f) };
}

export const peca = (m: OpeningModel, id: string): OpeningPart => {
  const x = m.parts.find((q) => q.id === id);
  if (!x) throw new Error(`peça '${id}' ausente: ${m.parts.map((q) => q.id).join(', ')}`);
  return x;
};
