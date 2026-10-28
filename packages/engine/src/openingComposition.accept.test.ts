import { describe, expect, it } from 'vitest';
import {
  compositionOfType,
  createEmptyProject,
  makeWall,
  ProjectStore,
  resolveLayout,
  type CasingSpec,
  type CellNode,
  type CompositionNode,
  type LeafOptions,
  type Opening,
  type OpeningComposition,
  type OpeningType,
  type Project,
  type SplitNode,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingPlanPaths, type OpeningPlanOptions } from './openingPlan.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';
import { insertMode } from './wrap.ts';

/*
 * ACEITE da composição de esquadrias (spec: docs/aberturas/F1-spec-composicao.md, §1 exemplos e §8 itens 1-5, 7, 8, 9, 12, 15).
 * Falham até a F4 (motor): é o desenho. Coordenadas locais do vão: t (largura, 0 no centro), s (profundidade), z (0 no piso).
 * Parede 0,20 com núcleo 0,09 (D = 0,09); perfis "Madeira batente 5×9" (batente) e "Madeira divisor 5×9" (divisores).
 * Tolerância: 1e-6 (toBeCloseTo com 6 casas). Nomes de peças: contrato com o autor do motor (ver a F4).
 */

const TOL = 6, EPS = 1e-9;
/** Folha = luz + 2·(0,015 − 0,004): a folha invade 0,011 do batente/travessa (spec §1). */
const LIP = 0.015 - 0.004;
/** Papéis de membro do quadro (roles como string: 'mullion', 'transom' ainda não estão em PartRole). */
const MEMBROS = ['jamb', 'head', 'sillFrame', 'threshold', 'mullion', 'transom'];
const FECHADO = [...MEMBROS, 'glass', 'leaf', 'casing'];

const BAT = { presetId: 'prf_mad_batente_5x9' };
const DIV = { presetId: 'prf_mad_divisor_5x9' };
const CASING: CasingSpec = { faces: 'both', width: 0.07, thickness: 0.015, setback: 0 };

// ───────────────────────── Construção das composições ─────────────────────────

const leafC = (id: string, extra: Record<string, unknown> = {}, door = true): CellNode => ({
  kind: 'cell',
  id,
  content: door
    ? { kind: 'leaf', family: 'door_swing', plan: 'swing', leaves: 1, options: extra as LeafOptions }
    : { kind: 'leaf', family: 'window_hinged', plan: 'hinged', leaves: 1, options: extra as LeafOptions },
});
const glassC = (id: string): CellNode => ({ kind: 'cell', id, content: { kind: 'glass', glass: { kind: 'clear', thickness: 0.012, mounting: 'rebate' } } });
const fixo = (value: number, node: CompositionNode) => ({ size: { mode: 'fixed' as const, value }, node });
const fill = (node: CompositionNode) => ({ size: { mode: 'fill' as const }, node });
const split = (id: string, axis: 'cols' | 'rows', children: SplitNode['children']): SplitNode => ({ kind: 'split', id, axis, divider: DIV, children });
const comp = (layout: CompositionNode, over: Partial<OpeningComposition> = {}): OpeningComposition => ({
  version: 1,
  nominal: { ref: 'leaf', width: 0.9, height: 2.1, gap: { w: 0.08, h: 0.05 } },
  frame: { style: 'rebate', profile: BAT, depthMode: 'core' },
  layout,
  casing: CASING,
  ...over,
});

const EX1 = comp(leafC('folha'));
const COLS3 = (): SplitNode => split('cols', 'cols', [fixo(0.4, glassC('lat-e')), fill(leafC('folha')), fixo(0.4, glassC('lat-d'))]);
const EX2 = comp(split('rows', 'rows', [fill(leafC('folha')), fixo(0.4, glassC('band'))]));
const EX3 = comp(COLS3());
const EX4 = comp(split('rows', 'rows', [fill(COLS3()), fixo(0.4, glassC('band'))]));
const EX5 = comp(
  split('cols', 'cols', [fixo(0.6, glassC('fixa')), fill(leafC('abrir', {}, false))]),
  { nominal: { ref: 'opening', width: 1.6, height: 1.2 } },
);

