// Comandos de Modificar sobre o esboço do perímetro, no app real: 4 linhas de um retângulo que passam dos cantos são aparadas
// com cliques no canvas, depois divididas, deslocadas (com Ctrl+Z no rascunho), e o perímetro vira um piso.
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, makeReporter, openApp, worldToPage } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/modificar';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser);
const rep = makeReporter();
const { check } = rep;
// Retângulo do esboço (metros), preenchido no primeiro passo e usado pelos cliques dos seguintes.
let geo = null;

/** Estado do modo para os passos: linhas do rascunho, situação do comando e do fechamento. */
const estado = () => page.evaluate(() => {
  const { editor } = window.__hestia;
  const v = editor.perimetro.view();
  const xs = (v.draft?.segs ?? []).flatMap((s) => [s.a.x, s.b.x]);
  const ys = (v.draft?.segs ?? []).flatMap((s) => [s.a.y, s.b.y]);
  return {
    ativo: v.active,
    modo: v.modify,
    ok: v.result?.ok === true,
    segs: v.draft?.segs.length ?? 0,
    largura: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    altura: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
    status: window.__hestia.useUi.getState().status,
    elementos: Object.keys(editor.project.elements).length,
    pisos: Object.values(editor.project.elements).filter((e) => e.kind === 'floor').length,
  };
});

/** Prévia do comando ativo: realce (halo) do alvo, resultado tracejado e o próximo passo na barra. */
const previa = () => page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  const t = editor.activeTool;
  const itens = t.preview();
  return {
    halos: itens.filter((i) => i.kind === 'line' && i.halo).length,
    tracejadas: itens.filter((i) => i.kind === 'line' && i.dashed).length,
    selected: [...t.draft().selected],
    prompt: t.inputPrompt(),
    status: useUi.getState().status,
  };
});

/** Limpa a seleção do esboço sem mexer na geometria (para testar os comandos sem seleção prévia). */
const semSelecao = () => page.evaluate(() => {
  const t = window.__hestia.editor.activeTool;
  const d = t.draft();
  t.loadDraft({ ...d, selected: [] });
});

/** Leva o mouse a um ponto de mundo (para ver o hover e a prévia sem clicar). */
async function passarPor(x, y) {
  const p = await worldToPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(120);
}

/** Botão da faixa pelo nome (rótulo exato), com o estado de pressionado e de desabilitado. */
const botao = (nome) => page.getByRole('button', { name: nome, exact: true });

await rep.step('abre o modo de piso sobre a casa, com 4 linhas que passam dos cantos', async () => {
  await page.evaluate(() => { const { editor } = window.__hestia; editor.newProject('house2'); editor.zoomExtents(); });
  await page.waitForTimeout(400);
  const b = await page.evaluate(() => {
    const ws = Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall');
    const xs = ws.flatMap((w) => [w.a.x, w.b.x]); const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  });
  // Retângulo 0,4 m fora das paredes; cada linha passa 0,6 m do canto (o excedente é o que o Aparar tira).
  const x0 = b.minX - 0.4, x1 = b.maxX + 0.4, y0 = b.minY - 0.4, y1 = b.maxY + 0.4, e = 0.6;
  await page.evaluate(() => window.__hestia.editor.setTool('floor'));
  await page.evaluate(({ x0, x1, y0, y1, e }) => {
    const { editor } = window.__hestia;
    const segs = [
      { id: 'inf', a: { x: x0 - e, y: y0 }, b: { x: x1 + e, y: y0 } },
      { id: 'dir', a: { x: x1, y: y0 - e }, b: { x: x1, y: y1 + e } },
      { id: 'sup', a: { x: x1 + e, y: y1 }, b: { x: x0 - e, y: y1 } },
      { id: 'esq', a: { x: x0, y: y1 + e }, b: { x: x0, y: y0 - e } },
    ];
    editor.activeTool.loadDraft({ target: 'floor', segs, selected: [], defaults: { definesSlope: false, slopePct: 0, overhang: 0 } });
  }, { x0, x1, y0, y1, e });
  await page.waitForTimeout(300);
  const s = await estado();
  check('modo de piso aberto com 4 linhas', s.ativo && s.segs === 4, `segs=${s.segs}`);
  check('contorno ainda aberto (linhas passam dos cantos)', !s.ok);
  check('Escala desabilitada no esboço', await botao('Escala').isDisabled());
  check('Trocar anfitriã desabilitado no esboço', await page.getByRole('button', { name: /Trocar hosped/ }).first().isDisabled());
  await page.screenshot({ path: `${OUT}/95-perimetro-modificar-inicio.png` });
  geo = { x0, x1, y0, y1, e };
});

