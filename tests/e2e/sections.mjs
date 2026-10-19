// Captura de corte e elevação no app real (casa de exemplo, perfil de empena, junções).
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
  editor.newProject('house2');
  const p = editor.store.project;
  const w = Object.values(p.elements).filter((e) => e.kind === 'wall');
  const first = w[0];
  const L = Math.hypot(first.b.x - first.a.x, first.b.y - first.a.y);
  editor.store.exec({ type: 'updateElements', ids: [first.id], patch: { topProfile: [{ t: 0, h: 2.8 }, { t: L / 2, h: 4.2 }, { t: L, h: 2.8 }] } });
  editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', kind: 'section', a: { x: 4, y: -2 }, b: { x: 4, y: 12 }, depth: 14 } });
  editor.generateElevations();
  editor.zoomExtents();
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/50-plan-marks.png` });
await page.evaluate(() => window.__hestia.editor.openSection('sv1'));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/51-section.png` });
const id = await page.evaluate(() => window.__hestia.editor.store.project.views.find((v) => v.name === 'Sul')?.id);
await page.evaluate((i) => window.__hestia.editor.openSection(i), id);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/52-elevation.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
