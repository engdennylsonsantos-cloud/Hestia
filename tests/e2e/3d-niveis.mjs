// Níveis de referência no 3D: botão só de ícone na barra, mostrar/ocultar e claro/escuro do datum.
// Roteiro com asserções; código de saída 1 se algo falhar.
import { abreVista3d, launch, makeReporter, openApp } from './helpers.mjs';

const browser = await launch();
const { page, errors } = await openApp(browser, { query: '?debug=1' });
const rep = makeReporter();
const check = rep.check.bind(rep);

const estadoNiveis = () => page.evaluate(() => {
  const m = window.__hestia3dModel;
  const info = m?.niveis;
  const v = info?.userData?.views?.[0];
  return {
    grupos: m?.niveis3d?.children?.length ?? -1,
    views: info?.userData?.views?.length ?? 0,
    rotacao: v ? v.text.material.rotation : null,
    corLinha: v?.line?.material?.color?.getHexString?.() ?? null,
    tema: document.documentElement.getAttribute('data-theme'),
    showLevels: window.__hestia.editor.project.view3d?.showLevels,
  };
});

await rep.step('abrir 3D e esperar a montagem dos níveis', async () => {
  await page.evaluate(() => { window.__hestia.editor.newProject('house2'); window.__hestia.editor.zoomExtents(); });
  await abreVista3d(page);
  await page.waitForFunction(() => window.__hestia3dMontagem && window.__hestia3dMontagem.montados === window.__hestia.editor.project.levels.length, null, { timeout: 60000 });
  const s = await estadoNiveis();
  check('datum montado', s.grupos === 1 && s.views >= 2, JSON.stringify(s));
  check('texto do nível paralelo à linha (rotação calculada)', s.rotacao !== null && Math.abs(s.rotacao) <= Math.PI / 2, String(s.rotacao));
});

await rep.step('tema claro por padrão e datum escuro no tema escuro', async () => {
  check('inicia em claro', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light');
  await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'dark' }));
  await page.waitForTimeout(300);
  const escuro = await estadoNiveis();
  check('tema escuro aplicado', escuro.tema === 'dark');
  check('linha do datum usa a cor clara do tema escuro', escuro.corLinha === 'cbd5e1', String(escuro.corLinha));
  await page.evaluate(() => window.__hestia.useUi.setState({ theme: 'light' }));
  await page.waitForTimeout(300);
  const claro = await estadoNiveis();
  check('linha do datum usa a cor escura do tema claro', claro.corLinha === '374151', String(claro.corLinha));
});

await rep.step('botão só de ícone mostra e oculta os níveis de referência', async () => {
  const botao = page.getByRole('button', { name: 'Mostrar/ocultar níveis de referência' });
  check('botão existe na barra do 3D', (await botao.count()) === 1);
  check('botão não tem texto visível', (await botao.innerText()).trim() === '');
  await botao.click();
  await page.waitForTimeout(300);
  const oculto = await estadoNiveis();
  check('níveis ocultos: grupo vazio', oculto.grupos === 0, JSON.stringify(oculto));
  check('showLevels=false gravado no projeto', oculto.showLevels === false);
  await botao.click();
  await page.waitForTimeout(300);
  const visivel = await estadoNiveis();
  check('níveis voltam ao clicar de novo', visivel.grupos === 1 && visivel.views >= 2, JSON.stringify(visivel));
  check('showLevels=true gravado no projeto', visivel.showLevels === true);
});

await rep.step('sem erros de página', async () => {
  check('nenhum pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));
});

rep.summary();
await browser.close();
process.exit(rep.steps.some((s) => s.status === 'FAIL') ? 1 : 0);
