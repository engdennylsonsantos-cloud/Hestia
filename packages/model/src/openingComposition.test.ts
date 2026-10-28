import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES } from './defaults.ts';
import { spanTypeOf } from './openingNominal.ts';
import { compositionOfType } from './openingCompositionOf.ts';
import {
  casingRings,
  compositionIssue,
  compositionLeafSize,
  compositionSpan,
  defaultOpeningProfiles,
  glassPlateRect,
  normalizeComposition,
  openingProfilesOf,
  OPENING_PROFILE_PRESETS,
  resolveLayout,
  resolveProfile,
  type CellNode,
  type CompositionNode,
  type OpeningComposition,
  type Rect,
} from './index.ts';

const T = 1e-9;
const near = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(T);
const nearRect = (r: Rect, t0: number, t1: number, z0: number, z1: number): void => {
  near(r.t0, t0);
  near(r.t1, t1);
  near(r.z0, z0);
  near(r.z1, z1);
};

const BAT = { presetId: 'prf_mad_batente_5x9' };
const DIV = { presetId: 'prf_mad_divisor_5x9' };
const leaf = (id = 'folha'): CellNode => ({ kind: 'cell', id, content: { kind: 'leaf', family: 'door_swing', plan: 'swing', leaves: 1, options: {} } });
const glass = (id: string): CellNode => ({ kind: 'cell', id, content: { kind: 'glass', glass: { kind: 'clear', thickness: 0.012, mounting: 'rebate' } } });
const fixed = (value: number, node: CompositionNode) => ({ size: { mode: 'fixed' as const, value }, node });
const fill = (node: CompositionNode) => ({ size: { mode: 'fill' as const }, node });
const comp = (layout: CompositionNode, over: Partial<OpeningComposition> = {}): OpeningComposition => ({
  version: 1,
  nominal: { ref: 'leaf', width: 0.9, height: 2.1, gap: { w: 0.08, h: 0.05 } },
  frame: { style: 'rebate', profile: BAT, depthMode: 'core' },
  layout,
  ...over,
});
const colsX = (): CompositionNode => ({ kind: 'split', id: 'cols', axis: 'cols', divider: DIV, children: [fixed(0.4, glass('lat-e')), fill(leaf()), fixed(0.4, glass('lat-d'))] });
const rowsX = (below: CompositionNode): CompositionNode => ({ kind: 'split', id: 'rows', axis: 'rows', divider: DIV, children: [fill(below), fixed(0.4, glass('band'))] });

const EX1 = comp(leaf());
const EX2 = comp(rowsX(leaf()));
const EX3 = comp(colsX());
const EX4 = comp(rowsX(colsX()));
const EX5 = comp(
  { kind: 'split', id: 'cols', axis: 'cols', divider: DIV, children: [fixed(0.6, glass('fixa')), fill({ kind: 'cell', id: 'abrir', content: { kind: 'leaf', family: 'window_hinged', plan: 'hinged', leaves: 1, options: {} } })] },
  { nominal: { ref: 'opening', width: 1.6, height: 1.2 } },
);
const member = (l: ReturnType<typeof resolveLayout>, id: string) => l.members.find((m) => m.id === id)!;
const cell = (l: ReturnType<typeof resolveLayout>, id: string) => l.cells.find((c) => c.id === id)!;