const EXEMPLOS: Array<[string, OpeningComposition, 'ot_p90' | 'ot_j120', number, number]> = [
  ['Ex. 1', EX1, 'ot_p90', 0.98, 2.15],
  ['Ex. 2', EX2, 'ot_p90', 0.98, 2.6],
  ['Ex. 3', EX3, 'ot_p90', 1.88, 2.15],
  ['Ex. 4', EX4, 'ot_p90', 1.88, 2.6],
  ['Ex. 5', EX5, 'ot_j120', 1.6, 1.2],
];

// ───────────────────────── Cena: parede 0,20 com núcleo, vão no meio ─────────────────────────

interface Cena {
  p: Project;
  t: OpeningType;
  m: OpeningModel;
}

function cena(base: 'ot_p90' | 'ot_j120', comp?: OpeningComposition, extra: Partial<OpeningType> = {}, flips = { flipHand: false, flipFacing: false }): Cena {
  const s = new ProjectStore(createEmptyProject());
  const base0 = s.project.openingTypes[base];
  if (!base0) throw new Error(`tipo padrão ausente: ${base}`);
  const alv = s.project.wallTypes['wt_alv14']!;
  const layers = (sub: number) => [
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'structure' as const, materialId: 'mat_bloco14', thickness: 0.09, wraps: false },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
  ];
  s.exec({ type: 'upsertWallType', wallType: { ...alv, id: 'wt_x20', layers: layers(0.053) } });
  s.exec({
    type: 'upsertOpeningType',
    openingType: { ...base0, id: 'ot_x', ...(comp ? { composition: comp } : {}), ...extra },
  });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_x20', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: base0.kind, typeId: 'ot_x', hostId: 'w', offset: 2, ...flips, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  const g = openingGeometry(p, o, f);
  return { p, t: p.openingTypes.ot_x!, m: buildOpeningModel(p, o, g, f) };
}

// ───────────────────────── Asserções ─────────────────────────

function peca(m: OpeningModel, id: string): OpeningPart {
  const x = m.parts.find((q) => q.id === id);
  expect(x, `peça '${id}' ausente`).toBeDefined();
  return x!;
}

/** Caixa da peça `id` nos intervalos t e z (s não entra aqui). */
function caixa(m: OpeningModel, id: string, [t0, t1]: number[], [z0, z1]: number[]): void {
  const b = peca(m, id).box;
  expect(b.t0, `${id}.t0`).toBeCloseTo(t0!, TOL);
  expect(b.t1, `${id}.t1`).toBeCloseTo(t1!, TOL);
  expect(b.z0, `${id}.z0`).toBeCloseTo(z0!, TOL);
  expect(b.z1, `${id}.z1`).toBeCloseTo(z1!, TOL);
}

const alizarDe = (m: OpeningModel, face: 'exterior' | 'interior') => m.parts.filter((q) => q.role === 'casing' && q.group === `casing-${face}`);
const quad = (q: OpeningPart) => [q.box.t0, q.box.t1, q.box.z0, q.box.z1];
const ordena = (xs: number[][]) => [...xs].sort((a, b) => a[0]! - b[0]! || a[2]! - b[2]!);

/** Alizar: em CADA face habilitada, exatamente as peças esperadas (t0, t1, z0, z1). */
function esperaAlizar(m: OpeningModel, esperado: number[][], faces: Array<'exterior' | 'interior'> = ['exterior', 'interior']): void {
  for (const face of faces) {
    const real = ordena(alizarDe(m, face).map(quad));
    expect(real.length, `alizar ${face}: nº de peças`).toBe(esperado.length);
    ordena(esperado).forEach((e, i) => e.forEach((v, k) => expect(real[i]![k], `alizar ${face} #${i} [${k}]`).toBeCloseTo(v, TOL)));
  }
}

const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** Retângulos (t, z) que tiram o vão: membros do motor + luzes das células (do modelo). */
function cobertura(m: OpeningModel, c: OpeningComposition): Array<{ t0: number; t1: number; z0: number; z1: number }> {
  const membros = m.parts.filter(ehMembro).map((q) => ({ t0: q.box.t0, t1: q.box.t1, z0: q.box.z0, z1: q.box.z1 }));
  return [...membros, ...resolveLayout(c).cells.map((x) => x.luz)];
}

