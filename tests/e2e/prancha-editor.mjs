// Editor de layout da prancha ponta a ponta: abre uma folha com duas vistas e exercita a câmera (zoom no cursor e
// pan), o arraste, as alças de redimensionar o recorte, o pan do conteúdo (Alt), a troca de escala com moldura
// automática, o alinhamento e os atalhos. Roda no build de produção:
//   npm run build -w @hestia/web -- --target esnext --minify false && node tests/e2e/prancha-editor.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch, makeReporter, openApp } from './helpers.mjs';

const OUT = process.env.SHOTS ?? 'test-results/prancha-editor';
mkdirSync(OUT, { recursive: true });
const FIXTURE = path.resolve('packages/engine/src/fixtures/casa-2-quartos.hestia.json');
const H = 297;

const rep = makeReporter();
const browser = await launch();
const { page, errors } = await openApp(browser);

const sheet = (id = 'sh_e2e') =>
  page.evaluate((sheetId) => {
    const s = window.__hestia.editor.project.sheets?.find((x) => x.id === sheetId);
    return s
      ? {
          number: s.number,
          viewports: s.viewports.map((v) => ({
            id: v.id,
            at: v.at,
            size: v.size,
            scale: v.scale,
            offset: v.offset ?? null,
            anchor: v.anchor ?? null,
            clip: v.clip !== false,
            locked: v.locked === true,
            labelShow: v.label?.show !== false,
            frame: v.frame !== false,
          })),
        }
      : null;
  }, id);

const viewBox = () =>
  page.evaluate(() => {
    const vb = document.querySelector('.sheet-stage svg')?.getAttribute('viewBox') ?? '';
    const [x, y, w, h] = vb.split(' ').map(Number);
    return { x, y, w, h };
  });

