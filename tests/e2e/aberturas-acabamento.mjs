// Acabamento do tipo de abertura (decisão 0017 §8): edita o tipo de uma janela pelo diálogo, liga o alizar e confere
// no 3D que há peças a mais; desligar volta a ter menos peças; valor fora da faixa mostra a mensagem do modelo e não
// fecha o diálogo. Sem erro de console. Uso: node tests/e2e/aberturas-acabamento.mjs (com dist: npm run build antes).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?gl=1&debug=1');
await page.waitForSelector('.canvas-wrap canvas');
await page.waitForFunction(() => window.__hestia && window.__hestia3dModel);

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`.trimEnd());
  if (!ok) fails++;
};
// Triângulos das malhas da cena 3D: sobe quando há peças a mais e desce quando some alguma.
const TRIS = '(() => { let n = 0; window.__hestia3dModel.scene.traverse((o) => { if (o.isMesh) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return n; })()';
const tris = () => page.evaluate(TRIS);
/** Espera a cena 3D refletir a mudança: o número de triângulos sai de `antes`. */
const esperaMudar = (antes) => page.waitForFunction(`${TRIS} !== ${antes}`, null, { timeout: 15000 });
const abrirTipo = async () => {
  await page.getByRole('button', { name: 'Editar tipo' }).click();
  await page.getByText('Propriedades do tipo').waitFor();
};

// 1. casa de teste, janela selecionada e 3D medido antes da mudança
await page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  editor.newProject('house2');
  const janela = Object.values(editor.project.elements).find((e) => e.kind === 'window');
  useUi.setState({ selection: [janela.id] });
});
await page.waitForTimeout(300);
await page.evaluate(() => window.__hestia.editor.setView('3d'));
await page.waitForFunction(`${TRIS} > 1000`, null, { timeout: 30000 });
await page.waitForTimeout(500);
const antes = await tris();
check('cena 3D construída antes da mudança', antes > 1000, `(${antes} triângulos)`);
await abrirTipo();

// 2. seção Acabamento: folga inválida mostra a mensagem do modelo e o diálogo continua aberto
await page.getByText('Acabamento', { exact: true }).click();
await page.getByLabel('Folga: largura').fill('-1');
await page.getByLabel('Folga: largura').press('Enter');
await page.getByLabel('Alizar', { exact: true }).check();
await page.getByRole('button', { name: 'OK', exact: true }).click();
const msg = page.getByText('Folga do vão, largura: use um valor de 0 a 20 cm.');
await msg.waitFor({ timeout: 5000 }).catch(() => {});
check('folga negativa mostra a mensagem do modelo', await msg.isVisible());
check('o diálogo continua aberto com erro', await page.getByText('Propriedades do tipo').isVisible());

// 3. corrige a folga, OK grava o alizar e o 3D ganha peças
await page.getByLabel('Folga: largura').fill('1');
await page.getByLabel('Folga: largura').press('Enter');
await page.getByRole('button', { name: 'OK', exact: true }).click();
await page.getByText('Propriedades do tipo').waitFor({ state: 'detached' });
await esperaMudar(antes);
const comAlizar = await tris();
check('alizar ligado: o 3D ganha peças', comAlizar > antes, `(${antes} -> ${comAlizar} triângulos)`);

// 4. reabre: o alizar aparece ligado; desligar tira as peças
await abrirTipo();
await page.getByText('Acabamento', { exact: true }).click();
check('reabre com o alizar ligado', await page.getByLabel('Alizar', { exact: true }).isChecked());
await page.getByLabel('Alizar', { exact: true }).uncheck();
await page.getByRole('button', { name: 'OK', exact: true }).click();
await page.getByText('Propriedades do tipo').waitFor({ state: 'detached' });
await esperaMudar(comAlizar);
const semAlizar = await tris();
check('alizar desligado: o 3D perde as peças', semAlizar < comAlizar, `(${comAlizar} -> ${semAlizar} triângulos)`);

check('sem erro de console', errors.length === 0, errors.length ? `(${errors.slice(0, 3).join(' | ')})` : '');
await browser.close();
console.log(fails ? `${fails} falha(s)` : 'tudo OK');
process.exit(fails ? 1 : 0);
