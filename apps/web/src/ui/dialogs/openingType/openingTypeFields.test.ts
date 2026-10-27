import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, type OpeningType } from '@hestia/model';
import {
  OPENING_FORM_DEFAULTS,
  openingFormCasingSides,
  openingFormFrameDepthMode,
  openingFormGlassKind,
  openingFormGlassRatio,
  openingFormHinges,
  openingFormLeafMaterial,
  openingFormReveal,
  openingFormThreshold,
  openingFormTiltAxis,
  setOpeningCasingSides,
  setOpeningReveal,
  setOpeningThreshold,
  setOpeningThresholdMaterial,
  setOpeningThresholdThickness,
  setOpeningTransomFixed,
  withOpeningField,
} from './openingTypeFields.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

describe('campos v2 com padrão por leitura', () => {
  it('grava só quando o valor difere do padrão e volta à leitura quando igual', () => {
    const porta = tipo('ot_p90');
    expect(porta.handle).toBeUndefined();
    expect(withOpeningField(porta, 'handle', 'lever', 'lever').handle).toBeUndefined();
    const knob = withOpeningField(porta, 'handle', 'knob', 'lever');
    expect(knob.handle).toBe('knob');
    expect(withOpeningField(knob, 'handle', 'lever', 'lever').handle).toBeUndefined();
  });

  it('vale para estilo da folha, batente, ângulos, grade e detalhe', () => {
    const porta = tipo('ot_p90');
    expect(withOpeningField(porta, 'leafStyle', 'flush', 'flush').leafStyle).toBeUndefined();
    expect(withOpeningField(porta, 'leafStyle', 'panel', 'flush').leafStyle).toBe('panel');
    expect(withOpeningField(porta, 'frameStyle', 'rebate', 'rebate').frameStyle).toBeUndefined();
    expect(withOpeningField(porta, 'frameStyle', 'simple', 'rebate').frameStyle).toBe('simple');
    expect(withOpeningField(porta, 'angle2d', 90, 90).angle2d).toBeUndefined();
    expect(withOpeningField(porta, 'angle3d', 90, 90).angle3d).toBeUndefined();
    expect(withOpeningField(porta, 'angle3d', 30, 90).angle3d).toBe(30);
    const umPorUm = { cols: 1, rows: 1 };
    expect(withOpeningField(porta, 'grid', umPorUm, umPorUm).grid).toBeUndefined();
    expect(withOpeningField(porta, 'grid', { cols: 2, rows: 1 }, umPorUm).grid).toEqual({ cols: 2, rows: 1 });
    expect(withOpeningField(porta, 'detail2d', 'scale', 'scale').detail2d).toBeUndefined();
    expect(withOpeningField(porta, 'detail2d', 'high', 'scale').detail2d).toBe('high');
    expect(withOpeningField(porta, 'detail3d', 'view', 'view').detail3d).toBeUndefined();
    expect(withOpeningField(porta, 'detail3d', 'full', 'view').detail3d).toBe('full');
  });
});

