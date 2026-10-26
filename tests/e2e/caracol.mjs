// Escada caracol ponta a ponta na interface real (decisão 0014): ferramenta Q com a forma Caracol (varredura digitada),
// estilos monolítico e poste central, planta com voltas, 3D em close-up e avisos. Gera imagens em $SHOTS para inspeção.
//   npm run build && SHOTS=<pasta> node tests/e2e/caracol.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { clickWorld, launch, makeReporter, openApp, pressTool } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/caracol';
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser);
const shot = (name) => page.locator('.canvas-wrap').screenshot({ path: path.join(OUT, name) });
const statusText = () => page.locator('footer.statusbar .msg').innerText();

const stairs = () => page.evaluate(() => {
  const { editor } = window.__hestia;
  return Object.values(editor.project.elements)
    .filter((e) => e.kind === 'stair')
    .map((s) => {
      const run = s.components.find((c) => c.kind === 'run');
      return { id: s.id, typeId: s.typeId, generatedBy: run?.generatedBy ?? null, spiral: run?.spiral ?? null, risers: run?.risers.length ?? 0 };
    });
});
const fixPlanView = () => page.evaluate(() => {
  const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
  window.__hestia.editor.setViewport({ cx: 14, cy: 3, zoom: 55, width: Math.round(r.width), height: Math.round(r.height) });
});
const setField = async (id, v) => {
  const f = page.locator(`#${id}`);
  await f.fill(String(v));
  await f.press('Enter');
  await page.waitForTimeout(150);
};
async function create(center, typeMatch, sweep) {
  await pressTool(page, 'q');
  await page.waitForTimeout(100);
  await page.locator('#opt-stairshape').selectOption('spiral');
  const typeId = await page.locator('#opt-stairruntype option').evaluateAll((os, m) => os.find((o) => o.textContent.toLowerCase().includes(m))?.value, typeMatch);
  await page.locator('#opt-stairruntype').selectOption(typeId);
  await setField('opt-spiralinner', 0.1);
  await setField('opt-spiralouter', 1.0);
  await setField('opt-spiralsweep', sweep);
  await clickWorld(page, center[0], center[1]);
  await clickWorld(page, center[0] + 1, center[1]);
  await page.waitForTimeout(250);
  return typeId;
}

