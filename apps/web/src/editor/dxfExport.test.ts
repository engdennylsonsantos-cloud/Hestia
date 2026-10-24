import { describe, expect, it } from 'vitest';
import { generateSpiralRun, generateStraightRun, levelFrames, openingGeometry, resolveStairsOnLevel } from '@hestia/engine';
import { openingSymbolPaths } from '@hestia/geom';
import { DXF_LAYER_CORTES, DXF_LAYER_ELEVACOES, dxfLayerOfFloor, dxfLayerOfMaterial, dxfLayerOfSlab, dxfLineWeight, type DxfLevelGeometry } from '@hestia/io';
import {
  ProjectStore,
  buildTemplate,
  graphicsOf,
  lineWeightMm,
  makeFloor,
  makeRoof,
  makeSlab,
  makeStair,
  makeWall,
  type CategoryOverride,
  type GraphicsCategory,
  type Opening,
  type Project,
  type StairRun,
  type ViewGraphics,
  type ViewRange,
} from '@hestia/model';
import { climbWalk, planViewOf, risersInClimbOrder } from '@hestia/render';
import { arrowOfPath, lineWeightsOf, planDxf, sectionDxf, sectionDxfGeometryOf, sectionLineWeightsOf, stairArrow } from './dxfExport.ts';

/** Duas paredes em L no térreo, com uma porta na primeira. Passa pelo engine real, como no app. */
function lPlan(): ProjectStore {
  const store = new ProjectStore(buildTemplate('blank'));
  const typeId = store.project.defaults.wallTypeId;
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId, levelId: 'lv_0', a: { x: 6, y: 0 }, b: { x: 6, y: 4 } }) });
  const door: Opening = {
    id: 'to_door',
    kind: 'door',
    typeId: store.project.defaults.doorTypeId,
    hostId: 'w1',
    offset: 3,
    flipHand: false,
    flipFacing: false,
    sillOverride: null,
    mark: '',
  };
  store.exec({ type: 'addOpening', opening: door });
  return store;
}

/** Polilinha lida do DXF: camada, se é fechada e os vértices. */
interface Poly {
  layer: string;
  closed: boolean;
  pts: Array<{ x: number; y: number }>;
}

