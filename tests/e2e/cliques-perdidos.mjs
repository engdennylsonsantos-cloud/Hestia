// Regressão dos "cliques perdidos" no canvas (build de produção por file://, ?debug=1).
//
// Cada cenário é um defeito real medido em `repro-cliques.mjs` (ver RELATORIO.md em
// C:\Users\Dennylson\AppData\Local\Temp\opencode\repro-cliques-out). O teste fala o comportamento CORRETO: hoje
// (a) a (e) falham e (f) passa; depois das correções todos devem passar.
//
//   a) 2º clique de uma parede EM CIMA do valor da cota dinâmica  -> 1 parede  (baseline: 0/30)
//   b) 4 px entre pointerdown e pointerup (jitter)                 -> clique entregue, 1 parede (baseline: 0/30)
//   c) newProject + down/up no MESMO tick (viewport ainda nulo)    -> clique entregue, 1 parede (baseline: 0/30)
//   d) arrastar o rótulo do ambiente 4 px e trocar de ferramenta   -> o clique seguinte NÃO é engolido
//   e) botão do meio sobre a alça de inverter a porta (Grade)      -> inicia o pan e não inverte a porta
//   f) sanidade: atalho `w`+`a` e botão Parede da ribbon           -> 2 cliques = 1 parede
//
// Nada do app é alterado em tempo de execução além de instrumentação passiva (contagem de chamadas a
// `editor.pointer`) e de um shim local de `setPointerCapture` para os PointerEvents sintéticos do cenário (c)
// (pointerId sintético não está "ativo" no Chrome e o capture lançaria antes de o gesto ser armado).
//
// Uso:
//   node tests/e2e/cliques-perdidos.mjs                 # n=1, todos os cenários
//   node tests/e2e/cliques-perdidos.mjs --n=10          # repete cada cenário 10x
//   node tests/e2e/cliques-perdidos.mjs --only=a,b      # só os cenários listados
//   node tests/e2e/cliques-perdidos.mjs --out=saida.json
//   SHOTS=test-results/cliques node tests/e2e/cliques-perdidos.mjs   # captura por repetição
//   CHROME_PATH="C:/.../chrome.exe" node tests/e2e/cliques-perdidos.mjs
//
// Saída: uma linha OK/FAIL por repetição, tabela final (cenário, esperado, observado, alvo do evento) e código
// de saída 1 se qualquer cenário falhar.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CHROME_ARGS, openApp, pressTool } from './helpers.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------------------------------------------
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const N = Math.max(1, Number(argv.n ?? 1) || 1);
const ONLY = argv.only ? String(argv.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
const OUT_JSON = path.resolve(String(argv.out ?? 'test-results/cliques-perdidos/resultado.json'));
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : '';

const DIST = path.resolve('apps/web/dist/index.html');
if (!existsSync(DIST)) {
  console.error(`[cliques-perdidos] build ausente: ${DIST}\nRode "npm run build" (o teste não constrói nada).`);
  process.exit(2);
}

function chromeExecutable() {
  const exe = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium',
  ].find((p) => p && existsSync(p));
  if (!exe) throw new Error('Chrome não encontrado: defina CHROME_PATH.');
  return exe;
}

const browser = await chromium.launch({ executablePath: chromeExecutable(), args: CHROME_ARGS });
const { page, errors } = await openApp(browser, { query: '?debug=1' });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------------------------------------------------------
// Instrumentação passiva (não altera o comportamento; só conta)
// ---------------------------------------------------------------------------------------------------------------
await page.evaluate(() => {
  const { editor } = window.__hestia;
  const desc = (el) => {
    if (!el) return '(nada)';
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    const aria = el.getAttribute?.('aria-label') ?? '';
    return `${el.tagName}${aria ? `[${aria}]` : cls ? `.${cls}` : ''}`;
  };
  window.__cliques = { clicks: [], downs: [], events: [] };
  window.__cliquesLimpar = () => {
    window.__cliques.clicks.length = 0;
    window.__cliques.downs.length = 0;
    window.__cliques.events.length = 0;
  };
  for (const t of ['pointerdown', 'pointerup', 'click']) {
    document.addEventListener(
      t,
      (e) => {
        const p = window.__cliques;
        if (!p) return;
        const efp = document.elementFromPoint(e.clientX, e.clientY);
        p.events.push({
          t,
          botao: e.button,
          alvo: desc(e.target),
          efp: desc(efp),
          efpPE: efp ? getComputedStyle(efp).pointerEvents : '',
          vp: !!editor.viewport(),
        });
      },
      true,
    );
  }
  if (editor.__cliquesProbe) return;
  editor.__cliquesProbe = true;
  const original = editor.pointer.bind(editor);
  editor.pointer = (kind, info) => {
    const p = window.__cliques;
    if (p && (kind === 'click' || kind === 'down')) {
      p[kind === 'click' ? 'clicks' : 'downs'].push({ ferramenta: editor.activeTool.id, vp: !!editor.viewport() });
    }
    return original(kind, info);
  };
});

