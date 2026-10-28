import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, OPENING_FAMILIES, type OpeningType } from '@hestia/model';
import { newOpeningTypeFromFamily } from '../openingTypeForm.ts';
import {
  clearMiniatureCache,
  previewElevationDrawList,
  previewElevationSvg,
  previewMiniatureSvg,
  previewPlanDetail,
  previewPlanDrawList,
  previewPlanSvg,
  previewSectionFrames,
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

  it('o corte devolve três quadros (inteiro, cabeça e soleira) com enquadramentos distintos, em todos os tipos padrão', () => {
    for (const d of DEFAULT_OPENING_TYPES) {
      const frames = previewSectionFrames(d);
      expect(frames.map((f) => f.id)).toEqual(['full', 'head', 'sill']);
      for (const f of frames) expect(temDesenho(f.svg), `${d.id}/${f.id}`).toBe(true);
      expect(new Set(frames.map((f) => JSON.stringify(f.box))).size).toBe(3);
    }
  });

  it('a planta enquadra o vão mais o arco com 0,6 m de margem', () => {
    const { box } = previewPlanDrawList({ ...tipo('ot_p90'), detail2d: 'scale' });
    // Parede de 0,9 + 1,2 = 2,1 m; o vão fica no centro, com 0,6 m até cada ponta.
    expect(box.minX).toBeCloseTo(0, 6);
    expect(box.maxX).toBeCloseTo(2.1, 6);
    // A folha aberta alcança além da espessura da parede nos dois sentidos.
    expect(box.minY).toBeLessThan(-0.6);
    expect(box.maxY).toBeGreaterThan(0.6);
  });

  it('a elevação enquadra o vão com 0,3 m de margem', () => {
    const d = tipo('ot_j120');
    const { box } = previewElevationDrawList(d);
    expect(box.minY).toBeCloseTo(d.sill - 0.3, 6);
    expect(box.maxY).toBeCloseTo(d.sill + d.height + 0.3, 6);
    expect(box.maxX - box.minX).toBeCloseTo(d.width + 0.6, 6);
  });

  it('a planta usa o detalhe alto em scale e respeita o detalhe fixo', () => {
    expect(previewPlanDetail(tipo('ot_p90'))).toBe('high');
    expect(previewPlanDetail({ ...tipo('ot_p90'), detail2d: 'scale' })).toBe('high');
    expect(previewPlanDetail({ ...tipo('ot_p90'), detail2d: 'low' })).toBe('low');
    expect(previewPlanDetail({ ...tipo('ot_p90'), detail2d: 'mid' })).toBe('mid');
    // A porta de giro desenha igual em todos os níveis (só a folha aberta); a janela ainda ganha detalhe com o zoom.
    const alto = previewPlanDrawList({ ...tipo('ot_j120'), detail2d: 'scale' });
    const baixo = previewPlanDrawList({ ...tipo('ot_j120'), detail2d: 'low' });
    expect(alto.drawList.strokes.length).toBeGreaterThan(baixo.drawList.strokes.length);
  });
});
