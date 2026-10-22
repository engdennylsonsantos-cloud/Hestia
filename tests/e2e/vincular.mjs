// Vincular às paredes no app real (decisão 0023 §8.2a-b, §10 P-vincular): abre a casa de alto padrão, mostra o motivo
// quando o piso não casa com um circuito, vincula a laje do pavimento 2 (perímetro externo) depois de ver a prévia, move
// uma parede do pavimento 2 (a área acompanha) e desfaz (volta a estático). Sem erro de console. Código de saída 1 se falhou.
import { mkdirSync } from 'node:fs';
import { openApp, launch, makeReporter } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);
const NO_CIRCUIT = 'O contorno não corresponde a nenhum circuito de paredes.';

const select = (levelId, id) => page.evaluate(([lv, fid]) => {
  const { useUi } = window.__hestia;
  useUi.setState({ levelId: lv, selection: [fid] });
}, [levelId, id]);
const stateText = () => page.evaluate(() => document.querySelector('#p-outline-state')?.textContent ?? '');
const reasonText = () => page.evaluate(() => document.querySelector('#p-outline-reason')?.textContent ?? '');
const previewText = () => page.evaluate(() => document.querySelector('#link-outline-preview')?.textContent ?? '');
const clickButton = async (name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(250);
};
/** Área em planta da laje, como aparece no painel ("Área em planta", m²). */
const planArea = async () => {
  const t = await page.evaluate(() => {
    const lbl = [...document.querySelectorAll('.prow label, .prow .lbl, .prow span')].find((l) => l.textContent === 'Área em planta');
    return lbl ? lbl.parentElement.querySelector('.val')?.textContent ?? '' : '';
  });
  return Number.parseFloat(t.replace(',', '.'));
};
const outlineOf = (id) => page.evaluate((fid) => window.__hestia.editor.project.elements[fid]?.outlineSource ?? null, id);
/** Move as paredes do pavimento `levelId` cujo lado é o maior x para `x` (como a alça faria nos cantos). */
const moveEastWalls = (levelId, dx) => page.evaluate(([lv, d]) => {
  const { editor } = window.__hestia;
  const ws = Object.values(editor.project.elements).filter((e) => e.kind === 'wall' && e.levelId === lv);
  const side = Math.max(...ws.flatMap((w) => [w.a.x, w.b.x]));
  for (const w of ws) {
    const patch = {};
    if (Math.abs(w.a.x - side) < 1e-6) patch.a = { x: w.a.x + d, y: w.a.y };
    if (Math.abs(w.b.x - side) < 1e-6) patch.b = { x: w.b.x + d, y: w.b.y };
    if (Object.keys(patch).length) editor.store.exec({ type: 'updateElements', ids: [w.id], patch });
  }
}, [levelId, dx]);

await rep.step('casa de alto padrão: piso do térreo sem circuito mostra o motivo', async () => {
  await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('house-premium'); editor.zoomExtents(); });
  await page.waitForTimeout(400);
  await select('lv_0', 'F-T-02');
  await page.waitForTimeout(300);
  check('piso de modelo pronto mostra sem vínculo', (await stateText()).startsWith('Sem vínculo'), await stateText());
  await clickButton('Vincular às paredes');
  check('piso sem circuito mostra o motivo', (await reasonText()) === NO_CIRCUIT, await reasonText());
  check('piso sem circuito não abre a prévia', (await previewText()) === '');
  await page.keyboard.press('Escape');
});

await rep.step('laje do pavimento 2: prévia, confirmação e vínculo', async () => {
  await select('lv_1', 'L-P2-01');
  await page.waitForTimeout(300);
  const a0 = await planArea();
  check('área em planta inicial da laje (sem o poço de escada)', Math.abs(a0 - 166.69) < 0.05, `(${a0} m²)`);
  await clickButton('Vincular às paredes');
  const pv = await previewText();
  check('prévia mostra X m² para Y m² (Z%)', pv.startsWith('O contorno vai de 170,79 m² para 170,79 m² (0,0%). Vincular?'), pv);
  await page.screenshot({ path: `${OUT}/90-vincular-previa.png` });
  await clickButton('Confirmar');
  const src = await outlineOf('L-P2-01');
  check('laje grava a origem pelo perímetro externo', src?.mode === 'perimeter' && src?.linked === true, JSON.stringify(src));
  check('estado mostra vínculo às paredes', (await stateText()).startsWith('Vinculado às paredes (modo: perímetro externo)'), await stateText());
});

await rep.step('desfazer e refazer o vínculo', async () => {
  await page.evaluate(() => window.__hestia.editor.store.undo());
  await page.waitForTimeout(300);
  check('origem sumiu depois de desfazer', (await outlineOf('L-P2-01')) === null);
  check('estado volta a sem vínculo', (await stateText()).startsWith('Sem vínculo'), await stateText());
  await page.evaluate(() => window.__hestia.editor.store.redo());
  await page.waitForTimeout(300);
  check('refazer religa o vínculo', (await outlineOf('L-P2-01'))?.linked === true);
});

await rep.step('mover uma parede do pavimento 2: a área acompanha', async () => {
  const a0 = await planArea();
  await moveEastWalls('lv_1', 1);
  await page.waitForTimeout(300);
  const a1 = await planArea();
  check('área cresce ao mover o lado leste em 1 m', a1 - a0 > 13.5 && a1 - a0 < 15, `(${a0} → ${a1} m²)`);
  await page.screenshot({ path: `${OUT}/91-vincular-parede-movida.png` });
});

await browser.close();
rep.summary();
console.log(`erros do console: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
const bad = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(bad ? 1 : 0);
