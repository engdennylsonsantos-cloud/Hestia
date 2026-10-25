// Medição de desempenho no navegador (frente G): o que o usuário sente na web, que o baseline de Node não mostra.
//   npm run perf:browser -- --save   (precisa de apps/web/dist: rode `npm run build` antes, ou defina APP_URL)
//   Variáveis: CHROME_PATH (Chrome ou Edge; sem ele, procura a instalação padrão do Windows), APP_URL (ex.: o servidor
//   de dev, http://localhost:5179: NÃO é baseline, só para testar o roteiro), PERF_RUNS (repetições, padrão 5),
//   PERF_HEADED=1 (janela visível), PERF_ROTULO (sufixo do arquivo gravado, padrão `antes`).
//   Com --save grava scripts/perf-baselines/browser-20-pav-<data>-<rotulo>.json. Em modo de desenvolvimento não grava.
// O que mede, nos projetos sintéticos de 10 e 20 pavimentos (scripts/perf-baselines/projeto-sintetico.mts):
//   1. abertura: do openFromText ao segundo quadro pintado (rAF duplo), e a primeira pintura da página (FCP);
//   2. planta do nível do meio: da troca de nível ao segundo quadro pintado;
//   3. seleção por clique na planta: do pointerup até a seleção mudar, e um quadro pintado depois;
//   4. edição: move uma parede (setWallEnds pelo store, o mesmo caminho das ferramentas) e mede até o quadro pintado;
//   5. pan (botão do meio) e zoom (roda) na planta: do evento ao quadro seguinte pintado (média e p95);
//   6. clique de pick na 3D: do pointerup até a seleção mudar (média e p95);
//   7. inserção (tests/e2e/perf-acoes.mjs): porta e janela numa parede do nível do meio, e parede nova, por cliques reais
//      nas ferramentas; do pointerup ao quadro seguinte pintado (mediana, p95, média, mínimo e máximo).
// Sem navegador ou sem build, sai com código 2 e a mensagem do que falta: o baseline de navegador fica PENDENTE.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { medirInsercoes } from './perf-acoes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNS = Math.max(1, Number(process.env.PERF_RUNS ?? 5));
const SAVE = process.argv.includes('--save');
const ROTULO = process.env.PERF_ROTULO ?? 'antes';
const PROJETOS = [10, 20];
const PAN_STEPS = 60;
const ZOOM_STEPS = 30;
// Parede do nível do meio usada na seleção e na edição: índice 25 do layout, de (6,4) a (6,8), sem outra parede em (6,6).
const PAREDE_IDX = 25;
const PAREDE_X = 6;
const PAREDE_Y_A = 4;
const PAREDE_Y_B = 8;
const DESLOCAMENTO_M = 0.3;

/** Executável do Chrome ou Edge: CHROME_PATH primeiro, depois as instalações padrão do Windows (e do Linux). */
function acharChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : `inexistente: ${process.env.CHROME_PATH}`;
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null;
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    local,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return candidatos.find((c) => c && existsSync(c)) ?? null;
}

/** Endereço do app: APP_URL, ou o build de produção em apps/web/dist. */
function acharApp() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const dist = path.join(ROOT, 'apps', 'web', 'dist', 'index.html');
  return existsSync(dist) ? pathToFileURL(dist).href : null;
}

const r2 = (x) => Number(x.toFixed(2));
/** Mediana, p95 (amostra de ordem ceil(0,95·n)), média, mínimo e máximo. */
function resumo(amostras) {
  if (!amostras.length) return 'PENDENTE';
  const s = [...amostras].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return { n: s.length, medianaMs: r2(at(0.5)), p95Ms: r2(at(0.95)), mediaMs: r2(s.reduce((a, b) => a + b, 0) / s.length), minMs: r2(s[0]), maxMs: r2(s.at(-1)) };
}

/** Id do pavimento i (mesma convenção do gerador de projeto-sintetico.mts). */
const idNivel = (i) => (i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `perf_lv_${i}`);
/** Espera dois quadros pintados (rAF duplo) dentro da página. */
const esperarQuadros = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

const chrome = acharChrome();
const app = acharApp();
if (!chrome || chrome.startsWith('inexistente')) {
  console.error(`PENDENTE: navegador não encontrado (${chrome ?? 'nenhum Chrome ou Edge nos caminhos padrão'}). Defina CHROME_PATH com o executável do Chrome ou Edge.`);
  process.exit(2);
}
if (!app) {
  console.error('PENDENTE: falta o build do app (apps/web/dist/index.html). Rode `npm run build` ou defina APP_URL.');
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: chrome, headless: process.env.PERF_HEADED !== '1' });
const pendencias = [];
const abertos = [];
const novaPagina = async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  const t0 = Date.now();
  await page.goto(`${app}?debug=1`);
  await page.waitForSelector('.canvas-wrap canvas', { timeout: 60000 });
  await page.waitForFunction(() => window.__hestia, null, { timeout: 60000 });
  abertos.push(page);
  return { page, erros, carregamentoMs: Date.now() - t0 };
};

