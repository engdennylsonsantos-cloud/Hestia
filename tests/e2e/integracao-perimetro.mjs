// Integração do modo "Criar/Editar perímetro" com as partes da onda (esmaecimento 0,65, realce e seleção, Deslocar sem
// seleção, telhado pronto em planta, alças do arco, Editar perímetro e Desconectar em Mover/Rotacionar). Roda o build de
// produção com `?debug=1` e deixa as capturas em test-results/integracao/. Código de saída 1 se algo falhar.
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, makeReporter, openApp, perimetroPorPontos, worldToPage } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/integracao';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;

/** Estado do modo de perímetro e do projeto, para as verificações. */
const estado = () => page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  const v = editor.perimetro.view();
  return {
    ativo: v.active,
    alvo: v.target,
    editando: v.editing ?? null,
    selecionando: v.selecting === true,
    modify: v.modify,
    segs: v.draft?.segs.length ?? 0,
    selected: [...(v.draft?.selected ?? [])],
    hover: v.hoverId,
    caixa: v.selectionBox ?? null,
    status: useUi.getState().status,
    selecao: useUi.getState().selection,
  };
});

const telhados = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements)
  .filter((e) => e.kind === 'roof')
  .map((r) => ({ id: r.id, boundary: r.boundary.map((p) => ({ x: p.x, y: p.y })), shape: r.shape })));

const paredes = () => page.evaluate(() => Object.values(window.__hestia.editor.project.elements)
  .filter((e) => e.kind === 'wall')
  .map((w) => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y } })));

const botao = (nome) => page.getByRole('button', { name: nome, exact: true });

/** Caixa do rascunho em metros. */
const caixaDoRascunho = () => page.evaluate(() => {
  const segs = window.__hestia.editor.perimetro.view().draft.segs;
  const xs = segs.flatMap((s) => [s.a.x, s.b.x]);
  const ys = segs.flatMap((s) => [s.a.y, s.b.y]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
});

const meioDaLinha = (i = 0) => page.evaluate((k) => {
  const s = window.__hestia.editor.perimetro.view().draft.segs[k];
  return { id: s.id, x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
}, i);

/** Arrasto da caixa de seleção em passos, como o usuário. */
async function arrastar(a, b, { soltar = true } = {}) {
  const pa = await worldToPage(page, a.x, a.y);
  const pb = await worldToPage(page, b.x, b.y);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(pa.x + ((pb.x - pa.x) * i) / 8, pa.y + ((pb.y - pa.y) * i) / 8);
    await page.waitForTimeout(20);
  }
  if (soltar) await page.mouse.up();
  await page.waitForTimeout(150);
}

const canvasRect = () => page.evaluate(() => {
  const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});

/**
 * Analisa a captura do canvas: luminância média, rosa cheio do esboço, picos de azul (alças de seleção) e, dentro de uma
 * caixa do mundo, os vermelhos do telhado, os tons distintos e os traços escuros das arestas.
 */
async function analisar({ caixaMundo = null } = {}) {
  const shot = await page.locator('.canvas-wrap').screenshot();
  const rect = await canvasRect();
  const box = caixaMundo ? await (async () => {
    const a = await worldToPage(page, caixaMundo.minX, caixaMundo.minY);
    const b = await worldToPage(page, caixaMundo.maxX, caixaMundo.maxY);
    return { x0: Math.min(a.x, b.x) - rect.left, y0: Math.min(a.y, b.y) - rect.top, x1: Math.max(a.x, b.x) - rect.left, y1: Math.max(a.y, b.y) - rect.top };
  })() : null;
  return page.evaluate(async ({ b64, rect, box }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const { width: w, height: h } = c;
    const d = g.getImageData(0, 0, w, h).data;
    const sx = w / rect.width;
    const sy = h / rect.height;
    const px = (x, y) => {
      const i = (Math.round(y * sy) * w + Math.round(x * sx)) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    };
    let soma = 0;
    let rosa = 0;
    const rosaCheio = [[194, 24, 91], [255, 111, 176]];
    for (let i = 0; i < d.length; i += 4) {
      soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      for (const [r, gg, b] of rosaCheio) if (Math.abs(d[i] - r) < 24 && Math.abs(d[i + 1] - gg) < 24 && Math.abs(d[i + 2] - b) < 24) { rosa++; break; }
    }
    // Picos de azul (#1d6fe0): a alça é um quadradinho de contorno azul; a linha de seleção não chega ao limiar.
    const blue = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) blue[j] = Math.abs(d[i] - 29) < 55 && Math.abs(d[i + 1] - 111) < 55 && Math.abs(d[i + 2] - 224) < 55 ? 1 : 0;
    const integ = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += blue[y * w + x];
        integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + row;
      }
    }
    const somaAzul = (x, y) => {
      const x0 = Math.max(0, x - 5), y0 = Math.max(0, y - 5), x1 = Math.min(w, x + 6), y1 = Math.min(h, y + 6);
      return integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
    };
    const cand = [];
    for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) {
      const s = somaAzul(x, y);
      if (s >= 45) cand.push({ x, y, s });
    }
    cand.sort((a, b) => b.s - a.s);
    const alcas = [];
    for (const p of cand) {
      if (alcas.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 12)) alcas.push(p);
    }
    const out = { luminancia: soma / (d.length / 4), rosaCheio: rosa, alcas: alcas.length, amostras: [], vermelhos: 0, tons: 0, escuros: 0 };
    if (box) {
      const cores = new Set();
      for (let y = Math.max(0, Math.floor(box.y0)); y < Math.min(h, Math.ceil(box.y1)); y++) {
        for (let x = Math.max(0, Math.floor(box.x0)); x < Math.min(w, Math.ceil(box.x1)); x++) {
          const i = (y * w + x) * 4;
          const r = d[i], gg = d[i + 1], b = d[i + 2];
          if (r > gg + 12 && r > b + 22 && r > 90) {
            out.vermelhos++;
            cores.add(`${r >> 4},${gg >> 4},${b >> 4}`);
          }
          if (r > gg && gg > b && r < 150 && r > 45) out.escuros++;
        }
      }
      out.tons = cores.size;
      const x0 = box.x0, y0 = box.y0, x1 = box.x1, y1 = box.y1;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      out.amostras = [[cx, y0 + (y1 - y0) * 0.25], [cx, y1 - (y1 - y0) * 0.25], [x0 + (x1 - x0) * 0.25, cy], [x1 - (x1 - x0) * 0.25, cy]]
        .map(([x, y]) => px(x, y));
    }
    return out;
  }, { b64: shot.toString('base64'), rect, box });
}

