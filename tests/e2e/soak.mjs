// Soak de estabilidade no navegador: abre 60×128, alterna pan/zoom na planta e órbita/zoom na 3D por N minutos e
// registra heap, erros de página e o backend de GPU. Evidência do H1.
//   node tests/e2e/soak.mjs --save        (SOAK_MIN=10 por padrão; use SOAK_MIN=60 para o soak de 1 h)
//   Variáveis: APP_URL (padrão: apps/web/dist), CHROME_PATH, SOAK_MIN, SOAK_PAV, SOAK_PAREDES, SOAK_HEADED=1
// Sem navegador ou build, sai com código 2 (PENDENTE). Erros de página ou perda de GPU saem com código 1.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIN = Math.max(0.1, Number(process.env.SOAK_MIN ?? 10));
const PAV = Math.max(1, Number(process.env.SOAK_PAV ?? 60));
const PAREDES = Math.max(4, Number(process.env.SOAK_PAREDES ?? 128));
const SAVE = process.argv.includes('--save');
const TIMEOUT_MS = 180_000;
const MB = (bytes) => Number((bytes / 2 ** 20).toFixed(1));

function acharChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null;
  return ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', local, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((c) => c && existsSync(c)) ?? null;
}

function acharApp() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const dist = path.join(ROOT, 'apps', 'web', 'dist', 'index.html');
  return existsSync(dist) ? pathToFileURL(dist).href : null;
}

function gerarProjeto() {
  const requerer = createRequire(import.meta.url);
  const pastaVN = path.dirname(requerer.resolve('vite-node/package.json'));
  const bin = path.join(pastaVN, 'vite-node.mjs');
  const saida = path.join(os.tmpdir(), `hestia-soak-${PAV}-${PAREDES}.hestia.json`);
  const inicio = Date.now();
  execFileSync(process.execPath, [bin, 'scripts/perf-baselines/projeto-sintetico.mts', String(PAV)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PROJETO_SAIDA: saida, PROJETO_PAVIMENTOS: String(PAV), PROJETO_PAREDES: String(PAREDES) },
  });
  return { texto: readFileSync(saida, 'utf8'), geracaoMs: Date.now() - inicio };
}

const chrome = acharChrome();
const app = acharApp();
if (!chrome) {
  console.error('PENDENTE: navegador não encontrado. Defina CHROME_PATH com o executável do Chrome ou Edge.');
  process.exit(2);
}
if (!app) {
  console.error('PENDENTE: falta o build do app (apps/web/dist/index.html). Rode `npm run build` ou defina APP_URL.');
  process.exit(2);
}

