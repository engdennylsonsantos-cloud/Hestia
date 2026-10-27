import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const workspaceAliases = ['geom', 'model', 'engine', 'tools', 'render', 'io'].map((name) => ({
  find: `@hestia/${name}`,
  replacement: fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
}));

export default defineConfig({
  // Keep tests bound to this checkout's workspace sources even when node_modules is shared by multiple worktrees.
  resolve: { alias: workspaceAliases },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Testes de desempenho (limites de razão) não entram no portão normal: rodam em `npm run test:perf`
    // (vitest.perf.config.ts), isolados, porque medem tempo e reprovam por contenção com a suíte paralela.
    exclude: [...configDefaults.exclude, '**/*perf.test.ts'],
    environment: 'node',
    // Cede o event loop entre os testes para não estourar o timeout do birpc (I-1b; ver tests/vitestSetup.ts).
    setupFiles: ['tests/vitestSetup.ts'],
  },
});
