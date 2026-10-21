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
// Vista da planta (decisão 0013) e o que a exportação DXF reaproveita dela: a mesma geometria, o mesmo corte e a mesma pegada.
export { planViewOf, hiddenSelectionOps, type PlanView } from './plan/view.ts';
export { climbWalk, spiralByComponent, spiralPostRing, stairCut, type StairCut } from './plan/stairs.ts';
export { risersInClimbOrder } from './stairRisers.ts';
export { roofFootprint } from './plan/roofs.ts';
