import type { LabelOp } from './types.ts';

/** Caixa de um rótulo em metros do modelo (mesma convenção do desenho: âncora à esquerda, centro vertical). */
export interface CaixaRotulo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Milímetros de papel em metros do modelo na escala dada (sem o piso de 1 px, que só vale no desenho de tela). */
export const mmNoModelo = (mm: number, escala: number): number => (mm * escala) / 1000;

/** Largura estimada de um texto em mm de papel (0,6 do corpo por caractere, como `valueWidthPx`). */
const larguraMm = (texto: string, fontMm: number): number => texto.length * fontMm * 0.6;

/**
 * Caixa ocupada por um rótulo de anotação do telhado, estimada a partir das medidas em papel. Serve ao teste de
 * colisão: dois rótulos não podem cobrir um ao outro. Rótulos sem medidas em papel (pixels fixos) ficam de fora.
 */
export function caixaDoRotulo(l: LabelOp): CaixaRotulo | null {
  const pp = l.papel;
  if (!pp || pp.fontMm === undefined) return null;
  const desvio = pp.desvio;
  const dx = desvio ? (desvio.ux ?? 0) * mmNoModelo(desvio.mm, pp.escala) : 0;
  const dy = desvio ? (desvio.uy ?? 0) * mmNoModelo(desvio.mm, pp.escala) : 0;
  const ax = l.at.x + dx;
  const ay = l.at.y - dy;
  const w = mmNoModelo(larguraMm(l.text, pp.fontMm), pp.escala);
  const h = mmNoModelo(pp.fontMm * 1.2, pp.escala);
  return { minX: ax, minY: ay - h / 2, maxX: ax + w, maxY: ay + h / 2 };
}

/** Os dois rótulos ocupam alguma área em comum? */
export function caixasSobrepostas(a: CaixaRotulo, b: CaixaRotulo): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** Soma um deslocamento em mm de papel (x para a direita, y para baixo, como a tela) ao desvio do rótulo. */
export function desviarRotulo(l: LabelOp, dxMm: number, dyMm: number): void {
  const pp = l.papel;
  if (!pp) return;
  const d = pp.desvio;
  const x = (d?.ux ?? 0) * (d?.mm ?? 0) + dxMm;
  const y = (d?.uy ?? 0) * (d?.mm ?? 0) + dyMm;
  const m = Math.hypot(x, y);
  pp.desvio = m < 1e-9 ? { mm: 0 } : { mm: m, ux: x / m, uy: y / m };
}

/**
 * Evita que os rótulos do telhado se cubram: percorre na ordem de desenho e, quando um rótulo cai sobre outro já
 * posicionado, empurra-o para cima (mm de papel) até ficar livre. A ordem preserva as setas de caimento e a cota da
 * cumeeira o mais perto possível do lugar de origem.
 */
export function evitarSobreposicao(labels: LabelOp[], passoMm = 2.2): LabelOp[] {
  const caixas: CaixaRotulo[] = [];
  for (const l of labels) {
    let caixa = caixaDoRotulo(l);
    if (!caixa) continue;
    let passos = 0;
    while (caixas.some((c) => caixasSobrepostas(c, caixa!)) && passos < 16) {
      desviarRotulo(l, 0, -passoMm);
      caixa = caixaDoRotulo(l)!;
      passos++;
    }
    caixas.push(caixa);
  }
  return labels;
}
