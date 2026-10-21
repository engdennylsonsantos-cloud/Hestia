import { defineConfig } from 'vitest/config';

// Suíte de desempenho: `npm run test:perf`. Arquivos `*perf.test.ts`, um por vez (sem paralelismo entre
// arquivos), para que a medida não dispute CPU com outros testes. Os limites são razões contra uma
// tarefa-base cronometrada no mesmo processo (ver perf.test.ts), não milissegundos absolutos.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*perf.test.ts', 'apps/*/src/**/*perf.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
