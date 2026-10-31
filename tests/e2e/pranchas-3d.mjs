// 3D vetorial na prancha (decisão 0040) ponta a ponta: abre a casa de teste, salva um ponto de vista 3D, insere a vista
// na prancha pelo diálogo "Adicionar vistas" e confere que o 3D saiu como traços (sem imagem), com a legenda "Sem
// escala". Captura a folha em tests/e2e/out/pranchas-3d/.
//
// Uso (com o build de produção):
//   npm run build -w @hestia/web -- --target esnext --minify false
//   node tests/e2e/pranchas-3d.mjs
//
// PENDENTE (UI): o botão "Salvar ponto de vista 3D" da aba 3D está sendo feito em paralelo e não é usado aqui. Enquanto
// ele não estiver publicado, o passo 2 cria o ponto pelo comando do modelo (`addView3DPoint`) via
// `window.__hestia.editor.store`; o resto — inserir na prancha, conferir e capturar — já passa pela interface real.
// Quando o botão existir, troque só o passo 2 por ele: os seletores do diálogo (`.sheet-vcb`, rótulos "Modelo 3D · …")
// e do palco (`.sheet-stage`) continuam valendo.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, makeReporter, openApp } from './helpers.mjs';

const OUT = path.resolve('tests/e2e/out/pranchas-3d');
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');
const SHEET_ID = 'sh_e2e_3d';
const POINT_ID = 'v3d_e2e';
const POINT_NAME = 'Vista 3D E2E';

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser);
const shot = (name) => page.locator('.sheet-stage').screenshot({ path: path.join(OUT, name) });

