// Suíte completa: roda o vitest com `VITE_FULL=1`, que é o que abre as 60 sementes em
// `packages/engine/src/property.test.ts` (sem ele são 15). Existe porque o script antigo era
// `"VITE_FULL=1 vitest run"` no package.json: isso é sintaxe POSIX e o npm no Windows usa `cmd.exe`,
// que não entende a atribuição `VAR=valor comando` — a suíte de 60 sementes nunca rodava por ali.
// Aqui a variável é injetada pelo próprio Node no `env` do filho, então funciona em qualquer shell.
//
// ATENÇÃO: a suíte inteira leva ~8 min (60 sementes × 5 casos, medido em 470–490 s nesta máquina). NUNCA rode sem filtro para
// diagnóstico. Para um caso único existe `npm run test:rapido:esquadria` (semente 24, com o cap de
// diagnóstico do polygon-clipping), ou `npm run test:completo -- -t "semente 24"`.
//
// Uso: `npm run test:completo`  (ou `node scripts/completo.mjs -t "semente 1" --reporter=verbose`).
// Os argumentos extras são repassados ao vitest, na ordem.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz do repositório: este arquivo mora em `<raiz>/scripts/`. */
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
/** Comando padrão: a suíte inteira, exatamente o que o script antigo pretendia. */
const ARGS_PADRAO = ['run'];

/**
 * Resolve o CLI do vitest de forma robusta: primeiro o binário do workspace (`node_modules/vitest/
 * vitest.mjs`), que é o que o npm usa; se o layout do hoisting for outro, resolve pelo pacote.
 */
function resolverCliVitest(raiz) {
  const local = join(raiz, 'node_modules', 'vitest', 'vitest.mjs');
  if (existsSync(local)) return local;
  try {
    const exigir = createRequire(join(raiz, 'package.json'));
    const pacote = exigir.resolve('vitest/package.json');
    const cli = join(dirname(pacote), 'vitest.mjs');
    if (existsSync(cli)) return cli;
  } catch {
    /* sem o pacote resolvível: cai no erro abaixo */
  }
  return null;
}

// Argumentos extras do usuário (`npm run test:completo -- -t "semente 24"`) vão para o vitest.
const extras = process.argv.slice(2);
const cli = resolverCliVitest(RAIZ);
if (!cli) {
  console.error('[completo] CLI do vitest não encontrado (node_modules/vitest/vitest.mjs). Rode `npm install`.');
  process.exit(2);
}

const args = [...ARGS_PADRAO, ...extras];
// VITE_FULL=1 é o que liga as 60 sementes: herdamos o ambiente e forçamos só essa variável.
const env = { ...process.env, VITE_FULL: '1' };

// Cabeçalho curto: avisa do custo e mostra exatamente o que vai rodar.
console.log('[completo] VITE_FULL=1 → suíte inteira (60 sementes). Leva ~8 min; para um caso único use `npm run test:rapido:esquadria`.');
console.log(`[completo] vitest: ${cli}`);
console.log(`[completo] comando: node ${['vitest', ...args].join(' ')}`);

const t0 = Date.now();
const filho = spawn(process.execPath, [cli, ...args], { cwd: RAIZ, env, stdio: 'inherit' });

filho.on('error', (erro) => {
  console.error(`[completo] falha ao iniciar o vitest: ${erro.message}`);
  process.exit(2);
});

filho.on('exit', (codigo, sinal) => {
  const segundos = (Date.now() - t0) / 1000;
  console.log(`[completo] tempo de parede: ${segundos.toFixed(1)} s · código de saída do vitest: ${codigo ?? `sinal ${sinal}`}`);
  process.exit(codigo ?? 1);
});
