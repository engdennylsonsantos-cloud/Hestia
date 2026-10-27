import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES } from './defaults.ts';
import { OPENING_FAMILIES, openingFamilyOf, openingTypeIssue } from './opening.ts';
import { openingFormFields, openingOptionSupport, type OpeningFormFieldId } from './openingSupport.ts';

describe('opções por família', () => {
  it('toda família registrada tem linha na tabela', () => {
    for (const f of OPENING_FAMILIES) expect(openingOptionSupport(f.id), f.id).toBeDefined();
  });
  it('bandeira: portas de giro e janelas com folha; nunca guilhotina, veneziana nem vãos', () => {
    expect(openingOptionSupport('door_swing').transom).toBe(true);
    expect(openingOptionSupport('window_casement').transom).toBe(true);
    for (const id of ['window_hung', 'window_louver', 'window_void', 'door_void', 'door_garage'] as const) expect(openingOptionSupport(id).transom, id).toBe(false);
  });
  it('só a basculante tem eixo; a referência nominal da folha ainda não é oferecida (fica fora do diálogo)', () => {
    expect(OPENING_FAMILIES.filter((f) => openingOptionSupport(f.id).tiltAxis).map((f) => f.id)).toEqual(['window_tilt']);
    expect(OPENING_FAMILIES.some((f) => openingOptionSupport(f.id).nominalRef)).toBe(false);
  });
  it('família nula ou desconhecida: nada se aplica', () => {
    expect(Object.values(openingOptionSupport(null)).every((v) => v === false)).toBe(true);
  });
});

describe('campos do formulário por família', () => {
  it('lista exatamente as opções aplicáveis, sem tabela paralela', () => {
    for (const f of OPENING_FAMILIES) {
      const support = openingOptionSupport(f.id);
      const esperado = (Object.keys(support) as OpeningFormFieldId[]).filter((k) => support[k]);
      expect(new Set(openingFormFields(f.id)), f.id).toEqual(new Set(esperado));
    }
  });

  it('exemplos de recorte: portão sem maçaneta/bandeira/soleira, veneziana sem bandeira/grade, basculante com eixo', () => {
    expect(openingFormFields('door_garage')).not.toContain('handle');
    expect(openingFormFields('door_garage')).not.toContain('transom');
    expect(openingFormFields('door_garage')).not.toContain('threshold');
    expect(openingFormFields('window_louver')).not.toContain('transom');
    expect(openingFormFields('window_louver')).not.toContain('grid');
    expect(openingFormFields('window_tilt')).toContain('tiltAxis');
    expect(openingFormFields('door_swing')).toEqual(
      expect.arrayContaining(['leafStyle', 'glassRatio', 'handle', 'hinges', 'threshold', 'frame', 'reveal', 'casing', 'glassKind', 'grid', 'angle']),
    );
  });

  it('ordem estável e família desconhecida sem campos', () => {
    expect(openingFormFields('window_tilt')).toEqual(openingFormFields('window_tilt'));
    expect(openingFormFields(null)).toEqual([]);
    expect(openingFormFields('nao_existe' as never)).toEqual([]);
  });
});