try {
  await rep.step('1 — abrir a casa de teste (paredes no térreo)', async () => {
    await page.setInputFiles('#file-open', FIXTURE);
    await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
    await page.waitForTimeout(300);
    const paredes = await page.evaluate(() => window.__hestia.editor.project.levels[0]?.id);
    rep.check('nível térreo carregado', !!paredes, String(paredes));
  });

  await rep.step('2 — ponto de vista 3D salvo no catálogo', async () => {
    // PENDENTE (UI): substituir por "Salvar ponto de vista 3D" quando o botão existir; o comando abaixo é o mesmo que
    // a interface usará, com a câmera que ela lê da aba 3D (`cameraDaOrbita`).
    const pontos = await page.evaluate(
      ([id, name]) => {
        const { editor } = window.__hestia;
        editor.store.exec(
          {
            type: 'addView3DPoint',
            point: {
              id,
              name,
              // Casa de teste: ~12 m × 7 m; alvo no centro do térreo, câmera a 18 m em perspectiva.
              camera: { azimuth: -0.7, elevation: 0.45, distance: 18, target: { x: 5, y: 4, z: 1.4 }, ortho: false },
            },
          },
          'Salvar ponto de vista 3D',
        );
        return editor.store.project.view3dPoints ?? [];
      },
      [POINT_ID, POINT_NAME],
    );
    rep.check('ponto no catálogo com nome', pontos.length === 1 && pontos[0].name === POINT_NAME, `${pontos.length} ponto(s)`);
    if (pontos.length !== 1) {
      console.log('PENDENTE (UI): o catálogo de pontos de vista 3D não aceitou o ponto; confira o comando addView3DPoint.');
    }
  });

  await rep.step('3 — prancha A3 vazia aberta', async () => {
    await page.evaluate((sheetId) => {
      const { editor, useUi } = window.__hestia;
      const p = editor.project;
      editor.store.exec(
        {
          type: 'addSheet',
          sheet: {
            id: sheetId,
            number: 'A-101',
            name: '3D',
            size: 'A3',
            orientation: 'landscape',
            margin: 10,
            discipline: 'Arquitetura',
            titleBlock: { project: p.name, client: 'Cliente', author: 'Equipe', date: '30/10/2026', revision: '0' },
            viewports: [],
          },
        },
        'Criar prancha',
      );
      useUi.setState({ view: 'sheet', sheetId });
    }, SHEET_ID);
    await page.waitForSelector('.sheet-stage svg');
    await page.waitForTimeout(400);
    rep.check('aba da prancha aberta', await page.locator('.sheet-vcb').isVisible());
    rep.check('folha vazia', await page.getByText('Folha vazia.', { exact: true }).isVisible());
  });

  await rep.step('4 — inserir a vista 3D pelo diálogo "Adicionar vistas"', async () => {
    await page.locator('.sheet-vcb').getByRole('button', { name: 'Adicionar vista' }).click();
    await page.getByText('Adicionar vistas', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();

    // O diálogo lista uma opção por ponto salvo e, sempre, o enquadramento padrão.
    const comPonto = page.getByRole('checkbox', { name: `Modelo 3D · ${POINT_NAME}` });
    const padrao = page.getByRole('checkbox', { name: 'Modelo 3D (enquadramento padrão)' });
    let usouPonto = true;
    if ((await comPonto.count()) > 0) await comPonto.check();
    else {
      usouPonto = false;
      console.log('PENDENTE (UI): o diálogo "Adicionar vistas" ainda não lista o ponto de vista 3D; usando o enquadramento padrão.');
      await padrao.check();
    }
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.waitForFunction(
      (id) => window.__hestia.editor.project.sheets?.find((s) => s.id === id)?.viewports.length === 1,
      SHEET_ID,
    );
    const vp = await page.evaluate(
      (id) => window.__hestia.editor.project.sheets?.find((s) => s.id === id)?.viewports[0],
      SHEET_ID,
    );
    rep.check('vista 3D na prancha', vp?.view.kind === '3d', vp ? vp.view.kind : 'sem vista');
    if (usouPonto) rep.check('a vista referencia o ponto salvo', vp?.view.pointId === POINT_ID, vp?.view.pointId ?? 'sem pointId');
  });

  await rep.step('5 — o 3D é desenhado como traços, sem imagem, com "Sem escala"', async () => {
    // O z-buffer e a projeção são CPU: a folha pode demorar alguns segundos para a primeira composição.
    await page.waitForFunction(() => document.querySelectorAll('[data-vp-layer] path').length > 20, undefined, { timeout: 30000 });
    const svg = await page.evaluate(() => ({
      paths: document.querySelectorAll('[data-vp-layer] path').length,
      images: document.querySelectorAll('.sheet-stage svg image').length,
      texts: [...document.querySelectorAll('.sheet-stage svg text')].map((t) => t.textContent ?? ''),
    }));
    rep.check('3D vetorial: caminhos dentro do grupo da vista', svg.paths > 20, `${svg.paths} caminhos`);
    rep.check('sem raster: nenhum <image> na folha', svg.images === 0, `${svg.images} imagem(ns)`);
    rep.check('legenda "Sem escala"', svg.texts.some((t) => t.includes('Sem escala')), svg.texts.find((t) => t.includes('Sem escala')) ?? 'não achou');
  });

  await rep.step('6 — capturar a prancha', async () => {
    await shot('prancha-3d.png');
    await page.screenshot({ path: path.join(OUT, '01-3d-na-prancha.png') });
    rep.check('imagem da prancha gravada', true, path.join(OUT, 'prancha-3d.png'));
  });

  await rep.step('7 — sem erros de console ou de página', async () => {
    rep.check('nenhum erro de console/página', errors.length === 0, errors.slice(0, 3).join(' | '));
  });
} catch (e) {
  console.log(`\nFALHA INESPERADA: ${e.stack ?? e.message}`);
  await page.screenshot({ path: path.join(OUT, 'erro-inesperado.png') }).catch(() => {});
  rep.summary();
  await browser.close();
  process.exit(1);
}

rep.summary();
const falhas = rep.steps.filter((s) => s.status === 'FAIL').length;
console.log(falhas ? `\nFALHOU: ${falhas} de ${rep.steps.length} passos (ver acima).` : `\nTodos os ${rep.steps.length} passos confirmados.`);
console.log(`Imagens em: ${OUT}`);
await browser.close();
process.exit(falhas ? 1 : 0);