/** Caixa do contorno do telhado em metros. */
const caixaDoTelhado = async (id) => {
  const r = (await telhados()).find((t) => t.id === id);
  const xs = r.boundary.map((p) => p.x);
  const ys = r.boundary.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

const selecionar = (ids) => page.evaluate((sel) => {
  const { editor, useUi } = window.__hestia;
  editor.setTool('select');
  useUi.setState({ selection: sel });
}, ids);

const abrirProjeto = async (nome) => {
  await page.evaluate((n) => window.__hestia.editor.newProject(n), nome);
  // A troca de projeto limpa os viewports e o quadro seguinte os recria: espere antes de converter mundo em tela.
  await page.waitForFunction(() => window.__hestia.editor.viewport() !== null);
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await page.waitForTimeout(500);
};

const novoProjeto = () => abrirProjeto('blank');

await rep.step('(a) modo de telhado com a planta esmaecida em 0,65 e o esboço em cor cheia', async () => {
  await abrirProjeto('house2');
  const b = await page.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
    const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  await page.evaluate(() => { const { editor } = window.__hestia; editor.setTool('roof'); editor.perimetro.setShape('rect'); });
  // Retângulo 0,6 m por fora dos eixos: cobre a casa e o desenho do beiral.
  await clickWorld(page, b.minX - 0.6, b.minY - 0.6);
  await clickWorld(page, b.maxX + 0.6, b.maxY + 0.6);
  await page.waitForTimeout(300);
  let s = await estado();
  check('modo de telhado aberto com 4 linhas', s.ativo && s.alvo === 'roof' && s.segs === 4, `ativo=${s.ativo} alvo=${s.alvo} segs=${s.segs}`);
  await page.screenshot({ path: `${OUT}/a-01-modo-esboco.png` });

  const comDim = await analisar();
  // O valor do esmaecimento é lido ao montar a geometria: numa página limpa, com 0 (sem esmaecer), o mesmo desenho
  // fica mais escuro que nesta, onde vale o DIM_AMOUNT (0,65) do modo.
  const { page: p2 } = await openApp(browser);
  await p2.evaluate(() => { window.__hestiaDimAmount = 0; });
  await p2.evaluate(() => window.__hestia.editor.newProject('house2'));
  await p2.waitForFunction(() => window.__hestia.editor.viewport() !== null);
  await p2.evaluate(() => window.__hestia.editor.zoomExtents());
  await p2.waitForTimeout(300);
  const b2 = await p2.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
    const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  await p2.evaluate(() => { const { editor } = window.__hestia; editor.setTool('roof'); editor.perimetro.setShape('rect'); });
  await clickWorld(p2, b2.minX - 0.6, b2.minY - 0.6);
  await clickWorld(p2, b2.maxX + 0.6, b2.maxY + 0.6);
  await p2.waitForTimeout(400);
  const shot2 = await p2.locator('.canvas-wrap').screenshot();
  const semDim = await p2.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let soma = 0;
    for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return soma / (d.length / 4);
  }, shot2.toString('base64'));
  await p2.close();
  check('planta esmaecida: com 0,65 o fundo é mais claro que sem esmaecimento', comDim.luminancia > semDim + 1,
    `${comDim.luminancia.toFixed(1)} > ${semDim.toFixed(1)}`);
  check('o esboço fica em cor cheia (rosa do esboço presente)', comDim.rosaCheio > 100, `${comDim.rosaCheio} px`);
});

