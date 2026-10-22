import { describe, expect, it } from 'vitest';
import type { MultiPolygon, Vec2 } from '@hestia/geom';
import { computeSection } from '@hestia/engine';
import {
  DEFAULT_LINE_WEIGHTS,
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  lineWeightMm,
  makeStair,
  makeWall,
  paperMmToPx,
  type DeepPartial,
  type Opening,
  type OpeningType,
  type StairCurve,
  type StairRun,
  type ViewGraphics,
} from '@hestia/model';
import { LIGHT } from '../plan/types.ts';
import { buildSectionDrawList, type SectionInput } from './build.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

function stairProject() {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 2.8 } : l)) });
  const xs = Array.from({ length: 16 }, (_, k) => k * 0.28);
  const run: StairRun = {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.3, 0.6, 4.5, 0.6)],
    boundaryRight: [ln(-0.3, -0.6, 4.5, -0.6)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [run] }) });
  return store.project;
}

const input = (line: { a: Vec2; b: Vec2; depth: number }, zoom = 60): SectionInput => {
  const project = stairProject();
  return {
    project,
    section: computeSection(project, line),
    viewport: { cx: 2, cy: 1.4, zoom, width: 800, height: 600 },
    theme: LIGHT,
    dark: false,
    showGrid: false,
  };
};

describe('desenho do corte com escada', () => {
  it('o degrau cortado leva a cor e a hachura do material do tipo, com contorno pesado', () => {
    const draw = buildSectionDrawList(input({ a: v(-1, 0), b: v(6, 0), depth: 2 }));
    const hatched = draw.fills.filter((f) => f.hatch);
    expect(hatched.length).toBeGreaterThan(0);
    expect(hatched.some((f) => f.hatch?.kind === 'cross')).toBe(true);
    expect(draw.strokes.some((s) => s.closed && s.widthPx === 2.2)).toBe(true);
  });

  it('a elevação mostra cada degrau como contorno além do plano, sem hachura', () => {
    const draw = buildSectionDrawList(input({ a: v(-1, -3), b: v(6, -3), depth: 6 }));
    expect(draw.fills.filter((f) => f.hatch)).toHaveLength(0);
    // 15 degraus além do plano: cada um com preenchimento e contorno fino
    const thin = draw.strokes.filter((s) => s.closed && s.widthPx === 1);
    expect(thin.length).toBeGreaterThanOrEqual(15);
  });
});

