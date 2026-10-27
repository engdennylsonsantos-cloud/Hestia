// Telhados por arestas no app real: L, T, três águas, dez águas, empena; criação pelo modo de perímetro (contorno por pontos) e edição por aresta.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { perimetroPorPontos } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((c) => c && existsSync(c));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?gl=1&debug=1');
await page.waitForFunction(() => window.__hestia);
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const roofs = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'roof'));
/**
 * Telhado pelo modo de perímetro, com o contorno `pts` (um lado por par de pontos). `gable`: só os lados horizontais
 * (paralelos à cumeeira) definem inclinação, como duas águas; `hip`: todos os lados definem.
 */
async function drawRoof(name, pts, shape) {
  await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('blank'); });
  const inclina = shape === 'gable' ? (i, p, q) => Math.abs(p[1] - q[1]) < 1e-9 : () => true;
  const res = await perimetroPorPontos(page, 'roof', pts, { inclina });
  await page.waitForTimeout(300);
  const r = await roofs();
  console.log(`  ${name}: ${r.length} telhado(s); status: ${res.msg}`);
  await page.screenshot({ path: `${OUT}/95-${name}.png` });
  return r;
}

const L = [[0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]];
let r = await drawRoof('L-quatro-aguas', L, 'hip');
check(r.length === 1, 'telhado em L criado (antes sumia)');
r = await drawRoof('L-duas-aguas', L, 'gable');
check(r.length === 1, 'telhado em L com duas águas aceito (a envoltória fecha a superfície, como no Revit)');
const T = [[0, 0], [9, 0], [9, 3], [6, 3], [6, 8], [3, 8], [3, 3], [0, 3]];
r = await drawRoof('T-quatro-aguas', T, 'hip');
check(r.length === 1, 'telhado em T criado');
r = await drawRoof('triangulo', [[0, 0], [8, 0], [4, 6]], 'hip');
check(r.length === 1, 'telhado de três águas (triângulo) criado');
const dec = Array.from({ length: 10 }, (_, i) => [4 + 4 * Math.cos((i * 2 * Math.PI) / 10), 4 + 4 * Math.sin((i * 2 * Math.PI) / 10)]);
r = await drawRoof('decagono', dec, 'hip');
check(r.length === 1, 'telhado de dez águas (decágono) criado');

// Edição por aresta: no L, desliga a inclinação de uma aresta (vira empena) e confere o resultado.
await drawRoof('L-edicao', L, 'hip');
const before = (await roofs())[0];
await page.evaluate(() => {
  const { editor } = window.__hestia;
  const t = Object.values(editor.project.elements).find((e) => e.kind === 'roof');
  const es = t.edgeSlopes.slice(); es[0] = null; es[3] = null;
  editor.store.exec({ type: 'updateElements', ids: [t.id], patch: { edgeSlopes: es } });
});
const after = (await roofs())[0];
check(before.edgeSlopes.every((s) => s != null) && after.edgeSlopes[0] === null && after.edgeSlopes[3] === null, 'arestas desligadas viram empena');
await page.screenshot({ path: `${OUT}/96-L-empena.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
