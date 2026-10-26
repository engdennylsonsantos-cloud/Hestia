// Auxiliares dos testes e2e de navegador: mesmo navegador e flags do flow.mjs (WebGL2 via SwiftShader, sem `playwright install`),
// abertura do build de produção por file:// e um relatório passo a passo com código de saída.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const CHROME_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Chromium do sistema (o mesmo que os outros e2e usam). `CHROME_PATH` (definido no ambiente) tem prioridade. */
export const chromeExecutable = () => [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));

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
 * Relatório: cada passo tem verificações (`check`). Um passo com verificação falha, ou que lança exceção, é registrado e a
 * execução segue (para mostrar todos os problemas de uma vez); o `summary` lista cada passo e o código de saída é 1 se
 * qualquer um falhou. Capturas de tela são responsabilidade do roteiro.
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


/** Sequências de teclas do perfil de atalhos padrão (Revit, duas letras) para as ferramentas que os roteiros acionam. */

export const TOOL_SEQ = { w: 'wa', d: 'dr', j: 'wn', m: 'mv', r: 'ro', k: 'ct', b: 'lj', q: 'le', i: 'es' };



/**

 * Aciona uma ferramenta pela letra que os roteiros antigos usavam. Com o atalho em sequência, digita as duas teclas; `v` (Selecionar) não tem

 * tecla: Esc cancela o passo e Esc de novo volta à seleção.

 */

export async function pressTool(page, letter) {

  if (letter === 'v') {

    await page.keyboard.press('Escape');

    await page.keyboard.press('Escape');

    return;

  }

  const seq = TOOL_SEQ[letter];

  if (!seq) throw new Error(`sem sequência de atalho para '${letter}'`);

  for (const k of seq) await page.keyboard.press(k);

}


/**
 * Desenha um perímetro pelo modo "Criar/Editar perímetro", sem cliques: abre o modo para o alvo (`floor`, `slab`, `ceiling`
 * ou `roof`), carrega um rascunho de uma linha por lado (anel `pontos`, em metros, na ordem do contorno) e conclui. Em
 * `inclina(i, a, b)` diz se o lado i define inclinação (só telhado; ausente = todos, como o padrão do modo). Devolve
 * `{ ok, msg }`: `ok` é se o modo fechou, `msg` a mensagem da barra. Em recusa, o modo é cancelado. As opções de tipo e
 * balanço vêm das opções da ferramenta (`useUi.options`), como ao começar o modo pela faixa.
 */
export async function perimetroPorPontos(page, alvo, pontos, { inclina = () => true } = {}) {
  const flags = pontos.map((a, i) => inclina(i, a, pontos[(i + 1) % pontos.length]));
  return page.evaluate(({ alvo, pontos, flags }) => {
    const { editor, useUi } = window.__hestia;
    editor.perimetro.begin(alvo);
    const segs = pontos.map((a, i) => {
      const b = pontos[(i + 1) % pontos.length];
      return { id: `e2e${i}`, a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, definesSlope: flags[i] };
    });
    editor.activeTool.loadDraft({ target: alvo, segs, selected: [], defaults: { definesSlope: true, slopePct: 30, overhang: 0.5 } });
    editor.perimetro.finish();
    const ok = !editor.perimetro.ativo;
    const msg = useUi.getState().status;
    if (!ok) editor.perimetro.cancel();
    return { ok, msg };
  }, { alvo, pontos, flags });
}

/**
 * Abre a vista 3D como a barra de vistas faz: a tela passa a 3D e a aba "Modelo 3D" entra na lista de vistas abertas (o padrão
 * de um projeto é só a planta, então a aba não existe antes disso).
 */
export async function abreVista3d(page) {
  await page.evaluate(() => {
    const { editor, useUi } = window.__hestia;
    editor.setView('3d');
    const s = useUi.getState();
    if (!s.openViews.some((v) => v.kind === '3d')) useUi.setState({ openViews: [...s.openViews, { kind: '3d' }] });
  });
  await page.waitForTimeout(300);
}
