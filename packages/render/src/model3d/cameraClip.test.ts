import { describe, expect, it } from 'vitest';
import { CLIP, ZOOM_MARGIN, clipPlanes, zoomedDistance } from './cameraClip.ts';

describe('clipPlanes: plano próximo acompanha a distância ao alvo', () => {
  it('câmera perto do alvo (0,5 m): plano próximo no mínimo, 0,01 m (antes era 0,05 m fixo)', () => {
    expect(clipPlanes(0.5).near).toBeCloseTo(CLIP.nearMin, 12);
  });

  it('câmera na distância da vista inicial (12,86 m): plano próximo proporcional, 0,064 m', () => {
    expect(clipPlanes(12.86).near).toBeCloseTo(0.0643, 4);
  });

  it('câmera longe (600 m, zoom máximo): plano próximo limitado a 0,5 m', () => {
    expect(clipPlanes(600).near).toBe(CLIP.nearMax);
  });

  it('o plano próximo cresce com a distância e nunca passa do limite', () => {
    const ds = [0.5, 1, 3, 14, 60, 100, 600];
    const nears = ds.map((d) => clipPlanes(d).near);
    for (let i = 1; i < nears.length; i++) expect(nears[i]).toBeGreaterThanOrEqual(nears[i - 1]!);
    for (const n of nears) expect(n).toBeLessThanOrEqual(CLIP.nearMax);
  });

  it('a relação far/near fica limitada em todo o zoom (precisão do buffer de profundidade)', () => {
    for (const d of [0.5, 2, 14, 100, 600]) {
      const { near, far } = clipPlanes(d);
      expect(far / near).toBeLessThanOrEqual(2e5);
    }
  });

  it('modelo pequeno: o plano distante é o mínimo (2000 m)', () => {
    expect(clipPlanes(14, 3).far).toBe(CLIP.farMin);
  });

  it('modelo grande: o plano distante cobre a câmera e o modelo (distância + raio, ×2)', () => {
    expect(clipPlanes(14, 1500).far).toBe((14 + 1500) * CLIP.farFactor);
  });

  it('distância inválida (negativa, NaN) cai no plano próximo mínimo, sem NaN', () => {
    expect(clipPlanes(-5).near).toBe(CLIP.nearMin);
    expect(clipPlanes(Number.NaN).near).toBe(CLIP.nearMin);
    expect(Number.isFinite(clipPlanes(Number.NaN, Number.NaN).far)).toBe(true);
  });
});

describe('zoomedDistance: a roda não leva a câmera através da parede', () => {
  it('sem superfície no eixo, a distância pedida vale', () => {
    expect(zoomedDistance(10, 8, null)).toBe(8);
  });

  it('afastar nunca é limitado, mesmo com parede no eixo', () => {
    expect(zoomedDistance(10, 12, 3)).toBe(12);
  });

  it('superfície atrás do alvo (além da distância) não limita', () => {
    expect(zoomedDistance(10, 2, 14)).toBe(2);
  });

  it('parede entre a câmera e o alvo: para a folga antes dela (10 m, parede a 4 m, pedido 2 m → 6,2 m)', () => {
    expect(zoomedDistance(10, 2, 4)).toBeCloseTo(10 - (4 - ZOOM_MARGIN), 9);
  });

  it('câmera já dentro da folga não anda para a parede', () => {
    expect(zoomedDistance(0.8, 0.5, 0.1)).toBe(0.8);
  });

  it('a folga é pelo menos o plano próximo: longe do alvo, a folga cresce', () => {
    // Distância 300 m: plano próximo 0,5 m > folga mínima; a câmera para 0,5 m antes da parede.
    expect(zoomedDistance(300, 200, 100)).toBeCloseTo(300 - (100 - 0.5), 9);
  });
});
