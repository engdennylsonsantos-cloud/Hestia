// K7 · Regressão visual das junções: renderiza casos na planta (Canvas2D, determinístico) e compara com
// tests/e2e/baseline/*.png pixel a pixel (tolerância por canal e por fração). `--update` regrava as referências.
//   npm run build && node tests/e2e/visual-regression.mjs [--update]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const UPDATE = process.argv.includes('--update');
const BASE = 'tests/e2e/baseline';
const OUT = process.env.SHOTS ?? 'test-results/visual';
mkdirSync(BASE, { recursive: true });
mkdirSync(OUT, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?cpu=1&debug=1');
await page.waitForFunction(() => window.__hestia);
// As fontes da interface terminam de carregar depois do boot e mudam a altura do canvas (491 → 524 px); esperá-las evita
// que a primeira captura enquadre com a área antiga.
await page.evaluate(() => document.fonts.ready);

const W = (id, a, b, extra = {}) => ({ id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '', ...extra });
const F = (id, boundary, extra = {}) => ({ id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, mark: '', comments: '', ...extra });
const SL = (id, boundary, extra = {}) => ({ id, kind: 'slab', typeId: 'ls_mac15', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, slope: null, mark: '', comments: '', ...extra });
const M = { kind: 'miter', flip: false };
const CASES = {
  'L-encosto': [W('a', [0, 0], [4, 0]), W('b', [4, 0], [4, 3])],
  'L-esquadria': [W('a', [0, 0], [4, 0], { joinEnd: M }), W('b', [4, 0], [4, 3], { joinStart: M })],
  T: [W('a', [0, 0], [4, 0]), W('c', [2, 0], [2, 3])],
  X: [W('a', [0, 0], [4, 0]), W('c', [2, -2], [2, 2])],
  'L-14-com-9-esquadria': [W('a', [0, 0], [4, 0], { joinEnd: M }), W('b', [4, 0], [4, 3], { typeId: 'wt_alv9', joinStart: M })],
  'no-3-paredes': [W('a', [0, 0], [3, 0]), W('b', [3, 0], [3, 3]), W('c', [6, 0], [3, 0])],
  'sala-com-arco': [W('a', [0, 0], [0, 4]), W('b', [0, 4], [4, 4]), W('c', [4, 4], [4, 0], { sag: 1.2 }), W('d', [4, 0], [0, 0])],
};

// D1/D4: pisos entram por addFloor (kind floor); paredes por addWall.
const FLOOR_CASES = {
  'piso-retangulo': [F('p1', [[0, 0], [6, 0], [6, 4], [0, 4]])],
  'piso-com-furo': [F('p2', [[0, 0], [6, 0], [6, 4], [0, 4]], { holes: [[{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }]] })],
  'piso-L': [F('p3', [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]])],
};

// D1/D2/D3: lajes entram por addSlab (kind slab); a inclinada cai 5 % ao longo de x.
const SLAB_CASES = {
  'laje-retangulo': [SL('l1', [[0, 0], [6, 0], [6, 4], [0, 4]])],
  'laje-com-furo': [SL('l2', [[0, 0], [6, 0], [6, 4], [0, 4]], { holes: [[{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }]] })],
  'laje-inclinada': [SL('l3', [[0, 0], [6, 0], [6, 4], [0, 4]], { slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } })],
};

