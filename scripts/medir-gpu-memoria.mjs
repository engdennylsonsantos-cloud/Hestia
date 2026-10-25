// Medição de GPU e de memória do navegador (linha de base antes da onda 5): quantas chamadas de desenho (draw calls),
// triângulos e malhas a planta e a 3D enviam por quadro, e quanta memória a aba e o Chrome usam, nos projetos sintéticos
// de 10, 20 e 30 pavimentos (scripts/perf-baselines/projeto-sintetico.mts).
//   npm run medir:gpu                  (mede e grava scripts/perf-baselines/gpu-memoria-<rotulo>.json)
//   Variáveis: PERF_ROTULO (rótulo do arquivo, padrão `antes`), PERF_RUNS (repetições por cenário, padrão 3),
//   CHROME_PATH (Chrome ou Edge), APP_URL (padrão: apps/web/dist, o build de produção), PERF_HEADED=1 (janela visível),
//   MEDIR_VITE_NODE_CONFIG (config extra do vite-node; só para worktree sem node_modules, ver o relatório da frente).
// Método:
//   - Draw calls e triângulos: a página intercepta as chamadas de desenho do WebGL2 (drawArrays, drawElements e as
//     variantes instanciadas) e as agrupa por quadro (entre dois requestAnimationFrame). O renderer.info do three não é
//     exposto pelo app; a contagem por chamada GL dá o mesmo número (um draw por malha não instanciada).
//   - Malhas: na 3D, contagem de Mesh na cena do ModelScene (gancho ?debug=1). Na planta a cena não é exposta: as draw
//     calls por quadro servem de proxy para as malhas visíveis.
//   - Memória: heap JS da aba (performance.memory, amostrado a cada 50 ms, com pico) e heap do isolado V8 (CDP
//     Runtime.getHeapUsage, após coleta de lixo). Processos do Chrome: soma de WorkingSetSize da árvore do navegador que o
//     Playwright abriu (só no Windows; amostrada a cada 1 s, com pico).
// Sem navegador ou sem build, sai com código 2 (PENDENTE). Em modo de desenvolvimento não grava (código 3).
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Math.max(1, Number(process.env.PERF_RUNS ?? 3));
const ROTULO = (process.env.PERF_ROTULO ?? 'antes').replace(/[^\w-]/g, '-');
const SAVE = process.argv.includes('--save');
const PROJETOS = [10, 20, 30];
const JANELA_PLANTA_MS = 800;
const JANELA_3D_MS = 1200;
const MB = (bytes) => Number((bytes / 2 ** 20).toFixed(1));

/** Mediana (metade inferior em par), mínimo e máximo de uma lista de números. */
const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const faixa = (v) => (v.length ? { mediana: mediana(v), minimo: Math.min(...v), maximo: Math.max(...v), n: v.length } : 'PENDENTE');

/** Executável do Chrome ou Edge: CHROME_PATH primeiro, depois as instalações padrão do Windows (e do Linux). */
function acharChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
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

/** Gera o projeto de `n` pavimentos com o gerador da frente de desempenho e devolve o texto do .hestia.json. */
function gerarProjeto(n) {
  const requerer = createRequire(import.meta.url);
  const pastaVN = path.dirname(requerer.resolve('vite-node/package.json'));
  const bin = path.join(pastaVN, 'vite-node.mjs');
  const cfg = process.env.MEDIR_VITE_NODE_CONFIG ? ['-c', process.env.MEDIR_VITE_NODE_CONFIG] : [];
  const saida = path.join(os.tmpdir(), `hestia-gpu-${n}.hestia.json`);
  execFileSync(process.execPath, [bin, ...cfg, 'scripts/perf-baselines/projeto-sintetico.mts', String(n)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PROJETO_SAIDA: saida },
  });
  return readFileSync(saida, 'utf8');
}

