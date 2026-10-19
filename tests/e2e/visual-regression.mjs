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

const W = (id, a, b, extra = {}) => ({ id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '', ...extra });
const F = (id, boundary, extra = {}) => ({ id, kind: 'floor', typeId: 'ft_ceram', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, mark: '', comments: '', ...extra });
const SL = (id, boundary, extra = {}) => ({ id, kind: 'slab', typeId: 'ls_mac15', levelId: 'lv_0', boundary: boundary.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, slope: null, mark: '', comments: '', ...extra });
const M = { kind: 'miter', flip: false };
const S = { kind: 'square', flip: false };
const CASES = {
  'L-encosto': [W('a', [0, 0], [4, 0]), W('b', [4, 0], [4, 3])],
  'L-esquadria': [W('a', [0, 0], [4, 0], { joinEnd: M }), W('b', [4, 0], [4, 3], { joinStart: M })],
  'L-esquadro': [W('a', [0, 0], [4, 0], { joinEnd: S }), W('b', [4, 0], [4, 3], { joinStart: S })],
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

let failed = 0;
for (const [name, items] of Object.entries({ ...CASES, ...FLOOR_CASES, ...SLAB_CASES })) {
  await page.evaluate((ws) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    for (const w of ws) editor.store.exec(w.kind === 'slab' ? { type: 'addSlab', slab: w } : w.kind === 'floor' ? { type: 'addFloor', floor: w } : { type: 'addWall', wall: w });
    editor.zoomExtents();
  }, items);
  await page.waitForTimeout(250);
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
