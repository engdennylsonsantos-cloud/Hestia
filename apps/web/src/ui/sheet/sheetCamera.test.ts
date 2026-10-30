import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, clampZoom, fitCamera, panBy, paperToScreen, screenToPaper, viewBoxOf, zoomAt, zoomToBox } from './sheetCamera.ts';

const VIEW = { w: 1000, h: 700 };
const A3 = { w: 420, h: 297 };

describe('câmera da prancha', () => {
  it('o enquadramento põe a folha inteira e centrada, com folga', () => {
    const cam = fitCamera(A3, VIEW, 20);
    expect(cam.cx).toBeCloseTo(210, 9);
    expect(cam.cy).toBeCloseTo(148.5, 9);
    // cabe: 420 mm × zoom ≤ 1000 - 40 e 297 mm × zoom ≤ 700 - 40
    expect(420 * cam.zoom).toBeLessThanOrEqual(960 + 1e-9);
    expect(297 * cam.zoom).toBeLessThanOrEqual(660 + 1e-9);
    expect(cam.zoom).toBeCloseTo(660 / 297, 9);
  });

  it('o zoom no cursor mantém o ponto de papel sob o mesmo pixel', () => {
    const cam = fitCamera(A3, VIEW);
    const p = { x: 120, y: 80 };
    const before = paperToScreen(cam, VIEW, p);
    const zoomed = zoomAt(cam, 2.5, p);
    const after = paperToScreen(zoomed, VIEW, p);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomed.zoom).toBeCloseTo(cam.zoom * 2.5, 9);
  });

  it('o zoom respeita os limites e não estoura ao clampar', () => {
    const cam = fitCamera(A3, VIEW);
    expect(zoomAt(cam, 1e6, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(cam, 1e-6, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(-4)).toBe(MIN_ZOOM);
  });

  it('arrastar o ponteiro move a câmera no sentido do conteúdo', () => {
    const cam = fitCamera(A3, VIEW);
    const moved = panBy(cam, 100, 50);
    // arrastar para a direita mostra conteúdo à esquerda: o centro diminui em x e aumenta em y (y do papel é para cima)
    expect(moved.cx).toBeCloseTo(cam.cx - 100 / cam.zoom, 9);
    expect(moved.cy).toBeCloseTo(cam.cy + 50 / cam.zoom, 9);
  });

  it('tela e papel são inversos, e o viewBox cobre exatamente a área visível', () => {
    const cam = zoomAt(fitCamera(A3, VIEW), 1.7, { x: 90, y: 200 });
    for (const s of [{ x: 0, y: 0 }, { x: 999, y: 699 }, { x: 413, y: 122 }]) {
      const back = paperToScreen(cam, VIEW, screenToPaper(cam, VIEW, s.x, s.y));
      expect(back.x).toBeCloseTo(s.x, 6);
      expect(back.y).toBeCloseTo(s.y, 6);
    }
    const vb = viewBoxOf(cam, A3, VIEW);
    expect(vb.w).toBeCloseTo(VIEW.w / cam.zoom, 9);
    expect(vb.h).toBeCloseTo(VIEW.h / cam.zoom, 9);
    // o centro do papel cai no centro do viewBox
    expect(vb.x + vb.w / 2).toBeCloseTo(cam.cx, 9);
    expect(A3.h - (vb.y + vb.h / 2)).toBeCloseTo(cam.cy, 9);
  });

  it('enquadrar uma vista usa a caixa dela, com folga', () => {
    const cam = zoomToBox({ x: 20, y: 20, w: 200, h: 100 }, VIEW, 40);
    expect(cam.cx).toBeCloseTo(120, 9);
    expect(cam.cy).toBeCloseTo(70, 9);
    expect(cam.zoom).toBeCloseTo(920 / 200, 9);
  });
});
