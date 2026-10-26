import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, OPENING_FAMILIES, type OpeningType } from '@hestia/model';
import { newOpeningTypeFromFamily } from '../openingTypeForm.ts';
import {
  clearMiniatureCache,
  previewElevationDrawList,
  previewElevationSvg,
  previewMiniatureSvg,
  previewPlanSvg,
  previewSectionSvg,
  previewTypeSignature,
} from './previewViews.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;
const temDesenho = (svg: string): boolean => svg.startsWith('<svg') && /data-op="(fill|stroke)"/.test(svg);

describe('prévias de planta, elevação e corte', () => {
  it('a planta da porta ot_p90 tem desenho e muda com o ângulo do controle', () => {
    const a = previewPlanSvg(tipo('ot_p90'), { angle: 90 });
    const b = previewPlanSvg(tipo('ot_p90'), { angle: 45 });
    expect(temDesenho(a)).toBe(true);
    expect(temDesenho(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('a elevação muda com flipHand e flipFacing', () => {
    const base = previewElevationSvg(tipo('ot_p90'));
    expect(base).not.toBe(previewElevationSvg(tipo('ot_p90'), { flipHand: true }));
    expect(base).not.toBe(previewElevationSvg(tipo('ot_p90'), { flipFacing: true }));
  });

  it('a elevação respeita a convenção do V do projeto (apex e tracejado)', () => {
    const base = previewElevationSvg(tipo('ot_p90'));
    expect(base).not.toBe(previewElevationSvg(tipo('ot_p90'), { openingLine: { apex: 'hinge', dashed: 'toward' } }));
    expect(base).not.toBe(previewElevationSvg(tipo('ot_p90'), { openingLine: { apex: 'latch', dashed: 'away' } }));
  });

  it('as 19 famílias têm elevação e corte desenhados, sem exceção', () => {
    for (const family of OPENING_FAMILIES) {
      const d = newOpeningTypeFromFamily(family);
      expect(temDesenho(previewElevationSvg(d)), family.id).toBe(true);
      expect(temDesenho(previewSectionSvg(d)), family.id).toBe(true);
    }
  });

  it('as almofadas do estilo panel aparecem na elevação (mais peças que a folha lisa)', () => {
    const base: OpeningType = { ...tipo('ot_p90'), leafStyle: 'flush' };
    const lisa = previewElevationDrawList(base);
    const painel = previewElevationDrawList({ ...base, leafStyle: 'panel' });
    expect(painel.drawList.fills.length).toBeGreaterThan(lisa.drawList.fills.length);
    expect(temDesenho(previewElevationSvg({ ...base, leafStyle: 'panel' }))).toBe(true);
  });

  it('a miniatura usa o mesmo caminho e o cache devolve o mesmo SVG para a mesma assinatura', () => {
    clearMiniatureCache();
    const d = tipo('ot_p90');
    expect(previewTypeSignature(d)).toBe(previewTypeSignature({ ...d, name: 'Outro nome', cost: 999 }));
    const a = previewMiniatureSvg(d);
    const b = previewMiniatureSvg({ ...d, name: 'Outro nome', cost: 999 });
    expect(a).toBe(b);
    expect(temDesenho(a)).toBe(true);
  });
});