/** Soma de WorkingSetSize da árvore do Chrome que tem a marca na linha de comando (só Windows; null nos demais). */
function amostrarProcessos(nomeExe, marca) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  const ps = `@(Get-CimInstance Win32_Process -Filter "name='${nomeExe}'" | Select-Object ProcessId,ParentProcessId,CommandLine,WorkingSetSize) | ConvertTo-Json -Compress`;
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-Command', ps], { maxBuffer: 1 << 26, timeout: 30000 }, (err, out) => {
      if (err || !out.trim()) return resolve(null);
      const itens = JSON.parse(out);
      const raiz = itens.find((p) => String(p.CommandLine ?? '').includes(marca));
      if (!raiz) return resolve(null);
      const arvore = new Set([raiz.ProcessId]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const p of itens) if (!arvore.has(p.ProcessId) && arvore.has(p.ParentProcessId)) { arvore.add(p.ProcessId); mudou = true; }
      }
      const membros = itens.filter((p) => arvore.has(p.ProcessId));
      resolve({ wsMB: MB(membros.reduce((a, p) => a + Number(p.WorkingSetSize ?? 0), 0)), processos: membros.length });
    });
  });
}

/** Amostragem de processos a cada segundo, com pico; `parar` devolve o pico e a última amostra. */
function criarAmostrador(nomeExe, marca) {
  const st = { pico: null, ultima: null, ocupado: false, ativo: true };
  const tick = async () => {
    if (st.ocupado || !st.ativo) return;
    st.ocupado = true;
    const s = await amostrarProcessos(nomeExe, marca);
    st.ocupado = false;
    if (s) {
      st.ultima = s;
      if (!st.pico || s.wsMB > st.pico.wsMB) st.pico = s;
    }
  };
  const timer = setInterval(tick, 1000);
  return { st, parar: () => { st.ativo = false; clearInterval(timer); } };
}

/*
 * Código injetado em cada página antes do app: intercepta as chamadas de desenho do WebGL2, agrupa por quadro (cada
 * requestAnimationFrame fecha um segmento) e amostra o heap JS da aba com pico.
 */
const INSTRUMENTO = `(() => {
  const seg = { calls: 0, tris: 0 };
  window.__glQuadros = [];
  const tris = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
  const mapa = {
    drawArrays: (a) => [a[0], a[2], 1],
    drawElements: (a) => [a[0], a[1], 1],
    drawArraysInstanced: (a) => [a[0], a[2], a[3]],
    drawElementsInstanced: (a) => [a[0], a[1], a[4]],
    drawRangeElements: (a) => [a[0], a[3], 1],
  };
  for (const P of [window.WebGL2RenderingContext && WebGL2RenderingContext.prototype].filter(Boolean)) {
    for (const nome of Object.keys(mapa)) {
      const orig = P[nome];
      if (!orig) continue;
      P[nome] = function (...args) {
        const [mode, n, inst] = mapa[nome](args);
        seg.calls += 1;
        seg.tris += tris(mode, n) * inst;
        return orig.apply(this, args);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    if (seg.calls) window.__glQuadros.push({ calls: seg.calls, tris: seg.tris });
    seg.calls = 0;
    seg.tris = 0;
    return cb(t);
  });
  window.__heapPico = 0;
  setInterval(() => {
    // performance.memory é lido à parte: a pilha do V8 (CDP) é a referência de memória.
    const m = performance.memory;
    if (m && m.usedJSHeapSize > window.__heapPico) window.__heapPico = m.usedJSHeapSize;
  }, 50);
})();`;

/** Lê o quadro de maior número de draw calls dentro de uma janela (o quadro cheio da cena). */
async function quadroCheio(page, acao, janelaMs) {
  await page.evaluate(() => { window.__glQuadros.length = 0; });
  await acao();
  await page.waitForTimeout(janelaMs);
  const qs = await page.evaluate(() => window.__glQuadros.slice());
  if (!qs.length) return null;
  return qs.reduce((a, b) => (b.calls > a.calls ? b : a));
}

