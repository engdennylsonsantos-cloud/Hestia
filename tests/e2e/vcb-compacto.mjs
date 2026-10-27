// Barra de controle da vista recolhível: com as duas docas abertas (uma de cada lado), em 1280, 1100 e 700 px, na planta e
// no 3D (que tem mais alternadores), confere que nenhum botão, lista ou rótulo da `.vcb` fica cortado nem a barra rola; que o que não cabe
// aparece no popup "»" com a união barra + popup igual a todos os controles; que os itens do popup acionam (nível de
// detalhe e estilo gravam na vista; Sombras alterna no 3D); e que Escape devolve o foco e clique fora fecha. Salva capturas
// em tests/e2e/out/ (tema claro e escuro). Não grava baselines.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, openApp, makeReporter } from './helpers.mjs';

const OUT = path.resolve('tests/e2e/out');
mkdirSync(OUT, { recursive: true });
const MORE = '.fit-more[aria-label="Mais controles da vista"]';
const POP = '.fit-pop.vcb-pop';
const SOON = ['Caminho do sol', 'Cortar vista', 'Mostrar região de corte', 'Ocultar/isolar temporário', 'Revelar elementos ocultos', 'Propriedades temporárias da vista'];
const PLAN_ALL = ['Escala', 'Nível de detalhe', 'Estilo visual', ...SOON].sort();
const VIEW3D_ALL = ['Estilo visual', 'Sombras', 'Arestas', 'Abrir vãos', ...SOON].sort();
const TOGGLE_KEY = { 'Sombras': 'shadows', 'Arestas': 'edges', 'Abrir vãos': 'openOpenings' };
const CASES = [
  { W: 1280, view: 'plan' },
  { W: 1280, view: '3d' },
  { W: 1100, view: '3d' },
  { W: 700, view: 'plan' },
  { W: 700, view: '3d' },
];

/** Medidas da barra: cada botão, lista ou rótulo visível dentro da caixa, e rolagem da própria `.vcb`. Roda na página. */
const measure = () => {
  const vcb = document.querySelector('.vcb');
  const c = vcb.getBoundingClientRect();
  const bad = [];
  for (const el of vcb.querySelectorAll('button, select, label')) {
    if (el.closest('.fit-measure')) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (b.right > c.right + 1 || b.left < c.left - 1 || b.bottom > c.bottom + 1 || b.top < c.top - 1) {
      bad.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30));
    }
  }
  return { sw: vcb.scrollWidth, cw: vcb.clientWidth, bad, more: !!document.querySelector('.fit-more[aria-label="Mais controles da vista"]') };
};

/** Nomes dos controles de uma raiz (barra ou popup), sem contar a medição. Roda na página: só usa `document`. */
const namesAt = (sel) => {
  const root = document.querySelector(sel);
  const out = [];
  for (const el of root.querySelectorAll('.vcb-field, .vcb-btn')) {
    if (el.closest('.fit-measure')) continue;
    out.push(el.querySelector('select')?.getAttribute('aria-label') || el.getAttribute('aria-label') || el.querySelector('span')?.textContent.trim() || el.textContent.trim());
  }
  return out.sort();
};

/** Espera a barra estabilizar (o 3D ocupa a thread principal e a medição chega um pouco depois da janela mudar). */
async function settle(page) {
  let prev = '';
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(250);
    const cur = await page.evaluate(() => {
      const v = document.querySelector('.vcb');
      return v ? `${v.clientWidth}|${v.children.length}|${!!document.querySelector('.fit-more[aria-label="Mais controles da vista"]')}` : '';
    });
    if (cur === prev) return;
    prev = cur;
  }
}

/** Abre as duas docas, uma de cada lado. */
async function twoDocks(page) {
  await page.evaluate(() => {
    const { useUi } = window.__hestia;
    useUi.setState({ propsOpen: true, browserOpen: true, dock: { ...useUi.getState().dock, sides: { props: 'left', browser: 'right' } } });
  });
}

async function openMore(page) {
  await page.click(MORE);
  await page.waitForTimeout(150);
}

