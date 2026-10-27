// Verificação visual da Fase 1 (A2) — roteiro reproduzível com capturas e tabela esperado × observado.
//
//   node tests/e2e/verificacao-visual.mjs
//   node tests/e2e/verificacao-visual.mjs --item cotas
//   node tests/e2e/verificacao-visual.mjs --list
//   node tests/e2e/verificacao-visual.mjs --strict      (sai com código 1 se algum item falhar)
//
// Abre o build `apps/web/dist/index.html` por file:// (ou APP_URL / --url), com `?debug=1`, em Chrome/Edge real
// (CHROME_PATH / --browser; na falta, o Chromium do playwright-core) e grava um PNG por critério em
// `tests/e2e/out/verificacao-visual/`. No fim grava `resultados.md` e `resumo.json` na mesma pasta.
//
// Não compara com baseline: cada critério é medido no DOM, no projeto (`window.__hestia`) ou nos pixels da captura.
// Não altera produto, baseline antiga nem scripts de performance.
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decodePng } from './visual.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(RAIZ);

const OUT = 'tests/e2e/out/verificacao-visual';
const DIST = 'apps/web/dist/index.html';
const VIEWPORT = { width: 1440, height: 900 };
const PIXEL_THRESHOLD = 18; // distância de canal que separa tinta do fundo/grid claro
const ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// ---------- argumentos ----------
const argv = process.argv.slice(2);
const arg = (nome) => {
  const i = argv.indexOf(nome);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LISTAR = argv.includes('--list');
const ESTRITO = argv.includes('--strict');
const FILTRO = arg('--item') ?? null;
const URL_APP = arg('--url') ?? process.env.APP_URL ?? pathToFileURL(path.resolve(DIST)).href;
const URL_TESTE = URL_APP.includes('?') ? `${URL_APP}&debug=1` : `${URL_APP}?debug=1`;

const CANDIDATOS_CHROME = [
  arg('--browser'),
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
].filter(Boolean);

// ---------- infraestrutura de relatório ----------
const resultados = [];
let itemAtual = null;

function check(criterio, esperado, observado, ok, imagem = '') {
  const veredito = ok === 'PENDENTE' ? 'PENDENTE' : ok ? 'PASS' : 'FAIL';
  const linha = {
    item: itemAtual.id,
    itemNome: itemAtual.nome,
    criterio,
    esperado: String(esperado),
    observado: String(observado),
    veredito,
    imagem,
  };
  resultados.push(linha);
  const marca = veredito === 'PASS' ? 'ok   ' : veredito === 'FAIL' ? 'FALHA' : 'PEND.';
  console.log(`  ${marca} ${criterio}: ${linha.observado}${imagem ? `  [${imagem}.png]` : ''}`);
  return linha;
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function gerarRelatorios(browserInfo, errosGlobais) {
  const resumo = {
    geradoEm: new Date().toISOString(),
    url: URL_TESTE,
    navegador: browserInfo,
    viewport: VIEWPORT,
    total: resultados.length,
    pass: resultados.filter((r) => r.veredito === 'PASS').length,
    fail: resultados.filter((r) => r.veredito === 'FAIL').length,
    pendente: resultados.filter((r) => r.veredito === 'PENDENTE').length,
    resultados,
    errosGlobais,
  };
  writeFileSync(path.join(OUT, 'resumo.json'), JSON.stringify(resumo, null, 2));
  const tabela = [
    '| Item | Critério | Esperado | Observado | Veredito | Captura |',
    '|---|---|---|---|---|---|',
    ...resultados.map((r) => {
      const capturas = r.imagem
        ? r.imagem.split(' / ').map((n) => `[\`${n}.png\`](./${n}.png)`).join('<br>')
        : '—';
      return `| ${esc(r.itemNome)} | ${esc(r.criterio)} | ${esc(r.esperado)} | ${esc(r.observado)} | **${r.veredito}** | ${capturas} |`;
    }),
  ].join('\n');
  const md = [
    '# Verificação visual — resultados da execução',
    '',
    `- **Gerado em:** ${resumo.geradoEm}`,
    `- **URL:** \`${URL_TESTE}\``,
    `- **Navegador:** ${browserInfo}`,
    `- **Viewport:** ${VIEWPORT.width}×${VIEWPORT.height} (deviceScaleFactor 1)`,
    `- **Resumo:** ${resumo.pass} PASS · ${resumo.fail} FAIL · ${resumo.pendente} PENDENTE`,
    '',
    tabela,
    '',
    '## Erros de página',
    '',
    errosGlobais.length ? errosGlobais.map((e) => `- ${esc(e)}`).join('\n') : 'Nenhum.',
    '',
  ].join('\n');
  writeFileSync(path.join(OUT, 'resultados.md'), md);
  return resumo;
}

// ---------- página e esperas ----------
function instalarAjudantes() {
  const W = (id, a, b, extra = {}) => ({
    id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0',
    a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] },
    baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0,
    locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false,
    joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false },
    sag: 0, topProfile: null, mark: '', comments: '', ...extra,
  });
  const OPEN = (id, kind, typeId, hostId, offset) => ({
    kind: 'opening',
    opening: { id, kind, typeId, hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const paredes = () => [W('w1', [0, 0], [8, 0]), W('w2', [8, 0], [8, 6]), W('w3', [8, 6], [0, 6]), W('w4', [0, 6], [0, 0])];
  window.__a2 = { W, OPEN, paredes };
}

async function abrirPagina(browser, erros) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(`[pageerror] ${e.message}`));
  await page.addInitScript(instalarAjudantes);
  await page.goto(URL_TESTE);
  await page.waitForSelector('.canvas-wrap canvas');
  await page.waitForFunction(() => window.__hestia);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page;
}