/** Leitor mínimo de polilinhas (POLYLINE + VERTEX + SEQEND) do texto DXF, na ordem em que aparecem. */
function polylinesOf(text: string): Poly[] {
  const recs: Array<{ type: string; fields: Array<[string, string]> }> = [];
  const lines = text.split('\r\n');
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i]!.trim();
    const value = lines[i + 1]!.trim();
    if (code === '0') recs.push({ type: value, fields: [] });
    else recs.at(-1)?.fields.push([code, value]);
  }
  const field = (fs: Array<[string, string]>, code: string): string | undefined => fs.find(([c]) => c === code)?.[1];
  const out: Poly[] = [];
  let cur: Poly | null = null;
  for (const r of recs) {
    if (r.type === 'POLYLINE') cur = { layer: field(r.fields, '8') ?? '', closed: (Number(field(r.fields, '70') ?? 0) & 1) === 1, pts: [] };
    else if (r.type === 'VERTEX' && cur) cur.pts.push({ x: Number(field(r.fields, '10')), y: Number(field(r.fields, '20')) });
    else if (r.type === 'SEQEND' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

/** Polilinhas de um nível, sem as de vão (`ABERTURA*`): a parede e o resto do desenho, para comparar com e sem o vão. */
const notOpening = (text: string): Poly[] => polylinesOf(text).filter((p) => !p.layer.startsWith('ABERTURA'));

describe('planDxf com o engine real', () => {
  it('um L com porta: camadas de parede, contorno, abertura e polilinhas fechadas', () => {
    const store = lPlan();
    const p = store.project;
    const text = planDxf(p, 'lv_0');

    const wallLayers = p.wallTypes[p.defaults.wallTypeId]!.layers.map((l) => dxfLayerOfMaterial(p.materials[l.materialId]!.name));
    for (const layer of new Set(wallLayers)) expect(text).toContain(`\r\n${layer}\r\n`);
    expect(text).toContain('\r\nPAREDE_CONTORNO\r\n');
    expect(text).toContain('\r\nABERTURA_SIMBOLO\r\n');

    // cada polilinha abre com 0/POLYLINE e fecha com SEQEND: contagem por registro
    const polylines = text.match(/\r\n0\r\nPOLYLINE\r\n/g) ?? [];
    const seqends = text.match(/\r\n0\r\nSEQEND\r\n/g) ?? [];
    expect(polylines.length).toBeGreaterThanOrEqual(3);
    expect(seqends).toHaveLength(polylines.length);
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });

  it('nível sem paredes ainda gera arquivo válido, sem polilinhas', () => {
    const p = buildTemplate('blank');
    const text = planDxf(p, 'lv_0');
    expect(text).not.toContain('\r\nPOLYLINE\r\n');
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });
});

/** Projeto de vista (decisão 0013): térreo com paredes isoladas por caso, um piso e um nível de cima com laje. */
function vistaPlan(): ProjectStore {
  const store = new ProjectStore(buildTemplate('blank'));
  const { wallTypeId, windowTypeId } = store.project.defaults;
  const wall = (id: string, a: { x: number; y: number }, b: { x: number; y: number }, extra: { baseOffset?: number; height?: number } = {}): void =>
    store.exec({ type: 'addWall', wall: makeWall({ id, typeId: wallTypeId, levelId: 'lv_0', a, b, ...extra }) });
  // Parede de 2,80 m com janela de peitoril 1,50 (acima do corte): a parede fica inteira.
  wall('wAlta', { x: 0, y: 0 }, { x: 4, y: 0 });
  // Parede com janela de peitoril 0,90 (atravessa o corte): fura a parede.
  wall('wCorta', { x: 0, y: 5 }, { x: 4, y: 5 });
  // Parede com janela de peitoril 2,40 (acima do topo do intervalo): a janela não sai.
  wall('wAlem', { x: 0, y: 10 }, { x: 4, y: 10 });
  // Parede que começa acima do corte (base 1,50) e parede que termina abaixo dele (0,80 de altura): contorno de projeção.
  wall('wProjAcima', { x: 0, y: 15 }, { x: 4, y: 15 }, { baseOffset: 1.5, height: 0.8 });
  wall('wProjAbaixo', { x: 0, y: 20 }, { x: 4, y: 20 }, { height: 0.8 });
  const janela = (id: string, hostId: string, sill: number): void => {
    const o: Opening = { id, kind: 'window', typeId: windowTypeId, hostId, offset: 2, flipHand: false, flipFacing: false, sillOverride: sill, mark: '' };
    store.exec({ type: 'addOpening', opening: o });
  };
  janela('jAlta', 'wAlta', 1.5);
  janela('jCorta', 'wCorta', 0.9);
  janela('jAlem', 'wAlem', 2.4);
  store.exec({ type: 'addFloor', floor: makeFloor({ id: 'pisoTerreo', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 6, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 3 }, { x: 6, y: 3 }] }) });
  // Laje do nível de cima (lv_1, cota 2,80) e uma laje do térreo com a face acima do topo (cota 2,80).
  store.exec({ type: 'addSlab', slab: makeSlab({ id: 'lajeCima', typeId: 'ls_mac12', levelId: 'lv_1', boundary: [{ x: 0, y: 30 }, { x: 4, y: 30 }, { x: 4, y: 33 }, { x: 0, y: 33 }] }) });
  store.exec({ type: 'addSlab', slab: makeSlab({ id: 'lajeAlta', typeId: 'ls_mac12', levelId: 'lv_0', heightOffset: 2.8, boundary: [{ x: 12, y: 30 }, { x: 15, y: 30 }, { x: 15, y: 33 }, { x: 12, y: 33 }] }) });
  return store;
}

/** Cópia do projeto sem um vão (para comparar o desenho com e sem ele). */
function without(p: Project, openingId: string): Project {
  const q = structuredClone(p);
  delete q.elements[openingId];
  return q;
}

