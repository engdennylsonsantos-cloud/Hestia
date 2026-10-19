// Captura de tela de junções (arcos, tipos diferentes, nós de 3 paredes) no app real.
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
await page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.newProject('blank');
  const W = (id, a, b, extra = {}) => ({ id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, mark: '', comments: '', ...extra });
  const add = (w) => editor.store.exec({ type: 'addWall', wall: w });
  // 1) sala com parede curva
  add(W('a1', [0, 0], [0, 4]));
  add(W('a2', [0, 4], [4, 4]));
  add(W('a3', [4, 4], [4, 0], { sag: 1.2 }));
  add(W('a4', [4, 0], [0, 0]));
  // 2) nó de 3 paredes (Y) e T com tipos diferentes
  add(W('y1', [8, 2], [10.5, 3.2]));
  add(W('y2', [8, 2], [6.8, 4.3]));
  add(W('y3', [8, 2], [7.1, 0], { typeId: 'wt_alv9' }));
  add(W('t1', [6, -3], [12, -3], { typeId: 'wt_dry' }));
  add(W('t2', [9, -3], [9, -1], { typeId: 'wt_alv14' }));
  add(W('c1', [0, -3], [4, -3], { sag: -1, typeId: 'wt_ext19' }));
  editor.store.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p90', hostId: 'a3', offset: 2.2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  editor.store.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'c1', offset: 2.0, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  editor.zoomExtents();
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/40-joins-plan.png` });
await page.getByRole('tab', { name: /Modelo 3D/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/41-joins-3d.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
