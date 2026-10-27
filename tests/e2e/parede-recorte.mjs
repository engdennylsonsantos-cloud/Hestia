// Parede recortada pela junção com piso (decisão 0023 §10, P7c parte 2) no app real: desenha uma sala, um piso que
// atravessa as paredes e uma parede longe dele; confere por `window.__hestia` que as partes da junção somam o volume líquido
// dos quantitativos, que as faixas desenhadas são as mesmas e que a parede sem sobreposição não mudou. Código de saída 1
// se algo falhou (ou se houver erro de console).
//   npm run build && node tests/e2e/parede-recorte.mjs
import { mkdirSync } from 'node:fs';
import { launch, makeReporter, openApp, perimetroPorPontos } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/parede-recorte';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);

/** Coordenadas de tela de um ponto de mundo (como nos outros e2e; `ensureViewport` devolve a vista já assentada). */
const screenOf = (wx, wy) => page.evaluate(([x, y]) => {
  const { editor } = window.__hestia;
  const canvas = document.querySelector('.canvas-wrap canvas');
  const r = canvas.getBoundingClientRect();
  const v = editor.ensureViewport(r.width, r.height);
  return { x: r.left + (x - v.cx) * v.zoom + v.width / 2, y: r.top + v.height / 2 - (y - v.cy) * v.zoom };
}, [wx, wy]);
const click = async (wx, wy) => {
  const p = await screenOf(wx, wy);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(80);
};
const options = (patch) => page.evaluate((o) => {
  const { useUi } = window.__hestia;
  useUi.setState({ options: { ...useUi.getState().options, ...o } });
}, patch);
const tool = (id) => page.evaluate((t) => window.__hestia.editor.setTool(t), id);

