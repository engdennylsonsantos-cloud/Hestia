// Capturas do esmaecimento da planta no modo "Criar/Editar perímetro": compara DIM_AMOUNT em 0,60, 0,65, 0,70 e 0,88
// (valor antigo), com um esboço de piso retangular sobre a casa. Usa apps/web/dist (`npm run build`) e o Chromium de
// `CHROME_PATH`. As capturas vão para test-results/dim.
import { mkdirSync } from 'node:fs';
import { launch, openApp } from './helpers.mjs';

const OUT = 'test-results/dim';
mkdirSync(OUT, { recursive: true });

const VALORES = [
  { amount: 0.6, file: 'dim-060.png' },
  { amount: 0.65, file: 'dim-065.png' },
  { amount: 0.7, file: 'dim-070.png' },
  { amount: 0.88, file: 'dim-088.png' },
];

/** Abre o modo de piso com um retângulo dentro da casa e devolve o estado do esboço. */
const abrirEsboco = (page) => page.evaluate(() => {
  const { editor } = window.__hestia;
  editor.newProject('house2');
  editor.zoomExtents();
  const ws = Object.values(editor.project.elements).filter((e) => e.kind === 'wall');
  const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
  const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
  const x0 = Math.min(...xs) + 0.3, x1 = Math.max(...xs) - 0.3;
  const y0 = Math.min(...ys) + 0.3, y1 = Math.max(...ys) - 0.3;
  editor.setTool('floor');
  const segs = [
    { id: 'sul', a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
    { id: 'leste', a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
    { id: 'norte', a: { x: x1, y: y1 }, b: { x: x0, y: y1 } },
    { id: 'oeste', a: { x: x0, y: y1 }, b: { x: x0, y: y0 } },
  ];
  editor.activeTool.loadDraft({ target: 'floor', segs, selected: [], defaults: { definesSlope: false, slopePct: 0, overhang: 0 } });
  editor.zoomExtents();
  const v = editor.perimetro.view();
  return { ativo: v.active, segs: v.draft?.segs.length ?? 0, caixa: { x0, x1, y0, y1 } };
});

/**
 * Luminância média do canvas e quantidade de pixels no rosa cheio do esboço. Se o esmaecimento atingisse o esboço, o
 * rosa viraria cinza e a contagem cairia a zero.
 */
const analisar = async (page) => {
  const shot = await page.locator('.canvas-wrap').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const rosa = [[194, 24, 91], [255, 111, 176]];
    let soma = 0;
    let rosaCheio = 0;
    for (let i = 0; i < d.length; i += 4) {
      soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      for (const [r, gg, b] of rosa) {
        if (Math.abs(d[i] - r) < 24 && Math.abs(d[i + 1] - gg) < 24 && Math.abs(d[i + 2] - b) < 24) {
          rosaCheio++;
          break;
        }
      }
    }
    return { luminancia: soma / (d.length / 4), rosaCheio };
  }, shot.toString('base64'));
};

const browser = await launch();
const resultados = [];
let falhou = false;

for (const { amount, file } of VALORES) {
  const { page, errors } = await openApp(browser);
  await page.evaluate((v) => { window.__hestiaDimAmount = v; }, amount);
  const esboco = await abrirEsboco(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${file}` });
  const a = await analisar(page);
  const okEsboco = esboco.ativo && esboco.segs === 4;
  const okRosa = a.rosaCheio > 100;
  if (!okEsboco || !okRosa || errors.length) falhou = true;
  resultados.push({ amount, file, ...a, ...esboco });
  console.log(
    `${okEsboco && okRosa && !errors.length ? 'OK  ' : 'FALHA'} ${file}  DIM_AMOUNT=${amount.toFixed(2)}` +
    `  lum=${a.luminancia.toFixed(1)}  rosaCheio=${a.rosaCheio}px  esboço=${esboco.segs} linhas` +
    `${errors.length ? `  erros: ${errors.join(' | ')}` : ''}`,
  );
  await page.close();
}

await browser.close();

// Mais esmaecimento = planta mais clara. A ordem tem de ser estrita entre os valores comparados.
for (let i = 1; i < resultados.length; i++) {
  const antes = resultados[i - 1];
  const depois = resultados[i];
  const ok = depois.luminancia > antes.luminancia;
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${antes.file} (${antes.luminancia.toFixed(1)}) < ${depois.file} (${depois.luminancia.toFixed(1)})`);
  if (!ok) falhou = true;
}

process.exit(falhou ? 1 : 0);
