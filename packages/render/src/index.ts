export * from './viewport.ts';
export * from './gpu.ts';
// Instrumentação de desempenho (Fase 0.2): contadores, instância do app e interceções de contexto.
export * from './perf/index.ts';
export * from './plan/types.ts';
export * from './plan/build.ts';
export * from './plan/grid.ts';
export * from './plan/cpuPlan.ts';
export * from './plan/gpuPlan.ts';
export * from './model3d/solids.ts';
export * from './model3d/orbit.ts';
export * from './model3d/scene3d.ts';
export * from './model3d/pick3d.ts';
export * from './model3d/openingParts.ts';
// Recursos de GPU da cena 3D (Fase 2.1/2.2): orçamento contábil, lotes por categoria/material e instâncias.
export { OrcamentoVram, TETO_VRAM_PADRAO } from './gpu/orcamento.ts';
export { GestorRecursosGpu, type OpcoesAtualizacao, type OpcoesGestor, type ResultadoGestor } from './gpu/gestorRecursos.ts';
export { caixaDePosicoes, LoteGeometriaGpu, mesclarLotes, unirCaixas, type Caixa, type DadosLote } from './gpu/loteGeometria.ts';
export { LoteLinhasGpu } from './gpu/loteLinhas.ts';
export { caixaDeMatrizes, InstanciasGpu } from './gpu/instanciasGpu.ts';
export * from './section/build.ts';
export * from './section/pick.ts';
export { sectionStyleOf, type SectionStyle } from './section/style.ts';
// Vista da planta (decisão 0013) e o que a exportação DXF reaproveita dela: a mesma geometria, o mesmo corte e a mesma pegada.
export { planViewOf, hiddenSelectionOps, type PlanView } from './plan/view.ts';
export { openingPlanWorldPaths, openingPlanDetail, openingDetailByZoom, type OpeningPlanWorldPath, type OpeningSymbolDetail, type OpeningSymbolOptions } from './plan/symbols.ts';
// Gráficos da vista (decisão 0015): estilo resolvido por nível, com o zoom corrente, e o padrão de uma categoria.
export { defaultPaint, planStyleOf, type PlanPaint, type PlanStyle, type PlanVisual } from './plan/style.ts';
export { climbWalk, spiralByComponent, spiralPostRing, stairCut, type StairCut } from './plan/stairs.ts';
export { risersInClimbOrder } from './stairRisers.ts';
export { roofFootprint } from './plan/roofs.ts';
export { openingTagLabels } from './plan/openingTags.ts';
// Pranchas (decisão 0022): lista de desenho da folha em mm de papel, para a tela e o PDF.
export * from './sheet/types.ts';
export * from './sheet/build.ts';
export { STAMP_H, STAMP_W } from './sheet/frame.ts';
// Ambientes (decisão 0018): rótulo e centro de cada ambiente, o mesmo texto da planta e do DXF.
export { roomLabelAt, roomLabelText } from './plan/rooms.ts';
export * from './plan/sketch.ts';
