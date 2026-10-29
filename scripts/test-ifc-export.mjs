// Suíte de EXPORTAÇÃO IFC: roda só os testes do exportador e do round-trip de exportação.
// Existe para os agentes não dispararem a suíte inteira (4–5 min) a cada passo e não validarem
// coisas não relacionadas. O gate global (tsc/lint/suíte completa) é do integrador, uma vez por onda.
//
// Uso: `npm run test:ifc-export` ou `npm run test:ifc-export -- -t "nome do teste"`.
// Novos testes devem morar em `packages/io/src/ifc/**`, `packages/io/src/ifcExport/**`,
// `apps/web/src/editor/ifcExport*.test.ts` ou `tests/ifc-export/**`.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(raiz, 'node_modules', 'vitest', 'vitest.mjs');
if (!existsSync(cli)) {
  console.error('[ifc-export] vitest não encontrado; rode `npm install`.');
  process.exit(2);
}

/** Todos os `.test.ts` sob `dir` (recursivo), se o diretório existir. */
const testesEm = (dir) => {
  const abs = join(raiz, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.test.ts'))
    .map((f) => join(dir, f).replaceAll('\\', '/'));
};

const alvos = [
  ...testesEm('packages/io/src/ifc'),
  ...testesEm('packages/io/src/ifcExport'),
  ...testesEm('apps/web/src/editor').filter((f) => /\/ifcExport[^/]*\.test\.ts$/.test(f)),
  ...testesEm('tests/ifc-export'),
];

if (alvos.length === 0) {
  console.error('[ifc-export] nenhum teste de exportação encontrado.');
  process.exit(2);
}
const args = ['run', ...alvos, '--maxWorkers=2', ...process.argv.slice(2)];
console.log(`[ifc-export] ${alvos.length} arquivo(s):`);
for (const a of alvos) console.log(`  ${a}`);
const inicio = Date.now();
const filho = spawnSync(process.execPath, [cli, ...args], { cwd: raiz, stdio: 'inherit' });
const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
if (filho.status !== 0) {
  console.error(`[ifc-export] FALHOU em ${segundos}s — não rode a suíte completa: corrija o teste do exportador.`);
  process.exit(filho.status ?? 1);
}
console.log(`[ifc-export] ok em ${segundos}s. Gate global fica com o integrador (npm run check).`);
