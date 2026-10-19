// Fluxo de pisos no app real: ferramenta Piso no modo "paredes" (clique numa sala), retângulo, 3D e corte.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
const text = readFileSync('packages/engine/src/fixtures/casa-2-quartos.hestia.json', 'utf8');
await page.evaluate((t) => { const { editor } = window.__hestia; editor.openFromText(t, 'casa'); editor.zoomExtents(); }, text);
await page.waitForTimeout(500);

const screenOf = (wx, wy) => page.evaluate(([x, y]) => {
  const { editor } = window.__hestia;
  const canvas = document.querySelector('.canvas-wrap canvas');
  const r = canvas.getBoundingClientRect();
  const v = editor.ensureViewport(r.width, r.height);
  return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
}, [wx, wy]);

const count = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'floor').length);
const floors = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'floor'));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// 1) Modo paredes: clique dentro do quarto oeste inferior (x 0..4, y 2,3..7).
await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, floorMode: 'walls' } }); editor.setTool('floor'); });
const p1 = await screenOf(2, 5);
await page.mouse.move(p1.x, p1.y);
await page.mouse.click(p1.x, p1.y);
await page.waitForTimeout(400);
check((await count()) === 1, 'piso criado clicando na sala (modo paredes)');
const f1 = (await floors())[0];
const area = f1 ? Math.abs(f1.boundary.reduce((s, a, i) => { const b = f1.boundary[(i + 1) % f1.boundary.length]; return s + (a.x * b.y - b.x * a.y); }, 0) / 2) : 0;
check(area > 15 && area < 19, `área do piso da sala ≈ face interna das paredes (${area.toFixed(2)} m²)`);
await page.screenshot({ path: `${OUT}/70-piso-sala.png` });

// 2) Retângulo no outro quarto.
await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, floorMode: 'rect', floorTypeId: 'ft_madeira' } }); editor.setTool('floor'); });
const a = await screenOf(4.5, 2.7), b = await screenOf(9.5, 6.5);
await page.mouse.move(a.x, a.y); await page.mouse.click(a.x, a.y);
await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
await page.waitForTimeout(400);
check((await count()) === 2, 'segundo piso por retângulo');
await page.screenshot({ path: `${OUT}/71-piso-retangulo.png` });

// 3) Desfazer e refazer.
await page.keyboard.press('Control+z');
check((await count()) === 1, 'desfazer remove o piso');
await page.keyboard.press('Control+y');
check((await count()) === 2, 'refazer devolve o piso');

// 4) 3D e corte.
await page.getByRole('tab', { name: /Modelo 3D/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/72-piso-3d.png` });
await page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', kind: 'section', a: { x: -1, y: 5 }, b: { x: 11, y: 5 }, depth: 6 } });
  editor.openSection('sv1');
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/73-piso-corte.png` });

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
