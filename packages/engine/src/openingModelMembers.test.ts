import { describe, expect, it } from 'vitest';
import { EX1, EX2, EX3, EX4, EX5, cenaComposicao, comp, fill, fixo, glassC, leafC, peca } from './openingModelFixture.ts';
import type { OpeningModel } from './openingModelTypes.ts';

/* Fumaça do motor de composição: os 5 exemplos de docs/aberturas/F1-spec-composicao.md §1 (tolerância 1e-6). */

const P1 = { nominalRef: 'leaf' as const, width: 0.9, height: 2.1 };
const perto = (v: number[]) => v.map((x) => expect.closeTo(x, 6));
const caixa = (m: OpeningModel, id: string, [t0, t1]: number[], [z0, z1]: number[]): void => {
  const b = peca(m, id).box;
  expect([b.t0, b.t1, b.z0, b.z1], id).toEqual(perto([t0!, t1!, z0!, z1!]));
};
/** Envoltória (t0, t1, z0, z1) das peças com o prefixo de id dado. */
const envoltoria = (m: OpeningModel, prefixo: string) => {
  const ps = m.parts.filter((q) => q.id.startsWith(prefixo));
  return [Math.min(...ps.map((q) => q.box.t0)), Math.max(...ps.map((q) => q.box.t1)), Math.min(...ps.map((q) => q.box.z0)), Math.max(...ps.map((q) => q.box.z1))];
};

describe('composição · Ex. 1 (uma célula autoral)', () => {
  const m = cenaComposicao('ot_p90', EX1, P1).m;
  it('vão, ombreiras, travessa e folha', () => {
    expect([m.width, m.height]).toEqual(perto([0.98, 2.15]));
    caixa(m, 'jamb-left', [-0.49, -0.44], [0, 2.1]);
    caixa(m, 'jamb-right', [0.44, 0.49], [0, 2.1]);
    caixa(m, 'head', [-0.49, 0.49], [2.1, 2.15]);
    const f = envoltoria(m, 'leaf-folha');
    expect(f[0]).toBeCloseTo(-0.451, 6);
    expect(f[1]).toBeCloseTo(0.451, 6);
    expect(f[3]).toBeCloseTo(2.111, 6);
  });
});

describe('composição · Ex. 2 (bandeira superior)', () => {
  const m = cenaComposicao('ot_p90', EX2, P1).m;
  it('travessa interna, vidro e membros', () => {
    expect([m.width, m.height]).toEqual(perto([0.98, 2.6]));
    caixa(m, 'jamb-left', [-0.49, -0.44], [0, 2.55]);
    caixa(m, 'transom-0', [-0.44, 0.44], [2.1, 2.15]);
    caixa(m, 'head', [-0.49, 0.49], [2.55, 2.6]);
    caixa(m, 'glass-band', [-0.44, 0.44], [2.15, 2.55]);
  });
  it('a folha entra 0,011 no rebaixo da travessa interna', () => {
    expect(envoltoria(m, 'leaf-folha')[3]).toBeCloseTo(2.111, 6);
  });
});

describe('composição · Ex. 3 (duas laterais)', () => {
  const m = cenaComposicao('ot_p90', EX3, P1).m;
  it('montantes, ombreiras e vidros laterais', () => {
    expect([m.width, m.height]).toEqual(perto([1.88, 2.15]));
    caixa(m, 'jamb-left', [-0.94, -0.89], [0, 2.1]);
    caixa(m, 'mullion-0', [-0.49, -0.44], [0, 2.1]);
    caixa(m, 'mullion-1', [0.44, 0.49], [0, 2.1]);
    caixa(m, 'head', [-0.94, 0.94], [2.1, 2.15]);
    caixa(m, 'glass-lat-e', [-0.89, -0.49], [0, 2.1]);
    caixa(m, 'glass-lat-d', [0.49, 0.89], [0, 2.1]);
  });
});