await rep.step('Aparar/Estender liga pelo botão, fica pressionado e desliga ao clicar de novo', async () => {
  await botao('Aparar/Estender').click();
  check('botão Aparar pressionado', (await botao('Aparar/Estender').getAttribute('aria-pressed')) === 'true');
  check('modo do esboço = trim', (await estado()).modo === 'trim');
  await botao('Aparar/Estender').click();
  check('segundo clique desliga o comando', (await estado()).modo === null);
  await botao('Aparar/Estender').click();
});

await rep.step('Aparar nos 4 cantos, com cliques de verdade no canvas', async () => {
  const { x0, x1, y0, y1 } = geo;
  // Em cada canto, um clique em cada linha, no trecho que fica dentro do retângulo (o excedente de fora é aparado).
  const cantos = [
    [[x0 + 0.3, y0], [x0, y0 + 0.3]],
    [[x1 - 0.3, y0], [x1, y0 + 0.3]],
    [[x1, y1 - 0.3], [x1 - 0.3, y1]],
    [[x0 + 0.3, y1], [x0, y1 - 0.3]],
  ];
  for (const [p, q] of cantos) {
    await clickWorld(page, p[0], p[1]);
    await clickWorld(page, q[0], q[1]);
    await page.waitForTimeout(120);
  }
  const s = await estado();
  check('contorno fechado pelos 4 cantos (closeInfo ok)', s.ok, s.status);
  check('largura do contorno igual ao retângulo', Math.abs(s.largura - (x1 - x0)) < 0.05, s.largura.toFixed(2));
  await page.screenshot({ path: `${OUT}/96-perimetro-aparado.png` });
});

await rep.step('Dividir elemento divide a linha do topo', async () => {
  const antes = (await estado()).segs;
  await botao('Dividir elemento').click();
  check('botão Dividir pressionado', (await botao('Dividir elemento').getAttribute('aria-pressed')) === 'true');
  const { x0, x1, y1 } = geo;
  await clickWorld(page, (x0 + x1) / 2, y1);
  await page.waitForTimeout(120);
  const s = await estado();
  check('uma linha a mais no esboço', s.segs === antes + 1, `${antes} -> ${s.segs}`);
  check('contorno continua fechado', s.ok);
  await botao('Dividir elemento').click();
});

await rep.step('Deslocar desloca o laço por 0,2 m, e Ctrl+Z desfaz só o rascunho', async () => {
  const antes = await estado();
  const elementos = antes.elementos;
  const { x0, x1, y0, y1 } = geo;
  // O laço inteiro (inclusive as metades da linha dividida): seleciona todas as linhas antes de ligar o comando.
  await page.evaluate(() => { const t = window.__hestia.editor.activeTool; const d = t.draft(); t.loadDraft({ ...d, selected: d.segs.map((x) => x.id) }); });
  await botao('Deslocar').click();
  await page.keyboard.type('0.2');
  await page.keyboard.press('Enter');
  await clickWorld(page, x1 + 0.5, (y0 + y1) / 2);
  await page.waitForTimeout(150);
  const depois = await estado();
  check('deslocamento aumenta a largura do laço', depois.largura > antes.largura + 0.15, `${antes.largura.toFixed(2)} -> ${depois.largura.toFixed(2)}`);
  const issues = await page.evaluate(() => window.__hestia.editor.perimetro.view().result.issues.map((i) => i.code + ':' + i.message));
  check('laço continua fechado', depois.ok, issues.join(' | '));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  const desfeito = await estado();
  check('Ctrl+Z volta o rascunho ao contorno anterior', Math.abs(desfeito.largura - antes.largura) < 0.01, desfeito.largura.toFixed(2));
  check('Ctrl+Z não mexe no projeto (mesmo número de elementos)', desfeito.elementos === elementos);
  await botao('Deslocar').click();
});

await rep.step('Deslocar sem seleção: escolhe a linha pelo mouse, vê a prévia e confirma pelo clique do lado', async () => {
  const antes = await estado();
  const { x0, x1, y0 } = geo;
  const mid = (x0 + x1) / 2;
  await semSelecao();
  await botao('Deslocar').click();
  let p = await previa();
  check('comando liga sem seleção e pede a linha', (await estado()).modo === 'offset' && p.selected.length === 0 && /clique na linha a deslocar/.test(p.status), p.status);
  await passarPor(mid, y0);
  p = await previa();
  check('hover realça a linha sob o cursor', p.halos >= 1, `halos=${p.halos}`);
  await page.screenshot({ path: `${OUT}/90-deslocar-alvo.png` });
  await clickWorld(page, mid, y0);
  p = await previa();
  check('um clique escolhe a linha e avança para a distância', p.selected.length === 1 && p.prompt === 'Distância (ou clique do lado)', `${p.selected.length}/${p.prompt}`);
  await passarPor(mid, y0 - 0.4);
  p = await previa();
  check('prévia tracejada da cópia do lado do cursor', p.tracejadas > 0, `tracejadas=${p.tracejadas}`);
  check('barra de status pede a distância ou o lado', /distância|clique do lado/i.test(p.status), p.status);
  await page.screenshot({ path: `${OUT}/91-deslocar-previa.png` });
  await clickWorld(page, mid, y0 - 0.4);
  await page.waitForTimeout(150);
  const depois = await estado();
  check('clique do lado aplica o deslocamento', depois.segs === antes.segs + 1 && depois.altura > antes.altura + 0.3, `segs ${antes.segs}->${depois.segs}, altura ${antes.altura.toFixed(2)}->${depois.altura.toFixed(2)}`);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  const desfeito = await estado();
  check('Ctrl+Z desfaz o deslocamento', Math.abs(desfeito.altura - antes.altura) < 0.01, desfeito.altura.toFixed(2));
});

