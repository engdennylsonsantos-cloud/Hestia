// Faixa compacta (padrão Revit): em 1024, 1280, 1366 e 1920 px, percorre todas as abas principais e algumas contextuais e
// confere que a faixa, as abas e a barra de controle da vista não rolam (scrollWidth <= clientWidth) e que nenhum botão
// fica cortado. Salva capturas em tests/e2e/out/ (tema claro e escuro). Não grava baselines.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, openApp, makeReporter } from './helpers.mjs';

const OUT = path.resolve('tests/e2e/out');
mkdirSync(OUT, { recursive: true });
const WIDTHS = [1024, 1280, 1366, 1920];
const TABS = ['Arquitetura', 'Estrutura', 'Aço', 'Pré-moldado', 'Sistemas', 'Inserir', 'Anotar', 'Analisar', 'Massa e terreno', 'Colaborar', 'Vista', 'Gerenciar', 'Suplementos', 'Modificar'];

/** Medidas da página: rolagem e botões cortados dentro de cada contêiner (botões do popup e da medição não contam). */
const measure = () => {
  const boxOf = (el) => el.getBoundingClientRect();
  const cutIn = (container, sel) => {
    const c = boxOf(container);
    const bad = [];
    for (const el of container.querySelectorAll(sel)) {
      // Pula a medição, o popup e a galeria do modo de perímetro: a galeria rola por dentro (▴ ▾), de propósito.
      if (el.closest('.fit-measure') || el.closest('.fit-pop') || el.closest('.pm-gal')) continue;
      const b = boxOf(el);
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > c.right + 1 || b.left < c.left - 1 || b.bottom > c.bottom + 1 || b.top < c.top - 1) {
        bad.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30));
      }
    }
    return bad;
  };
  const out = {};
  const ribbon = document.querySelector('.ribbon');
  const tabs = document.querySelector('.ribbon-tabs');
  const vcb = document.querySelector('.vcb');
  for (const [name, el, sel] of [['ribbon', ribbon, 'button'], ['tabs', tabs, 'button'], ['vcb', vcb, 'button, select, label']]) {
    if (!el) { out[name] = null; continue; }
    out[name] = { sw: el.scrollWidth, cw: el.clientWidth, cut: cutIn(el, sel) };
  }
  out.moreTabs = !!document.querySelector('.fit-more[aria-label="Mais abas"]');
  out.morePanels = !!document.querySelector('.fit-more[aria-label="Mais painéis"]');
  return out;
};

const pageHasTab = (page, name) => page.evaluate((n) => {
  const b = [...document.querySelectorAll('.ribbon-tabs .rtab')].find((x) => x.textContent.trim() === n && !x.classList.contains('file'));
  if (b) b.click();
  return !!b;
}, name);

/** Fecha o popup do "mais" (Escape, que o próprio popup trata) se estiver aberto. */
async function closePop(page) {
  if (await page.$('.fit-pop')) await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

/** Clica num botão da faixa pelo início do rótulo; se o painel foi recolhido, abre o botão "mais" antes. */
async function clickRibbon(page, prefix) {
  const find = (scope) => page.evaluate(([sc, pre]) => {
    const b = [...document.querySelectorAll(`${sc} button`)].find((x) => (x.getAttribute('aria-label') || '').startsWith(pre) && !x.disabled);
    if (b) b.click();
    return !!b;
  }, [scope, prefix]);
  if (await find('.ribbon')) return true;
  await page.click('.fit-more[aria-label="Mais painéis"]');
  return find('.fit-pop');
}

/** Abre a aba: direto na faixa, ou pelo "»" quando recolhida. */
async function goTab(page, name) {
  if (await pageHasTab(page, name)) return true;
  await page.click('.fit-more[aria-label="Mais abas"]');
  const ok = await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.fit-pop .fit-tab')].find((x) => x.textContent.trim() === n);
    if (b) b.click();
    return !!b;
  }, name);
  return ok;
}

const SCENARIOS = [
  { name: 'telhado', kind: 'roof' },
  { name: 'parede', kind: 'wall' },
  { name: 'porta', kind: 'door' },
  { name: 'janela', kind: 'window' },
];