const arquivo = gerarProjeto();
const browser = await chromium.launch({ executablePath: chrome, headless: process.env.SOAK_HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const erros = [];
let acao = 'setup';
page.on('pageerror', (e) => erros.push(`[${acao}] ${e.stack ?? e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/i.test(m.text())) {
    const l = m.location();
    erros.push(`console: ${m.text()} (${l.url}:${l.lineNumber}:${l.columnNumber})`);
  }
});
const cdp = await page.context().newCDPSession(page);
const heapIsolado = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  return (await cdp.send('Runtime.getHeapUsage')).usedSize;
};

await page.addInitScript(`(() => {
  window.__soakHeap = [];
  setInterval(() => {
    const m = performance.memory;
    if (m) window.__soakHeap.push({ t: Math.round(performance.now()), mb: Math.round(m.usedJSHeapSize / 10485.76) / 100 });
  }, 5000);
})();`);
await page.goto(`${app}?debug=1`);
await page.waitForSelector('.canvas-wrap canvas', { timeout: TIMEOUT_MS });
await page.waitForFunction(() => window.__hestia, null, { timeout: TIMEOUT_MS });
const gpu = await page.evaluate(() => window.__hestia.useUi.getState().gpu);
if (gpu !== 'webgl2' && gpu !== 'webgpu') {
  console.error(`PENDENTE: sem GPU (backend ${gpu}); soak não mede o caminho real.`);
  await browser.close();
  process.exit(2);
}

const aberturaMs = await page.evaluate(async ([t, nome]) => {
  const t0 = performance.now();
  const ok = window.__hestia.editor.openFromText(t, nome);
  if (!ok.ok) throw new Error(ok.error);
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  return performance.now() - t0;
}, [arquivo.texto, `soak-${PAV}x${PAREDES}.hestia.json`]);

const idMeio = PAV === 1 ? 'lv_0' : PAV === 2 ? 'lv_1' : `perf_lv_${Math.floor(PAV / 2)}`;
await page.evaluate((id) => {
  window.__hestia.editor.selectLevel(id);
  const r = document.querySelector('.canvas-wrap')?.getBoundingClientRect();
  window.__hestia.editor.setViewport({ cx: 6, cy: 6, zoom: 30, width: Math.round(r?.width ?? 1440), height: Math.round(r?.height ?? 860) });
}, idMeio);
await page.waitForTimeout(1000);

const caixa = async () => {
  const b = await page.locator('.canvas-wrap canvas').first().boundingBox();
  if (!b) throw new Error('canvas sem caixa');
  return b;
};
const panPlanta = async () => {
  const b = await caixa();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  for (let k = 1; k <= 60; k++) await page.mouse.move(x + k * 2, y + k);
  await page.mouse.up({ button: 'middle' });
};
const zoomPlanta = async (n = 16) => {
  const b = await caixa();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let k = 1; k <= n; k++) {
    await page.mouse.wheel(0, k % 2 ? 100 : -100);
    await page.waitForTimeout(16);
  }
};
const abrir3d = async () => {
  const aba = page.getByRole('tab', { name: /Modelo 3D/ });
  if (await aba.count()) await aba.first().click({ timeout: 30_000 });
  else await page.getByRole('treeitem', { name: 'Modelo 3D' }).dblclick({ timeout: 30_000 });
  await page.waitForFunction(() => window.__hestia3dModel, null, { timeout: TIMEOUT_MS });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__hestia3dModel.fit());
};
const orbitar3d = async () => {
  const b = await caixa();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 40; k++) await page.mouse.move(x + Math.round(80 * Math.cos(k / 6)), y + Math.round(50 * Math.sin(k / 6)));
  await page.mouse.up();
  for (let k = 0; k < 10; k++) {
    await page.mouse.wheel(0, k % 2 ? 100 : -100);
    await page.waitForTimeout(16);
  }
};
const voltarPlanta = async () => {
  const aba = page.getByRole('tab', { name: /Planta|Térreo/ }).first();
  if (await aba.count()) await aba.click({ timeout: 30_000 }).catch(() => {});
  else await page.evaluate((id) => window.__hestia.editor.selectLevel(id), idMeio);
  await page.waitForTimeout(500);
};

const inicioIso = MB(await heapIsolado());
const t0 = Date.now();
const fim = t0 + MIN * 60_000;
console.log(`Soak ${PAV}×${PAREDES} · ${MIN} min · GPU ${gpu} · abertura ${aberturaMs.toFixed(0)} ms · heap ${inicioIso} MB`);
let ciclos = 0;
let ultimoAviso = t0;
while (Date.now() < fim) {
  acao = 'pan-planta';
  await panPlanta();
  acao = 'zoom-planta';
  await zoomPlanta();
  acao = 'voltar-planta';
  await voltarPlanta();
  if (ciclos % 2 === 1) {
    acao = 'abrir-3d';
    await abrir3d();
    acao = 'orbitar-3d';
    await orbitar3d();
    acao = 'voltar-planta';
    await voltarPlanta();
  }
  ciclos++;
  if (Date.now() - ultimoAviso >= 60_000) {
    ultimoAviso = Date.now();
    const mb = await page.evaluate(() => window.__soakHeap.at(-1)?.mb ?? null);
    console.log(`  ${Math.round((Date.now() - t0) / 1000)} s · ${ciclos} ciclos · heap ${mb ?? '?'} MB · erros ${erros.length}`);
  }
}
const amostras = await page.evaluate(() => window.__soakHeap.slice());
const fimIso = MB(await heapIsolado());
const picoJs = amostras.reduce((a, s) => Math.max(a, s.mb), 0);
const residuo = await page.evaluate(() => ({ niveis: window.__hestia.editor.project.levels.length, elementos: Object.keys(window.__hestia.editor.project.elements).length }));
const versaoNavegador = browser.version();
await browser.close();

const data = {
  geradoEm: new Date().toISOString(),
  projeto: { pavimentos: PAV, paredesPorPavimento: PAREDES, geracaoMs: arquivo.geracaoMs },
  duracaoMin: Number(((Date.now() - t0) / 60_000).toFixed(1)),
  ciclos,
  gpu,
  aberturaMs: Number(aberturaMs.toFixed(1)),
  heapMB: { inicioIsolado: inicioIso, fimIsolado: fimIso, picoJs, crescimentoIsolado: Number((fimIso - inicioIso).toFixed(1)), amostras: amostras.length },
  residuo,
  erros,
  navegador: { versao: versaoNavegador, headless: process.env.SOAK_HEADED !== '1', executavel: chrome },
};
console.log(JSON.stringify(data, null, 2));
if (SAVE) {
  const dir = path.join(ROOT, 'scripts', 'perf-baselines');
  mkdirSync(dir, { recursive: true });
  const arq = path.join(dir, `soak-${PAV}x${PAREDES}-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(arq, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Gravado: ${arq}`);
}
if (erros.length) process.exit(1);
