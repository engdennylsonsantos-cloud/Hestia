import type { StairType } from '@hestia/model';

/** Ponto do perfil de corte: [x, y] com y para cima e o chão em y = 0. */
export type ProfilePoint = [number, number];

type ProfileInput = Pick<StairType, 'maxRiser' | 'minTread' | 'runStyle' | 'undersideStyle' | 'structuralDepth'>;
type PostInput = Pick<StairType, 'maxRiser' | 'minTread' | 'treadThickness' | 'treadOverlap'>;

/**
 * Contorno do corte da prévia com `n` degraus (decisão 0012 §1 #2 e §2). O degrau i tem topo em (i+1)·r; o piso e o
 * espelho do tipo seguem a forma atual. No monolítico, `structuralDepth` é perpendicular à rampa: a espessura vertical
 * equivalente é `T = d / cosθ`, com `cosθ = p / √(p² + h²)`, `p` = piso e `h` = espelho.
 * - face lisa: fundo em linha reta, paralelo à rampa, a T abaixo da linha dos nariz;
 * - face escalonada: fundo em degraus (cada degrau tem fundo plano a `r + T` abaixo do seu topo), em dente de serra.
 * No estilo poste não há contorno único (degraus soltos, sem espelho): use `stairPostTreads`; aqui devolve [].
 */
export function stairSectionProfile(type: ProfileInput, n = 3): ProfilePoint[] {
  if (type.runStyle === 'post') return [];
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

/**
 * Degraus soltos do estilo poste (sem espelho), um polígono por degrau com a espessura `treadThickness`. O degrau i fica
 * a `(i+1)·r` do chão e a ponta avança `treadOverlap` sobre o degrau seguinte (em planta; na prévia, a ponta do degrau).
 * Ilustrativo, não é o corte do projeto.
 */
export function stairPostTreads(type: PostInput, n = 3): ProfilePoint[][] {
  const r = Math.max(type.maxRiser, 0.05);
  const t = Math.max(type.minTread, 0.1);
  const T = Math.max(type.treadThickness, 0.01);
  const ov = Math.max(type.treadOverlap, 0);
  const out: ProfilePoint[][] = [];
  for (let i = 0; i < n; i++) {
    const yTop = (i + 1) * r;
    const yBot = yTop - T;
    const x0 = i * t;
    const x1 = (i + 1) * t + ov;
    out.push([
      [x0, yBot],
      [x1, yBot],
      [x1, yTop],
      [x0, yTop],
    ]);
  }
  return out;
}
