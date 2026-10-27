// "Editar perímetro" no app real: telhado (4 águas e em L), piso, laje e forro. Para cada um: selecionar, botão da faixa,
// clique direito com o menu, alterar o contorno e Concluir (um só passo de desfazer), e Cancelar/Esc sem mudar o elemento.
// O forro não é desenhado na planta (a planta de forro ainda não existe), então não tem alvo de clique: a seleção dele é
// pela API e o clique direito na planta é checado como limitação. Piso vinculado às paredes é recusado na abertura.
import { mkdirSync } from 'node:fs';
import { launch, makeReporter, openApp, perimetroPorPontos, worldToPage } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/editar-perimetro';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;

const RETANGULO = [[0, 0], [8, 0], [8, 6], [0, 6]];
const EM_L = [[0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]];
const CASOS = [
  { nome: 'telhado 4 águas', alvo: 'roof', pts: RETANGULO, selecao: 'planta' },
  { nome: 'telhado em L', alvo: 'roof', pts: EM_L, selecao: 'planta' },
  { nome: 'piso', alvo: 'floor', pts: RETANGULO, selecao: 'planta' },
  { nome: 'laje', alvo: 'slab', pts: RETANGULO, selecao: 'planta' },
  { nome: 'forro', alvo: 'ceiling', pts: RETANGULO, selecao: 'api' },
];

/** Estado do modo para os passos: aberto, em qual elemento, linhas do rascunho e resultado da validação. */
const modo = () => page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  const v = editor.perimetro.view();
  return { ativo: v.active, editing: v.editing ?? null, segs: v.draft?.segs.length ?? 0, ok: v.result?.ok === true, status: useUi.getState().status };
});

/** Cópia do elemento como está no projeto (para comparar antes e depois). */
const elemento = (id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.__hestia.editor.project.elements[id] ?? null)), id);

/** Largura do contorno do elemento (metros). */
const largura = (el) => {
  const xs = (el?.boundary ?? []).map((p) => p.x);
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
};

/** Botão da faixa pelo rótulo exato. */
const botao = (nome) => page.getByRole('button', { name: nome, exact: true });

/** Seleciona o elemento: clique na borda (planta) ou pela API (forro, que a planta não pega). */
async function seleciona(c, id) {
  if (c.selecao === 'planta') {
    await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));
    const p = await worldToPage(page, 0, 3);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(80);
    await page.mouse.click(p.x, p.y);
  } else {
    await page.evaluate((id) => window.__hestia.useUi.setState({ selection: [id] }), id);
  }
  await page.waitForTimeout(150);
}

/** Altera o rascunho aberto: empurra os vértices do lado de maior X em `passo` metros e mantém as ids das linhas. */
const alteraRascunho = (passo = 1) => page.evaluate((passo) => {
  const { editor } = window.__hestia;
  const d = editor.activeTool.draft();
  const maxX = Math.max(...d.segs.flatMap((s) => [s.a.x, s.b.x]));
  const mexe = (p) => (p.x === maxX ? { x: p.x + passo, y: p.y } : p);
  editor.activeTool.loadDraft({ ...d, segs: d.segs.map((s) => ({ ...s, a: mexe(s.a), b: mexe(s.b) })) });
}, passo);

/** Cria o elemento do caso num projeto novo e devolve o resultado do modo de perímetro. */
async function criaCaso(c) {
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; editor.newProject('blank'); useUi.setState({ selection: [] }); });
  await page.waitForTimeout(400);
  const r = await perimetroPorPontos(page, c.alvo, c.pts);
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; editor.setTool('select'); useUi.setState({ selection: [] }); editor.zoomExtents(); });
  await page.waitForTimeout(400);
  return r;
}

const slug = (c) => c.nome.replace(/\s+/g, '-');

