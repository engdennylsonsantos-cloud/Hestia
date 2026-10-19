// Fluxo de lajes e snap no app real: laje pelo perímetro externo, inclinação, snap em faces, corte e 3D.
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
await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('house2'); editor.zoomExtents(); });
await page.waitForTimeout(500);

const screenOf = (wx, wy) => page.evaluate(([x, y]) => {
  const { editor } = window.__hestia;
  const canvas = document.querySelector('.canvas-wrap canvas');
  const r = canvas.getBoundingClientRect();
  const v = editor.ensureViewport(r.width, r.height);
  return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
}, [wx, wy]);
const slabs = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'slab'));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// 1) Snap em face: ferramenta Parede, cursor perto do canto externo da casa.
const bounds = await page.evaluate(() => {
  const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
  const xs = ws.flatMap((w) => [w.a.x, w.b.x]); const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
});
await page.evaluate(() => window.__hestia.editor.setTool('wall'));
const nearCorner = await screenOf(bounds.minX - 0.1, bounds.minY - 0.1);
// Aproxima do canto externo da face (a 0,135 m do eixo) em passos, como um mouse de verdade.
const faceCorner = await screenOf(bounds.minX - 0.135, bounds.minY - 0.135);
await page.mouse.move(nearCorner.x, nearCorner.y, { steps: 3 });
await page.mouse.move(faceCorner.x + 2, faceCorner.y + 2, { steps: 3 });
await page.waitForTimeout(200);
const kind = await page.evaluate(() => window.__hestia.useUi.getState().snapKind);
check(kind === 'face', `captura no canto externo da face da casa (tipo: ${kind})`);
await page.keyboard.press('Escape');

// 2) Laje pelo perímetro externo.
await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, slabMode: 'perimetro', slabTypeId: 'ls_mac15' } }); editor.setTool('slab'); });
const onWall = await screenOf(bounds.minX, (bounds.minY + bounds.maxY) / 2);
await page.mouse.move(onWall.x, onWall.y);
await page.mouse.click(onWall.x, onWall.y);
await page.waitForTimeout(400);
const s = await slabs();
check(s.length === 1, 'laje criada pelo perímetro externo');
const area = s[0] ? Math.abs(s[0].boundary.reduce((acc, a, i) => { const b = s[0].boundary[(i + 1) % s[0].boundary.length]; return acc + (a.x * b.y - b.x * a.y); }, 0) / 2) : 0;
const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
check(area > w * h && area < (w + 0.6) * (h + 0.6), `área da laje > área dos eixos e < eixos + 0,3 de cada lado (${area.toFixed(2)} m²)`);
await page.screenshot({ path: `${OUT}/80-laje-planta.png` });

// 3) Inclinação por API (o fluxo da ferramenta é coberto por testes), 3D e corte.
await page.evaluate(() => {
  const { editor } = window.__hestia;
  const sl = Object.values(editor.project.elements).find((e) => e.kind === 'slab');
  editor.store.exec({ type: 'updateElements', ids: [sl.id], patch: { slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } } });
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/81-laje-inclinada.png` });
await page.getByRole('tab', { name: /Modelo 3D/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/82-laje-3d.png` });
await page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', kind: 'section', a: { x: -1, y: 3 }, b: { x: 11, y: 3 }, depth: 6 } });
  editor.openSection('sv1');
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/83-laje-corte.png` });
await page.keyboard.press('Control+z');
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
