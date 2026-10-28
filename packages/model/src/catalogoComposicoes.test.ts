import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES } from './index.ts';
import { CATALOGO_COMPOSICOES_BR } from './catalogoComposicoes.ts';
import { compositionSpan, resolveLayout } from './openingCompositionLayout.ts';
import { compositionIssue } from './openingCompositionRules.ts';

const NOVOS = CATALOGO_COMPOSICOES_BR;
const CODIGOS_ATUAIS = new Set(DEFAULT_OPENING_TYPES.filter((t) => !t.composition).map((t) => t.code));
const IDS_ATUAIS = new Set(DEFAULT_OPENING_TYPES.filter((t) => !t.composition).map((t) => t.id));

describe('catálogo de composições', () => {
  it('são 24 tipos, todos com composição gravada', () => {
    expect(NOVOS).toHaveLength(24);
    for (const t of NOVOS) expect(t.composition, t.id).toBeDefined();
  });

  it('cada composição passa em compositionIssue (sem problema de regra)', () => {
    for (const t of NOVOS) expect(compositionIssue(t.composition!), t.id).toBeNull();
  });

  it('ids e códigos únicos e sem colisão com o catálogo atual', () => {
    expect(new Set(NOVOS.map((t) => t.id)).size).toBe(NOVOS.length);
    expect(new Set(NOVOS.map((t) => t.code)).size).toBe(NOVOS.length);
    for (const t of NOVOS) {
      expect(IDS_ATUAIS.has(t.id), t.id).toBe(false);
      expect(CODIGOS_ATUAIS.has(t.code), t.code).toBe(false);
      expect(t.id.startsWith('ot_'), t.id).toBe(true);
      expect(/^(P|J)-\d{2}$/.test(t.code ?? ''), t.id).toBe(true);
    }
  });

  it('códigos seguem a numeração existente: portas a partir de P-47, janelas a partir de J-51', () => {
    const portas = NOVOS.filter((t) => t.kind === 'door').map((t) => t.code);
    const janelas = NOVOS.filter((t) => t.kind === 'window').map((t) => t.code);
    expect(portas[0]).toBe('P-47');
    expect(janelas[0]).toBe('J-51');
    expect(portas.every((c) => Number(c?.slice(2)) >= 47)).toBe(true);
    expect(janelas.every((c) => Number(c?.slice(2)) >= 51)).toBe(true);
  });

  it('vão coerente: porta com folha de 2,10 tem vão de altura ≥ 2,15; janela tem o vão do tipo', () => {
    for (const t of NOVOS) {
      const span = compositionSpan(t.composition!);
      if (t.kind === 'door') {
        expect(t.nominalRef, t.id).toBe('leaf');
        expect(t.composition!.nominal.ref, t.id).toBe('leaf');
        expect(t.height, t.id).toBeCloseTo(2.1, 9);
        expect(span.height, t.id).toBeGreaterThanOrEqual(2.15 - 1e-9);
        expect(span.width, t.id).toBeGreaterThanOrEqual(t.width + 0.08 - 1e-9);
      } else {
        expect(t.nominalRef, t.id).toBeUndefined();
        expect(span.width, t.id).toBeCloseTo(t.width, 9);
        expect(span.height, t.id).toBeCloseTo(t.height, 9);
      }
    }
  });
});

describe('travessa-base sob vidro lateral até o piso (spec F1 §10, pergunta 2)', () => {
  it('porta com 2 laterais: uma travessa-base sob cada lateral, nenhuma sob a folha, e a folha segue do piso', () => {
    const t = DEFAULT_OPENING_TYPES.find((x) => x.id === 'ot_plat2_90')!;
    expect(t.composition?.frame.sill).toBeDefined();
    const l = resolveLayout(t.composition!, undefined, 'door');
    const bases = l.members.filter((m) => m.role === 'sill');
    expect(bases.map((m) => m.id).sort()).toEqual(['sill-lat-dir', 'sill-lat-esq']);
    const folha = l.cells.find((c) => c.id === 'folha')!;
    expect(folha.luz.z0).toBe(0);
    for (const b of bases) {
      expect(b.rect.z0).toBe(0);
      expect(b.rect.t1 <= folha.luz.t0 + 1e-9 || b.rect.t0 >= folha.luz.t1 - 1e-9).toBe(true);
    }
    const lat = l.cells.find((c) => c.id === 'lat-esq')!;
    expect(lat.luz.z0).toBeCloseTo(bases[0]!.rect.z1, 9);
  });
});
