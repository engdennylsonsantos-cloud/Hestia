import { ringArea, weightedSkeleton, type Vec2 } from '@hestia/geom';
import type { Roof } from './types.ts';
import type { ValidationIssue } from './validate.ts';

/** Percentual máximo de cada faixa da mansarda (mesmo teto das demais inclinações do telhado). */
const MAX_PERCENT = 300;

const fmtM = (v: number): string => v.toFixed(2).replace('.', ',');

/**
 * Maior `run` que ainda deixa a faixa de cima em ao menos uma água: a maior, entre as águas do esqueleto reto (pesos 1 nas arestas
 * com água, 0 nas empenas), da maior distância de um vértice da água à reta da aresta dela. Null quando o esqueleto não
 * fecha (quem avisa é o motor) ou quando o contorno não é conhecido pelo modelo (formas 'gable' e 'shed' escolhem as
 * arestas com água no motor).
 */
export function mansardRunLimit(boundary: Vec2[], slopes: Array<number | null | undefined>): number | null {
  const n = boundary.length;
  if (n < 3 || slopes.length !== n) return null;
  const ccw = ringArea(boundary) >= 0;
  const outer = ccw ? boundary : [...boundary].reverse();
  const origOf = (k: number): number => (ccw ? k : (((n - 2 - k) % n) + n) % n);
  const w = (j: number): number => (slopes[j] !== null && slopes[j] !== undefined && slopes[j]! > 0 ? 1 : 0);
  try {
    const res = weightedSkeleton({ outer, holes: [], weights: [outer.map((_, k) => w(origOf(k)))] });
    if (!res.ok) return null;
    let limit = 0;
    for (const f of res.faces) {
      if (f.ring !== 0) continue;
      const j = origOf(f.edge);
      if (!w(j)) continue;
      const a = boundary[j]!;
      const c = boundary[(j + 1) % n]!;
      const l = Math.hypot(c.x - a.x, c.y - a.y);
      if (l < 1e-9) continue;
      // Distância à reta da aresta (valor absoluto: vale para contorno horário e anti-horário).
      const far = Math.max(...f.polygon.map((v) => Math.abs(((v.x - a.x) * (c.y - a.y) - (v.y - a.y) * (c.x - a.x)) / l)));
      limit = Math.max(limit, far);
    }
    return limit > 0 ? limit : null;
  } catch {
    return null;
  }
}

/** Erros da mansarda: forma que não a aceita, números inválidos e `run` que não deixa a faixa de cima em nenhuma água. */
export function mansardProblems(r: Roof, name: string): ValidationIssue[] {
  const m = r.mansard;
  if (!m) return [];
  const out: ValidationIssue[] = [];
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: r.id });
  if (r.shape === 'free' || r.shape === 'extrusion') {
    push('roof-mansard-shape', `Telhado ${name}: a mansarda só vale em telhado por contorno (não em águas livres nem por extrusão).`);
    return out;
  }
  let ok = true;
  if (!Number.isFinite(m.run) || m.run <= 0) {
    ok = false;
    push('roof-mansard-run', `Mansarda do telhado ${name}: a largura da faixa de baixo (${m.run} m) precisa ser maior que zero.`);
  }
  const pcts: Array<[string, number]> = [['de baixo', m.lowerPercent], ['de cima', m.upperPercent]];
  for (const [which, v] of pcts) {
    if (!Number.isFinite(v) || v <= 0 || v > MAX_PERCENT) {
      ok = false;
      push('roof-mansard-slope', `Mansarda do telhado ${name}: a inclinação ${which} (${v} %) precisa estar entre 0 e ${MAX_PERCENT} %.`);
    }
  }
  if (!ok) return out;
  const slopes = r.shape === 'edges' ? r.edgeSlopes : r.shape === 'hip' ? r.boundary.map(() => 1) : null;
  const limit = slopes ? mansardRunLimit(r.boundary, slopes) : null;
  if (limit !== null && m.run >= limit - 1e-9) {
    push('roof-mansard-run', `Mansarda do telhado ${name}: a faixa de baixo (${fmtM(m.run)} m) chega ao centro do telhado; use menos que ${fmtM(limit)} m.`);
  }
  return out;
}