/** Contadores desde o último reset: chamadas `editor.pointer('click')` e alvos reais dos eventos. */
const probe = () =>
  page.evaluate(() => {
    const p = window.__cliques;
    const downs = p.events.filter((e) => e.t === 'pointerdown');
    return {
      clicks: p.clicks.length,
      downs: p.downs.length,
      alvosDown: downs.map((d) => `${d.alvo}${d.efp !== d.alvo ? ` > ${d.efp}` : ''}`),
      alvoDown: downs[0]?.alvo ?? '(sem down)',
      efpDown: downs[0]?.efp ?? '(sem down)',
      peDown: downs[0]?.efpPE ?? '',
      vpNuloDown: downs.length > 0 && downs.every((d) => !d.vp),
    };
  });

// ---------------------------------------------------------------------------------------------------------------
// Auxiliares de página
// ---------------------------------------------------------------------------------------------------------------
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Centro do canvas (posição neutra do cursor). */
const center = () =>
  page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });

/** Leva o cursor para o centro: sai de cima de prévias/cotas retidas da repetição anterior. */
async function neutralCursor() {
  const c = await center();
  await page.mouse.move(c.x, c.y);
  await frames();
  await page.waitForTimeout(60);
}

/** Projeto em branco (ou template) + ferramenta + vista pronta. Zera o probe. */
async function reset({ template = 'blank', tool = 'select', settle = 200 } = {}) {
  await page.evaluate(
    ({ template, tool }) => {
      const { editor } = window.__hestia;
      editor.newProject(template);
      editor.setTool(tool);
      window.__cliquesLimpar();
    },
    { template, tool },
  );
  await frames();
  await page.waitForTimeout(settle);
  // Tira o cursor de cima de prévias retidas da repetição anterior (a cota "segura" a última prévia por 80 px) e só
  // então zera o probe: o primeiro down medido é o do cenário.
  await neutralCursor();
  await page.evaluate(() => window.__cliquesLimpar());
}

/** Enquadramento atual e conversão mundo -> página (mesma conta de `helpers.worldToPage`). */
const view = () =>
  page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    const vp = window.__hestia.editor.viewport();
    return { left: r.x, top: r.y, width: r.width, height: r.height, cx: vp.cx, cy: vp.cy, zoom: vp.zoom };
  });
const toPage = (v, x, y) => ({
  x: Math.round(v.left + v.width / 2 + (x - v.cx) * v.zoom),
  y: Math.round(v.top + v.height / 2 - (y - v.cy) * v.zoom),
});
const offsetPx = (v, dx, dy) => ({ x: Math.round(v.left + v.width / 2 + dx), y: Math.round(v.top + v.height / 2 + dy) });
/** Primeiro ponto do traçado, variando por repetição (não sobrepõe traços/prévias da repetição anterior). */
const pontoInicial = (v, i = 0) => offsetPx(v, -300 + (i % 4) * 26, -120 + (i % 3) * 22);

const walls = () =>
  page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall').length);
const status = () => page.evaluate(() => window.__hestia.useUi.getState().status);
const selection = () => page.evaluate(() => window.__hestia.useUi.getState().selection.slice());