/** Espera o canvas e a vista do editor assentarem (mesma espera de visual-regression.mjs). */
async function assentar(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const canvas = () => document.querySelector('.canvas-wrap canvas');
    const medir = () => { const r = canvas()?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : ''; };
    const vistaIgual = () => {
      const v = window.__hestia.editor.viewport();
      const r = canvas()?.getBoundingClientRect();
      return !!v && !!r && v.width === Math.round(r.width) && v.height === Math.round(r.height);
    };
    let anterior = '';
    let iguais = 0;
    let tentativas = 0;
    const passo = () => {
      const atual = medir();
      iguais = atual !== '' && atual === anterior ? iguais + 1 : 0;
      anterior = atual;
      if ((iguais >= 1 && vistaIgual()) || ++tentativas > 100) return requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      setTimeout(passo, 50);
    };
    passo();
  }));
  await page.waitForTimeout(120);
}

async function aplicarZoom(page, cx, cy, zoom) {
  await page.evaluate(({ cx, cy, zoom }) => {
    const v = window.__hestia.editor.viewport();
    if (v) window.__hestia.editor.setViewport({ ...v, cx, cy, zoom });
  }, { cx, cy, zoom });
  await assentar(page);
}

/** Enquadra a caixa de mundo na área do canvas, com uma folga. */
async function enquadrar(page, caixa, folga = 1.06) {
  await assentar(page);
  const v = await page.evaluate(() => window.__hestia.editor.viewport());
  if (!v) return;
  const w = Math.max(0.5, caixa.x1 - caixa.x0);
  const h = Math.max(0.5, caixa.y1 - caixa.y0);
  const zoom = Math.min(v.width / (w * folga), v.height / (h * folga));
  await aplicarZoom(page, (caixa.x0 + caixa.x1) / 2, (caixa.y0 + caixa.y1) / 2, zoom);
}

async function tirar(page, nome) {
  const arquivo = path.join(OUT, `${nome}.png`);
  await page.locator('.canvas-wrap').screenshot({ path: arquivo, animations: 'disabled' });
  const img = decodePng(readFileSync(arquivo));
  return { nome, img };
}

/** Rótulos da camada DOM da planta (cotas, textos, etiquetas e marcas). */
async function rotulos(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return [...document.querySelectorAll('.labels .plan-note, .labels .dim-label')].map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return {
        text: e.textContent ?? '',
        fontPx: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        textAlign: cs.textAlign,
        whiteSpace: cs.whiteSpace,
        w: r.width,
        h: r.height,
        cx: r.left - wrap.left + r.width / 2,
        cy: r.top - wrap.top + r.height / 2,
        dentro: r.left >= wrap.left - 1 && r.right <= wrap.right + 1 && r.top >= wrap.top - 1 && r.bottom <= wrap.bottom + 1,
      };
    });
  });
}

// ---------- leitura de pixels ----------
const tela = (v, x, y) => ({ x: v.width / 2 + (x - v.cx) * v.zoom, y: v.height / 2 - (y - v.cy) * v.zoom });
const cor = (img, x, y) => {
  const i = (Math.round(y) * img.w + Math.round(x)) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
};
const distCor = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const ehTinta = (p, fundo, limiar = PIXEL_THRESHOLD) => distCor(p, fundo) > limiar;
const diffImagens = (a, b) => {
  if (a.w !== b.w || a.h !== b.h) return { frac: 1, count: a.w * a.h, azul: 0, total: a.w * a.h };
  let count = 0;
  let azul = 0;
  const total = a.w * a.h;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (distCor([a.rgba[i], a.rgba[i + 1], a.rgba[i + 2]], [b.rgba[i], b.rgba[i + 1], b.rgba[i + 2]]) > 12) {
      count++;
      if (b.rgba[i + 2] > b.rgba[i] + 40) azul++;
    }
  }
  return { frac: count / total, count, azul, total };
};

