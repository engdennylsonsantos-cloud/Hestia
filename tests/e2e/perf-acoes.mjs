// Cenários de inserção no navegador (frente G, onda 6): porta numa parede, janela numa parede e parede nova.
// Usado por tests/e2e/perf-browser.mjs. A medida vai do clique (pointerup) até o quadro seguinte pintado (rAF duplo),
// com cliques reais no canvas da planta, pelas ferramentas (setTool). Cada repetição desfaz a inserção (editor.undo)
// fora do cronômetro, e só conta a repetição se a contagem de elementos mudou exatamente em um.

/** Ponto de tela de um ponto de projeto, a partir do viewport e do retângulo do canvas. */
function criarTela(v, c) {
  return (x, y) => ({ x: c.left + (x - v.cx) * v.zoom + v.width / 2, y: c.top + v.height / 2 - (y - v.cy) * v.zoom });
}

/** Mede a inserção de porta ou janela na parede `idParede` (clique no centro da parede, fora de aberturas). */
async function medirAbertura(ctx, ferramenta, alvo) {
  const { page, RUNS, esperarQuadros, pendencias, rotulo, idParede } = ctx;
  const contar = () => page.evaluate((id) => Object.values(window.__hestia.editor.project.elements).filter((e) => e.hostId === id).length, idParede);
  const tempos = [];
  let inseridas = 0;
  for (let r = 0; r < RUNS; r++) {
    await page.evaluate((f) => window.__hestia.editor.setTool(f), ferramenta);
    await esperarQuadros(page);
    const antes = await contar();
    await armarMedidor(page);
    await page.mouse.click(alvo.x, alvo.y);
    await page.waitForFunction(() => window.__ins !== null, null, { timeout: 10000 });
    const dt = await page.evaluate(() => window.__ins);
    const depois = await contar();
    if (depois === antes + 1) {
      inseridas++;
      tempos.push(dt);
    }
    await page.evaluate(() => window.__hestia.editor.undo());
    await esperarQuadros(page);
    if ((await contar()) !== antes) pendencias.push(`[${rotulo}] ${ferramenta}: o desfazer não restaurou a contagem de aberturas da parede`);
  }
  await page.evaluate(() => window.__hestia.editor.setTool('select'));
  if (inseridas < RUNS) pendencias.push(`[${rotulo}] ${ferramenta}: só ${inseridas} de ${RUNS} inserções confirmadas pela contagem`);
  return { inseridas, tempo: ctx.resumo(tempos) };
}

/** Mede a criação de uma parede nova: primeiro clique fora da medida, segundo clique cronometrado (fecha o segmento). */
async function medirParedeNova(ctx, p1, p2) {
  const { page, RUNS, esperarQuadros, pendencias, rotulo, nivel } = ctx;
  const contar = () => page.evaluate((lv) => Object.values(window.__hestia.editor.project.elements).filter((e) => e.kind === 'wall' && e.levelId === lv).length, nivel);
  const tempos = [];
  let criadas = 0;
  for (let r = 0; r < RUNS; r++) {
    await page.evaluate(() => window.__hestia.editor.setTool('wall'));
    await esperarQuadros(page);
    await page.mouse.click(p1.x, p1.y);
    await esperarQuadros(page);
    const antes = await contar();
    await armarMedidor(page);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForFunction(() => window.__ins !== null, null, { timeout: 10000 });
    const dt = await page.evaluate(() => window.__ins);
    const depois = await contar();
    if (depois === antes + 1) {
      criadas++;
      tempos.push(dt);
    }
    await page.evaluate(() => window.__hestia.editor.undo());
    await page.evaluate(() => window.__hestia.editor.setTool('select'));
    await esperarQuadros(page);
    if ((await contar()) !== antes) pendencias.push(`[${rotulo}] parede nova: o desfazer não restaurou a contagem de paredes do nível`);
  }
  if (criadas < RUNS) pendencias.push(`[${rotulo}] parede nova: só ${criadas} de ${RUNS} paredes confirmadas pela contagem`);
  return { criadas, tempo: ctx.resumo(tempos) };
}

/** Arma o medidor: na próxima pointerup (fase de captura, antes da ferramenta), grava o tempo até dois quadros. */
function armarMedidor(page) {
  return page.evaluate(() => {
    window.__ins = null;
    window.addEventListener('pointerup', () => {
      const t0 = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { window.__ins = performance.now() - t0; }));
    }, { capture: true, once: true });
  });
}

/**
 * Roda os três cenários de inserção no nível `nivel`, com a parede `idParede` como alvo das aberturas.
 * Devolve { portaNaParede, janelaNaParede, paredeNova }, cada um com contagem de acertos e resumo do tempo.
 */
export async function medirInsercoes(ctx) {
  const { page, esperarQuadros, nivel, idParede } = ctx;
  await page.evaluate((id) => window.__hestia.editor.selectLevel(id), nivel);
  await page.evaluate(() => {
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect();
    window.__hestia.editor.setViewport({ cx: 6, cy: 6, zoom: 30, width: Math.round(r.width), height: Math.round(r.height) });
  });
  await esperarQuadros(page);
  const { v, c, meio } = await page.evaluate((id) => {
    const w = window.__hestia.editor.project.elements[id];
    const vp = window.__hestia.editor.viewport();
    const rc = document.querySelector('.canvas-wrap canvas').getBoundingClientRect();
    return { v: vp, c: { left: rc.left, top: rc.top }, meio: { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 } };
  }, idParede);
  const tela = criarTela(v, c);
  const alvo = tela(meio.x, meio.y);
  const portaNaParede = await medirAbertura(ctx, 'door', alvo);
  const janelaNaParede = await medirAbertura(ctx, 'window', alvo);
  // Trecho livre no nível do meio: x de 3 a 5 m, em y = 10,5 m (nenhuma parede da planta sintética passa ali).
  const paredeNova = await medirParedeNova(ctx, tela(3, 10.5), tela(5, 10.5));
  return { portaNaParede, janelaNaParede, paredeNova };
}
