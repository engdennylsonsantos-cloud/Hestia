// Conferência das pranchas no navegador (roteiro G4, itens D2–D6): cria uma prancha A3 paisagem numa casa de teste,
// adiciona planta 1:100 e um corte, arrasta e reescala vistas, edita o carimbo, exporta o PDF e valida o arquivo
// (cabeçalho, xref, uma página por prancha, texto do carimbo e raster). Uso: node tests/e2e/pranchas.mjs (com dist).
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const OUT = process.env.SHOTS ?? 'test-results/pranchas';
mkdirSync(OUT, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(pathToFileURL(path.resolve('apps/web/dist/index.html')).href + '?gl=1&debug=1');
await page.waitForSelector('.canvas-wrap canvas');
await page.waitForFunction(() => window.__hestia);

let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`.trimEnd()); if (!ok) fails++; };
const proj = () => page.evaluate(() => {
  const p = window.__hestia.editor.project;
  return { sheets: p.sheets ?? [], views: p.views ?? [], view: window.__hestia.useUi.getState().view };
});
const sheet0 = async () => (await proj()).sheets[0];

// 1. casa de teste: "Novo" → modelo "Casa térrea, 2 quartos"
await page.getByRole('button', { name: 'Novo' }).click();
await page.getByText('Casa térrea, 2 quartos').click();
await page.waitForFunction(() => window.__hestia.editor.project.levels.length > 0);
await page.waitForTimeout(300);

// 2. corte: ferramenta K na planta, duas cliques (o corte nasce como "Corte A")
const box = await page.locator('.canvas-wrap').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.keyboard.press('k');
await page.mouse.click(cx - 220, cy);
await page.mouse.click(cx + 220, cy);
await page.keyboard.press('Escape');
const views = (await proj()).views;
check('corte criado pela ferramenta K', views.some((v) => v.kind === 'section'), `(${views.length} cortes/vistas)`);

// 3. prancha nova pelo navegador de projeto (abre a aba da prancha)
await page.getByRole('button', { name: 'Nova prancha' }).click();
await page.waitForSelector('.sheet-wrap svg');
let s = await sheet0();
check('prancha A3 paisagem criada e aberta', !!s && s.size === 'A3' && s.orientation === 'landscape' && (await proj()).view === 'sheet');

// 4. vista de planta 1:100 (primeira opção do diálogo) e corte na escala 1:50
const addView = async (sourceLabelPrefix, scale) => {
  const n = (await sheet0()).viewports.length + 1;
  await page.getByRole('button', { name: 'Adicionar vista', exact: true }).click();
  const idx = await page.$$eval('#av-source option', (os, pre) => os.findIndex((o) => o.textContent.startsWith(pre)), sourceLabelPrefix);
  await page.locator('#av-source').selectOption({ index: idx });
  await page.locator('#av-scale').selectOption(String(scale));
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.waitForFunction((k) => window.__hestia.editor.project.sheets[0].viewports.length === k, n);
};
await addView('Planta · ', 100);
await addView('Corte · ', 50);
s = await sheet0();
const kinds = s.viewports.map((v) => `${v.view.kind}@1:${v.scale}`).join(', ');
check('D5 vistas planta 1:100 e corte 1:50 adicionadas', s.viewports.length === 2 && s.viewports[0].view.kind === 'plan' && s.viewports[0].scale === 100 && s.viewports[1].view.kind === 'section' && s.viewports[1].scale === 50, `(${kinds})`);
await page.screenshot({ path: `${OUT}/01-vistas.png` });

// 5. arrastar a vista de planta pela área da folha
const vp = page.locator('[data-vp]').first();
const b0 = await vp.boundingBox();
const before = (await sheet0()).viewports[0].at;
await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
await page.mouse.down();
await page.mouse.move(b0.x + b0.width / 2 + 40, b0.y + b0.height / 2 - 30, { steps: 8 });
await page.mouse.up();
const after = (await sheet0()).viewports[0].at;
const moved = Math.hypot(after.x - before.x, after.y - before.y);
check('D3 arrastar vista move a posição', moved > 1, `(dx ${(after.x - before.x).toFixed(1)} mm, dy ${(after.y - before.y).toFixed(1)} mm)`);
const size0 = (await sheet0()).viewports[0].size;
// Folha A3 paisagem: 420 × 297 mm. A vista tem de ficar inteira na área da folha.
check('D3 vista arrastada continua dentro da folha', after.x >= 0 && after.y >= 0 && after.x + size0.w <= 420 + 1e-6 && after.y + size0.h <= 297 + 1e-6);

// 6. escala pela faixa: seleciona o corte e troca 1:50 → 1:100
await page.locator('[data-vp]').nth(1).click();
await page.locator('#sheet-scale').selectOption('100');
s = await sheet0();
check('D3 escala da vista trocada pela faixa', s.viewports[1].scale === 100, `(1:${s.viewports[1].scale})`);

// 7. propriedades da prancha: carimbo com projeto e cliente
await page.getByRole('button', { name: 'Propriedades da prancha' }).click();
await page.locator('#tb-project').fill('Casa de teste E2E');
await page.locator('#tb-project').press('Enter');
await page.locator('#tb-client').fill('Cliente E2E');
await page.locator('#tb-client').press('Enter');
await page.getByText('Fechar', { exact: true }).click();
s = await sheet0();
check('D4 carimbo editado no diálogo', s.titleBlock.project === 'Casa de teste E2E' && s.titleBlock.client === 'Cliente E2E');
await page.locator('.sheet-wrap').screenshot({ path: `${OUT}/02-aba-prancha.png` });

// 8. exportar PDF pelo botão da barra de título, capturando o download
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: 'Exportar PDF' }).click(),
]);
const pdfPath = path.join(OUT, 'pranchas.pdf');
await dl.saveAs(pdfPath);
const status = await page.evaluate(() => window.__hestia.useUi.getState().status);
// "térrea" no nome do projeto: o nome sai sem acento (com acento o navegador salvava como "download").
check('C4 download com o nome do projeto, sem acento', dl.suggestedFilename() === 'Casa terrea, 2 quartos-pranchas.pdf' && /-pranchas\.pdf/.test(status), `(${dl.suggestedFilename()})`);

// 9. validação do arquivo PDF
const bytes = readFileSync(pdfPath);
const txt = bytes.toString('latin1');
const add = check;
add('cabeçalho %PDF-1.4', txt.startsWith('%PDF-1.4\n'));
add('termina com %%EOF', /%%EOF\n?$/.test(txt));
const sx = /startxref\n(\d+)\n%%EOF/.exec(txt);
const xrefAt = sx ? Number(sx[1]) : -1;
add('startxref aponta para "xref"', xrefAt > 0 && txt.startsWith('xref\n', xrefAt));
const head = /xref\n0 (\d+)\n/.exec(txt.slice(xrefAt));
const size = head ? Number(head[1]) : 0;
let xrefOk = size > 1;
let badEntry = '';
const entries0 = xrefAt + (head ? head[0].length : 0);
for (let id = 1; id < size && xrefOk; id++) {
  const entry = txt.slice(entries0 + id * 20, entries0 + id * 20 + 20);
  const m = /^(\d{10}) 00000 n \n$/.exec(entry);
  if (!m || !txt.startsWith(`${id} 0 obj\n`, Number(m[1]))) { xrefOk = false; badEntry = `obj ${id}`; }
}
add('xref: cada offset aponta para "n 0 obj"', xrefOk, xrefOk ? `(${size - 1} objetos)` : `(falha em ${badEntry})`);
const pages = [...txt.matchAll(/\/Type \/Page\b/g)].length;
add('uma página por prancha', pages === (await proj()).sheets.length, `(${pages} página(s), ${(await proj()).sheets.length} prancha(s))`);
const media = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(txt);
const a3 = [420 * 72 / 25.4, 297 * 72 / 25.4];
add('página A3 paisagem (1190,55 × 841,89 pt)', !!media && Math.abs(Number(media[1]) - a3[0]) < 0.01 && Math.abs(Number(media[2]) - a3[1]) < 0.01, media ? `(${media[1]} × ${media[2]})` : '');
// Texto do carimbo e das vistas (Helvetica, WinAnsi): pdftotext precisa estar instalado.
const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
add('texto do carimbo extraído (projeto e cliente)', text.includes('Casa de teste E2E') && text.includes('Cliente E2E'));
// Traços da planta e do corte no conteúdo (operador S): a vista não sai vazia.
const strokes = (txt.match(/ S\n/g) ?? []).length;
add('vistas desenhadas no papel (traços)', strokes > 50, `(${strokes} traços)`);
// Raster: a página vira PNG para conferência visual (o arquivo é lido depois pelo olho do revisor).
execFileSync('pdftoppm', ['-r', '110', '-png', '-singlefile', pdfPath, path.join(OUT, 'prancha')]);
check('raster da página gerado', existsSync(path.join(OUT, 'prancha.png')), `(${path.join(OUT, 'prancha.png')})`);
writeFileSync(path.join(OUT, 'pranchas.txt'), text);

console.log('errors:', errors.length ? errors.join('\n') : 'none');
if (errors.length) fails++;
await browser.close();
console.log(fails ? `${fails} falha(s)` : 'todas as conferências passaram');
process.exit(fails ? 1 : 0);