function verificaCobre(m: OpeningModel, c: OpeningComposition, W: number, H: number): void {
  expect(m.width).toBeCloseTo(W, TOL);
  expect(m.height).toBeCloseTo(H, TOL);
  const rs = cobertura(m, c);
  const soma = rs.reduce((a, r) => a + (r.t1 - r.t0) * (r.z1 - r.z0), 0);
  expect(soma, 'soma das áreas = vão').toBeCloseTo(W * H, TOL);
  rs.forEach((r, i) => {
    expect(r.t0).toBeGreaterThanOrEqual(-W / 2 - EPS);
    expect(r.t1).toBeLessThanOrEqual(W / 2 + EPS);
    expect(r.z0).toBeGreaterThanOrEqual(-EPS);
    expect(r.z1).toBeLessThanOrEqual(H + EPS);
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[j]!;
      expect(ov(r.t0, r.t1, a.t0, a.t1) > EPS && ov(r.z0, r.z1, a.z0, a.z1) > EPS, `sobreposição ${i}×${j}`).toBe(false);
    }
  });
}

const ehMembro = (q: OpeningPart): boolean => MEMBROS.includes(String(q.role));
const colide = (a: OpeningPart, b: OpeningPart): boolean =>
  ov(a.box.t0, a.box.t1, b.box.t0, b.box.t1) > EPS && ov(a.box.s0, a.box.s1, b.box.s0, b.box.s1) > EPS && ov(a.box.z0, a.box.z1, b.box.z0, b.box.z1) > EPS;

/** Folha × membro: a folha encosta no batedor e invade no máximo LIP (t ou z), como em §1. Os demais pares: volume zero. */
function verificaSemSobreposicao(m: OpeningModel): void {
  const pecas = m.parts.filter((q) => FECHADO.includes(String(q.role)));
  expect(pecas.some((q) => q.role === 'casing'), 'alizar presente (sem ele o teste passa em vazio)').toBe(true);
  for (let i = 0; i < pecas.length; i++)
    for (let j = i + 1; j < pecas.length; j++) {
      const a = pecas[i]!;
      const b = pecas[j]!;
      const folhaMembro = (a.role === 'leaf' && ehMembro(b)) || (ehMembro(a) && b.role === 'leaf');
      if (folhaMembro) {
        const ot = ov(a.box.t0, a.box.t1, b.box.t0, b.box.t1);
        const oz = ov(a.box.z0, a.box.z1, b.box.z0, b.box.z1);
        if (ot > EPS && oz > EPS) expect(Math.min(ot, oz), `${a.id} × ${b.id}`).toBeLessThanOrEqual(LIP + 1e-6);
      } else {
        expect(colide(a, b), `${a.id} × ${b.id} colidem`).toBe(false);
      }
    }
}

// ───────────────────────── Ex. 1 a 5 (§1) ─────────────────────────

describe('Ex. 1 · porta 90 sem bandeira (vão 0,98 × 2,15)', () => {
  const c = cena('ot_p90', EX1);
  it('vão 0,98 × 2,15', () => {
    expect(c.m.width).toBeCloseTo(0.98, TOL);
    expect(c.m.height).toBeCloseTo(2.15, TOL);
  });
  it('ombreiras e travessa superior', () => {
    caixa(c.m, 'jamb-left', [-0.49, -0.44], [0, 2.1]);
    caixa(c.m, 'jamb-right', [0.44, 0.49], [0, 2.1]);
    caixa(c.m, 'head', [-0.49, 0.49], [2.1, 2.15]);
  });
  it('folha t ±0,451, z [0,008; 2,111]', () => {
    caixa(c.m, 'leaf-folha', [-0.451, 0.451], [0.008, 2.111]);
  });
  it('alizar: 3 peças por face (6 no total), sem inferior', () => {
    esperaAlizar(c.m, [
      [-0.51, -0.44, 0, 2.1],
      [0.44, 0.51, 0, 2.1],
      [-0.51, 0.51, 2.1, 2.17],
    ]);
  });
});