describe('resolveLayout: exemplos da spec §1', () => {
  it('Ex. 1: porta 90 sem bandeira (vão 0,98 × 2,15)', () => {
    const l = resolveLayout(EX1);
    near(l.span.width, 0.98);
    near(l.span.height, 2.15);
    nearRect(l.luz, -0.44, 0.44, 0, 2.1);
    nearRect(member(l, 'jamb-left').rect, -0.49, -0.44, 0, 2.1);
    nearRect(member(l, 'jamb-right').rect, 0.44, 0.49, 0, 2.1);
    nearRect(member(l, 'head').rect, -0.49, 0.49, 2.1, 2.15);
    expect(l.members.length).toBe(3);
    expect(member(l, 'jamb-left').before).toEqual({ kind: 'wall' });
    expect(member(l, 'jamb-left').after).toEqual({ kind: 'cell', cellId: 'folha', treatment: 'stop' });
  });

  it('Ex. 2: bandeira superior (vão 0,98 × 2,60)', () => {
    const l = resolveLayout(EX2);
    near(l.span.height, 2.6);
    nearRect(member(l, 'transom-rows-0').rect, -0.44, 0.44, 2.1, 2.15);
    nearRect(cell(l, 'band').luz, -0.44, 0.44, 2.15, 2.55);
    nearRect(member(l, 'head').rect, -0.49, 0.49, 2.55, 2.6);
    expect(member(l, 'transom-rows-0').after).toEqual({ kind: 'cell', cellId: 'band', treatment: 'glassRebate' });
  });

  it('Ex. 3: porta + 2 laterais (vão 1,88 × 2,15)', () => {
    const l = resolveLayout(EX3);
    near(l.span.width, 1.88);
    near(l.span.height, 2.15);
    nearRect(member(l, 'jamb-left').rect, -0.94, -0.89, 0, 2.1);
    nearRect(member(l, 'mullion-cols-0').rect, -0.49, -0.44, 0, 2.1);
    nearRect(member(l, 'mullion-cols-1').rect, 0.44, 0.49, 0, 2.1);
    nearRect(cell(l, 'lat-e').luz, -0.89, -0.49, 0, 2.1);
    nearRect(cell(l, 'folha').luz, -0.44, 0.44, 0, 2.1);
    nearRect(cell(l, 'lat-d').luz, 0.49, 0.89, 0, 2.1);
  });

  it('Ex. 4: travessa interna contínua; montantes terminam nela (vão 1,88 × 2,60)', () => {
    const l = resolveLayout(EX4);
    near(l.span.width, 1.88);
    near(l.span.height, 2.6);
    nearRect(member(l, 'transom-rows-0').rect, -0.89, 0.89, 2.1, 2.15);
    nearRect(member(l, 'mullion-cols-0').rect, -0.49, -0.44, 0, 2.1);
    nearRect(member(l, 'jamb-left').rect, -0.94, -0.89, 0, 2.55);
    nearRect(cell(l, 'band').luz, -0.89, 0.89, 2.15, 2.55);
  });

  it('Ex. 5: janela combinada 1,60 × 1,20 (células 0,60 e 0,85, peitoril do caixilho)', () => {
    const l = resolveLayout(EX5);
    nearRect(l.luz, -0.75, 0.75, 0.05, 1.15);
    nearRect(cell(l, 'fixa').luz, -0.75, -0.15, 0.05, 1.15);
    nearRect(cell(l, 'abrir').luz, -0.1, 0.75, 0.05, 1.15);
    nearRect(member(l, 'mullion-cols-0').rect, -0.15, -0.1, 0.05, 1.15);
    nearRect(member(l, 'sill').rect, -0.8, 0.8, 0, 0.05);
    expect(member(l, 'sill').role).toBe('sill');
  });

  it('cobertura: membros + luzes preenchem o vão sem sobreposição', () => {
    const area = (r: Rect): number => (r.t1 - r.t0) * (r.z1 - r.z0);
    const inter = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
    for (const c of [EX1, EX2, EX3, EX4, EX5]) {
      const l = resolveLayout(c);
      const rs = [...l.members.map((m) => m.rect), ...l.cells.map((x) => x.luz)];
      near(rs.reduce((s, r) => s + area(r), 0), l.span.width * l.span.height);
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(inter(rs[i]!, rs[j]!)).toBeLessThan(1e-12);
    }
  });
});

describe('compositionSpan / nominalRef leaf (spec §2.5)', () => {
  it('Ex. 3: folha 0,90 + folga 0,08 + 2·(0,40 + 0,05) = 1,88', () => {
    near(compositionSpan(EX3).width, 1.88);
    near(compositionSpan(EX3).height, 2.15);
    near(compositionSpan(EX4).height, 2.6);
  });
  it('com ref "opening" o vão é o nominal e a folha é derivada', () => {
    const c = comp(colsX(), { nominal: { ref: 'opening', width: 1.88, height: 2.15 } });
    expect(compositionSpan(c)).toEqual({ width: 1.88, height: 2.15 });
    near(compositionLeafSize(c).width, 0.9);
    near(compositionLeafSize(c).height, 2.1);
  });
});

