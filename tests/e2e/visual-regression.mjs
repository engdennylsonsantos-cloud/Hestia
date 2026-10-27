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
// usam topo 6,0 m e corte 3,20 m: o plano atravessa o telhado (beiral em 2,80 m, cumeeira acima de 3,20 m), então ele é CORTADO:
// só a parte da superfície abaixo do plano aparece, com contorno de corte onde a superfície cruza o plano. As paredes de
// 2,80 m ficam abaixo do corte (projeção).
const VISTA_COBERTURA = { top: 6, cut: 3.2 };
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
// P8 (decisão 0023 §2): os dois casos de término por camada são novos e têm baseline própria (criada e conferida).
// P8 (decisão 0023 §2): tipo de piso ft_ceram com a cerâmica em { cm: -1 } (o padrão é a mesma sem término).
const FT_CERAMICA_RECUADA = { id: 'ft_ceram', name: 'Cerâmico sobre contrapiso', code: 'PS-01', description: '', cost: 160, layers: [
  { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false, termino: { cm: -1 } },
  { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false },
  { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.04, wraps: false },
  { function: 'structure', materialId: 'mat_concreto', thickness: 0.12, wraps: false },
] };
// P7c (parte 2): parede da fachada com o acabamento externo (camada 0, a face +y) em prioridade 1, para ele vencer a laje
// e passar contínuo sobre a borda dela (decisão do dono); o núcleo e o acabamento interno seguem a regra de prioridade.
const FT_FACHADA_LAYERS = [
  { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.02, wraps: false, priority: 1 },
  { function: 'structure', materialId: 'mat_bloco14', thickness: 0.16, wraps: false },
  { function: 'finish1', materialId: 'mat_argamassa', thickness: 0.02, wraps: false },
];
const JUNCTION_CASES = {
  // (a) piso pelo núcleo ("Estender até o núcleo", `walls-core`) em L; as paredes descem 0,10 m abaixo do nível.
  'junc-piso-L-nucleo': [...wallsOf(L_WALLS).map((w) => ({ ...w, baseOffset: -0.1 })), F('pj1', L_WALLS, { outlineSource: { mode: 'walls-core', seed: { x: 2, y: 1.5 }, linked: true } })],
  // (b) laje pelo perímetro externo (8 × 6 m) com parede interna de base 0,10 m abaixo do topo da laje.
  'junc-laje-perimetro-parede': [...wallsOf(RECT_WALLS), W('div', [4, 0], [4, 6], { baseOffset: -0.1 }), SL('ls1', RECT_WALLS, { outlineSource: { mode: 'perimeter', seed: { x: 2, y: 2 }, linked: true } })],
  // (c) parede embutida no piso: a parede atravessa o piso 6 × 4 m e tem base 0,10 m abaixo do topo dele.
  'junc-parede-embutida-piso': [W('e1', [-1, 2], [7, 2], { baseOffset: -0.1 }), F('pe1', [[0, 0], [6, 0], [6, 4], [0, 4]])],
  // (d) piso vinculado em retângulo (8 × 6 m, paredes 0,10 m abaixo do topo) com término automático em todas as camadas.
  'junc-piso-retangulo-auto': [...wallsOf(RECT_WALLS).map((w) => ({ ...w, baseOffset: -0.1 })), F('pr1', RECT_WALLS, { outlineSource: { mode: 'walls-finish', seed: { x: 4, y: 3 }, linked: true } })],
  // (e) o mesmo piso com a cerâmica (topo) recuada 1 cm da face de acabamento (`{ cm: -1 }`); a estrutura segue `auto`.
  'junc-piso-retangulo-cm-menos-1': [{ kind: 'floorType', floorType: FT_CERAMICA_RECUADA }, ...wallsOf(RECT_WALLS).map((w) => ({ ...w, baseOffset: -0.1 })), F('pr2', RECT_WALLS, { outlineSource: { mode: 'walls-finish', seed: { x: 4, y: 3 }, linked: true } })],
  // P7c (parte 2): a parede desenhada é a mesma que se quantifica. (f) a laje a 1,30 m atravessa a parede de 8 m; na
  // planta padrão (corte 1,20 m) a parede aparece recortada no trecho coberto. (g) a laje termina na face interna do
  // acabamento externo (`wt_fachada`, camada 0 com prioridade 1): o acabamento externo passa contínuo e o núcleo e o
  // acabamento interno perdem a faixa da laje.
  'junc-parede-recortada-laje': [W('pr1', [0, 0], [8, 0]), SL('lj1', [[-1, -1], [5, -1], [5, 3], [-1, 3]], { heightOffset: 1.3 })],
  'junc-fachada-continua-laje': [{ kind: 'wallType', wallType: { id: 'wt_alv14', layers: FT_FACHADA_LAYERS } }, W('fc1', [0, 0], [8, 0]), SL('lj2', [[-1, -1], [5, -1], [5, 0.08], [-1, 0.08]], { heightOffset: 1.3 })],
};

