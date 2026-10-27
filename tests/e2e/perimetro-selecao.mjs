// Selecionar e caixa de seleção com o modo "Criar/Editar perímetro" aberto, no app real: para piso e telhado, abre o modo,
// desenha um retângulo, volta ao Selecionar, escolhe uma linha por clique e por caixa (nos dois sentidos) e confere
// editor.perimetro.view(). As capturas ficam em test-results/selecao/.
//
// Depende do agente A (lógica pura de seleção no esboço: janela, Shift/Ctrl, Ctrl+A, hover e desenho da caixa). Os passos
// marcados com "(A)" falham enquanto essa parte não estiver integrada; o restante é da camada do app.
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, makeReporter, openApp, worldToPage } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/selecao';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;

const RECT = [[0, 0], [6, 0], [6, 4], [0, 4]];

/** Estado do modo para as verificações: alvo, seleção do esboço, comando/forma e seleção do projeto. */
const estado = () => page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  const v = editor.perimetro.view();
  return {
    ativo: v.active,
    alvo: v.target,
    selecionando: v.selecting === true,
    modify: v.modify,
    shape: v.shape,
    segs: v.draft?.segs.length ?? 0,
    selected: [...(v.draft?.selected ?? [])],
    isso: v.draft?.segs.map((s) => ({ id: s.id, a: { ...s.a }, b: { ...s.b } })) ?? [],
    status: useUi.getState().status,
    selecaoProjeto: useUi.getState().selection.length,
    elementos: Object.keys(editor.project.elements).length,
  };
});

/** Botão Selecionar do painel "Selecionar" da aba contextual (o rótulo do botão é o do atalho, por isso o painel). */
const botaoSelecionar = () => page.locator('.rb-panel[aria-label="Selecionar"], .rb-panel[aria-label="Select"]').first().locator('button').first();

/** Botão da faixa pelo rótulo exato. */
const botao = (nome) => page.getByRole('button', { name: nome, exact: true });

/** Abre o modo do alvo e deixa o retângulo no rascunho, como se tivesse sido desenhado. */
async function abrirComRetangulo(alvo) {
  await page.evaluate((alvo) => {
    const { editor } = window.__hestia;
    editor.newProject('house2');
    editor.zoomExtents();
    editor.setTool(alvo);
    const segs = [
      { id: 'inf', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } },
      { id: 'dir', a: { x: 6, y: 0 }, b: { x: 6, y: 4 } },
      { id: 'sup', a: { x: 6, y: 4 }, b: { x: 0, y: 4 } },
      { id: 'esq', a: { x: 0, y: 4 }, b: { x: 0, y: 0 } },
    ];
    editor.activeTool.loadDraft({ target: alvo, segs, selected: [], defaults: { definesSlope: true, slopePct: 30, overhang: 0.5 } });
  }, alvo);
  await page.waitForTimeout(300);
  const botaoSel = botaoSelecionar();
  await botaoSel.waitFor({ state: 'visible' });
  check(`[${alvo}] modo aberto com 4 linhas`, (await estado()).ativo && (await estado()).segs === 4);
  check(`[${alvo}] botão Selecionar disponível no modo`, await botaoSel.isEnabled());
  await botaoSel.click();
  await page.waitForTimeout(200);
  const s = await estado();
  check(`[${alvo}] voltou ao Selecionar pelo botão`, s.selecionando && s.modify === null);
  check(`[${alvo}] botão Selecionar pressionado`, (await botaoSel.getAttribute('aria-pressed')) === 'true');
  return s;
}