for (const c of CASOS) {
  let id = null;
  let antes = null;

  await rep.step(`${c.nome}: criar e selecionar`, async () => {
    const r = await criaCaso(c);
    check('elemento criado pelo modo de perímetro', r.ok, r.msg);
    id = await page.evaluate((alvo) => Object.values(window.__hestia.editor.project.elements).find((e) => e.kind === alvo)?.id ?? null, c.alvo);
    check('elemento existe no projeto', !!id, id ?? '');
    await seleciona(c, id);
    const sel = await page.evaluate(() => window.__hestia.useUi.getState().selection);
    check('elemento selecionado', sel.length === 1 && sel[0] === id, JSON.stringify(sel));
    const b = botao('Editar perímetro');
    check('botão "Editar perímetro" existe na aba contextual', (await b.count()) > 0);
    check('botão "Editar perímetro" habilitado', (await b.count()) > 0 && !(await b.first().isDisabled()));
    antes = await elemento(id);
    await page.screenshot({ path: `${OUT}/${c.alvo}-${slug(c)}-selecionado.png` });
  });

  await rep.step(`${c.nome}: botão "Editar perímetro" abre o modo com o contorno`, async () => {
    await botao('Editar perímetro').first().click();
    await page.waitForTimeout(250);
    const m = await modo();
    check('modo de perímetro aberto', m.ativo);
    check('modo editando este elemento', m.editing === id, String(m.editing));
    check('linhas do contorno carregadas', m.segs === c.pts.length, `segs=${m.segs}`);
    check('contorno válido (Concluir habilitado)', m.ok, m.status);
    await page.screenshot({ path: `${OUT}/${c.alvo}-${slug(c)}-modo.png` });
    await botao('Cancelar').click();
    await page.waitForTimeout(150);
    check('Cancelar fecha o modo', !(await modo()).ativo);
  });

  if (c.selecao === 'planta') {
    await rep.step(`${c.nome}: clique direito no elemento -> "Editar perímetro" abre o mesmo modo`, async () => {
      await seleciona(c, id);
      const p = await worldToPage(page, 0, 3);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(80);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.waitForTimeout(200);
      check('menu de contexto aberto', (await page.locator('[role=menu]').count()) > 0);
      const item = page.getByRole('menuitem', { name: 'Editar perímetro', exact: true });
      check('menu tem "Editar perímetro"', (await item.count()) > 0);
      await page.screenshot({ path: `${OUT}/${c.alvo}-${slug(c)}-menu.png` });
      await item.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      const m = await modo();
      check('clique direito abre o modo editando o elemento', m.ativo && m.editing === id, String(m.editing));
      if (m.ativo) await botao('Cancelar').click();
      await page.waitForTimeout(150);
    });
  } else {
    await rep.step(`${c.nome}: limitação da planta (forro sem alvo de clique direito na planta)`, async () => {
      await seleciona(c, id);
      const p = await worldToPage(page, 0, 3);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(80);
      check('a planta não pega o forro (hover vazio na borda)', (await page.evaluate(() => window.__hestia.useUi.getState().hover)) === null);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.waitForTimeout(200);
      check('menu da planta sem "Editar perímetro" (sem alvo)', (await page.getByRole('menuitem', { name: 'Editar perímetro', exact: true }).count()) === 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    });
  }

  await rep.step(`${c.nome}: Concluir regrava o elemento em um passo de desfazer`, async () => {
    await seleciona(c, id);
    await botao('Editar perímetro').first().click();
    await page.waitForTimeout(250);
    await alteraRascunho(1);
    await page.waitForTimeout(150);
    check('alteração do contorno válida', (await modo()).ok);
    await botao('Concluir').click();
    await page.waitForTimeout(250);
    const depois = await elemento(id);
    const m = await modo();
    check('modo fechou após Concluir', !m.ativo, m.status);
    check('mesmo elemento (id preservada)', depois !== null && depois.id === id);
    check('contorno alterado (+1 m de largura)', largura(depois) > largura(antes) + 0.9, `${largura(antes)} -> ${largura(depois)}`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const desfeito = await elemento(id);
    check('um Ctrl+Z volta ao original', JSON.stringify(desfeito) === JSON.stringify(antes), `w=${largura(desfeito)}`);
    await page.screenshot({ path: `${OUT}/${c.alvo}-${slug(c)}-desfeito.png` });
  });

  await rep.step(`${c.nome}: Esc e Cancelar não alteram o elemento`, async () => {
    await seleciona(c, id);
    await botao('Editar perímetro').first().click();
    await page.waitForTimeout(250);
    await alteraRascunho(2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Esc com o modo aberto não altera o elemento', JSON.stringify(await elemento(id)) === JSON.stringify(antes));
    await botao('Cancelar').click();
    await page.waitForTimeout(150);
    check('Cancelar fecha o modo', !(await modo()).ativo);
    check('elemento sem alteração após Cancelar', JSON.stringify(await elemento(id)) === JSON.stringify(antes));
  });
}

await rep.step('piso vinculado às paredes: Editar perímetro recusa na abertura, com o caminho (Desvincular)', async () => {
  await page.evaluate(() => { const { editor, useUi } = window.__hestia; editor.newProject('blank'); useUi.setState({ selection: [] }); });
  await page.waitForTimeout(400);
  await perimetroPorPontos(page, 'floor', RETANGULO);
  const id = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).find((e) => e.kind === 'floor')?.id ?? null);
  await page.evaluate((id) => window.__hestia.editor.store.exec({ type: 'updateElements', ids: [id], patch: { outlineSource: { mode: 'perimeter', linked: true, seed: { x: 2, y: 1.5 } } } }), id);
  await page.evaluate((id) => { window.__hestia.editor.setTool('select'); window.__hestia.useUi.setState({ selection: [id] }); }, id);
  await page.waitForTimeout(200);
  await botao('Editar perímetro').first().click();
  await page.waitForTimeout(250);
  const m = await modo();
  check('modo não abre para piso vinculado', !m.ativo);
  check('barra indica Desvincular', m.status.includes('Desvincular'), m.status);
});

rep.summary();
const semErro = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
if (semErro.length) console.log(`\nerros do navegador (${semErro.length}):\n  ${semErro.slice(0, 5).join('\n  ')}`);
await browser.close();
process.exit(rep.steps.some((s) => s.status === 'FAIL') || semErro.length ? 1 : 0);
