import type { CaixaPlanta } from './caixas3d.ts';

/**
 * Arestas da união de caixas de uma mesma camada de parede. A geometria extrudada funde as faces coplanares das peças
 * vizinhas (o vão vira só um furo na face, e o reboco que contorna o vão é uma peça só com ela); desenhar as 12 arestas de cada
 * caixa mostraria também as juntas entre as peças. Quando as caixas estão alinhadas aos mesmos eixos (é o caso de uma camada
 * de parede reta, com ou sem vãos), a união é uma região de uma grade de células: as arestas dela são as linhas da grade em
 * volta das quais as quatro células vizinhas não formam uma reta. É a mesma linha que o ângulo de 28° dá na geometria fundida
 * (em prismas ortogonais, todo diedro é de 90°).
 */

const TOL = 1e-6;
/** Número máximo de caixas: a grade cresce com o cubo do número de caixas, e camadas assim ficam na geometria. */
const MAX_CAIXAS = 24;

interface Intervalo3 {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  z0: number;
  z1: number;
}

/** Valores ordenados e sem repetição (dentro de `TOL`). */
function unicos(xs: number[]): number[] {
  const s = [...xs].sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of s) if (!out.length || x - out[out.length - 1]! > TOL) out.push(x);
  return out;
}

/** Caixa no referencial (u, v, z) girado de `theta`, ou null se os eixos dela não coincidem com os do referencial. */
function noReferencial(b: CaixaPlanta, theta: number): Intervalo3 | null {
  // Giro relativo, em (−π/2, π/2]: 0 = mesma direção; π/2 = lados trocados.
  let dif = (b.ang - theta) % Math.PI;
  if (dif > Math.PI / 2) dif -= Math.PI;
  if (dif <= -Math.PI / 2) dif += Math.PI;
  const trocado = Math.abs(Math.abs(dif) - Math.PI / 2) < TOL;
  if (!trocado && Math.abs(dif) > TOL) return null;
  const wu = trocado ? b.d : b.w;
  const wv = trocado ? b.w : b.d;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const uc = b.cx * c + b.cy * s;
  const vc = -b.cx * s + b.cy * c;
  return { u0: uc - wu / 2, u1: uc + wu / 2, v0: vc - wv / 2, v1: vc + wv / 2, z0: b.z0, z1: b.z0 + b.h };
}

/**
 * Arestas (pares de pontos, x y z) da união das caixas, ou null se elas não estão alinhadas aos mesmos eixos ou são caixas
 * demais. Trechos seguidos na mesma reta saem como um segmento só.
 */
export function arestasDaUniao(caixas: readonly CaixaPlanta[]): number[] | null {
  const ref = caixas[0];
  if (!ref) return [];
  if (caixas.length > MAX_CAIXAS) return null;
  const caixasUVZ: Intervalo3[] = [];
  for (const b of caixas) {
    const c = noReferencial(b, ref.ang);
    if (!c) return null;
    caixasUVZ.push(c);
  }
  const eixos = [
    unicos(caixasUVZ.flatMap((c) => [c.u0, c.u1])),
    unicos(caixasUVZ.flatMap((c) => [c.v0, c.v1])),
    unicos(caixasUVZ.flatMap((c) => [c.z0, c.z1])),
  ] as const;
  const [us, vs, zs] = eixos;
  const n = [us.length - 1, vs.length - 1, zs.length - 1] as const;
  // Ocupação das células [us[i], us[i+1]] × [vs[j], vs[j+1]] × [zs[k], zs[k+1]].
  const ocup = new Uint8Array(Math.max(0, n[0] * n[1] * n[2]));
  for (let i = 0; i < n[0]; i++) {
    for (let j = 0; j < n[1]; j++) {
      for (let k = 0; k < n[2]; k++) {
        const um = (us[i]! + us[i + 1]!) / 2;
        const vm = (vs[j]! + vs[j + 1]!) / 2;
        const zm = (zs[k]! + zs[k + 1]!) / 2;
        if (caixasUVZ.some((c) => c.u0 <= um && um <= c.u1 && c.v0 <= vm && vm <= c.v1 && c.z0 <= zm && zm <= c.z1)) ocup[(i * n[1] + j) * n[2] + k] = 1;
      }
    }
  }
  const cheia = (i: number, j: number, k: number): boolean => i >= 0 && j >= 0 && k >= 0 && i < n[0] && j < n[1] && k < n[2] && ocup[(i * n[1] + j) * n[2] + k] === 1;
  // Aresta ao longo do eixo `a`, no passo `p` desse eixo e nas linhas `q` e `r` dos outros dois: as quatro células em volta dela.
  const viva = (a: 0 | 1 | 2, p: number, q: number, r: number): boolean => {
    const c = (dq: number, dr: number): boolean => {
      const idx: [number, number, number] = [0, 0, 0];
      idx[a] = p;
      idx[(a + 1) % 3] = q + dq;
      idx[(a + 2) % 3] = r + dr;
      return cheia(idx[0], idx[1], idx[2]);
    };
    const [s1, s2, s3, s4] = [c(-1, -1), c(0, -1), c(-1, 0), c(0, 0)];
    const quantas = Number(s1) + Number(s2) + Number(s3) + Number(s4);
    const reta = quantas === 0 || quantas === 4 || (quantas === 2 && ((s1 === s2 && s3 === s4) || (s1 === s3 && s2 === s4)));
    return !reta;
  };
  const th = Math.cos(ref.ang);
  const sh = Math.sin(ref.ang);
  const mundo = (u: number, v: number, z: number): number[] => [u * th - v * sh, u * sh + v * th, z];
  const out: number[] = [];
  for (let a = 0 as 0 | 1 | 2; a < 3; a = (a + 1) as 0 | 1 | 2) {
    const ea = eixos[a];
    const eq = eixos[(a + 1) % 3]!;
    const er = eixos[(a + 2) % 3]!;
    for (let q = 0; q < eq.length; q++) {
      for (let r = 0; r < er.length; r++) {
        let inicio = -1;
        for (let p = 0; p <= ea.length - 1; p++) {
          const ligada = p < ea.length - 1 && viva(a, p, q, r);
          if (ligada && inicio < 0) inicio = p;
          if (!ligada && inicio >= 0) {
            const pa: [number, number, number] = [0, 0, 0];
            const pb: [number, number, number] = [0, 0, 0];
            pa[a] = ea[inicio]!;
            pb[a] = ea[p]!;
            pa[(a + 1) % 3] = pb[(a + 1) % 3] = eq[q]!;
            pa[(a + 2) % 3] = pb[(a + 2) % 3] = er[r]!;
            out.push(...mundo(pa[0], pa[1], pa[2]), ...mundo(pb[0], pb[1], pb[2]));
            inicio = -1;
          }
        }
      }
    }
  }
  return out;
}
