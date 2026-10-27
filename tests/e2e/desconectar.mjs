// Opção "Desconectar" (Revit) nas ferramentas de transformação de paredes, no app real: duas paredes em L; Mover e
// Rotacionar com a opção desligada (a vizinha acompanha e se estica) e ligada (a vizinha fica e a ponta se solta).
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, makeReporter, openApp } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/desconectar';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;
let ids = null;

const paredes = () => page.evaluate(() => {
  const { editor } = window.__hestia;
  return Object.values(editor.project.elements)
    .filter((e) => e.kind === 'wall')
    .map((w) => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y } }));
});
const daParede = (ws, id) => ws.find((w) => w.id === id);
const igual = (p, x, y) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;
const selecao = () => page.evaluate(() => window.__hestia.useUi.getState().selection);
const ferramenta = (id) => page.evaluate((t) => window.__hestia.editor.setTool(t), id);

await rep.step('duas paredes em L e a parede A selecionada', async () => {
  await page.evaluate(() => window.__hestia.editor.newProject('blank'));
  // O projeto novo zera as vistas: espera o canvas recriar o viewport antes de converter mundo em tela.
  await page.waitForFunction(() => window.__hestia.editor.viewport() !== null);
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await page.waitForTimeout(300);
  await ferramenta('wall');
  await clickWorld(page, 2, 2);
  await clickWorld(page, 6, 2);
  await clickWorld(page, 6, 5);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const ws = await paredes();
  check('duas paredes desenhadas', ws.length === 2, `(${ws.length})`);
  const a = ws.find((w) => igual(w.a, 2, 2) || igual(w.b, 2, 2));
  const b = ws.find((w) => w.id !== a?.id);
  ids = { a: a?.id, b: b?.id };
  await ferramenta('select');
  await clickWorld(page, 4, 2);
  const sel = await selecao();
  check('só a parede A selecionada', sel.length === 1 && sel[0] === ids.a, `${sel.length}`);
  await page.screenshot({ path: `${OUT}/00-inicio.png` });
});

await rep.step('Mover sem Desconectar: a vizinha B se estica e continua ligada', async () => {
  await ferramenta('move');
  const caixa = page.locator('#opt-mdisjoin');
  check('caixa Desconectar na barra do Mover', (await caixa.count()) === 1);
  check('Desconectar começa desligado', !(await caixa.isChecked()));
  await clickWorld(page, 2, 2);
  await clickWorld(page, 2, 1);
  const ws = await paredes();
  const a = daParede(ws, ids.a);
  const b = daParede(ws, ids.b);
  check('A moveu 1 m', igual(a.a, 2, 1) && igual(a.b, 6, 1), `${a.a.x},${a.a.y} → ${a.b.x},${a.b.y}`);
  check('B esticou até o novo canto e continua ligada', igual(b.a, 6, 1) && igual(b.b, 6, 5), `${b.a.x},${b.a.y} → ${b.b.x},${b.b.y}`);
  await page.screenshot({ path: `${OUT}/10-mover-sem-desconectar.png` });
  await page.keyboard.press('Control+z');
  const volta = await paredes();
  check('desfazer restaura A e B', igual(daParede(volta, ids.a).a, 2, 2) && igual(daParede(volta, ids.b).a, 6, 2));
});

await rep.step('Mover com Desconectar: B fica parada e a ponta de A se solta', async () => {
  await ferramenta('move');
  await page.locator('#opt-mdisjoin').check();
  check('Desconectar ligado', await page.locator('#opt-mdisjoin').isChecked());
  await clickWorld(page, 2, 2);
  await clickWorld(page, 2, 1);
  const ws = await paredes();
  const a = daParede(ws, ids.a);
  const b = daParede(ws, ids.b);
  check('A moveu 1 m', igual(a.a, 2, 1) && igual(a.b, 6, 1));
  check('B ficou parada', igual(b.a, 6, 2) && igual(b.b, 6, 5), `${b.a.x},${b.a.y} → ${b.b.x},${b.b.y}`);
  check('a ponta de A se soltou de B', !igual(a.b, b.a));
  await page.screenshot({ path: `${OUT}/11-mover-com-desconectar.png` });
  await page.keyboard.press('Control+z');
  const volta = await paredes();
  check('desfazer restaura A e B', igual(daParede(volta, ids.a).a, 2, 2) && igual(daParede(volta, ids.b).a, 6, 2));
});

await rep.step('Rotacionar com Desconectar (padrão): B fica parada e a ponta de A se solta', async () => {
  await ferramenta('rotate');
  check('Desconectar começa ligado no Rotacionar', await page.locator('#opt-rdisjoin').isChecked());
  await clickWorld(page, 2, 2);
  await page.keyboard.type('90');
  await page.keyboard.press('Enter');
  const ws = await paredes();
  const a = daParede(ws, ids.a);
  const b = daParede(ws, ids.b);
  check('A girou 90° em torno da própria ponta', igual(a.a, 2, 2) && igual(a.b, 2, 6), `${a.b.x},${a.b.y}`);
  check('B ficou parada', igual(b.a, 6, 2) && igual(b.b, 6, 5), `${b.a.x},${b.a.y} → ${b.b.x},${b.b.y}`);
  await page.screenshot({ path: `${OUT}/20-rotacionar-com-desconectar.png` });
  await page.keyboard.press('Control+z');
  const volta = await paredes();
  check('desfazer restaura A e B', igual(daParede(volta, ids.a).b, 6, 2) && igual(daParede(volta, ids.b).a, 6, 2));
});

await rep.step('Rotacionar sem Desconectar: B se estica até a ponta girada e continua ligada', async () => {
  await ferramenta('rotate');
  await page.locator('#opt-rdisjoin').uncheck();
  check('Desconectar desligado', !(await page.locator('#opt-rdisjoin').isChecked()));
  await clickWorld(page, 2, 2);
  await page.keyboard.type('90');
  await page.keyboard.press('Enter');
  const ws = await paredes();
  const a = daParede(ws, ids.a);
  const b = daParede(ws, ids.b);
  check('A girou 90° em torno da própria ponta', igual(a.a, 2, 2) && igual(a.b, 2, 6), `${a.b.x},${a.b.y}`);
  check('B se esticou até a ponta girada e continua ligada', igual(b.a, 2, 6) && igual(b.b, 6, 5), `${b.a.x},${b.a.y} → ${b.b.x},${b.b.y}`);
  await page.screenshot({ path: `${OUT}/21-rotacionar-sem-desconectar.png` });
  await page.keyboard.press('Control+z');
  const volta = await paredes();
  check('desfazer restaura A e B', igual(daParede(volta, ids.a).b, 6, 2) && igual(daParede(volta, ids.b).a, 6, 2));
});

rep.check('sem erros no console', errors.length === 0, errors.join(' | '));
rep.summary();
await browser.close();
process.exit(rep.steps.some((s) => s.status !== 'PASS') ? 1 : 0);
