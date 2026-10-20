import type { RoofProfilePoint } from '@hestia/model';

/**
 * Presets e validação do perfil de telhado por extrusão (A9). Puros: o perfil tem t de 0 a `largura`, medido a partir
 * do início do referencial do telhado (a interface e a ferramenta deslocam pelo mínimo de t do contorno).
 * Ficam no motor porque a ferramenta de telhado (pacote tools) também precisa do arco padrão.
 */

/** Inclinação máxima de um trecho do perfil, em %: o mesmo limite de telhado de uma água (200 %, 63,4°). */
export const PROFILE_SLOPE_LIMIT = 200;

/** Problema estrutural do perfil (≥ 2 pontos, números finitos, t estritamente crescente), ou null. */
export function roofProfileError(pts: RoofProfilePoint[]): string | null {
  if (pts.length < 2) return 'o perfil precisa de ao menos 2 pontos';
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]!;
    if (!Number.isFinite(q.t) || !Number.isFinite(q.z)) return 'as posições e as alturas devem ser números';
    if (i > 0 && !(q.t > pts[i - 1]!.t)) return 'as posições devem estar em ordem crescente, sem repetir';
  }
  return null;
}

/** Perfil válido para extrudar: o mesmo que `roofProfileError` aceita. */
export const roofProfileOk = (pts: RoofProfilePoint[]): boolean => roofProfileError(pts) === null;

/** Trecho mais inclinado que o limite, ou null. Só faz sentido com o perfil estrutural válido (t crescente). */
export function roofProfileSlopeError(pts: RoofProfilePoint[]): string | null {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (!(b.t > a.t)) continue;
    const pct = (100 * Math.abs(b.z - a.z)) / (b.t - a.t);
    if (pct > PROFILE_SLOPE_LIMIT) return `o trecho ${i + 1} tem inclinação de ${pct.toFixed(0)} %; o limite é ${PROFILE_SLOPE_LIMIT} %`;
  }
  return null;
}

/** Desloca o perfil em `dt` na coordenada t (o perfil de 0 a L vira de tMin a tMin + L). */
export const shiftProfile = (pts: RoofProfilePoint[], dt: number): RoofProfilePoint[] => pts.map((q) => ({ t: q.t + dt, z: q.z }));

/** Altura do perfil em t, por interpolação linear; fora do intervalo, a do ponto mais próximo. */
export function profileZAt(pts: RoofProfilePoint[], t: number): number {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return 0;
  if (t <= first.t) return first.z;
  if (t >= last.t) return last.z;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (t >= a.t && t <= b.t) return b.t - a.t < 1e-12 ? b.z : a.z + ((b.z - a.z) * (t - a.t)) / (b.t - a.t);
  }
  return last.z;
}

/**
 * Novo ponto no meio do maior intervalo entre as bordas (t0 e t1) e os pontos existentes; a altura é a do perfil
 * naquele t, então a forma não muda ao inserir.
 */
export function insertRoofProfilePoint(pts: RoofProfilePoint[], t0: number, t1: number): RoofProfilePoint[] {
  const ts = [t0, ...pts.map((q) => q.t), t1];
  let best = 0;
  let bestGap = -Infinity;
  for (let i = 0; i + 1 < ts.length; i++) {
    const gap = ts[i + 1]! - ts[i]!;
    if (gap > bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  const t = (ts[best]! + ts[best + 1]!) / 2;
  return [...pts.slice(0, best), { t, z: profileZAt(pts, t) }, ...pts.slice(best)];
}

/**
 * Arco: arco de círculo por (0, 0), (largura/2, flecha) e (largura, 0), em `n` trechos retos (12 por padrão). Os
 * extremos ficam exatos na cota 0. Flecha não positiva dá um perfil reto.
 */
export function presetArco(largura: number, flecha: number, n = 12): RoofProfilePoint[] {
  const L = largura;
  const segs = Math.max(2, Math.round(n));
  if (!(flecha > 0) || !(L > 0)) return [{ t: 0, z: 0 }, { t: L, z: 0 }];
  const R = (L * L / 4 + flecha * flecha) / (2 * flecha);
  const centerZ = flecha - R;
  const out: RoofProfilePoint[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = (L * i) / segs;
    const z = i === 0 || i === segs ? 0 : centerZ + Math.sqrt(Math.max(0, R * R - (t - L / 2) ** 2));
    out.push({ t, z });
  }
  return out;
}

/**
 * Mansarda (4 trechos, simétrica): trecho íngreme do beiral até (larguraInferior, alturaInferior), depois suave até
 * a cumeeira em L/2 (alturaTotal), e o espelho do outro lado. Com larguraInferior ≥ L/2 o perfil é inválido.
 */
export function presetMansarda(largura: number, alturaInferior: number, larguraInferior: number, alturaTotal: number): RoofProfilePoint[] {
  const L = largura;
  return [
    { t: 0, z: 0 },
    { t: larguraInferior, z: alturaInferior },
    { t: L / 2, z: alturaTotal },
    { t: L - larguraInferior, z: alturaInferior },
    { t: L, z: 0 },
  ];
}

/**
 * Dente de serra: `dentes` águas repetidas. Cada dente sobe suave do vale até `altura` e cai num trecho curto
 * (a face vertical do dente de serra não cabe numa água, então cai em rampa de até 200 %). Vales na cota 0.
 */
export function presetDenteSerra(largura: number, dentes: number, altura: number): RoofProfilePoint[] {
  const n = Math.max(1, Math.round(dentes));
  const w = largura / n;
  const run = Math.min(w * 0.9, Math.max(w * 0.25, altura / 2));
  const out: RoofProfilePoint[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ t: k * w, z: 0 });
    out.push({ t: (k + 1) * w - run, z: altura });
  }
  out.push({ t: largura, z: 0 });
  return out;
}

/** Borboleta (V invertido): beirais em `altura` e o vale no meio, na cota 0. */
export const presetBorboleta = (largura: number, altura: number): RoofProfilePoint[] => [
  { t: 0, z: altura },
  { t: largura / 2, z: 0 },
  { t: largura, z: altura },
];

/** Uma água: sobe do beiral (cota 0, em t = 0) até `altura` na borda oposta. */
export const presetUmaAgua = (largura: number, altura: number): RoofProfilePoint[] => [
  { t: 0, z: 0 },
  { t: largura, z: altura },
];

/** Duas águas: beirais na cota 0 e cumeeira em `altura`, no meio da largura. */
export const presetDuasAguas = (largura: number, altura: number): RoofProfilePoint[] => [
  { t: 0, z: 0 },
  { t: largura / 2, z: altura },
  { t: largura, z: 0 },
];
