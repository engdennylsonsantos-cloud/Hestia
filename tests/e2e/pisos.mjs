// Fluxo de pisos no app real: modo "Criar/Editar perímetro" para o piso (dois rascunhos de retângulo), desfazer, 3D e corte.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
const text = readFileSync('packages/engine/src/fixtures/casa-2-quartos.hestia.json', 'utf8');
await page.evaluate((t) => { const { editor } = window.__hestia; editor.openFromText(t, 'casa'); editor.zoomExtents(); }, text);
await page.waitForTimeout(500);

const count = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'floor').length);
const floors = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'floor'));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// 1) Modo de perímetro: rascunho do retângulo dentro do quarto oeste inferior (x 0,1..3,9, y 2,4..6,9).
await page.evaluate(() => { const { useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, floorTypeId: 'ft_ceram' } }); });
const r1 = await perimetroPorPontos(page, 'floor', [[0.1, 2.4], [3.9, 2.4], [3.9, 6.9], [0.1, 6.9]]);
check(r1.ok && (await count()) === 1, `piso criado pelo modo de perímetro (${r1.msg})`);
const f1 = (await floors())[0];
const area = f1 ? Math.abs(f1.boundary.reduce((s, a, i) => { const b = f1.boundary[(i + 1) % f1.boundary.length]; return s + (a.x * b.y - b.x * a.y); }, 0) / 2) : 0;
check(area > 15 && area < 19, `área do piso = área do contorno desenhado, 3,8 × 4,5 m (${area.toFixed(2)} m²)`);
await page.screenshot({ path: `${OUT}/70-piso-sala.png` });

// 2) Retângulo no outro quarto, com o tipo de madeira.
await page.evaluate(() => { const { useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, floorTypeId: 'ft_madeira' } }); });
const r2 = await perimetroPorPontos(page, 'floor', [[4.5, 2.7], [9.5, 2.7], [9.5, 6.5], [4.5, 6.5]]);
check(r2.ok && (await count()) === 2, 'segundo piso pelo modo de perímetro (retângulo)');
await page.screenshot({ path: `${OUT}/71-piso-retangulo.png` });

// 3) Desfazer e refazer.
await page.keyboard.press('Control+z');
check((await count()) === 1, 'desfazer remove o piso');
await page.keyboard.press('Control+y');
check((await count()) === 2, 'refazer devolve o piso');

// 4) 3D e corte.
await abreVista3d(page);
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
