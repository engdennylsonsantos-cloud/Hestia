export * from './viewport.ts';
export * from './gpu.ts';
export * from './plan/types.ts';
export * from './plan/build.ts';
export * from './plan/grid.ts';
export * from './plan/cpuPlan.ts';
export * from './plan/gpuPlan.ts';
export * from './model3d/solids.ts';
export * from './model3d/orbit.ts';
export * from './model3d/scene3d.ts';
export * from './model3d/pick3d.ts';
export * from './section/build.ts';
export * from './section/pick.ts';
export { sectionStyleOf, type SectionStyle } from './section/style.ts';
// Vista da planta (decisão 0013) e o que a exportação DXF reaproveita dela: a mesma geometria, o mesmo corte e a mesma pegada.
export { planViewOf, hiddenSelectionOps, type PlanView } from './plan/view.ts';
// Gráficos da vista (decisão 0015): estilo resolvido por nível, com o zoom corrente, e o padrão de uma categoria.
export { defaultPaint, planStyleOf, type PlanPaint, type PlanStyle, type PlanVisual } from './plan/style.ts';
export { climbWalk, spiralByComponent, spiralPostRing, stairCut, type StairCut } from './plan/stairs.ts';
export { risersInClimbOrder } from './stairRisers.ts';
export { roofFootprint } from './plan/roofs.ts';