try {
  await rep.step('1 · Abrir a casa e escolher a forma Caracol (Q)', async () => {
    await page.setInputFiles('#file-open', FIXTURE);
    await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /Térreo/ }).click();
    await page.waitForTimeout(250);
    await fixPlanView();
    await pressTool(page, 'q');
    await page.waitForTimeout(100);
    const tool = await page.evaluate(() => window.__hestia.editor.activeTool?.id);
    rep.check('ferramenta stairrun ativa', tool === 'stairrun', String(tool));
    const opts = await page.locator('#opt-stairshape option').allInnerTexts();
    rep.check('forma "Caracol" disponível', opts.some((t) => /caracol/i.test(t)), opts.join(' | '));
  });

  await rep.step('2 · Caracol monolítico de 540° (varredura digitada, 2 cliques)', async () => {
    const typeId = await create([13, 3], 'monol', 540);
    const s = await stairs();
    const sp = s.find((x) => x.generatedBy === 'spiral');
    rep.check('1 escada gerada como caracol', s.length === 1 && !!sp, JSON.stringify(s.map((x) => x.generatedBy)));
    rep.check('tipo caracol monolítico', sp?.typeId === typeId && /monolitica/.test(typeId), `${sp?.typeId}`);
    rep.check('varredura guardada ≈ 540°', !!sp?.spiral && Math.abs(Math.abs(sp.spiral.sweep) - 3 * Math.PI) < 1e-6, JSON.stringify(sp?.spiral));
    rep.check('raios 0,10 / 1,00', !!sp?.spiral && Math.abs(sp.spiral.rInner - 0.1) < 1e-9 && Math.abs(sp.spiral.rOuter - 1) < 1e-9);
    rep.check('mais de 15 espelhos (pé-direito 3,0 m)', (sp?.risers ?? 0) >= 17, `${sp?.risers}`);
    rep.check('mensagem de escada criada', /Escada.*criada/.test(await statusText()), (await statusText()).slice(0, 120));
    await shot('planta-monolitica-540.png');
  });

  await rep.step('3 · Caracol com poste central de 360°', async () => {
    const typeId = await create([18, 3], 'poste', 360);
    const s = await stairs();
    const sp = s.find((x) => x.typeId === typeId);
    rep.check('2 escadas', s.length === 2, `${s.length}`);
    rep.check('tipo poste central', /poste/.test(typeId), typeId);
    rep.check('varredura ≈ 360°', !!sp?.spiral && Math.abs(Math.abs(sp.spiral.sweep) - 2 * Math.PI) < 1e-6, JSON.stringify(sp?.spiral));
    await shot('planta-ambos.png');
    await page.evaluate(() => { const { editor, useUi } = window.__hestia; useUi.setState({ selection: [] }); const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); editor.setViewport({ cx: 13, cy: 3, zoom: 150, width: Math.round(r.width), height: Math.round(r.height) }); });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    await shot('planta-monolitica-zoom.png');
    await page.evaluate(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); window.__hestia.editor.setViewport({ cx: 18, cy: 3, zoom: 150, width: Math.round(r.width), height: Math.round(r.height) }); });
    await page.waitForTimeout(300);
    await shot('planta-poste-zoom.png');
  });

  await rep.step('4 · Avisos: sem erro bloqueante; aviso de saída de emergência presente', async () => {
    const r = await page.evaluate(async () => {
      const { editor } = window.__hestia;
      const e = await import('@hestia/engine').catch(() => null);
      return e ? 'sem-acesso' : 'sem-modulo';
    }).catch(() => 'n/a');
    const ids = (await stairs()).map((x) => x.id);
    await page.evaluate((id) => window.__hestia.useUi.setState({ selection: [id] }), ids[0]);
    await page.waitForTimeout(300);
    const txt = await page.locator('.props, aside, .properties').first().innerText().catch(() => '');
    rep.check('painel mostra "Raio interno" e "Varredura"', /Raio interno/i.test(txt) && /Varredura/i.test(txt), txt.slice(0, 160).replace(/\n/g, ' | '));
    rep.check('aviso informativo de saída de emergência', /sa[ií]da de emerg[eê]ncia/i.test(txt), r);
    await shot('propriedades.png');
  });

  await rep.step('5 · 3D em close-up (monolítico e poste), modo escuro com arestas', async () => {
    await page.evaluate(() => window.__hestia.useUi.setState({ selection: [], theme: 'dark' }));
    await page.getByRole('tab', { name: /Modelo 3D/ }).click();
    await page.waitForTimeout(1500);
    const pos = await stairs();
    const centers = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'stair').map((s) => s.components.find((c) => c.kind === 'run').spiral.center));
    for (let i = 0; i < pos.length; i++) {
      for (const [az, el, dist, name] of [[0.9, 0.5, 5.5, 'a'], [2.4, 0.25, 4.2, 'b']]) {
        await page.evaluate(({ c, az, el, dist }) => { const o = window.__hestia3d; o.target.set(c.x, c.y, 1.4); o.distance = dist; o.azimuth = az; o.elevation = el; o.apply(); }, { c: centers[i], az, el, dist });
        await page.mouse.move(400, 300);
        await page.mouse.wheel(0, 1);
        await page.waitForTimeout(500);
        await shot(`3d-${i === 0 ? 'monolitica' : 'poste'}-${name}.png`);
      }
    }
    rep.check('close-ups gerados', true);
  });

  await rep.step('6 · Sem erros de console ou de página', async () => {
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