// D1/D2/D3: telhados entram por addRoof (kind roof), sobre quatro paredes de 8 × 6 m (beiral com balanço de 0,30 m).
const R = (id, shape, dir, extra = {}) => ({ id, kind: 'roof', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [[-0.3, -0.3], [8.3, -0.3], [8.3, 6.3], [-0.3, 6.3]].map(([x, y]) => ({ x, y })), holes: [], heightOffset: 2.8, shape, slopePercent: 30, dir, planes: [], edgeSlopes: [30, 30, 30, 30], edgeOverhangs: [0.3, 0.3, 0.3, 0.3], profile: [], joinOthers: true, rafterCut: 'plumb', eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false }, mark: '', comments: '', ...extra });
const HOUSE = [W('h1', [0, 0], [8, 0]), W('h2', [8, 0], [8, 6]), W('h3', [8, 6], [0, 6]), W('h4', [0, 6], [0, 0])];
// Telhado por contorno (forma 'edges'): inclinação explícita por aresta (null = empena), beiral com balanço de 0,30 m.
// As paredes seguem o contorno sem balanço; cada aresta da planta vira uma parede.
const E = (id, pts, edgeSlopes, extra = {}) => ({ id, kind: 'roof', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: pts.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 2.8, shape: 'edges', slopePercent: 30, dir: { x: 1, y: 0 }, planes: [], edgeSlopes, edgeOverhangs: pts.map(() => 0.3), profile: [], joinOthers: true, rafterCut: 'plumb', eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false }, mark: '', comments: '', ...extra });
const wallsOf = (poly) => poly.map((a, i) => W(`w${i}`, a, poly[(i + 1) % poly.length]));
const L_WALLS = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 6], [0, 6]];
const L_EAVE = [[-0.3, -0.3], [8.3, -0.3], [8.3, 3.3], [4.3, 3.3], [4.3, 6.3], [-0.3, 6.3]];
const T_WALLS = [[0, 4], [3, 4], [3, 0], [6, 0], [6, 4], [9, 4], [9, 6], [0, 6]];
const T_EAVE = [[-0.3, 3.7], [2.7, 3.7], [2.7, -0.3], [6.3, -0.3], [6.3, 3.7], [9.3, 3.7], [9.3, 6.3], [-0.3, 6.3]];
const TRI_WALLS = [[0, 0], [8, 0], [4, 6]];
const TRI_EAVE = [[-0.3, -0.3], [8.3, -0.3], [4, 6.4]];
const RECT_WALLS = [[0, 0], [8, 0], [8, 6], [0, 6]];
const RECT_EAVE = [[-0.3, -0.3], [8.3, -0.3], [8.3, 6.3], [-0.3, 6.3]];

// Decisão 0013: com o padrão (corte 1,20 m) o telhado a 2,80 m fica acima do corte e só aparece tracejado. Os casos de telhado
// usam topo 6,0 m e corte 2,75 m: a face inferior do beiral (2,80 − 0,095) fica ≤ corte ≤ cumeeira, então o telhado é cortado,
// e o corte (2,75 m) ainda atravessa as paredes de 2,80 m, que mantêm a hachura da baseline.
const VISTA_COBERTURA = { top: 6, cut: 2.75 };
const ROOF_CASES = {
  'telhado-duas-aguas': [...HOUSE, R('t1', 'gable', { x: 1, y: 0 })],
  'telhado-quatro-aguas': [...HOUSE, R('t1', 'hip', { x: 1, y: 0 })],
  'telhado-uma-agua': [...HOUSE, R('t1', 'shed', { x: 1, y: 0 })],
  // A10: contorno em L (6 arestas), T (8), triângulo (3 águas) e empena (duas arestas sem inclinação).
  'telhado-L': [...wallsOf(L_WALLS), E('t1', L_EAVE, [30, 30, 30, 30, 30, 30])],
  'telhado-T': [...wallsOf(T_WALLS), E('t1', T_EAVE, [30, 30, 30, 30, 30, 30, 30, 30])],
  'telhado-3-aguas': [...wallsOf(TRI_WALLS), E('t1', TRI_EAVE, [30, 30, 30])],
  'telhado-empena': [...wallsOf(RECT_WALLS), E('t1', RECT_EAVE, [30, null, 30, null])],
};

// D6 (ambientes, G6): ambiente com circuito fechado nas paredes de 8 × 6 m, com nome, número e área na etiqueta.
const RM = (id, extra = {}) => ({ id, kind: 'room', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 4, y: 3 }, heightOffset: 0, floorFinish: '', wallFinish: '', ceilingFinish: '', ...extra });
const ROOM_CASES = { 'ambiente-sala': [...wallsOf(RECT_WALLS), RM('r1')] };