await rep.step('desenhar a sala 4 × 3 m e uma parede solta', async () => {
  await page.evaluate(() => window.__hestia.editor.newProject('blank'));
  await options({ wallShape: 'rect' });
  await tool('wall');
  await page.waitForTimeout(200);
  await click(0, 0);
  await click(4, 3);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await options({ wallShape: 'line' });
  await tool('wall');
  await click(7, 0);
  await click(10, 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__hestia.editor.zoomExtents());
  await page.waitForTimeout(300);
  const n = await page.evaluate(() => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall').length);
  check('sala com 4 paredes + 1 parede solta', n === 5, `(${n})`);
});

await rep.step('criar um piso retangular que atravessa as quatro paredes da sala', async () => {
  // Pelo modo de perímetro: o retângulo é o esboço de quatro lados (o tipo vem das opções, como ao começar pela faixa).
  await options({ floorTypeId: 'ft_ceram' });
  const res = await perimetroPorPontos(page, 'floor', [[-0.2, -0.2], [4.2, -0.2], [4.2, 3.2], [-0.2, 3.2]]);
  check('piso criado pelo modo de perímetro', res.ok, res.msg);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const { editor } = window.__hestia;
    const f = Object.values(editor.project.elements).find((e) => e.kind === 'floor');
    if (!f) return null;
    const area = Math.abs(f.boundary.reduce((s, a, i) => {
      const b = f.boundary[(i + 1) % f.boundary.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0) / 2);
    return { id: f.id, area, heightOffset: f.heightOffset };
  });
  check('piso criado por retângulo', info !== null);
  check('retângulo cobrindo as quatro paredes (≈ 15 m²)',!!info && info.area > 14.5, info ? `${info.area.toFixed(3)} m²` : '');
  // O piso do térreo nasce com o topo em 0; subir o topo para 0,05 m faz as camadas dele cruzarem a base da parede.
  await page.evaluate((id) => window.__hestia.editor.store.exec({ type: 'updateElements', ids: [id], patch: { heightOffset: 0.05 } }), info.id);
  await page.waitForTimeout(300);
  const h = await page.evaluate((id) => window.__hestia.editor.project.elements[id]?.heightOffset, info.id);
  check('piso com topo em 0,05 m (faixa que cruza a parede)', Math.abs(h - 0.05) < 1e-9, `${h}`);
});

await rep.step('as partes da junção somam o líquido dos quantitativos, por parede e por camada', async () => {
  const m = await page.evaluate(() => {
    const { editor, resolveLevel, junctionLevel, cutLevelByJunction, quantifyLevel } = window.__hestia;
    const p = editor.project;
    const lv = resolveLevel(p, 'lv_0');
    const jl = junctionLevel(p, 'lv_0');
    const q = quantifyLevel(p, lv);
    /** Área líquida de um MultiPolygon (externo menos furos), a mesma conta de `multiArea`. */
    const area = (mp) => mp.reduce((s, poly) => s + poly.reduce((t, ring, i) => {
      let a = 0;
      for (let j = 0; j < ring.length; j++) {
        const u = ring[j];
        const v = ring[(j + 1) % ring.length];
        a += u.x * v.y - v.x * u.y;
      }
      return t + (i === 0 ? Math.abs(a) / 2 : -Math.abs(a) / 2);
    }, 0), 0);
    const partsVolume = (el) => el.layers.reduce((s, l) => s + l.parts.reduce((t, x) => t + area(x.poly) * (x.z1 - x.z0), 0), 0);
    const bandsVolume = (rw) => rw.layers.reduce((s, l) => s + l.bands.reduce((t, b) => t + area(b.poly) * (b.z1 - b.z0), 0), 0);
    const drawn = cutLevelByJunction(lv, jl, { planZ: 1.2 });
    const plan = cutLevelByJunction(lv, jl, { planZ: 0.01 });
    const planAgain = cutLevelByJunction(lv, jl, { planZ: 0.01 });
    const walls = Object.values(p.elements).filter((e) => e.kind === 'wall').map((w) => {
      const el = jl.elements.get(w.id);
      const qw = q.walls.find((x) => x.wallId === w.id);
      const rw = lv.walls[w.id];
      const rwDrawn = drawn.walls[w.id];
      const rwPlan = plan.walls[w.id];
      const qLayers = q.layers.filter((l) => l.wallId === w.id);
      const layerParts = (i) => el ? el.layers.filter((l) => l.layerIndex === i).flatMap((l) => l.parts) : [];
      const partsByLayer = qLayers.map((l) => partsVolume({ layers: [{ parts: layerParts(l.layerIndex) }] }));
      const bandsByLayer = qLayers.map((l) => (rwDrawn?.layers.find((x) => x.layerIndex === l.layerIndex)?.bands ?? []).reduce((t, b) => t + area(b.poly) * (b.z1 - b.z0), 0));
      return {
        id: w.id,
        cut: el?.cut ?? false,
        isolated: Math.min(w.a.x, w.b.x) >= 7,
        parts: el ? partsVolume(el) : null,
        drawn: rwDrawn ? bandsVolume(rwDrawn) : null,
        q: qw?.volume ?? null,
        gross: qw?.grossVolume ?? null,
        qLayers: qLayers.map((l) => l.volume),
        partsByLayer,
        bandsByLayer,
        planArea: rw.layers.reduce((s, l) => s + area(l.cut), 0),
        planDrawnArea: rwPlan.layers.reduce((s, l) => s + area(l.cut), 0),
        sameObject: rwDrawn === rw,
        samePlanObject: rwPlan === rw,
      };
    });
    return { walls, cache: plan === planAgain, planDiffers: plan !== lv, floorCut: jl.elements.get(Object.values(p.elements).find((e) => e.kind === 'floor')?.id)?.cut ?? false };
  });
  const room = m.walls.filter((w) => !w.isolated);
  const isolated = m.walls.find((w) => w.isolated);
  check('quatro paredes da sala na junção', room.length === 4, `(${room.length})`);
  check('todas as paredes da sala foram recortadas', room.every((w) => w.cut), room.map((w) => `${w.id}:${w.cut}`).join(' '));
  check('o piso também foi recortado (as camadas de acabamento perdem para o núcleo da parede)', m.floorCut === true);
  check('parede solta sem sobreposição: `cut` falso e mesmo objeto no desenho', !!isolated && !isolated.cut && isolated.sameObject, JSON.stringify(isolated && { cut: isolated.cut, same: isolated.sameObject }));
  // Volume total: partes da junção = faixas desenhadas = quantitativo, em todas as paredes.
  const volOk = m.walls.every((w) => w.parts !== null && w.drawn !== null && w.q !== null
    && Math.abs(w.parts - w.q) < 1e-6 && Math.abs(w.drawn - w.q) < 1e-6);
  check('volume das partes = volume das faixas desenhadas = volume líquido dos quantitativos', volOk,
    m.walls.map((w) => `${w.id}: ${w.parts?.toFixed(6)} / ${w.drawn?.toFixed(6)} / ${w.q?.toFixed(6)}`).join(' | '));
  // Camada a camada: o recorte não troca volume de uma camada para outra.
  const layerOk = m.walls.every((w) => w.qLayers.length === w.partsByLayer.length
    && w.qLayers.every((v, i) => Math.abs(v - w.partsByLayer[i]) < 1e-6 && Math.abs(v - w.bandsByLayer[i]) < 1e-6));
  check('volume por camada: partes = faixas = quantitativo', layerOk,
    m.walls.map((w) => `${w.id}: ${w.qLayers.map((v, i) => `${v.toFixed(4)}/${w.partsByLayer[i].toFixed(4)}/${w.bandsByLayer[i].toFixed(4)}`).join(',')}`).join(' | '));
  check('o recorte tirou volume das paredes da sala (líquido < bruto)', room.every((w) => w.q < w.gross - 1e-9),
    room.map((w) => `${w.id}: ${w.q.toFixed(4)} < ${w.gross.toFixed(4)}`).join(' '));
  check('parede solta: líquido = bruto', !!isolated && Math.abs(isolated.q - isolated.gross) < 1e-9, isolated ? `${isolated.q}` : '');
  // Planta na cota 0,01 (dentro do piso): a parede perde a região; na parede solta, nada muda.
  check('planta na cota do piso recorta as paredes da sala', room.every((w) => w.planDrawnArea < w.planArea - 1e-9),
    room.map((w) => `${w.id}: ${w.planDrawnArea.toFixed(4)} < ${w.planArea.toFixed(4)}`).join(' '));
  check('planta: parede solta volta pelo mesmo objeto', !!isolated && isolated.samePlanObject);
  check('cache da planta devolve o mesmo nível cortado', m.cache === true);
  check('a junção mudou alguma coisa no nível', m.planDiffers === true);
  await page.screenshot({ path: `${OUT}/01-planta-parede-recortada.png` });
});

await rep.step('sem erros de console ou de página', async () => {
  check('nenhum erro de console/página', errors.length === 0, errors.slice(0, 3).join(' | '));
});

await browser.close();
rep.summary();
console.log(`\nImagens em: ${OUT}`);
const bad = rep.steps.some((s) => s.status === 'FAIL');
process.exit(bad || errors.length ? 1 : 0);
