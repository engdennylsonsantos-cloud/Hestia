// Auxiliares dos testes e2e de navegador: mesmo navegador e flags do flow.mjs (WebGL2 via SwiftShader, sem `playwright install`),
// abertura do build de produção por file:// e um relatório passo a passo com código de saída.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const CHROME_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Chromium do sistema (o mesmo que os outros e2e usam). */
export const chromeExecutable = () => ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);

export const distUrl = () => pathToFileURL(path.resolve('apps/web/dist/index.html')).href;

/** Abre o app construído (`npm run build`) com ganchos de depuração e devolve a página e a lista de erros do navegador. */
export async function openApp(browser, { query = '?debug=1', width = 1440, height = 860 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(distUrl() + query);
  await page.waitForSelector('.canvas-wrap canvas');
  await page.waitForFunction(() => window.__hestia);
  await page.waitForTimeout(500);
  return { page, errors };
}

export async function launch() {
  return chromium.launch({ executablePath: chromeExecutable(), args: CHROME_ARGS });
}

/**
 * Relatório: cada passo tem verificações (`check`). Um passo com verificação falha, ou que lança exceção, para a execução
 * (os seguintes não rodam) e o `summary` mostra onde parou. Capturas de tela são responsabilidade do roteiro.
 */
export function makeReporter() {
  const steps = [];
  let cur = null;
  return {
    steps,
    async step(name, fn) {
      cur = { name, checks: [], status: 'PASS', error: null };
      steps.push(cur);
      console.log(`\n== ${name}`);
      try {
        await fn();
      } catch (e) {
        cur.checks.push({ name: 'exceção', ok: false, extra: e.message.split('\n')[0] });
        console.log(`  FALHA exceção: ${e.message.split('\n')[0]}`);
      }
      const bad = cur.checks.filter((c) => !c.ok);
      if (bad.length) {
        cur.status = 'FAIL';
        cur.error = bad.map((c) => `${c.name}${c.extra ? ` (${c.extra})` : ''}`).join('; ');
        throw new StepFailed(name, cur.error);
      }
    },
    check(name, ok, extra = '') {
      cur.checks.push({ name, ok: !!ok, extra: String(extra) });
      console.log(`  ${ok ? 'ok   ' : 'FALHA'} ${name}${extra !== '' ? ` (${extra})` : ''}`);
    },
    summary() {
      console.log('\n== RESUMO');
      for (const s of steps) {
        console.log(`${s.status === 'PASS' ? 'PASSOU ' : 'FALHOU '} ${s.name}${s.error ? `\n         -> ${s.error}` : ''}`);
      }
    },
  };
}

export class StepFailed extends Error {
  constructor(step, detail) {
    super(`passo "${step}": ${detail}`);
    this.name = 'StepFailed';
  }
}

/** Coordenadas de tela (da página) de um ponto de mundo, pela vista atual da planta. Lê o viewport do editor. */
export async function worldToPage(page, x, y) {
  const v = await page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    const vp = window.__hestia.editor.viewport();
    return { left: r.x, top: r.y, cx: vp.cx, cy: vp.cy, zoom: vp.zoom, width: vp.width, height: vp.height };
  });
  return { x: v.left + v.width / 2 + (x - v.cx) * v.zoom, y: v.top + v.height / 2 - (y - v.cy) * v.zoom };
}

/** Clique de mouse num ponto de mundo (move + click, como o flow.mjs). */
export async function clickWorld(page, x, y) {
  const p = await worldToPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(40);
}