/** Malhas da cena 3D: total, visíveis (com os pais visíveis) e triângulos da geometria das malhas visíveis. */
const contarMalhas3d = (page) => page.evaluate(() => {
  const m = window.__hestia3dModel;
  let total = 0;
  let visiveis = 0;
  let triangulos = 0;
  m.scene.traverse((o) => {
    if (!o.isMesh) return;
    total++;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    visiveis++;
    const g = o.geometry;
    triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { total, visiveis, triangulosGeometria: Math.round(triangulos) };
});

/** Id do pavimento i (mesma convenção de projeto-sintetico.mts). */
const idNivel = (i) => (i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `perf_lv_${i}`);

/** Medição de um projeto: planta e 3D (draw calls, triângulos, malhas) e memória (pico e estável). */
async function medirProjeto(browser, app, n, pendencias, amostrador) {
  const rotulo = `${n} pav`;
  const texto = gerarProjeto(n);
  const idMeio = idNivel(Math.floor(n / 2));
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(INSTRUMENTO);
  await page.goto(`${app}?debug=1`);
  await page.waitForSelector('.canvas-wrap canvas', { timeout: 60000 });
  await page.waitForFunction(() => window.__hestia, null, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  const heapCDP = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const h = await cdp.send('Runtime.getHeapUsage');
    return h.usedSize;
  };
  const jsHeap = () => page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);

  const memAntes = { jsMB: MB((await jsHeap()) ?? 0), isolateMB: MB(await heapCDP()) };
  const gpu = await page.evaluate(() => window.__hestia.useUi.getState().gpu);
  if (gpu !== 'webgl2' && gpu !== 'webgpu') pendencias.push(`[${rotulo}] sem GPU (backend ${gpu}): draw calls não medidas`);

  await page.evaluate(() => { window.__heapPico = 0; });
  await page.evaluate((t) => {
    const ok = window.__hestia.editor.openFromText(t, 'perf.hestia.json');
    if (!ok.ok) throw new Error(ok.error);
  }, texto);
  await page.waitForTimeout(500);
  const picoAbertura = await page.evaluate(() => window.__heapPico);
  if (erros.length) pendencias.push(`[${rotulo}] erros de página: ${erros.slice(0, 3).join(' | ')}`);

  const planta = [];
  const modelo = [];
  for (let r = 0; r < RUNS; r++) {
    // Planta: volta ao térreo, depois troca para o nível do meio (o quadro cheio é o de maior número de draw calls).
    await page.evaluate(() => window.__hestia.editor.selectLevel('lv_0'));
    await page.waitForTimeout(JANELA_PLANTA_MS);
    const p = await quadroCheio(page, () => page.evaluate((id) => window.__hestia.editor.selectLevel(id), idMeio), JANELA_PLANTA_MS);
    if (p) planta.push(p);
    // 3D: troca para a aba, espera a montagem da cena, enquadra e força um quadro novo (o renderer desenha sob demanda:
    // sem a troca de `previewTick` o quadro cheio pode não sair). O quadro cheio é o de maior número de draw calls.
    const d = await quadroCheio(
      page,
      async () => {
        await page.locator('button.leaf', { hasText: 'Modelo 3D' }).click();
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
          window.__hestia3dModel.fit();
          window.__hestia.useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
        });
      },
      JANELA_3D_MS,
    );
    if (d) modelo.push(d);
  }
  const malhas = await contarMalhas3d(page);

  // Memória estável: volta à planta, espera e coleta lixo antes de ler.
  await page.evaluate(() => window.__hestia.editor.selectLevel('lv_0'));
  await page.waitForTimeout(3000);
  const memEstavel = { jsMB: MB((await jsHeap()) ?? 0), isolateMB: MB(await heapCDP()) };
  const picoTotalJs = await page.evaluate(() => window.__heapPico);
  await page.waitForTimeout(1100);
  const processoEstavel = amostrador.st.ultima;
  await page.close().catch(() => {});

  const resumoDesenho = (lista) =>
    lista.length ? { drawCalls: faixa(lista.map((q) => q.calls)), triangulos: faixa(lista.map((q) => Math.round(q.tris))) } : 'SEM QUADRO';
  if (!planta.length) pendencias.push(`[${rotulo}] planta: nenhum quadro com draw call`);
  if (!modelo.length) pendencias.push(`[${rotulo}] 3D: nenhum quadro com draw call`);
  return {
    pavimentos: n,
    paredes: n * 32,
    planta: resumoDesenho(planta),
    modelo3d: { ...resumoDesenho(modelo), malhas },
    memoria: {
      jsHeapMB: { antes: memAntes.jsMB, picoAbertura: MB(picoAbertura), picoTotal: MB(picoTotalJs), estavel: memEstavel.jsMB },
      isolateUsadoMB: { antes: memAntes.isolateMB, estavel: memEstavel.isolateMB },
      processosChromeMB: { pico: amostrador.st.pico, estavel: processoEstavel },
    },
  };
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