describe('campos novos do formulário (leitores, setters e volta ao padrão)', () => {
  const porta = tipo('ot_p90');

  it('lê os padrões quando o campo falta', () => {
    expect(openingFormFrameDepthMode(porta)).toBe('wall');
    expect(openingFormReveal(porta)).toEqual({ depth: 0, anchor: 'face' });
    expect(openingFormCasingSides(porta)).toBe('both');
    expect(openingFormGlassRatio(porta)).toBe(0.5);
    expect(openingFormHinges(porta)).toBe(3);
    expect(openingFormThreshold(porta)).toBeNull();
    expect(openingFormGlassKind(porta)).toBe('clear');
    expect(openingFormTiltAxis(porta)).toBe(0.5);
    expect(openingFormLeafMaterial(porta)).toBe(porta.frameMaterialId);
  });

  it('cada campo muda só a própria chave e volta ao padrão removendo-a', () => {
    const modo = withOpeningField(porta, 'frameDepthMode', 'core', OPENING_FORM_DEFAULTS.frameDepthMode);
    expect(modo).toEqual({ ...porta, frameDepthMode: 'core' });
    expect(withOpeningField(modo, 'frameDepthMode', 'wall', OPENING_FORM_DEFAULTS.frameDepthMode)).toEqual(porta);

    const recuo = setOpeningReveal(porta, { depth: 0.05, anchor: 'core' });
    expect(recuo).toEqual({ ...porta, reveal: { depth: 0.05, anchor: 'core' } });
    expect(setOpeningReveal(recuo, { depth: 0, anchor: 'face' })).toEqual(porta);

    const comAlizar = { ...porta, casing: { width: 0.05, thickness: 0.015 } };
    const lados = setOpeningCasingSides(comAlizar, 'opposite');
    expect(lados).toEqual({ ...comAlizar, casing: { width: 0.05, thickness: 0.015, sides: 'opposite' } });
    expect(setOpeningCasingSides(lados, 'both')).toEqual(comAlizar);

    const fracao = withOpeningField(porta, 'glassRatio', 0.75, OPENING_FORM_DEFAULTS.glassRatio);
    expect(fracao).toEqual({ ...porta, glassRatio: 0.75 });
    expect(withOpeningField(fracao, 'glassRatio', 0.5, OPENING_FORM_DEFAULTS.glassRatio)).toEqual(porta);

    const dobradiças = withOpeningField(porta, 'hinges', 4, OPENING_FORM_DEFAULTS.hinges);
    expect(dobradiças).toEqual({ ...porta, hinges: 4 });
    expect(withOpeningField(dobradiças, 'hinges', 3, OPENING_FORM_DEFAULTS.hinges)).toEqual(porta);

    const soleira = setOpeningThreshold(porta, true, 'mat_ceramica');
    expect(soleira).toEqual({ ...porta, threshold: { thickness: 0.03, materialId: 'mat_ceramica' } });
    expect(setOpeningThreshold(soleira, false)).toEqual(porta);
    expect(setOpeningThresholdThickness(soleira, 0.05)).toEqual({ ...porta, threshold: { thickness: 0.05, materialId: 'mat_ceramica' } });
    expect(setOpeningThresholdMaterial(soleira, 'mat_concreto')).toEqual({ ...porta, threshold: { thickness: 0.03, materialId: 'mat_concreto' } });

    const vidro = withOpeningField(porta, 'glassKind', 'tempered', OPENING_FORM_DEFAULTS.glassKind);
    expect(vidro).toEqual({ ...porta, glassKind: 'tempered' });
    expect(withOpeningField(vidro, 'glassKind', 'clear', OPENING_FORM_DEFAULTS.glassKind)).toEqual(porta);

    const eixo = withOpeningField(porta, 'tiltAxis', 0.3, OPENING_FORM_DEFAULTS.tiltAxis);
    expect(eixo).toEqual({ ...porta, tiltAxis: 0.3 });
    expect(withOpeningField(eixo, 'tiltAxis', 0.5, OPENING_FORM_DEFAULTS.tiltAxis)).toEqual(porta);

    const folha = withOpeningField(porta, 'leafMaterialId', 'mat_aco', porta.frameMaterialId);
    expect(folha).toEqual({ ...porta, leafMaterialId: 'mat_aco' });
    expect(withOpeningField(folha, 'leafMaterialId', porta.frameMaterialId, porta.frameMaterialId)).toEqual(porta);
  });

  it('bandeira maxim-ar liga/desliga mantendo altura e volta ao padrão fixo', () => {
    const comBandeira: OpeningType = { ...porta, transom: { height: 0.3 } };
    const maxim = setOpeningTransomFixed(comBandeira, false);
    expect(maxim.transom).toEqual({ height: 0.3, fixed: false });
    expect(setOpeningTransomFixed(maxim, true).transom).toEqual({ height: 0.3 });
  });
});
