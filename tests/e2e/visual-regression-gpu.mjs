// Regressão visual do caminho GPU (WebGL2, o padrão do app): seis casos de maior risco de ordem de desenho (hachura × parede).
// Compara cada captura com tests/e2e/baseline-gpu/*.png e, na mesma execução, com o caminho CPU (`?cpu=1`) do mesmo caso:
// nas regiões de parede a diferença GPU × CPU não pode passar de LIMITE_PAREDE. `--update` regrava as referências GPU.
//   npm run build && node tests/e2e/visual-regression-gpu.mjs [--update]
// Sem `?cpu=1` o app já usa a GPU (o parâmetro `gl` não é lido pelo app); `debug=1` só expõe `window.__hestia`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromeExecutable, distUrl, launch } from './helpers.mjs';

const UPDATE = process.argv.includes('--update');
const BASE = 'tests/e2e/baseline-gpu';
const OUT = process.env.SHOTS ?? 'test-results/visual-gpu';
// Tolerâncias: por canal (12 de 255) e fração de pixels. O WebGL por software (SwiftShader) é determinístico entre execuções
// seguidas, então a referência usa o mesmo limite da regressão CPU (0,2 %). Entre GPU e CPU há antisserrilhado diferente nas
// bordas da hachura: a regra é só para as regiões de parede (caixa de cada parede, com 0,1 m de folga).
const TOL = 12;
const LIMITE = 0.002;
// Tinta nas paredes: nos casos corretos a divergência fica em ~8 % (antisserrilhado e tinta escura da hachura, que diferem entre
// os caminhos); com a hachura por cima da parede (defeito anterior) o telhado de duas águas passa de 100 %. O limite fica entre os dois.
const LIMITE_PAREDE = 0.15;
const FOLGA = 0.1;
const TINTA = 90; // canal máximo (0..255) de um pixel de tinta: contorno e corte, não hachura
mkdirSync(BASE, { recursive: true });
mkdirSync(OUT, { recursive: true });
if (!chromeExecutable()) throw new Error('Chromium do sistema não encontrado (/opt/pw-browsers)');

