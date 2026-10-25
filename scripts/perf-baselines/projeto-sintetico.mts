/**
 * Gerador do projeto sintético de desempenho (frente G): N pavimentos com 32 paredes cada, um piso, uma laje e uma porta
 * por nível, e uma cobertura no topo. Usado pelo baseline de Node (`scripts/bench-interacao.mts`) e pelo de navegador
 * (`tests/e2e/perf-browser.mjs`), para que os dois meçam o mesmo projeto.
 *
 * O layout é fixo (grade de 4 m mais 8 paredes internas, como em `bench-20-pavimentos.mts`): não há sorteio.
 *
 * Gravação em arquivo: PROJETO_SAIDA=<arquivo.hestia.json> npx vite-node scripts/perf-baselines/projeto-sintetico.mts <pavimentos>
 */
import { writeFileSync } from 'node:fs';
import { syntheticProject } from '../../packages/engine/src/fixtureSintetica.ts';

export { SEGMENTS, WALLS_PER_LEVEL, syntheticProject } from '../../packages/engine/src/fixtureSintetica.ts';

// Execução direta: com PROJETO_SAIDA=<arquivo.hestia.json> grava o projeto (formato do .hestia.json) para o teste de navegador.
// Ex.: PROJETO_SAIDA=/tmp/p.json npx vite-node scripts/perf-baselines/projeto-sintetico.mts 10
const saida = process.env.PROJETO_SAIDA;
if (saida) {
  const n = Number(process.argv[process.argv.length - 1]);
  writeFileSync(saida, JSON.stringify(syntheticProject(n), null, 1));
  console.log(`Projeto de ${n} pavimentos gravado em ${saida}`);
}
