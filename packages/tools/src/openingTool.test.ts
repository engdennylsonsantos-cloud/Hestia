import { describe, expect, it } from 'vitest';
import { openingSymbolPaths } from '@hestia/geom';
import { frameOfWall, openingGeometry } from '@hestia/engine';
import { openingsOfWall, type Opening, type Wall } from '@hestia/model';
import type { ToolEnv } from './types.ts';
import { drawWall, makeEnv, P, tool, walls } from './testEnv.ts';

type Ctx = ReturnType<typeof makeEnv>;

const wallOf = (ctx: Ctx, pred: (w: Wall) => boolean): Wall => walls(ctx.store).find(pred)!;
const hostOf = (ctx: Ctx): Wall => wallOf(ctx, (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) > 3.9);
const openings = (ctx: Ctx, wallId = hostOf(ctx).id): Opening[] => openingsOfWall(ctx.store.project, wallId);

function withSnapOff(ctx: Ctx): void {
  ctx.options.snap = { ...(ctx.options.snap ?? {}), enabled: false } as never;
}

function moveAndClick(ctx: Ctx, x: number, y: number): Opening {
  const t = tool('door', ctx.env);
  t.move!(P(x, y));
  t.click!(P(x, y));
  return openings(ctx)[0]!;
}

function makeWall(ctx: Ctx, a: [number, number], b: [number, number]): void {
  drawWall(ctx.env as ToolEnv, a, b);
}

describe('colocação da abertura: sentido pelo cursor (estilo Revit)', () => {
  it('acima do eixo abre para o lado do cursor; abaixo, para o oposto', () => {
    const acima = makeEnv();
    makeWall(acima, [0, 0], [4, 0]);
    expect(moveAndClick(acima, 2, 0.1).flipFacing).toBe(false);

    const abaixo = makeEnv();
    makeWall(abaixo, [0, 0], [4, 0]);
    expect(moveAndClick(abaixo, 2, -0.1).flipFacing).toBe(true);
  });

  it('openingToward away inverte o sentido calculado pelo cursor', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [4, 0]);
    ctx.options.openingToward = 'away';
    expect(moveAndClick(ctx, 2, 0.1).flipFacing).toBe(true);
  });

  it('openingFacingMode fixed ignora o cursor e usa openingFlipFacing', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [4, 0]);
    ctx.options.openingFacingMode = 'fixed';
    ctx.options.openingFlipFacing = false;
    expect(moveAndClick(ctx, 2, -0.1).flipFacing).toBe(false);
    ctx.options.openingFlipFacing = true;
    const outro = makeEnv();
    makeWall(outro, [0, 0], [4, 0]);
    outro.options.openingFacingMode = 'fixed';
    outro.options.openingFlipFacing = true;
    expect(moveAndClick(outro, 2, 0.1).flipFacing).toBe(true);
  });

  it('histerese de 3 px mantém o lado anterior perto do eixo e muda a 4 px', () => {
    const perto = makeEnv();
    makeWall(perto, [0, 0], [4, 0]);
    const t1 = tool('door', perto.env);
    t1.move!(P(2, 0.1));
    t1.move!(P(2, -0.01));
    t1.click!(P(2, -0.01));
    expect(openings(perto)[0]!.flipFacing).toBe(false);

    const longe = makeEnv();
    makeWall(longe, [0, 0], [4, 0]);
    const t2 = tool('door', longe.env);
    t2.move!(P(2, 0.1));
    t2.move!(P(2, -0.04));
    t2.click!(P(2, -0.04));
    expect(openings(longe)[0]!.flipFacing).toBe(true);
  });

  it('Tab inverte o sentido e Espaço inverte a dobradiça na abertura criada', () => {
    const tab = makeEnv();
    makeWall(tab, [0, 0], [4, 0]);
    const t = tool('door', tab.env);
    t.move!(P(2, 0.1));
    t.tab();
    t.click!(P(2, 0.1));
    expect(openings(tab)[0]!.flipFacing).toBe(true);

    const espaco = makeEnv();
    makeWall(espaco, [0, 0], [4, 0]);
    const s = tool('door', espaco.env);
    s.move!(P(2, 0.1));
    s.space?.();
    s.click!(P(2, 0.1));
    expect(openings(espaco)[0]!.flipHand).toBe(true);
    expect(openings(espaco)[0]!.flipFacing).toBe(false);
  });
});

describe('colocação da abertura: âncora', () => {
  it('hinge com dobradiça à esquerda põe o centro a +W/2 do cursor; latch, ao contrário', () => {
    const hinge = makeEnv();
    makeWall(hinge, [0, 0], [4, 0]);
    hinge.options.openingAnchor = 'hinge';
    expect(moveAndClick(hinge, 2, 0.1).offset).toBeCloseTo(2.4, 6);

    const latch = makeEnv();
    makeWall(latch, [0, 0], [4, 0]);
    latch.options.openingAnchor = 'latch';
    expect(moveAndClick(latch, 2, 0.1).offset).toBeCloseTo(1.6, 6);
  });
});

