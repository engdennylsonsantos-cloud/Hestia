// Fluxo completo com asserções: desenho, edição, diálogos, níveis, temas e desempenho.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?gl=1&debug=1');
await page.waitForSelector('.canvas-wrap canvas');
await page.waitForFunction(() => window.__hestia);
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };
const st = () => page.evaluate(() => {
  const { editor } = window.__hestia;
  const els = Object.values(editor.project.elements);
  return { walls: els.filter((e) => e.kind === 'wall'), openings: els.filter((e) => e.kind !== 'wall'), canUndo: editor.store.canUndo };
});

await page.getByRole('button', { name: 'Novo' }).click();
await page.getByText('Em branco').click();
await page.waitForTimeout(300);
const box = await page.locator('.canvas-wrap').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const P = (x, y) => [cx + (x - 5) * 60, cy - (y - 3.5) * 60];
const click = async (x, y) => { const [px, py] = P(x, y); await page.mouse.move(px, py); await page.mouse.click(px, py); };

// 1. desenhar um retângulo 6 x 4 m
await page.keyboard.press('w');
for (const [x, y] of [[2, 1.5], [2, 5.5], [8, 5.5], [8, 1.5], [2, 1.5]]) await click(x, y);
let s = await st();
check('4 paredes desenhadas', s.walls.length === 4, `(${s.walls.length})`);
const lens = s.walls.map((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y).toFixed(3));
check('comprimentos exatos 4,6,4,6', lens.join() === '4.000,6.000,4.000,6.000', lens.join());

// 2. digitar comprimento
await page.keyboard.press('Escape');
await page.keyboard.press('w');
await click(0, 0);
const [mx, my] = P(2, 0); await page.mouse.move(mx, my);
await page.keyboard.type('2,5');
await page.keyboard.press('Enter');
s = await st();
const typed = s.walls.at(-1);
check('parede por medida digitada = 2,50', Math.abs(Math.hypot(typed.b.x - typed.a.x, typed.b.y - typed.a.y) - 2.5) < 1e-6);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

// 3. porta e janela
await page.keyboard.press('d'); await click(5, 1.5);
await page.keyboard.press('j'); await click(2, 3.5); await click(8, 3.5);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
s = await st();
check('3 aberturas', s.openings.length === 3, `(${s.openings.length})`);

// 4. seleção + mover com vizinhas acompanhando
await click(5, 5.5);
const sel = await page.evaluate(() => window.__hestia.useUi.getState().selection.length);
check('seleção por clique', sel === 1);
await page.keyboard.press('m');
await click(4, 5.5); await click(4, 6.5);
s = await st();
const top = s.walls.find((w) => Math.abs(w.a.y - 6.5) < 1e-6 && Math.abs(w.b.y - 6.5) < 1e-6);
const left = s.walls.find((w) => Math.abs(w.a.x - 2) < 1e-6 && Math.abs(w.b.x - 2) < 1e-6);
check('parede movida 1 m', !!top);
check('vizinha acompanhou (esticou)', !!left && Math.max(left.a.y, left.b.y) > 6.4, left ? `${left.a.y},${left.b.y}` : '');
await page.keyboard.press('Control+z');
s = await st();
check('desfazer volta a posição', s.walls.some((w) => Math.abs(w.a.y - 5.5) < 1e-6 && Math.abs(w.b.y - 5.5) < 1e-6));

// 5. girar digitando 90°
await page.keyboard.press('v'); await click(5, 5.5);
await page.keyboard.press('r'); await click(5, 5.5);
await page.keyboard.type('90'); await page.keyboard.press('Enter');
s = await st();
check('girar 90° por valor digitado', s.walls.some((w) => Math.abs(w.a.x - 5) < 1e-6 && Math.abs(w.b.x - 5) < 1e-6 && Math.abs(Math.abs(w.a.y - w.b.y) - 6) < 1e-6));
await page.keyboard.press('Control+z');

// 6. diálogo de tipo: adicionar camada, OK e verificar histórico
await click(8, 2.2);
await page.getByRole('button', { name: 'Editar tipo' }).click();
await page.getByRole('button', { name: '+ Inserir camada' }).click();
await page.screenshot({ path: `${OUT}/20-type-add-layer.png` });
await page.getByRole('button', { name: 'OK' }).click();
const layers = await page.evaluate(() => window.__hestia.editor.project.wallTypes.wt_alv14.layers.length);
check('tipo editado tem 6 camadas', layers === 6, `(${layers})`);
await page.keyboard.press('Control+z');
check('desfazer edição de tipo', (await page.evaluate(() => window.__hestia.editor.project.wallTypes.wt_alv14.layers.length)) === 5);

// 7. materiais
await page.getByRole('button', { name: /Materiais/ }).click();
await page.screenshot({ path: `${OUT}/21-materials.png` });
await page.keyboard.press('Escape');

// 8. nível 2 + underlay
await page.getByRole('tab', { name: /Pavimento 2/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/22-level2.png` });
await page.getByRole('tab', { name: /Térreo/ }).click();

// 9. tema escuro + 3D
await page.locator('button[title^="Tema"]').click();
await page.locator('button[title^="Tema"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/23-dark-plan.png` });
await page.getByRole('tab', { name: /Modelo 3D/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/24-dark-3d.png` });

// 10. desempenho: 20 movimentos de mouse na planta
await page.getByRole('tab', { name: /Térreo/ }).click();
await page.keyboard.press('w');
await click(0, 0);
const t0 = Date.now();
for (let i = 0; i < 40; i++) { const [a, b] = P(1 + i * 0.1, 1 + i * 0.05); await page.mouse.move(a, b); }
const ms = (Date.now() - t0) / 40;
check('movimento do mouse < 60 ms/quadro (SwiftShader)', ms < 60, `(${ms.toFixed(1)} ms)`);
console.log('errors:', errors.length ? errors.join('\n') : 'none');
if (errors.length) fails++;
await browser.close();
process.exit(fails ? 1 : 0);