const mk = () => {
  const checks = [];
  return {
    checks,
    check(name, ok, extra = '') {
      checks.push({ nome: name, ok: !!ok, extra: String(extra) });
      return !!ok;
    },
    done(observed, target) {
      return { ok: checks.every((c) => c.ok), observed, target, checks };
    },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------------------------------------------
/** a) O 2º clique cai no valor da cota dinâmica: a parede tem de sair (hoje o input engole o clique). */
async function cenarioCota(i = 0) {
  const t = mk();
  await reset({ tool: 'wall' });
  const v = await view();
  const p1 = pontoInicial(v, i);
  const p2 = { x: p1.x + 220, y: p1.y };
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.click(p1.x, p1.y);
  await page.mouse.move(p2.x, p2.y);
  await page.waitForTimeout(160);

  // Posição descoberta no DOM (aria-label "Cota: <slot>"), não coordenada fixa: entre as cotas na tela, a do traçado
  // é a que está mais perto do meio do vão (a caixa fica ~25 px acima dele).
  const meio = { x: (p1.x + p2.x) / 2, y: p1.y - 25 };
  const box = await page.evaluate((meio) => {
    const candidatos = [...document.querySelectorAll('.canvas-wrap input[aria-label^="Cota"]')]
      .map((el) => {
        const b = el.getBoundingClientRect();
        const x = b.x + b.width / 2;
        const y = b.y + b.height / 2;
        return { el, x, y, w: Math.round(b.width), h: Math.round(b.height), d: Math.hypot(x - meio.x, y - meio.y) };
      })
      .filter((c) => c.w > 0)
      .sort((a, b) => a.d - b.d);
    const c = candidatos[0];
    if (!c) return null;
    const hit = document.elementFromPoint(c.x, c.y);
    return {
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      dist: Math.round(c.d),
      aria: c.el.getAttribute('aria-label'),
      pe: getComputedStyle(c.el).pointerEvents,
      efp: hit ? `${hit.tagName}${hit.getAttribute?.('aria-label') ? `[${hit.getAttribute('aria-label')}]` : ''}` : '(nada)',
    };
  }, meio);
  t.check('cota dinâmica presente no DOM', !!box, box ? `${box.aria} ${box.w}x${box.h} a ${box.dist} px do meio` : 'não encontrada');
  if (!box) return t.done('sem cota na tela', '—');

  const antes = await walls();
  await page.mouse.move(box.x, box.y);
  await page.waitForTimeout(60);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(160);
  const depois = await walls();
  const p = await probe();
  t.check('2º clique entregue à ferramenta', p.clicks >= 2, `clicks=${p.clicks}`);
  t.check('parede criada', depois - antes === 1, `paredes=${depois - antes}`);
  const r = t.done(`paredes=${depois - antes}, clicks=${p.clicks}`, `${box.efp} (pointer-events=${box.pe})`);
  r.probe = p;
  return r;
}

/** b) Jitter de 4 px entre down e up: hoje vira "arrasto" e o clique some. */
async function cenarioJitter(i = 0) {
  const t = mk();
  await reset({ tool: 'wall' });
  const v = await view();
  const p1 = pontoInicial(v, i);
  const p2 = { x: p1.x + 220, y: p1.y };
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p1.x + 4, p1.y, { steps: 1 });
  await page.mouse.up();
  const depoisDoJitter = await probe();
  await page.mouse.move(p2.x, p2.y);
  await page.mouse.click(p2.x, p2.y);
  await page.waitForTimeout(160);
  const w = await walls();
  t.check('clique com jitter de 4 px entregue', depoisDoJitter.clicks === 1, `clicks=${depoisDoJitter.clicks}`);
  t.check('parede criada com os 2 cliques', w === 1, `paredes=${w}`);
  const r = t.done(`paredes=${w}`, depoisDoJitter.alvoDown);
  r.probe = depoisDoJitter;
  return r;
}

/** c) `newProject` + down/up no mesmo tick, antes de o viewport existir. */
async function cenarioViewportNulo(i = 0) {
  const t = mk();
  await reset({ tool: 'select' });
  const v = await view();
  const p1 = pontoInicial(v, i);
  const p2 = { x: p1.x + 220, y: p1.y };

  const mesmoTick = await page.evaluate(
    async ({ x, y }) => {
      const { editor } = window.__hestia;
      const el = document.querySelector('.canvas-wrap');
      window.__cliquesLimpar();
      editor.newProject('blank');
      editor.setTool('wall');
      const vpAntes = !!editor.viewport();
      const ev = (tipo, buttons) =>
        new PointerEvent(tipo, {
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true,
        });
      // O pointerId sintético não está "ativo": o capture do canvas lançaria e o gesto nunca seria armado.
      const capture = Element.prototype.setPointerCapture;
      const release = Element.prototype.releasePointerCapture;
      Element.prototype.setPointerCapture = () => {};
      Element.prototype.releasePointerCapture = () => {};
      let erro = null;
      let vpNoDown = null;
      try {
        el.dispatchEvent(ev('pointerdown', 1));
        vpNoDown = !!editor.viewport(); // estado no instante do down, antes do quadro que cria a vista
        el.dispatchEvent(ev('pointerup', 0));
      } catch (e) {
        erro = String(e);
      } finally {
        Element.prototype.setPointerCapture = capture;
        Element.prototype.releasePointerCapture = release;
      }
      // O down adiado só é entregue quando a vista existir, no quadro seguinte: mede depois de dois quadros.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { vpAntes, vpNoDown, clicks: window.__cliques.clicks.length, erro };
    },
    p1,
  );

  // Controle: depois do quadro, um clique real no 2º ponto fecha a parede.
  await frames();
  await page.mouse.move(p2.x, p2.y);
  await page.mouse.click(p2.x, p2.y);
  await page.waitForTimeout(160);
  const w = await walls();

  t.check('janela de viewport nulo reproduzida (viewport nulo no down)', mesmoTick.vpNoDown === false, `vpAntes=${mesmoTick.vpAntes}, vpNoDown=${mesmoTick.vpNoDown}`);
  t.check('down/up no mesmo tick entregou o clique', mesmoTick.clicks >= 1, `clicks=${mesmoTick.clicks}${mesmoTick.erro ? `, erro=${mesmoTick.erro}` : ''}`);
  t.check('parede concluída pelo 2º clique', w === 1, `paredes=${w}`);
  return t.done(`paredes=${w}, clicks=${mesmoTick.clicks}`, `canvas-wrap (vp=${mesmoTick.vpNoDown ? 'pronto' : 'nulo'})`);
}

/** Campos de uma parede como o `makeWall` do modelo (o comando `addWall` grava o objeto como veio). */
const PAREDE = {
  kind: 'wall',
  typeId: 'wt_alv14',
  levelId: 'lv_0',
  baseOffset: 0,
  topLevelId: null,
  height: 2.8,
  topOffset: 0,
  attachBottomToFloor: false,
  attachTopToFloor: false,
  attachTopToRoof: false,
  locationLine: 'wallCenter',
  flipped: false,
  noJoinStart: false,
  noJoinEnd: false,
  joinStart: { kind: 'butt', flip: false },
  joinEnd: { kind: 'butt', flip: false },
  sag: 0,
  topProfile: null,
  mark: '',
  comments: '',
};

/** Monta um ambiente "Sala" fechado, com rótulo no centro. */
async function montarSala() {
  await page.evaluate((base) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    const wall = (id, a, b) => editor.store.exec({ type: 'addWall', wall: { ...base, id, a, b } });
    wall('w1', { x: 0, y: 1 }, { x: 0, y: 5 });
    wall('w2', { x: 0, y: 5 }, { x: 6, y: 5 });
    wall('w3', { x: 6, y: 5 }, { x: 6, y: 1 });
    wall('w4', { x: 6, y: 1 }, { x: 0, y: 1 });
    editor.store.exec({
      type: 'addRoom',
      room: { kind: 'room', id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 3, y: 3 }, labelPosition: { x: 3, y: 3 }, heightOffset: 0, floorFinish: '', wallFinish: '', ceilingFinish: '' },
    });
    editor.setTool('select');
  }, PAREDE);
  await frames();
  await page.waitForTimeout(260);
  await neutralCursor();
}

