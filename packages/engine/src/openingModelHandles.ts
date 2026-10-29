import { box } from './openingModelContext.ts';
import type { PartBox, PartProfile } from './openingModelTypes.ts';

/**
 * Maçaneta em medidas reais (m), com peças do formato certo: roseta redonda, haste cilíndrica, alavanca (braço cilíndrico
 * horizontal), bola (discos empilhados) e puxador tubular. O eixo da maçaneta é (tR, z). As distâncias `face` contam a
 * partir da face da folha (espessura `L`, plano médio `sMid`) e `face` = ±1 é o lado a (−) e o lado b (+). Peças redondas
 * trazem `profile` (o prisma real); `box` é a caixa envolvente exata.
 */

/** Peça da maçaneta: a caixa envolvente e, nas peças redondas, a seção (plano 'tz', 'sz' ou 'ts'). */
export interface HandlePiece {
  id: string;
  box: PartBox;
  profile?: PartProfile;
}

/** Entradas da maçaneta: estilo, eixo, plano médio e espessura da folha, lado do puxador e lado da dobradiça. */
export interface HandleSpec {
  index: number;
  style: 'lever' | 'knob' | 'pull';
  /** Eixo da maçaneta (t) e altura do eixo (z). */
  tR: number;
  z: number;
  sMid: number;
  L: number;
  /** Lado de fora do puxador (face externa). */
  side: 1 | -1;
  /** Direção do braço da alavanca: aponta para o lado da dobradiça. */
  inward: 1 | -1;
}

/** Lados do polígono: 16 para discos e roseta, 12 para hastes e o braço. Múltiplo de 4, então a caixa do círculo é exata. */
const REDONDO = 16;
const HASTE = 12;
const RAIOS_BOLA = [0.013, 0.021, 0.025, 0.021, 0.013];
const PLACA = { meia: 0.015, meiaZ: 0.0375, chanfro: 0.005, espessura: 0.004 };

function circulo(cx: number, cy: number, r: number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** Disco ou cilindro com eixo em s (seção (t, z)), entre s0 e s1. */
function discoS(id: string, tC: number, zC: number, r: number, n: number, s0: number, s1: number): HandlePiece {
  return { id, box: box(tC - r, tC + r, s0, s1, zC - r, zC + r), profile: { plane: 'tz', pts: circulo(tC, zC, r, n) } };
}

/** Braço cilíndrico com eixo em t (seção (s, z)), entre t0 e t1. */
function bracoT(id: string, t0: number, t1: number, sC: number, zC: number, r: number): HandlePiece {
  return { id, box: box(t0, t1, sC - r, sC + r, zC - r, zC + r), profile: { plane: 'sz', pts: circulo(sC, zC, r, HASTE) } };
}

/** Tubo com eixo em z (seção (t, s)), entre z0 e z1. */
function tuboZ(id: string, tC: number, sC: number, r: number, z0: number, z1: number): HandlePiece {
  return { id, box: box(tC - r, tC + r, sC - r, sC + r, z0, z1), profile: { plane: 'ts', pts: circulo(tC, sC, r, REDONDO) } };
}

/** Placa da fechadura: retângulo com cantos chanfrados em (t, z), entre s0 e s1. */
function placaFechadura(id: string, tC: number, zC: number, s0: number, s1: number): HandlePiece {
  const { meia: w, meiaZ: h, chanfro: c } = PLACA;
  const cantos: Array<[number, number]> = [
    [-w + c, -h],
    [w - c, -h],
    [w, -h + c],
    [w, h - c],
    [w - c, h],
    [-w + c, h],
    [-w, h - c],
    [-w, -h + c],
  ];
  return {
    id,
    box: box(tC - w, tC + w, s0, s1, zC - h, zC + h),
    profile: { plane: 'tz', pts: cantos.map(([a, b]) => [tC + a, zC + b]) },
  };
}

/** Peças da maçaneta: roseta, pescoço, alavanca ou bola nas duas faces; puxador tubular no lado externo. */
export function handleParts(h: HandleSpec): HandlePiece[] {
  const { index: i, tR, z } = h;
  const face = (f: 1 | -1): number => h.sMid + (f * h.L) / 2;
  const out: HandlePiece[] = [];
  if (h.style === 'pull') {
    const sBarra = face(h.side) + h.side * 0.05;
    out.push(tuboZ(`handle-${i}-pull-bar`, tR, sBarra, 0.0125, z - 0.2, z + 0.2));
    for (const [k, dz] of [
      [0, -0.16],
      [1, 0.16],
    ] as const) {
      out.push(discoS(`handle-${i}-pull-post-${k}`, tR, z + dz, 0.009, HASTE, face(h.side), sBarra));
    }
    return out;
  }
  for (const f of [-1, 1] as const) {
    const a = f < 0 ? 'a' : 'b';
    const s = face(f);
    if (h.style === 'knob') {
      out.push(discoS(`handle-${i}-rosette-${a}`, tR, z, 0.0275, REDONDO, s, s + f * 0.008));
      out.push(discoS(`handle-${i}-neck-${a}`, tR, z, 0.011, HASTE, s + f * 0.008, s + f * 0.022));
      RAIOS_BOLA.forEach((r, k) =>
        out.push(discoS(`handle-${i}-knob-${k}-${a}`, tR, z, r, REDONDO, s + f * (0.022 + 0.01 * k), s + f * (0.022 + 0.01 * (k + 1)))),
      );
    } else {
      out.push(discoS(`handle-${i}-rosette-${a}`, tR, z, 0.026, REDONDO, s, s + f * 0.008));
      out.push(discoS(`handle-${i}-neck-${a}`, tR, z, 0.008, HASTE, s + f * 0.008, s + f * 0.046));
      // Braço de 0,125 a partir do eixo; começa 0,0095 atrás do eixo para fechar o encontro com o pescoço.
      out.push(bracoT(`handle-${i}-lever-${a}`, tR - h.inward * 0.0095, tR + h.inward * 0.125, s + f * 0.0365, z, 0.0095));
    }
  }
  for (const f of [-1, 1] as const) {
    out.push(placaFechadura(`handle-${i}-lock-${f < 0 ? 'a' : 'b'}`, tR, z - 0.07, face(f), face(f) + f * PLACA.espessura));
  }
  return out;
}