const nomeExe = `${path.basename(chrome, '.exe')}.exe`;
const marca = `--hestia-medicao=${randomUUID()}`;
const browser = await chromium.launch({ executablePath: chrome, headless: process.env.PERF_HEADED !== '1', args: [marca] });
const versao = browser.version();
const pendencias = [];
const projetos = {};
const modo = await (async () => {
  const page = await browser.newPage();
  await page.goto(`${app}?debug=1`);
  const dev = await page.evaluate(() => !!document.querySelector('script[src*="/@vite/client"]')).catch(() => false);
  await page.close();
  return dev ? 'dev' : 'producao';
})();
if (modo === 'dev') pendencias.push('app é servidor de desenvolvimento: números NÃO são baseline');

// Um amostrador de processos por projeto; o pico do processo é o maior visto durante a medição do projeto.
for (const n of PROJETOS) {
  const amostrador = criarAmostrador(nomeExe, marca);
  try {
    projetos[`${n}Pavimentos`] = await medirProjeto(browser, app, n, pendencias, amostrador);
  } finally {
    amostrador.parar();
  }
}
await browser.close();

const data = {
  geradoEm: new Date().toISOString(),
  rotulo: ROTULO,
  navegador: { executavel: chrome, versao, headless: process.env.PERF_HEADED !== '1' },
  app: { endereco: app, modo },
  maquina: { so: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? '?', ramTotalGB: Number((os.totalmem() / 2 ** 30).toFixed(1)) },
  metodo: {
    repeticoes: RUNS,
    draws: 'interceptação de drawArrays/drawElements (e instanciadas) do WebGL2, por quadro (rAF); mediana e faixa entre repetições do quadro cheio',
    planta: `nível do meio após troca de nível, viewport do roteiro de navegador (zoom 30)`,
    modelo3d: 'troca para a aba 3D e enquadramento (fit), quadro cheio entre repetições',
    malhas: 'Mesh na cena do ModelScene (apenas 3D)',
    memoria: 'heap JS (performance.memory, pico amostrado a 50 ms; neste Chrome o valor não acompanha o projeto, ver isolateUsadoMB) e heap do V8 via CDP (Runtime.getHeapUsage) após coleta de lixo; processos do Chrome por WorkingSetSize (Windows)',
  },
  projetos,
  pendencias,
};
console.log(JSON.stringify(data, null, 2));

if (modo === 'dev' && !SAVE) {
  console.error('Não gravado: o app é servidor de desenvolvimento. Baseline só com build de produção (npm run build).');
  process.exit(3);
}
const dir = path.join(ROOT, 'scripts', 'perf-baselines');
mkdirSync(dir, { recursive: true });
const arq = path.join(dir, `gpu-memoria-${ROTULO}.json`);
writeFileSync(arq, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Gravado: ${arq}`);
process.exit(0);