/** Perfil de tinta ao longo de um segmento de mundo: colunas com tinta, ciclos (runs) e ocupação. */
function perfilLinha(img, v, a, b, { raio = 2, passos = 1, fundo } = {}) {
  const p = tela(v, a.x, a.y);
  const q = tela(v, b.x, b.y);
  const n = Math.max(2, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / passos));
  // A procura é só perpendicular ao traço: alargar na direção da linha fecharia os vãos do tracejado.
  const ux = (q.x - p.x) / Math.max(1e-9, Math.hypot(q.x - p.x, q.y - p.y));
  const uy = (q.y - p.y) / Math.max(1e-9, Math.hypot(q.x - p.x, q.y - p.y));
  const nx = -uy;
  const ny = ux;
  const marcas = [];
  for (let i = 0; i <= n; i++) {
    const x = p.x + ((q.x - p.x) * i) / n;
    const y = p.y + ((q.y - p.y) * i) / n;
    let tinta = false;
    for (let s = -raio; s <= raio && !tinta; s++) {
      const px = x + nx * s;
      const py = y + ny * s;
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
      if (ehTinta(cor(img, px, py), fundo)) tinta = true;
    }
    marcas.push(tinta);
  }
  let ciclos = 0;
  for (let i = 0; i < marcas.length; i++) if (marcas[i] && (i === 0 || !marcas[i - 1])) ciclos++;
  return { amostras: marcas.length, cobertas: marcas.filter(Boolean).length, ocupacao: marcas.filter(Boolean).length / marcas.length, ciclos };
}

/** Fundo de papel: a cor mais frequente da captura (a grade e o desenho ocupam menos pixels). */
function fundoDe(img) {
  const contagem = new Map();
  let melhor = [251, 251, 250];
  let melhorN = 0;
  for (let y = 0; y < img.h; y += 3) {
    for (let x = 0; x < img.w; x += 3) {
      const p = cor(img, x, y);
      const chave = `${p[0]},${p[1]},${p[2]}`;
      const n = (contagem.get(chave) ?? 0) + 1;
      contagem.set(chave, n);
      if (n > melhorN) { melhorN = n; melhor = p; }
    }
  }
  return melhor;
}

// ---------- itens ----------
let pageErros = [];

async function fimDoItem(page) {
  await page.waitForTimeout(150);
  check('sem erro de página', 'nenhum erro de console/pageerror', `${pageErros.length} erro(s)${pageErros.length ? `: ${pageErros.slice(0, 3).join(' | ')}` : ''}`, pageErros.length === 0);
  await page.close();
}

function temTintaEm(img, ponto, raio, fundo) {
  for (let dx = -raio; dx <= raio; dx++) {
    for (let dy = -raio; dy <= raio; dy++) {
      const x = ponto.x + dx;
      const y = ponto.y + dy;
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      if (ehTinta(cor(img, x, y), fundo)) return true;
    }
  }
  return false;
}

