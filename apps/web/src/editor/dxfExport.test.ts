import { describe, expect, it } from 'vitest';
import { generateStraightRun, resolveStairsOnLevel } from '@hestia/engine';
import { dxfLayerOfMaterial } from '@hestia/io';
import { ProjectStore, buildTemplate, makeFloor, makeSlab, makeStair, makeWall, type Opening, type Project, type StairRun, type ViewRange } from '@hestia/model';
import { planDxf, stairArrow } from './dxfExport.ts';

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
    expect(text).toContain('\r\nABERTURAS\r\n');

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
    expect(above).toHaveLength(1);
    // o vão de 1,50 não aparece nas camadas de corte
    expect(polylinesOf(text).filter((x) => x.layer === 'ABERTURAS')).toHaveLength(1);
    // a parede com a janela alta é igual à mesma parede sem janela (furo nenhum)
    expect(notOpening(text).filter((x) => x.pts.some((v) => v.y < 1 && v.y > -1))).toEqual(
      notOpening(planDxf(without(p, 'jAlta'), 'lv_0')).filter((x) => x.pts.some((v) => v.y < 1 && v.y > -1)),
    );
    expect(text).toContain('\r\nDASHED\r\n');
  });

  it('janela de peitoril 0,90 cruza o corte: fura a parede e sai em ABERTURAS', () => {
    const p = vistaPlan().project;
    const text = planDxf(p, 'lv_0');
    const cut = polylinesOf(text).filter((x) => x.layer === 'ABERTURAS' && x.pts.some((v) => v.y > 4 && v.y < 6));
    expect(cut).toHaveLength(1);
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