await rep.step('Deslocar com distância digitada (vírgula decimal) e confirmada pelo lado', async () => {
  const antes = await estado();
  const { x0, x1, y0 } = geo;
  const mid = (x0 + x1) / 2;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  let p = await previa();
  check('Esc volta a escolher o alvo sem sair do comando', (await estado()).modo === 'offset' && p.selected.length === 0, `${p.selected.length} selecionada(s)`);
  await clickWorld(page, mid, y0);
  await page.keyboard.type('0,30');
  await page.keyboard.press('Enter');
  p = await previa();
  check('a vírgula decimal foi aceita na distância', /Distância 0\.3 m/.test(p.status), p.status);
  await passarPor(mid, y0 - 0.6);
  p = await previa();
  check('prévia tracejada com a distância digitada', p.tracejadas > 0, `tracejadas=${p.tracejadas}`);
  await page.screenshot({ path: `${OUT}/92-deslocar-distancia.png` });
  await clickWorld(page, mid, y0 - 0.6);
  await page.waitForTimeout(150);
  const depois = await estado();
  check('deslocamento de 0,30 m', Math.abs(depois.altura - antes.altura - 0.3) < 0.02, (depois.altura - antes.altura).toFixed(2));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  const desfeito = await estado();
  check('Ctrl+Z volta a altura anterior', Math.abs(desfeito.altura - antes.altura) < 0.01, desfeito.altura.toFixed(2));
  await botao('Deslocar').click();
});

await rep.step('Tab alterna para todo o laço conectado, realça e escolhe as linhas ligadas', async () => {
  const antes = await estado();
  const { x0, x1, y0 } = geo;
  const mid = (x0 + x1) / 2;
  const n = antes.segs;
  await semSelecao();
  await botao('Deslocar').click();
  await passarPor(mid, y0);
  let p = await previa();
  check('antes do Tab, só a linha sob o cursor', p.halos === 1, `halos=${p.halos}`);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(120);
  p = await previa();
  check('a barra informa o laço conectado', /laço conectado/.test(p.status), p.status);
  check('o realce mostra todas as linhas do laço', p.halos === n, `halos=${p.halos}, laço=${n}`);
  await page.screenshot({ path: `${OUT}/93-laco-conectado.png` });
  await clickWorld(page, mid, y0);
  p = await previa();
  check('um clique escolhe o laço inteiro e avança', p.selected.length === n, `${p.selected.length}/${n}`);
  await page.keyboard.type('0,20');
  await page.keyboard.press('Enter');
  await passarPor(mid, y0 - 0.6);
  p = await previa();
  check('prévia tracejada do laço deslocado', p.tracejadas > 0, `tracejadas=${p.tracejadas}`);
  await page.screenshot({ path: `${OUT}/94-laco-previa.png` });
  await clickWorld(page, mid, y0 - 0.6);
  await page.waitForTimeout(150);
  const depois = await estado();
  check('o laço deslocado tem o mesmo número de linhas novas', depois.segs === n * 2, `${n} -> ${depois.segs}`);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  await botao('Deslocar').click();
});

await rep.step('Concluir cria o piso e fecha o modo; a faixa volta ao normal', async () => {
  const s0 = await estado();
  check('Concluir habilitado com o contorno fechado', await page.getByRole('button', { name: 'Concluir', exact: true }).isEnabled());
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.waitForTimeout(300);
  const s = await estado();
  check('modo fechou', !s.ativo);
  check('um piso criado', s.pisos === 1 && s0.pisos === 0, `pisos=${s.pisos}`);
  check('projeto ganhou o elemento', s.elementos === s0.elementos + 1);
  await page.screenshot({ path: `${OUT}/97-perimetro-piso.png` });
});

await rep.step('fora do modo, Mover continua a ferramenta normal do app', async () => {
  await page.locator('.rtab:visible', { hasText: 'Modificar' }).first().click();
  await botao('Mover').click();
  const tool = await page.evaluate(() => window.__hestia.useUi.getState().tool);
  check('ferramenta Mover ativa', tool === 'move', tool);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});

rep.summary();
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
const falhou = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(falhou ? 1 : 0);
