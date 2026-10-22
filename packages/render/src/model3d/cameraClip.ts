/**
 * Planos de recorte da câmera orbital, dimensionados pela distância ao alvo (decisão do corte de parede ao aproximar).
 * Com um plano próximo fixo (0,05 m), uma parede a menos de 5 cm da câmera some e mostra o interior; com um plano
 * proporcional à distância, o corte só alcança a faixa mínima junto da câmera, e a faixa cresce longe do alvo.
 */

/** Constantes dos planos: o plano próximo é `nearRatio` da distância, limitado a [nearMin, nearMax]. */
export const CLIP = {
  nearRatio: 0.005,
  nearMin: 0.01,
  nearMax: 0.5,
  /** Plano distante mínimo (m): cobre o modelo e o zoom máximo (600 m). */
  farMin: 2000,
  /** Plano distante = (distância + raio do modelo) · farFactor, quando isso passa do mínimo. */
  farFactor: 2,
} as const;

/** Folga mínima (m) entre a câmera e a primeira superfície no zoom: a face da parede nunca entra no plano próximo. */
export const ZOOM_MARGIN = 0.2;

/**
 * Planos de recorte para uma câmera a `distance` (m) do alvo, num modelo de raio `sceneRadius` (m, 0 se vazio).
 * Perto do alvo o plano próximo é pequeno (ex.: 0,5 m → 0,01 m); longe, cresce até 0,5 m. O distante cobre o modelo.
 */
export function clipPlanes(distance: number, sceneRadius = 0): { near: number; far: number } {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const near = Math.min(CLIP.nearMax, Math.max(CLIP.nearMin, d * CLIP.nearRatio));
  const reach = d + (Number.isFinite(sceneRadius) ? Math.max(0, sceneRadius) : 0);
  return { near, far: Math.max(CLIP.farMin, reach * CLIP.farFactor) };
}

/**
 * Distância nova do zoom. `requested` é a pedida (já calculada pelo passo da roda). `obstacle` é a distância da câmera à
 * primeira superfície do modelo sobre o eixo de visão, ou null. Ao aproximar, a câmera para a `ZOOM_MARGIN` (ou o plano
 * próximo, se for maior) antes dela, para não atravessar a parede. Afastar nunca é limitado; aproximar a partir de
 * dentro da folga não anda.
 */
export function zoomedDistance(current: number, requested: number, obstacle: number | null): number {
  if (requested >= current || obstacle === null || obstacle >= current) return requested;
  const margin = Math.max(ZOOM_MARGIN, clipPlanes(current).near);
  const allowed = Math.max(0, obstacle - margin);
  return Math.max(requested, current - allowed);
}