describe('compositionIssue (spec §8 item 6)', () => {
  it('aceita os exemplos', () => {
    for (const c of [EX1, EX2, EX3, EX4, EX5]) expect(compositionIssue(c)).toBeNull();
  });
  it('soma das luzes + divisores deve igualar a luz do pai', () => {
    const c = comp({ kind: 'split', id: 'cols', axis: 'cols', divider: DIV, children: [fixed(0.4, glass('a')), fixed(0.4, leaf())] }, { nominal: { ref: 'opening', width: 1.5, height: 2.15 } });
    expect(compositionIssue(c)).toMatch(/diferem da luz do pai/);
  });
  it('rejeita mais de um fill, tamanho não positivo, ids repetidos e divisão de um filho só', () => {
    const dois = comp({ kind: 'split', id: 's', axis: 'cols', children: [fill(glass('a')), fill(leaf())] });
    expect(compositionIssue(dois)).toMatch(/mais de um fill/);
    const zero = comp({ kind: 'split', id: 's', axis: 'cols', children: [fixed(0, glass('a')), fill(leaf())] });
    expect(compositionIssue(zero)).toMatch(/não positivo/);
    const rep = comp({ kind: 'split', id: 's', axis: 'cols', children: [fixed(0.4, glass('x')), fill(leaf('x'))] });
    expect(compositionIssue(rep)).toMatch(/repetido/);
    const um = comp({ kind: 'split', id: 's', axis: 'cols', children: [fill(leaf())] });
    expect(compositionIssue(um)).toMatch(/2 filhos/);
  });
  it('rejeita célula sem luz e vão nominal inválido', () => {
    const largo = comp({ kind: 'split', id: 's', axis: 'cols', children: [fixed(3, glass('a')), fill(leaf())] }, { nominal: { ref: 'opening', width: 1.5, height: 2.15 } });
    expect(compositionIssue(largo)).toMatch(/sem luz/);
    expect(compositionIssue(comp(leaf(), { nominal: { ref: 'opening', width: 0, height: 2 } }))).toMatch(/positivas/);
  });
  it('ref "leaf" exige célula de folha', () => {
    expect(compositionIssue(comp(glass('g')))).toMatch(/folha/);
  });
});

describe('normalizeComposition', () => {
  it('idempotente nos exemplos e aplica padrões', () => {
    for (const c of [EX1, EX3, EX5]) expect(normalizeComposition(JSON.parse(JSON.stringify(c)))).toEqual(c);
    const n = normalizeComposition({ nominal: { width: 1, height: 2 }, frame: { profile: BAT }, layout: leaf(), casing: { width: 0.07, thickness: 0.015 } });
    expect(n.frame.style).toBe('rebate');
    expect(n.frame.depthMode).toBe('wall');
    expect(n.casing).toMatchObject({ faces: 'both', setback: 0 });
  });
  it('lança em entrada que não é composição', () => {
    expect(() => normalizeComposition(null)).toThrow();
    expect(() => normalizeComposition({ nominal: {}, frame: { profile: BAT }, layout: { kind: 'x' } })).toThrow();
  });
});

describe('casingRings (spec §4)', () => {
  const casing = { faces: 'both' as const, width: 0.07, thickness: 0.015, setback: 0 };
  it('Ex. 1: porta, anel interno = luz, externo ±0,51 e topo 2,17, sem lado inferior', () => {
    const r = casingRings({ ...EX1, casing }, resolveLayout(EX1), 'door');
    expect(r.map((x) => x.face)).toEqual(['exterior', 'interior']);
    nearRect(r[0]!.inner, -0.44, 0.44, 0, 2.1);
    nearRect(r[0]!.outer, -0.51, 0.51, 0, 2.17);
    expect(r[0]!.openBottom).toBe(true);
  });
  it('Ex. 4: contorna o conjunto (topo 2,62, externo ±0,96)', () => {
    const r = casingRings({ ...EX4, casing }, resolveLayout(EX4), 'door');
    nearRect(r[0]!.outer, -0.96, 0.96, 0, 2.62);
  });
  it('Ex. 5: janela tem 4 lados (soleira do alizar em z -0,02)', () => {
    const r = casingRings({ ...EX5, casing }, resolveLayout(EX5), 'window');
    nearRect(r[0]!.outer, -0.82, 0.82, -0.02, 1.22);
    expect(r[0]!.openBottom).toBe(false);
  });
  it('setback desloca a aresta interna; faces limita; none não gera', () => {
    const l = resolveLayout(EX1);
    nearRect(casingRings({ ...EX1, casing: { ...casing, setback: 0.01 } }, l, 'door')[0]!.inner, -0.45, 0.45, 0, 2.11);
    expect(casingRings({ ...EX1, casing: { ...casing, faces: 'exterior' } }, l, 'door').length).toBe(1);
    expect(casingRings({ ...EX1, casing: { ...casing, faces: 'opposite' } }, l, 'door', 'exterior')[0]!.face).toBe('interior');
    expect(casingRings({ ...EX1, casing: { ...casing, faces: 'none' } }, l, 'door')).toEqual([]);
    expect(casingRings(EX1, l, 'door')).toEqual([]);
  });
  it('dimensões próprias por face', () => {
    const r = casingRings({ ...EX1, casing: { ...casing, interior: { width: 0.1 } } }, resolveLayout(EX1), 'door');
    near(r[1]!.outer.t1, 0.54);
  });
});