describe('Ex. 2 · porta 90 + bandeira superior 40 (vão 0,98 × 2,60)', () => {
  const c = cena('ot_p90', EX2);
  it('vão 0,98 × 2,60', () => {
    expect(c.m.width).toBeCloseTo(0.98, TOL);
    expect(c.m.height).toBeCloseTo(2.6, TOL);
  });
  it('ombreiras até 2,55; travessa interna t ±0,44 em z [2,10; 2,15]; superior z [2,55; 2,60]', () => {
    caixa(c.m, 'jamb-left', [-0.49, -0.44], [0, 2.55]);
    caixa(c.m, 'jamb-right', [0.44, 0.49], [0, 2.55]);
    caixa(c.m, 'transom-0', [-0.44, 0.44], [2.1, 2.15]);
    caixa(c.m, 'head', [-0.49, 0.49], [2.55, 2.6]);
  });
  it('vidro fixo z [2,15; 2,55]; folha como no Ex. 1', () => {
    caixa(c.m, 'glass-band', [-0.44, 0.44], [2.15, 2.55]);
    caixa(c.m, 'leaf-folha', [-0.451, 0.451], [0.008, 2.111]);
  });
  it('alizar topo 2,62; laterais até 2,55; nenhuma peça na travessa interna', () => {
    esperaAlizar(c.m, [
      [-0.51, -0.44, 0, 2.55],
      [0.44, 0.51, 0, 2.55],
      [-0.51, 0.51, 2.55, 2.62],
    ]);
  });
});

describe('Ex. 3 · porta 90 + 2 laterais de 40 (vão 1,88 × 2,15)', () => {
  const c = cena('ot_p90', EX3);
  it('vão 1,88 × 2,15', () => {
    expect(c.m.width).toBeCloseTo(1.88, TOL);
    expect(c.m.height).toBeCloseTo(2.15, TOL);
  });
  it('ombreiras externas, montantes em ±[0,44; 0,49], travessa superior ±0,94', () => {
    caixa(c.m, 'jamb-left', [-0.94, -0.89], [0, 2.1]);
    caixa(c.m, 'jamb-right', [0.89, 0.94], [0, 2.1]);
    caixa(c.m, 'mullion-0', [-0.49, -0.44], [0, 2.1]);
    caixa(c.m, 'mullion-1', [0.44, 0.49], [0, 2.1]);
    caixa(c.m, 'head', [-0.94, 0.94], [2.1, 2.15]);
  });
  it('vidros laterais de 0,40 e folha', () => {
    caixa(c.m, 'glass-lat-e', [-0.89, -0.49], [0, 2.1]);
    caixa(c.m, 'glass-lat-d', [0.49, 0.89], [0, 2.1]);
    caixa(c.m, 'leaf-folha', [-0.451, 0.451], [0.008, 2.111]);
  });
  it('alizar externo t ±0,96; nenhuma peça com |t| < 0,89', () => {
    esperaAlizar(c.m, [
      [-0.96, -0.89, 0, 2.1],
      [0.89, 0.96, 0, 2.1],
      [-0.96, 0.96, 2.1, 2.17],
    ]);
    for (const q of [...alizarDe(c.m, 'exterior'), ...alizarDe(c.m, 'interior')]) {
      expect(Math.min(Math.abs(q.box.t0), Math.abs(q.box.t1)), q.id).toBeGreaterThanOrEqual(0.89 - TOL);
    }
  });
});

