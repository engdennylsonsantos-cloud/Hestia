// Capturas da frente "escada livre/rampa" (2026-10-30): modal do tipo de escada nos 3 estilos, modal do tipo de rampa
// (corte e planta), as duas prévias recortadas e uma escada livre escolhida PELO SELETOR (sem forçar o estado).
//   CHROME_PATH=<chromium> SHOTS=<pasta> node tests/e2e/capturas-escada-final.mjs
// Usa o build de produção (`npm run build`), como os outros e2e (helpers.mjs).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { clickWorld, launch, makeReporter, openApp, pressTool } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'docs/handoff/escada-livre/capturas-final';
mkdirSync(OUT, { recursive: true });

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser, { width: 1440, height: 900 });
const shot = (name, target) => (target ?? page.locator('body')).screenshot({ path: path.join(OUT, name) });
const dialog = () => page.locator('[role=dialog]');

/** Abre um diálogo de tipo pela loja da interface, como o botão "Editar tipo" faz. */
const openType = (kind, id) =>
  page.evaluate(({ kind, id }) => window.__hestia.useUi.setState({ dialog: kind, dialogArg: id }), { kind, id });

/** Recorta o cartão da prévia (o primeiro filho da coluna direita), sem a calculadora/tabela. */
const previewBox = (side) => page.locator(`${side} > div:first-child`);

const fixPlanView = () =>
  page.evaluate(() => {
    const { editor } = window.__hestia;
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    editor.setViewport({ cx: 9.3, cy: 2.5, zoom: 28, width: Math.round(r.width), height: Math.round(r.height) });
  });

const statusText = () => page.locator('footer.statusbar .msg').innerText();

