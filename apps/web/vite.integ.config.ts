import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// TEMPORÁRIO: build de comparação do commit bb72f2a (sem interface nova).
const raiz = '<usuario-local>/AppData/Local/Temp/opencode/hestia-perf/perf-etapas';
const pkg = (nome: string) => resolve(raiz, 'packages', nome);

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^@hestia\/engine$/, replacement: resolve(pkg('engine'), 'src/index.ts') },
      { find: /^@hestia\/engine\//, replacement: resolve(pkg('engine')) + '/' },
      { find: /^@hestia\/geom$/, replacement: resolve(pkg('geom'), 'src/index.ts') },
      { find: /^@hestia\/geom\//, replacement: resolve(pkg('geom')) + '/' },
      { find: /^@hestia\/io$/, replacement: resolve(pkg('io'), 'src/index.ts') },
      { find: /^@hestia\/io\//, replacement: resolve(pkg('io')) + '/' },
      { find: /^@hestia\/model$/, replacement: resolve(pkg('model'), 'src/index.ts') },
      { find: /^@hestia\/model\//, replacement: resolve(pkg('model')) + '/' },
      { find: /^@hestia\/render$/, replacement: resolve(pkg('render'), 'src/index.ts') },
      { find: /^@hestia\/render\//, replacement: resolve(pkg('render')) + '/' },
      { find: /^@hestia\/tools$/, replacement: resolve(pkg('tools'), 'src/index.ts') },
      { find: /^@hestia\/tools\//, replacement: resolve(pkg('tools')) + '/' },
    ],
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, cssCodeSplit: false, minify: false },
});