describe('vista da planta no DXF (decisão 0013 §4)', () => {
  it('janela de peitoril 1,50 acima do corte: a parede sai inteira e o vão vai para ABERTURA_ACIMA (tracejado)', () => {
    const p = vistaPlan().project;
    const text = planDxf(p, 'lv_0');
    const above = polylinesOf(text).filter((x) => x.layer === 'ABERTURA_ACIMA');
    // o símbolo da janela (caixilho, ombreiras, folhas) sai inteiro, não um retângulo só
    const wp = p.elements['jAlta'] as Opening;
    const wf = levelFrames(p, 'lv_0').find((f) => f.wall.id === wp.hostId)!;
    expect(above).toHaveLength(openingSymbolPaths(openingGeometry(p, wp, wf)).length);
    expect(above.length).toBeGreaterThan(1);
    // o vão de 1,50 não aparece nas camadas de corte: em ABERTURA_SIMBOLO sai só o símbolo da janela de 0,90 (decisão X1)
    const jc = p.elements['jCorta'] as Opening;
    const jcf = levelFrames(p, 'lv_0').find((f) => f.wall.id === jc.hostId)!;
    expect(polylinesOf(text).filter((x) => x.layer === 'ABERTURA_SIMBOLO')).toHaveLength(openingSymbolPaths(openingGeometry(p, jc, jcf)).length);
    // a parede com a janela alta é igual à mesma parede sem janela (furo nenhum)
    expect(notOpening(text).filter((x) => x.pts.some((v) => v.y < 1 && v.y > -1))).toEqual(
      notOpening(planDxf(without(p, 'jAlta'), 'lv_0')).filter((x) => x.pts.some((v) => v.y < 1 && v.y > -1)),
    );
    expect(text).toContain('\r\nDASHED\r\n');
  });

  it('janela de peitoril 0,90 cruza o corte: fura a parede e sai em ABERTURA_SIMBOLO', () => {
    const p = vistaPlan().project;
    const text = planDxf(p, 'lv_0');
    const cut = polylinesOf(text).filter((x) => x.layer === 'ABERTURA_SIMBOLO' && x.pts.some((v) => v.y > 4 && v.y < 6));
    // Decisão X1: o vão de corte sai com o símbolo de planta, o mesmo da tela (antes era um retângulo só).
    const jc = p.elements['jCorta'] as Opening;
    const jcf = levelFrames(p, 'lv_0').find((f) => f.wall.id === jc.hostId)!;
    expect(cut).toHaveLength(openingSymbolPaths(openingGeometry(p, jc, jcf)).length);
    expect(cut.length).toBeGreaterThan(1);
    // a parede da janela de 0,90 tem outro desenho com o vão do que sem ele
    const band = (ps: Poly[]): Poly[] => ps.filter((x) => x.pts.some((v) => v.y > 4 && v.y < 6));
    expect(band(notOpening(text))).not.toEqual(band(notOpening(planDxf(without(p, 'jCorta'), 'lv_0'))));
  });

  it('janela de peitoril 2,40 (acima do topo do intervalo) não sai, nem fura a parede', () => {
    const p = vistaPlan().project;
    const text = planDxf(p, 'lv_0');
    const aberturas = polylinesOf(text).filter((x) => x.layer.startsWith('ABERTURA'));
    expect(aberturas.some((x) => x.pts.some((v) => Math.abs(v.y - 10) < 1))).toBe(false);
    const band = (ps: Poly[]): Poly[] => ps.filter((x) => x.pts.some((v) => Math.abs(v.y - 10) < 1));
    expect(band(notOpening(text))).toEqual(band(notOpening(planDxf(without(p, 'jAlem'), 'lv_0'))));
  });

  it('parede acima do corte vai para PAREDE_PROJECAO_ACIMA e parede abaixo do corte para PAREDE_PROJECAO_ABAIXO', () => {
    const text = planDxf(vistaPlan().project, 'lv_0');
    expect(polylinesOf(text).filter((x) => x.layer === 'PAREDE_PROJECAO_ACIMA').some((x) => x.pts.some((v) => Math.abs(v.y - 15) < 1))).toBe(true);
    expect(polylinesOf(text).filter((x) => x.layer === 'PAREDE_PROJECAO_ABAIXO').some((x) => x.pts.some((v) => Math.abs(v.y - 20) < 1))).toBe(true);
    // as paredes de projeção não entram nas camadas de corte
    expect(polylinesOf(text).some((x) => /^PAREDE_/.test(x.layer) && !x.layer.startsWith('PAREDE_PROJECAO') && x.pts.some((v) => Math.abs(v.y - 15) < 1 && v.x > 3))).toBe(false);
  });

  it('piso do nível sai; laje do nível de cima e laje com a face acima do topo não saem', () => {
    const p = vistaPlan().project;
    const text = planDxf(p, 'lv_0');
    expect(text).toContain('\r\nPISO_PS_01\r\n');
    expect(text).not.toContain('LAJE_');
    // o nível de cima mostra a própria laje (cota 2,80 é o nível dele)
    expect(planDxf(p, 'lv_1')).toContain('\r\nLAJE_LJ_12\r\n');
  });

  it('corte de escada da vista: degraus até o corte cheios, acima dele tracejados, com o símbolo de corte', () => {
    const store = new ProjectStore(buildTemplate('blank'));
    const sketch = generateStraightRun({ start: { x: 10, y: 0 }, dir: { x: 0, y: 1 }, width: 1.2, risers: 5, tread: 0.28 });
    const run: StairRun = { id: 'r1', kind: 'run', ...sketch };
    store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', components: [run] }) });
    const p = store.project;
    const s = resolveStairsOnLevel(p, 'lv_0')[0]!;
    const withRange = (range: Partial<ViewRange>): Project => ({ ...p, levels: p.levels.map((l) => (l.id === 'lv_0' ? { ...l, viewRange: { ...l.viewRange, ...range } } : l)) });

    // corte 0,50: nenhum degrau fica abaixo do corte; os quatro até o topo (2,30) são tracejados
    const low = planDxf(withRange({ cut: 0.5 }), 'lv_0');
    const cutSide = (ps: Poly[], layer: string): Poly[] => ps.filter((x) => x.layer === layer);
    expect(cutSide(polylinesOf(low), 'ESCADA')).toHaveLength(s.steps.filter((st) => st.z <= 0.5 + 1e-9).length);
    expect(cutSide(polylinesOf(low), 'ESCADA_ACIMA')).toHaveLength(s.steps.filter((st) => st.z > 0.5 + 1e-9 && st.z <= 2.3 + 1e-9).length);
    const cutSymbol = cutSide(polylinesOf(low), 'ESCADA_CORTE');
    expect(cutSymbol).toHaveLength(1);
    expect(cutSymbol[0]!.closed).toBe(false);

    // corte padrão (1,20): a divisão cai entre os degraus, e o símbolo de corte continua presente
    const std = polylinesOf(planDxf(p, 'lv_0'));
    const stdCut = std.filter((x) => x.layer === 'ESCADA').length;
    const stdAbove = std.filter((x) => x.layer === 'ESCADA_ACIMA').length;
    expect(stdCut + stdAbove).toBe(s.steps.filter((st) => st.z <= 2.3 + 1e-9).length);
    expect(stdAbove).toBeGreaterThan(0);
    expect(std.filter((x) => x.layer === 'ESCADA_CORTE')).toHaveLength(1);
  });
});

