// Mede o 2o clique da parede e o pan no app em dev. Uso: node tests/e2e/fix-clique-medir.mjs <url> <rotulo> [repeticoes]
// Mede: quantos segundos de parede registram no 2o clique, latencia evento->commit, alvo do clique (canvas ou overlay),
// tempo de quadro e tarefas longas durante o pan.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [url, rotulo, reps = '20'] = process.argv.slice(2);
const N = Number(reps);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto(`${url}/?debug=1`);
await page.waitForSelector('.canvas-wrap canvas');
await page.waitForFunction(() => window.__hestia);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.newProject('house2');
  editor.zoomExtents();
  editor.setTool('wall');
  window.__log = [];
  const walls = () => Object.values(editor.project.elements).filter((e) => e.kind === 'wall').length;
  window.__walls = walls;
  for (const t of ['pointerdown', 'pointerup', 'click']) {
    document.addEventListener(t, (e) => {
      const el = e.target;
      window.__log.push({ t, at: performance.now(), alvo: el.tagName === 'CANVAS' ? 'canvas' : 'overlay:' + (el.getAttribute?.('aria-label') ?? el.tagName) });
    }, true);
  }
  editor.store.subscribe(() => window.__log.push({ t: 'commit', at: performance.now() }));
});
const box = await page.locator('.canvas-wrap').boundingBox();
const res = [];
for (let i = 0; i < N; i++) {
  await page.evaluate(() => { window.__log = []; window.__w0 = window.__walls(); window.__hestia.editor.setTool('select'); window.__hestia.editor.setTool('wall'); });
  const x0 = box.x + 200 + (i % 5) * 7, y0 = box.y + 120 + i * 9;
  await page.mouse.move(x0, y0);
  await page.mouse.click(x0, y0);
  const x1 = x0 + 260, y1 = y0 + 3;
  await page.mouse.move(x1 - 80, y1, { steps: 6 });
  await page.mouse.move(x1, y1, { steps: 6 });
  await page.waitForTimeout(60); // deixa o React renderizar a cota sob o cursor, como numa pausa humana
  await page.mouse.click(x1, y1);
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const l = window.__log;
    const ups = l.filter((e) => e.t === 'pointerup');
    const up2 = ups[ups.length - 1];
    const com = l.filter((e) => e.t === 'commit' && up2 && e.at >= up2.at)[0];
    return { novas: window.__walls() - window.__w0, alvo2: up2 ? l.filter((e) => e.t === 'pointerdown').pop()?.alvo : null, latenciaMs: com && up2 ? com.at - up2.at : null };
  });
  res.push(r);
}
const ok = res.filter((r) => r.novas >= 1).length;
const lat = res.filter((r) => r.latenciaMs !== null).map((r) => r.latenciaMs);
const alvos = {};
res.forEach((r) => { alvos[r.alvo2] = (alvos[r.alvo2] ?? 0) + 1; });
await page.evaluate(() => window.__hestia.editor.activeTool.cancel?.());
await page.screenshot({ path: `docs/plano-unidades-cotas/capturas/fix-clique-${rotulo}-parede.png` });

// Pan: botao do meio, 60 passos, com e sem ferramenta de parede (cotas sob o cursor).
const pan = async (comCota) => {
  await page.evaluate((c) => {
    const { editor } = window.__hestia;
    editor.setTool(c ? 'wall' : 'select');
    window.__frames = []; window.__long = 0;
    new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ entryTypes: ['longtask'] });
    let last = performance.now();
    const loop = (t) => { window.__frames.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(loop); };
    window.__stop = false; requestAnimationFrame(loop);
  }, comCota);
  const cx = box.x + 700, cy = box.y + 400;
  if (comCota) { await page.mouse.move(cx - 200, cy); await page.mouse.click(cx - 200, cy); }
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'middle' });
  const t0 = Date.now();
  for (let k = 1; k <= 120; k++) await page.mouse.move(cx + k * 2, cy + Math.sin(k / 10) * 40);
  await page.mouse.up({ button: 'middle' });
  const ms = Date.now() - t0;
  const out = await page.evaluate(() => { window.__stop = true; const f = [...window.__frames].sort((a, b) => a - b); return { quadros: f.length, p50: f[Math.floor(f.length / 2)], p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1], longTasks: window.__long }; });
  await page.evaluate(() => window.__hestia.editor.activeTool.cancel?.());
  return { ...out, totalMs120Moves: ms };
};
const panSem = await pan(false);
const panCom = await pan(true);
const resumo = { rotulo, url, repeticoes: N, segundoCliqueRegistrou: ok, alvosDoSegundoCliqueDown: alvos, latenciaMsMedia: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null, panSemFerramenta: panSem, panComCotaVisivel: panCom };
writeFileSync(`docs/plano-unidades-cotas/capturas/fix-clique-${rotulo}.json`, JSON.stringify(resumo, null, 2));
console.log(JSON.stringify(resumo, null, 2));
console.log(JSON.stringify(res.slice(0, 4)));
await browser.close();
