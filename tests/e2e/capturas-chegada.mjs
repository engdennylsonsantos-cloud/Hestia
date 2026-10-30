// Capturas da correção da chegada da escada: planta, corte e 3D da MESMA escada (17 espelhos) antes e depois de existir a
// laje do nível de cima. Confere, além das imagens:
//  - sem laje/piso: covered = false, a chegada fecha no próprio nível (topZ) e é o último degrau (17 números na planta);
//  - com laje: covered = true, o topo da chegada é a face inferior da laje e a planta termina no último espelho (16 números).
//   CHROME_PATH=<chromium> SHOTS=<pasta> node tests/e2e/capturas-chegada.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { abreVista3d, clickWorld, launch, makeReporter, openApp, pressTool } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'docs/handoff/escada-chegada/capturas';
mkdirSync(OUT, { recursive: true });

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser, { width: 1440, height: 900 });
const shot = (name, target) => (target ?? page.locator('body')).screenshot({ path: path.join(OUT, name) });
const statusText = () => page.locator('footer.statusbar .msg').innerText();

const fixPlanView = () =>
  page.evaluate(() => {
    const { editor } = window.__hestia;
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    editor.setViewport({ cx: 3.9, cy: 1.9, zoom: 72, width: Math.round(r.width), height: Math.round(r.height) });
  });

const irParaPlanta = async (levelId = 'lv_0') => {
  await page.evaluate((lv) => {
    const { editor, useUi } = window.__hestia;
    editor.setView('plan');
    useUi.setState({ levelId: lv, selection: [] });
  }, levelId);
  await page.waitForTimeout(500);
  await fixPlanView();
  await page.waitForTimeout(250);
  await fixPlanView();
};

/** Recorte da escada (mundo) na tela, para ver a numeração dos degraus. */
async function shotStair(name) {
  const clip = await page.evaluate(() => {
    const { editor } = window.__hestia;
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    const vp = editor.viewport();
    const x = (wx) => r.left + r.width / 2 + (wx - vp.cx) * vp.zoom;
    const y = (wy) => r.top + r.height / 2 - (wy - vp.cy) * vp.zoom;
    return { x: x(0.6), y: y(2.1), width: x(7.2) - x(0.6), height: y(-0.4) - y(2.1) };
  });
  await page.screenshot({ path: path.join(OUT, name), clip });
}

/** Foca a câmera 3D na escada (topo), para ver o fechamento da chegada no nível. */
async function focarEscada3d() {
  await page.waitForTimeout(900);
  await page.waitForFunction(() => !!window.__hestia3d, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    const s = Object.values(editor.project.elements).find((e) => e.kind === 'stair');
    const risers = (s?.components ?? []).filter((c) => c.kind === 'run').flatMap((c) => c.risers);
    const xs = risers.map((r) => (r.a.x + r.b.x) / 2);
    const ys = risers.map((r) => (r.a.y + r.b.y) / 2);
    const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
    const o = window.__hestia3d;
    if (!o) return;
    o.target.set(x, y, 2.4);
    o.distance = 5.5;
    o.azimuth = -0.85;
    o.elevation = 0.32;
    o.apply();
  });
  // Um quadro novo para o orbit aplicar de fato (o 3D só redesenha no próximo frame).
  await page.mouse.move(760, 420);
  await page.mouse.wheel(0, 1);
  await page.waitForTimeout(900);
}

/** Estado da escada do projeto: espelhos, pisos resolvidos, cobertura do nível de topo e cotas do topo. */
const stairState = () =>
  page.evaluate(() => {
    const { editor, resolveStairs, stairArrivalTop } = window.__hestia;
    const st = Object.values(editor.project.elements).filter((e) => e.kind === 'stair');
    const stair = st[0];
    if (!stair) return { n: 0 };
    const r = resolveStairs(editor.project).find((x) => x.id === stair.id);
    const top = stairArrivalTop(editor.project, r);
    const last = r.risers[r.risers.length - 1];
    return {
      n: st.length,
      risers: r.riserCount,
      treads: r.steps.filter((s) => s.kind === 'tread').length,
      steps: r.steps.length,
      covered: top.covered,
      arrivalTop: +top.top.toFixed(3),
      topZ: +r.topZ.toFixed(3),
      lastRiserTop: last ? +last.z1.toFixed(3) : null,
      slabs: Object.values(editor.project.elements).filter((e) => e.kind === 'slab').length,
    };
  });

