import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Testes de desempenho (limites de razão) não entram no portão normal: rodam em `npm run test:perf`
    // (vitest.perf.config.ts), isolados, porque medem tempo e reprovam por contenção com a suíte paralela.
    exclude: [...configDefaults.exclude, '**/*perf.test.ts'],
    environment: 'node',
  },
});
