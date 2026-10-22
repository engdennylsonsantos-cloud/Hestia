// Anexar topo na vista 3D: duas paredes seguidas (seleção 3D, Enter na 3D, clique no telhado) e o aviso quando o clique não
// acha parede. Roteiro com asserções; relatório passo a passo; código de saída 1 se algo falhou.
import { mkdirSync } from 'node:fs';
import { openApp, launch, makeReporter } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?gl=1&debug=1' });
const rep = makeReporter();
/** Pontos de tela (3D) de cada elemento visível, e as duas paredes escolhidas para o roteiro. */
let found3d = {};
let visibleWalls = [];
const check = rep.check.bind(rep);
const st = () => page.evaluate(() => window.__hestia.useUi.getState().status);
const attached = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall' && e.attachTopToRoof).map((w) => ({ id: w.id, roof: w.attachTopRoofId })));
const roofId = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements).find((e) => e.kind === 'roof')?.id ?? null);
/** Clique 3D medido: ms do clique até a gravação no modelo (contador do store). */
async function clickMs(p) {
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
  const n0 = await page.evaluate(() => window.__k3.n);
  const t0 = Date.now();
  await page.mouse.down();
  await page.mouse.up();
  for (let i = 0; i < 400; i++) {
    if ((await page.evaluate(() => window.__k3.n)) > n0) return Date.now() - t0;
    await page.waitForTimeout(10);
  }
  return null;
}

await rep.step('desenhar casa com telhado pelas paredes', async () => {
  await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('house2'); editor.zoomExtents(); });
  await page.waitForTimeout(400);
  const b = await page.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]); const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  const at = await page.evaluate(([x, y]) => {
    const { editor } = window.__hestia; const r = document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
    const v = editor.ensureViewport(r.width, r.height);
    return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
  }, [b.minX, (b.minY + b.maxY) / 2]);
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ options: { ...useUi.getState().options, roofMode: 'paredes', roofShape: 'gable', roofSlope: 30 } }); editor.setTool('roof'); });
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  check('telhado criado', !!(await roofId()));
  await page.evaluate(() => {
    window.__k3 = { n: 0 };
    window.__hestia.editor.store.subscribe(() => { window.__k3.n++; });
  });
});

await rep.step('localizar duas paredes e o telhado no 3D', async () => {
  await page.getByRole('tab', { name: /Modelo 3D/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Enquadrar tudo' }).click();
  await page.waitForTimeout(800);
  const rect = await page.evaluate(() => { const r = document.querySelector('.canvas-wrap canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const found = {};
  for (let y = rect.y + 40; y < rect.y + rect.h - 40; y += 45) for (let x = rect.x + 40; x < rect.x + rect.w - 40; x += 45) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(40);
    const h = await page.evaluate(() => window.__hestia.useUi.getState().hover);
    if (h && !found[h]) found[h] = { x, y };
  }
  const walls = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall').map((w) => w.id));
  const visible = walls.filter((w) => found[w]);
  check('duas paredes visíveis no 3D', visible.length >= 2, `(${visible.length})`);
  check('telhado visível no 3D', !!found[await roofId()]);
  found3d = found;
  visibleWalls = visible;
});

await rep.step('anexar a primeira parede: seleção 3D, Anexar topo, clique no telhado', async () => {
  const id = visibleWalls;
  const roof = await roofId();
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  const pa = found3d[id[0]];
  await page.mouse.move(pa.x, pa.y); await page.mouse.click(pa.x, pa.y); await page.waitForTimeout(100);
  check('parede selecionada no 3D', (await page.evaluate(() => window.__hestia.useUi.getState().selection)).includes(id[0]));
  await page.evaluate(() => window.__hestia.editor.setTool('attachroof'));
  check('ao ativar, a etapa é o telhado', (await st()).includes('Selecione o telhado'), await st());
  const ms = await clickMs(found3d[roof]);
  check('primeira parede anexada ao telhado', (await attached()).some((a) => a.id === id[0] && a.roof === roof));
  check('atraso do primeiro anexo até 1,5 s', ms !== null && ms <= 1500, `(${ms} ms)`);
  console.log(`  tempo clique->modelo: ${ms} ms`);
});

await rep.step('anexar a segunda parede logo em seguida, na 3D, com Enter', async () => {
  const id = visibleWalls;
  const roof = await roofId();
  await clickMs(found3d[id[1]]);
  check('segunda parede escolhida pelo clique na 3D', (await st()).includes('1 parede(s) escolhida(s)'), await st());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  check('Enter na 3D avança para o telhado', (await st()).includes('Selecione o telhado'), await st());
  const ms = await clickMs(found3d[roof]);
  const list = await attached();
  check('segunda parede anexada ao mesmo telhado', list.some((a) => a.id === id[1] && a.roof === roof), JSON.stringify(list.map((a) => a.id)));
  check('primeira continua anexada', list.some((a) => a.id === id[0]));
  console.log(`  tempo clique->modelo: ${ms} ms`);
});

await rep.step('clique no telhado na etapa das paredes avisa em vez de falhar em silêncio', async () => {
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ selection: [] }); editor.setTool('attachroof'); });
  await clickMs(found3d[await roofId()]);
  check('mensagem sobre o telhado', (await st()).startsWith('Isso é um telhado'), await st());
});

await browser.close();
rep.summary();
console.log(`erros do console: ${errors.length}`);
const bad = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(bad ? 1 : 0);