describe('colocação da abertura: capturas novas', () => {
  it('centro do trecho entre perpendiculares (parede de 5 m, trecho livre de 3 m)', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [5, 0]);
    makeWall(ctx, [2, -1], [2, 1]);
    makeWall(ctx, [5, -1], [5, 1]);
    const t = tool('door', ctx.env);
    t.move!(P(3.5, 0.1));
    t.click!(P(3.5, 0.1));
    expect(openings(ctx)[0]!.offset).toBeCloseTo(3.5, 6);
  });

  it('folga da quina deixa a borda a openingClear da face da perpendicular', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [5, 0]);
    makeWall(ctx, [2, -1], [2, 1]);
    const perp = wallOf(ctx, (w) => Math.abs(w.a.x - 2) < 1e-9 && Math.abs(w.b.x - 2) < 1e-9);
    const face = frameOfWall(ctx.store.project, perp.id)!.sHi;
    const t = tool('door', ctx.env);
    t.move!(P(2.6, 0.1));
    t.click!(P(2.6, 0.1));
    const o = openings(ctx)[0]!;
    expect(o.offset - 0.4 - (2 + face)).toBeCloseTo(0.1, 6);
  });
});

describe('colocação da abertura: prévia e cotas', () => {
  it('mostra o símbolo real e duas cotas do eixo às perpendiculares', () => {
    const ctx = makeEnv();
    withSnapOff(ctx);
    makeWall(ctx, [0, 0], [4.5, 0]);
    makeWall(ctx, [0, -1], [0, 1]);
    makeWall(ctx, [4.5, -1], [4.5, 1]);
    const t = tool('door', ctx.env);
    t.move!(P(2.26, 0.05));
    const items = t.preview();
    const temp: Opening = {
      id: 'preview',
      kind: 'door',
      typeId: 'ot_p80',
      hostId: hostOf(ctx).id,
      offset: 2.26,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    };
    const symbolLines = openingSymbolPaths(openingGeometry(ctx.store.project, temp, frameOfWall(ctx.store.project, temp.hostId)!)).reduce(
      (n, s) => n + (s.closed ? s.pts.length : s.pts.length - 1),
      0,
    );
    expect(items.filter((i) => i.kind === 'line')).toHaveLength(symbolLines + 2);
    const labels = items.filter((i) => i.kind === 'label').map((i) => i.text);
    expect(labels).toEqual(['2,26', '2,24']);
  });

  it('openingDimMode face cota da borda da abertura à face da perpendicular', () => {
    const ctx = makeEnv();
    withSnapOff(ctx);
    makeWall(ctx, [0, 0], [4.5, 0]);
    makeWall(ctx, [0, -1], [0, 1]);
    makeWall(ctx, [4.5, -1], [4.5, 1]);
    ctx.options.openingDimMode = 'face';
    const t = tool('door', ctx.env);
    t.move!(P(2.26, 0.05));
    const labels = t.preview().filter((i) => i.kind === 'label').map((i) => i.text);
    expect(labels).toEqual(['1,77', '1,75']);
  });

  it('posição inválida (sobre outra abertura) fica vermelha e não insere ao clicar', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [4, 0]);
    const first = tool('door', ctx.env);
    first.click!(P(2, 0.1));
    expect(openings(ctx)).toHaveLength(1);

    const second = tool('door', ctx.env);
    second.move!(P(2, 0.1));
    const invalid = second.preview().some((i) => (i.kind === 'line' || i.kind === 'polygon') && i.tone === 'invalid');
    expect(invalid).toBe(true);
    second.click!(P(2, 0.1));
    expect(openings(ctx)).toHaveLength(1);
  });

  it('a posição digitada é exata e passa pelas validações', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [4, 0]);
    const t = tool('door', ctx.env);
    t.move!(P(2, 0.1));
    expect(t.type!('2.7')).toBe(true);
    expect(openings(ctx)[0]!.offset).toBeCloseTo(2.7, 6);
    expect(t.type!('2.75')).toBe(false);
    expect(openings(ctx)).toHaveLength(1);
  });
});

describe('colocação da abertura: etiquetar ao inserir', () => {
  it('inserir uma porta liga showOpeningTags quando estava desligado', () => {
    const ctx = makeEnv();
    makeWall(ctx, [0, 0], [4, 0]);
    expect(ctx.store.project.settings.showOpeningTags).not.toBe(true);
    moveAndClick(ctx, 2, 0.1);
    expect(ctx.store.project.settings.showOpeningTags).toBe(true);
  });

  it('openingTagOnPlace desligado mantém a configuração', () => {
    const ctx = makeEnv();
    ctx.options.openingTagOnPlace = false;
    makeWall(ctx, [0, 0], [4, 0]);
    moveAndClick(ctx, 2, 0.1);
    expect(ctx.store.project.settings.showOpeningTags).not.toBe(true);
  });
});

describe('colocação da abertura: zona de captura da parede', () => {
  it('aceita o cursor a até 16 px da face e recusa além disso', () => {
    const dentro = makeEnv();
    makeWall(dentro, [0, 0], [4, 0]);
    const a = tool('door', dentro.env);
    a.move!(P(2, 0.25));
    expect(a.preview().some((i) => i.kind === 'highlight')).toBe(true);
    a.click!(P(2, 0.25));
    expect(openings(dentro)).toHaveLength(1);

    const fora = makeEnv();
    makeWall(fora, [0, 0], [4, 0]);
    const b = tool('door', fora.env);
    b.move!(P(2, 0.26));
    expect(b.preview()).toHaveLength(0);
  });
});