const modo = await (async () => {
  const { page } = await novaPagina();
  const dev = await page.evaluate(() => !!document.querySelector('script[src*="/@vite/client"]'));
  await page.close();
  return dev ? 'dev' : 'producao';
})();
if (modo === 'dev') console.warn('AVISO: o app é servidor de desenvolvimento (React em modo dev). Estes números NÃO são baseline.');

/** Mede um projeto de `n` pavimentos: abertura, planta, seleção, edição, pan, zoom e pick 3D. */
async function medirProjeto(n) {
  const rotulo = `${n} pav`;
  const projPath = path.join(os.tmpdir(), `hestia-perf-${n}.hestia.json`);
  execSync(`npx vite-node scripts/perf-baselines/projeto-sintetico.mts ${n}`, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PROJETO_SAIDA: projPath } });
  const texto = readFileSync(projPath, 'utf8');
  const meio = Math.floor(n / 2);
  const idParede = `perf_w_${meio}_${PAREDE_IDX}`;
  const medidas = {};

  // 1. Abertura até o segundo quadro pintado. Cada repetição abre uma página nova; a última fica para os cenários seguintes.
  const abertura = [];
  const fcp = [];
  const carregamento = [];
  let ultima = null;
  for (let r = 0; r < RUNS; r++) {
    const { page, erros, carregamentoMs } = await novaPagina();
    const res = await page.evaluate(async ([t, nome]) => {
      const paint = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
      const t0 = performance.now();
      const ok = window.__hestia.editor.openFromText(t, nome);
      if (!ok.ok) throw new Error(ok.error);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { ms: performance.now() - t0, fcp: paint ? paint.startTime : null, niveis: window.__hestia.editor.project.levels.length };
    }, [texto, `perf-${n}.hestia.json`]);
    if (res.niveis !== n) pendencias.push(`[${rotulo}] abertura: esperava ${n} níveis, carregou ${res.niveis}`);
    abertura.push(res.ms);
    if (res.fcp !== null) fcp.push(res.fcp);
    carregamento.push(carregamentoMs);
    if (erros.length) pendencias.push(`[${rotulo}] erros de página na abertura: ${erros.slice(0, 3).join(' | ')}`);
    if (ultima) await ultima.close().catch(() => {});
    ultima = page;
  }
  medidas.abrirProjeto = resumo(abertura);
  medidas.carregarPaginaAteAppPronto = resumo(carregamento);
  medidas.primeiraPinturaFCP = resumo(fcp);

  const page = ultima;
  await page.evaluate(() => window.__hestia.editor.selectLevel('lv_0'));
  await esperarQuadros(page);

  // 2. Planta do nível do meio: troca de nível até o segundo quadro pintado. Volta ao térreo fora da medida.
  const planta = [];
  for (let r = 0; r < RUNS; r++) {
    planta.push(await page.evaluate(async (id) => {
      const t0 = performance.now();
      window.__hestia.editor.selectLevel(id);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return performance.now() - t0;
    }, idNivel(meio)));
    await page.evaluate((id) => window.__hestia.editor.selectLevel(id), 'lv_0');
    await esperarQuadros(page);
  }
  await page.evaluate((id) => window.__hestia.editor.selectLevel(id), idNivel(meio));
  await page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    window.__hestia.editor.setViewport({ cx: 6, cy: 6, zoom: 30, width: Math.round(r.width), height: Math.round(r.height) });
  });
  await esperarQuadros(page);
  medidas.plantaNivelDoMeio = resumo(planta);

  // Posição de tela do centro da parede alvo (o viewport acabou de ser fixado acima).
  const alvo = await page.evaluate(([mx, my]) => {
    const v = window.__hestia.editor.viewport();
    const c = document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
    return { x: c.left + (mx - v.cx) * v.zoom + v.width / 2, y: c.top + v.height / 2 - (my - v.cy) * v.zoom };
  }, [PAREDE_X, (PAREDE_Y_A + PAREDE_Y_B) / 2]);

  // 3. Seleção por clique na planta: do pointerup até a seleção mudar (e um quadro pintado depois).
  const selecao = [];
  let acertos = 0;
  for (let r = 0; r < RUNS; r++) {
    await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));
    await esperarQuadros(page);
    await page.evaluate(() => {
      window.__pick = null;
      const sel0 = JSON.stringify(window.__hestia.useUi.getState().selection);
      window.addEventListener('pointerup', () => {
        const t0 = performance.now();
        const checar = () => {
          if (JSON.stringify(window.__hestia.useUi.getState().selection) !== sel0) requestAnimationFrame(() => requestAnimationFrame(() => { window.__pick = performance.now() - t0; }));
          else if (performance.now() - t0 > 3000) window.__pick = -1;
          else requestAnimationFrame(checar);
        };
        checar();
      }, { once: true });
    });
    await page.mouse.click(alvo.x, alvo.y);
    await page.waitForFunction(() => window.__pick !== null, null, { timeout: 10000 });
    const dt = await page.evaluate(() => window.__pick);
    const sel = await page.evaluate(() => window.__hestia.useUi.getState().selection);
    if (dt >= 0) selecao.push(dt);
    if (sel.includes(idParede)) acertos++;
  }
  medidas.selecaoPorCliqueNaPlanta = { cliques: selecao.length, acertouParede: acertos, tempo: resumo(selecao) };
  if (acertos < RUNS) pendencias.push(`[${rotulo}] seleção: o clique acertou a parede ${idParede} em ${acertos} de ${RUNS} vezes`);
  await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));

  // 4. Edição: move a parede alvo em DESLOCAMENTO_M (vai e volta a cada repetição), pelo store, e mede até o quadro pintado.
  const edicao = [];
  let editou = 0;
  for (let r = 0; r < RUNS; r++) {
    const dx = r % 2 === 0 ? DESLOCAMENTO_M : 0;
    const res = await page.evaluate(async ([id, dx, x, ya, yb]) => {
      const t0 = performance.now();
      window.__hestia.editor.store.exec({ type: 'setWallEnds', id, a: { x: x + dx, y: ya }, b: { x: x + dx, y: yb } });
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const w = window.__hestia.editor.project.elements[id];
      return { ms: performance.now() - t0, ok: !!w && Math.abs(w.a.x - (x + dx)) < 1e-9 };
    }, [idParede, dx, PAREDE_X, PAREDE_Y_A, PAREDE_Y_B]);
    edicao.push(res.ms);
    if (res.ok) editou++;
  }
  medidas.edicaoParede = { edicoes: edicao.length, confirmadasNoStore: editou, tempo: resumo(edicao) };
  if (editou < RUNS) pendencias.push(`[${rotulo}] edição: o store não refletiu a mudança em ${RUNS - editou} repetição(ões)`);

  // 4b. Inserção: porta e janela na parede alvo, parede nova no nível do meio (cliques reais nas ferramentas).
  const insercoes = await medirInsercoes({ page, RUNS, nivel: idNivel(meio), idParede, resumo, esperarQuadros, pendencias, rotulo });
  Object.assign(medidas, insercoes);

  // Volta ao térreo para o pan, o zoom e o pick, que usam o nível 0.
  await page.evaluate(() => window.__hestia.editor.selectLevel('lv_0'));
  await esperarQuadros(page);

  // 5. Pan e zoom na planta: do evento ao quadro seguinte pintado.
  const pan = [];
  const zoom = [];
  await page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    window.__hestia.editor.setViewport({ cx: 6, cy: 6, zoom: 30, width: Math.round(r.width), height: Math.round(r.height) });
    window.__lat = [];
    const medir = (t0) => requestAnimationFrame(() => requestAnimationFrame(() => window.__lat.push(performance.now() - t0)));
    window.addEventListener('pointermove', (e) => { if (e.buttons) medir(performance.now()); }, true);
    window.addEventListener('wheel', () => medir(performance.now()), { capture: true, passive: true });
  });
  await page.waitForTimeout(300);
  const box = await page.locator('.canvas-wrap canvas').first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let r = 0; r < RUNS; r++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'middle' });
    for (let k = 1; k <= PAN_STEPS; k++) await page.mouse.move(cx + k * 3, cy + k * 2);
    await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(150);
    pan.push(...(await page.evaluate(() => window.__lat.splice(0))));
    for (let k = 0; k < ZOOM_STEPS; k++) {
      await page.mouse.wheel(0, k % 2 ? 100 : -100);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(150);
    zoom.push(...(await page.evaluate(() => window.__lat.splice(0))));
  }
  medidas.pan = resumo(pan);
  medidas.zoom = resumo(zoom);
  if (!pan.length) pendencias.push(`[${rotulo}] pan: nenhuma amostra (o canvas da planta não respondeu ao botão do meio)`);
  if (!zoom.length) pendencias.push(`[${rotulo}] zoom: nenhuma amostra (a roda não chegou ao canvas da planta)`);

  // 6. Clique de pick na 3D: pointerup até a seleção mudar.
  await page.locator('button.leaf', { hasText: 'Modelo 3D' }).click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__hestia3dModel.fit());
  await page.waitForTimeout(400);
  const caixa3d = await page.locator('.canvas-wrap canvas').first().boundingBox();
  const selecionar = (x, y) => page.evaluate(() => window.__hestia.useUi.setState({ selection: [] })).then(() => page.mouse.click(x, y));
  const armar = () => page.evaluate(() => {
    window.__pick = null;
    const sel0 = JSON.stringify(window.__hestia.useUi.getState().selection);
    window.addEventListener('pointerup', () => {
      const t0 = performance.now();
      const checar = () => {
        if (JSON.stringify(window.__hestia.useUi.getState().selection) !== sel0) requestAnimationFrame(() => requestAnimationFrame(() => { window.__pick = performance.now() - t0; }));
        else if (performance.now() - t0 > 3000) window.__pick = -1;
        else requestAnimationFrame(checar);
      };
      checar();
    }, { once: true });
  });
  // Procura um ponto da tela que pega um elemento (o modelo enquadrado ocupa o centro).
  let ponto3d = null;
  const fracoes = [0.5, 0.4, 0.6, 0.3, 0.7];
  search: for (const fy of fracoes) for (const fx of fracoes) {
    await selecionar(caixa3d.x + caixa3d.width * fx, caixa3d.y + caixa3d.height * fy);
    const k = await page.evaluate(() => window.__hestia.useUi.getState().selection.length);
    if (k > 0) { ponto3d = { x: caixa3d.x + caixa3d.width * fx, y: caixa3d.y + caixa3d.height * fy }; break search; }
  }
  if (!ponto3d) {
    medidas.pick3D = 'PENDENTE';
    pendencias.push(`[${rotulo}] pick 3D: nenhum ponto da tela pegou elemento (a cena 3D não montou ou o modelo não está enquadrado)`);
  } else {
    const tempos = [];
    for (let k = 0; k < RUNS * 4; k++) {
      await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));
      await armar();
      await page.mouse.click(ponto3d.x, ponto3d.y);
      await page.waitForFunction(() => window.__pick !== null, null, { timeout: 10000 });
      const dt = await page.evaluate(() => window.__pick);
      if (dt >= 0) tempos.push(dt);
    }
    medidas.pick3D = { cliques: tempos.length, tempo: resumo(tempos) };
    if (!tempos.length) pendencias.push(`[${rotulo}] pick 3D: nenhum clique mudou a seleção dentro de 3 s`);
  }
  await page.close().catch(() => {});
  return medidas;
}

