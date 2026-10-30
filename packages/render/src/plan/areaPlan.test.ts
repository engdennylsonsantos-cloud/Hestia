import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoom, makeWall, type AreaPlan, type AreaPlanAnnotations } from '@hestia/model';
import { resolveRooms, resolveLevel } from '@hestia/engine';
import { buildPlanGeometry, planGeometrySelection, type PlanInput } from './build.ts';
import { DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS } from '@hestia/model';
import { defaultPaint } from './style.ts';
import { LIGHT } from './types.ts';
import { areaPlanHighlightOps, areaPlanRoomOps, areaPlanTagOps, roomTagLines, tagBoxModel } from './areaPlan.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function project(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  return s;
}

const plan = (over: Partial<AreaPlan> = {}): AreaPlan => ({
  id: 'ap1',
  name: 'Planta de área',
  levelId: 'lv_0',
  scale: 50,
  graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
  tags: [],
  ...over,
});

/** Anotações de uma vista: cota, texto, linha de detalhe e etiqueta de elemento da parede w0. */
const anotacoes = (sufixo: string): AreaPlanAnnotations => ({
  dimensions: [{ id: `d${sufixo}`, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 }],
  texts: [{ id: `t${sufixo}`, at: { x: 2, y: 3 }, text: `NOTA ${sufixo}`, height: 3, rotation: 0 }],
  detailLines: [{ id: `dl${sufixo}`, a: { x: 0, y: 1 }, b: { x: 4, y: 1 }, style: 'dashed' }],
  detailRegions: [],
  tags: [{ id: `tg${sufixo}`, hostId: 'w0', at: { x: 1, y: 1 }, property: 'type' }],
});

/** Entrada da planta para `buildPlanGeometry` (o mesmo formato que o app usa). */
const entrada = (s: ProjectStore, areaPlan?: AreaPlan, selection: string[] = []): PlanInput => ({
  project: s.project,
  levelId: 'lv_0',
  resolved: resolveLevel(s.project, 'lv_0'),
  below: null,
  areaPlan,
  viewport: { cx: 2, cy: 2.5, zoom: 100, width: 600, height: 400 },
  theme: LIGHT,
  dark: false,
  selection,
  hover: null,
  preview: [],
  inference: null,
  showGrid: false,
});