/** Início do arrasto da caixa: devolve a função que solta (depois de uma captura, se quiser). */
async function comecarCaixa(a, b) {
  const p = await worldToPage(page, a[0], a[1]);
  const q = await worldToPage(page, b[0], b[1]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(p.x + ((q.x - p.x) * i) / 8, p.y + ((q.y - p.y) * i) / 8);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(100);
  return async () => {
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
}

/** Limpa a seleção do esboço com um clique no vazio (dentro da casa e longe do retângulo, mas dentro do canvas). */
async function limparSelecao(alvo) {
  await clickWorld(page, 2, 6);
  check(`[${alvo}] clique no vazio limpa a seleção`, (await estado()).selected.length === 0);
}

for (const alvo of ['floor', 'roof']) {
  await rep.step(`[${alvo}] modo, retângulo e volta ao Selecionar`, async () => {
    const s = await abrirComRetangulo(alvo);
    check(`[${alvo}] alvo do modo é ${alvo}`, s.alvo === alvo, s.alvo);
    await page.screenshot({ path: `${OUT}/${alvo}-01-modo.png` });
  });

  await rep.step(`[${alvo}] clique numa linha seleciona; no vazio limpa; Shift soma`, async () => {
    const s0 = await estado();
    const inf = s0.isso.find((x) => x.id === 'inf')?.id;
    await clickWorld(page, 3, 0);
    let s = await estado();
    check(`[${alvo}] clique na linha inferior seleciona uma linha`, s.selected.length === 1 && s.selected[0] === inf, s.selected.join(','));
    await page.screenshot({ path: `${OUT}/${alvo}-02-clique.png` });
    await limparSelecao(alvo);
    await clickWorld(page, 3, 0);
    const p = await worldToPage(page, 6, 2);
    await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(120);
    s = await estado();
    check(`[${alvo}] Shift soma a segunda linha`, s.selected.length === 2, s.selected.join(','));
  });

  await rep.step(`[${alvo}] caixa da esquerda para a direita seleciona o que está dentro (A)`, async () => {
    await limparSelecao(alvo);
    const soltar = await comecarCaixa([-1, -1], [7, 5]);
    await page.screenshot({ path: `${OUT}/${alvo}-03-caixa-arraste.png` });
    await soltar();
    const s = await estado();
    check(`[${alvo}] janela L→R seleciona as 4 linhas do retângulo`, s.segs === 4 && s.selected.length === 4, s.selected.join(','));
    check(`[${alvo}] a seleção é do esboço, não do modelo`, s.selecaoProjeto === 0);
    await page.screenshot({ path: `${OUT}/${alvo}-04-caixa-janela.png` });
  });

  await rep.step(`[${alvo}] caixa da direita para a esquerda seleciona o que toca (A)`, async () => {
    await limparSelecao(alvo);
    const soltar = await comecarCaixa([5, -1], [-1, 2]);
    await soltar();
    const s = await estado();
    check(`[${alvo}] cruzamento R→L seleciona linhas tocadas`, s.selected.length > 0 && s.selected.length < 4, s.selected.join(','));
    await page.screenshot({ path: `${OUT}/${alvo}-05-caixa-cruzamento.png` });
  });

  await rep.step(`[${alvo}] Ctrl+A seleciona todas as linhas do esboço`, async () => {
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(120);
    const s = await estado();
    check(`[${alvo}] Ctrl+A seleciona as 4 linhas`, s.selected.length === 4, s.selected.join(','));
    check(`[${alvo}] Ctrl+A não seleciona elementos do projeto`, s.selecaoProjeto === 0);
    check(`[${alvo}] Ctrl+A não fecha o modo`, s.ativo);
  });

  await rep.step(`[${alvo}] comando de Modificar, volta ao Selecionar e Esc`, async () => {
    await limparSelecao(alvo);
    await botao('Mover').click();
    await page.waitForTimeout(120);
    let s = await estado();
    check(`[${alvo}] Mover liga o comando sobre o esboço`, s.modify === 'move', s.modify);
    check(`[${alvo}] com comando ligado, o Selecionar não fica pressionado`, (await botaoSelecionar().getAttribute('aria-pressed')) !== 'true');
    await botaoSelecionar().click();
    await page.waitForTimeout(120);
    s = await estado();
    check(`[${alvo}] voltar ao Selecionar desliga o comando`, s.modify === null && s.selecionando);
    check(`[${alvo}] botão Selecionar volta a ficar pressionado`, (await botaoSelecionar().getAttribute('aria-pressed')) === 'true');
    await botao('Mover').click();
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    s = await estado();
    check(`[${alvo}] Esc desliga o comando e deixa o Selecionar`, s.modify === null && s.selecionando && s.ativo);
  });

  await rep.step(`[${alvo}] fecha o modo e o projeto não mudou`, async () => {
    const antes = await estado();
    await botao('Cancelar').click();
    await page.waitForTimeout(200);
    const s = await estado();
    check(`[${alvo}] Cancelar fecha o modo`, !s.ativo);
    check(`[${alvo}] nada foi criado no projeto`, s.elementos === antes.elementos, s.elementos);
  });
}

rep.summary();
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
const falhou = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(falhou ? 1 : 0);