describe('escadas no DXF (camadas ESCADA, ESCADA_ESPELHO e ESCADA_SETA)', () => {
  it('um lance reto com 5 espelhos: degraus e espelhos até o topo do intervalo, e a seta de subida', () => {
    const store = new ProjectStore(buildTemplate('blank'));
    const sketch = generateStraightRun({ start: { x: 0.6, y: 0 }, dir: { x: 0, y: 1 }, width: 1.2, risers: 5, tread: 0.28 });
    const run: StairRun = { id: 'r1', kind: 'run', ...sketch };
    store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', components: [run] }) });
    const p = store.project;
    const text = planDxf(p, 'lv_0');

    // Conta registros de entidade (0/POLYLINE ou 0/LINE seguido da camada), não ocorrências do nome da camada.
    // Degraus em 0,60 / 1,20 / 1,80 / 2,40 m. Até o topo do intervalo (2,30 m) ficam 3: 2 cheios (até a cota de corte,
    // 1,20 m, inclusive) e 1 tracejado (acima dela). O de 2,40 m sai. Espelhos: os 3 com topo até 2,30 m.
    const polylines = text.match(/\r\n0\r\nPOLYLINE\r\n8\r\nESCADA\r\n/g) ?? [];
    expect(polylines).toHaveLength(2);
    const above = text.match(/\r\n0\r\nPOLYLINE\r\n8\r\nESCADA_ACIMA\r\n/g) ?? [];
    expect(above).toHaveLength(1);
    const risers = text.match(/\r\n0\r\nLINE\r\n8\r\nESCADA_ESPELHO\r\n/g) ?? [];
    expect(risers).toHaveLength(3);
    // seta: haste e duas pontas
    const arrow = text.match(/\r\n0\r\nLINE\r\n8\r\nESCADA_SETA\r\n/g) ?? [];
    expect(arrow).toHaveLength(3);
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });

  it('sem escada, nenhuma camada de escada aparece', () => {
    const p = buildTemplate('blank');
    const text = planDxf(p, 'lv_0');
    expect(text).not.toContain('ESCADA');
  });

  it('a seta sai do primeiro espelho e aponta para o último (no sentido da subida)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 2 };
    const arrow = stairArrow(a, b);
    expect(arrow[0]).toEqual([a, b]);
    // as pontas ficam atrás da ponta da seta (y menor que 2)
    for (const [, end] of arrow.slice(1)) expect(end.y).toBeLessThan(2);
    expect(stairArrow(a, a)).toEqual([]);
  });
});

/** Segmentos LINE de uma camada do DXF (ponto inicial e final). */
function linesIn(text: string, layer: string): Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> {
  const lines = text.split('\r\n');
  const out: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i]!.trim() !== '0' || lines[i + 1]!.trim() !== 'LINE') continue;
    const fields = new Map<string, string>();
    for (let j = i + 2; j + 1 < lines.length && lines[j]!.trim() !== '0'; j += 2) fields.set(lines[j]!.trim(), lines[j + 1]!.trim());
    if (fields.get('8') !== layer) continue;
    out.push({ a: { x: Number(fields.get('10')), y: Number(fields.get('20')) }, b: { x: Number(fields.get('11')), y: Number(fields.get('21')) } });
  }
  return out;
}