describe('planta de área · desenho', () => {
  it('sem esquema não há preenchimento; as diagonais são desenhadas', () => {
    const s = project();
    const rooms = resolveRooms(s.project, 'lv_0');
    const ops = areaPlanRoomOps(s.project, plan(), LIGHT, false, 50, undefined, defaultPaint('room', 100), rooms);
    expect(ops.fills).toHaveLength(0);
    expect(ops.strokes.filter((x) => x.color === '#4b5563')).toHaveLength(2);
  });

  it('com esquema por categoria há preenchimento', () => {
    const s = project();
    s.exec({ type: 'updateElements', ids: ['r1'], patch: { categoryId: 'rc_sala' } });
    s.exec({ type: 'upsertColorScheme', scheme: { id: 'cs', name: 'Por categoria', by: 'category' } });
    const p = s.project;
    const rooms = resolveRooms(p, 'lv_0');
    const withScheme: AreaPlan = { ...plan({ schemeId: 'cs' }), graphics: { ...DEFAULT_AREA_GRAPHICS, fill: 'scheme' } };
    const ops = areaPlanRoomOps(p, withScheme, LIGHT, false, 50, undefined, defaultPaint('room', 100), rooms);
    expect(ops.fills).toHaveLength(1);
    expect(ops.fills[0]!.color).toBe('#dbe7f3');
  });

  it('etiqueta dentro não tem chamada; fora tem', () => {
    const s = project();
    const p = s.project;
    const rooms = resolveRooms(p, 'lv_0');
    const inside = areaPlanTagOps(p, plan({ tags: [] }), 50, undefined, rooms);
    expect(inside.strokes).toHaveLength(0);
    expect(inside.labels.filter((l) => l.maskBoundary)).toHaveLength(0);
    expect(inside.labels.map((l) => l.text)).toEqual(['Sala', '101 · 20,00 m²']);

    const outside = (() => {
      const s2 = project();
      s2.exec({ type: 'setRoomLabel', id: 'r1', position: { x: 8, y: 8 } });
      return areaPlanTagOps(s2.project, plan({ tags: [] }), 50, undefined, resolveRooms(s2.project, 'lv_0'));
    })();
    expect(outside.strokes.length).toBeGreaterThan(0);
    expect(outside.labels.some((l) => l.text === 'Sala')).toBe(true);
  });

  it('chamada cruzada passa pelo centro do texto', () => {
    const s2 = project();
    s2.exec({ type: 'setRoomLabel', id: 'r1', position: { x: 8, y: 8 } });
    const ops = areaPlanTagOps(s2.project, plan({ tags: [] }), 50, undefined, resolveRooms(s2.project, 'lv_0'));
    const at = { x: 8, y: 8 };
    expect(ops.strokes.length).toBe(2);
    for (const st of ops.strokes) {
      const [a, b] = st.pts as [{ x: number; y: number }, { x: number; y: number }];
      const cross = (b.x - a.x) * (at.y - a.y) - (b.y - a.y) * (at.x - a.x);
      expect(Math.abs(cross)).toBeLessThan(1e-9);
    }
  });

  it('a RoomTag da planta vence room.labelPosition ao posicionar o texto', () => {
    const s2 = project();
    s2.exec({ type: 'setRoomLabel', id: 'r1', position: { x: 8, y: 8 } });
    const tag = { id: 't1', planId: 'ap', roomId: 'r1', at: { x: 2, y: 3 }, orientation: 'horizontal' as const, leader: 'none' as const, fields: [...DEFAULT_AREA_GRAPHICS.tagDefault.fields], visible: true };
    const ops = areaPlanTagOps(s2.project, plan({ tags: [tag] }), 50, undefined, resolveRooms(s2.project, 'lv_0'));
    const sala = ops.labels.find((l) => l.text === 'Sala');
    expect(sala?.at).toEqual({ x: 2, y: 3 });
  });

  it('no tema escuro o texto segue o tema e não há halo', () => {
    const s2 = project();
    const ops = areaPlanTagOps(s2.project, plan({ tags: [] }), 50, undefined, resolveRooms(s2.project, 'lv_0'), undefined, true);
    expect(ops.labels.find((l) => l.text === 'Sala')?.color).toBe('#f3f4f6');
    expect(ops.labels.some((l) => l.maskBoundary)).toBe(false);
  });

  it('caixa do texto cresce com o número de linhas', () => {
    expect(tagBoxModel(['Sala'], 50).h).toBeLessThan(tagBoxModel(['Sala', '101 · 20,00 m²'], 50).h);
  });

  it('seleção destaca o ambiente com preenchimento e contorno', () => {
    const s = project();
    const ops = areaPlanHighlightOps(s.project, plan(), ['r1'], null, LIGHT, 50);
    expect(ops.fills).toHaveLength(1);
    expect(ops.strokes.length).toBeGreaterThan(0);
  });

  it('separador de ambiente aparece tracejado na planta de área', () => {
    const s = project();
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'sep', a: { x: 2, y: 0 }, b: { x: 2, y: 5 } } });
    const p = s.project;
    const ops = buildPlanGeometry({
      project: p,
      levelId: 'lv_0',
      resolved: resolveLevel(p, 'lv_0'),
      below: null,
      areaPlan: plan(),
      viewport: { cx: 2, cy: 2.5, zoom: 100, width: 600, height: 400 },
      theme: LIGHT,
      dark: false,
      selection: [],
      hover: null,
      preview: [],
      inference: null,
      showGrid: false,
    });
    expect(ops.strokes.some((st) => st.dash && st.pts[0]?.x === 2 && st.pts[1]?.x === 2)).toBe(true);
  });

  it('cota, texto, detalhe e etiqueta da vista (plan.annotations) entram no desenho da área', () => {
    const s = project();
    const anotada = plan({ annotations: anotacoes('A') });
    const ops = buildPlanGeometry(entrada(s, anotada));
    const textos = ops.labels.map((l) => l.text);
    expect(textos).toContain('4,00 m');
    expect(textos).toContain('NOTA A');
    expect(textos).toContain('PA-14');
    // Linha de detalhe tracejada de (0,1) a (4,1).
    expect(ops.strokes.some((st) => st.dash && st.pts[0]?.x === 0 && st.pts[0]?.y === 1 && st.pts[1]?.x === 4)).toBe(true);
  });

  it('duas plantas do mesmo nível não misturam as anotações da vista', () => {
    const s = project();
    const a = buildPlanGeometry(entrada(s, plan({ id: 'apA', annotations: anotacoes('A') })));
    const b = buildPlanGeometry(entrada(s, plan({ id: 'apB', annotations: anotacoes('B') })));
    const textosA = a.labels.map((l) => l.text);
    const textosB = b.labels.map((l) => l.text);
    expect(textosA).toContain('NOTA A');
    expect(textosA).not.toContain('NOTA B');
    expect(textosB).toContain('NOTA B');
    expect(textosB).not.toContain('NOTA A');
  });

  it('sem anotações próprias, a área cai nas do nível (e não soma as duas)', () => {
    const s = project();
    s.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'dn', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    s.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'tn', at: { x: 2, y: 3 }, text: 'NOTA DO NÍVEL', height: 3, rotation: 0 } });
    // Padrão de área: mostra as anotações do nível (como uma planta normal), uma vez só.
    const comNivel = buildPlanGeometry(entrada(s, plan()));
    expect(comNivel.labels.map((l) => l.text).filter((t) => t === 'NOTA DO NÍVEL')).toHaveLength(1);
    expect(comNivel.labels.map((l) => l.text).filter((t) => t === '4,00 m')).toHaveLength(1);
    // Desligado nos gráficos, some.
    const semGraficos = buildPlanGeometry(entrada(s, plan({ graphics: { ...plan().graphics, showDimensions: false, showAnnotations: false } })));
    expect(semGraficos.labels.map((l) => l.text)).not.toContain('NOTA DO NÍVEL');
  });

  it('a planta de piso continua usando as cotas e os textos do nível', () => {
    const s = project();
    s.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'dn', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    s.exec({ type: 'addText', levelId: 'lv_0', text: { id: 'tn', at: { x: 2, y: 3 }, text: 'NOTA DO NÍVEL', height: 3, rotation: 0 } });
    const textos = buildPlanGeometry(entrada(s)).labels.map((l) => l.text);
    expect(textos).toContain('4,00 m');
    expect(textos).toContain('NOTA DO NÍVEL');
  });

  it('a seleção de cota/texto da vista chega à geometria da área', () => {
    const s = project();
    const anotada = plan({ annotations: anotacoes('A') });
    expect(planGeometrySelection(s.project, 'lv_0', ['dA', 'tA', 'r1'], anotada)).toEqual(['dA', 'tA']);
    const semSel = buildPlanGeometry(entrada(s, anotada));
    const comSel = buildPlanGeometry(entrada(s, anotada, ['dA']));
    // A cota selecionada sai na cor de seleção (a sobreposição não entra na geometria, então a cor só pode vir daqui).
    expect(comSel.strokes.some((st) => st.color === LIGHT.select)).toBe(true);
    expect(semSel.strokes.some((st) => st.color === LIGHT.select)).toBe(false);
  });

  it('legenda e diagonais continuam no desenho', () => {
    const s = project();
    s.exec({ type: 'upsertColorScheme', scheme: { id: 'cs', name: 'Por categoria', by: 'category' } });
    const comLegenda = plan({ schemeId: 'cs', legend: { at: { x: 10, y: 10 }, title: 'Legenda da área', groupBy: 'category', showCount: true, showArea: true, showPercent: true } });
    const ops = buildPlanGeometry(entrada(s, comLegenda));
    expect(ops.labels.map((l) => l.text)).toContain('Legenda da área');
    // As duas diagonais de referência do ambiente continuam saindo.
    expect(ops.strokes.filter((st) => st.color === '#4b5563')).toHaveLength(2);
  });

  it('linhas da etiqueta respeitam os campos', () => {
    const s = project();
    const p = s.project;
    const room = p.elements.r1!;
    const r = resolveRooms(p, 'lv_0')[0]!;
    const tag = { id: 't', planId: 'ap1', roomId: 'r1', at: { x: 0, y: 0 }, orientation: 'horizontal' as const, leader: 'none' as const, fields: ['name', 'area', 'perimeter'] as const, visible: true };
    const lines = roomTagLines(p, room as never, r, { ...tag, fields: [...tag.fields] });
    expect(lines[0]).toBe('Sala');
    expect(lines[1]).toContain('20,00 m²');
    expect(lines[1]).toContain('18,00 m');
  });
});
