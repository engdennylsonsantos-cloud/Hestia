// Contorno associativo de piso no app real (decisão 0023 §8.2, §9.2): cria o piso pelas paredes, move uma parede (a área
// acompanha), desvincula (a área fica) e revincula (volta a acompanhar). Sem erros de console. Código de saída 1 se algo falhou.
import { mkdirSync } from 'node:fs';
import { openApp, launch, makeReporter } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);
/** Espessura total do tipo de parede padrão (0,184 m): a área do piso pelas paredes é (L − t) × (A − t). */
const T = 0.184;
const areaText = () => page.evaluate(() => {
  const lbl = [...document.querySelectorAll('.prow label')].find((l) => l.getAttribute('title') === 'Área líquida');
  return lbl ? lbl.parentElement.querySelector('.val')?.textContent ?? '' : '';
});
const areaM2 = async () => {
  const t = await areaText();
  return Number.parseFloat(t.replace(',', '.'));
};
const stateText = () => page.evaluate(() => document.querySelector('#p-outline-state')?.textContent ?? '');
const floorId = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).find((e) => e.kind === 'floor')?.id ?? null);
/** Move o lado direito do cômodo (o maior x atual) para `x`: as paredes que tocam esse lado levam as pontas, como a alça faria. */
const moveRight = (x) => page.evaluate((nx) => {
  const { editor } = window.__hestia;
  const ws = Object.values(editor.project.elements).filter((e) => e.kind === 'wall');
  const side = Math.max(...ws.flatMap((w) => [w.a.x, w.b.x]));
  for (const w of ws) {
    const patch = {};
    if (Math.abs(w.a.x - side) < 1e-6) patch.a = { x: nx, y: w.a.y };
    if (Math.abs(w.b.x - side) < 1e-6) patch.b = { x: nx, y: w.b.y };
    if (Object.keys(patch).length) editor.store.exec({ type: 'updateElements', ids: [w.id], patch });
  }
}, x);
const clickButton = async (name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(250);
};

await rep.step('criar piso pelas paredes de um cômodo 4 × 3 m', async () => {
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; editor.newProject('blank'); useUi.setState({ options: { ...useUi.getState().options, wallShape: 'rect' } }); editor.setTool('wall'); });
  await page.waitForTimeout(300);
  const screenOf = (wx, wy) => page.evaluate(([x, y]) => {
    const { editor } = window.__hestia;
    const r = document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
    const v = editor.ensureViewport(r.width, r.height);
    return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
  }, [wx, wy]);
  const c0 = await screenOf(0, 0);
  const c1 = await screenOf(4, 3);
  await page.mouse.move(c0.x, c0.y); await page.mouse.click(c0.x, c0.y); await page.waitForTimeout(80);
  await page.mouse.move(c1.x, c1.y); await page.mouse.click(c1.x, c1.y); await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const { editor } = window.__hestia; editor.zoomExtents(); });
  const nWalls = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall').length);
  check('quatro paredes do cômodo desenhadas', nWalls === 4, `(${nWalls})`);
  await page.waitForTimeout(300);
  const at = await screenOf(2, 1.5);
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, floorMode: 'walls' } }); editor.setTool('floor'); });
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  const id = await floorId();
  check('piso criado clicando na sala (modo paredes)', id !== null);
  const src = await page.evaluate((fid) => window.__hestia.editor.project.elements[fid]?.outlineSource ?? null, id);
  check('piso guarda a origem pelas paredes (face de acabamento, vinculado)', src?.mode === 'walls-finish' && src?.linked === true, JSON.stringify(src));
  await page.evaluate((fid) => { const { editor, useUi } = window.__hestia; editor.setTool('select'); useUi.setState({ selection: [fid] }); }, id);
  await page.waitForTimeout(300);
  const a0 = await areaM2();
  check('área inicial é a do espaço livre entre as faces', Math.abs(a0 - (4 - T) * (3 - T)) < 0.02, `(${a0} m²)`);
  check('estado mostra vínculo às paredes', (await stateText()).startsWith('Vinculado às paredes'), await stateText());
  await page.screenshot({ path: `${OUT}/80-contorno-vinculado.png` });
});

await rep.step('mover uma parede: a área do piso acompanha', async () => {
  await moveRight(5);
  await page.waitForTimeout(300);
  const a1 = await areaM2();
  check('área muda ao mover a parede', Math.abs(a1 - (5 - T) * (3 - T)) < 0.02, `(${a1} m²)`);
});

await rep.step('desvincular: a área fica e a parede movida não muda mais', async () => {
  await clickButton('Desvincular');
  const solto = await areaM2();
  check('estado vira estático', (await stateText()).startsWith('Estático'), await stateText());
  check('área não muda ao desvincular', Math.abs(solto - (5 - T) * (3 - T)) < 0.02, `(${solto} m²)`);
  await moveRight(6);
  await page.waitForTimeout(300);
  const depois = await areaM2();
  check('área não muda ao mover a parede depois de desvincular', Math.abs(depois - solto) < 0.005, `(${depois} m²)`);
  await page.screenshot({ path: `${OUT}/81-contorno-estatico.png` });
});

await rep.step('revincular: a área volta a acompanhar as paredes', async () => {
  await clickButton('Revincular às paredes');
  await page.waitForTimeout(200);
  const r = await areaM2();
  check('estado volta a vinculado', (await stateText()).startsWith('Vinculado às paredes'), await stateText());
  check('área volta a acompanhar a parede (6 m)', Math.abs(r - (6 - T) * (3 - T)) < 0.02, `(${r} m²)`);
  await page.screenshot({ path: `${OUT}/82-contorno-revinculado.png` });
});

await browser.close();
rep.summary();
console.log(`erros do console: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
const bad = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(bad ? 1 : 0);
