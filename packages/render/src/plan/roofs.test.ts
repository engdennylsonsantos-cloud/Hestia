import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { resolveLevel, resolveRoofs, type ResolvedRoof, type ResolvedRoofLayer } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, type DetailLevel, type Project } from '@hestia/model';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { mix } from './color.ts';
import { roofFills, roofFootprint, roofOps, roofRealArea, roofSelectionOps, waterTone } from './roofs.ts';
import { DARK, LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const TILE = '#b5522d';
const LAYERS: ResolvedRoofLayer[] = [
  { layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 },
  { layerIndex: 1, materialId: 'mat_madeira', thickness: 0.03, below: 0.015 },
  { layerIndex: 2, materialId: 'mat_madeira', thickness: 0.05, below: 0.045 },
];
const VIEW = (zoom: number): Viewport => ({ cx: 4, cy: 3, zoom, width: 800, height: 600 });
const P = (x: number, y: number): Vec2 => ({ x, y });

/** Duas águas 8 × 6 a 30 %, cumeeira em y = 3; linhas: cumeeira, espigões e rincão de teste. */
function gable(extra: Partial<ResolvedRoof> = {}): ResolvedRoof {
  return {
    roofId: 'r',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: 2.8,
    joinedArea: 0,
    layers: LAYERS,
    planes: [
      { polygon: [[[P(0, 0), P(8, 0), P(8, 3), P(0, 3)]]], origin: P(0, 0), up: P(0, 1), percent: 30, z0: 2.8 },
      { polygon: [[[P(0, 3), P(8, 3), P(8, 6), P(0, 6)]]], origin: P(0, 6), up: P(0, -1), percent: 30, z0: 2.8 },
    ],
    lines: [
      { kind: 'ridge', a: P(0, 3), b: P(8, 3) },
      { kind: 'hip', a: P(0, 0), b: P(2, 2) },
      { kind: 'valley', a: P(8, 3), b: P(6, 4) },
      { kind: 'eave', a: P(0, 0), b: P(8, 0) },
    ],
    ...extra,
  };
}

const ops = (rs: ResolvedRoof[], detail: DetailLevel = 'medium', zoom = 100, dark = false, p: Project = createEmptyProject()) =>
  roofOps(rs, p, dark ? DARK : LIGHT, dark, detail, VIEW(zoom));

function projectWithRoof(showTags = false): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 6.3), P(-0.3, 6.3)], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }),
  });
  if (showTags) s.exec({ type: 'setSettings', patch: { showTags: true } });
  return s.project;
}

function input(p: Project, over: Partial<PlanInput> = {}): PlanInput {
  return {
    project: p,
    levelId: 'lv_0',
    resolved: resolveLevel(p, 'lv_0', new Map()),
    below: null,
    viewport: VIEW(100),
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
    ...over,
  };
}

