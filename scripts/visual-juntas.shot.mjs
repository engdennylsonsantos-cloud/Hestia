// Converte os SVG de scripts/visual-juntas.mts em PNG (mesmo nome, extensão .png) usando o chromium já instalado.
// Não roda `playwright install`: usa o executável em CHROMIUM_PATH (padrão /opt/pw-browsers/chromium).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const OUT =
  process.env.JUNTAS_OUT ??
  '/tmp/claude-0/-home-user/fa79fa58-c26d-5470-9f7b-65480dd9e844/scratchpad/juntas';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const svgs = readdirSync(OUT).filter((f) => f.endsWith('.svg')).sort();
if (svgs.length === 0) {
  console.error(`nenhum .svg em ${OUT}; rode antes scripts/visual-juntas.mts`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
try {
  for (const nome of svgs) {
    const svg = readFileSync(join(OUT, nome), 'utf8');
    const m = /<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/.exec(svg);
    const largura = Number(m?.[1] ?? 1600);
    const altura = Number(m?.[2] ?? 650);
    const page = await browser.newPage({
      viewport: { width: largura, height: altura },
      deviceScaleFactor: 2,
    });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head>` +
      `<body style="margin:0;background:#fff">${svg}</body></html>`);
    const png = join(OUT, nome.replace(/\.svg$/, '.png'));
    await page.locator('svg').first().screenshot({ path: png });
    await page.close();
    console.log(`PNG ${png}`);
  }
} finally {
  await browser.close();
}
