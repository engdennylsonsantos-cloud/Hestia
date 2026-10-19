// Simula o publicador do Artifact (esqueleto + fragmento) e confirma que o app inicia.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const frag = readFileSync('apps/web/dist/artifact.html', 'utf8');
const wrapped = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${frag}</body></html>`;
const f = path.resolve('test-results/wrapped.html');
import { mkdirSync } from 'node:fs';
mkdirSync('test-results', { recursive: true });
writeFileSync(f, wrapped);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [w, h, name] of [[1440, 860, 'wide'], [400, 800, 'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(f).href);
  await page.waitForSelector('.canvas-wrap canvas', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(name, 'badge:', await page.locator('.badge').first().innerText(), '| overflow-x:', overflow);
  await page.screenshot({ path: `${process.env.SHOTS ?? 'test-results'}/30-artifact-${name}.png` });
  await page.close();
}
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
