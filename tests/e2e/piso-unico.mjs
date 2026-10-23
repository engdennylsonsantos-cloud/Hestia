
// Piso único (obra inteira) no app real (decisão 0025, P10): cria a casa (paredes de 8 × 6 m e uma interna), o piso pelo
// perímetro externo com o tipo `ft_unico`, confere que o acabamento (até a face) tem área menor que a estrutura (passa),
// troca o acabamento para `nucleo` e confere o aumento da área. Sem erro de console. Código de saída 1 se algo falhou.
import { mkdirSync } from 'node:fs';
import { openApp, launch, makeReporter } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/shots';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);
/** Meia espessura do tipo de parede padrão (0,184 m): o perímetro externo fica a 0,092 m de cada linha de centro. */
const M = 0.092;
/** Área (m²) de cada camada do piso `lv_0`, pelo polígono resolvido (contorno menos furos e partes disjuntas somadas). */
const areasOf = () => page.evaluate(() => {
  const { editor, resolveFloors } = window.__hestia;
  const shoe = (r) => {
    let s = 0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  };
  const polyArea = (poly) => shoe(poly[0]) - poly.slice(1).reduce((t, h) => t + shoe(h), 0);
  const [f] = resolveFloors(editor.project, 'lv_0');
  return f ? f.layers.map((l) => l.polygon.reduce((t, poly) => t + polyArea(poly), 0)) : [];
});

await rep.step('criar a casa e o piso único pelo perímetro externo', async () => {
  await page.evaluate((M) => {
    const { editor } = window.__hestia;
    editor.newProject('blank');
    const wall = (id, a, b) => ({ id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a, b, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '' });
    const pontos = [[0, 0], [8, 0], [8, 6], [0, 6]];
    pontos.forEach(([x, y], i) => {
      const [x2, y2] = pontos[(i + 1) % 4];
      editor.store.exec({ type: 'addWall', wall: wall(`pe${i}`, { x, y }, { x: x2, y: y2 }) });
    });
    editor.store.exec({ type: 'addWall', wall: wall('pi', { x: 4, y: 0 }, { x: 4, y: 6 }) });
    const fora = [[-M, -M], [8 + M, -M], [8 + M, 6 + M], [-M, 6 + M]];
    editor.store.exec({ type: 'addFloor', floor: { id: 'pu', kind: 'floor', typeId: 'ft_unico', levelId: 'lv_0', boundary: fora.map(([x, y]) => ({ x, y })), holes: [], heightOffset: 0, mark: '', comments: '' } });
    editor.zoomExtents();
  }, M);
  await page.waitForTimeout(300);
  const [acab, , , estrut] = await areasOf();
  const bruta = (8 + 2 * M) * (6 + 2 * M);
  check('piso único criado com quatro camadas', (await areasOf()).length === 4);
  check('estrutura (passa) mantém a área bruta do perímetro', Math.abs(estrut - bruta) < 0.01, `(${estrut.toFixed(3)} m²)`);
  check('acabamento (até a face) tem área menor que a estrutura', acab < estrut - 1, `(${acab.toFixed(3)} m² < ${estrut.toFixed(3)} m²)`);
  await page.screenshot({ path: `${OUT}/90-piso-unico-face.png` });
});

await rep.step('mudar o acabamento para núcleo: a área aumenta', async () => {
  const antes = (await areasOf())[0];
  await page.evaluate(() => {
    const { editor } = window.__hestia;
    const tipo = editor.project.floorTypes.ft_unico;
    const layers = tipo.layers.map((l, i) => (i === 0 ? { ...l, termino: 'nucleo' } : l));
    editor.store.exec({ type: 'upsertFloorType', floorType: { ...tipo, layers } });
  });
  await page.waitForTimeout(300);
  const depois = (await areasOf())[0];
  check('núcleo deixa a camada avançar sob o reboco', depois > antes + 1, `(${antes.toFixed(3)} → ${depois.toFixed(3)} m²)`);
  await page.screenshot({ path: `${OUT}/91-piso-unico-nucleo.png` });
});

await browser.close();
rep.summary();
console.log(`erros do console: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
const bad = rep.steps.some((s) => s.status === 'FAIL') || errors.length > 0;
process.exit(bad ? 1 : 0);