describe('validação dos campos novos do tipo', () => {
  const porta = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_p90')!;
  const janela = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_j120')!;

  it('recusa frameDepthMode, reveal, casing.sides, glassRatio, hinges, threshold, tiltAxis e glassKind inválidos', () => {
    expect(openingTypeIssue({ ...porta, frameDepthMode: 'x' as never })).toBe('Profundidade do batente: modo desconhecido.');
    expect(openingTypeIssue({ ...porta, reveal: { depth: 0.2 } })).toBe('Recuo do batente: use um valor de 0 a 15 cm.');
    expect(openingTypeIssue({ ...porta, casing: { width: 0.05, thickness: 0.015, sides: 'x' as never } })).toBe('Alizar: lados desconhecidos.');
    expect(openingTypeIssue({ ...porta, glassRatio: 0.05 })).toBe('Fração de vidro: use um valor de 0,1 a 0,9.');
    expect(openingTypeIssue({ ...porta, hinges: 5 })).toBe('Dobradiças: use 2, 3 ou 4.');
    expect(openingTypeIssue({ ...porta, hinges: 2.5 })).toBe('Dobradiças: use 2, 3 ou 4.');
    expect(openingTypeIssue({ ...porta, threshold: { thickness: 0.1 } })).toBe('Soleira: espessura entre 0,5 e 8 cm.');
    expect(openingTypeIssue({ ...janela, tiltAxis: 0.1 })).toBe('Eixo da basculante: use uma fração de 0,2 a 0,8.');
    expect(openingTypeIssue({ ...janela, glassKind: 'x' as never })).toBe('Tipo de vidro desconhecido.');
  });

  it('aceita os limites e os estilos de folha novos', () => {
    expect(openingTypeIssue({ ...porta, frameDepthMode: 'core', reveal: { depth: 0.15, anchor: 'core' } })).toBeNull();
    expect(openingTypeIssue({ ...porta, casing: { width: 0.05, thickness: 0.015, sides: 'opposite' } })).toBeNull();
    expect(openingTypeIssue({ ...porta, glassRatio: 0.1, hinges: 2 })).toBeNull();
    expect(openingTypeIssue({ ...porta, glassRatio: 0.9, hinges: 4, threshold: { thickness: 0.005 } })).toBeNull();
    expect(openingTypeIssue({ ...janela, tiltAxis: 0.2, glassKind: 'tempered' })).toBeNull();
    for (const leafStyle of ['boards', 'fullglass'] as const) expect(openingTypeIssue({ ...porta, leafStyle }), leafStyle).toBeNull();
  });
});

describe('catálogo brasileiro', () => {
  const novos = DEFAULT_OPENING_TYPES.filter((t) => t.code?.startsWith('PM-') || t.code?.startsWith('PA-') || t.code?.startsWith('PV-') || t.code?.startsWith('PC-') || t.code?.startsWith('JA-'));

  it('acrescenta os tipos usuais com código único, família certa e tipo válido', () => {
    expect(novos.length).toBeGreaterThanOrEqual(27);
    expect(new Set(DEFAULT_OPENING_TYPES.map((t) => t.code)).size).toBe(DEFAULT_OPENING_TYPES.length);
    for (const t of novos) {
      expect(openingFamilyOf(t), t.id).not.toBeNull();
      expect(openingTypeIssue(t), t.id).toBeNull();
      expect(t.description, t.id).toBeTruthy();
    }
  });

  it('portas de madeira usam o vão (folha + 80 mm × + 50 mm) e as propriedades pedidas', () => {
    const lisa = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_pm_lisa80')!;
    expect(lisa.width).toBeCloseTo(0.88, 9);
    expect(lisa.height).toBeCloseTo(2.15, 9);
    expect(lisa.leafStyle).toBe('flush');
    expect(lisa.hinges).toBe(3);
    expect(lisa.handle).toBe('lever');
    expect(DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_pm_vidro75_80')?.glassRatio).toBe(0.75);
    expect(DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_pm_lambri80')?.leafStyle).toBe('boards');
    expect(DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_pm_banheiro70')?.threshold).toBeUndefined();
  });

  it('alumínio, vidro temperado e aço têm as propriedades pedidas', () => {
    const giroVidro = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_vt_giro90')!;
    expect(giroVidro.glassKind).toBe('tempered');
    expect(giroVidro.frameStyle).toBe('block');
    expect(giroVidro.leafStyle).toBe('fullglass');
    const aco = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_aco_p60_90')!;
    expect(aco.frameMaterialId).toBe('mat_aco');
    expect(aco.fireRating).toBe('P-60');
    const canelado = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_al_canelado60')!;
    expect(canelado.glassKind).toBe('ribbed');
    expect(DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_br_al_correr3_bandeira200')?.transom).toEqual({ height: 0.3, fixed: true });
  });
});
