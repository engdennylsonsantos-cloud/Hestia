import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
for (const id of ['house2', 'predio10']) {
  await page.goto(`file:///C:/Users/Dennylson/Desktop/programas/Hestia/_local/preview-${id}.svg`);
  await page.screenshot({ path: `C:/Users/Dennylson/Desktop/programas/Hestia/_local/preview-${id}.png`, fullPage: true });
}
await browser.close();
console.log('ok');