/** Cria a escada reta (Q) com 2 cliques; o 2º clique dá o comprimento (5 m para caber 17 espelhos de 28 cm). */
async function criarEscadaReta() {
  await pressTool(page, 'q');
  await page.waitForSelector('#place-run-shape', { timeout: 20000 });
  await page.locator('#place-run-shape').selectOption('straight');
  await page.waitForTimeout(150);
  await fixPlanView();
  await clickWorld(page, 1, 0.8);
  await clickWorld(page, 6, 0.8);
  await page.waitForTimeout(600);
  return statusText();
}

/** Cria a laje de teste no nível `lv_1` cobrindo a escada, direto na loja (sem depender da ferramenta/abas). */
const criarLaje = () =>
  page.evaluate(() => {
    const { editor } = window.__hestia;
    const typeId = Object.keys(editor.project.slabTypes)[0];
    const slab = {
      kind: 'slab',
      id: 'sl_chegada_teste',
      typeId,
      levelId: 'lv_1',
      boundary: [{ x: -1, y: -1 }, { x: 9, y: -1 }, { x: 9, y: 7 }, { x: -1, y: 7 }],
      holes: [],
      heightOffset: 0,
      slope: null,
      mark: '',
      comments: '',
      order: 0,
    };
    editor.store.exec({ type: 'addSlab', slab }, 'Laje de teste da chegada');
  });

/** Cria um corte pela escada (a ferramenta abre a vista de corte sozinha) e fotografa. */
async function criarCorte(name) {
  await irParaPlanta();
  await pressTool(page, 'k');
  await page.waitForTimeout(250);
  await clickWorld(page, 3, -1);
  await clickWorld(page, 3, 2.6);
  await page.waitForTimeout(800);
  const aberto = await page.evaluate(() => window.__hestia.useUi.getState().view === 'section');
  await shot(name);
  return aberto;
}

try {
  await rep.step('1 · Sem laje/piso: a escada fecha com o piso de chegada no próprio nível', async () => {
    await fixPlanView();
    const msg = await criarEscadaReta();
    rep.check('escada criada com 17 espelhos', /17 espelhos/.test(msg), msg.slice(0, 120));
    const s = await stairState();
    rep.check('modelo: 17 espelhos e 16 pisos', s.risers === 17 && s.treads === 16, JSON.stringify(s));
    rep.check('sem laje: covered=false e a chegada fecha em topZ', s.covered === false && s.arrivalTop === s.topZ, JSON.stringify({ covered: s.covered, arrivalTop: s.arrivalTop, topZ: s.topZ }));
    rep.check('último espelho alinhado ao topZ (nível + offset)', s.lastRiserTop === s.topZ, JSON.stringify({ lastRiserTop: s.lastRiserTop, topZ: s.topZ }));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    await fixPlanView();
    await shot('01-sem-laje-planta.png');
    await shotStair('01-sem-laje-planta-recorte.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  });

  await rep.step('2 · Sem laje/piso: 3D e corte fecham no nível', async () => {
    await abreVista3d(page);
    await focarEscada3d();
    await shot('02-sem-laje-3d.png');
    rep.check('corte criado e aberto (sem laje)', await criarCorte('03-sem-laje-corte.png'));
    await irParaPlanta();
  });

  await rep.step('3 · Com laje no nível de cima: a escada termina no último espelho', async () => {
    // Mesma escada: cria a laje no Pavimento 2 por cima dela e confere que a cobertura muda o desenho.
    await criarLaje();
    await page.waitForTimeout(500);
    await fixPlanView();
    const s = await stairState();
    rep.check('laje criada no nível de cima', s.slabs === 1, `${s.slabs}`);
    rep.check('modelo segue 17 espelhos e 16 pisos', s.risers === 17 && s.treads === 16, JSON.stringify(s));
    rep.check('com laje: covered=true e o topo da chegada é a face inferior da laje', s.covered === true && s.arrivalTop < s.topZ, JSON.stringify({ covered: s.covered, arrivalTop: s.arrivalTop, topZ: s.topZ }));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    await fixPlanView();
    await shot('04-com-laje-planta.png');
    await shotStair('04-com-laje-planta-recorte.png');
    await abreVista3d(page);
    await focarEscada3d();
    await shot('05-com-laje-3d.png');
    await irParaPlanta();
    rep.check('corte criado e aberto (com laje)', await criarCorte('06-com-laje-corte.png'));
    await irParaPlanta();
  });

  await rep.step('4 · Sem erros de console ou de página', async () => {
    // O build da main ainda emite o aviso do atributo `height="auto"` do SVG das prévias (corrigido na branch fix/escada-final).
    const outros = errors.filter((e) => !e.includes('attribute height'));
    rep.check('nenhum erro de console/página (fora o height="auto" pré-existente da main)', outros.length === 0, outros.slice(0, 3).join(' | '));
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