const W = (id, a, b, extra = {}) => ({ id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '', ...extra });
const F = (id, boundary, extra = {}) => ({ id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, mark: '', comments: '', ...extra });
const SL = (id, boundary, extra = {}) => ({ id, kind: 'slab', typeId: 'ls_mac15', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, slope: null, mark: '', comments: '', ...extra });
const R = (id, shape, dir, extra = {}) => ({ id, kind: 'roof', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [[-0.3, -0.3], [8.3, -0.3], [8.3, 6.3], [-0.3, 6.3]].map(([x, y]) => ({ x, y })), holes: [], heightOffset: 2.8, shape, slopePercent: 30, dir, planes: [], edgeSlopes: [30, 30, 30, 30], edgeOverhangs: [0.3, 0.3, 0.3, 0.3], profile: [], joinOthers: true, rafterCut: 'plumb', eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false }, mark: '', comments: '', ...extra });
const HOUSE = [W('h1', [0, 0], [8, 0]), W('h2', [8, 0], [8, 6]), W('h3', [8, 6], [0, 6]), W('h4', [0, 6], [0, 0])];
const RECT_WALLS = [[0, 0], [8, 0], [8, 6], [0, 6]];
const wallsOf = (poly) => poly.map((a, i) => W(`w${i}`, a, poly[(i + 1) % poly.length]));
const OPEN = (id, kind, typeId, hostId, offset) => ({ kind: 'opening', opening: { id, kind, typeId, hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
// Decisão 0013: os casos de telhado usam topo 6,0 m e corte 2,75 m (ver visual-regression.mjs).
const VISTA_COBERTURA = { top: 6, cut: 2.75 };

// Os seis casos de maior risco (mesmas definições das regressões CPU, em visual-regression.mjs).
const CASOS = {
  // Parede com piso sob ela em retângulo: paredes 0,10 m abaixo do topo do piso, com término automático.
  'piso-retangulo-parede': { items: [...wallsOf(RECT_WALLS).map((w) => ({ ...w, baseOffset: -0.1 })), F('pr1', RECT_WALLS, { outlineSource: { mode: 'walls-finish', seed: { x: 4, y: 3 }, linked: true } })] },
  // Laje inclinada (5 % em x), sem paredes: a hachura da laje e o contorno.
  'laje-inclinada': { items: [SL('l3', [[0, 0], [6, 0], [6, 4], [0, 4]], { slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } })] },
  // Telhado de duas águas sobre a casa de 8 × 6 m (vista de cobertura).
  'telhado-duas-aguas': { items: [...HOUSE, R('t1', 'gable', { x: 1, y: 0 })], vista: VISTA_COBERTURA },
  // Parede embutida no piso 6 × 4 m, com base 0,10 m abaixo do topo do piso.
  'junc-parede-embutida-piso': { items: [W('e1', [-1, 2], [7, 2], { baseOffset: -0.1 }), F('pe1', [[0, 0], [6, 0], [6, 4], [0, 4]])] },
  // Parede anexada à base no piso que cobre só metade dela (degrau de base na face superior do piso, +0,05 m).
  'parede-base-piso-metade': { items: [W('bp1', [0, 0], [4, 0], { attachBottomToFloor: true }), F('pb1', [[-1, -1], [2, -1], [2, 1], [-1, 1]], { heightOffset: 0.05 })] },
  // Planta com porta de giro, janela de correr e vão livre (sem X, decisão 0024 §3) na casa de 8 × 6 m.
  'planta-porta-janela': { items: [...wallsOf(RECT_WALLS), OPEN('po1', 'door', 'ot_p80', 'w0', 2), OPEN('jn1', 'window', 'ot_j120', 'w2', 3), OPEN('vl1', 'door', 'ot_vao90', 'w1', 2.5)] },
};

/** Monta o projeto da captura: itens na lista, vista de cobertura quando houver, enquadramento da planta. */
async function desenhar(page, items, vista) {
  await page.evaluate(([ws, v]) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of ws) editor.store.exec(w.kind === 'roof' ? { type: 'addRoof', roof: w } : w.kind === 'slab' ? { type: 'addSlab', slab: w } : w.kind === 'floor' ? { type: 'addFloor', floor: w } : w.kind === 'opening' ? { type: 'addOpening', opening: w.opening } : { type: 'addWall', wall: w });
    if (v) editor.store.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: v });
  }, [items, vista]);
}

/** Espera o canvas assentar (tamanho estável e vista do editor com o mesmo tamanho), como em visual-regression.mjs. */
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
}

/** Captura do canvas do caso: desenha, enquadra e espera o assentamento. */
async function capturar(page, caso) {
  await desenhar(page, caso.items, caso.vista ?? null);
  await assentar(page);
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await assentar(page);
  return page.locator('.canvas-wrap canvas').first().screenshot();
}

/**
 * Diferença entre duas capturas (PNG em base64), no navegador. `todo`: fração de pixels fora da tolerância por canal (regressão
 * contra a referência). `parede`: nas caixas de parede (cada parede em coordenadas de tela, pela vista atual, com a folga),
 * a fração de pixels em que a máscara de tinta (contorno e corte, cor mais escura que TINTA) difere entre GPU e CPU, sobre
 * os pixels em que alguma das duas é tinta. A hachura não entra: ela é rasterizada de forma diferente na GPU (textura em
 * metros) e no CPU (padrão em pixels de tela), então pixel a pixel nunca coincide. O contorno tem a mesma geometria nos dois
 * caminhos, e a hachura de uma laje desenhada por cima da parede o cobre: é isso que o teste acusa.
 */
