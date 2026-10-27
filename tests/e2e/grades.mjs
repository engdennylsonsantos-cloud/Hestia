// Grades de eixos no app real: desenho na planta (bolhas e traço-ponto), criação pela ferramenta Grade, nome automático,
// seleção, exclusão e desfazer. Capturas em SHOTS (padrão test-results/shots).
import { mkdirSync } from 'node:fs';
import { clickWorld, launch, openApp } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?gl=1&debug=1' });
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const grids = () => page.evaluate(() => (window.__hestia.editor.project.grids ?? []).map((g) => ({ id: g.id, name: g.name, n: g.points.length })));
const grade = (id, name, pts, over = {}) => ({ type: 'addGrid', grid: { id, name, typeId: 'gt_6mm', points: pts, sag: 0, bubbleStart: false, bubbleEnd: true, ...over } });

await page.evaluate(() => window.__hestia.editor.newProject('house2'));
await page.waitForTimeout(500);
await page.evaluate((cmds) => { for (const c of cmds) window.__hestia.editor.store.exec(c); }, [
  grade('gA', 'A', [{ x: -3, y: 0 }, { x: 11, y: 0 }], { bubbleStart: true, bubbleEnd: false }),
  grade('gB', 'B', [{ x: -3, y: 6 }, { x: 11, y: 6 }], { bubbleStart: true, bubbleEnd: false }),
]);
await page.evaluate(() => window.__hestia.useUi.setState({ view: 'plan', levelId: 'lv_0', selection: [] }));
await page.waitForTimeout(600);
check((await grids()).length === 2, 'duas grades por comando');
await page.screenshot({ path: `${OUT}/grades-1-comandos.png` });

// Ferramenta Grade: dois cliques; o nome segue o padrão (C depois de A e B).
await page.evaluate(() => window.__hestia.editor.setTool('grid'));
await clickWorld(page, 0, 3);
await clickWorld(page, 8, 3);
await page.waitForTimeout(300);
let g = await grids();
check(g.length === 3 && g[2].name === 'C', `a ferramenta cria a grade seguinte (${g.map((x) => x.name).join(',')})`);

// Selecionar, apagar e desfazer.
await page.evaluate(() => window.__hestia.editor.setTool('select'));
await page.evaluate(() => window.__hestia.useUi.setState({ selection: ['gA'] }));
await page.keyboard.press('Delete');
await page.waitForTimeout(300);
check((await grids()).every((x) => x.id !== 'gA'), 'Delete exclui a grade selecionada');
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
check((await grids()).some((x) => x.id === 'gA'), 'Ctrl+Z devolve a grade');

// Grade de pontos: o botão liga o desenho e a captura juntos.
await page.evaluate(() => window.__hestia.useUi.setState({ selection: [] }));
const antes = await page.evaluate(() => ({ show: window.__hestia.useUi.getState().showGrid, snap: !!window.__hestia.useUi.getState().options.snap?.grid }));
check(antes.show === antes.snap, `desenho e captura da grade de pontos estão no mesmo estado (${antes.show})`);
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