const medidasPorProjeto = {};
for (const n of PROJETOS) {
  medidasPorProjeto[`${n}Pavimentos`] = { pavimentos: n, paredes: n * 32, ...(await medirProjeto(n)) };
}
const versao = browser.version();
for (const p of abertos) await p.close().catch(() => {});
await browser.close();

const data = {
  geradoEm: new Date().toISOString(),
  navegador: { executavel: chrome, versao, cabecalhoGPU: 'padrão do navegador (sem --use-angle=swiftshader)', headless: process.env.PERF_HEADED !== '1' },
  app: { endereco: app, modo },
  maquina: { so: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? '?', ramTotalGB: Number((os.totalmem() / 2 ** 30).toFixed(1)) },
  metodo: { repeticoes: RUNS, panPassos: PAN_STEPS, zoomPassos: ZOOM_STEPS, medida: 'do evento ao quadro seguinte pintado (rAF duplo)', rotulo: ROTULO, parede: `perf_w_<nivel do meio>_${PAREDE_IDX}, de (${PAREDE_X},${PAREDE_Y_A}) a (${PAREDE_X},${PAREDE_Y_B})`, edicao: `setWallEnds pelo store (editor.store.exec), deslocamento de ${DESLOCAMENTO_M} m alternado` },
  medidas: medidasPorProjeto,
  pendencias,
};
console.log(JSON.stringify(data, null, 2));
if (SAVE) {
  if (modo === 'dev') {
    console.error('Não gravado: o app é servidor de desenvolvimento. Baseline só com build de produção (npm run build).');
    process.exit(3);
  }
  const dir = path.join(ROOT, 'scripts', 'perf-baselines');
  mkdirSync(dir, { recursive: true });
  const arq = path.join(dir, `browser-20-pav-${new Date().toISOString().slice(0, 10)}-${ROTULO}.json`);
  writeFileSync(arq, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Gravado: ${arq}`);
}
process.exit(0);
