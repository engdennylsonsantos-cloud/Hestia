import path from 'node:path';
import { launch, openApp } from './helpers.mjs';

const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');
const OUT = 'test-results/prancha-editor';
const browser = await launch();
const { page } = await openApp(browser);
await page.setInputFiles('#file-open', FIXTURE);
await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const { editor, useUi } = window.__hestia;
  const p = editor.project;
  const lv = p.levels[0].id;
  const sec = p.views[0];
  const vps = [
    { id: 'vp1', view: { kind: 'plan', levelId: lv }, at: { x: 22, y: 96 }, size: { w: 196, h: 170 }, scale: 100, title: 'Planta baixa — térreo' },
    { id: 'vp2', view: { kind: 'plan', levelId: lv }, at: { x: 232, y: 120 }, size: { w: 158, h: 120 }, scale: 150, title: 'Planta — recorte' },
  ];
  editor.store.exec({
    type: 'addSheet',
    sheet: {
      id: 'sh_show', number: 'A-101', name: 'Planta baixa', size: 'A3', orientation: 'landscape', margin: 10,
      discipline: 'Arquitetura',
      titleBlock: { project: 'Casa térrea — 2 quartos', client: 'Cliente', author: 'Equipe Hestia', date: '30/10/2026', revision: 'B' },
      revisions: [
        { tag: 'A', date: '12/10/2026', description: 'Emissão inicial' },
        { tag: 'B', date: '30/10/2026', description: 'Ajuste do layout' },
      ],
      viewports: vps,
    },
  });
  useUi.setState({ view: 'sheet', sheetId: 'sh_show' });
});
await page.waitForSelector('.sheet-stage svg');
await page.waitForTimeout(600);

// Prévia do arraste do navegador para a prancha (retângulo tracejado + escala) e captura.
const caixa = await page.locator('.sheet-stage').boundingBox();
const alvo = { x: caixa.x + caixa.width * 0.63, y: caixa.y + caixa.height * 0.52 };
await page.evaluate(({ x, y }) => {
  const node = document.querySelector('[data-node^="plan:"]');
  const stage = document.querySelector('.sheet-stage');
  const dt = new DataTransfer();
  node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  stage.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
}, alvo);
await page.waitForTimeout(350);
await page.locator('.sheet-stage').screenshot({ path: path.join(OUT, 'showcase-arraste.png') });
await page.evaluate(() => {
  const node = document.querySelector('[data-node^="plan:"]');
  node.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
});
await page.waitForTimeout(200);

const pt = await page.evaluate(() => {
  const s = document.querySelector('.sheet-stage svg');
  const p = s.createSVGPoint();
  p.x = 120;
  p.y = 297 - 180;
  const q = p.matrixTransform(s.getScreenCTM());
  return { x: q.x, y: q.y };
});
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(400);
await page.locator('.sheet-stage').screenshot({ path: path.join(OUT, 'showcase-prancha.png') });

// Ferramenta Alinhar: referência numa face desenhada e fantasma do alvo na outra vista.
await page.getByRole('button', { name: /^Alinhar pela moldura/ }).click();
await page.waitForTimeout(300);
const faceAlvo = await page.evaluate(() => {
  const svg = document.querySelector('.sheet-stage svg');
  const layer = document.querySelector('[data-vp-layer="vp1"]');
  if (!svg || !layer) return null;
  const inv = svg.getScreenCTM()?.inverse();
  for (const p of layer.querySelectorAll('path')) {
    const nums = ((p.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 3 < nums.length; i += 2) {
      const [x1, y1, x2, y2] = [nums[i], nums[i + 1], nums[i + 2], nums[i + 3]];
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
      if (Math.abs(x1 - x2) < 0.01 && Math.abs(y2 - y1) > 20) {
        const ctm = p.getScreenCTM();
        if (!ctm || !inv) continue;
        const q = svg.createSVGPoint();
        q.x = x1;
        q.y = (y1 + y2) / 2;
        const s = q.matrixTransform(ctm);
        return { x: s.x, y: s.y };
      }
    }
  }
  return null;
});
if (faceAlvo) {
  await page.mouse.click(faceAlvo.x, faceAlvo.y);
  await page.waitForTimeout(250);
  // passa o mouse sobre a vista 2 para o fantasma do alvo aparecer
  const vp2 = await page.evaluate(() => window.__hestia.editor.project.sheets.find((s) => s.id === 'sh_show').viewports[1]);
  if (vp2) {
    const alvo = await page.evaluate(([x, y]) => {
      const s = document.querySelector('.sheet-stage svg');
      const p = s.createSVGPoint();
      p.x = x;
      p.y = 297 - y;
      const q = p.matrixTransform(s.getScreenCTM());
      return { x: q.x, y: q.y };
    }, [vp2.at.x, vp2.at.y + vp2.size.h / 2]);
    await page.mouse.move(alvo.x, alvo.y);
    await page.waitForTimeout(300);
  }
}
await page.locator('.sheet-stage').screenshot({ path: path.join(OUT, 'showcase-alinhar.png') });

// Ferramenta Mover: ponto base numa face e fantasma no destino.
await page.evaluate(() => window.__hestia.useUi.setState({ sheetAlign: false, sheetMove: true, selection: [] }));
await page.waitForTimeout(250);
const vp1m = await page.evaluate(() => window.__hestia.editor.project.sheets.find((s) => s.id === 'sh_show').viewports[0]);
const pBase = await page.evaluate(([x, y]) => {
  const s = document.querySelector('.sheet-stage svg');
  const p = s.createSVGPoint();
  p.x = x;
  p.y = 297 - y;
  const q = p.matrixTransform(s.getScreenCTM());
  return { x: q.x, y: q.y };
}, [vp1m.at.x + vp1m.size.w / 2, vp1m.at.y + vp1m.size.h / 2]);
await page.mouse.click(pBase.x, pBase.y);
await page.waitForTimeout(200);
await page.mouse.click(pBase.x, pBase.y);
await page.waitForTimeout(200);
await page.mouse.move(pBase.x + 150, pBase.y - 60);
await page.waitForTimeout(300);
await page.locator('.sheet-stage').screenshot({ path: path.join(OUT, 'showcase-mover.png') });
await page.screenshot({ path: path.join(OUT, 'showcase-janela.png') });
await browser.close();
console.log('ok');
