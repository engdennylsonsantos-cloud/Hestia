import { describe, expect, it } from 'vitest';
import type { Viewport } from '@hestia/render';
import { LOD_MIN_PX, MARGEM_ROTULO_PX, rotuloVisivelNaVista } from './PlanLabels.tsx';

const v: Viewport = { cx: 0, cy: 0, zoom: 60, width: 400, height: 300 };
const noCentro = { at: { x: 0, y: 0 }, text: 'Parede' };

describe('LOD e culling dos rótulos da planta', () => {
  it('mostra o rótulo dentro da vista e esconde o que está fora, com a margem', () => {
    expect(rotuloVisivelNaVista(noCentro, v)).toBe(true);
    // 10 m à direita do centro: x = 200 + 600 = 800 px, fora da vista e da margem.
    expect(rotuloVisivelNaVista({ ...noCentro, at: { x: 10, y: 0 } }, v)).toBe(false);
    // Logo além da borda, mas dentro da margem: continua montado (evita o "pop" ao arrastar).
    const logoAlem = { ...noCentro, at: { x: (v.width / 2 + 10) / v.zoom, y: 0 } };
    expect(rotuloVisivelNaVista(logoAlem, v)).toBe(true);
    expect(rotuloVisivelNaVista({ ...noCentro, at: { x: (v.width / 2 + MARGEM_ROTULO_PX + 120) / v.zoom, y: 0 } }, v)).toBe(false);
  });

  it('LOD: texto abaixo do corpo mínimo sai; a cota de 3 px do zoom 12 continua', () => {
    expect(rotuloVisivelNaVista({ ...noCentro, fontPx: LOD_MIN_PX - 0.1 }, v)).toBe(false);
    expect(rotuloVisivelNaVista({ ...noCentro, fontPx: 3, center: true }, v)).toBe(true);
  });

  it('máscara de texto é medida pelo polígono: aparece se alguma parte toca a vista', () => {
    const grande = { at: { x: 0, y: 0 }, text: '', maskBoundary: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] };
    expect(rotuloVisivelNaVista(grande, v)).toBe(true);
    const longe = { ...grande, maskBoundary: grande.maskBoundary.map((p) => ({ x: p.x + 1000, y: p.y })) };
    expect(rotuloVisivelNaVista(longe, v)).toBe(false);
  });
});
