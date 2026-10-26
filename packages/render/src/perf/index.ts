// Instrumentação de desempenho (Fase 0.2): contadores puros, instância do app e interceções de contexto.
// A API de navegador (`window.__hestiaPerf`) e o overlay `?perf=1` ficam em `apps/web/src/debug/perf`.
export * from './contadores.ts';
export * from './orcamento.ts';
export { contadores } from './registro.ts';
export { instrumentarWebGl2, type InstrumentacaoGl } from './webgl.ts';
export { instrumentarWebGpu, type InstrumentacaoWebGpu } from './webgpu.ts';
