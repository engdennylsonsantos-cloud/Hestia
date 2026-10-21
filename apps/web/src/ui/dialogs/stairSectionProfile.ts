import type { StairType } from '@hestia/model';

/** Ponto do perfil de corte: [x, y] com y para cima e o chão em y = 0. */
export type ProfilePoint = [number, number];

type ProfileInput = Pick<StairType, 'maxRiser' | 'minTread' | 'runStyle' | 'undersideStyle' | 'structuralDepth'>;

/**
 * Contorno do corte da prévia com `n` degraus (decisão 0012 §1 #2 e §2). O degrau i tem topo em (i+1)·r; o piso e o
 * espelho do tipo seguem a forma atual. No monolítico, `structuralDepth` é perpendicular à rampa: a espessura vertical
 * equivalente é `T = d / cosθ`, com `cosθ = p / √(p² + h²)`, `p` = piso e `h` = espelho.
 * - face lisa: fundo em linha reta, paralelo à rampa, a T abaixo da linha dos nariz;
 * - face escalonada: fundo em degraus (cada degrau tem fundo plano a `r + T` abaixo do seu topo), em dente de serra.
 */
export function stairSectionProfile(type: ProfileInput, n = 3): ProfilePoint[] {
  const r = Math.max(type.maxRiser, 0.05);
  const t = Math.max(type.minTread, 0.1);
  const top: ProfilePoint[] = [[0, 0]];
  for (let i = 0; i < n; i++) top.push([i * t, (i + 1) * r], [(i + 1) * t, (i + 1) * r]);
  if (type.runStyle !== 'monolithic') return [...top, [n * t, 0]];
  const d = Math.max(type.structuralDepth, 0);
  const T = d / (t / Math.hypot(t, r));
  if (type.undersideStyle === 'stepped') {
    const bottom: ProfilePoint[] = [];
    for (let i = n - 1; i >= 0; i--) bottom.push([(i + 1) * t, i * r - T], [i * t, i * r - T]);
    return [...top, ...bottom];
  }
  return [...top, [n * t, n * r - T], [0, -T]];
}