async function closePop(page) {
  if (await page.$(POP)) await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

/** Lê barra e popup: o popup abre e fecha só para a leitura. */
async function readNames(page) {
  const bar = await page.evaluate(namesAt, '.vcb');
  let pop = [];
  if (await page.$(MORE)) {
    await openMore(page);
    pop = await page.evaluate(namesAt, POP);
    await closePop(page);
  }
  return { bar, pop };
}

/** Procura a primeira largura em que `pick` (função da página, recebe o seletor do popup) acha o item no popup. Deixa o popup aberto. */
async function widthWithPop(page, widths, pick) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 860 });
    await settle(page);
    if (!(await page.$(MORE))) continue;
    await openMore(page);
    if (await page.evaluate(pick, POP)) return w;
    await closePop(page);
  }
  return null;
}

/** Valor atual de uma lista do popup e a primeira opção diferente dele. */
async function nextOption(page, label) {
  return page.evaluate(([sel, lb]) => {
    const s = document.querySelector(`${sel} select[aria-label="${lb}"]`);
    const cur = s.value;
    return { cur, next: [...s.options].map((o) => o.value).find((v) => v && v !== cur) };
  }, [POP, label]);
}

const browser = await launch();
const rep = makeReporter();

for (const { W, view } of CASES) {
  const label = `janela ${W}px, ${view === '3d' ? '3D' : 'planta'}, duas docas abertas`;
  await rep.step(`${label}: nada cortado e o que não cabe está no popup`, async () => {
    const { page, errors } = await openApp(browser, { width: W, height: 860 });
    await page.evaluate((v) => {
      const { editor, useUi } = window.__hestia;
      editor.newProject('house-premium');
      editor.zoomExtents();
      editor.setView(v);
    }, view === '3d' ? '3d' : 'plan');
    await twoDocks(page);
    await settle(page);

    const m = await page.evaluate(measure);
    rep.check('barra sem rolagem', m.sw <= m.cw, `${m.sw}/${m.cw}`);
    rep.check('nenhum controle cortado', m.bad.length === 0, m.bad.slice(0, 4).join(' | '));

    const { bar, pop } = await readNames(page);
    const all = [...bar, ...pop].sort();
    const expected = view === '3d' ? VIEW3D_ALL : PLAN_ALL;
    rep.check('recolhidos no "»" (barra + popup = todos, sem repetir)', JSON.stringify(all) === JSON.stringify(expected), `barra ${bar.length}, popup ${pop.length}; faltam/sobram: ${expected.filter((x) => !all.includes(x)).concat(all.filter((x) => !expected.includes(x))).join(', ') || 'nenhum'}`);
    const firstOut = view === '3d' ? ['Estilo visual', 'Sombras', 'Arestas', 'Abrir vãos'] : ['Escala', 'Nível de detalhe', 'Estilo visual'];
    rep.check('recolhe os menos usados primeiro (os de uso frequente ficam; os "em breve" saem antes)', !bar.some((x) => SOON.includes(x)) || firstOut.every((x) => bar.includes(x)), `barra: ${bar.join(', ')}`);
    rep.check('"»" aparece só quando algo sai', m.more === (pop.length > 0), `popup ${pop.length}`);

    if (W === 1100 && view === '3d') {
      await openMore(page);
      const top = await page.evaluate(() => Math.max(0, document.querySelector('.vcb').getBoundingClientRect().top - 240));
      await page.screenshot({ path: path.join(OUT, 'vcb-compacto-1100-3d-claro.png'), clip: { x: 0, y: top, width: W, height: 860 - top } });
      await closePop(page);
      await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'dark' }));
      await page.waitForTimeout(300);
      await openMore(page);
      await page.screenshot({ path: path.join(OUT, 'vcb-compacto-1100-3d-escuro.png'), clip: { x: 0, y: top, width: W, height: 860 - top } });
      await closePop(page);
      await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'light' }));
    }

    rep.check('sem erro de página', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  });
}

