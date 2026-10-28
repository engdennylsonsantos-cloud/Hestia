import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES } from './defaults.ts';
import { canonComposition, compositionOfType, withBridgedComposition } from './openingCompositionOf.ts';
import { openingSpanOf } from './openingNominal.ts';
import type { OpeningType } from './openingTypes.ts';

/* Regressões da revisão independente da composição (achados 2, 3 e 4). */
const porta = () => DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_p90')!;

describe('compositionOfType respeita as famílias de janela (E3 §7)', () => {
  it('janela de guilhotina com bandeira e veneziana ou correr com laterais não ganham células extras', () => {
    const guilhotina = DEFAULT_OPENING_TYPES.find((t) => t.kind === 'window' && t.leaves > 0 && t.id.includes('guil'));
    const lista: OpeningType[] = [];
    if (guilhotina) lista.push({ ...guilhotina, transom: { height: 0.4, fixed: true } });
    const correr = DEFAULT_OPENING_TYPES.find((t) => t.kind === 'window' && t.plan === 'sliding');
    if (correr) lista.push({ ...correr, sidelights: { left: true, right: true, width: 0.4 } });
    expect(lista.length).toBeGreaterThan(0);
    for (const t of lista) expect(compositionOfType(t).layout.kind, t.id).toBe('cell');
  });
});

describe('ponte da composição autoral de uma célula', () => {
  it('salvar de novo com outra largura não apaga o perfil autoral', () => {
    const base = porta();
    const autoral = { ...compositionOfType(base), frame: { ...compositionOfType(base).frame, profile: { presetId: 'prf_mad_aduela_3' } } };
    const prev: OpeningType = { ...base, composition: autoral };
    const out = withBridgedComposition({ ...prev, name: 'Renomeada' }, prev);
    expect(canonComposition(out.composition)).toBe(canonComposition(autoral));
  });

  it('a composição derivada segue regenerada quando um campo antigo muda', () => {
    const base = porta();
    const prev: OpeningType = { ...base, composition: compositionOfType(base) };
    const out = withBridgedComposition({ ...prev, width: 1 }, prev);
    expect(out.composition?.nominal.width).toBe(1);
  });

  it('a ordem das chaves não faz uma composição igual parecer editada', () => {
    const c = compositionOfType(porta());
    const inverte = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(inverte) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, inverte(x)])) : v;
    const invertida = inverte(c) as typeof c;
    expect(JSON.stringify(invertida)).not.toBe(JSON.stringify(c));
    expect(canonComposition(invertida)).toBe(canonComposition(c));
  });
});

describe('vão do tipo com composição de uma célula autoral', () => {
  it('openingSpanOf segue o nominal da composição (o mesmo que o motor usa)', () => {
    const base = porta();
    const c = compositionOfType(base);
    const t: OpeningType = { ...base, composition: { ...c, nominal: { ref: 'leaf', width: 1.2, height: 2.1, gap: { w: 0.08, h: 0.05 }, nominalCellId: 'c1' } } };
    expect(openingSpanOf(t).width).toBeCloseTo(1.28, 9);
  });
});