async function comparar(page, a, b, paredes) {
  return page.evaluate(async ([ca, cb, paredesMundo, folga, tinta]) => {
    const load = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${b64}`; });
    const [ia, ib] = await Promise.all([load(ca), load(cb)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { todo: 1, parede: 1 };
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const da = px(ia), db = px(ib);
    const w = ia.width, h = ia.height;
    let bad = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 12 || Math.abs(da[i + 1] - db[i + 1]) > 12 || Math.abs(da[i + 2] - db[i + 2]) > 12) bad++;
    }
    const v = window.__hestia.editor.viewport();
    // Caixas de parede em pixels: x = w/2 + (x − cx)·zoom; y = h/2 − (y − cy)·zoom (como worldToScreen).
    const caixas = paredesMundo.map(([x0, y0, x1, y1]) => {
      const sx0 = w / 2 + (Math.min(x0, x1) - folga - v.cx) * v.zoom;
      const sx1 = w / 2 + (Math.max(x0, x1) + folga - v.cx) * v.zoom;
      const sy0 = h / 2 - (Math.max(y0, y1) + folga - v.cy) * v.zoom;
      const sy1 = h / 2 - (Math.min(y0, y1) - folga - v.cy) * v.zoom;
      return [Math.max(0, Math.floor(sx0)), Math.max(0, Math.floor(sy0)), Math.min(w, Math.ceil(sx1)), Math.min(h, Math.ceil(sy1))];
    });
    const ehTinta = (arr, i) => Math.max(arr[i], arr[i + 1], arr[i + 2]) < tinta;
    let uniao = 0, xor = 0;
    for (const [x0, y0, x1, y1] of caixas) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        const ta = ehTinta(da, i), tb = ehTinta(db, i);
        if (ta || tb) uniao++;
        if (ta !== tb) xor++;
      }
    }
    return { todo: bad / (w * h), parede: uniao ? xor / uniao : 0 };
  }, [a.toString('base64'), b.toString('base64'), paredes, FOLGA, TINTA]);
}

const browser = await launch();
const erros = [];
const abrir = async (query) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(distUrl() + query);
  await page.waitForFunction(() => window.__hestia);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  return page;
};
const gpu = await abrir('?debug=1');
const cpu = await abrir('?cpu=1&debug=1');
// O aviso "Sem GPU" do caminho CPU fica fora da comparação (é um elemento da página, não da planta).
await cpu.addStyleTag({ content: '.cpu-note { display: none !important; }' });
// Sem o aviso "Sem GPU" a página está no caminho GPU; senão a regressão não teria valor.
if (await gpu.locator('.cpu-note').count()) throw new Error('o app caiu no caminho CPU; a regressão GPU não pode rodar assim');

let falhas = 0;
for (const [nome, caso] of Object.entries(CASOS)) {
  const paredes = caso.items.filter((i) => i.kind === 'wall').map((w) => [w.a.x, w.a.y, w.b.x, w.b.y]);
  const shot = await capturar(gpu, caso);
  const file = `${BASE}/${nome}.png`;
  writeFileSync(`${OUT}/${nome}.png`, shot);
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, shot);
    console.log(`${UPDATE ? 'gravado' : 'novo'}  ${nome} (GPU)`);
  } else {
    const ref = await comparar(gpu, readFileSync(file), shot, []);
    const ok = ref.todo < LIMITE;
    if (!ok) falhas++;
    console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}  diferença ${(ref.todo * 100).toFixed(3)}% (referência GPU)`);
  }
  const cpuShot = await capturar(cpu, caso);
  writeFileSync(`${OUT}/${nome}-cpu.png`, cpuShot);
  const x = await comparar(gpu, shot, cpuShot, paredes);
  const okX = x.parede <= LIMITE_PAREDE;
  if (!okX) falhas++;
  console.log(`${okX ? 'ok   ' : 'FALHA'} ${nome}  GPU × CPU: tinta nas paredes ${(x.parede * 100).toFixed(3)}%`);
}
if (erros.length) console.log('erros de página:', erros.join('\n'));
await browser.close();
if (falhas || erros.length) process.exit(1);