// 1) Cotas individual e em cadeia nos zooms 12, 60 e 220.
async function itemCotas(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of window.__a2.paredes()) editor.store.exec({ type: 'addWall', wall: w });
    editor.store.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'dim-ind', a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, offset: -1, mode: 'aligned', unit: 'm', precision: 2, textHeight: 2.5, tickStyle: 'slash' } });
    const trechos = [[2, 4], [4, 5.5], [5.5, 6.5]];
    trechos.forEach(([x0, x1], i) => {
      editor.store.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: `dim-c${i + 1}`, a: { x: x0, y: 6 }, b: { x: x1, y: 6 }, offset: 0.8, mode: 'aligned', unit: 'm', precision: 2, textHeight: 2.5, tickStyle: 'slash' } });
    });
  });
  await assentar(page);

  const tamanhos = new Map();
  for (const zoom of [12, 60, 220]) {
    for (const alvo of ['individual', 'cadeia']) {
      const individual = alvo === 'individual';
      await aplicarZoom(page, individual ? 4 : 4.25, individual ? -0.55 : 6.75, zoom);
      const labels = await rotulos(page);
      const textos = labels.filter((l) => /^\d+,\d{2} m$/.test(l.text));
      const esperados = individual ? ['8,00 m'] : ['2,00 m', '1,50 m', '1,00 m'];
      const faltando = esperados.filter((t) => !textos.some((l) => l.text === t));
      const fora = textos.filter((l) => esperados.includes(l.text) && !l.dentro).map((l) => l.text);
      const nome = `1-cota-${alvo}-z${zoom}`;
      const shot = await tirar(page, nome);
      if (individual) tamanhos.set(zoom, textos.find((l) => l.text === '8,00 m')?.fontPx ?? 0);
      check(
        `cota ${alvo} no zoom ${zoom}`,
        individual ? 'texto "8,00 m" visível' : 'textos "2,00 m", "1,50 m" e "1,00 m" visíveis',
        faltando.length ? `faltam ${faltando.join(', ')}` : `${esperados.length - faltando.length}/${esperados.length} textos visíveis${fora.length ? `; fora da tela: ${fora.join(', ')}` : ''}`,
        faltando.length === 0,
        nome,
      );
      if (faltando.length === 0) {
        check(
          `cota ${alvo} no zoom ${zoom}: texto dentro da tela`,
          'todos os textos da cota dentro do canvas',
          fora.length ? `fora: ${fora.join(', ')}` : 'todos dentro',
          fora.length === 0,
          nome,
        );
      }
      if (individual) {
        const f = tamanhos.get(zoom) ?? 0;
        check(
          `texto da cota no zoom ${zoom}`,
          'corpo em px > 0 (papel 2,5 mm)',
          `${f.toFixed(1)} px`,
          f > 0,
          nome,
        );
      }
      void shot;
    }
  }
  const [f12, f60, f220] = [tamanhos.get(12), tamanhos.get(60), tamanhos.get(220)];
  check(
    'texto da cota escala com o zoom',
    '12 < 60 < 220 (proporcional ao zoom)',
    `${f12?.toFixed(1)} px → ${f60?.toFixed(1)} px → ${f220?.toFixed(1)} px`,
    !!f12 && !!f60 && !!f220 && f12 < f60 && f60 < f220,
  );

  // Controle: a seleção chega ao desenho de uma cota (a cota entra na chave da geometria). Serve para separar
  // "seleção não redesenha" de "esta categoria não entra na seleção da geometria" no item 4.
  await aplicarZoom(page, 4, -0.55, 60);
  const antesSel = await tirar(page, '1-controle-selecao-cota');
  await page.evaluate(() => window.__hestia.useUi.setState({ selection: ['dim-ind'], hover: null }));
  await assentar(page);
  const depoisSel = await tirar(page, '1-controle-selecao-cota-ativa');
  const dSel = diffImagens(antesSel.img, depoisSel.img);
  check('controle: seleção de cota muda o desenho', 'traço/texto na cor de seleção (azul)', `${dSel.count} px alterados, ${dSel.azul} azuis`, dSel.azul > 50, '1-controle-selecao-cota-ativa');
  await fimDoItem(page);
}

// 2) Texto com caixa: negrito, itálico, alinhamento, quebra e máscara de região de detalhe.
async function itemTexto(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of window.__a2.paredes()) editor.store.exec({ type: 'addWall', wall: w });
    editor.store.exec({ type: 'addDetailRegion', levelId: 'lv_0', item: { id: 'reg-cor', boundary: [{ x: -3.2, y: 1 }, { x: -1.2, y: 1 }, { x: -1.2, y: 4 }, { x: -3.2, y: 4 }], color: '#f5d782', mask: false } });
    editor.store.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'txt-bold', at: { x: 1.4, y: 8.2 }, text: 'NEGRITO', height: 4, rotation: 0, bold: true } });
    editor.store.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'txt-italic', at: { x: 1.4, y: 7.1 }, text: 'itálico', height: 4, rotation: 0, italic: true } });
    editor.store.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'txt-caixa', at: { x: 4, y: 4.4 }, text: 'Texto com caixa e alinhamento à direita que precisa quebrar em várias linhas', height: 3, rotation: 0, width: 45, align: 'right' } });
    editor.store.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'txt-lider', at: { x: 6.2, y: 8.2 }, text: 'Líder', height: 3, rotation: 0, leader: [{ x: 6.2, y: 8.2 }, { x: 7.2, y: 5.2 }] } });
  });
  await enquadrar(page, { x0: -3.8, y0: -0.8, x1: 9.2, y1: 9.4 });
  const antes = await tirar(page, '2-mascara-antes');
  const vAntes = await page.evaluate(() => window.__hestia.editor.viewport());
  const centroMascara = tela(vAntes, -2.2, 2.5);
  const faixaRegiao = tela(vAntes, -3.05, 2.5);
  const corMascaraAntes = cor(antes.img, centroMascara.x, centroMascara.y);
  const corRegiaoAntes = cor(antes.img, faixaRegiao.x, faixaRegiao.y);

  await page.evaluate(() => {
    window.__hestia.editor.store.exec({ type: 'addDetailRegion', levelId: 'lv_0', item: { id: 'reg-mask', boundary: [{ x: -2.9, y: 1.3 }, { x: -1.5, y: 1.3 }, { x: -1.5, y: 3.7 }, { x: -2.9, y: 3.7 }], mask: true } });
  });
  await assentar(page);
  const depois = await tirar(page, '2-texto-caixa');
  const vDepois = await page.evaluate(() => window.__hestia.editor.viewport());
  const corMascaraDepois = cor(depois.img, tela(vDepois, -2.2, 2.5).x, tela(vDepois, -2.2, 2.5).y);
  const corRegiaoDepois = cor(depois.img, tela(vDepois, -3.05, 2.5).x, tela(vDepois, -3.05, 2.5).y);

  const labels = await rotulos(page);
  const bold = labels.find((l) => l.text === 'NEGRITO');
  const italic = labels.find((l) => l.text === 'itálico');
  const caixa = labels.find((l) => l.text.startsWith('Texto com caixa'));
  const lider = labels.find((l) => l.text === 'Líder');

  await aplicarZoom(page, 4, 4.4, 120);
  await tirar(page, '2-texto-caixa-detalhe');

  check('texto em negrito', 'font-weight 700', bold ? `font-weight ${bold.fontWeight}` : 'texto não encontrado', !!bold && Number(bold.fontWeight) >= 700, '2-texto-caixa');
  check('texto em itálico', 'font-style italic', italic ? `font-style ${italic.fontStyle}` : 'texto não encontrado', !!italic && italic.fontStyle === 'italic', '2-texto-caixa');
  check(
    'caixa de texto com alinhamento à direita e quebra',
    'text-align right, white-space normal e mais de uma linha',
    caixa ? `text-align ${caixa.textAlign}, white-space ${caixa.whiteSpace}, ${Math.round(caixa.h)} px de altura para ${caixa.fontPx.toFixed(1)} px de fonte` : 'texto não encontrado',
    !!caixa && caixa.textAlign === 'right' && caixa.whiteSpace === 'normal' && caixa.h > caixa.fontPx * 1.8,
    '2-texto-caixa-detalhe',
  );
  check('texto com líder', 'linha de chamada entre o texto e o modelo', lider ? `texto "Líder" presente (${Math.round(lider.w)}×${Math.round(lider.h)} px)` : 'texto não encontrado', !!lider, '2-texto-caixa');
  check(
    'máscara de região de detalhe cobre o preenchimento',
    'centro da máscara na cor do papel e faixa vizinha ainda amarela',
    `antes: centro ${corMascaraAntes.join(',')} / faixa ${corRegiaoAntes.join(',')}; depois: centro ${corMascaraDepois.join(',')} / faixa ${corRegiaoDepois.join(',')}`,
    corRegiaoAntes[0] - corRegiaoAntes[2] > 15
      && corMascaraAntes[0] - corMascaraAntes[2] > 15
      && distCor(corMascaraDepois, corRegiaoDepois) > 15
      && corMascaraDepois[0] > 240 && corMascaraDepois[1] > 240 && corMascaraDepois[2] > 240
      && corRegiaoDepois[0] - corRegiaoDepois[2] > 15,
    '2-mascara-antes / 2-texto-caixa',
  );
  await fimDoItem(page);
}