/** d) `suppressNextClick` vazando: arrastar o rótulo e trocar de ferramenta não pode engolir o clique seguinte. */
async function cenarioSuppress() {
  const t = mk();
  await montarSala();

  /** Rótulo descoberto no DOM (a etiqueta do ambiente é um `.plan-note`). */
  const acharRotulo = () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('.canvas-wrap .plan-note')].find((s) => (s.textContent ?? '').trim().startsWith('Sala'));
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, texto: (el.textContent ?? '').trim() };
    });

  /** Down no rótulo + 10 px + up, SEM click: é o gesto que arma `suppressNextClick` (10 px passa do limiar de 6 px). */
  const arrastarRotulo = async () => {
    const rotulo = await acharRotulo();
    if (!rotulo) return null;
    await page.mouse.move(rotulo.x, rotulo.y);
    await page.mouse.down();
    const statusDown = await status();
    await page.mouse.move(rotulo.x + 10, rotulo.y, { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const depois = await acharRotulo();
    return { rotulo, statusDown, xDepois: depois ? Math.round(depois.x) : null };
  };

  const gesto = await arrastarRotulo();
  t.check('rótulo do ambiente na tela', !!gesto, gesto?.rotulo.texto ?? 'não encontrado');
  if (!gesto) return t.done('sem rótulo', '—');
  t.check('down no rótulo armou o arraste (pré-condição)', gesto.statusDown.includes('Arraste o rótulo'), gesto.statusDown.slice(0, 40));
  t.check(
    'rótulo reposicionado pelo arraste (pré-condição)',
    gesto.xDepois !== null && Math.abs(gesto.xDepois - Math.round(gesto.rotulo.x)) >= 2,
    `x ${Math.round(gesto.rotulo.x)} -> ${gesto.xDepois}`,
  );

  // (1) o caso do relato: troca de ferramenta e clique numa parede tem de selecionar.
  await page.evaluate(() => {
    window.__hestia.editor.setTool('wall');
    window.__hestia.editor.setTool('select');
    window.__cliquesLimpar();
  });
  // Resíduo do arraste: o sinalizador de "engolir o próximo clique" não pode ficar armado depois do gesto.
  const residual = await page.evaluate(() => {
    const v = window.__hestia.editor.suppressNextClick;
    return typeof v === 'boolean' ? v : null; // null = mecanismo removido (também é solução)
  });
  t.check('nenhum sinalizador residual armado após o arraste', residual !== true, residual === null ? 'mecanismo ausente' : `suppressNextClick=${residual}`);
  const v = await view();
  const naParede = toPage(v, 3, 1); // meio da parede de baixo
  await page.mouse.move(naParede.x, naParede.y);
  await page.waitForTimeout(40);
  await page.mouse.click(naParede.x, naParede.y);
  await page.waitForTimeout(160);
  const sel = await selection();
  const depoisDoClique = await probe();
  t.check('clique na parede entregue à ferramenta', depoisDoClique.clicks === 1, `clicks=${depoisDoClique.clicks}`);
  t.check('parede selecionada depois do arraste de rótulo', sel.length === 1 && sel[0] === 'w4', `seleção=[${sel.join(',')}]`);

  // (2) testemunha do vazamento com ferramenta de dois cliques: o 1º clique não pode sumir. Projeto limpo de novo
  // (com a parede selecionada, a cota da seleção cobre o rótulo e o arraste não começaria).
  await montarSala();
  const paredesAntes = await walls();
  const gesto2 = await arrastarRotulo();
  t.check('2º arraste de rótulo executado (pré-condição)', !!gesto2 && gesto2.statusDown.includes('Arraste o rótulo'), gesto2 ? gesto2.statusDown.slice(0, 40) : 'sem rótulo');
  await page.evaluate(() => {
    window.__hestia.editor.setTool('wall');
    window.__cliquesLimpar();
  });
  const v2 = await view();
  const q1 = offsetPx(v2, 250, -150); // área livre, à direita do ambiente
  const q2 = { x: q1.x + 220, y: q1.y };
  await page.mouse.move(q1.x, q1.y);
  await page.mouse.click(q1.x, q1.y);
  await page.mouse.click(q2.x, q2.y);
  await page.waitForTimeout(160);
  const paredesDepois = await walls();
  t.check('1º clique da parede seguinte não foi engolido', paredesDepois - paredesAntes === 1, `paredes novas=${paredesDepois - paredesAntes}`);

  return t.done(
    `seleção=[${sel.join(',')}], paredes novas=${paredesDepois - paredesAntes}, suppress residual=${residual === null ? 'ausente' : residual}`,
    `${depoisDoClique.alvoDown} > ${depoisDoClique.efpDown}`,
  );
}

/** e) `OpeningFlipGrips`: botão do meio sobre a alça não pode ser engolido (pan) nem inverter a porta. */
async function cenarioGrips() {
  const t = mk();
  await page.evaluate((base) => {
    const { editor, useUi } = window.__hestia;
    editor.newProject('blank');
    editor.store.exec({ type: 'addWall', wall: { ...base, id: 'w1', a: { x: 0, y: 2 }, b: { x: 6, y: 2 } } });
    editor.store.exec({
      type: 'addOpening',
      opening: { id: 'o1', kind: 'door', typeId: 'ot_p90', hostId: 'w1', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
    });
    editor.setTool('grid'); // ferramenta de desenho: a alça continua na tela
    useUi.setState({ selection: ['o1'] });
  }, PAREDE);
  await frames();
  await page.waitForTimeout(260);
  await neutralCursor();

  const alca = await page.evaluate(() => {
    const b = document.querySelector('.canvas-wrap button[aria-label="Inverter sentido"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, efp: hit ? `${hit.tagName}${hit.getAttribute?.('aria-label') ? `[${hit.getAttribute('aria-label')}]` : ''}` : '(nada)' };
  });
  t.check('alça "Inverter sentido" na tela', !!alca, alca?.efp ?? 'não encontrada');
  if (!alca) return t.done('sem alça', '—');

  const estado = () =>
    page.evaluate(() => {
      const vp = window.__hestia.editor.viewport();
      const abertura = window.__hestia.editor.project.elements.o1;
      return { cx: vp.cx, cy: vp.cy, zoom: vp.zoom, abertura: JSON.stringify(abertura), selecao: window.__hestia.useUi.getState().selection.slice() };
    });
  const antes = await estado();
  await page.mouse.move(alca.x, alca.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(alca.x + 40, alca.y + 25, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(140);
  const depois = await estado();

  const panPx = Math.hypot((depois.cx - antes.cx) * depois.zoom, (depois.cy - antes.cy) * depois.zoom);
  t.check('botão do meio sobre a alça inicia o pan', panPx > 20, `pan=${panPx.toFixed(1)} px`);
  t.check('porta não foi invertida', depois.abertura === antes.abertura, depois.abertura === antes.abertura ? 'intacta' : 'flipHand/flipFacing mudou');
  t.check('seleção preservada', depois.selecao.join() === antes.selecao.join(), `[${depois.selecao.join(',')}]`);
  return t.done(`pan=${panPx.toFixed(1)} px, porta ${depois.abertura === antes.abertura ? 'intacta' : 'alterada'}`, alca.efp);
}

/** f) Sanidade: atalho e ribbon continuam criando parede com 2 cliques. */
async function cenarioSanidade() {
  const t = mk();
  const doisCliques = async () => {
    const v = await view();
    const p1 = offsetPx(v, -300, -120);
    const p2 = { x: p1.x + 220, y: p1.y };
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.click(p1.x, p1.y);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(140);
    return walls();
  };

  await reset({ tool: 'select' });
  await pressTool(page, 'w');
  await page.waitForTimeout(80);
  const porAtalho = await doisCliques();
  t.check('atalho w+a: 2 cliques = 1 parede', porAtalho === 1, `paredes=${porAtalho}`);

  await reset({ tool: 'select' });
  await page.locator('button[aria-label="Parede"]:visible').first().click();
  await page.waitForTimeout(80);
  const porRibbon = await doisCliques();
  t.check('botão Parede da ribbon: 2 cliques = 1 parede', porRibbon === 1, `paredes=${porRibbon}`);

  return t.done(`atalho=${porAtalho}, ribbon=${porRibbon}`, 'canvas (após atalho e após ribbon)');
}

const CENARIOS = [
  { id: 'a', titulo: '2º clique sobre o valor da cota dinâmica', esperado: '1 parede', fn: cenarioCota },
  { id: 'b', titulo: 'jitter de 4 px entre down e up', esperado: '1 parede (clique entregue)', fn: cenarioJitter },
  { id: 'c', titulo: 'newProject + down/up no mesmo tick (viewport nulo)', esperado: '1 parede (clique entregue)', fn: cenarioViewportNulo },
  { id: 'd', titulo: 'suppressNextClick após arrastar o rótulo do ambiente', esperado: 'parede selecionada', fn: cenarioSuppress },
  { id: 'e', titulo: 'OpeningFlipGrips com botão do meio (ferramenta Grade)', esperado: 'pan ativo e porta intacta', fn: cenarioGrips },
  { id: 'f', titulo: 'sanidade do atalho w e do botão Parede', esperado: '2 cliques = 1 parede em ambos', fn: cenarioSanidade },
];

// ---------------------------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------------------------
const t0 = Date.now();
const rows = [];
for (const c of CENARIOS) {
  if (ONLY && !ONLY.includes(c.id)) continue;
  const execucoes = [];
  for (let i = 0; i < N; i++) {
    let r;
    const t = Date.now();
    try {
      r = await c.fn(i);
    } catch (e) {
      r = { ok: false, observed: `exceção: ${e.message.split('\n')[0]}`, target: '—', checks: [] };
    }
    execucoes.push({ ...r, ms: Date.now() - t });
    const falhas = r.checks.filter((k) => !k.ok);
    console.log(
      `${r.ok ? 'OK  ' : 'FAIL'} [${c.id}] ${c.titulo} — ${r.observed}${falhas.length ? ` | ${falhas.map((f) => `${f.nome}${f.extra ? ` (${f.extra})` : ''}`).join('; ')}` : ''}`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${c.id}-${i + 1}.png` });
  }
  const passou = execucoes.filter((r) => r.ok).length;
  rows.push({
    id: c.id,
    cenario: c.titulo,
    esperado: c.esperado,
    observado: execucoes[0]?.observed ?? '',
    alvo: execucoes[0]?.target ?? '',
    status: passou === N ? 'PASS' : 'FAIL',
    passou,
    repeticoes: N,
    falhas: execucoes.filter((r) => !r.ok).flatMap((r) => r.checks.filter((k) => !k.ok).map((k) => `${c.id}: ${k.nome}${k.extra ? ` (${k.extra})` : ''}`)),
    execucoes,
  });
}

const ms = Date.now() - t0;
const falhas = rows.filter((r) => r.status === 'FAIL');

console.log('\n== TABELA (build atual)');
console.log('cenário | esperado | observado | alvo do evento | status');
for (const r of rows) {
  console.log(`${r.id}. ${r.cenario} | ${r.esperado} | ${r.observado} | ${r.alvo} | ${r.status} (${r.passou}/${r.repeticoes})`);
}
console.log(`\n${falhas.length ? `${falhas.length} cenário(s) FALHANDO: ${falhas.map((f) => f.id).join(', ')}` : 'todos os cenários passaram'} (${ms} ms, n=${N})`);
if (errors.length) console.log(`avisos do console (${errors.length}): ${errors.slice(0, 3).join(' / ')}`);

const resultado = {
  gerado: new Date().toISOString(),
  build: DIST,
  buildMtime: statSync(DIST).mtime.toISOString(),
  chrome: chromeExecutable(),
  viewport: { width: 1440, height: 860 },
  n: N,
  only: ONLY,
  duracaoMs: ms,
  falhas: falhas.map((f) => f.id),
  errosConsole: errors,
  cenarios: rows,
};
mkdirSync(path.dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(resultado, null, 1)}\n`, 'utf8');
console.log(`json: ${OUT_JSON}`);

// O `browser.close()` com SwiftShader leva ~20 s (teardown do GPU) e não faz parte do teste: dispara e sai. Ao fim do
// processo Node o pipe do Chrome fecha e ele encerra sozinho (conferido: nenhum processo sobra).
browser.close().catch(() => {});
process.exit(falhas.length ? 1 : 0);