describe('telhado na planta (D1)', () => {
  it('cada água: cor da camada de topo misturada com o papel a 0,5 e tom por orientação', () => {
    const r = gable();
    const fills = ops([r]).fills.filter((f) => f.alpha === 0.55);
    const base = mix(TILE, '#ffffff', 0.5);
    expect(fills).toHaveLength(2);
    expect(fills[0]!.color).toBe(waterTone(base, P(0, 1)));
    expect(fills[1]!.color).toBe(waterTone(base, P(0, -1)));
  });

  it('a luz de noroeste deixa mais clara a água que olha para ela e a outra mais escura', () => {
    // a água da frente (subida para +y) desce para o sul; a de trás desce para o norte, voltada para a luz de NW
    const base = mix(TILE, '#ffffff', 0.5);
    expect(waterTone(base, P(0, 1))).toBe(mix(base, '#000000', 0.06));
    expect(waterTone(base, P(0, -1))).toBe(mix(base, '#ffffff', 0.06));
    expect(waterTone(base, P(0, 1))).not.toBe(waterTone(base, P(0, -1)));
  });

  it('escuro: mistura com o fundo a 0,3', () => {
    const fills = ops([gable()], 'medium', 100, true).fills.filter((f) => f.alpha === 0.55);
    expect(fills[0]!.color).toBe(waterTone(mix(TILE, DARK.bg, 0.3), P(0, 1)));
  });

  it('semitransparente: 0,55 no médio e no fino; 0,8 no grosseiro', () => {
    expect(ops([gable()], 'medium').fills.every((f) => f.alpha === 0.55 || f.alpha === 1)).toBe(true);
    const coarse = ops([gable()], 'coarse');
    expect(coarse.fills.map((f) => f.alpha)).toEqual([0.8, 0.8]);
  });

  it('hachura do material só com zoom a partir de 40 px/m (médio); no grosseiro, nunca', () => {
    // rt_ceramica: telha com hachura diagonal
    expect(ops([gable()], 'medium', 10).fills[0]!.hatch).toBeUndefined();
    expect(ops([gable()], 'medium', 100).fills[0]!.hatch?.kind).toBe('diagonal');
    expect(ops([gable()], 'coarse', 100).fills[0]!.hatch).toBeUndefined();
  });

  it('contorno do beiral como faixa preenchida de 1,5 px (não traço)', () => {
    const ops1 = ops([gable()]);
    const band = ops1.fills.find((f) => f.alpha === 1)!;
    expect(band.color).toBe(mix(LIGHT.ink, '#ffffff', 0.35));
    expect(multiArea(band.polygons)).toBeLessThan(multiArea(roofFootprint(gable())) * 0.2);
  });

  it('linhas notáveis: cumeeira 2,2 px em ink; espigão 1,6 px; rincão 1,6 px tracejado; beiral não tem traço', () => {
    const strokes = ops([gable()]).strokes.filter((s) => s.widthPx !== 1.4);
    expect(strokes).toHaveLength(3);
    const ridge = strokes.find((s) => s.widthPx === 2.2)!;
    expect(ridge.color).toBe(LIGHT.ink);
    expect(ridge.pts).toEqual([P(0, 3), P(8, 3)]);
    const hip = strokes.find((s) => s.widthPx === 1.6 && !s.dash)!;
    expect(hip.pts).toEqual([P(0, 0), P(2, 2)]);
    const valley = strokes.find((s) => s.dash)!;
    expect(valley.widthPx).toBe(1.6);
    expect(valley.dash).toEqual([6, 3]);
  });

  it('seta de caimento por água, da subida para a descida, com o percentual', () => {
    const o = ops([gable()]);
    const arrows = o.strokes.filter((s) => s.widthPx === 1.4);
    expect(arrows).toHaveLength(4);
    // água de baixo (sobe para +y): a ponta fica para −y, no centroide (4, 1,5)
    const shaft = arrows[0]!.pts;
    expect(shaft[1]!.y).toBeLessThan(1.5);
    expect(shaft[1]!.x).toBeCloseTo(4, 9);
    const labels = o.labels.map((l) => l.text);
    expect(labels).toEqual(['30 %', '30 %']);
  });

  it('percentual com vírgula quando não é inteiro', () => {
    const r = gable({ planes: [{ ...gable().planes[0]!, percent: 27.5 }] });
    expect(ops([r]).labels.map((l) => l.text)).toEqual(['27,5 %']);
  });

  it('coarse: só preenchimento, sem contorno, linhas, setas nem etiqueta de percentual', () => {
    const o = ops([gable()], 'coarse');
    expect(o.strokes).toHaveLength(0);
    expect(o.labels).toHaveLength(0);
    expect(o.fills).toHaveLength(2);
  });

  it('área real: planta × √(1 + i²); com etiquetas, código e área real no centroide', () => {
    const r = gable();
    expect(roofRealArea(r)).toBeCloseTo(48 * Math.sqrt(1.09), 9);
    expect(ops([r]).labels.some((l) => l.text === 'TL-01 · 50,1 m²')).toBe(false);
    const p = projectWithRoof(true);
    const tagged = roofOps([gable()], p, LIGHT, false, 'medium', VIEW(100)).labels.map((l) => l.text);
    expect(tagged).toContain('TL-01 · 50,1 m²');
  });
});

describe('seleção e hover de telhado (D1)', () => {
  it('selecionado: azul translúcido, contorno de 2 px e área real com duas casas decimais', () => {
    const p = projectWithRoof();
    const real = resolveRoofs(p, 'lv_0');
    const ops1 = roofSelectionOps(p, 'lv_0', [real[0]!.roofId], null, LIGHT, VIEW(100));
    expect(ops1.fills[0]).toMatchObject({ color: LIGHT.select, alpha: 0.26 });
    expect(ops1.strokes.some((s) => s.widthPx === 2)).toBe(true);
    // área real e, com o telhado selecionado, o percentual de cada aresta que define inclinação (A11)
    expect(ops1.labels.map((l) => l.text)).toEqual([`${(roofRealArea(real[0]!)).toFixed(2).replace('.', ',')} m²`, '30 %', '30 %', '30 %', '30 %']);
  });

  it('hover: só o azul translúcido', () => {
    const p = projectWithRoof();
    const o = roofSelectionOps(p, 'lv_0', [], 'r', LIGHT, VIEW(100));
    expect(o.fills).toEqual([expect.objectContaining({ color: LIGHT.select, alpha: 0.16 })]);
    expect(o.strokes).toHaveLength(0);
  });
});