// 3) Etiquetas, líderes e "Etiquetar todos".
async function itemEtiquetas(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of window.__a2.paredes()) editor.store.exec({ type: 'addWall', wall: w });
    editor.store.exec({ type: 'addOpening', opening: window.__a2.OPEN('o1', 'door', 'ot_p80', 'w1', 2).opening });
    editor.store.exec({ type: 'addOpening', opening: window.__a2.OPEN('o2', 'window', 'ot_j120', 'w3', 4).opening });
    editor.store.exec({ type: 'addTag', levelId: 'lv_0', item: { id: 'tag-lider', hostId: 'w1', at: { x: 4, y: -1.5 }, property: 'type', leader: true } });
  });
  await enquadrar(page, { x0: -1.5, y0: -3.2, x1: 9.5, y1: 7.2 });
  const antes = await tirar(page, '3-etiqueta-lider');
  const v = await page.evaluate(() => window.__hestia.editor.viewport());
  const fundo = fundoDe(antes.img);
  const pontosLider = [0.2, 0.4, 0.6, 0.8].map((t) => temTintaEm(antes.img, tela(v, 4, -1.5 * t - 0.05), 2, fundo));
  const comLider = pontosLider.filter(Boolean).length;

  const rotulosAntes = await rotulos(page);
  check('etiqueta com líder', 'texto de etiqueta e linha de chamada visíveis', `texto "${rotulosAntes.find((l) => l.text)?.text ?? '—'}"; ${comLider}/4 pontos do líder com tinta`, !!rotulosAntes.length && comLider >= 3, '3-etiqueta-lider');

  await aplicarZoom(page, 4, -0.4, 150);
  await tirar(page, '3-etiqueta-lider-detalhe');
  await enquadrar(page, { x0: -1.5, y0: -3.2, x1: 9.5, y1: 7.2 });

  await page.locator('.rtab:visible', { hasText: /Anotar|Annotate/ }).click();
  const botao = page.locator('button[aria-label="Etiquetar todos"], button[aria-label="Tag All"]');
  await botao.first().waitFor({ state: 'visible' });
  await botao.first().click();
  await assentar(page);
  const etiquetas = await page.evaluate(() => ({
    tags: window.__hestia.editor.project.levels.find((l) => l.id === 'lv_0').tags ?? [],
    status: window.__hestia.useUi.getState().status,
  }));
  await tirar(page, '3-etiquetar-todos');
  const rotulosDepois = await rotulos(page);
  const textos = rotulosDepois.map((l) => l.text);
  const elementos = 6; // 4 paredes + porta + janela
  check(
    '"Etiquetar todos" cria uma etiqueta por elemento sem etiqueta',
    `${elementos} etiquetas (4 paredes + porta + janela)`,
    `${etiquetas.tags.length} etiquetas; status "${etiquetas.status}"`,
    etiquetas.tags.length === elementos,
    '3-etiquetar-todos',
  );
  const repetidas = new Set(textos).size;
  await aplicarZoom(page, 3.6, 0.6, 120);
  await tirar(page, '3-etiquetar-todos-detalhe');
  check(
    'etiquetas aparecem na vista',
    'rótulos não vazios para as etiquetas criadas',
    `${textos.filter(Boolean).length} rótulos (${repetidas} textos distintos)`,
    textos.filter(Boolean).length >= elementos,
    '3-etiquetar-todos-detalhe',
  );
  await fimDoItem(page);
}

