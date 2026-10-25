import type { Vec2 } from '@hestia/geom';
import type { FillOp, PlanTheme, StrokeOp } from '@hestia/render';
import type { ElementoGeometrico } from '@hestia/engine/src/fluxoPatch.ts';
import { desempacotarMulti } from '@hestia/engine/src/fluxoGeometria.ts';

/** O que a planta desenha sobre o último exato enquanto o exato novo não chega. */
export interface OperacoesProvisorias {
  fills: FillOp[];
  strokes: StrokeOp[];
}

/** Dados do nível que o fluxo guarda: o que apagar (posição antiga) e o que desenhar no lugar (posição nova). */
export interface ProvisorioDoNivel {
  apagar: ElementoGeometrico[];
  desenhar: ElementoGeometrico[];
}

/** Folga (px) do apagador além do contorno: cobre a largura dos traços do exato. */
const FOLGA_APAGADOR_PX = 6;

const temVertices = (el: ElementoGeometrico): boolean => el.geometria.coords.length > 0;

/** Primeiro anel do elemento (o contorno de uma parede, de um vão ou de um piso). */
function primeiroAnel(el: ElementoGeometrico): Vec2[] {
  return desempacotarMulti(el.geometria)[0]?.[0] ?? [];
}

/** Elemento com contorno para desenhar ou apagar (escada e ambiente chegam sem vértices). */
export const temContorno = (lista: readonly ElementoGeometrico[]): boolean => lista.some(temVertices);

/** O nível tem provisório que valha um quadro: algo a apagar, a desenhar ou a esconder. */
export const temProvisorioVisivel = (d: ProvisorioDoNivel, removidos: readonly string[]): boolean => removidos.length > 0 || temContorno(d.apagar) || temContorno(d.desenhar);

/**
 * Traço da cor do fundo que cobre um contorno em forma de faixa (parede, vão): as seções do anel são os pares de pontos
 * opostos (`i` e `n-1-i`, como `contornoDaParede` e `contornoDaAbertura` os montam), a linha central passa pelos pontos
 * médios e a largura é a espessura. Cobre também as linhas de camada e o contorno que o preenchimento sozinho não alcança.
 */
export function faixaApagadora(anel: readonly Vec2[], zoom: number, cor: string): StrokeOp | null {
  const n = anel.length;
  if (n < 4 || n % 2 !== 0) return null;
  const meios: Vec2[] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = anel[i]!;
    const b = anel[n - 1 - i]!;
    meios.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  const espessura = Math.hypot(anel[0]!.x - anel[n - 1]!.x, anel[0]!.y - anel[n - 1]!.y);
  const folga = FOLGA_APAGADOR_PX / zoom;
  // Estende as pontas para cobrir também o contorno das extremidades.
  const alonga = (de: Vec2, para: Vec2): Vec2 => {
    const d = Math.hypot(para.x - de.x, para.y - de.y) || 1;
    return { x: de.x + ((de.x - para.x) / d) * (folga / 2), y: de.y + ((de.y - para.y) / d) * (folga / 2) };
  };
  const pts = [alonga(meios[0]!, meios[1]!), ...meios.slice(1, -1), alonga(meios[meios.length - 1]!, meios[meios.length - 2]!)];
  return { pts, closed: false, widthPx: espessura * zoom + FOLGA_APAGADOR_PX, color: cor, alpha: 1 };
}

/** Apaga o contorno antigo: preenche com a cor do fundo e, para faixas, cobre também os traços por cima. */
function apagador(el: ElementoGeometrico, zoom: number, fundo: string): OperacoesProvisorias {
  const poligonos = desempacotarMulti(el.geometria);
  const fills: FillOp[] = [{ polygons: poligonos, color: fundo, alpha: 1 }];
  const faixa = el.kind === 'wall' || el.kind === 'door' || el.kind === 'window' ? faixaApagadora(primeiroAnel(el), zoom, fundo) : null;
  if (faixa) return { fills, strokes: [faixa] };
  // Contorno qualquer: cobre o traço do limite com a cor do fundo.
  const strokes = poligonos.flatMap((poly) => poly.map((anel): StrokeOp => ({ pts: anel, closed: true, widthPx: FOLGA_APAGADOR_PX, color: fundo, alpha: 1 })));
  return { fills, strokes };
}

/** Desenho do elemento na posição nova: parede cheia, vão vazado, o resto só contorno leve. */
function desenho(el: ElementoGeometrico, tema: PlanTheme): OperacoesProvisorias {
  const polygons = desempacotarMulti(el.geometria);
  const traco = (cor: string, largura: number): StrokeOp[] => polygons.flatMap((poly) => poly.map((anel): StrokeOp => ({ pts: anel, closed: true, widthPx: largura, color: cor, alpha: 1 })));
  if (el.kind === 'wall') return { fills: [{ polygons, color: tema.inkSoft, alpha: 0.4 }], strokes: traco(tema.ink, 1.5) };
  if (el.kind === 'door' || el.kind === 'window') return { fills: [{ polygons, color: tema.bg, alpha: 1 }], strokes: traco(tema.ink, 1.25) };
  return { fills: [{ polygons, color: tema.inkSoft, alpha: 0.12 }], strokes: traco(tema.inkSoft, 1.25) };
}

/**
 * Operações de desenho do provisório de um nível, em duas camadas na ordem de pintura: primeiro tudo o que se apaga
 * (a posição antiga dos elementos editados), depois os elementos novos (paredes antes dos vãos, para o vão vazar a parede).
 * Os traços de apagar vêm antes dos traços novos pela mesma razão.
 */
export function operacoesProvisorias(d: ProvisorioDoNivel, tema: PlanTheme, zoom: number): OperacoesProvisorias {
  const apagar = d.apagar.filter(temVertices).map((el) => apagador(el, zoom, tema.bg));
  const ordem = (el: ElementoGeometrico): number => (el.kind === 'door' || el.kind === 'window' ? 1 : 0);
  const novos = d.desenhar.filter(temVertices).sort((a, b) => ordem(a) - ordem(b)).map((el) => desenho(el, tema));
  return {
    fills: [...apagar.flatMap((o) => o.fills), ...novos.flatMap((o) => o.fills)],
    strokes: [...apagar.flatMap((o) => o.strokes), ...novos.flatMap((o) => o.strokes)],
  };
}
