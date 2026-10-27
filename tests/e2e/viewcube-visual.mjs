// ViewCube com anel de bússola (vista 3D do "Casa premium"). Salva capturas do cubo em três poses (padrão, de cima e de
// lado) nos dois temas, e uma com o cursor sobre uma célula. Afirma que clicar numa letra do anel muda o azimute para o
// dela (mantendo a elevação) e que clicar na face FRENTE ainda leva à vista frontal. Não compara pixels.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, openApp } from './helpers.mjs';

const OUT = path.resolve('tests/e2e/out');
mkdirSync(OUT, { recursive: true });

const DEG = Math.PI / 180;
const POLE = Math.PI / 2 - 0.02;
const POSES = [
  { name: 'padrao', azimuth: -45 * DEG, elevation: 0.5 },
  { name: 'de-cima', azimuth: -45 * DEG, elevation: POLE },
  { name: 'de-lado', azimuth: 110 * DEG, elevation: 0.12 },
];
const THEMES = ['claro', 'escuro'];

const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1&gl=1', width: 1440, height: 860 });
let fails = 0;
const check = (name, ok, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`.trimEnd());
};
/** Diferença angular em (−π, π]. */
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

await page.evaluate(() => {
  const { editor } = window.__hestia;
  // "Casa premium" tem telhado, paredes, portas, janelas, laje e escada.
  editor.newProject('house-premium');
  editor.setView('3d');
  editor.zoomExtents();
});
await page.waitForFunction(() => window.__hestia3d && window.__hestia3dModel);
await page.waitForSelector('.viewcube .vc-cube');
await page.waitForTimeout(400);

/** Fixa a câmera direto (sem animação) e espera um quadro para o cubo e o anel se redesenharem. */
const setPose = async ({ azimuth, elevation }) => {
  await page.evaluate(({ azimuth, elevation }) => {
    const o = window.__hestia3d;
    o.cancelAnimation(); // uma animação em curso sobrescreveria a pose fixada aqui
    o.azimuth = azimuth;
    o.elevation = elevation;
    o.apply();
    window.__hestia.useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
  }, { azimuth, elevation });
  await page.waitForTimeout(250);
};
const camera = () => page.evaluate(() => ({ azimuth: window.__hestia3d.azimuth, elevation: window.__hestia3d.elevation }));
/** Espera a câmera chegar ao alvo (a animação avança por quadro, e no SwiftShader os quadros são lentos). */
const reach = async (azimuth, elevation) => {
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(300);
    const cur = await camera();
    if (Math.abs(angleDiff(cur.azimuth, azimuth)) < 0.005 && Math.abs(cur.elevation - elevation) < 0.005) return;
  }
};
/** Espera a câmera parar (para o arrasto, que não tem alvo): duas leituras seguidas iguais, depois de um tempo mínimo. */
const settle = async () => {
  await page.waitForTimeout(1200);
  let prev = await camera();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(300);
    const cur = await camera();
    if (Math.abs(cur.azimuth - prev.azimuth) < 1e-9 && Math.abs(cur.elevation - prev.elevation) < 1e-9) return;
    prev = cur;
  }
};

for (const theme of THEMES) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t === 'escuro' ? 'dark' : 'light'), theme);
  for (const pose of POSES) {
    await setPose(pose);
    const cube = page.locator('.viewcube');
    await cube.screenshot({ path: path.join(OUT, `viewcube-${pose.name}-${theme}.png`) });
    console.log(`captura: viewcube-${pose.name}-${theme}.png`);
  }
}

// Cursor sobre uma célula de face: realce azul (is-hover) e captura.
await setPose(POSES[0]);
{
  const cell = page.locator('[data-face="front"]');
  const b = await cell.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
  await page.locator('.viewcube').screenshot({ path: path.join(OUT, 'viewcube-hover-claro.png') });
  check('face sob o cursor fica com o realce is-hover', (await page.locator('.vc-cell.is-hover').count()) === 1);
}

// Clicar numa letra do anel (sobre a camada da frente) muda o azimute para o dela e mantém a elevação.
await setPose(POSES[0]);
{
  const before = await camera();
  const letter = page.locator('.vc-ring--front text', { hasText: 'L' });
  const n = await letter.count();
  check('letra L do anel está do lado da câmera na vista padrão', n === 1, `(encontradas: ${n})`);
  if (n === 1) {
    const b = await letter.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await reach(0, before.elevation);
    const after = await camera();
    check('clicar em L leva o azimute a leste (0)', Math.abs(angleDiff(after.azimuth, 0)) < 0.02, `(az=${after.azimuth.toFixed(3)})`);
    check('clicar em L mantém a elevação', Math.abs(after.elevation - before.elevation) < 1e-6, `(el=${after.elevation.toFixed(3)})`);
  }
}

// Clicar na letra S (a de sul, do lado da câmera na vista padrão) vai ao sul.
await setPose(POSES[0]);
{
  const letter = page.locator('.vc-ring--front text', { hasText: 'S' });
  if ((await letter.count()) === 1) {
    const b = await letter.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await reach(-Math.PI / 2, POSES[0].elevation);
    const after = await camera();
    check('clicar em S leva o azimute a sul (-90°)', Math.abs(angleDiff(after.azimuth, -Math.PI / 2)) < 0.02, `(az=${after.azimuth.toFixed(3)})`);
  } else check('letra S do anel está do lado da câmera na vista padrão', false);
}

// Clicar na face FRENTE (o centro da face, que tem pointer-events: none, então o clique cai no palco) leva à vista frontal.
// Na vista padrão a frente está voltada para a câmera (numa vista de costas, o clique cairia na aresta visível).
await setPose(POSES[0]);
{
  const cell = page.locator('[data-face="front"]');
  const b = await cell.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await reach(-Math.PI / 2, 0);
  const after = await camera();
  check('clicar em FRENTE leva à vista frontal (azimute -90°, elevação 0)', Math.abs(angleDiff(after.azimuth, -Math.PI / 2)) < 0.02 && Math.abs(after.elevation) < 0.02, `(az=${after.azimuth.toFixed(3)}, el=${after.elevation.toFixed(3)})`);
}

// Arrastar sobre o anel gira o azimute e não muda a elevação.
await setPose(POSES[0]);
{
  const before = await camera();
  const ring = await page.locator('.vc-ring--back').boundingBox();
  // Ponto da faixa sem letra (ângulo −45° no chão, perto da base do palco). Centro do palco = centro do SVG.
  const x0 = ring.x + ring.width / 2;
  const y0 = ring.y + ring.height / 2 + 56;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 20, y0 + 25, { steps: 6 });
  await page.mouse.up();
  await settle();
  const after = await camera();
  check('arrastar sobre o anel muda o azimute', Math.abs(after.azimuth - before.azimuth) > 0.05, `(${before.azimuth.toFixed(3)} → ${after.azimuth.toFixed(3)})`);
  check('arrastar sobre o anel não muda a elevação', Math.abs(after.elevation - before.elevation) < 1e-6);
}

// Colisão: a barra de navegação (.navbar) não pode cobrir o cubo nem o anel.
await setPose(POSES[0]);
{
  const r = async (sel) => page.locator(sel).first().boundingBox();
  const nav = await r('.navbar');
  const stage = await r('.vc-stage');
  const tools = await r('.vc-tools');
  const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  check('barra de navegação não cobre o palco do ViewCube', !overlap(nav, stage), nav && stage ? `(nav y ${Math.round(nav.y)}, palco ${Math.round(stage.y)}–${Math.round(stage.y + stage.height)})` : '');
  check('barra de navegação não cobre os botões do ViewCube', !overlap(nav, tools), tools ? `(botões ${Math.round(tools.y)}–${Math.round(tools.y + tools.height)})` : '');
}

check('sem erros no console', errors.length === 0, errors.length ? `(${errors.slice(0, 2).join(' | ')})` : '');
await browser.close();
console.log(fails ? `\n${fails} verificação(ões) falharam` : '\nTudo OK');
process.exit(fails ? 1 : 0);
