// Teste de fumaça no navegador: abre o app compilado, desenha, e salva capturas de tela.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const file = path.resolve('apps/web/dist/index.html');
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-webgl'],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const q = process.env.QS ?? '';
await page.goto(pathToFileURL(file).href + q);
await page.waitForSelector('.canvas-wrap canvas', { timeout: 20000 });
await page.waitForTimeout(1500);
console.log('backend badge:', await page.locator('.badge').first().innerText());
await page.screenshot({ path: `${OUT}/01-plan.png` });
await page.keyboard.press('Escape');
await page.getByText('Modelo 3D').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-3d.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