// P7b (decisão 0023 §3, §10): junção piso/laje × parede. A parede com base abaixo do topo do piso ou da laje entra na
// faixa deles; a camada que perde prioridade sai onde a outra a vence. Sem sobreposição, nada muda (os 21 casos acima).
const JUNCTION_CASES = {
  // (a) piso pelo núcleo ("Estender até o núcleo", `walls-core`) em L; as paredes descem 0,10 m abaixo do nível.
  'junc-piso-L-nucleo': [...wallsOf(L_WALLS).map((w) => ({ ...w, baseOffset: -0.1 })), F('pj1', L_WALLS, { outlineSource: { mode: 'walls-core', seed: { x: 2, y: 1.5 }, linked: true } })],
  // (b) laje pelo perímetro externo (8 × 6 m) com parede interna de base 0,10 m abaixo do topo da laje.
  'junc-laje-perimetro-parede': [...wallsOf(RECT_WALLS), W('div', [4, 0], [4, 6], { baseOffset: -0.1 }), SL('ls1', RECT_WALLS, { outlineSource: { mode: 'perimeter', seed: { x: 2, y: 2 }, linked: true } })],
  // (c) parede embutida no piso: a parede atravessa o piso 6 × 4 m e tem base 0,10 m abaixo do topo dele.
  'junc-parede-embutida-piso': [W('e1', [-1, 2], [7, 2], { baseOffset: -0.1 }), F('pe1', [[0, 0], [6, 0], [6, 4], [0, 4]])],
};

// Determinismo: o enquadramento (zoomExtents) usa a largura e a altura guardadas na vista do editor, que só são atualizadas
// no desenho seguinte ao layout. A espera pede duas medidas iguais seguidas do canvas, que a vista do editor tenha o mesmo
// tamanho, e dois quadros de animação. Assim o enquadramento sai sempre com a área final.
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

let failed = 0;
for (const [name, items] of Object.entries({ ...CASES, ...FLOOR_CASES, ...SLAB_CASES, ...ROOF_CASES, ...ROOM_CASES, ...JUNCTION_CASES })) {
  const vista = name in ROOF_CASES ? VISTA_COBERTURA : null;
  await page.evaluate(([ws, v]) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of ws) editor.store.exec(w.kind === 'room' ? { type: 'addRoom', room: w } : w.kind === 'roof' ? { type: 'addRoof', roof: w } : w.kind === 'slab' ? { type: 'addSlab', slab: w } : w.kind === 'floor' ? { type: 'addFloor', floor: w } : { type: 'addWall', wall: w });
    if (v) editor.store.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: v });
  }, [items, vista]);
  await assentar(page);
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await assentar(page);
  const canvas = page.locator('.canvas-wrap canvas').first();
  const shot = await canvas.screenshot();
  const file = `${BASE}/${name}.png`;
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, shot);
    console.log(`${UPDATE ? 'gravado' : 'novo'}  ${name}`);
    continue;
  }
  writeFileSync(`${OUT}/${name}.png`, shot);
  const ref = readFileSync(file).toString('base64');
  const cur = shot.toString('base64');
  const frac = await page.evaluate(async ([a, b]) => {
    const load = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${b64}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const da = px(ia), db = px(ib);
    let bad = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 12 || Math.abs(da[i + 1] - db[i + 1]) > 12 || Math.abs(da[i + 2] - db[i + 2]) > 12) bad++;
    return bad / (da.length / 4);
  }, [ref, cur]);
  const ok = frac < 0.002;
  if (!ok) failed++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${name}  diferença ${(frac * 100).toFixed(3)}%`);
}
if (errors.length) console.log('erros de página:', errors.join('\n'));
await browser.close();
if (failed || errors.length) process.exit(1);