describe('integração com o motor (resolveRoofs real)', () => {
  it('telhado de duas águas real: duas águas, cumeeira e espigões na planta, rótulos de 30 %', () => {
    const p = projectWithRoof();
    const [r] = resolveRoofs(p, 'lv_0');
    expect(r).toBeDefined();
    expect(r!.planes).toHaveLength(2);
    expect(r!.lines.some((l) => l.kind === 'ridge')).toBe(true);
    const fills = roofFills(p, 'lv_0', LIGHT, false, 'medium', VIEW(100));
    expect(fills.labels.map((l) => l.text)).toEqual(['30 %', '30 %']);
  });

  it('a lista completa desenha o telhado depois das paredes e pisos, e o subpavimento apagado vem antes', () => {
    // O beiral está em 2,80 m, acima do topo padrão (2,30 m): com o topo subido, o telhado entra na vista (decisão 0013).
    const s = new ProjectStore(projectWithRoof());
    s.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: { top: 3.5 } });
    const p = s.project;
    const dl = buildPlanDrawList(input(p, { belowRoofs: [gable()], below: resolveLevel(p, 'lv_0', new Map()) }));
    const roofIdx = dl.fills.findIndex((f) => f.alpha === 0.55);
    const underIdx = dl.fills.findIndex((f) => f.color === LIGHT.underlay && f.alpha === 0.22);
    expect(roofIdx).toBeGreaterThan(-1);
    expect(underIdx).toBeGreaterThan(-1);
    expect(underIdx).toBeLessThan(roofIdx);
  });
});

describe('subpavimento com telhados (D4)', () => {
  it('sem belowRoofs, nenhum telhado de baixo aparece', () => {
    const p = projectWithRoof();
    const dl = buildPlanDrawList(input(p, { below: resolveLevel(p, 'lv_0', new Map()) }));
    expect(dl.fills.some((f) => f.color === LIGHT.underlay && f.alpha === 0.22)).toBe(false);
  });

  it('com belowRoofs, a pegada do telhado de baixo aparece apagada, como as lajes', () => {
    const p = projectWithRoof();
    const below = gable();
    const dl = buildPlanDrawList(input(p, { below: resolveLevel(p, 'lv_0', new Map()), belowRoofs: [below] }));
    const i = dl.fills.findIndex((f) => f.color === LIGHT.underlay && f.alpha === 0.22);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(dl.fills[i]!.polygons).toEqual(roofFootprint(below));
  });
});

/** Telhado por contorno (forma 'edges') com as inclinações por aresta, resolvido pelo motor real. */
function edgesProject(boundary: Vec2[], edgeSlopes: Array<number | null>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, heightOffset: 2.8, shape: 'edges', edgeSlopes }) });
  return s.project;
}
const L_BOUNDARY = [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 3.3), P(4.3, 3.3), P(4.3, 6.3), P(-0.3, 6.3)];
const RECT_BOUNDARY = [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 6.3), P(-0.3, 6.3)];

