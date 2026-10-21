// Intervalo de vista da planta ponta a ponta na interface real (decisão 0013): campos nas propriedades da vista, recusa de
// valores inválidos, avisos de elementos fora do intervalo, desfazer e imagens da planta em vários planos de corte.
//   npm run build && SHOTS=<pasta> node tests/e2e/vista-planta.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, makeReporter, openApp } from './helpers.mjs';
import { checkShot } from './visual.mjs';

const OUT = process.env.SHOTS ?? 'test-results/vista-planta';
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser);
const shot = (name) => page.locator('.canvas-wrap').screenshot({ path: path.join(OUT, name) });
// Captura comparada com tests/e2e/baseline (G6); as demais (cortes 1,60 / erro / padrão) seguem só como imagem.
const snap = (name) => checkShot(rep, page.locator('.canvas-wrap'), name, { out: OUT });
const range = () => page.evaluate(() => {
  const { editor } = window.__hestia;
  return editor.project.levels.find((l) => l.id === 'lv_0').viewRange;
});
const field = (id) => page.locator(`#${id}`);
const setField = async (id, v) => {
  const f = field(id);
  await f.fill(String(v));
  await f.press('Enter');
  await page.waitForTimeout(250);
};
const fixPlanView = () => page.evaluate(() => {
  const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
  window.__hestia.editor.setViewport({ cx: 5, cy: 3.5, zoom: 60, width: Math.round(r.width), height: Math.round(r.height) });
});

try {
  await rep.step('1 · Abrir a casa e achar o grupo "Intervalo de vista" (padrão do Revit)', async () => {
    await page.setInputFiles('#file-open', FIXTURE);
    await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /Térreo/ }).click();
    await page.waitForTimeout(250);
    await fixPlanView();
    await page.waitForTimeout(200);
    const r = await range();
    rep.check('padrão topo 2,30 / corte 1,20 / base 0 / profundidade 0', r.top === 2.3 && r.cut === 1.2 && r.bottom === 0 && r.depth === 0 && r.direction === 'down', JSON.stringify(r));
    rep.check('campo "Plano de corte" visível', await field('vr-cut').isVisible());
    await snap('01-corte-1_20');
  });

  await rep.step('2 · Corte baixo (0,50 m): janelas de peitoril 1,00 e 1,10 ficam acima do corte (tracejadas, parede inteira)', async () => {
    await setField('vr-cut', 0.5);
    const r = await range();
    rep.check('corte gravado em 0,5', r.cut === 0.5, JSON.stringify(r));
    await snap('02-corte-0_50');
  });

  await rep.step('3 · Corte alto (1,60 m): janela de peitoril 1,50 (alt 0,60) fica cortada', async () => {
    await setField('vr-cut', 1.6);
    const r = await range();
    rep.check('corte gravado em 1,6', r.cut === 1.6, JSON.stringify(r));
    await shot('03-corte-1_60.png');
  });

  await rep.step('4 · Valor inválido é recusado com mensagem e não grava', async () => {
    await setField('vr-top', 1.0);
    const r = await range();
    rep.check('topo continua 2,30', r.top === 2.3, JSON.stringify(r));
    rep.check('mensagem de erro visível', await page.locator('.vr-error').isVisible());
    await shot('04-erro.png');
  });

  await rep.step('5 · Topo baixo (0,80 m, corte 0,50 m): aviso de elementos fora do intervalo', async () => {
    await setField('vr-cut', 0.5);
    await setField('vr-top', 0.8);
    const r = await range();
    rep.check('topo gravado em 0,8', r.top === 0.8, JSON.stringify(r));
    const msgs = await page.locator('.vr-msg').allInnerTexts();
    rep.check('aviso lista elementos ocultos', msgs.length > 0, msgs.join(' | '));
    await snap('05-topo-0_80');
  });

  await rep.step('6 · Desfazer devolve o topo anterior; restaurar padrão volta a 2,30 / 1,20', async () => {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const antes = await range();
    rep.check('desfazer: topo volta a 2,30', antes.top === 2.3, JSON.stringify(antes));
    await page.getByRole('button', { name: /Restaurar intervalo padrão/ }).click();
    await page.waitForTimeout(250);
    const r = await range();
    rep.check('restaurar: padrão', r.top === 2.3 && r.cut === 1.2 && r.bottom === 0, JSON.stringify(r));
    await shot('06-padrao.png');
  });

  await rep.step('7 · Direção "Para cima" está desabilitada (reservada)', async () => {
    const dis = await page.locator('#vr-dir option[value="up"]').evaluate((o) => o.disabled);
    rep.check('opção "up" desabilitada', dis === true);
  });

  await rep.step('8 · Sem erros de console ou de página', async () => {
    rep.check('nenhum erro de console/página', errors.length === 0, errors.slice(0, 3).join(' | '));
  });
} catch (e) {
  console.log(`\nFALHA INESPERADA: ${e.stack ?? e.message}`);
  await page.screenshot({ path: path.join(OUT, 'erro-inesperado.png') }).catch(() => {});
  rep.summary();
  await browser.close();
  process.exit(1);
}

rep.summary();
const falhas = rep.steps.filter((s) => s.status === 'FAIL').length;
console.log(falhas ? `\nFALHOU: ${falhas} de ${rep.steps.length} passos (ver acima).` : `\nTodos os ${rep.steps.length} passos confirmados.`);
console.log(`Imagens em: ${path.resolve(OUT)}`);
await browser.close();
process.exit(falhas ? 1 : 0);