// P9 (decisão 0023 §6): parede anexada à base no piso que cobre só metade dela (2 m de 4 m, face superior em +0,05). A planta
// não mostra o degrau da base (ele aparece no corte, no 3D e nos quantitativos), então é um caso novo de baseline própria.
const P9_CASES = {
  'parede-base-piso-metade': [W('bp1', [0, 0], [4, 0], { attachBottomToFloor: true }), F('pb1', [[-1, -1], [2, -1], [2, 1], [-1, 1]], { heightOffset: 0.05 })],
};

// P10 (decisão 0025): piso único (obra inteira, 8 × 6 m) com uma parede interna que atravessa o contorno. Acabamento
// e assentamento param na face (`ft_unico`) ou no núcleo (variante); a estrutura passa por baixo. Baselines novas.
const FT_UNICO = (acabamento) => ({ id: 'ft_unico', name: 'Piso único (obra inteira)', code: 'PS-05', description: '', cost: 250, layers: [
  { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false, termino: acabamento },
  { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: 'face' },
  { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.04, wraps: false, termino: 'face' },
  { function: 'structure', materialId: 'mat_concreto', thickness: 0.12, wraps: false, termino: 'passa' },
] });
const PISO_UNICO_CASES = {
  'piso-unico-parede-face': [{ kind: 'floorType', floorType: FT_UNICO('face') }, W('div', [4, -1], [4, 7]), F('pu1', [[0, 0], [8, 0], [8, 6], [0, 6]], { typeId: 'ft_unico' })],
  'piso-unico-parede-nucleo': [{ kind: 'floorType', floorType: FT_UNICO('nucleo') }, W('div', [4, -1], [4, 7]), F('pu2', [[0, 0], [8, 0], [8, 6], [0, 6]], { typeId: 'ft_unico' })],
};