/** Caixa de 6 × 4 m com janela em cada face e uma parede interna; vista de fora (y = −2). */
function boxProject() {
  const store = new ProjectStore(createEmptyProject());
  const walls = [
    ['frente', v(0, 0), v(6, 0)],
    ['fundo', v(6, 4), v(0, 4)],
    ['leste', v(6, 0), v(6, 4)],
    ['oeste', v(0, 4), v(0, 0)],
    ['interna', v(0, 2), v(6, 2)],
  ] as const;
  for (const [id, a, b] of walls) store.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 3 }) });
  for (const host of ['frente', 'fundo', 'interna']) {
    store.exec({ type: 'addOpening', opening: { id: `j_${host}`, kind: 'window', typeId: 'ot_j120', hostId: host, offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  }
  return store.project;
}

/** Vista de fora da caixa de 6 × 4 m (linha em y = −2), usada pelos testes de gráficos. */
function boxInput(): SectionInput {
  const project = boxProject();
  return { project, section: computeSection(project, { a: v(0, -2), b: v(6, -2), depth: 8 }), viewport: { cx: 3, cy: 1.5, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false };
}

describe('desenho do corte com linha oculta', () => {
  const GLASS = '#bfe3f5';
  it('a janela de trás e a da parede interna não são pintadas: só o vidro da face voltada ao observador', () => {
    const draw = buildSectionDrawList(boxInput());
    expect(draw.fills.filter((f) => f.color === GLASS)).toHaveLength(1);
  });

  it('o corte é pintado por último, sobre o que está além', () => {
    const input = stairCut();
    const draw = buildSectionDrawList(input);
    const last = draw.fills.slice(-input.section.cut.length).map((f) => f.polygons);
    expect(last).toEqual(input.section.cut.map((c) => c.polygons));
  });
});

/** Corte transversal de uma escada: tem material cortado e itens além, para testar a ordem de pintura. */
function stairCut(): SectionInput {
  return input({ a: v(-1, 0), b: v(6, 0), depth: 2 });
}

/** Abreviação de abertura para os testes de esquadria. */
const op = (id: string, kind: 'door' | 'window', typeId: string, hostId: string, offset = 3, extra: Partial<Opening> = {}): Opening => ({
  id,
  kind,
  typeId,
  hostId,
  offset,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
  ...extra,
});

/** Parede 'frente' (6 m) com vãos; linha fora da parede (y = −2): vista face (elevação). */
function facade(openings: Opening[], type?: OpeningType): SectionInput {
  const store = new ProjectStore(createEmptyProject());
  if (type) store.exec({ type: 'upsertOpeningType', openingType: type });
  store.exec({ type: 'addWall', wall: makeWall({ id: 'frente', typeId: 'wt_alv14', levelId: 'lv_0', a: v(0, 0), b: v(6, 0), height: 3 }) });
  for (const o of openings) store.exec({ type: 'addOpening', opening: o });
  const project = store.project;
  return { project, section: computeSection(project, { a: v(0, -2), b: v(6, -2), depth: 8 }), viewport: { cx: 3, cy: 1.5, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false };
}

/** Corte transversal à parede (linha vertical em x = 3): a espessura da parede corre no eixo t. */
function cross(openings: Opening[], type?: OpeningType): SectionInput {
  const store = new ProjectStore(createEmptyProject());
  if (type) store.exec({ type: 'upsertOpeningType', openingType: type });
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: v(0, 0), b: v(6, 0), height: 3 }) });
  for (const o of openings) store.exec({ type: 'addOpening', opening: o });
  const project = store.project;
  return { project, section: computeSection(project, { a: v(3, -1), b: v(3, 1), depth: 3 }), viewport: { cx: 0, cy: 1.5, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false };
}

const GLASS_T = '#bfe3f5';
const DOOR_T = '#e6d2ae';
const largura = (polys: MultiPolygon): number => {
  const x = polys.flat(2).map((q) => q.x);
  return Math.max(...x) - Math.min(...x);
};
const altura = (polys: MultiPolygon): number => {
  const y = polys.flat(2).map((q) => q.y);
  return Math.max(...y) - Math.min(...y);
};
const meio = (polys: MultiPolygon): number => {
  const x = polys.flat(2).map((q) => q.x);
  return (Math.min(...x) + Math.max(...x)) / 2;
};
const comTipo = (base: OpeningType, patch: Partial<OpeningType>): OpeningType => ({ ...base, ...patch });

describe('esquadria no corte e na elevação (tipo e família)', () => {
  it('C1: o batente da janela tem a espessura do perfil (frameWidth) do tipo, dentro do vão', () => {
    const d = buildSectionDrawList(facade([op('j', 'window', 'ot_jfixa60', 'frente')]));
    const larguras = d.fills.map((f) => largura(f.polygons));
    // duas ombreiras com a espessura padrão do perfil (0,05 m)
    expect(larguras.filter((w) => Math.abs(w - 0.05) < 1e-6)).toHaveLength(2);
  });

  it('C1: a espessura do batente vem do tipo, não de um valor fixo', () => {
    const tipo = comTipo(createEmptyProject().openingTypes.ot_jfixa60!, { id: 'ot_jfixa80', width: 0.8, frameWidth: 0.08 });
    const d = buildSectionDrawList(facade([op('j', 'window', 'ot_jfixa80', 'frente')], tipo));
    const larguras = d.fills.map((f) => largura(f.polygons));
    expect(larguras.filter((w) => Math.abs(w - 0.08) < 1e-6)).toHaveLength(2);
    expect(larguras.some((w) => Math.abs(w - 0.05) < 1e-6)).toBe(false);
  });

  it('C1: no corte transversal, a verga e a soleira têm a profundidade do batente (frameDepth), centradas na parede', () => {
    const tipo = comTipo(createEmptyProject().openingTypes.ot_jfixa60!, { id: 'ot_jfd', frameDepth: 0.12 });
    const d = buildSectionDrawList(cross([op('j', 'window', 'ot_jfd', 'w')], tipo));
    const verga = d.fills.filter((f) => Math.abs(largura(f.polygons) - 0.12) < 1e-6 && Math.abs(altura(f.polygons) - 0.05) < 1e-6);
    expect(verga).toHaveLength(2); // verga e soleira
    expect(meio(verga[0]!.polygons)).toBeCloseTo(meio(verga[1]!.polygons), 9); // centradas na parede
  });

  it('C2: no corte face, o vidro ocupa a região interna do caixilho', () => {
    const d = buildSectionDrawList(facade([op('j', 'window', 'ot_jfixa60', 'frente')]));
    const vidro = d.fills.filter((f) => f.color === GLASS_T);
    expect(vidro).toHaveLength(1);
    expect(largura(vidro[0]!.polygons)).toBeCloseTo(0.5, 6); // 0,60 − 2 × 0,05
    expect(altura(vidro[0]!.polygons)).toBeCloseTo(0.5, 6);
  });

  it('C2: no corte transversal, o vidro tem a espessura do tipo (glassThickness)', () => {
    const tipo = comTipo(createEmptyProject().openingTypes.ot_jfixa60!, { id: 'ot_jg', glassThickness: 0.03 });
    const d = buildSectionDrawList(cross([op('j', 'window', 'ot_jg', 'w')], tipo));
    const vidro = d.fills.filter((f) => f.color === GLASS_T);
    expect(vidro).toHaveLength(1);
    expect(largura(vidro[0]!.polygons)).toBeCloseTo(0.03, 6);
  });

  it('espessuras do tipo: frameWidth, frameDepth e glassThickness vêm do tipo', () => {
    const tipo = comTipo(createEmptyProject().openingTypes.ot_jfixa60!, { id: 'ot_esp', width: 0.9, frameWidth: 0.07, frameDepth: 0.1, glassThickness: 0.02 });
    const face = buildSectionDrawList(facade([op('j', 'window', 'ot_esp', 'frente')], tipo));
    expect(face.fills.map((f) => largura(f.polygons)).filter((w) => Math.abs(w - 0.07) < 1e-6)).toHaveLength(2); // ombreiras
    expect(largura(face.fills.find((f) => f.color === GLASS_T)!.polygons)).toBeCloseTo(0.9 - 2 * 0.07, 6);
    const corte = buildSectionDrawList(cross([op('j', 'window', 'ot_esp', 'w')], tipo));
    expect(corte.fills.some((f) => Math.abs(largura(f.polygons) - 0.1) < 1e-6)).toBe(true); // verga/soleira
    expect(largura(corte.fills.find((f) => f.color === GLASS_T)!.polygons)).toBeCloseTo(0.02, 6); // vidro
  });

  it('C6: a linha central do vidro só aparece na janela de correr (2+ folhas)', () => {
    const montantes = (d: ReturnType<typeof buildSectionDrawList>): number => d.strokes.filter((s) => !s.closed && s.alpha === 0.7).length;
    expect(montantes(buildSectionDrawList(facade([op('jf', 'window', 'ot_jfixa60', 'frente')])))).toBe(0); // fixa, 1 folha
    expect(montantes(buildSectionDrawList(facade([op('jc', 'window', 'ot_j120', 'frente')])))).toBe(1); // correr, 2 folhas
    expect(montantes(buildSectionDrawList(facade([op('j3', 'window', 'ot_j240', 'frente')])))).toBe(2); // correr, 3 folhas
  });

  it('C5: o vão livre de porta não tem preenchimento; a porta com folha tem', () => {
    expect(buildSectionDrawList(facade([op('v', 'door', 'ot_vao90', 'frente')])).fills.filter((f) => f.color === DOOR_T)).toHaveLength(0);
    expect(buildSectionDrawList(facade([op('p', 'door', 'ot_p80', 'frente')])).fills.filter((f) => f.color === DOOR_T)).toHaveLength(1);
  });

  it('E1: a janela maxim-ar mostra o símbolo tracejado de abertura no topo da elevação', () => {
    const input = facade([op('j', 'window', 'ot_j60', 'frente')]);
    const d = buildSectionDrawList(input);
    const tracos = d.strokes.filter((s) => s.dash?.[0] === 4);
    expect(tracos).toHaveLength(1);
    const o = input.section.openings[0]!;
    expect(tracos[0]!.pts.every((q) => q.y >= o.z0 - 1e-9 && q.y <= o.z1 + 1e-9)).toBe(true);
  });

  it('E1: a porta de giro mostra o símbolo tracejado do lado da dobradiça', () => {
    const d = buildSectionDrawList(facade([op('p', 'door', 'ot_p80', 'frente', 3, { flipHand: true })]));
    const tracos = d.strokes.filter((s) => s.dash?.[0] === 4);
    expect(tracos).toHaveLength(1);
    expect(tracos[0]!.pts[0]!.x).toBeCloseTo(3.4, 6); // dobradiça à direita (t1)
  });

  it('E2: a janela e a porta de correr mostram a seta de correr; a fixa não', () => {
    expect(buildSectionDrawList(facade([op('j', 'window', 'ot_j120', 'frente')])).strokes.filter((s) => s.dash?.[0] === 4).length).toBeGreaterThanOrEqual(2);
    expect(buildSectionDrawList(facade([op('p', 'door', 'ot_pc160', 'frente')])).strokes.filter((s) => s.dash?.[0] === 4).length).toBeGreaterThanOrEqual(2);
    expect(buildSectionDrawList(facade([op('jf', 'window', 'ot_jfixa60', 'frente')])).strokes.filter((s) => s.dash?.[0] === 4)).toHaveLength(0);
  });
});


/** Corte transversal da caixa (linha em x = 3): as paredes perpendiculares à linha entram cortadas, com o peso de corte. */
function cutInput(): SectionInput {
  const project = boxProject();
  return { ...boxInput(), section: computeSection(project, { a: v(3, -1), b: v(3, 5), depth: 8 }) };
}

/** A vista de fora de uma caixa com uma janela em cada face, com os gráficos do corte salvos pelo comando real. */
function styledBox(patch: DeepPartial<ViewGraphics>, base: () => SectionInput = boxInput): SectionInput {
  const i = base();
  const store = new ProjectStore(i.project);
  store.exec({ type: 'setSectionGraphics', patch });
  return { ...i, project: store.project };
}

/** Larguras fechadas do desenho (sem repetição), para achar o peso de cada categoria. */
const closedWidths = (d: ReturnType<typeof buildSectionDrawList>): number[] =>
  [...new Set(d.strokes.filter((s) => s.closed).map((s) => s.widthPx))];

const weightPx = (weight: number, scale: number): number => paperMmToPx(lineWeightMm(DEFAULT_LINE_WEIGHTS, weight, scale), 60, scale);

describe('gráficos do corte/elevação (decisão 0015)', () => {
  it('a escala muda a largura da parede cortada (peso 5): 3 px em 1:100 e 2,1 px em 1:50 (espessura em papel)', () => {
    const at100 = closedWidths(buildSectionDrawList(styledBox({ scale: 100 }, cutInput)));
    const at50 = closedWidths(buildSectionDrawList(styledBox({ scale: 50 }, cutInput)));
    expect(at100.some((w) => Math.abs(w - weightPx(5, 100)) < 1e-9)).toBe(true);
    expect(at50.some((w) => Math.abs(w - weightPx(5, 50)) < 1e-9)).toBe(true);
    expect(weightPx(5, 100)).toBeGreaterThan(weightPx(5, 50));
  });

  it('o que está além leva o peso de projeção da categoria (parede 2), não o de corte', () => {
    const widths = closedWidths(buildSectionDrawList(styledBox({ scale: 100 })));
    expect(widths.some((w) => Math.abs(w - weightPx(2, 100)) < 1e-9)).toBe(true);
  });

  it('categoria oculta some: janela oculta não pinta vidro; parede oculta não deixa o corte nem a hachura', () => {
    const semJanela = buildSectionDrawList(styledBox({ overrides: { window: { visible: false } } }));
    expect(semJanela.fills.filter((f) => f.color === '#bfe3f5')).toHaveLength(0);
    const semParede = buildSectionDrawList(styledBox({ overrides: { wall: { visible: false } } }, cutInput));
    expect(semParede.fills.filter((f) => f.hatch)).toHaveLength(0);
    expect(closedWidths(semParede)).not.toContain(weightPx(5, 100));
  });

  it('arame não preenche (nem hachura); grosso fica só com os contornos', () => {
    const arame = buildSectionDrawList(styledBox({ style: 'wireframe' }));
    expect(arame.fills).toHaveLength(0);
    const grosso = buildSectionDrawList(styledBox({ detail: 'coarse' }));
    expect(grosso.fills).toHaveLength(0);
  });

  it('sem gráficos salvos o hiddenLine continua com os traços fixos de antes (silhueta 2,2 e além 1)', () => {
    const d = buildSectionDrawList(boxInput());
    expect(d.strokes.filter((s) => s.closed).some((s) => s.widthPx === 2.2)).toBe(true);
    expect(d.strokes.filter((s) => s.closed && s.widthPx === 1).length).toBeGreaterThan(0);
  });
});