describe('Ex. 4 · porta 90 + laterais + superior (vão 1,88 × 2,60)', () => {
  const c = cena('ot_p90', EX4);
  it('vão 1,88 × 2,60', () => {
    expect(c.m.width).toBeCloseTo(1.88, TOL);
    expect(c.m.height).toBeCloseTo(2.6, TOL);
  });
  it('travessa interna contínua t ±0,89; montantes terminam em z 2,10; ombreiras até 2,55', () => {
    caixa(c.m, 'transom-0', [-0.89, 0.89], [2.1, 2.15]);
    caixa(c.m, 'mullion-0', [-0.49, -0.44], [0, 2.1]);
    caixa(c.m, 'mullion-1', [0.44, 0.49], [0, 2.1]);
    caixa(c.m, 'jamb-left', [-0.94, -0.89], [0, 2.55]);
    caixa(c.m, 'jamb-right', [0.89, 0.94], [0, 2.55]);
    caixa(c.m, 'head', [-0.94, 0.94], [2.55, 2.6]);
  });
  it('vidro superior luz [-0,89; 0,89] × [2,15; 2,55]', () => {
    caixa(c.m, 'glass-band', [-0.89, 0.89], [2.15, 2.55]);
  });
  it('alizar topo 2,62; laterais z [0; 2,55]', () => {
    esperaAlizar(c.m, [
      [-0.96, -0.89, 0, 2.55],
      [0.89, 0.96, 0, 2.55],
      [-0.96, 0.96, 2.55, 2.62],
    ]);
  });
});

describe('Ex. 5 · janela combinada, 2 células (vão 1,60 × 1,20)', () => {
  const c = cena('ot_j120', EX5);
  it('vão 1,60 × 1,20', () => {
    expect(c.m.width).toBeCloseTo(1.6, TOL);
    expect(c.m.height).toBeCloseTo(1.2, TOL);
  });
  it('peitoril do caixilho z [0; 0,05]; ombreiras, travessa superior e montante', () => {
    caixa(c.m, 'sill-frame', [-0.8, 0.8], [0, 0.05]);
    caixa(c.m, 'jamb-left', [-0.8, -0.75], [0.05, 1.15]);
    caixa(c.m, 'jamb-right', [0.75, 0.8], [0.05, 1.15]);
    caixa(c.m, 'head', [-0.8, 0.8], [1.15, 1.2]);
    caixa(c.m, 'mullion-0', [-0.15, -0.1], [0.05, 1.15]);
  });
  it('células: fixa [-0,75; -0,15], abrir [-0,10; 0,75]; folha t [-0,111; 0,761]', () => {
    caixa(c.m, 'glass-fixa', [-0.75, -0.15], [0.05, 1.15]);
    caixa(c.m, 'leaf-abrir', [-0.111, 0.761], [0.05, 1.15]);
  });
  it('alizar de 4 lados por face, soleira z [-0,02; 0,05]', () => {
    esperaAlizar(c.m, [
      [-0.82, -0.75, 0.05, 1.15],
      [0.75, 0.82, 0.05, 1.15],
      [-0.82, 0.82, 1.15, 1.22],
      [-0.82, 0.82, -0.02, 0.05],
    ]);
  });
});

// ───────────────────────── Item 7: cobertura, com flips ─────────────────────────

describe('item 7 · cobertura: membros + luzes cobrem o vão, sem sobreposição', () => {
  for (const [nome, c, base, W, H] of EXEMPLOS)
    for (const flipHand of [false, true])
      for (const flipFacing of [false, true])
        it(`${nome} flipHand=${flipHand} flipFacing=${flipFacing}`, () => {
          verificaCobre(cena(base, c, {}, { flipHand, flipFacing }).m, c, W, H);
        });
});

// ───────────────────────── Item 8: sem sobreposição de volume (posição fechada) ─────────────────────────

describe('item 8 · sem sobreposição de volume entre membros, folha, vidro e alizar (fechado)', () => {
  for (const [nome, c, base] of EXEMPLOS)
    for (const flipHand of [false, true])
      for (const flipFacing of [false, true])
        it(`${nome} flipHand=${flipHand} flipFacing=${flipFacing}`, () => {
          verificaSemSobreposicao(cena(base, c, {}, { flipHand, flipFacing }).m);
        });
});

// ───────────────────────── Item 9: alizar (closure, setback, faces, barras) ─────────────────────────

