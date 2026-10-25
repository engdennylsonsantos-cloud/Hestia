// Fluxo interativo: desenha paredes com o mouse, insere abertura, seleciona, abre diálogos.
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
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?gl=1');
await page.waitForSelector('.canvas-wrap canvas');
await page.waitForTimeout(800);
// Projeto em branco
await page.getByRole('button', { name: 'Novo' }).click();
await page.getByText('Em branco').click();
await page.waitForTimeout(500);
const box = await page.locator('.canvas-wrap').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.keyboard.press('w');
// zoom padrão 60px/m, centro (5,3.5): desenha retângulo 6 x 4 m ao redor do centro
const P = (x, y) => [cx + (x - 5) * 60, cy - (y - 3.5) * 60];
const pts = [[2, 1.5], [2, 5.5], [8, 5.5], [8, 1.5], [2, 1.5]];
for (const [x, y] of pts) {
  const [px, py] = P(x, y);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.up();
}
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/10-walls.png` });
// porta e janela
await page.keyboard.press('d');
let [px, py] = P(5, 1.5); await page.mouse.move(px, py); await page.mouse.click(px, py);
await page.keyboard.press('j');
[px, py] = P(2, 3.5); await page.mouse.move(px, py); await page.mouse.click(px, py);
await page.keyboard.press('j');
[px, py] = P(6.5, 5.5); await page.mouse.move(px, py); await page.mouse.click(px, py);
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// seleciona uma parede
[px, py] = P(8, 3.5); await page.mouse.move(px, py); await page.mouse.click(px, py);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/11-selected.png` });
await page.getByRole('button', { name: 'Editar tipo' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/12-typedialog.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