/** Porta numa parede que começa em 1,50 m, acima do corte padrão (1,20 m): o vão inteiro fica acima do corte. */
function doorAboveCut(): Project {
  const store = new ProjectStore(buildTemplate('blank'));
  const { wallTypeId, doorTypeId } = store.project.defaults;
  store.exec({ type: 'addWall', wall: makeWall({ id: 'wAlto', typeId: wallTypeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, baseOffset: 1.5 }) });
  const door: Opening = { id: 'dAlta', kind: 'door', typeId: doorTypeId, hostId: 'wAlto', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
  store.exec({ type: 'addOpening', opening: door });
  return store.project;
}

/** Lance reto em +x com caminhada explícita em arco (flecha 0,3 m), como o do teste da seta na planta. */
function curvedRunStair(): Project {
  const store = new ProjectStore(buildTemplate('blank'));
  // 17 espelhos subindo 3 m (0,18 m cada, o máximo do tipo): com menos, o espelho passa do máximo e o motor recusa.
  const N = 17;
  const P = 0.28;
  const ln = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag: 0 });
  const x1 = (N + 1) * P;
  const run: StairRun = {
    id: 'r_curva',
    kind: 'run',
    boundaryLeft: [ln(0, 0.5, x1, 0.5)],
    boundaryRight: [ln(0, -0.5, x1, -0.5)],
    risers: Array.from({ length: N }, (_, i) => ln((i + 1) * P, -1, (i + 1) * P, 1)),
    path: [{ a: { x: P, y: 0 }, b: { x: N * P, y: 0 }, sag: 0.3 }],
  };
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st_curva', typeId: 'stt_monolitica', levelId: 'lv_0', components: [run] }) });
  return store.project;
}

describe('projeção da cobertura no DXF respeita a preferência (decisão 0013 §4)', () => {
  /** Telhado com o beiral em 3 m, acima do topo do intervalo (2,30 m): fica fora do intervalo e vira projeção. */
  function roofAboveTop(): Project {
    const store = new ProjectStore(buildTemplate('blank'));
    store.exec({
      type: 'addRoof',
      roof: makeRoof({
        id: 'rCima',
        typeId: 'rt_ceramica',
        levelId: 'lv_0',
        boundary: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }],
        shape: 'hip',
        slopePercent: 30,
        heightOffset: 3,
      }),
    });
    return store.project;
  }

  it('com a preferência ligada (padrão), o contorno sai em TELHADO_PROJECAO', () => {
    expect(planDxf(roofAboveTop(), 'lv_0')).toContain('\r\nTELHADO_PROJECAO\r\n');
  });

  it('com a preferência desligada, o contorno da cobertura não sai', () => {
    expect(planDxf(roofAboveTop(), 'lv_0', false)).not.toContain('TELHADO_PROJECAO');
  });
});

