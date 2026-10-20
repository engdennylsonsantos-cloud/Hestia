// Telhados por arestas no app real: L, T, três águas, dez águas, empena; criação pela ferramenta (pontos) e edição por aresta.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
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
const status = () => page.evaluate(() => window.__hestia.useUi.getState().status);
const screenOf = (wx, wy) => page.evaluate(([x, y]) => {
  const { editor } = window.__hestia; const canvas = document.querySelector('.canvas-wrap canvas'); const r = canvas.getBoundingClientRect();
  const v = editor.ensureViewport(r.width, r.height);
  return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
}, [wx, wy]);

async function drawRoof(name, pts, shape, slope = 30) {
  await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('blank'); });
  await page.evaluate(() => {
    const { editor } = window.__hestia; const c = document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
    const v = editor.ensureViewport(c.width, c.height); editor.setViewport({ ...v, cx: 4.5, cy: 4, zoom: 32 });
  });
  await page.evaluate(([s, sl]) => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, roofMode: 'poly', roofShape: s, roofSlope: sl } }); editor.setTool('roof'); }, [shape, slope]);
  for (const [x, y] of pts) { const p = await screenOf(x, y); await page.mouse.move(p.x, p.y, { steps: 2 }); await page.mouse.click(p.x, p.y); }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const r = await roofs();
  console.log(`  ${name}: ${r.length} telhado(s); status: ${await status()}`);
  await page.screenshot({ path: `${OUT}/95-${name}.png` });
  return r;
}

const L = [[0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]];
let r = await drawRoof('L-quatro-aguas', L, 'hip');
check(r.length === 1, 'telhado em L criado (antes sumia)');
r = await drawRoof('L-duas-aguas', L, 'gable');
check(r.length === 1, 'telhado em L com duas águas criado');
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