// 4) Linha de detalhe tracejada/pontilhada e seleção 1,7×.
async function itemLinhas(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const [id, y, style] of [['dl-solid', 1, 'solid'], ['dl-dash', 2, 'dashed'], ['dl-dot', 3, 'dotted']]) {
      editor.store.exec({ type: 'addDetailLine', levelId: 'lv_0', item: { id, a: { x: 0, y }, b: { x: 4, y }, style } });
    }
  });
  await aplicarZoom(page, 2, 2, 60);
  const base = await tirar(page, '4-linhas-detalhe');
  const v = await page.evaluate(() => window.__hestia.editor.viewport());
  const fundo = fundoDe(base.img);
  const medir = (y) => perfilLinha(base.img, v, { x: 0.15, y }, { x: 3.85, y }, { raio: 3, fundo });
  const solida = medir(1);
  const tracejada = medir(2);
  const pontilhada = medir(3);

  check('linha de detalhe contínua', 'traço contínuo (1 ciclo)', `${solida.ciclos} ciclos, ocupação ${(solida.ocupacao * 100).toFixed(1)}%`, solida.ciclos <= 2 && solida.ocupacao > 0.95, '4-linhas-detalhe');
  check('linha de detalhe tracejada', 'traços e espaços (7/4 px)', `${tracejada.ciclos} ciclos, ocupação ${(tracejada.ocupacao * 100).toFixed(1)}%`, tracejada.ciclos >= 12 && tracejada.ciclos <= 32 && tracejada.ocupacao > 0.55 && tracejada.ocupacao < 0.95, '4-linhas-detalhe');
  check('linha de detalhe pontilhada', 'pontos (1/3 px)', `${pontilhada.ciclos} ciclos, ocupação ${(pontilhada.ocupacao * 100).toFixed(1)}%`, pontilhada.ciclos >= 35 && pontilhada.ocupacao > 0.35 && pontilhada.ocupacao < 0.9, '4-linhas-detalhe');
  check('tracejado e pontilhado são distintos', 'pontilhada tem mais ciclos que a tracejada', `${tracejada.ciclos} × ${pontilhada.ciclos} ciclos`, pontilhada.ciclos > tracejada.ciclos * 1.8, '4-linhas-detalhe');

  // Clique real na linha (mesmo caminho do usuário), não só `setState`: a seleção tem de chegar ao desenho.
  const ponto = await page.evaluate(() => {
    const v = window.__hestia.editor.viewport();
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return { x: r.x + r.width / 2 + (2 - v.cx) * v.zoom, y: r.y + r.height / 2 - (2 - v.cy) * v.zoom };
  });
  await page.mouse.move(ponto.x, ponto.y);
  await page.mouse.click(ponto.x, ponto.y);
  await assentar(page);
  const sel = await tirar(page, '4-selecao-1.7x');
  const diff = diffImagens(base.img, sel.img);
  const estadoSelecao = await page.evaluate(() => ({ selection: window.__hestia.useUi.getState().selection, hover: window.__hestia.useUi.getState().hover }));
  check(
    'seleção da linha de detalhe em 1,7×',
    'traço mais grosso (1,7×) e na cor de seleção',
    `${diff.count} px alterados (${(diff.frac * 100).toFixed(3)}%), ${diff.azul} px azuis; selection=${JSON.stringify(estadoSelecao.selection)}, hover=${JSON.stringify(estadoSelecao.hover)}`,
    diff.count > 0 && diff.azul > 0,
    '4-selecao-1.7x',
  );
  await fimDoItem(page);
}