describe('composição · Ex. 4 (laterais + superior)', () => {
  const m = cenaComposicao('ot_p90', EX4, P1).m;
  it('travessa contínua e montantes que terminam nela', () => {
    expect([m.width, m.height]).toEqual(perto([1.88, 2.6]));
    caixa(m, 'transom-0', [-0.89, 0.89], [2.1, 2.15]);
    caixa(m, 'mullion-0', [-0.49, -0.44], [0, 2.1]);
    caixa(m, 'jamb-right', [0.89, 0.94], [0, 2.55]);
    caixa(m, 'glass-band', [-0.89, 0.89], [2.15, 2.55]);
  });
});

describe('composição · Ex. 5 (janela combinada)', () => {
  const m = cenaComposicao('ot_j120', EX5).m;
  it('peitoril do caixilho, montante e vidro fixo', () => {
    expect([m.width, m.height]).toEqual(perto([1.6, 1.2]));
    caixa(m, 'sill-frame', [-0.8, 0.8], [0, 0.05]);
    caixa(m, 'jamb-left', [-0.8, -0.75], [0.05, 1.15]);
    caixa(m, 'mullion-0', [-0.15, -0.1], [0.05, 1.15]);
    caixa(m, 'glass-fixa', [-0.75, -0.15], [0.05, 1.15]);
  });
  it('a folha de abrir fica dentro da célula [-0,10; 0,75] mais o batedor, com folha 0 e um item de abertura', () => {
    const f = envoltoria(m, 'leaf-abrir');
    expect(f[0]).toBeGreaterThanOrEqual(-0.111 - 1e-6);
    expect(f[1]).toBeLessThanOrEqual(0.761 + 1e-6);
    expect(m.parts.filter((q) => q.role === 'leaf').every((q) => q.leaf === 0)).toBe(true);
    expect(m.openings).toHaveLength(1);
  });
});

describe('composição · seção do membro voltada à célula vizinha', () => {
  it('membro ao lado da folha tem rebaixo; o que só toca vidro sem rebaixo de vidro é caixa', () => {
    expect(peca(cenaComposicao('ot_p90', EX3, P1).m, 'mullion-0').profile).toBeDefined();
    const m = cenaComposicao('ot_p90', EX2, P1).m;
    expect(peca(m, 'transom-0').profile).toBeDefined();
    expect(peca(m, 'head').profile).toBeUndefined();
  });
});

describe('composição · vidro no rebaixo, frameless e baguete', () => {
  const caixilho = { presetId: 'prf_mad_caixilho_35x70' };
  const fixaAbrir = (glass: ReturnType<typeof glassC>) =>
    comp(
      { kind: 'split', id: 'cols', axis: 'cols', children: [fixo(0.6, glass), fill(leafC('abrir', false))] },
      { nominal: { ref: 'opening', width: 1.6, height: 1.2 }, frame: { style: 'rebate', profile: caixilho, depthMode: 'core' } },
    );

  it('perfil com rebaixo: placa = luz + 2·(0,012 − 0,003) por eixo, baguete na face interior', () => {
    const m = cenaComposicao('ot_j120', fixaAbrir(glassC('fixa'))).m;
    const b = peca(m, 'glass-fixa').box;
    expect(b.t1 - b.t0).toBeCloseTo(0.6 + 0.018, 6);
    expect(b.z1 - b.z0).toBeCloseTo(1.2 - 2 * 0.035 + 0.018, 6);
    const bead = peca(m, 'bead-fixa-left');
    expect(bead.role).toBe('bead');
    const interior = m.parts.find((q) => q.role === 'casing' && q.group === 'casing-interior')!;
    expect(Math.sign((bead.box.s0 + bead.box.s1) / 2)).toBe(Math.sign((interior.box.s0 + interior.box.s1) / 2));
  });

  it('frameless: placa = luz − 2·0,005, sem baguete', () => {
    const frameless = { kind: 'cell' as const, id: 'fixa', content: { kind: 'glass' as const, glass: { kind: 'clear' as const, thickness: 0.01, mounting: 'frameless' as const } } };
    const m = cenaComposicao('ot_j120', fixaAbrir(frameless)).m;
    const b = peca(m, 'glass-fixa').box;
    expect(b.t1 - b.t0).toBeCloseTo(0.6 - 0.01, 6);
    expect(m.parts.some((q) => q.role === 'bead')).toBe(false);
  });
});
