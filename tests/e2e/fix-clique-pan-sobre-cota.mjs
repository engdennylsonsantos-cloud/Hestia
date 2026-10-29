// Pan com o botao do meio comecando sobre a cota dinamica da parede. Uso: node tests/e2e/fix-clique-pan-sobre-cota.mjs <url>
import { chromium } from 'playwright-core';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto(process.argv[2] + '/?debug=1');
await page.waitForFunction(() => window.__hestia); await page.waitForTimeout(1500);
await page.evaluate(() => { const {editor}=window.__hestia; editor.newProject('house2'); editor.zoomExtents(); editor.setTool('select'); editor.setTool('wall'); });
const box = await page.locator('.canvas-wrap').boundingBox();
await page.mouse.move(box.x+300, box.y+200); await page.mouse.click(box.x+300, box.y+200);
await page.mouse.move(box.x+500, box.y+200, {steps:5}); await page.waitForTimeout(150);
const cx = () => page.evaluate(() => window.__hestia.editor.viewport().cx);
const c0 = await cx();
// Pan com botao do meio comecando sobre a alca: seu inicio fica na ponta viva (debaixo do cursor)
await page.mouse.down({ button: 'middle' });
for (let k=1;k<=10;k++) await page.mouse.move(box.x+500+k*10, box.y+200);
await page.mouse.up({ button: 'middle' });
console.log('pan comecando sobre a cota: dx do centro =', (await cx()) - c0);
await b.close();
