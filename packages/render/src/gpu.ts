/**
 * Fachada pública da GPU. A implementação mora em `gpu/`:
 * - `backend.ts`: política pura (ordem de fallback, orçamento de recuperação, estado para o `?perf=1`);
 * - `contexto.ts`: contexto/canvas, dispositivo WebGPU, instrumentação e restauração do WebGL2;
 * - `controlador.ts`: boot pela matriz, perda/recuperação e exposição dos gatilhos de teste.
 *
 * `createGpu` mantém o contrato antigo para quem só quer o contexto; o app usa o controlador.
 */
export * from './gpu/backend.ts';
export {
  createGpu,
  criarControladorGpu,
  limparDepuracaoGpu,
  planejarRecuperacao,
  publicarDepuracaoGpu,
  type ControladorGpu,
  type GpuResult,
  type OpcoesControladorGpu,
  type PlanoDeRecuperacao,
  type ResultadoMontagemGpu,
} from './gpu/controlador.ts';
export {
  registrarBackendCpu,
  simularPerdaDeContexto,
  simularPerdaDeDispositivo,
  type Backend,
  type GpuContext,
} from './gpu/contexto.ts';
