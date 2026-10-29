// Medição P1: tarefas longas na main thread — abertura, montagem 3D e edição (o aceite do worker de montagem).
//   node tests/e2e/montagem3d-tarefas.mjs <rotulo>
//   Variáveis: P1_RUNS (repetições, padrão 3), P1_CENARIOS (`pavimentos:paredes`, padrão `10:32,20:32,60:128`),
//   P1_DIST (diretório do build; padrão apps/web/dist), CHROME_PATH (Chrome ou Edge).
// Método: a página instala um PerformanceObserver de `longtask` antes do app; cada cenário limpa a lista, executa a ação
// (openFromText → 2 rAF → 3 s de cauda; duplo clique em "Modelo 3D" até a cena estabilizar; edição de parede pelo store
// → 3 s) e lê as tarefas. Grava scripts/perf-baselines/p1-tarefas-<rotulo>.json com o máximo, a mediana, o p95 e quantas
// tarefas passaram de 50 ms. Precisa do build servido por HTTP (module worker não sobe em file://).
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST = process.env.P1_DIST ? path.resolve(process.env.P1_DIST) : path.join(ROOT, 'apps', 'web', 'dist');
const ROTULO = process.argv[2] ?? 'antes';
const RUNS = Math.max(1, Number(process.env.P1_RUNS ?? 3));
const CENARIOS = (process.env.P1_CENARIOS ?? '10:32,20:32,60:128').split(',').map((s) => {
  const [n, w] = s.split(':');
  return { pav: Number(n), paredes: Number(w ?? 32) };
});
const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error('PENDENTE: Chrome não encontrado');
  process.exit(2);
}
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('PENDENTE: falta o build (apps/web/dist)');
  process.exit(2);
}

// Servidor estático mínimo (module worker exige http, não file://).
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const arq = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!arq.startsWith(DIST) || !existsSync(arq)) {
    res.writeHead(404).end('nao encontrado');
    return;
  }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' }).end(readFileSync(arq));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const APP = `http://127.0.0.1:${server.address().port}/index.html`;

const r2 = (x) => Number(x.toFixed(2));
const resumo = (xs) => {
  if (!xs.length) return 'PENDENTE';
  const s = [...xs].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return { n: s.length, mediana: r2(at(0.5)), p95: r2(at(0.95)), max: r2(s.at(-1)) };
};

/** Projeto sintético gerado pelo S2. */
function gerarProjeto(pav, paredes) {
  const saida = path.join(os.tmpdir(), `p1-${pav}x${paredes}.hestia.json`);
  if (existsSync(saida)) {
    const txt = readFileSync(saida, 'utf8');
    if (JSON.parse(txt).levels.length === pav) return txt;
  }
  execFileSync('npx', ['vite-node', 'scripts/perf-baselines/projeto-sintetico.mts', String(pav)], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: true,
    env: { ...process.env, PROJETO_SAIDA: saida, PROJETO_PAVIMENTOS: String(pav), PROJETO_PAREDES: String(paredes) },
  });
  return readFileSync(saida, 'utf8');
}

const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
const resultados = {};

/** Página nova com o observador de tarefas longas instalado antes do app. */
async function novaPagina() {
  const page = await navegador.newPage({ viewport: { width: 1440, height: 860 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) window.__long.push({ t: Math.round(e.startTime), d: Math.round(e.duration * 10) / 10, nome: e.name });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // sem longtask: fica vazio
    }
  });
  await page.goto(`${APP}?debug=1`);
  await page.waitForSelector('.canvas-wrap canvas', { timeout: 60000 });
  await page.waitForFunction(() => window.__hestia, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { page, erros };
}

const esperarQuadros = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

/** Limpa e lê as tarefas longas da página. */
const zerar = (page) => page.evaluate(() => { window.__long = []; });
const ler = (page) => page.evaluate(() => window.__long.splice(0));

