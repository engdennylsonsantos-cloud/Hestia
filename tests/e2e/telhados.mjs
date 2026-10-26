// Fluxo de telhados no app real: telhado pelas paredes (duas águas), empena, 3D, corte e troca de nível.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { abreVista3d, perimetroPorPontos } from './helpers.mjs';

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
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const roofs = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'roof'));
const b = await page.evaluate(() => {
  const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
  const xs = ws.flatMap((w) => [w.a.x, w.b.x]); const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
});

// Telhado por fora das paredes (duas águas): o rascunho do modo de perímetro é o retângulo a 0,135 m do eixo das paredes,
// e os lados horizontais (paralelos à cumeeira) definem inclinação.
const f = 0.135;
const res = await perimetroPorPontos(page, 'roof', [[b.minX - f, b.minY - f], [b.maxX + f, b.minY - f], [b.maxX + f, b.maxY + f], [b.minX - f, b.maxY + f]], { inclina: (i, p, q) => Math.abs(p[1] - q[1]) < 1e-9 });
await page.waitForTimeout(300);
const r = await roofs();
check(res.ok && r.length === 1, 'telhado criado pelo modo de perímetro', res.msg);
// Telhado novo é por arestas (decisão 0008): duas águas = exatamente 2 arestas com inclinação (as outras são empenas).
const caem = (r[0]?.edgeSlopes ?? []).filter((s) => s !== null && s > 0).length;
check(r[0]?.shape === 'edges' && caem === 2, `forma duas águas (por arestas, ${caem} arestas com inclinação)`);
const w = b.maxX - b.minX, h = b.maxY - b.minY;
const xs = r[0] ? r[0].boundary.map((p) => p.x) : [0], ys = r[0] ? r[0].boundary.map((p) => p.y) : [0];
const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
check(bw > w + 0.5 && bh > h + 0.5, `beiral maior que a casa (${bw.toFixed(2)} × ${bh.toFixed(2)} m)`);
await page.screenshot({ path: `${OUT}/90-telhado-planta.png` });

// Empena: paredes do nível ajustadas ao telhado + 3D + corte.
await page.evaluate(() => {
  const { editor } = window.__hestia;
  const ws = Object.values(editor.project.elements).filter((e) => e.kind === 'wall');
  editor.store.exec({ type: 'updateElements', ids: ws.map((x) => x.id), patch: { attachTopToRoof: true } });
});
await abreVista3d(page);
await page.getByRole('tab', { name: /Modelo 3D/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/91-telhado-3d.png` });
await page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', kind: 'section', a: { x: 5, y: -3 }, b: { x: 5, y: 10 }, depth: 4 } });
  editor.openSection('sv1');
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/92-telhado-corte.png` });

// Troca de nível do telhado (mantendo a cota).
await page.evaluate(() => {
  const { editor } = window.__hestia;
  const t = Object.values(editor.project.elements).find((e) => e.kind === 'roof');
  editor.store.exec({ type: 'setElementLevel', ids: [t.id], levelId: 'lv_1', keep: 'elevation' });
});
const moved = (await roofs())[0];
check(moved?.levelId === 'lv_1', 'telhado mudou para o pavimento 2');
check(moved && Math.abs(moved.heightOffset + 0.2) < 3.1, `deslocamento compensado (${moved?.heightOffset})`);
await page.keyboard.press('Control+z');
check((await roofs())[0]?.levelId === 'lv_0', 'desfazer devolve o telhado ao térreo');
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