describe('aresta de empena e símbolo "define inclinação" (A10/A11)', () => {
  it('empena (kind gable): tracejado longo e um traço perpendicular no meio', () => {
    const o = ops([gable({ lines: [{ kind: 'gable', a: P(0, 0), b: P(8, 0) }] })]);
    const dashed = o.strokes.filter((s) => s.dash);
    expect(dashed).toHaveLength(1);
    expect(dashed[0]!.dash).toEqual([12, 5]);
    expect(dashed[0]!.pts).toEqual([P(0, 0), P(8, 0)]);
    const tick = o.strokes.find((s) => !s.dash && s.pts.length === 2 && s.pts[0]!.x === 4 && s.widthPx === 1.6)!;
    expect(tick.pts[0]!.y).toBeCloseTo(-0.06, 9);
    expect(tick.pts[1]!.y).toBeCloseTo(0.06, 9);
  });

  it('selecionado em L com as 6 arestas definindo inclinação: 6 triângulos cheios na cor de destaque, cada um com "30 %"', () => {
    const p = edgesProject(L_BOUNDARY, [30, 30, 30, 30, 30, 30]);
    const o = roofSelectionOps(p, 'lv_0', ['r'], null, LIGHT, VIEW(100));
    const filled = o.fills.filter((f) => f.color === LIGHT.accent);
    expect(filled).toHaveLength(6);
    for (const f of filled) expect(f.polygons[0]![0]!).toHaveLength(3);
    expect(o.labels.filter((l) => l.text === '30 %')).toHaveLength(6);
  });

  it('aresta sem inclinação (null): triângulo vazado e cinza, sem triângulo cheio; a empena fica tracejada no contorno', () => {
    const p = edgesProject(RECT_BOUNDARY, [30, null, 30, null]);
    const o = roofSelectionOps(p, 'lv_0', ['r'], null, LIGHT, VIEW(100));
    expect(o.fills.filter((f) => f.color === LIGHT.accent)).toHaveLength(2);
    expect(o.strokes.filter((s) => s.closed && s.pts.length === 3 && s.color === LIGHT.inkSoft)).toHaveLength(2);
    expect(o.strokes.some((s) => s.dash && s.color === LIGHT.select)).toBe(true);
  });

  it('o símbolo só aparece com o telhado selecionado', () => {
    const p = edgesProject(L_BOUNDARY, [30, 30, 30, 30, 30, 30]);
    const o = roofSelectionOps(p, 'lv_0', [], null, LIGHT, VIEW(100));
    expect(o.fills.some((f) => f.color === LIGHT.accent)).toBe(false);
    expect(o.labels.some((l) => l.text === '30 %')).toBe(false);
  });
});

describe('cota da cumeeira e planta de cobertura (D6)', () => {
  it('cota absoluta da cumeeira no ponto médio, só com etiquetas ligadas', () => {
    expect(ops([gable()]).labels.some((l) => l.text.startsWith('▲'))).toBe(false);
    const o = roofOps([gable()], projectWithRoof(true), LIGHT, false, 'medium', VIEW(100));
    const rd = o.labels.find((l) => l.text.startsWith('▲'))!;
    expect(rd.text).toBe('▲ +3,70');
    expect(rd.at).toEqual(P(4, 3));
  });

  it('planta de cobertura: água opaca (alpha 1) e cota da cumeeira mesmo sem etiquetas', () => {
    const o = roofOps([gable()], createEmptyProject(), LIGHT, false, 'medium', VIEW(100), { planMode: true });
    expect(o.fills.filter((f) => f.alpha !== 1)).toHaveLength(0);
    expect(o.labels.map((l) => l.text)).toContain('▲ +3,70');
  });

  it('roofPlanMode na lista: telhado opaco, paredes só como contorno fino por cima, sem traços de piso por baixo', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: 'wt_alv14', levelId: 'lv_0', a: P(0, 0), b: P(8, 0) }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'b', typeId: 'wt_alv14', levelId: 'lv_0', a: P(8, 0), b: P(8, 6) }) });
    s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 6.3), P(-0.3, 6.3)], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }) });
    const p = s.project;
    const dl = buildPlanDrawList(input(p, { roofPlanMode: true }));
    expect(dl.fills.filter((f) => f.alpha < 1)).toHaveLength(0);
    expect(dl.labels.some((l) => /^▲ \+\d,\d\d$/.test(l.text))).toBe(true);
    // paredes: contorno fino de 1 px, e nenhum contorno grosso de parede (2,2 px fechado) sobra
    expect(dl.strokes.some((st) => st.widthPx === 1 && st.closed && st.color === LIGHT.inkSoft && st.alpha === 0.8)).toBe(true);
    expect(dl.strokes.some((st) => st.widthPx === 2.2 && st.closed)).toBe(false);
  });

  it('roofPlanMode: os telhados de baixo entram opacos, só o preenchimento (sem a faixa apagada)', () => {
    const p = projectWithRoof();
    const below = gable();
    const dl = buildPlanDrawList(input(p, { roofPlanMode: true, below: resolveLevel(p, 'lv_0', new Map()), belowRoofs: [below] }));
    const planeFill = dl.fills.find((f) => JSON.stringify(f.polygons) === JSON.stringify(below.planes[0]!.polygon));
    expect(planeFill?.alpha).toBe(1);
    expect(dl.fills.some((f) => f.color === LIGHT.underlay && f.alpha === 0.22)).toBe(false);
  });
});
