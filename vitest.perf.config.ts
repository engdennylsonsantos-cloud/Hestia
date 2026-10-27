import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const workspaceAliases = ['geom', 'model', 'engine', 'tools', 'render', 'io'].map((name) => ({
  find: `@hestia/${name}`,
  replacement: fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
}));

// Suíte de desempenho: `npm run test:perf`. Arquivos `*perf.test.ts`, um por vez (sem paralelismo entre
// arquivos), para que a medida não dispute CPU com outros testes. Os limites são razões contra uma
// tarefa-base cronometrada no mesmo processo (ver perf.test.ts), não milissegundos absolutos.
export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    include: ['packages/*/src/**/*perf.test.ts', 'apps/*/src/**/*perf.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
