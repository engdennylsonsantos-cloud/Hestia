import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, compositionCells, compositionOfType, openingCompositionOf, openingFamilies, type OpeningType } from '@hestia/model';
import { alternarTransom, applyFamily, bridgeDraft, hasAuthoredComposition, syncFamilyInComposition } from '../openingTypeForm.ts';
import { previewTypeSignature } from './previewViews.ts';

/* Regressões: família que não mudava, bandeira sem efeito e prévia que não refazia (rascunho com composição migrada). */
const migrado = (id: string): OpeningType => {
  const t = DEFAULT_OPENING_TYPES.find((x) => x.id === id)!;
  return { ...t, composition: compositionOfType(t) };
};

describe('rascunho do diálogo passa pela ponte da composição', () => {
  it('trocar a família regenera a composição derivada (a prévia e o modelo seguem a família nova)', () => {
    const prev = migrado('ot_p90');
    const fam = openingFamilies('door').find((f) => f.id === 'door_pivot')!;
    const { type, error } = bridgeDraft(applyFamily(prev, fam), prev);
    expect(error).toBeNull();
    const leaf = compositionCells(type.composition!).find((c) => c.content.kind === 'leaf')!;
    expect(leaf.content.kind === 'leaf' && leaf.content.family).toBe('door_pivot');
  });

  it('ligar a bandeira superior vira célula na composição', () => {
    const prev = migrado('ot_p90');
    const { type } = bridgeDraft(alternarTransom(prev, true), prev);
    expect(openingCompositionOf(type).layout.kind).toBe('split');
    expect(compositionCells(openingCompositionOf(type)).some((c) => c.content.kind === 'glass')).toBe(true);
  });

  it('composição editada nos módulos é preservada e a troca de família atualiza a célula de folha', () => {
    const base = migrado('ot_p90');
    const autoral: OpeningType = { ...base, composition: { ...base.composition!, frame: { ...base.composition!.frame, profile: { presetId: 'prf_mad_aduela_3' } } } };
    expect(hasAuthoredComposition(autoral)).toBe(true);
    const fam = openingFamilies('door').find((f) => f.id === 'door_pivot')!;
    const next = syncFamilyInComposition(applyFamily(autoral, fam), fam);
    const { type } = bridgeDraft(next, autoral);
    expect(type.composition!.frame.profile).toEqual({ presetId: 'prf_mad_aduela_3' });
    const leaf = compositionCells(type.composition!).find((c) => c.content.kind === 'leaf')!;
    expect(leaf.content.kind === 'leaf' && leaf.content.family).toBe('door_pivot');
  });
});

describe('assinatura da prévia', () => {
  it('muda com a composição e com campos novos, e não muda com nome ou custo', () => {
    const t = migrado('ot_p90');
    const sig = previewTypeSignature(t);
    expect(previewTypeSignature({ ...t, name: 'Outro nome', cost: 99, code: 'X' })).toBe(sig);
    expect(previewTypeSignature({ ...t, reveal: { depth: 0.02 } })).not.toBe(sig);
    expect(previewTypeSignature({ ...t, composition: { ...t.composition!, frame: { ...t.composition!.frame, depthMode: 'core' } } })).not.toBe(sig);
  });
});