try {
  await rep.step('1 · Modal do tipo de escada nos 3 estilos (janela inteira)', async () => {
    await openType('stairType', 'stt_monolitica');
    await page.waitForSelector('#stt-runStyle');
    await page.waitForTimeout(400);
    for (const [style, underline, name] of [
      ['monolithic', 'smooth', '01-escada-monolitica-lisa'],
      ['monolithic', 'stepped', '02-escada-monolitica-escalonada'],
      ['assembled', 'smooth', '03-escada-montada'],
    ]) {
      await page.locator('#stt-runStyle').selectOption(style);
      if (style === 'monolithic') await page.locator('#stt-undersideStyle').selectOption(underline).catch(() => {});
      await page.waitForTimeout(350);
      const box = await dialog().boundingBox();
      rep.check(`${name}: modal ocupa a altura da janela`, !!box && box.height > 700, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'sem caixa');
      await shot(`${name}.png`, page.locator('body'));
      await previewBox('.stt-side').screenshot({ path: path.join(OUT, `${name}-previa.png`) });
    }
    await dialog().getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(200);
  });

  await rep.step('2 · Modal do tipo de rampa: corte, planta e a norma visível', async () => {
    await openType('rampType', 'rmt_nbr9050');
    await page.waitForSelector('#rt-profile');
    await page.waitForTimeout(400);
    const box = await dialog().boundingBox();
    rep.check('modal da rampa ocupa a altura da janela', !!box && box.height > 700, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'sem caixa');
    rep.check('duas colunas (grade .rtt-grid)', (await page.locator('.rtt-grid').count()) === 1);
    await shot('04-rampa-modal-corte.png');
    await previewBox('.rtt-side').screenshot({ path: path.join(OUT, '05-rampa-previa-corte.png') });
    // O corte é o padrão: a prévia não pode sair da caixa (o texto "h = 0,80 m"/"máx. 0,80 m" era cortado à direita).
    const clip = await page.evaluate(() => {
      const card = document.querySelector('.rtt-side > div:first-child');
      const svg = card?.querySelector('svg');
      if (!card || !svg) return null;
      const c = card.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      return { card: Math.round(c.width), svg: Math.round(s.width), contained: s.width <= c.width + 1 };
    });
    rep.check('prévia do corte cabe na coluna (sem corte à direita)', !!clip && clip.contained, JSON.stringify(clip));
    await page.getByRole('tab', { name: 'Planta' }).click();
    await page.waitForTimeout(300);
    await shot('06-rampa-modal-planta.png');
    await previewBox('.rtt-side').screenshot({ path: path.join(OUT, '07-rampa-previa-planta.png') });
    // rola até o fim para mostrar a tabela de norma (era o trecho cortado)
    await dialog().locator('.rtt-norm').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot('08-rampa-modal-norma.png');
    await dialog().getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(200);
  });

  await rep.step('3 · Escada livre escolhida PELO SELETOR "Forma" (Propriedades) e desenhada', async () => {
    await pressTool(page, 'q');
    await page.waitForSelector('#place-run-shape', { timeout: 20000 });
    await page.waitForTimeout(300);
    const nomes = await page.locator('#place-run-shape option').evaluateAll((os) => os.map((o) => `${o.value}:${o.textContent}`));
    rep.check("o seletor de Forma oferece 'free' rotulado Livre", nomes.includes('free:Livre'), nomes.join(' | '));
    await page.locator('#place-run-shape').selectOption('free');
    await page.waitForTimeout(150);
    rep.check('forma ativa é free (escolhida no seletor)', (await page.locator('#place-run-shape').inputValue()) === 'free');
    rep.check('escolher Livre mostra a largura e o patamar, e esconde o giro',
      (await page.locator('#place-run-width').count()) === 1 &&
      (await page.locator('#place-run-landing').count()) === 1 &&
      (await page.locator('#place-run-turn').count()) === 0);
    await shot('09-propriedades-forma-livre.png');
    await fixPlanView();
    // 3 cliques + a dobra: o 1º trecho fica mais curto que a escada inteira, então o giro vira 1 patamar e sobram 2 lances.
    await clickWorld(page, 1, 1);
    await clickWorld(page, 4, 1);
    await clickWorld(page, 4, 4.5);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const msg = await statusText();
    rep.check('mensagem da escada livre (espelhos e lances)', /espelhos/.test(msg) && /lance/.test(msg), msg.slice(0, 140));
    const s = await page.evaluate(() => {
      const { editor } = window.__hestia;
      const st = Object.values(editor.project.elements).filter((e) => e.kind === 'stair');
      const stair = st[0];
      return {
        n: st.length,
        generatedBy: stair?.components.find((c) => c.generatedBy)?.generatedBy ?? null,
        freePath: stair?.freePath?.length ?? 0,
        runs: stair?.components.filter((c) => c.kind === 'run').length ?? 0,
        landings: stair?.components.filter((c) => c.kind === 'landing').length ?? 0,
      };
    });
    rep.check('escada livre criada pela ferramenta (generatedBy free, com trajeto)',
      s.n === 1 && s.generatedBy === 'free' && s.freePath >= 3 && s.runs === 2 && s.landings === 1, JSON.stringify(s));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await shot('10-escada-livre-planta.png');
  });

  await rep.step('5 · Sem erros de console ou de página', async () => {
    rep.check('nenhum erro de console/página', errors.length === 0, errors.slice(0, 3).join(' | '));
  });
} catch (e) {
  console.log(`\nFALHA INESPERADA: ${e.stack ?? e.message}`);
  await page.screenshot({ path: path.join(OUT, 'erro.png') }).catch(() => {});
  rep.summary();
  await browser.close();
  process.exit(1);
}

rep.summary();
const falhas = rep.steps.filter((s) => s.status === 'FAIL').length;
console.log(falhas ? `\nFALHOU: ${falhas} de ${rep.steps.length} passos.` : `\nTodos os ${rep.steps.length} passos confirmados.`);
console.log(`Imagens em: ${path.resolve(OUT)}`);
await browser.close();
process.exit(falhas ? 1 : 0);