// Decisão 0024 (representação de aberturas): casos novos de porta, janela, vão livre e X de furo. A planta leva porta de
// giro e janela de correr na parede sul/norte e um vão livre na leste (parede interrompida e duas linhas tracejadas nas faces, sem X); a laje tem
// dois furos quadrangulares (X em cada um). A elevação abre a vista da fachada sul (`addView` + `openSection`) com a porta,
// o vão livre (só o contorno) e a janela.
const OPEN = (id, kind, typeId, hostId, offset) => ({ kind: 'opening', opening: { id, kind, typeId, hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
const RECT_HOLES = [[{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 1, y: 2 }], [{ x: 5, y: 3 }, { x: 5.8, y: 3 }, { x: 5.8, y: 3.8 }, { x: 5, y: 3.8 }]];
const OPENING_CASES = {
  'planta-porta-janela': [...wallsOf(RECT_WALLS), OPEN('po1', 'door', 'ot_p80', 'w0', 2), OPEN('jn1', 'window', 'ot_j120', 'w2', 3), OPEN('vl1', 'door', 'ot_vao90', 'w1', 2.5)],
  'laje-abertura-x': [SL('ls3', RECT_WALLS, { holes: RECT_HOLES })],
};

// Decisão 0028: cotas automáticas do nível ativo (botão "Cotas auto"). A casa 8 × 6 m é desenhada no sentido horário
// (face externa para fora) e tem uma porta na parede sul e uma janela na norte. O caso fixa os critérios do diálogo:
// as quatro camadas, aberturas pelas arestas, referência nas faces externas e só o contorno externo.
const COTAS_WALLS = [[0, 0], [0, 6], [8, 6], [8, 0]];
const COTAS_CASES = {
  'cotas-automaticas': [...wallsOf(COTAS_WALLS), OPEN('cd1', 'door', 'ot_p80', 'w3', 6), OPEN('cj1', 'window', 'ot_j120', 'w1', 3), { kind: 'autoCotas' }],
};
const SECTION_CASES = {
  // Regra B (0023 §3): corte pela hierarquia. Parede embutida no piso (mesmo caso da planta) atravessada pelo corte em x = 3:
  // a zona comum fica com o piso e a parede some dela. Baseline nova: conferir a imagem antes de aceitar.
  'junc-corte-parede-embutida-piso': [W('e1', [-1, 2], [7, 2], { baseOffset: -0.1 }), F('pe1', [[0, 0], [6, 0], [6, 4], [0, 4]]), { kind: 'view', view: { id: 'v_frente', name: 'Corte AA', kind: 'section', a: { x: 3, y: -1 }, b: { x: 3, y: 5 }, depth: 2 } }],
  'elevacao-porta-janela': [...wallsOf(RECT_WALLS), OPEN('po2', 'door', 'ot_p80', 'w0', 2), OPEN('vl2', 'door', 'ot_vao90', 'w0', 4.5), OPEN('jn2', 'window', 'ot_j120', 'w0', 6), { kind: 'view', view: { id: 'v_frente', name: 'Fachada sul', kind: 'elevation', a: { x: -0.5, y: -2 }, b: { x: 8.5, y: -2 }, depth: 8 } }],
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
for (const [name, items] of Object.entries({ ...CASES, ...FLOOR_CASES, ...SLAB_CASES, ...ROOF_CASES, ...ROOM_CASES, ...JUNCTION_CASES, ...P9_CASES, ...OPENING_CASES, ...COTAS_CASES, ...SECTION_CASES, ...PISO_UNICO_CASES })) {
  const vista = name in ROOF_CASES ? VISTA_COBERTURA : null;
  await page.evaluate(([ws, v, sec]) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    // O padrão do Hestia é linhas finas ligadas; as baselines fixam o desenho com os pesos de linha (modo desligado)
    // para comparar a espessura das junções.
    editor.store.exec({ type: 'setLevelGraphics', levelId: 'lv_0', patch: { thinLines: false } });
    editor.store.exec({ type: 'setSectionGraphics', patch: { thinLines: false } });
    for (const w of ws) {
      if (w.kind === 'room') editor.store.exec({ type: 'addRoom', room: w });
      else if (w.kind === 'roof') editor.store.exec({ type: 'addRoof', roof: w });
      else if (w.kind === 'slab') editor.store.exec({ type: 'addSlab', slab: w });
      else if (w.kind === 'floor') editor.store.exec({ type: 'addFloor', floor: w });
      else if (w.kind === 'floorType') editor.store.exec({ type: 'upsertFloorType', floorType: w.floorType });
      else if (w.kind === 'wallType') editor.store.exec({ type: 'upsertWallType', wallType: { ...editor.project.wallTypes[w.wallType.id], ...w.wallType } });
      else if (w.kind === 'opening') editor.store.exec({ type: 'addOpening', opening: w.opening });
      else if (w.kind === 'view') editor.store.exec({ type: 'addView', view: w.view });
      else if (w.kind === 'autoCotas') editor.cotasAutomaticasDaPlanta({ lados: 'todos', geral: true, geometria: true, paredes: true, aberturas: true, modoAberturas: 'arestas', referencia: 'externa', somenteExternas: true, offset: 0.6, espacamento: 0.45 });
      else editor.store.exec({ type: 'addWall', wall: w });
    }
    if (v) editor.store.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: v });
    if (sec) editor.openSection(sec);
  }, [items, vista, name in SECTION_CASES ? 'v_frente' : null]);
  await assentar(page);
  // A vista de corte já se enquadra ao abrir (`openSection`); o enquadramento de planta só vale para os casos de planta.
  if (!(name in SECTION_CASES)) await page.evaluate(() => window.__hestia.editor.zoomExtents());
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
