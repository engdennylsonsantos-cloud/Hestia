// Realce e seleção de linhas no modo de perímetro, no app real: desenha um retângulo no piso, volta à seleção, clica numa
// linha, usa Shift/Ctrl/Ctrl+A e arrasta as duas janelas (esquerda→direita e direita→esquerda), com capturas em
// test-results/realce/. Confere o estado do esboço (seleção, cursor e caixa) e olha as capturas antes de entregar.
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, makeReporter, openApp, worldToPage } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/realce';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;

/** Estado do esboço: linhas, seleção, linha sob o cursor e caixa de seleção em arraste. */
const estado = () => page.evaluate(() => {
  const v = window.__hestia.editor.perimetro.view();
  return {
    ativo: v.active,
    segs: v.draft?.segs.length ?? 0,
    selecionadas: [...(v.draft?.selected ?? [])],
    hover: v.hoverId,
    caixa: v.selectionBox ? { a: v.selectionBox.a, b: v.selectionBox.b, window: v.selectionBox.window } : null,
    status: window.__hestia.useUi.getState().status,
  };
});

/** Meio de uma linha do rascunho, em coordenadas de mundo. */
const meioDaLinha = (indice = 0) => page.evaluate((i) => {
  const s = window.__hestia.editor.perimetro.view().draft.segs[i];
  return { id: s.id, x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
}, indice);

/** Caixa de todas as linhas do rascunho, em metros. */
const caixaDoRascunho = () => page.evaluate(() => {
  const segs = window.__hestia.editor.perimetro.view().draft.segs;
  const xs = segs.flatMap((s) => [s.a.x, s.b.x]);
  const ys = segs.flatMap((s) => [s.a.y, s.b.y]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
});

/** Clique com modificadores (Shift soma, Ctrl subtrai) num ponto de mundo. */
async function cliqueCom(page, x, y, tecla) {
  const p = await worldToPage(page, x, y);
  if (tecla) await page.keyboard.down(tecla);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  if (tecla) await page.keyboard.up(tecla);
  await page.waitForTimeout(80);
}

/** Arrasto de `a` a `b` (mundo) em passos, para a ferramenta receber movimento de verdade. */
async function arrastar(page, a, b, { soltar = true } = {}) {
  const pa = await worldToPage(page, a.x, a.y);
  const pb = await worldToPage(page, b.x, b.y);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(pa.x + ((pb.x - pa.x) * i) / 6, pa.y + ((pb.y - pa.y) * i) / 6);
    await page.waitForTimeout(25);
  }
  if (soltar) await page.mouse.up();
  await page.waitForTimeout(120);
}

await rep.step('abre o modo de piso e desenha um retângulo com dois cliques', async () => {
  await page.evaluate(() => window.__hestia.editor.newProject('house2'));
  // A troca de projeto limpa os viewports e o quadro seguinte os recria; espere a cena assentar antes de enquadrar.
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
    const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  await page.evaluate(() => window.__hestia.editor.setTool('floor'));
  await page.evaluate(() => window.__hestia.editor.perimetro.setShape('rect'));
  // Retângulo 1 m para dentro das paredes: as quatro linhas cabem na vista, com margem para a janela de seleção.
  await clickWorld(page, b.minX + 1, b.minY + 1);
  await clickWorld(page, b.maxX - 1, b.maxY - 1);
  await page.waitForTimeout(250);
  const s = await estado();
  check('modo de piso aberto com 4 linhas', s.ativo && s.segs === 4, `segs=${s.segs}`);
  check('nada selecionado depois de desenhar', s.selecionadas.length === 0);
  await page.screenshot({ path: `${OUT}/01-retangulo.png` });
});

await rep.step('volta à seleção e destaca a linha sob o cursor em azul claro', async () => {
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  const linha = await meioDaLinha(0);
  const p = await worldToPage(page, linha.x, linha.y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(150);
  const s = await estado();
  check('cursor destaca uma linha', s.hover === linha.id, `${s.hover} / ${linha.id}`);
  await page.screenshot({ path: `${OUT}/02-hover.png` });
});

await rep.step('clique na linha seleciona em azul sólido com pontas e meio', async () => {
  const linha = await meioDaLinha(0);
  await clickWorld(page, linha.x, linha.y);
  const s = await estado();
  check('a linha clicada fica selecionada', s.selecionadas.includes(linha.id), s.selecionadas.join(','));
  await page.screenshot({ path: `${OUT}/03-linha-selecionada.png` });
});

await rep.step('Ctrl+A seleciona todas; clique no vazio limpa; Shift soma e Ctrl subtrai', async () => {
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(150);
  check('Ctrl+A seleciona as 4 linhas', (await estado()).selecionadas.length === 4);
  await page.screenshot({ path: `${OUT}/04-ctrl-a.png` });

  const box = await caixaDoRascunho();
  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  const limpo = await estado();
  check('clique no vazio sem Shift limpa a seleção', limpo.selecionadas.length === 0);

  const a = await meioDaLinha(0);
  const b = await meioDaLinha(1);
  await cliqueCom(page, a.x, a.y);
  await cliqueCom(page, b.x, b.y, 'Shift');
  const soma = await estado();
  check('Shift soma a segunda linha', soma.selecionadas.length === 2, soma.selecionadas.join(','));
  await cliqueCom(page, a.x, a.y, 'Control');
  const subtrai = await estado();
  check('Ctrl subtrai a linha clicada', subtrai.selecionadas.length === 1 && !subtrai.selecionadas.includes(a.id), subtrai.selecionadas.join(','));
});

await rep.step('janela da esquerda para a direita pega as linhas inteiras e aparece durante o arraste', async () => {
  const box = await caixaDoRascunho();
  await clickWorld(page, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  await arrastar(page, { x: box.minX - 0.4, y: box.minY - 0.4 }, { x: box.maxX + 0.4, y: box.maxY + 0.4 }, { soltar: false });
  const durante = await estado();
  check('caixa desenhada durante o arraste', durante.caixa !== null, JSON.stringify(durante.caixa));
  check('arrasto da esquerda para a direita é janela', durante.caixa?.window === true);
  await page.screenshot({ path: `${OUT}/05-janela-durante.png` });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const depois = await estado();
  check('a janela seleciona as 4 linhas', depois.selecionadas.length === 4, depois.selecionadas.join(','));
  check('a caixa some ao soltar', depois.caixa === null);
  await page.screenshot({ path: `${OUT}/06-janela-selecionadas.png` });
});

await rep.step('janela da direita para a esquerda pega as linhas que toca', async () => {
  const box = await caixaDoRascunho();
  await clickWorld(page, box.minX - 2, box.minY - 2);
  const yMeio = box.minY + 0.15;
  await arrastar(page, { x: box.maxX + 0.4, y: yMeio }, { x: box.minX + 0.3, y: box.minY - 0.15 }, { soltar: false });
  const durante = await estado();
  check('arrasto da direita para a esquerda é cruzamento', durante.caixa?.window === false);
  await page.screenshot({ path: `${OUT}/07-cruzamento-durante.png` });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const depois = await estado();
  check('o cruzamento pega pelo menos a linha de baixo', depois.selecionadas.length >= 1, depois.selecionadas.join(','));
});

await rep.step('tema escuro: a mesma seleção continua visível', async () => {
  await page.keyboard.press('Control+a');
  await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'dark' }));
  await page.waitForTimeout(350);
  const s = await estado();
  check('seleção preservada no tema escuro', s.selecionadas.length === 4);
  await page.screenshot({ path: `${OUT}/08-tema-escuro.png` });
  await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'light' }));
});

rep.summary();
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
const falhou = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(falhou ? 1 : 0);