// 5) Rótulos de corte/elevação.
async function itemCortes(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of window.__a2.paredes()) editor.store.exec({ type: 'addWall', wall: w });
    editor.store.exec({ type: 'addView', view: { id: 'sv1', name: 'Corte A', label: 'A', kind: 'section', a: { x: 4, y: -2.6 }, b: { x: 4, y: 8.6 }, depth: 8 } });
    editor.store.exec({ type: 'addView', view: { id: 'ev1', name: 'Fachada Sul', label: 'Sul', kind: 'elevation', a: { x: -1, y: -2 }, b: { x: 9, y: -2 }, depth: 8 } });
  });
  await enquadrar(page, { x0: -2, y0: -4, x1: 10, y1: 9 });
  const shot = await tirar(page, '5-cortes-elevacoes');
  const v = await page.evaluate(() => window.__hestia.editor.viewport());
  const fundo = fundoDe(shot.img);
  const labels = await rotulos(page);
  const as = labels.filter((l) => l.text === 'A');
  const sul = labels.filter((l) => l.text === 'Sul');
  check('rótulo do corte nas duas pontas', 'dois "A" (placement both)', `${as.length} rótulo(s) "A"`, as.length >= 2, '5-cortes-elevacoes');
  check('rótulo da elevação nas duas pontas', 'dois "Sul" (placement both)', `${sul.length} rótulo(s) "Sul"`, sul.length >= 2, '5-cortes-elevacoes');

  const corte = perfilLinha(shot.img, v, { x: 4, y: -2.4 }, { x: 4, y: 8.4 }, { raio: 1, fundo });
  const elevacao = perfilLinha(shot.img, v, { x: -0.7, y: -2 }, { x: 8.7, y: -2 }, { raio: 1, fundo });
  check('linha de corte em traço-ponto', 'vários ciclos (tracejado)', `${corte.ciclos} ciclos, ocupação ${(corte.ocupacao * 100).toFixed(1)}%`, corte.ciclos >= 8, '5-cortes-elevacoes');
  check('linha de elevação contínua', 'traço contínuo (1–3 ciclos)', `${elevacao.ciclos} ciclos, ocupação ${(elevacao.ocupacao * 100).toFixed(1)}%`, elevacao.ciclos <= 3, '5-cortes-elevacoes');

  await aplicarZoom(page, 4.6, 6.6, 110);
  await tirar(page, '5-cortes-elevacoes-detalhe');
  await fimDoItem(page);
}

// 6) 3D com caixas instanciadas: paredes retas, portas/janelas, silhueta e seleção.
async function item3d(page) {
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of window.__a2.paredes()) editor.store.exec({ type: 'addWall', wall: w });
    editor.store.exec({ type: 'addOpening', opening: window.__a2.OPEN('o1', 'door', 'ot_p80', 'w1', 2).opening });
    editor.store.exec({ type: 'addOpening', opening: window.__a2.OPEN('o2', 'window', 'ot_j120', 'w3', 4).opening });
    editor.setView('3d');
    const s = window.__hestia.useUi.getState();
    if (!s.openViews.some((v) => v.kind === '3d')) window.__hestia.useUi.setState({ openViews: [...s.openViews, { kind: '3d' }] });
  });
  await page.waitForFunction(() => {
    const ms = window.__hestia3dModel;
    if (!ms || ms.bounds().isEmpty()) return false;
    let n = 0;
    ms.scene.traverse((o) => { if (o.isInstancedMesh) n++; });
    return n > 0;
  }, null, { timeout: 20000 });
  await page.evaluate(() => window.__hestia3dModel.fit());
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const ms = window.__hestia3dModel;
    const porTipo = {};
    let malhasParede = 0;
    let camadaInst = null;
    let malhasInst = 0;
    ms.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        const k = o.userData?.kind ?? '?';
        porTipo[k] = (porTipo[k] ?? 0) + o.count;
        malhasInst++;
        camadaInst ??= o.parent;
      } else if (o.isMesh && o.userData?.kind === 'wall') malhasParede++;
    });
    window.__a2CamadaInst = camadaInst;
    const b = ms.bounds();
    return { porTipo, malhasParede, malhasInst, min: b.min.toArray(), max: b.max.toArray(), view: window.__hestia.useUi.getState().view };
  });
  const caixas = await tirar(page, '6-3d-caixas');

  check('3D aberto', 'vista 3D ativa com o modelo enquadrado', `view=${info.view}; caixa ${info.min.map((n) => n.toFixed(2)).join('/')}–${info.max.map((n) => n.toFixed(2)).join('/')}`, info.view === '3d', '6-3d-caixas');
  check(
    'paredes retas em caixas instanciadas',
    'pelo menos uma InstancedMesh de parede (4 paredes retas)',
    `${info.porTipo.wall ?? 0} caixas de parede em ${info.malhasInst} InstancedMesh; ${info.malhasParede} malha(s) de parede fora do caminho instanciado`,
    (info.porTipo.wall ?? 0) >= 4,
    '6-3d-caixas',
  );
  check('portas e janelas em caixas instanciadas', 'caixas de porta e de janela', `${info.porTipo.door ?? 0} peças de porta, ${info.porTipo.window ?? 0} peças de janela`, (info.porTipo.door ?? 0) > 0 && (info.porTipo.window ?? 0) > 0, '6-3d-caixas');

  await page.evaluate(() => { window.__a2CamadaInst.visible = false; window.__hestia.editor.bump(); });
  await page.waitForTimeout(400);
  const semInst = await tirar(page, '6-3d-silhueta-sem-instancias');
  await page.evaluate(() => { window.__a2CamadaInst.visible = true; window.__hestia.editor.bump(); });
  await page.waitForTimeout(400);
  const diffSilhueta = diffImagens(caixas.img, semInst.img);
  check(
    'silhueta vem das caixas instanciadas',
    'esconder a camada instanciada muda a imagem (paredes/aberturas somem)',
    `${(diffSilhueta.frac * 100).toFixed(1)}% dos pixels mudam`,
    diffSilhueta.frac > 0.01,
    '6-3d-silhueta-sem-instancias',
  );

  await page.evaluate(() => window.__hestia.useUi.setState({ selection: ['w1'], hover: null }));
  await page.waitForTimeout(500);
  const sel = await tirar(page, '6-3d-selecao');
  const diffSel = diffImagens(caixas.img, sel.img);
  check(
    'seleção 3D realça a parede',
    'pixels na cor de seleção (azul) sem refazer o modelo',
    `${diffSel.count} px alterados, ${diffSel.azul} azuis`,
    diffSel.count > 0 && diffSel.azul > 50,
    '6-3d-selecao',
  );
  await fimDoItem(page);
}

