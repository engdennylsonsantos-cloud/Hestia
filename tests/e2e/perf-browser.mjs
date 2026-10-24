// Medição de desempenho no navegador (frente G): o que o usuário sente na web, que o baseline de Node não mostra.
//   npm run perf:browser          (precisa de apps/web/dist: rode `npm run build` antes, ou defina APP_URL)
//   Variáveis: CHROME_PATH (Chrome ou Edge; sem ele, procura a instalação padrão do Windows), APP_URL (ex.: o servidor
//   de dev, http://localhost:5179: NÃO é baseline, só para testar o roteiro), PERF_RUNS (repetições, padrão 5),
//   PERF_HEADED=1 (janela visível). Com --save grava scripts/perf-baselines/browser-<data>.json.
// O que mede, no projeto sintético de 10 pavimentos (scripts/perf-baselines/projeto-sintetico.mts):
//   1. abertura: do openFromText ao segundo quadro pintado (rAF duplo), e a primeira pintura da página (FCP);
//   2. pan (botão do meio) e zoom (roda) na planta: do evento ao quadro seguinte pintado (média e p95);
//   3. clique de pick na 3D: do pointerup até a seleção mudar (média e p95).
// Sem navegador ou sem build, sai com código 2 e a mensagem do que falta: o baseline de navegador fica PENDENTE.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNS = Math.max(1, Number(process.env.PERF_RUNS ?? 5));
const SAVE = process.argv.includes('--save');
const PAVIMENTOS = 10;
const PAN_STEPS = 60;
const ZOOM_STEPS = 30;

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
  const s = [...amostras].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return { n: s.length, medianaMs: r2(at(0.5)), p95Ms: r2(at(0.95)), mediaMs: r2(s.reduce((a, b) => a + b, 0) / s.length), minMs: r2(s[0]), maxMs: r2(s.at(-1)) };
}

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

// Projeto de 10 pavimentos, gerado pelo mesmo gerador do baseline de Node (vite-node resolve os @hestia/*).
const projPath = path.join(os.tmpdir(), `hestia-perf-${PAVIMENTOS}.hestia.json`);
execSync(`npx vite-node scripts/perf-baselines/projeto-sintetico.mts ${PAVIMENTOS}`, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PROJETO_SAIDA: projPath } });
const texto = readFileSync(projPath, 'utf8');

const browser = await chromium.launch({ executablePath: chrome, headless: process.env.PERF_HEADED !== '1' });
const pendencias = [];
const medidas = {};
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

// 1. Abertura do projeto de 10 pavimentos até o segundo quadro pintado.
let ultima = null;
const abertura = [];
const fcp = [];
const carregamento = [];
for (let r = 0; r < RUNS; r++) {
  const { page, erros, carregamentoMs } = await novaPagina();
  const res = await page.evaluate(async (t) => {
    const paint = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
    const t0 = performance.now();
    const ok = window.__hestia.editor.openFromText(t, 'perf-10.hestia.json');
    if (!ok.ok) throw new Error(ok.error);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { ms: performance.now() - t0, fcp: paint ? paint.startTime : null, niveis: window.__hestia.editor.project.levels.length };
  }, texto);
  if (res.niveis !== PAVIMENTOS) pendencias.push(`abertura: esperava ${PAVIMENTOS} níveis, carregou ${res.niveis}`);
  abertura.push(res.ms);
  if (res.fcp !== null) fcp.push(res.fcp);
  carregamento.push(carregamentoMs);
  if (erros.length) pendencias.push(`erros de página na abertura: ${erros.slice(0, 3).join(' | ')}`);
  ultima = page;
}
medidas.abertura10Pavimentos = {
  abrirProjeto: resumo(abertura),
  carregarPaginaAteAppPronto: resumo(carregamento),
  primeiraPinturaFCP: fcp.length ? resumo(fcp) : 'indisponível',
};

// 2. Pan e zoom na planta: do evento ao quadro seguinte pintado.
const pan = [];
const zoom = [];
{
  const page = ultima;
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
  medidas.planta10Pavimentos = { pan: pan.length ? resumo(pan) : 'PENDENTE', zoom: zoom.length ? resumo(zoom) : 'PENDENTE' };
  if (!pan.length) pendencias.push('pan: nenhuma amostra (o canvas da planta não respondeu ao botão do meio)');
  if (!zoom.length) pendencias.push('zoom: nenhuma amostra (a roda não chegou ao canvas da planta)');
}

// 3. Clique de pick na 3D: pointerup até a seleção mudar.
{
  const page = ultima;
  await page.getByRole('tab', { name: /Modelo 3D/ }).click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__hestia3dModel.fit());
  await page.waitForTimeout(400);
  const box = await page.locator('.canvas-wrap canvas').first().boundingBox();
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
  let alvo = null;
  const fracoes = [0.5, 0.4, 0.6, 0.3, 0.7];
  search: for (const fy of fracoes) for (const fx of fracoes) {
    await selecionar(box.x + box.width * fx, box.y + box.height * fy);
    const n = await page.evaluate(() => window.__hestia.useUi.getState().selection.length);
    if (n > 0) { alvo = { x: box.x + box.width * fx, y: box.y + box.height * fy }; break search; }
  }
  if (!alvo) {
    medidas.pick3D = 'PENDENTE';
    pendencias.push('pick 3D: nenhum ponto da tela pegou elemento (a cena 3D não montou ou o modelo não está enquadrado)');
  } else {
    const tempos = [];
    for (let k = 0; k < RUNS * 4; k++) {
      await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));
      await armar();
      await page.mouse.click(alvo.x, alvo.y);
      await page.waitForFunction(() => window.__pick !== null, null, { timeout: 10000 });
      const dt = await page.evaluate(() => window.__pick);
      if (dt >= 0) tempos.push(dt);
    }
    medidas.pick3D = { ponto: { x: r2(alvo.x - box.x), y: r2(alvo.y - box.y) }, cliques: tempos.length, pickClique: tempos.length ? resumo(tempos) : 'PENDENTE' };
    if (!tempos.length) pendencias.push('pick 3D: nenhum clique mudou a seleção dentro de 3 s');
  }
}

for (const p of abertos) await p.close().catch(() => {});
const versao = browser.version();
await browser.close();

const data = {
  geradoEm: new Date().toISOString(),
  navegador: { executavel: chrome, versao, cabecalhoGPU: 'padrão do navegador (sem --use-angle=swiftshader)', headless: process.env.PERF_HEADED !== '1' },
  app: { endereco: app, modo },
  maquina: { so: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? '?', ramTotalGB: Number((os.totalmem() / 2 ** 30).toFixed(1)) },
  projeto: { pavimentos: PAVIMENTOS, paredes: PAVIMENTOS * 32 },
  metodo: { repeticoes: RUNS, panPassos: PAN_STEPS, zoomPassos: ZOOM_STEPS, medida: 'do evento ao quadro seguinte pintado (rAF duplo)' },
  medidas,
  pendencias,
};
console.log(JSON.stringify(data, null, 2));
if (SAVE) {
  const dir = path.join(ROOT, 'scripts', 'perf-baselines');
  mkdirSync(dir, { recursive: true });
  const arq = path.join(dir, `browser-${new Date().toISOString().slice(0, 10)}-${modo}.json`);
  writeFileSync(arq, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Gravado: ${arq}`);
}
process.exit(0);
