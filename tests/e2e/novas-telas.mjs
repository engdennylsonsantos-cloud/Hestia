// Abre as telas novas (perfil superior, faixas, parâmetros do tipo, etiquetas) e salva capturas; falha se houver erro de página.
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
  editor.store.exec({ type: 'upsertWallType', wallType: { ...p.wallTypes.wt_alv14, wrapEnds: 'both' } });
  editor.store.exec({ type: 'setSettings', patch: { showTags: true, debugJoins: true } });
  editor.zoomExtents();
  const w = Object.values(p.elements).find((e) => e.kind === 'wall');
  editor.setSelection?.([w.id]);
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/60-etiquetas-juncoes.png` });
const wall = await page.evaluate(() => Object.values(window.__hestia.editor.store.project.elements).find((e) => e.kind === 'wall').id);
await page.evaluate((id) => window.__hestia.editor.select?.([id]) ?? window.__hestia.editor.setSelection?.([id]), wall);
await page.waitForTimeout(300);
const edit = page.getByRole('button', { name: /Editar…/ }).first();
if (await edit.count()) {
  await edit.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/61-perfil.png` });
  await page.keyboard.press('Escape');
} else console.log('aviso: botão Editar… do perfil não encontrado (seleção)');
await page.getByText('Editar tipo').first().click({ timeout: 3000 }).catch(() => console.log('aviso: Editar tipo não encontrado'));
await page.waitForTimeout(400);
const faixas = page.getByRole('button', { name: 'Faixas' });
if (await faixas.count()) {
  await faixas.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/62-faixas.png` });
}
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
