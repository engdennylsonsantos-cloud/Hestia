// Capturas "antes" e "depois" do plano de unidades e cotas (F2). Roda contra um build já feito:
//   node tests/e2e/capturas-plano-unidades.mjs <pasta dist> <pasta de saída> <prefixo antes|depois> <modo antes|depois>
// Cada captura é da página inteira, na mesma vista e zoom, para o dono comparar. Não usa GPU real: WebGL2 via SwiftShader.
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { launch, TOOL_SEQ } from './helpers.mjs';

const [distArg, outArg, prefixArg, modoArg] = process.argv.slice(2);
const DIST = path.resolve(distArg ?? 'apps/web/dist');
const OUT = path.resolve(outArg ?? 'docs/plano-unidades-cotas/capturas');
const PREFIX = prefixArg ?? 'depois';
const MODO = modoArg ?? 'depois';
const FIXTURE = path.resolve(process.env.FIXTURE ?? 'packages/engine/src/fixtures/casa-2-quartos.hestia.json');
mkdirSync(OUT, { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = (name) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`) });
const pause = (ms) => page.waitForTimeout(ms);
const worldToPage = async (x, y) => {
  const v = await page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    const vp = window.__hestia.editor.viewport();
    return { left: r.x, top: r.y, width: r.width, height: r.height, cx: vp.cx, cy: vp.cy, zoom: vp.zoom };
  });
  return { x: v.left + v.width / 2 + (x - v.cx) * v.zoom, y: v.top + v.height / 2 - (y - v.cy) * v.zoom };
};
const clickWorld = async (x, y) => {
  const p = await worldToPage(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await pause(60);
};
const fixPlanView = () => page.evaluate(() => {
  const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
  window.__hestia.editor.setViewport({ cx: 5, cy: 3.5, zoom: 60, width: Math.round(r.width), height: Math.round(r.height) });
});

try {
  await page.goto(pathToFileURL(path.join(DIST, 'index.html')).href + '?debug=1');
  await page.waitForSelector('.canvas-wrap canvas');
  await page.waitForFunction(() => window.__hestia);
  await pause(400);

  await page.setInputFiles('#file-open', FIXTURE);
  await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json', null, { timeout: 15000 });
  await pause(400);
  await page.getByRole('tab', { name: /Térreo/ }).click().catch(() => {});
  await pause(300);
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  await fixPlanView();
  await pause(500);

  // 1) Planta com paredes, porta e janela e as cotas temporárias da porta selecionada.
  const doorId = await page.evaluate(() => {
    const els = Object.values(window.__hestia.editor.store.project.elements);
    return (els.find((e) => e.id === 'to_1') ?? els.find((e) => e.kind === 'door'))?.id ?? null;
  });
  if (!doorId) throw new Error('porta não encontrada no projeto de exemplo');
  await page.evaluate((id) => window.__hestia.useUi.setState({ selection: [id] }), doorId);
  await pause(500);
  await shot('planta-selecao');

  // 2) Planta com cotas permanentes: ferramenta Cota, dois pontos da parede sul e o afastamento abaixo da casa.
  for (const k of ['d', 'i']) await page.keyboard.press(k);
  await pause(200);
  await clickWorld(0, 0);
  await clickWorld(10, 0);
  await clickWorld(5, -1.1);
  await pause(400);
  await page.keyboard.press('Escape');
  await pause(300);
  await shot('planta-cotas');

  // 3) Vista 3D.
  await page.evaluate(() => {
    const { editor, useUi } = window.__hestia;
    editor.setView('3d');
    const s = useUi.getState();
    if (!s.openViews.some((v) => v.kind === '3d')) useUi.setState({ openViews: [...s.openViews, { kind: '3d' }] });
  });
  await pause(1200);
  await shot('3d');

  // 4) Corte: cria a marca e abre a vista de corte.
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.setView('plan');
    editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', kind: 'section', a: { x: 4.5, y: -2 }, b: { x: 4.5, y: 12 }, depth: 14 } });
    editor.generateElevations();
  });
  await pause(500);
  await shot('planta-marca-corte');
  await page.evaluate(() => window.__hestia.editor.openSection('sv1'));
  await pause(1200);
  await shot('corte');

  if (MODO === 'depois') {
    // 5) Volta à planta e troca as unidades para ft-in pelo diálogo "Unidades…" aberto pelo atalho UN.
    await page.evaluate(() => window.__hestia.editor.setView('plan'));
    await pause(300);
    await page.getByRole('tab', { name: /Térreo/ }).click().catch(() => {});
    await pause(300);
    await page.evaluate(() => window.__hestia.editor.setTool('select'));
    await fixPlanView();
    await pause(300);
    for (const k of ['u', 'n']) await page.keyboard.press(k);
    await pause(400);
    const abreUn = await page.locator('#un-length').isVisible().catch(() => false);
    console.log(`atalho UN abre o diálogo Unidades: ${abreUn ? 'ok' : 'FALHA'}`);
    await page.selectOption('#un-length', 'ft-in');
    await page.selectOption('#un-area', 'ft2');
    await pause(200);
    await shot('dialogo-unidades-ftin');
    await page.getByRole('button', { name: 'OK' }).click();
    await pause(500);
    await shot('planta-ftin');

    // 6) Botão H do menu Arquivo: abre e fecha.
    const h = page.getByRole('button', { name: 'Menu Arquivo' });
    await h.click();
    await pause(400);
    const aberto = await page.locator('.fm').isVisible().catch(() => false);
    await shot('menu-arquivo-aberto');
    await h.click();
    await pause(400);
    const fechado = !(await page.locator('.fm').isVisible().catch(() => false));
    console.log(`botão H abre: ${aberto ? 'ok' : 'FALHA'} | fecha: ${fechado ? 'ok' : 'FALHA'}`);
  }
} catch (e) {
  console.log(`FALHA: ${e.stack ?? e.message}`);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}-erro.png`) }).catch(() => {});
  errors.push(String(e.message));
} finally {
  console.log(`erros de console: ${errors.length ? errors.join(' | ') : 'nenhum'}`);
  await browser.close();
}

process.exit(errors.length && !errors.every((e) => /favicon/i.test(e)) ? 1 : 0);