for (const { pav, paredes } of CENARIOS) {
  const chave = `${pav}x${paredes}`;
  const texto = gerarProjeto(pav, paredes);
  const registro = { abertura: [], montagem3d: [], montagemMs: [], edicao: [], abrirMs: [] };

  for (let r = 0; r < RUNS; r++) {
    const { page, erros } = await novaPagina();
    // 1. Abertura (openFromText → 2 rAF → 3 s de cauda: cache, avisos, resolução de fundo).
    await zerar(page);
    const abrir = await page.evaluate(async ([t]) => {
      const t0 = performance.now();
      const ok = window.__hestia.editor.openFromText(t, 'p1.hestia.json');
      if (!ok.ok) throw new Error(ok.error);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return performance.now() - t0;
    }, [texto]);
    await page.waitForTimeout(3000);
    const tAbertura = await ler(page);
    registro.abertura.push(...tAbertura.map((x) => x.d));
    registro.abrirMs.push(abrir);

    // 2. Montagem 3D: abre a vista e espera a cena parar de crescer.
    await zerar(page);
    const t3d = await page.evaluate(async () => {
      const t0 = performance.now();
      const item = [...document.querySelectorAll('[role="treeitem"]')].find((e) => e.textContent?.includes('Modelo 3D'));
      item?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return t0;
    });
    await page.waitForFunction(() => window.__hestia3dModel, null, { timeout: 120000 });
    const montagem = await page.evaluate(async ([t0]) => {
      let anterior = '';
      let desde = performance.now();
      for (;;) {
        const m = window.__hestia3dModel;
        let malhas = 0, tris = 0, inst = 0;
        m.scene.traverse((o) => {
          if (!o.isMesh) return;
          malhas++;
          if (o.isInstancedMesh) { inst += o.count; return; }
          const g = o.geometry;
          tris += g.index ? g.index.count / 3 : (g.getAttribute('position')?.count ?? 0) / 3;
        });
        const ch = `${malhas}|${Math.round(tris)}|${inst}`;
        if (ch !== anterior) { anterior = ch; desde = performance.now(); }
        else if (performance.now() - desde >= 1500) return { ms: performance.now() - t0, malhas, tris: Math.round(tris) };
        await new Promise((r) => setTimeout(r, 100));
        if (performance.now() - t0 > 180000) return { ms: performance.now() - t0, malhas, tris: Math.round(tris), timeout: true };
      }
    }, [t3d]);
    registro.montagemMs.push(montagem.ms);
    const tMontagem = await ler(page);
    registro.montagem3d.push(...tMontagem.map((x) => x.d));

    // 3. Edição: move uma parede pelo store e deixa a cauda (avisos, resolução) correr.
    await page.evaluate(() => window.__hestia.editor.selectLevel('lv_0'));
    await esperarQuadros(page);
    await page.waitForTimeout(1000);
    await zerar(page);
    const idParede = await page.evaluate(() => {
      const p = window.__hestia.editor.project;
      const w = Object.values(p.elements).find((e) => e.kind === 'wall' && e.levelId === 'lv_0');
      return w ? w.id : null;
    });
    if (idParede) {
      await page.evaluate((id) => {
        const w = window.__hestia.editor.project.elements[id];
        window.__hestia.editor.store.exec({ type: 'setWallEnds', id, a: { x: w.a.x + 0.3, y: w.a.y }, b: { x: w.b.x + 0.3, y: w.b.y } });
      }, idParede);
      await page.waitForTimeout(3000);
      const tEdicao = await ler(page);
      registro.edicao.push(...tEdicao.map((x) => x.d));
    }
    if (erros.length) registro.erros = [...(registro.erros ?? []), ...erros.slice(0, 3)];
    await page.close();
  }

  const pico = (xs) => (xs.length ? r2(Math.max(...xs)) : null);
  const acima50 = (xs) => xs.filter((d) => d > 50).length;
  resultados[chave] = {
    abrirMs: resumo(registro.abrirMs),
    abertura: { tarefaMax: pico(registro.abertura), tarefasAcima50: acima50(registro.abertura), resumo: resumo(registro.abertura) },
    montagem3d: { duracao: resumo(registro.montagemMs), tarefaMax: pico(registro.montagem3d), tarefasAcima50: acima50(registro.montagem3d), resumo: resumo(registro.montagem3d) },
    edicao: { tarefaMax: pico(registro.edicao), tarefasAcima50: acima50(registro.edicao), resumo: resumo(registro.edicao) },
    ...(registro.erros ? { erros: registro.erros } : {}),
  };
  console.log(chave, JSON.stringify(resultados[chave]));
}

await navegador.close();
server.close();
mkdirSync(path.join(ROOT, 'scripts', 'perf-baselines'), { recursive: true });
const arq = path.join(ROOT, 'scripts', 'perf-baselines', `p1-tarefas-${ROTULO}.json`);
writeFileSync(arq, `${JSON.stringify({ rotulo: ROTULO, geradoEm: new Date().toISOString(), app: APP, repeticoes: RUNS, resultados }, null, 2)}\n`);
console.log(`Gravado: ${arq}`);
