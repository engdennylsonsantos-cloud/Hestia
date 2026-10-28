import { describe, expect, it } from 'vitest';
import {
  OPENING_FAMILIES,
  OPENING_PROFILE_PRESETS,
  compositionIssue,
  defaultOpeningProfiles,
  openingCompositionOf,
  resolveProfile,
  type OpeningComposition,
  type OpeningType,
  type ProfileRef,
} from '@hestia/model';
import { newOpeningTypeFromFamily } from '../../openingTypeForm.ts';
import {
  ALIZAR_FACES,
  alizarLigado,
  ajustarCampo,
  aValidar,
  comAlizar,
  comBatente,
  comDivisor,
  comVidro,
  divisores,
  presetsParaPapel,
  trocarPreset,
  vidros,
} from './profileControls.ts';

const perfis = defaultOpeningProfiles();
const composicao = (family: string, patch: Partial<OpeningType> = {}): OpeningComposition => {
  const f = OPENING_FAMILIES.find((x) => x.id === family)!;
  return openingCompositionOf({ ...newOpeningTypeFromFamily(f), ...patch });
};
const comDivisoes = (): OpeningComposition => composicao('window_fixed', { sidelights: { left: true, right: true, width: 0.4 } });

describe('presets por papel', () => {
  it('batente lista os presets de batente e os perfis próprios do projeto; divisor não entra', () => {
    const ids = presetsParaPapel('frame', { ...perfis, prf_meu: { ...perfis.prf_mad_batente_5x9!, id: 'prf_meu', roles: ['frame'] } }).map((p) => p.id);
    expect(ids).toContain('prf_mad_batente_5x9');
    expect(ids).toContain('prf_meu');
    expect(ids).not.toContain('prf_mad_divisor_5x9');
  });

  it('perfil próprio do projeto aparece em qualquer papel (fora da semente)', () => {
    const extra = { ...perfis.prf_mad_batente_5x9!, id: 'prf_extra', roles: ['divider' as const] };
    expect(presetsParaPapel('frame', { ...perfis, prf_extra: extra }).map((p) => p.id)).toContain('prf_extra');
    expect(OPENING_PROFILE_PRESETS.length).toBe(18);
  });
});

describe('perfil do quadro', () => {
  it('troca de preset grava o perfil certo (sem o ajuste anterior)', () => {
    const c = comBatente(composicao('window_fixed'), { presetId: 'prf_mad_batente_5x9', override: { visibleWidth: 0.04 } });
    const next = comBatente(c, trocarPreset('prf_alu_l25'));
    expect(next.frame.profile).toEqual({ presetId: 'prf_alu_l25' });
    expect(resolveProfile(next.frame.profile, perfis).material).toBe('aluminum');
  });

  it('override grava só o campo alterado e tira o que volta ao valor do preset', () => {
    const r: ProfileRef = { presetId: 'prf_mad_batente_5x9' };
    const a = ajustarCampo(r, perfis, 'visibleWidth', 0.04);
    expect(a).toEqual({ presetId: 'prf_mad_batente_5x9', override: { visibleWidth: 0.04 } });
    const b = ajustarCampo(a, perfis, 'depth', 0.1);
    expect(b).toEqual({ presetId: 'prf_mad_batente_5x9', override: { visibleWidth: 0.04, depth: 0.1 } });
    expect(ajustarCampo(b, perfis, 'visibleWidth', 0.05)).toEqual({ presetId: 'prf_mad_batente_5x9', override: { depth: 0.1 } });
    expect(ajustarCampo(b, perfis, 'depth', 0.09)).toEqual({ presetId: 'prf_mad_batente_5x9', override: { visibleWidth: 0.04 } });
  });

  it('perfil próprio (migrado) ajusta o próprio spec, sem preset', () => {
    const inline: ProfileRef = { inline: { material: 'wood', section: 'rect', visibleWidth: 0.05, depth: 0.09 } };
    expect(ajustarCampo(inline, perfis, 'depth', 0.12)).toEqual({ inline: { material: 'wood', section: 'rect', visibleWidth: 0.05, depth: 0.12 } });
  });

  it('marca "a validar" nos campos que o preset não confirma', () => {
    expect(aValidar({ presetId: 'prf_mad_caixilho_35x70' }, perfis, 'visibleWidth')).toBe(false);
    expect(aValidar({ presetId: 'prf_mad_caixilho_35x70' }, perfis, 'depth')).toBe(false);
    expect(aValidar({ presetId: 'prf_mad_caixilho_35x70' }, perfis, 'stopWidth')).toBe(true);
    expect(aValidar({ presetId: 'prf_mad_batente_5x9' }, perfis, 'visibleWidth')).toBe(true);
    expect(aValidar({ inline: { material: 'wood', section: 'rect', visibleWidth: 0.05, depth: 0.09 } }, perfis, 'depth')).toBe(true);
  });

  it('divisor: troca o perfil da divisão e volta ao padrão sem o campo', () => {
    const c = comDivisoes();
    const split = divisores(c.layout)[0]!;
    const com = comDivisor(c, split.id, { presetId: 'prf_mad_montante_4x9' });
    expect(divisores(com.layout)[0]!.divider).toEqual({ presetId: 'prf_mad_montante_4x9' });
    const sem = comDivisor(com, split.id, undefined);
    expect('divider' in divisores(sem.layout)[0]!).toBe(false);
  });
});

describe('alizar', () => {
  it('faces e recuo gravam; sem faces habilitadas o alizar não está ligado', () => {
    const c = composicao('window_fixed');
    expect(alizarLigado(c)).toBe(false);
    const ex = comAlizar(c, { faces: 'exterior' });
    expect(ex.casing?.faces).toBe('exterior');
    expect(ex.casing?.width).toBe(0.07);
    expect(alizarLigado(ex)).toBe(true);
    const rec = comAlizar(ex, { setback: 0.01 });
    expect(rec.casing?.setback).toBe(0.01);
    expect(rec.casing?.faces).toBe('exterior');
    expect(alizarLigado(comAlizar(ex, { faces: 'none' }))).toBe(false);
    expect(ALIZAR_FACES.map(([v]) => v)).toEqual(['both', 'swing', 'opposite', 'exterior', 'interior', 'none']);
  });
});

describe('vidro', () => {
  it('troca só a célula de vidro escolhida', () => {
    const c = comDivisoes();
    const vid = vidros(c);
    expect(vid.length).toBeGreaterThan(0);
    const id = vid[0]!.id;
    const next = comVidro(c, id, { kind: 'tempered', thickness: 0.01 });
    const antes = vid[0]!.content;
    const depois = vidros(next).find((x) => x.id === id)!.content;
    expect(antes.kind).toBe('glass');
    expect(depois).toEqual({ kind: 'glass', glass: { ...(antes as { glass: object }).glass, kind: 'tempered', thickness: 0.01 } });
    expect(vidros(next).length).toBe(vid.length);
  });
});

describe('validação', () => {
  it('vão nominal zerado é apontado pelo modelo', () => {
    const c = composicao('window_fixed');
    expect(compositionIssue({ ...c, nominal: { ...c.nominal, width: 0 } }, perfis)).toBe('Dimensões nominais devem ser positivas');
  });
});