describe('símbolo dos vãos de projeção: o mesmo da planta', () => {
  it('porta acima do corte: folha e arco em ABERTURA_ACIMA (tracejada), iguais aos da tela, sem retângulo', () => {
    const p = doorAboveCut();
    const text = planDxf(p, 'lv_0');
    const above = polylinesOf(text).filter((x) => x.layer === 'ABERTURA_ACIMA');
    const frame = levelFrames(p, 'lv_0').find((f) => f.wall.id === 'wAlto')!;
    const screen = openingSymbolPaths(openingGeometry(p, p.elements['dAlta'] as Opening, frame));
    expect(screen.map((s) => s.pts.length)).toEqual([2, 19]);
    expect(above).toHaveLength(screen.length);
    screen.forEach((s, i) => {
      expect(above[i]!.closed).toBe(s.closed);
      s.pts.forEach((q, j) => {
        expect(above[i]!.pts[j]!.x).toBeCloseTo(q.x, 5);
        expect(above[i]!.pts[j]!.y).toBeCloseTo(q.y, 5);
      });
    });
    // o vão não cai nas camadas de corte, e a camada de projeção é tracejada
    expect(polylinesOf(text).filter((x) => x.layer === 'ABERTURAS')).toHaveLength(0);
    expect(text).toContain('\r\nDASHED\r\n');
  });

  it('escada com caminhada explícita curva: a seta segue a caminhada da tela, não a corda entre os pontos médios', () => {
    const p = curvedRunStair();
    const [s] = resolveStairsOnLevel(p, 'lv_0');
    expect(s!.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const walk = climbWalk(p, s!, risersInClimbOrder(s!).filter((k) => k.z1 <= 2.3 + 1e-9));
    const arrow = linesIn(planDxf(p, 'lv_0'), 'ESCADA_SETA');
    // haste (um trecho por segmento da caminhada) e as duas pontas no fim
    const shaft = arrow.slice(0, -2);
    expect(shaft.length).toBeGreaterThan(2);
    expect(shaft[0]!.a.x).toBeCloseTo(walk[0]!.x, 5);
    expect(shaft[0]!.a.y).toBeCloseTo(walk[0]!.y, 5);
    expect(shaft.at(-1)!.b.x).toBeCloseTo(walk.at(-1)!.x, 5);
    expect(shaft.at(-1)!.b.y).toBeCloseTo(walk.at(-1)!.y, 5);
    // a flecha de 0,3 m aparece na haste: a corda entre o primeiro e o último espelho ficaria em y = 0
    expect(Math.max(...shaft.flatMap((seg) => [Math.abs(seg.a.y), Math.abs(seg.b.y)]))).toBeGreaterThan(0.1);
  });
});

describe('caracol no DXF (decisão 0014 §1 item 10)', () => {
  /** Caracol de 540° (19 espelhos) no térreo, com o tipo de poste central, como o app o cria. */
  function spiralStore(): ProjectStore {
    const store = new ProjectStore(buildTemplate('blank'));
    const sk = generateSpiralRun({ center: { x: 0, y: 0 }, rInner: 0.1, rOuter: 1, startAngle: 0, sweep: (540 * Math.PI) / 180, risers: 19 });
    const run: StairRun = { id: 'r1', kind: 'run', ...sk };
    store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_caracol_poste', levelId: 'lv_0', components: [run] }) });
    return store;
  }

  it('volta de baixo em ESCADA e volta de cima em ESCADA_ACIMA, na cota de corte e no topo da vista', () => {
    const p = spiralStore().project;
    const [st] = resolveStairsOnLevel(p, 'lv_0');
    const view = planViewOf(p, 'lv_0');
    const steps = st!.steps.filter((k) => k.z <= view.topZ + 1e-9);
    const polys = polylinesOf(planDxf(p, 'lv_0'));
    // Com 540° e topo de 2,30 m, há degraus dos dois lados da cota de corte (senão o teste não prova nada).
    expect(steps.filter((k) => k.z <= view.cutZ + 1e-9).length).toBeGreaterThan(0);
    expect(steps.filter((k) => k.z > view.cutZ + 1e-9).length).toBeGreaterThan(0);
    expect(polys.filter((x) => x.layer === 'ESCADA')).toHaveLength(steps.filter((k) => k.z <= view.cutZ + 1e-9).length);
    expect(polys.filter((x) => x.layer === 'ESCADA_ACIMA')).toHaveLength(steps.filter((k) => k.z > view.cutZ + 1e-9).length);
  });

  it('o poste sai em ESCADA_POSTE: círculo fechado de 48 lados, de raio rInner', () => {
    const polys = polylinesOf(planDxf(spiralStore().project, 'lv_0'));
    const post = polys.filter((x) => x.layer === 'ESCADA_POSTE');
    expect(post).toHaveLength(1);
    expect(post[0]!.closed).toBe(true);
    expect(post[0]!.pts).toHaveLength(48);
    for (const q of post[0]!.pts) expect(Math.hypot(q.x, q.y)).toBeCloseTo(0.1, 5);
  });

  it('a seta segue a caminhada em arcos (muitos trechos de haste), com as duas pontas; o corte sai na cota de 1,20 m', () => {
    const text = planDxf(spiralStore().project, 'lv_0');
    expect((text.match(/\r\n0\r\nLINE\r\n8\r\nESCADA_SETA\r\n/g) ?? []).length).toBeGreaterThan(19);
    expect(polylinesOf(text).filter((x) => x.layer === 'ESCADA_CORTE')).toHaveLength(1);
  });
});

describe('arrowOfPath (seta sobre a caminhada)', () => {
  it('vértices colineares saem: uma haste reta continua com um trecho e duas pontas', () => {
    expect(arrowOfPath([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }])).toHaveLength(3);
  });

  it('caminhada em L: um trecho de haste por lado, pontas no fim atrás do último trecho', () => {
    const arrow = arrowOfPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(arrow).toHaveLength(4);
    for (const [, end] of arrow.slice(2)) expect(end.y).toBeLessThan(1);
  });

  it('menos de dois pontos distintos não tem seta', () => {
    expect(arrowOfPath([{ x: 0, y: 0 }])).toEqual([]);
    expect(arrowOfPath([{ x: 0, y: 0 }, { x: 0, y: 0 }])).toEqual([]);
  });
});

/** Tabela LAYER do texto DXF: camada e código 370 (`undefined` = a entrada não tem 370). */
function layerTable(text: string): Map<string, number | undefined> {
  const recs: Array<{ type: string; fields: Array<[string, string]> }> = [];
  const lines = text.split('\r\n');
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i]!.trim();
    const value = lines[i + 1]!.trim();
    if (code === '0') recs.push({ type: value, fields: [] });
    else recs.at(-1)?.fields.push([code, value]);
  }
  const out = new Map<string, number | undefined>();
  for (const r of recs) {
    if (r.type !== 'LAYER') continue;
    const field = (code: string): string | undefined => r.fields.find(([c]) => c === code)?.[1];
    const name = field('2');
    if (name === undefined) continue;
    const w = field('370');
    out.set(name, w === undefined ? undefined : Number(w));
  }
  return out;
}

