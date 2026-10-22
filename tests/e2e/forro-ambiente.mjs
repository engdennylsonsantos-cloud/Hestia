// Forro que acompanha o ambiente no app real (decisão 0023 §13, P-5): cria o ambiente e o forro "No ambiente", move uma
// parede (a área do forro acompanha), solta o forro (a área fica e a parede movida não muda mais) e revincula (volta a
// acompanhar). Sem erros de console. Código de saída 1 se algo falhou.
import { mkdirSync } from 'node:fs';
import { openApp, launch, makeReporter } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);
/** Espessura total do tipo de parede padrão (0,184 m): a área do forro pelo ambiente é (L − t) × (A − t). */
const T = 0.184;
const areaText = () => page.evaluate(() => {
  const lbl = [...document.querySelectorAll('.prow label')].find((l) => l.getAttribute('title') === 'Área');
  return lbl ? lbl.parentElement.querySelector('.val')?.textContent ?? '' : '';
});
const areaM2 = async () => Number.parseFloat((await areaText()).replace(',', '.'));
const stateText = () => page.evaluate(() => document.querySelector('#p-ceiling-outline')?.textContent ?? '');
const ceilingId = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).find((e) => e.kind === 'ceiling')?.id ?? null);
const roomCount = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'room').length);
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

await rep.step('criar paredes de um cômodo 4 × 3 m, o ambiente e o forro no ambiente', async () => {
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
  await page.waitForTimeout(300);
  const nWalls = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall').length);
  check('quatro paredes do cômodo desenhadas', nWalls === 4, `(${nWalls})`);
  const at = await screenOf(2, 1.5);
  await page.evaluate(() => { const { editor } = window.__hestia; editor.setTool('room'); });
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  check('ambiente criado clicando na sala', (await roomCount()) === 1);
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, ceilingMode: 'room' } }); editor.setTool('ceiling'); });
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  const id = await ceilingId();
  check('forro criado "No ambiente" (com vínculo ao ambiente)', id !== null && (await page.evaluate((fid) => window.__hestia.editor.project.elements[fid]?.roomId ?? null, id)) !== null);
  await page.evaluate((fid) => { const { editor, useUi } = window.__hestia; editor.setTool('select'); useUi.setState({ selection: [fid] }); }, id);
  await page.waitForTimeout(300);
  const a0 = await areaM2();
  check('área inicial é a do espaço livre entre as faces', Math.abs(a0 - (4 - T) * (3 - T)) < 0.02, `(${a0} m²)`);
  check('estado mostra que acompanha o ambiente', (await stateText()).startsWith('Acompanha o ambiente'), await stateText());
  await page.screenshot({ path: `${OUT}/90-forro-acompanha.png` });
});

await rep.step('mover uma parede: a área do forro acompanha o ambiente', async () => {
  await moveRight(5);
  await page.waitForTimeout(300);
  const a1 = await areaM2();
  check('área do forro muda ao mover a parede', Math.abs(a1 - (5 - T) * (3 - T)) < 0.02, `(${a1} m²)`);
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
  await page.screenshot({ path: `${OUT}/91-forro-solto.png` });
});

await rep.step('revincular ao ambiente: a área volta a acompanhar as paredes', async () => {
  await clickButton('Revincular ao ambiente');
  await page.waitForTimeout(200);
  const r = await areaM2();
  check('estado volta a acompanhar', (await stateText()).startsWith('Acompanha o ambiente'), await stateText());
  check('área volta a acompanhar a parede (6 m)', Math.abs(r - (6 - T) * (3 - T)) < 0.02, `(${r} m²)`);
  await page.screenshot({ path: `${OUT}/92-forro-revinculado.png` });
});

await browser.close();
rep.summary();
console.log(`erros do console: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
const bad = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(bad ? 1 : 0);
