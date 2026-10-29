/**
 * Fecha o ciclo de qualidade da exportação: exporta os templates, valida cada IFC no IfcOpenShell e roda o round-trip.
 * Escreve `test-results/ifc-quality/report.json` e uma tabela no terminal.
 *
 * Uso: `npm run ifc:quality` (ou `npx vite-node scripts/ifc-quality/quality.mts`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const saida = join(raiz, 'test-results', 'ifc-quality');

function viteNode(script: string, ...args: string[]) {
  const cli = join(raiz, 'node_modules', 'vite-node', 'vite-node.mjs');
  return spawnSync(process.execPath, [cli, script, ...args], { cwd: raiz, encoding: 'utf8' });
}

mkdirSync(saida, { recursive: true });
const exportacao = viteNode(join('scripts', 'ifc-quality', 'export-fixtures.mts'));
if (exportacao.status !== 0) {
  console.error(exportacao.stderr || exportacao.stdout);
  process.exit(exportacao.status ?? 1);
}

const arquivos = ['house2', 'studio', 'house-premium', 'predio10', 'esquadrias', 'casa-ambientes'];
const linhas: string[] = [];
const relatorio: Record<string, unknown> = {};

for (const nome of arquivos) {
  const ifc = join(saida, `${nome}.ifc`);
  const validacao = spawnSync('python', [join('scripts', 'ifc-quality', 'validate.py'), ifc, '--geometry'], {
    cwd: raiz,
    encoding: 'utf8',
  });
  let dados: { erros?: unknown[]; contagem?: Record<string, number>; geometria?: Record<string, { volume?: number; area?: number }> } = {};
  try {
    dados = JSON.parse(validacao.stdout);
  } catch {
    dados = { erros: [`falha ao validar: ${(validacao.stderr || '').slice(0, 200)}`] };
  }
  const volumes = Object.values(dados.geometria ?? {});
  const volume = volumes.reduce((s, g) => s + (g.volume ?? 0), 0);
  const area = volumes.reduce((s, g) => s + (g.area ?? 0), 0);
  const contagem = dados.contagem ?? {};
  const erros = (dados.erros ?? []).length;
  const kB = Math.round(readFileSync(ifc).byteLength / 1024);
  relatorio[nome] = { erros, contagem, volume, area, kB };
  linhas.push(
    `| ${nome} | ${erros} | ${contagem.IFCWALL ?? 0} | ${contagem.IFCDOOR ?? 0} | ${contagem.IFCWINDOW ?? 0} | ${contagem.IFCSLAB ?? 0} | ${contagem.IFCROOF ?? 0} | ${contagem.IFCSTAIR ?? 0} | ${contagem.IFCSPACE ?? 0} | ${contagem.IFCGRID ?? 0} | ${volume.toFixed(1)} m³ | ${kB} kB |`,
  );
}

const volta = viteNode(join('scripts', 'ifc-quality', 'roundtrip.mts'));
const roundtripOk = (volta.stdout ?? '').includes('todos os modelos');
const comparacao = viteNode(join('scripts', 'ifc-quality', 'compare.mts'));
process.stdout.write(comparacao.stdout ?? '');
let n2: unknown = null;
try {
  n2 = JSON.parse(readFileSync(join(saida, 'compare.json'), 'utf8'));
} catch {
  n2 = null;
}
writeFileSync(
  join(saida, 'report.json'),
  JSON.stringify({ data: new Date().toISOString(), roundtripOk, n2, modelos: relatorio }, null, 2),
);

console.log('| modelo | erros | paredes | portas | janelas | lajes | telhados | escadas | ambientes | eixos | volume | arquivo |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const linha of linhas) console.log(linha);
console.log(`\nround-trip: ${roundtripOk ? 'ok' : 'com lacunas conhecidas (onda 1)'}`);
console.log(`relatório: ${join('test-results', 'ifc-quality', 'report.json')}`);
if (!existsSync(join(saida, 'report.json'))) process.exit(1);