/** Ponto de papel (mm, y para cima) para coordenada de tela. */
const toScreen = (x, y) =>
  page.evaluate(
    ([px, py, h]) => {
      const svg = document.querySelector('.sheet-stage svg');
      const p = svg.createSVGPoint();
      p.x = px;
      p.y = h - py;
      const q = p.matrixTransform(svg.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    [x, y, H],
  );

const drag = async (from, to, opts = {}) => {
  if (opts.alt) await page.keyboard.down('Alt');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) * 0.4, from.y + (to.y - from.y) * 0.4, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  if (opts.alt) await page.keyboard.up('Alt');
  await page.waitForTimeout(160);
};

const clickPaper = async (x, y, opts = {}) => {
  const s = await toScreen(x, y);
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.click(s.x, s.y);
  if (opts.shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(140);
};

try {
  await rep.step('0 — abrir a casa e montar uma prancha com duas vistas', async () => {
    await page.setInputFiles('#file-open', FIXTURE);
    await page.waitForFunction(() => window.__hestia.editor.fileName === 'casa-2-quartos.hestia.json');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const { editor, useUi } = window.__hestia;
      const p = editor.project;
      const lv = p.levels[0].id;
      editor.store.exec(
        {
          type: 'addSheet',
          sheet: {
            id: 'sh_e2e',
            number: 'A-101',
            name: 'Planta baixa',
            size: 'A3',
            orientation: 'landscape',
            margin: 10,
            discipline: 'Arquitetura',
            titleBlock: { project: p.name, client: 'Cliente', author: 'Equipe', date: '30/10/2026', revision: '0' },
            revisions: [{ tag: '0', date: '30/10/2026', description: 'Emissão inicial' }],
            viewports: [
              { id: 'vp1', view: { kind: 'plan', levelId: lv }, at: { x: 20, y: 20 }, size: { w: 180, h: 130 }, scale: 100 },
              { id: 'vp2', view: { kind: 'plan', levelId: lv }, at: { x: 230, y: 20 }, size: { w: 150, h: 110 }, scale: 200 },
            ],
          },
        },
        'Prancha de teste',
      );
      useUi.setState({ view: 'sheet', sheetId: 'sh_e2e' });
    });
    await page.waitForSelector('.sheet-stage svg');
    await page.waitForTimeout(500);
    const s = await sheet();
    rep.check('a prancha existe com duas vistas', s?.viewports.length === 2, JSON.stringify(s?.viewports.map((v) => v.id)));
    rep.check('a barra da prancha aparece', await page.locator('.sheet-vcb').isVisible());
    const vb = await viewBox();
    rep.check('a folha está enquadrada (viewBox maior que a folha)', vb.w >= 420, JSON.stringify(vb));
  });

  await rep.step('1 — roda do mouse dá zoom no ponto sob o cursor', async () => {
    const before = await viewBox();
    const box = await page.locator('.sheet-stage').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(250);
    const after = await viewBox();
    rep.check('o viewBox encolhe ao aproximar', after.w < before.w - 1, `${before.w.toFixed(1)} → ${after.w.toFixed(1)}`);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(250);
    const back = await viewBox();
    rep.check('afastar volta perto do enquadramento', Math.abs(back.w - before.w) < before.w * 0.15, `${back.w.toFixed(1)} vs ${before.w.toFixed(1)}`);
    await page.keyboard.press('z');
    await page.waitForTimeout(200);
  });

  await rep.step('2 — clique seleciona e arraste move a vista', async () => {
    await clickPaper(110, 85);
    const s0 = await sheet();
    const vp = s0.viewports.find((v) => v.id === 'vp1');
    const from = await toScreen(110, 85);
    await drag(from, { x: from.x + 60, y: from.y - 40 });
    const s1 = await sheet();
    const v1 = s1.viewports.find((v) => v.id === 'vp1');
    rep.check('a vista andou para a direita', v1.at.x > vp.at.x + 1, `${vp.at.x.toFixed(1)} → ${v1.at.x.toFixed(1)}`);
    rep.check('a vista andou para cima (y do papel cresce)', v1.at.y > vp.at.y + 1, `${vp.at.y.toFixed(1)} → ${v1.at.y.toFixed(1)}`);
    rep.check('o tamanho não mudou ao mover', v1.size.w === vp.size.w && v1.size.h === vp.size.h);
  });

  await rep.step('3 — as oito alças redimensionam o recorte', async () => {
    const s0 = await sheet();
    const v = s0.viewports.find((x) => x.id === 'vp1');
    await clickPaper(v.at.x + v.size.w / 2, v.at.y + v.size.h / 2);
    rep.check('as 8 alças aparecem na vista selecionada', (await page.locator('[data-handles] rect').count()) === 8, String(await page.locator('[data-handles] rect').count()));
    const se = await toScreen(v.at.x + v.size.w, v.at.y);
    await drag(se, { x: se.x + 55, y: se.y + 25 });
    const s1 = await sheet();
    const v1 = s1.viewports.find((x) => x.id === 'vp1');
    rep.check('a largura cresceu com o canto sudeste', v1.size.w > v.size.w + 1, `${v.size.w.toFixed(1)} → ${v1.size.w.toFixed(1)}`);
    rep.check('a altura cresceu com o canto sudeste', v1.size.h > v.size.h + 1, `${v.size.h.toFixed(1)} → ${v1.size.h.toFixed(1)}`);
    rep.check('a escala não mudou ao redimensionar', v1.scale === v.scale);
  });

  await rep.step('4 — Alt+arrastar move o conteúdo dentro da moldura', async () => {
    const s0 = await sheet();
    const v = s0.viewports.find((x) => x.id === 'vp1');
    const c = await toScreen(v.at.x + v.size.w / 2, v.at.y + v.size.h / 2);
    await drag(c, { x: c.x + 50, y: c.y }, { alt: true });
    const s1 = await sheet();
    const v1 = s1.viewports.find((x) => x.id === 'vp1');
    const centroAntes = { x: v.at.x + v.size.w / 2, y: v.at.y + v.size.h / 2 };
    rep.check('o pan do conteúdo gravou a âncora', v1.anchor !== null && (Math.abs(v1.anchor.x - centroAntes.x) > 0.5 || Math.abs(v1.anchor.y - centroAntes.y) > 0.5), JSON.stringify(v1.anchor));
    rep.check('a moldura não se moveu no pan do conteúdo', Math.abs(v1.at.x - v.at.x) < 0.001 && Math.abs(v1.at.y - v.at.y) < 0.001);
  });

  await rep.step('5 — trocar a escala com "moldura automática" reenquadra o desenho', async () => {
    const s0 = await sheet();
    const v = s0.viewports.find((x) => x.id === 'vp1');
    await clickPaper(v.at.x + v.size.w / 2, v.at.y + v.size.h / 2);
    await page.locator('.sheet-vcb select[aria-label="Escala da vista"]').selectOption('50');
    await page.waitForTimeout(300);
    const s1 = await sheet();
    const v1 = s1.viewports.find((x) => x.id === 'vp1');
    rep.check('a escala gravou 1:50', v1.scale === 50, String(v1.scale));
    rep.check('a moldura cresceu para caber o desenho maior', v1.size.w > v.size.w, `${v.size.w.toFixed(1)} → ${v1.size.w.toFixed(1)}`);
    rep.check('a vista continua dentro da folha', v1.at.x + v1.size.w <= 410.0001 && v1.at.y + v1.size.h <= 287.0001, JSON.stringify(v1));
  });

  await rep.step('6 — seleção múltipla e alinhar à esquerda (um passo de desfazer)', async () => {
    const s0 = await sheet();
    const a = s0.viewports.find((x) => x.id === 'vp1');
    const b = s0.viewports.find((x) => x.id === 'vp2');
    await clickPaper(a.at.x + a.size.w / 2, a.at.y + a.size.h / 2);
    await clickPaper(b.at.x + b.size.w / 2, b.at.y + b.size.h / 2, { shift: true });
    await page.getByRole('button', { name: 'Alinhar as vistas selecionadas à esquerda' }).click();
    await page.waitForTimeout(250);
    const s1 = await sheet();
    const a1 = s1.viewports.find((x) => x.id === 'vp1');
    const b1 = s1.viewports.find((x) => x.id === 'vp2');
    rep.check('as duas vistas ficaram com o mesmo x', Math.abs(a1.at.x - b1.at.x) < 0.01, `${a1.at.x} vs ${b1.at.x}`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const s2 = await sheet();
    const b2 = s2.viewports.find((x) => x.id === 'vp2');
    rep.check('Ctrl+Z devolve a posição da segunda vista', Math.abs(b2.at.x - b.at.x) < 0.01, `${b.at.x} → ${b2.at.x}`);
  });

  await rep.step('7 — recorte, legenda e trava pela barra', async () => {
    const s0 = await sheet();
    const v = s0.viewports.find((x) => x.id === 'vp2');
    await clickPaper(v.at.x + v.size.w / 2, v.at.y + v.size.h / 2);
    await page.getByRole('button', { name: 'Recorta o desenho à moldura (Revit: Crop View)' }).click();
    await page.waitForTimeout(150);
    let s1 = await sheet();
    rep.check('desligar o recorte grava clip=false', s1.viewports.find((x) => x.id === 'vp2').clip === false);
    await page.getByRole('button', { name: 'Mostra a legenda da vista' }).click();
    await page.waitForTimeout(150);
    s1 = await sheet();
    rep.check('esconder a legenda grava label.show=false', s1.viewports.find((x) => x.id === 'vp2').labelShow === false);
    await page.getByRole('button', { name: 'Trava a vista: não se move nem se redimensiona' }).click();
    await page.waitForTimeout(150);
    s1 = await sheet();
    rep.check('travar a vista grava locked=true', s1.viewports.find((x) => x.id === 'vp2').locked === true);
  });

  await rep.step('8 — setas movem 1 mm e Shift+seta 10 mm; tecla Delete remove', async () => {
    const s0 = await sheet();
    const v = s0.viewports.find((x) => x.id === 'vp1');
    await clickPaper(v.at.x + v.size.w / 2, v.at.y + v.size.h / 2);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    let s1 = await sheet();
    const v1 = s1.viewports.find((x) => x.id === 'vp1');
    rep.check('seta direita move 1 mm', Math.abs(v1.at.x - (v.at.x + 1)) < 0.01, `${v.at.x} → ${v1.at.x}`);
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(150);
    s1 = await sheet();
    const v2 = s1.viewports.find((x) => x.id === 'vp1');
    rep.check('Shift+seta acima move 10 mm', Math.abs(v2.at.y - (v1.at.y + 10)) < 0.01, `${v1.at.y} → ${v2.at.y}`);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    const s2 = await sheet();
    rep.check('Delete remove a vista selecionada', s2.viewports.length === 1, JSON.stringify(s2.viewports.map((x) => x.id)));
  });

  await rep.step('9 — diálogos de vista, prancha e publicação', async () => {
    await page.getByRole('button', { name: 'Adiciona uma planta, corte ou 3D a esta prancha' }).click();
    await page.waitForTimeout(250);
    rep.check('o diálogo de adicionar vistas abre com marcações', (await page.locator('.dialog input[type=checkbox]').count()) >= 2, String(await page.locator('.dialog input[type=checkbox]').count()));
    rep.check('a escala automática é a padrão', (await page.locator('#av-scale').inputValue()) === 'auto');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'Propriedades da prancha (folha, carimbo, revisões)' }).click();
    await page.waitForTimeout(250);
    const texto = await page.locator('.dialog').innerText();
    rep.check('as propriedades mostram disciplina e revisões', /Disciplina/.test(texto) && /Revisõ/.test(texto), texto.slice(0, 120).replace(/\n/g, ' | '));
    // A3 → A2 reencaixa as vistas em vez de recusar (0039).
    await page.locator('#sh-size').selectOption('A2');
    await page.waitForTimeout(300);
    const maior = await page.evaluate(() => {
      const s = window.__hestia.editor.project.sheets.find((x) => x.id === 'sh_e2e');
      return { size: s.size, dentro: s.viewports.every((v) => v.at.x + v.size.w <= 594 - 10 + 0.001 && v.at.y + v.size.h <= 420 - 10 + 0.001) };
    });
    rep.check('trocar para A2 reencaixa as vistas', maior.size === 'A2' && maior.dentro, JSON.stringify(maior));
    await page.locator('.dialog').getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    rep.check('desfazer volta a folha para A3', await page.evaluate(() => window.__hestia.editor.project.sheets.find((x) => x.id === 'sh_e2e').size === 'A3'));
    await page.waitForTimeout(200);

    await page.evaluate(() => window.__hestia.useUi.setState({ dialog: 'publish', dialogArg: null }));
    await page.waitForTimeout(300);
    rep.check('publicar lista as pranchas do projeto', (await page.locator('.pub-item').count()) >= 1, String(await page.locator('.pub-item').count()));
    rep.check('o nome base começa com o nome do projeto', (await page.locator('#pub-base').inputValue()).length > 0);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(200);
    rep.check('sem erros no console do navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await rep.step('10 — arrastar uma vista do navegador para a prancha', async () => {
    const antes = await sheet();
    const stage = page.locator('.sheet-stage');
    const box = await stage.boundingBox();
    const origem = page.locator('[data-node^="plan:"]').first();
    rep.check('a vista da planta é arrastável', (await origem.getAttribute('draggable')) === 'true');
    await origem.dragTo(stage, { targetPosition: { x: Math.round(box.width * 0.72), y: Math.round(box.height * 0.45) } });
    await page.waitForTimeout(500);
    const depois = await sheet();
    rep.check('a vista entrou na prancha', depois.viewports.length === antes.viewports.length + 1, `${antes.viewports.length} → ${depois.viewports.length}`);
    const nova = depois.viewports[depois.viewports.length - 1];
    if (!nova) throw new Error('a vista não entrou');
    rep.check('entrou na escala natural da vista (1:100)', nova.scale === 100, String(nova.scale));
    rep.check('ficou selecionada depois de soltar', (await stage.getAttribute('data-sel')) === nova.id, `${await stage.getAttribute('data-sel')} vs ${nova.id}`);
    rep.check('ficou dentro da área de desenho', nova.at.x >= 10 - 1e-6 && nova.at.y >= 10 - 1e-6 && nova.at.x + nova.size.w <= 410 + 1e-6 && nova.at.y + nova.size.h <= 287 + 1e-6, JSON.stringify(nova.at));
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    rep.check('um Ctrl+Z tira a vista arrastada', (await sheet()).viewports.length === antes.viewports.length);
  });

  await rep.step('11 — redimensionar não move o desenho e o pan do conteúdo para onde soltou', async () => {
    // Prancha limpa, duas vistas soltas, para não herdar trava/recorte dos passos anteriores.
    await page.evaluate(() => {
      const { editor, useUi } = window.__hestia;
      const lv = editor.project.levels[0].id;
      editor.store.exec({
        type: 'addSheet',
        sheet: {
          id: 'sh_fix', number: 'A-102', name: 'Ensaio', size: 'A3', orientation: 'landscape', margin: 10,
          titleBlock: { project: 'Hestia', client: '', author: '', date: '30/10/2026', revision: '0' },
          viewports: [
            { id: 'vp1', view: { kind: 'plan', levelId: lv }, at: { x: 30, y: 40 }, size: { w: 160, h: 120 }, scale: 100 },
            { id: 'vp2', view: { kind: 'plan', levelId: lv }, at: { x: 250, y: 40 }, size: { w: 120, h: 100 }, scale: 100 },
          ],
        },
      });
      useUi.setState({ view: 'sheet', sheetId: 'sh_fix' });
    });
    await page.waitForSelector('[data-vp-layer="vp1"]');
    await page.waitForTimeout(400);

    const layerBox = () => page.evaluate(() => {
      const g = document.querySelector('[data-vp-layer="vp1"]');
      const b = g.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const vp1 = async () => (await sheet('sh_fix')).viewports.find((v) => v.id === 'vp1');
    const zoom = async () => {
      const vb = await viewBox();
      const css = await page.locator('.sheet-stage svg').evaluate((el) => el.getBoundingClientRect().width);
      return css / vb.w;
    };

    const antes = await layerBox();
    const v0 = await vp1();
    await clickPaper(v0.at.x + v0.size.w / 2, v0.at.y + v0.size.h / 2);
    const leste = await toScreen(v0.at.x + v0.size.w, v0.at.y + v0.size.h / 2);
    // Arrasta a alça sem soltar: o desenho não pode se deslocar durante o preview.
    await page.mouse.move(leste.x, leste.y);
    await page.mouse.down();
    await page.mouse.move(leste.x + 30, leste.y, { steps: 3 });
    await page.waitForTimeout(150);
    const durante = await layerBox();
    rep.check('durante o arraste da alça o desenho fica parado', Math.abs(durante.x - antes.x) < 0.5 && Math.abs(durante.y - antes.y) < 0.5, `${JSON.stringify(antes)} → ${JSON.stringify(durante)}`);
    await page.mouse.move(leste.x + 45, leste.y, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const depois = await layerBox();
    const v1 = await vp1();
    rep.check('a caixa cresceu', v1.size.w > v0.size.w + 1, `${v0.size.w} → ${v1.size.w}`);
    rep.check('o desenho não mudou de posição ao redimensionar', Math.abs(depois.x - antes.x) < 0.5 && Math.abs(depois.y - antes.y) < 0.5, `${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
    rep.check('a vista ganhou âncora no papel', v1.anchor !== null, JSON.stringify(v1.anchor));

    // Pan do conteúdo: soltar num ponto distante (antes o clamp de 4× puxava de volta).
    const z = await zoom();
    const c = await toScreen(v1.at.x + v1.size.w / 2, v1.at.y + v1.size.h / 2);
    const antesPan = await vp1();
    await drag(c, { x: c.x + 220, y: c.y - 60 }, { alt: true });
    const depoisPan = await vp1();
    const esperado = { x: 220 / z, y: 60 / z };
    rep.check(
      'o conteúdo foi para onde o ponteiro soltou (sem pulo nem clamp)',
      Math.abs(depoisPan.anchor.x - antesPan.anchor.x - esperado.x) < 2 && Math.abs(depoisPan.anchor.y - antesPan.anchor.y - esperado.y) < 2,
      `Δ ${(depoisPan.anchor.x - antesPan.anchor.x).toFixed(1)},${(depoisPan.anchor.y - antesPan.anchor.y).toFixed(1)} vs ${esperado.x.toFixed(1)},${esperado.y.toFixed(1)}`,
    );

    // Encaixe desligado: arraste rápido (um único movimento + soltar) tem de gravar o ponto do ponteiro.
    await page.getByRole('button', { name: 'Encaixa nas bordas e centros das outras vistas' }).click();
    const v2 = await vp1();
    const grab = await toScreen(v2.at.x + v2.size.w / 2, v2.at.y + v2.size.h / 2);
    const alvo = { x: grab.x + 130, y: grab.y + 40 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(alvo.x, alvo.y, { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const v3 = await vp1();
    rep.check(
      'arraste rápido grava exatamente o ponto do ponteiro',
      Math.abs(v3.at.x - v2.at.x - 130 / z) < 2 && Math.abs(v3.at.y - v2.at.y + 40 / z) < 2,
      `Δ ${(v3.at.x - v2.at.x).toFixed(1)},${(v3.at.y - v2.at.y).toFixed(1)} vs ${(130 / z).toFixed(1)},${(-40 / z).toFixed(1)}`,
    );
    await page.getByRole('button', { name: 'Encaixa nas bordas e centros das outras vistas' }).click();
  });

  await rep.step('12 — Alinhar pela moldura e por uma face desenhada', async () => {
    await page.getByRole('button', { name: /^Alinhar pela moldura/ }).click();
    await page.waitForTimeout(200);
    rep.check('a ferramenta Alinhar liga', (await page.locator('.sheet-stage').getAttribute('data-align')) === '1');

    // Referência: borda esquerda da moldura da vp1.
    let s = await sheet('sh_fix');
    let a = s.viewports.find((v) => v.id === 'vp1');
    let b = s.viewports.find((v) => v.id === 'vp2');
    await clickPaper(a.at.x, a.at.y + a.size.h / 2);
    await page.waitForTimeout(200);
    // Alvo: borda esquerda da vp2.
    await clickPaper(b.at.x, b.at.y + b.size.h / 2);
    await page.waitForTimeout(300);
    s = await sheet('sh_fix');
    a = s.viewports.find((v) => v.id === 'vp1');
    b = s.viewports.find((v) => v.id === 'vp2');
    rep.check('a vp2 alinhou a moldura à esquerda da vp1', Math.abs(b.at.x - a.at.x) < 0.2, `${a.at.x} vs ${b.at.x}`);

    // Esc volta um passo: limpa a referência e mantém a ferramenta ligada.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    rep.check('Esc limpa a referência sem sair da ferramenta', (await page.locator('.sheet-stage').getAttribute('data-align-ref')) === '' && (await page.locator('.sheet-stage').getAttribute('data-align')) === '1');

    // Agora referência = uma face vertical desenhada dentro da vp1. Recentraliza o conteúdo da vp1 (o pan do passo
    // anterior deixaria a maior parte do desenho fora do recorte) e lê uma face visível do SVG.
    await page.evaluate(() => {
      const { editor } = window.__hestia;
      editor.store.exec({ type: 'updateViewport', sheetId: 'sh_fix', id: 'vp1', patch: { anchor: undefined, offset: undefined } }, 'Recentralizar conteúdo');
    });
    await page.waitForTimeout(300);
    const face = await page.evaluate(() => {
      const svg = document.querySelector('.sheet-stage svg');
      const layer = document.querySelector('[data-vp-layer="vp1"]');
      if (!svg || !layer) return null;
      const inv = svg.getScreenCTM()?.inverse();
      const s = window.__hestia.editor.project.sheets.find((x) => x.id === 'sh_fix');
      const vp = s.viewports.find((v) => v.id === 'vp1');
      for (const p of layer.querySelectorAll('path')) {
        const d = p.getAttribute('d') ?? '';
        const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        for (let i = 0; i + 3 < nums.length; i += 2) {
          const x1 = nums[i];
          const y1 = nums[i + 1];
          const x2 = nums[i + 2];
          const y2 = nums[i + 3];
          if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
          if (Math.abs(x1 - x2) >= 0.01 || Math.abs(y2 - y1) <= 25) continue;
          const ctm = p.getScreenCTM();
          if (!ctm || !inv) continue;
          const pt = svg.createSVGPoint();
          pt.x = x1;
          pt.y = (y1 + y2) / 2;
          const screen = pt.matrixTransform(ctm);
          const invPt = screen.matrixTransform(inv);
          const paperX = invPt.x;
          const paperY = 297 - invPt.y;
          // só faces dentro do recorte da vista (o resto está clipado e não pode ser clicado)
          if (paperX < vp.at.x + 2 || paperX > vp.at.x + vp.size.w - 2 || paperY < vp.at.y + 2 || paperY > vp.at.y + vp.size.h - 2) continue;
          return { sx: screen.x, sy: screen.y, paperX };
        }
      }
      return null;
    });
    rep.check('achei uma face vertical desenhada na vp1', face !== null, JSON.stringify(face));
    if (!face) throw new Error('sem face');
    await page.mouse.click(face.sx, face.sy);
    await page.waitForTimeout(200);
    s = await sheet('sh_fix');
    b = s.viewports.find((v) => v.id === 'vp2');
    await clickPaper(b.at.x, b.at.y + b.size.h / 2);
    await page.waitForTimeout(300);
    s = await sheet('sh_fix');
    b = s.viewports.find((v) => v.id === 'vp2');
    rep.check('a vp2 alinhou a moldura à face desenhada', Math.abs(b.at.x - face.paperX) < 0.6, `face ${face.paperX.toFixed(1)} vs ${b.at.x.toFixed(1)}`);
    await page.evaluate(() => window.__hestia.useUi.setState({ sheetAlign: false }));
    await page.waitForTimeout(150);
  });

  await rep.step('13 — Mover a vista pela moldura e por um ponto do desenho', async () => {
    // Posição conhecida e longe das bordas, para o teste não esbarrar no limite da folha.
    await page.evaluate(() => {
      window.__hestia.editor.store.exec({ type: 'updateViewport', sheetId: 'sh_fix', id: 'vp1', patch: { at: { x: 30, y: 100 } } }, 'Preparar teste do Mover');
    });
    await page.waitForTimeout(300);
    let s = await sheet('sh_fix');
    let a = s.viewports.find((v) => v.id === 'vp1');
    // A vp2 está à direita: seleciona a vp1 num ponto só dela (faixa esquerda).
    const pontoSel = { x: a.at.x + 15, y: a.at.y + a.size.h / 2 };
    await clickPaper(pontoSel.x, pontoSel.y);
    rep.check('a vp1 está selecionada para mover', (await page.locator('.sheet-stage').getAttribute('data-sel')) === 'vp1');
    await page.getByRole('button', { name: /^Mover a vista pela moldura/ }).click();
    await page.waitForTimeout(250);
    rep.check('a ferramenta Mover liga na vista selecionada', (await page.locator('.sheet-stage').getAttribute('data-move')) === '1');

    // Ponto base no centro da moldura (captura) e destino digitado: 150 mm na direção do cursor.
    const centro = { x: a.at.x + a.size.w / 2, y: a.at.y + a.size.h / 2 };
    await clickPaper(centro.x, centro.y);
    await page.waitForTimeout(150);
    await page.keyboard.type('150');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    s = await sheet('sh_fix');
    a = s.viewports.find((v) => v.id === 'vp1');
    rep.check('a distância digitada moveu 150 mm em X', Math.abs(a.at.x - (centro.x - a.size.w / 2 + 150)) < 1, `x = ${a.at.x}`);
    rep.check('a ferramenta saiu depois de mover', (await page.locator('.sheet-stage').getAttribute('data-move')) === null);

    // Agora mover por um ponto DA CONSTRUÇÃO: base numa extremidade desenhada e destino livre.
    const s2 = await sheet('sh_fix');
    const b = s2.viewports.find((v) => v.id === 'vp1');
    const pontoSel2 = { x: b.at.x + 15, y: b.at.y + b.size.h / 2 };
    await clickPaper(pontoSel2.x, pontoSel2.y);
    await page.getByRole('button', { name: /^Mover a vista pela moldura/ }).click();
    await page.waitForTimeout(200);
    const canto = await page.evaluate(() => {
      const svg = document.querySelector('.sheet-stage svg');
      const layer = document.querySelector('[data-vp-layer="vp1"]');
      if (!svg || !layer) return null;
      const inv = svg.getScreenCTM()?.inverse();
      const vp = window.__hestia.editor.project.sheets.find((x) => x.id === 'sh_fix').viewports.find((v) => v.id === 'vp1');
      for (const p of layer.querySelectorAll('path')) {
        const nums = ((p.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = nums[i];
          const y = nums[i + 1];
          if (x === undefined || y === undefined) continue;
          const paperY = 297 - y;
          if (x < vp.at.x + 5 || x > vp.at.x + vp.size.w - 5 || paperY < vp.at.y + 5 || paperY > vp.at.y + vp.size.h - 5) continue;
          const ctm = p.getScreenCTM();
          if (!ctm) continue;
          const pt = svg.createSVGPoint();
          pt.x = x;
          pt.y = y;
          const q = pt.matrixTransform(ctm);
          return { sx: q.x, sy: q.y, paperX: x, paperY };
        }
      }
      return null;
    });
    rep.check('achei um ponto da construção dentro da vista', canto !== null);
    if (!canto) throw new Error('sem ponto de construção');
    await page.mouse.click(canto.sx, canto.sy);
    await page.waitForTimeout(150);
    const antes = (await sheet('sh_fix')).viewports.find((v) => v.id === 'vp1');
    const destino = await toScreen(canto.paperX - 60, canto.paperY + 40);
    await page.mouse.click(destino.x, destino.y);
    await page.waitForTimeout(350);
    const depois = (await sheet('sh_fix')).viewports.find((v) => v.id === 'vp1');
    rep.check(
      'a vista andou pelo ponto do desenho (moldura e construção juntas)',
      Math.abs(depois.at.x - antes.at.x + 60) < 6 && Math.abs(depois.at.y - antes.at.y - 40) < 6,
      `Δ ${(depois.at.x - antes.at.x).toFixed(1)},${(depois.at.y - antes.at.y).toFixed(1)}`,
    );
    rep.check('o tamanho do recorte não mudou ao mover', Math.abs(depois.size.w - antes.size.w) < 0.01 && Math.abs(depois.size.h - antes.size.h) < 0.01);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const voltou = (await sheet('sh_fix')).viewports.find((v) => v.id === 'vp1');
    rep.check('um Ctrl+Z devolve a posição', Math.abs(voltou.at.x - antes.at.x) < 0.01 && Math.abs(voltou.at.y - antes.at.y) < 0.01);
  });

  await rep.step('14 — captura da prancha', async () => {
    await page.keyboard.press('z');
    await page.waitForTimeout(300);
    await page.locator('.sheet-stage').screenshot({ path: path.join(OUT, '01-prancha.png') });
    await page.locator('.root, body').first().screenshot({ path: path.join(OUT, '00-janela.png') });
  });
} finally {
  rep.summary();
  await browser.close();
}

process.exit(rep.steps.some((s) => s.status === 'FAIL') ? 1 : 0);
