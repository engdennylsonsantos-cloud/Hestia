// Gráficos de vista ponta a ponta (decisão 0015): propriedades da planta e do 3D, estilos visuais, escala, sombras/arestas
// pelo projeto (desfazer), restaurar padrão. Gera imagens em $SHOTS para inspeção.
//   npm run build && SHOTS=<pasta> node tests/e2e/graficos.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, makeReporter, openApp } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/graficos';
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser);
const shot = (name) => page.locator('.canvas-wrap').screenshot({ path: path.join(OUT, name) });
const lvl = () => page.evaluate(() => window.__hestia.editor.project.levels.find((l) => l.id === 'lv_0').graphics ?? null);
const v3 = () => page.evaluate(() => window.__hestia.editor.project.view3d ?? null);
const fixPlanView = () => page.evaluate(() => {
  const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
  window.__hestia.editor.setViewport({ cx: 5, cy: 3.5, zoom: 60, width: Math.round(r.width), height: Math.round(r.height) });
});

try {
  await rep.step('1 · Abrir a casa: grupo "Gráficos da vista" com padrões', async () => {
    await page.setInputFiles('#file-open', FIXTURE);
    await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /Térreo/ }).click();
    await page.waitForTimeout(250);
    await fixPlanView();
    await page.waitForTimeout(200);
    rep.check('select de estilo visual visível', await page.locator('#lg-style').isVisible());
    rep.check('estilo padrão = hiddenLine', (await page.locator('#lg-style').inputValue()) === 'hiddenLine');
    rep.check('escala padrão 100', (await page.locator('#lg-scale').inputValue()) === '100');
    rep.check('nada salvo no nível (usa padrão)', (await lvl()) === null);
    await shot('01-planta-hiddenline.png');
  });

  await rep.step('2 · Estilo aramado e sombreado na planta', async () => {
    await page.locator('#lg-style').selectOption('wireframe');
    await page.waitForTimeout(300);
    rep.check('gravou wireframe', (await lvl())?.style === 'wireframe', JSON.stringify(await lvl()));
    await shot('02-planta-aramado.png');
    await page.locator('#lg-style').selectOption('shaded');
    await page.waitForTimeout(300);
    rep.check('gravou shaded', (await lvl())?.style === 'shaded');
    await shot('03-planta-sombreado.png');
  });

  await rep.step('3 · Escala 1:50 engrossa as linhas (peso de papel) e desfazer volta', async () => {
    await page.locator('#lg-style').selectOption('hiddenLine');
    await page.locator('#lg-scale').selectOption('50');
    await page.waitForTimeout(300);
    rep.check('escala gravada em 50', (await lvl())?.scale === 50, JSON.stringify(await lvl()));
    await shot('04-planta-1-50.png');
    await page.locator('#lg-scale').selectOption('200');
    await page.waitForTimeout(300);
    await shot('05-planta-1-200.png');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    rep.check('desfazer volta a escala 50', (await lvl())?.scale === 50, JSON.stringify(await lvl()));
  });

  await rep.step('4 · Restaurar padrão da vista', async () => {
    await page.getByRole('button', { name: /^Restaurar padrão$/ }).click();
    await page.waitForTimeout(300);
    rep.check('nível sem gráficos salvos', (await lvl()) === null, JSON.stringify(await lvl()));
    rep.check('escala volta a 100', (await page.locator('#lg-scale').inputValue()) === '100');
  });

  await rep.step('5 · 3D: estilos visuais (grupo "Gráficos do 3D")', async () => {
    await page.getByRole('tab', { name: /Modelo 3D/ }).click();
    await page.waitForTimeout(1500);
    rep.check('select do estilo 3D visível', await page.locator('#v3-style').isVisible());
    rep.check('padrão realista', (await page.locator('#v3-style').inputValue()) === 'realistic');
    await page.evaluate(() => { const o = window.__hestia3d; o.target.set(5, 3.5, 1.2); o.distance = 17; o.azimuth = 0.9; o.elevation = 0.55; o.apply(); });
    for (const st of ['realistic', 'shaded', 'consistentColors', 'hiddenLine', 'wireframe']) {
      await page.locator('#v3-style').selectOption(st);
      await page.mouse.move(400, 300);
      await page.mouse.wheel(0, 1);
      await page.waitForTimeout(700);
      rep.check(`estilo ${st} gravado`, ((await v3())?.style ?? 'realistic') === st, JSON.stringify(await v3())?.slice(0, 60));
      await shot(`3d-${st}.png`);
    }
  });

  await rep.step('6 · 3D: sombras e arestas no projeto, desfazer, restaurar', async () => {
    await page.locator('#v3-style').selectOption('realistic');
    await page.waitForTimeout(300);
    await page.locator('#v3-edges').uncheck();
    await page.waitForTimeout(300);
    rep.check('arestas desligadas gravadas', (await v3())?.edges === false, JSON.stringify(await v3())?.slice(0, 80));
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    rep.check('desfazer religa as arestas (padrão = ligadas)', ((await v3())?.edges ?? true) === true, JSON.stringify({ e: (await v3())?.edges, s: (await v3())?.style, canUndo: await page.evaluate(() => window.__hestia.editor.store.canUndo) }));
    await page.getByRole('button', { name: /^Restaurar padrão$/ }).click();
    await page.waitForTimeout(300);
    rep.check('vista 3D sem campo salvo', (await v3()) === null, JSON.stringify(await v3())?.slice(0, 80));
  });

  await rep.step('7 · Diálogo "Visibilidade e gráficos" oculta a categoria Janela na planta', async () => {
    await page.getByRole('tab', { name: /Planta|Térreo/ }).first().click().catch(() => {});
    await page.getByRole('tab', { name: /Térreo/ }).click();
    await page.waitForTimeout(250);
    await fixPlanView();
    await page.getByRole('button', { name: /Visibilidade e gráficos/ }).click();
    await page.waitForTimeout(300);
    const dlg = page.getByRole('dialog');
    rep.check('diálogo aberto', await dlg.isVisible().catch(() => false));
    const row = dlg.locator('tr', { hasText: 'Janela' });
    await row.locator('input[type="checkbox"]').first().uncheck();
    await page.waitForTimeout(300);
    rep.check('janela oculta gravada', (await lvl())?.overrides?.window?.visible === false, JSON.stringify((await lvl())?.overrides?.window));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot('06-planta-sem-janelas.png');
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
