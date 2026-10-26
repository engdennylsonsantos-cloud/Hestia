import type { Viewport } from '../viewport.ts';

/**
 * Decisões da geometria que mudam com o zoom (hachura a partir de 40 px/m, espessura equivalente de uma região a 5 px,
 * linha de interface a 1,6 px...). Em vez de pôr o zoom cru na chave da geometria, cada comparação com o zoom registra o
 * limiar que consultou: entre dois limiares seguidos a geometria é a mesma, então a chave passa a ser a assinatura do
 * zoom (quantos limiares ele já passou), e não o zoom.
 */
export class Limiares {
  private readonly vistos = new Set<number>();

  /** Anota que a geometria consultou o limiar `z` (zoom em px/m). */
  registrar(z: number): void {
    this.vistos.add(z);
  }

  /** Limiares consultados, em ordem crescente e sem repetição. */
  lista(): number[] {
    return [...this.vistos].sort((a, b) => a - b);
  }
}

/** Vista de construção da geometria: a vista comum, mais o registro de limiares (ausente fora do quadro, nos testes). */
export type VistaComLimiares = Viewport & { limiares?: Limiares };

/** `v.zoom >= z`, registrando `z` como limiar quando a vista leva o registro. */
export function zoomAtinge(v: Viewport, z: number): boolean {
  (v as VistaComLimiares).limiares?.registrar(z);
  return v.zoom >= z;
}

/**
 * Uma região de espessura equivalente `emMetros` (2·área/perímetro) atinge `px` pixels de tela neste zoom? É o mesmo que
 * `emMetros × zoom >= px`, escrito como um limiar de zoom (`px / emMetros`) para a geometria poder registrá-lo.
 */
export function espessuraAtinge(v: Viewport, emMetros: number, px: number): boolean {
  if (!(emMetros > 0)) return px <= 0;
  return zoomAtinge(v, px / emMetros);
}

/** Assinatura do zoom: quantos limiares ele já alcançou. Zooms de mesma assinatura dão a mesma geometria. */
export function assinaturaDeZoom(limiares: readonly number[], zoom: number): number {
  let lo = 0;
  let hi = limiares.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (limiares[mid]! <= zoom) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