await rep.step('(a) selecionar uma linha (azul sólido) e caixa de seleção nos dois sentidos', async () => {
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  const linha = await meioDaLinha(0);
  await clickWorld(page, linha.x, linha.y);
  let s = await estado();
  check('clique seleciona a linha em azul sólido', s.selected.length === 1 && s.selected[0] === linha.id, s.selected.join(','));
  await page.screenshot({ path: `${OUT}/a-02-linha-selecionada.png` });

  const box = await caixaDoRascunho();
  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  await arrastar({ x: box.minX - 0.5, y: box.minY - 0.5 }, { x: box.maxX + 0.5, y: box.maxY + 0.5 });
  s = await estado();
  check('janela L→R seleciona as 4 linhas', s.selected.length === 4, s.selected.join(','));
  await page.screenshot({ path: `${OUT}/a-03-caixa-janela.png` });

  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  await arrastar({ x: box.maxX + 0.5, y: box.minY + 0.2 }, { x: box.minX - 0.2, y: box.minY - 0.2 });
  s = await estado();
  check('cruzamento R→L seleciona só o que toca', s.selected.length >= 1 && s.selected.length < 4, s.selected.join(','));
  await page.screenshot({ path: `${OUT}/a-04-caixa-cruzamento.png` });
});

await rep.step('(a) Deslocar sem seleção escolhe a linha com o mouse e conclui o telhado', async () => {
  const box = await caixaDoRascunho();
  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  await botao('Deslocar').click();
  await page.waitForTimeout(150);
  let s = await estado();
  check('Deslocar liga sem seleção prévia', s.modify === 'offset' && s.selected.length === 0, `modify=${s.modify} sel=${s.selected.length}`);
  const linha = await meioDaLinha(0);
  await clickWorld(page, linha.x, linha.y);
  s = await estado();
  check('o mouse escolhe a linha e pede a distância', /distância/i.test(s.status), s.status);
  await page.screenshot({ path: `${OUT}/a-05-deslocar-escolhe-linha.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await botao('Concluir').click();
  await page.waitForTimeout(800);
  s = await estado();
  const r = await telhados();
  check('Concluir fecha o modo e cria o telhado', !s.ativo && r.length === 1, `ativo=${s.ativo} telhados=${r.length}`);
  check('o telhado criado fica selecionado', s.selecao.length === 1 && s.selecao[0] === r[0]?.id, s.selecao.join(','));
  await page.screenshot({ path: `${OUT}/a-06-telhado-criado.png` });
});

let telhadoRetangulo = null;
await rep.step('(b) telhado pronto em planta: cor do material, tom por água, arestas finas e alças', async () => {
  telhadoRetangulo = (await telhados())[0]?.id ?? null;
  await page.evaluate(() => window.__hestia.editor.store.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: { top: 7, cut: 6 } }));
  await selecionar([]);
  await page.waitForTimeout(700);
  const caixa = await caixaDoTelhado(telhadoRetangulo);
  const cores = await analisar({ caixaMundo: caixa });
  check('a água tem a cor do material (vermelho de telha)', cores.vermelhos > 2000, `${cores.vermelhos} px`);
  check('as águas têm tons diferentes (luz do sol e inclinação)', cores.tons >= 2, `${cores.tons} tons`);
  check('há arestas finas escuras entre as águas', cores.escuros > 200, `${cores.escuros} px`);
  const claros = cores.amostras.filter(([r, g, b]) => r > g && g >= b - 5 && r > 90).length;
  check('as quatro águas leem como telhado (amostras avermelhadas)', claros === 4, JSON.stringify(cores.amostras));
  await page.screenshot({ path: `${OUT}/b-01-telhado-planta.png` });

  await selecionar([telhadoRetangulo]);
  await page.waitForTimeout(500);
  const sel = await analisar();
  check('telhado selecionado mostra as 4 alças dos cantos', sel.alcas === 4, `${sel.alcas}`);
  await page.screenshot({ path: `${OUT}/b-02-telhado-selecionado.png` });
});

await rep.step('(c) telhado em arco selecionado: alças só nos cantos lógicos', async () => {
  await novoProjeto();
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (Math.PI / 2) * (i / 24);
    pts.push([Math.cos(a) * 8, Math.sin(a) * 8]);
  }
  const r = await perimetroPorPontos(page, 'roof', pts, { inclina: (i) => i > 20 });
  check('telhado em arco criado pelo perímetro', r.ok, r.msg);
  const id = (await telhados())[0]?.id;
  const boundary = (await telhados())[0]?.boundary.length ?? 0;
  check('o arco é amostrado em muitos lados', boundary >= 20, `${boundary} lados`);
  await page.evaluate(() => window.__hestia.editor.store.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: { top: 7, cut: 6 } }));
  await selecionar([id]);
  await page.waitForTimeout(500);
  const s = await analisar();
  check('o arco mostra só as alças dos cantos lógicos, não uma por vértice amostrado',
    s.alcas >= 1 && s.alcas <= 4 && s.alcas < boundary / 4, `${s.alcas} alças em ${boundary} lados`);
  await page.screenshot({ path: `${OUT}/c-01-arco-selecionado.png` });
});

await rep.step('(d) Editar perímetro de um telhado existente e repetir seleção/caixa', async () => {
  // Volta ao projeto com o telhado retangular (o mesmo do item b) para editar o perímetro.
  await abrirProjeto('house2');
  const b = await page.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
    const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  const criado = await perimetroPorPontos(page, 'roof', [[b.minX - 0.5, b.minY - 0.5], [b.maxX + 0.5, b.minY - 0.5], [b.maxX + 0.5, b.maxY + 0.5], [b.minX - 0.5, b.maxY + 0.5]]);
  check('telhado existente criado para editar', criado.ok, criado.msg);
  const id = (await telhados())[0]?.id;
  await selecionar([id]);
  await page.waitForTimeout(300);
  await botao('Editar perímetro').click();
  await page.waitForTimeout(400);
  let s = await estado();
  check('Editar perímetro abre o modo com o contorno do telhado', s.ativo && s.editando === id && s.segs === 4,
    `ativo=${s.ativo} editando=${s.editando} segs=${s.segs}`);
  await page.screenshot({ path: `${OUT}/d-01-editar-perimetro.png` });

  // Como no modo de criação, o Selecionar do esboço é uma ferramenta à parte: volta a ela antes de clicar/arrastar.
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  await page.waitForTimeout(200);
  s = await estado();
  check('no modo de edição, o Selecionar fica disponível', s.selecionando === true, `selecionando=${s.selecionando}`);

  const linha = await meioDaLinha(0);
  await clickWorld(page, linha.x, linha.y);
  s = await estado();
  check('no modo de edição, o clique seleciona a linha', s.selected.length === 1, s.selected.join(','));
  const box = await caixaDoRascunho();
  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  await arrastar({ x: box.minX - 0.4, y: box.minY - 0.4 }, { x: box.maxX + 0.4, y: box.maxY + 0.4 });
  s = await estado();
  check('no modo de edição, a janela seleciona as 4 linhas', s.selected.length === 4, s.selected.join(','));
  await page.screenshot({ path: `${OUT}/d-02-editar-caixa.png` });
  await botao('Cancelar').click();
  await page.waitForTimeout(300);
  s = await estado();
  check('Cancelar fecha a edição sem mudar o telhado', !s.ativo && (await telhados()).length === 1, `ativo=${s.ativo}`);
});

await rep.step('(e) duas paredes ligadas: Mover, Mover com Desconectar e Rotacionar padrão', async () => {
  await novoProjeto();
  await page.evaluate(() => window.__hestia.editor.setTool('wall'));
  await clickWorld(page, 2, 2);
  await clickWorld(page, 6, 2);
  await clickWorld(page, 6, 5);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const ws0 = await paredes();
  check('duas paredes ligadas desenhadas', ws0.length === 2, `(${ws0.length})`);
  const a = ws0.find((w) => Math.abs(w.a.x - 2) < 1e-6 && Math.abs(w.a.y - 2) < 1e-6);
  const b = ws0.find((w) => w.id !== a?.id);
  const igual = (p, x, y) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;
  await selecionar([a.id]);
  await page.evaluate(() => window.__hestia.editor.setTool('move'));
  await clickWorld(page, 2, 2);
  await clickWorld(page, 2, 1);
  let ws = await paredes();
  const a1 = ws.find((w) => w.id === a.id);
  const b1 = ws.find((w) => w.id === b.id);
  check('Mover: a vizinha acompanha e continua ligada', igual(a1.a, 2, 1) && igual(b1.a, 6, 1) && igual(b1.b, 6, 5),
    `${b1.a.x},${b1.a.y} → ${b1.b.x},${b1.b.y}`);
  await page.screenshot({ path: `${OUT}/e-01-mover.png` });
  await page.keyboard.press('Control+z');

  await page.evaluate(() => window.__hestia.editor.setTool('move'));
  await page.locator('#opt-mdisjoin').check();
  await clickWorld(page, 2, 2);
  await clickWorld(page, 2, 1);
  ws = await paredes();
  const a2 = ws.find((w) => w.id === a.id);
  const b2 = ws.find((w) => w.id === b.id);
  check('Mover com Desconectar: a vizinha fica e a ponta se solta', igual(a2.a, 2, 1) && !igual(a2.b, b2.a) && igual(b2.a, 6, 2),
    `${a2.b.x},${a2.b.y} solto de ${b2.a.x},${b2.a.y}`);
  await page.screenshot({ path: `${OUT}/e-02-mover-desconectar.png` });
  await page.keyboard.press('Control+z');

  await page.evaluate(() => window.__hestia.editor.setTool('rotate'));
  const desligado = await page.locator('#opt-rdisjoin').isChecked();
  await clickWorld(page, 2, 2);
  await page.keyboard.type('90');
  await page.keyboard.press('Enter');
  ws = await paredes();
  const a3 = ws.find((w) => w.id === a.id);
  const b3 = ws.find((w) => w.id === b.id);
  check('Rotacionar padrão (Desconectar ligado) solta a vizinha', desligado && igual(a3.a, 2, 2) && igual(b3.a, 6, 2) && igual(b3.b, 6, 5),
    `A=${a3.b.x},${a3.b.y} B=${b3.a.x},${b3.a.y}→${b3.b.x},${b3.b.y}`);
  await page.screenshot({ path: `${OUT}/e-03-rotacionar.png` });
});

rep.check('sem erros no console', errors.length === 0, errors.join(' | '));
rep.summary();
await browser.close();
process.exit(rep.steps.some((s) => s.status !== 'PASS') ? 1 : 0);