describe('item 9 · alizar', () => {
  it('com alizar, o retorno do acabamento (closure efetivo) é none, mesmo com closure "both"', () => {
    const c = cena('ot_p90', EX1, { closure: 'both' });
    expect(insertMode(c.p.wallTypes['wt_x20']!, c.t)).toBe('none');
  });

  it('setback 0,01 desloca a aresta interna 0,01 (lateral em t [-0,52; -0,45]; cabeceira em z0 = 2,11)', () => {
    const c = cena('ot_p90', comp(leafC('folha'), { casing: { ...CASING, setback: 0.01 } }));
    const lateral = alizarDe(c.m, 'exterior').find((q) => q.box.z1 - q.box.z0 > 1)!;
    const cabeceira = alizarDe(c.m, 'exterior').find((q) => q.box.z1 - q.box.z0 < 0.2)!;
    expect(lateral.box.t0).toBeCloseTo(-0.52, TOL);
    expect(lateral.box.t1).toBeCloseTo(-0.45, TOL);
    expect(cabeceira.box.z0).toBeCloseTo(2.11, TOL);
  });

  it('faces "exterior" gera uma face só', () => {
    const c = cena('ot_p90', comp(leafC('folha'), { casing: { ...CASING, faces: 'exterior' } }));
    expect(new Set(c.m.parts.filter((q) => q.role === 'casing').map((q) => q.group))).toEqual(new Set(['casing-exterior']));
    expect(alizarDe(c.m, 'exterior')).toHaveLength(3);
  });

  it.each(EXEMPLOS.map((e) => [e[0], e[2], e[1]] as const))('%s: porta tem 3 barras por face, janela tem 4', (_nome, base, c) => {
    const m = cena(base, c).m;
    const esperadas = base === 'ot_j120' ? 4 : 3;
    for (const face of ['exterior', 'interior'] as const) expect(alizarDe(m, face)).toHaveLength(esperadas);
  });
});

// ───────────────────────── Item 12: tipos antigos com bandeira e laterais ─────────────────────────

describe('item 12 · tipos antigos (transom / sidelights) migrados: cobertura total, nada fora do vão', () => {
  const casos: Array<[string, Partial<OpeningType>]> = [
    ['bandeira fixa', { transom: { height: 0.4, fixed: true } }],
    ['laterais', { sidelights: { left: true, right: true, width: 0.4 } }],
  ];
  for (const [nome, extra] of casos)
    it(nome, () => {
      const c = cena('ot_p90', undefined, extra);
      const l = resolveLayout(compositionOfType(c.t));
      expect(l.span.width).toBeCloseTo(c.m.width, TOL);
      expect(l.span.height).toBeCloseTo(c.m.height, TOL);
      verificaCobre(c.m, compositionOfType(c.t), c.m.width, c.m.height);
      for (const q of c.m.parts.filter((x) => x.role !== 'casing')) {
        expect(q.box.t0, `${q.id} t0`).toBeGreaterThanOrEqual(-c.m.width / 2 - EPS);
        expect(q.box.t1, `${q.id} t1`).toBeLessThanOrEqual(c.m.width / 2 + EPS);
        expect(q.box.z1, `${q.id} z1`).toBeLessThanOrEqual(c.m.height + EPS);
      }
    });
});

// ───────────────────────── Item 15: planta com leafPlan 'open' ─────────────────────────

describe('item 15 · planta com leafPlan "open": folha só para a célula de folha', () => {
  const plano: OpeningPlanOptions = { detail: 'mid', angle: Math.PI / 2, planDisplay: 'symbolic', showSwing: true, swingStyle: 'arc', cutZ: 1 };
  const COM_PAINEL = comp(
    split('cols', 'cols', [fixo(0.4, glassC('lat-e')), fill(leafC('folha', { leafPlan: 'open' })), fixo(0.4, { kind: 'cell', id: 'painel', content: { kind: 'panel', thickness: 0.04 } })]),
  );
  it('uma folha fechada na planta (a da célula leaf), nenhuma para vidro ou painel', () => {
    const c = cena('ot_p90', COM_PAINEL);
    const folhas = openingPlanPaths(c.m, plano).filter((q) => q.role === 'leaf' && q.closed);
    expect(folhas).toHaveLength(1);
    const ts = folhas[0]!.pts.map((q) => q.t);
    expect(Math.min(...ts)).toBeCloseTo(-0.451, TOL);
    expect(Math.max(...ts)).toBeCloseTo(0.451, TOL);
  });
});