await rep.step('nível de detalhe e estilo pelo popup gravam na vista', async () => {
  const { page, errors } = await openApp(browser, { width: 1280, height: 860 });
  await page.evaluate(() => { window.__hestia.editor.newProject('house-premium'); window.__hestia.editor.zoomExtents(); window.__hestia.useUi.setState({ propsOpen: true, browserOpen: true }); });
  await page.waitForTimeout(400);

  const wd = await widthWithPop(page, [1280, 700, 400, 300, 240, 200, 160], (sel) => !!document.querySelector(`${sel} select[aria-label="Nível de detalhe"]`));
  rep.check('janela com "Nível de detalhe" no popup', wd !== null, wd ? `usada ${wd}px` : 'nenhuma largura testada');
  if (wd !== null) {
    const { cur, next } = await nextOption(page, 'Nível de detalhe');
    await page.selectOption(`${POP} select[aria-label="Nível de detalhe"]`, next);
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => window.__hestia.editor.store.project.levels.find((l) => l.id === window.__hestia.useUi.getState().levelId)?.graphics?.detail);
    rep.check(`detalhe ${cur} -> ${next} pelo popup grava na vista`, now === next, `estado: ${now}`);
  }

  await closePop(page);
  const ws = await widthWithPop(page, [400, 300, 240, 200, 160], (sel) => !!document.querySelector(`${sel} select[aria-label="Estilo visual"]`));
  rep.check('janela com "Estilo visual" no popup', ws !== null, ws ? `usada ${ws}px` : 'nenhuma largura testada');
  if (ws !== null) {
    const { cur, next } = await nextOption(page, 'Estilo visual');
    await page.selectOption(`${POP} select[aria-label="Estilo visual"]`, next);
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => window.__hestia.editor.store.project.levels.find((l) => l.id === window.__hestia.useUi.getState().levelId)?.graphics?.style);
    rep.check(`estilo ${cur} -> ${next} pelo popup grava na vista`, now === next, `estado: ${now}`);
  }
  rep.check('sem erro de página', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
});

await rep.step('3D: alternador recolhido (Arestas, Abrir vãos) no popup alterna o 3D; foco e Escape; clique fora fecha', async () => {
  const { page, errors } = await openApp(browser, { width: 700, height: 860 });
  await page.evaluate(() => { window.__hestia.editor.newProject('house-premium'); window.__hestia.editor.zoomExtents(); window.__hestia.editor.setView('3d'); });
  await twoDocks(page);
  await page.waitForTimeout(600);

  const TOG = ['Sombras', 'Arestas', 'Abrir vãos'];
  const w = await widthWithPop(page, [1100, 900, 700, 600, 520, 480, 440, 400, 360, 320, 300, 260, 220, 200], (sel) => [...document.querySelectorAll(`${sel} button`)].some((b) => ['Arestas', 'Abrir vãos', 'Sombras'].includes(b.textContent.trim())));
  rep.check('3D: algum alternador no popup', w !== null, w ? `usada ${w}px` : 'nenhuma largura testada');
  if (w !== null) {
    const pick = await page.evaluate(([sel, names]) => {
      const b = [...document.querySelectorAll(`${sel} button`)].find((x) => names.includes(x.textContent.trim()));
      return { name: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') === 'true' };
    }, [POP, TOG]);
    await page.click(`${POP} button:has-text("${pick.name}")`);
    await page.waitForTimeout(250);
    const now = await page.evaluate((key) => window.__hestia.editor.store.project.view3d?.[key], TOGGLE_KEY[pick.name]);
    rep.check(`"${pick.name}" pelo popup alterna o 3D`, now === !pick.pressed, `antes ${pick.pressed}, estado ${now}`);
  }

  // Foco e teclado: o popup abre com foco dentro dele; Escape fecha e devolve o foco ao "»"; clique fora fecha.
  await openMore(page);
  const inside = await page.evaluate((sel) => !!document.activeElement?.closest(sel), POP);
  rep.check('abrir o popup põe o foco dentro dele', inside);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const back = await page.evaluate((sel) => document.activeElement?.matches(sel) && !document.querySelector('.fit-pop'), MORE);
  rep.check('Escape fecha e devolve o foco ao "»"', back);
  await openMore(page);
  const at = await page.evaluate(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x + 20, y: r.y + 20 }; });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(150);
  rep.check('clique fora fecha o popup', !(await page.$(POP)));
  rep.check('sem erro de página', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
});

await browser.close();
rep.summary();
const failed = rep.steps.filter((s) => s.status === 'FAIL');
console.log(`\n${rep.steps.length - failed.length}/${rep.steps.length} passos ok`);
process.exit(failed.length ? 1 : 0);