const ITENS = [
  { id: 'cotas', nome: '1 · Cotas individual e em cadeia (zooms 12/60/220)', run: itemCotas },
  { id: 'texto', nome: '2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara)', run: itemTexto },
  { id: 'etiquetas', nome: '3 · Etiquetas, líderes e "Etiquetar todos"', run: itemEtiquetas },
  { id: 'linhas', nome: '4 · Linha de detalhe tracejada/pontilhada e seleção 1,7×', run: itemLinhas },
  { id: 'cortes', nome: '5 · Rótulos de corte/elevação', run: itemCortes },
  { id: '3d', nome: '6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção)', run: item3d },
];

// ---------- execução ----------
if (LISTAR) {
  for (const it of ITENS) console.log(`${it.id.padEnd(10)} ${it.nome}`);
  process.exit(0);
}

if (!existsSync(DIST) && !/^https?:/.test(URL_APP)) {
  console.error(`Build ausente: ${DIST}. Rode "npm run build -w @hestia/web" antes.`);
  process.exit(2);
}

const selecionados = FILTRO
  ? ITENS.filter((it) => it.id.toLowerCase().includes(FILTRO.toLowerCase()) || it.nome.toLowerCase().includes(FILTRO.toLowerCase()))
  : ITENS;
if (!selecionados.length) {
  console.error(`Nenhum item corresponde a "${FILTRO}". Use --list para ver os itens.`);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const executavel = CANDIDATOS_CHROME.find(existsSync);
const browser = await chromium.launch({ executablePath: executavel, args: ARGS });
const browserInfo = `${browser.version()}${executavel ? ` (${executavel})` : ' (Chromium do playwright-core)'}`;
console.log(`Verificação visual — ${browserInfo}`);
console.log(`URL: ${URL_TESTE}`);
console.log(`Capturas: ${OUT}/\n`);

const errosGlobais = [];
for (const item of selecionados) {
  itemAtual = item;
  pageErros = [];
  console.log(`\n== ${item.nome}`);
  let page = null;
  try {
    page = await abrirPagina(browser, pageErros);
    await item.run(page);
  } catch (e) {
    check('execução do item', 'item executa sem exceção', e.message.split('\n')[0], false);
    if (page) await page.close().catch(() => {});
  }
  errosGlobais.push(...pageErros.map((e) => `${item.id}: ${e}`));
}

await browser.close();
const resumo = gerarRelatorios(browserInfo, errosGlobais);

console.log(`\n== RESUMO`);
for (const item of selecionados) {
  const rs = resultados.filter((r) => r.item === item.id);
  const fail = rs.filter((r) => r.veredito === 'FAIL').length;
  const pend = rs.filter((r) => r.veredito === 'PENDENTE').length;
  console.log(`${fail || pend ? 'FALHOU ' : 'PASSOU '} ${item.nome} — ${rs.length} critérios, ${fail} FAIL, ${pend} PENDENTE`);
}
console.log(`\n${resumo.pass} PASS · ${resumo.fail} FAIL · ${resumo.pendente} PENDENTE`);
console.log(`Relatório: ${path.join(OUT, 'resultados.md')}`);
if (ESTRITO && (resumo.fail || resumo.pendente)) process.exit(1);