describe('perfis (spec §2.3, §5)', () => {
  it('18 presets; mapa do projeto completa o que falta', () => {
    expect(OPENING_PROFILE_PRESETS.length).toBe(18);
    expect(Object.keys(defaultOpeningProfiles()).length).toBe(18);
    expect(Object.keys(openingProfilesOf({})).length).toBe(18);
    const custom = { ...defaultOpeningProfiles()['prf_alu_l25']!, name: 'Meu perfil' };
    expect(openingProfilesOf({ openingProfiles: { prf_alu_l25: custom } })['prf_alu_l25']!.name).toBe('Meu perfil');
  });
  it('resolveProfile: preset, override (inclusive no rebaixo) e inline', () => {
    expect(resolveProfile({ presetId: 'prf_mad_batente_5x9' }).visibleWidth).toBe(0.05);
    const o = resolveProfile({ presetId: 'prf_mad_caixilho_35x70', override: { visibleWidth: 0.04, glassRebate: { depth: 0.02, clearance: 0.003, bead: 0.015 } } });
    expect(o.visibleWidth).toBe(0.04);
    expect(o.glassRebate?.depth).toBe(0.02);
    expect(resolveProfile({ presetId: 'nao_existe' }).visibleWidth).toBe(0.05);
    const inline = { material: 'pvc' as const, section: 'rect' as const, visibleWidth: 0.1, depth: 0.1 };
    expect(resolveProfile({ inline })).toEqual(inline);
  });
  it('Item 14: rebaixo padrão dá placa = luz + 0,018; perfil sem rebaixo dá a luz', () => {
    const luz = { t0: -0.3, t1: 0.3, z0: 0, z1: 1 };
    const com = glassPlateRect(luz, resolveProfile({ presetId: 'prf_mad_caixilho_35x70' }));
    near(com.t1 - com.t0, 0.6 + 0.018);
    near(com.z1 - com.z0, 1 + 0.018);
    expect(glassPlateRect(luz, resolveProfile({ presetId: 'prf_mad_batente_5x9' }))).toEqual(luz);
  });
});

describe('spanTypeOf com composição de várias células', () => {
  it('width/height do tipo normalizado são o vão total da composição, mesmo com nominalRef opening', () => {
    const t = { ...DEFAULT_OPENING_TYPES.find((x) => x.id === 'ot_p90')! };
    const comp = compositionOfType(t);
    expect(spanTypeOf(t)).toBe(t); // uma célula: identidade
    const lateral = (id: string) => ({ kind: 'cell', id, content: { kind: 'glass', glass: { kind: 'clear', thickness: 0.012, mounting: 'rebate' } } });
    const lado = (id: string) => ({ size: { mode: 'fixed', value: 0.4 }, node: lateral(id) });
    const split = { kind: 'split', id: 'r', axis: 'cols', children: [lado('le'), { size: { mode: 'fill' }, node: comp.layout }, lado('ld')] };
    // Folha nominal 0,90 + folga 0,08 + 2 × (lateral 0,40 + divisor 0,05) = 1,88, mesmo com o tipo ainda marcado 'opening'.
    const multi = { ...t, composition: { ...comp, nominal: { ...comp.nominal, ref: 'leaf', width: 0.9, height: 2.1 }, layout: split } } as unknown as typeof t;
    const s = spanTypeOf(multi);
    expect(s.width).toBeCloseTo(1.88, 9);
    expect(s.nominalRef).toBe('opening');
  });
});
