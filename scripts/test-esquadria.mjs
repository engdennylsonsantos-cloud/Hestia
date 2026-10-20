// Checagem rápida de UM caso da suíte de propriedades (por padrão a semente 24).
//
// Por que existe: o polygon-clipping entra em loop em algumas entradas e cada tentativa condenada
// custa ~30 s. Ele lê `POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS` uma única vez, no import (const de
// módulo), então o limite só pode ser injetado por variável de ambiente — nunca depois do import.
// Com o cap em 3000 a tentativa condenada falha em ~0,1 s e o motor cai no fallback (Clipper), que
// é rápido. O cap é ACELERADOR DE DIAGNÓSTICO: não é a configuração de produção.
//
// Uso: `npm run test:rapido:esquadria`  (ou `node scripts/test-esquadria.mjs --seed 31 --reporter=verbose`).
// `--seed N` aceita N de 1 a 60 (é a faixa que VITE_FULL=1 coleta); fora dela o vitest rodaria 0 testes
// e sairia 0 — por isso o script recusa com código 2, porque zero testes passando não é sucesso.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz do repositório: este arquivo mora em `<raiz>/scripts/`. */
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const ARQUIVO_TESTE = 'packages/engine/src/property.test.ts';
const CAP_SWEEPLINE = '3000';
const CAP_QUEUE = '3000';
const SEMENTE_PADRAO = 24;
/** Faixa de sementes que `VITE_FULL=1` coleta em property.test.ts (60). */
const SEMENTE_MIN = 1;
const SEMENTE_MAX = 60;

/** `--seed N` / `--seed=N` troca a semente padrão; o resto dos argumentos é repassado ao vitest. */
function lerArgumentos(argv) {
  let semente = SEMENTE_PADRAO;
  const extras = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--seed' || arg.startsWith('--seed=')) {
      const valor = arg === '--seed' ? argv[++i] : arg.slice('--seed='.length);
      const n = Number(valor);
      if (!Number.isInteger(n) || n < SEMENTE_MIN || n > SEMENTE_MAX) {
        console.error(
          `[esquadria] --seed precisa de um inteiro entre ${SEMENTE_MIN} e ${SEMENTE_MAX} (faixa de VITE_FULL=1); recebido: ${valor ?? 'nada'}.`,
        );
        process.exit(2);
      }
      semente = n;
      continue;
    }
    extras.push(arg);
  }
  return { semente, extras };
}

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

const { semente, extras } = lerArgumentos(process.argv.slice(2));
// `-t` do vitest é match por SUBSTRING, e o nome comparado é o de `getTaskFullName`
// (@vitest/runner/dist/chunk-hooks.js): `propriedades, semente N (a) ...` — juntado por ESPAÇO
// simples, não por " > " (esse separador só existe no reporter). Um `-t "semente 4"` casaria também
// `semente 40..49` (11 sementes, 55 testes) e `semente 4 >` casaria ZERO testes; por isso o filtro é
// uma regex que só aceita o número quando ele NÃO é prefixo de outro maior: `semente 4(?!\d)`.
// Limite conhecido: um filtro que casasse 0 testes ainda sairia com código 0 (o vitest considera o
// arquivo coletado), então confira sempre o `Tests N passed` no fim — o esperado é 5.
const filtro = String.raw`semente ${semente}(?!\d)`;
const cli = resolverCliVitest(RAIZ);
if (!cli) {
  console.error('[esquadria] CLI do vitest não encontrado (node_modules/vitest/vitest.mjs). Rode `npm install`.');
  process.exit(2);
}

const args = ['run', ARQUIVO_TESTE, '-t', filtro, ...extras];
const env = {
  ...process.env,
  POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS: CAP_SWEEPLINE,
  POLYGON_CLIPPING_MAX_QUEUE_SIZE: CAP_QUEUE,
  VITE_FULL: '1',
};

// Cabeçalho curto: o cap é acelerador de diagnóstico, não muda a geometria esperada.
console.log(`[esquadria] cap de diagnóstico: POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS=${CAP_SWEEPLINE}, POLYGON_CLIPPING_MAX_QUEUE_SIZE=${CAP_QUEUE} (VITE_FULL=1 → 60 sementes no arquivo).`);
console.log(`[esquadria] filtro exato do -t (regex): "${filtro}" → casa "semente ${semente}" seguido de algo que não é dígito; NÃO casa semente ${semente}0..${semente}9 · vitest: ${cli}`);
console.log(`[esquadria] comando: node ${['vitest', ...args].join(' ')}`);

const t0 = Date.now();
const filho = spawn(process.execPath, [cli, ...args], { cwd: RAIZ, env, stdio: 'inherit' });

filho.on('error', (erro) => {
  console.error(`[esquadria] falha ao iniciar o vitest: ${erro.message}`);
  process.exit(2);
});

filho.on('exit', (codigo, sinal) => {
  const segundos = (Date.now() - t0) / 1000;
  console.log(`[esquadria] tempo de parede: ${segundos.toFixed(1)} s · código de saída do vitest: ${codigo ?? `sinal ${sinal}`}`);
  process.exit(codigo ?? 1);
});