/** Gráficos salvos de uma vista, parciais como no projeto (o leitor completa com o padrão). */
type SavedLevelGraphics = { scale?: number; thinLines?: boolean; overrides?: Partial<Record<GraphicsCategory, Partial<CategoryOverride>>> };

/** Cópia do projeto com os gráficos salvos na vista. O comando de edição não faz parte deste teste. */
function withLevelGraphics(p: Project, levelId: string, g: SavedLevelGraphics): Project {
  const q = structuredClone(p);
  q.levels = q.levels.map((l) => (l.id === levelId ? { ...l, graphics: g as ViewGraphics } : l));
  return q;
}

/** Camadas de material das paredes do tipo padrão (`PAREDE_<material>`). */
const wallMaterialLayers = (p: Project): string[] =>
  p.wallTypes[p.defaults.wallTypeId]!.layers.map((l) => dxfLayerOfMaterial(p.materials[l.materialId]!.name));

describe('larguras de linha no DXF (decisão 0015 §2 item 7)', () => {
  it('a escala muda o 370 da parede cortada: 1:50 = 0,7 mm (70), 1:100 = 0,5 (50), 1:200 = 0,35 (35)', () => {
    const p = lPlan().project;
    const layers = wallMaterialLayers(p);
    expect(layers.length).toBeGreaterThan(0);
    for (const [scale, want] of [
      [50, 70],
      [100, 50],
      [200, 35],
    ] as const) {
      const table = layerTable(planDxf(withLevelGraphics(p, 'lv_0', { scale }), 'lv_0'));
      for (const layer of layers) expect(table.get(layer)).toBe(want);
    }
  });

  it('ABERTURA_SIMBOLO (portas e janelas juntas) leva o peso de corte da janela, 3: 0,35 / 0,25 / 0,18 mm', () => {
    const p = lPlan().project;
    const weights = [50, 100, 200].map((scale) => layerTable(planDxf(withLevelGraphics(p, 'lv_0', { scale }), 'lv_0')).get('ABERTURA_SIMBOLO'));
    expect(weights).toEqual([35, 25, 18]);
  });

  it('projeção da parede a 1:200 (0,10 mm) sai com 9, o valor DXF válido mais próximo', () => {
    const p = withLevelGraphics(vistaPlan().project, 'lv_0', { scale: 200 });
    expect(layerTable(planDxf(p, 'lv_0')).get('PAREDE_PROJECAO_ACIMA')).toBe(9);
  });

  it('piso (peso de corte 3: 0,25 mm) e laje (peso de corte 4: 0,35 mm) a 1:100', () => {
    const p = vistaPlan().project;
    const floor = dxfLayerOfFloor(p.floorTypes['ft_ceram']!.code);
    const slab = dxfLayerOfSlab(p.slabTypes['ls_mac12']!.code);
    expect(layerTable(planDxf(p, 'lv_0')).get(floor)).toBe(25);
    expect(layerTable(planDxf(p, 'lv_1')).get(slab)).toBe(35);
  });

  it('substituição da vista vale sobre o peso do projeto: parede de corte 9 (2,0 mm a 1:100) e janela de projeção 8 (1,4 mm)', () => {
    const p = withLevelGraphics(vistaPlan().project, 'lv_0', { overrides: { wall: { cutWeight: 9 }, window: { projectionWeight: 8 } } });
    const table = layerTable(planDxf(p, 'lv_0'));
    for (const layer of wallMaterialLayers(p)) expect(table.get(layer)).toBe(200);
    expect(table.get('ABERTURA_ACIMA')).toBe(140);
    // O corte da janela não foi substituído: segue 3 (0,25 mm a 1:100).
    expect(table.get('ABERTURA_SIMBOLO')).toBe(25);
  });

  it('categoria oculta na vista não sai: parede, porta e piso somem; as janelas (outra categoria) ficam', () => {
    const walls = layerTable(planDxf(withLevelGraphics(vistaPlan().project, 'lv_0', { overrides: { wall: { visible: false } } }), 'lv_0'));
    expect([...walls.keys()].some((n) => n.startsWith('PAREDE_'))).toBe(false);
    expect(walls.has('ABERTURA_ACIMA')).toBe(true);

    const doors = layerTable(planDxf(withLevelGraphics(lPlan().project, 'lv_0', { overrides: { door: { visible: false } } }), 'lv_0'));
    expect(doors.has('ABERTURA_SIMBOLO')).toBe(false);
    expect(wallMaterialLayers(lPlan().project).every((l) => doors.has(l))).toBe(true);

    const vista = vistaPlan().project;
    const floors = layerTable(planDxf(withLevelGraphics(vista, 'lv_0', { overrides: { floor: { visible: false } } }), 'lv_0'));
    expect(floors.has(dxfLayerOfFloor(vista.floorTypes['ft_ceram']!.code))).toBe(false);
  });

  it('camada sem categoria ("0") sai com 370 -3, e toda entrada da tabela tem 370', () => {
    const table = layerTable(planDxf(lPlan().project, 'lv_0'));
    expect(table.get('0')).toBe(-3);
    for (const [, w] of table) expect(w).toBeDefined();
  });

  it('marcas de escada (seta e símbolo de corte) saem com 0; a escada tem o peso de corte da categoria (3 = 0,25 mm)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const geo: DxfLevelGeometry = { clusters: [], openings: [], stairs: [{ outlines: [[a, b, { x: 1, y: 1 }]], risers: [], arrow: [[a, b]], cut: [a, b] }] };
    const w = lineWeightsOf(lPlan().project, 'lv_0', geo);
    expect(w.ESCADA_SETA).toBe(0);
    expect(w.ESCADA_CORTE).toBe(0);
    expect(w.ESCADA).toBe(35);
  });

  it('marcas de corte/elevação usam o peso de corte da anotação (1 = 0,10 mm em 1:100)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const geo: DxfLevelGeometry = {
      clusters: [],
      openings: [],
      sectionMarks: {
        lines: [
          { a, b, layer: DXF_LAYER_CORTES },
          { a, b, layer: DXF_LAYER_ELEVACOES },
        ],
        texts: [],
      },
    };
    const w = lineWeightsOf(lPlan().project, 'lv_0', geo);
    expect(w[DXF_LAYER_CORTES]).toBe(9);
    expect(w[DXF_LAYER_ELEVACOES]).toBe(9);
  });
});