const browser = await launch();
const rep = makeReporter();
for (const W of WIDTHS) {
  await rep.step(`largura ${W}px`, async () => {
    const { page, errors } = await openApp(browser, { width: W, height: 860 });
    await page.evaluate(() => {
      const { editor } = window.__hestia;
      // "Casa premium" tem telhado, paredes, portas, janelas, laje e escada (um telhado montado à mão dá NaN no 3D).
      editor.newProject('house-premium');
      editor.zoomExtents();
    });
    await page.waitForTimeout(400);

    const check = (label, m) => {
      const bad = [];
      for (const k of ['ribbon', 'tabs', 'vcb']) {
        const v = m[k];
        if (!v) continue;
        if (v.sw > v.cw) bad.push(`${k} rola ${v.sw}>${v.cw}`);
        if (v.cut.length) bad.push(`${k} corta: ${v.cut.slice(0, 4).join(' | ')}`);
      }
      rep.check(label, bad.length === 0, bad.join('; ') || `faixa ${m.ribbon?.sw}/${m.ribbon?.cw}, abas ${m.tabs?.sw}/${m.tabs?.cw}, vcb ${m.vcb ? `${m.vcb.sw}/${m.vcb.cw}` : '-'}`);
    };

    for (const tab of TABS) {
      const ok = await goTab(page, tab);
      await page.waitForTimeout(120);
      rep.check(`aba "${tab}" abre`, ok);
      await closePop(page);
      check(`aba "${tab}" sem rolagem e sem corte`, await page.evaluate(measure));
      if (tab === 'Arquitetura' || tab === 'Modificar') {
        await page.screenshot({ path: path.join(OUT, `ribbon-${W}-${tab.toLowerCase()}-claro.png`), clip: { x: 0, y: 0, width: W, height: 200 } });
      }
    }

    for (const sc of SCENARIOS) {
      const id = await page.evaluate((kind) => {
        const { useUi, editor } = { useUi: window.__hestia.useUi, editor: window.__hestia.editor };
        const e = Object.values(editor.store.project.elements).find((x) => x.kind === kind);
        if (e) useUi.setState({ selection: [e.id], tool: 'select' });
        return e?.id ?? null;
      }, sc.kind);
      await page.waitForTimeout(200);
      rep.check(`${sc.name} existe no projeto`, !!id);
      if (!id) continue;
      check(`contextual de ${sc.name} sem rolagem e sem corte`, await page.evaluate(measure));
      if (W === 1024 || W === 1920) {
        await page.screenshot({ path: path.join(OUT, `ribbon-${W}-ctx-${sc.name}-claro.png`), clip: { x: 0, y: 0, width: W, height: 200 } });
      }
    }

    // Modo de perímetro (aba "Modificar | Criar/Editar perímetro …"): a aba do modo também cabe.
    await page.evaluate(() => {
      const e = Object.values(window.__hestia.editor.store.project.elements).find((x) => x.kind === 'roof');
      if (e) window.__hestia.useUi.setState({ selection: [e.id], tool: 'select' });
    });
    await page.waitForTimeout(200);
    rep.check('botão "Editar perímetro" acionado', await clickRibbon(page, 'Editar perímetro'));
    await page.waitForTimeout(300);
    await closePop(page);
    check('aba do modo de perímetro sem rolagem e sem corte', await page.evaluate(measure));
    await page.screenshot({ path: path.join(OUT, `ribbon-${W}-perimetro-claro.png`), clip: { x: 0, y: 0, width: W, height: 200 } });
    await page.evaluate(() => document.querySelector('.ribbon button[aria-label="Cancelar"]')?.click());
    await page.waitForTimeout(300);

    await page.evaluate(() => { window.__hestia.useUi.setState({ selection: [], tool: 'wall' }); });
    await page.waitForTimeout(200);
    check('contextual "Colocar parede" sem rolagem e sem corte', await page.evaluate(measure));

    await page.evaluate(() => { window.__hestia.useUi.setState({ theme: 'dark' }); window.__hestia.editor.setTool('select'); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const e = Object.values(window.__hestia.editor.store.project.elements).find((x) => x.kind === 'roof');
      if (e) window.__hestia.useUi.setState({ selection: [e.id] });
    });
    await page.waitForTimeout(200);
    check('tema escuro, contextual de telhado sem rolagem e sem corte', await page.evaluate(measure));
    await page.screenshot({ path: path.join(OUT, `ribbon-${W}-ctx-telhado-escuro.png`), clip: { x: 0, y: 0, width: W, height: 200 } });

    // Vista 3D: a barra de controle da vista ganha alternadores (Sombras, Arestas, Abrir vãos) e precisa continuar cabendo.
    await page.evaluate(() => { window.__hestia.useUi.setState({ selection: [], tool: 'select' }); window.__hestia.editor.setView('3d'); });
    await page.waitForTimeout(900);
    check('vista 3D: faixa e barra de controle sem rolagem e sem corte', await page.evaluate(measure));
    await page.evaluate(() => window.__hestia.editor.setView('plan'));
    await page.waitForTimeout(300);

    rep.check('sem erro de página', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  });
}
await browser.close();
const failed = rep.steps.filter((s) => s.status === 'FAIL');
console.log(`\n${rep.steps.length - failed.length}/${rep.steps.length} passos ok`);
process.exit(failed.length ? 1 : 0);