/** Corte A sobre a planta em L: a linha (y = −2) fica diante das paredes, que entram como projeção. */
function sectionPlan(): ProjectStore {
  const store = lPlan();
  store.exec({ type: 'addView', view: { id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: -1, y: -2 }, b: { x: 7, y: -2 }, depth: 8 } });
  return store;
}

describe('corte e elevação no DXF (decisão 0015 §2.7)', () => {
  it('a escala muda o 370 da projeção da parede no corte: 1:50 e 1:100 saem com larguras diferentes', () => {
    const store = sectionPlan();
    const at = (scale: number): Map<string, number | undefined> => {
      store.exec({ type: 'setSectionGraphics', patch: { scale } });
      return layerTable(sectionDxf(store.project, 'corte_a'));
    };
    const w50 = at(50).get('CORTE_PAREDE_PROJECAO');
    const w100 = at(100).get('CORTE_PAREDE_PROJECAO');
    expect(w50).toBeGreaterThan(0);
    expect(w100).toBeGreaterThan(0);
    expect(w50).not.toBe(w100);
  });

  it('sem gráficos salvos, o 370 segue a tabela do projeto na escala padrão (1:100, peso de projeção da parede)', () => {
    const p = sectionPlan().project;
    const g = graphicsOf(p);
    const want = dxfLineWeight(lineWeightMm(g.lineWeights, g.categories.wall.projectionWeight, 100) * 100);
    expect(layerTable(sectionDxf(p, 'corte_a')).get('CORTE_PAREDE_PROJECAO')).toBe(want);
  });

  it('categoria oculta na vista não sai no DXF: sem paredes, a camada de projeção da parede não existe', () => {
    const store = sectionPlan();
    store.exec({ type: 'setSectionGraphics', patch: { overrides: { wall: { visible: false } } } });
    const geo = sectionDxfGeometryOf(store.project, 'corte_a');
    expect(geo.beyond.some((b) => b.category === 'wall')).toBe(false);
    expect(geo.silhouette).toBeUndefined();
    expect(polylinesOf(sectionDxf(store.project, 'corte_a')).some((p) => p.layer === 'CORTE_PAREDE_PROJECAO')).toBe(false);
  });

  it('sectionLineWeightsOf dá peso de corte ao cortado e de projeção ao visto além, e 0 à anotação', () => {
    const store = sectionPlan();
    const geo = sectionDxfGeometryOf(store.project, 'corte_a');
    const w = sectionLineWeightsOf(store.project, geo);
    expect(w['0']).toBeUndefined();
    expect(w['CORTE_PAREDE_PROJECAO']).toBeGreaterThan(0);
    expect(w['CORTE_CONTORNO']).toBeGreaterThan(0);
  });
});

describe('linhas finas não mudam o DXF (decisão 0015, só na tela)', () => {
  it('um nível com linhas finas sai igual ao sem o modo, com o 370 real de cada camada de parede', () => {
    const p = lPlan().project;
    const fina = withLevelGraphics(p, 'lv_0', { thinLines: true } as SavedLevelGraphics);
    expect(planDxf(fina, 'lv_0')).toBe(planDxf(p, 'lv_0'));
    const table = layerTable(planDxf(fina, 'lv_0'));
    for (const layer of wallMaterialLayers(p)) expect(table.get(layer)).toBe(50);
  });
});
