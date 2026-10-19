import { EPS, add, len, mul, norm, perp, sub, type Vec2 } from './vec.ts';

/**
 * Arco definido pelas extremidades e pela flecha (sagitta): distância do meio do arco à corda,
 * positiva à esquerda de a→b. Limitada a metade da corda (arco de até 180°).
 */
export interface Arc {
  center: Vec2;
  radius: number;
  /** Ângulo do ponto inicial. */
  a0: number;
  /** Varredura assinada em radianos; negativa = sentido horário. */
  sweep: number;
  /** Comprimento do eixo (arco). */
  length: number;
  /** +1 se afastar-se do centro é ir para a ESQUERDA do sentido de percurso, −1 se for para a direita. */
  k: 1 | -1;
}

export function arcFromSagitta(a: Vec2, b: Vec2, sag: number): Arc | null {
  const chord = len(sub(b, a));
  if (Math.abs(sag) < 1e-6 || chord < 1e-6) return null;
  const h = Math.min(Math.abs(sag), chord / 2);
  const r = (chord * chord) / 4 / (2 * h) + h / 2;
  const u = norm(sub(b, a));
  const n = perp(u);
  const sgn = sag > 0 ? 1 : -1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const apex = add(mid, mul(n, h * sgn));
  const center = sub(apex, mul(n, r * sgn));
  const mag = 2 * Math.asin(Math.min(1, chord / (2 * r)));
  // Sag positivo: abaula à esquerda, o centro fica à direita e o percurso é horário.
  const sweep = sgn > 0 ? -mag : mag;
  return { center, radius: r, a0: Math.atan2(a.y - center.y, a.x - center.x), sweep, length: r * mag, k: sgn > 0 ? 1 : -1 };
}

const dirOf = (arc: Arc): 1 | -1 => (arc.sweep < 0 ? -1 : 1);

/** Ponto a distância `t` (comprimento do eixo) do início e deslocamento lateral `s` à esquerda. */
export function arcPointAt(arc: Arc, t: number, s = 0): Vec2 {
  const th = arc.a0 + dirOf(arc) * (t / arc.radius);
  const rho = arc.radius + arc.k * s;
  return { x: arc.center.x + rho * Math.cos(th), y: arc.center.y + rho * Math.sin(th) };
}

/** Tangente unitária no sentido do percurso. */
export function arcTangentAt(arc: Arc, t: number): Vec2 {
  const th = arc.a0 + dirOf(arc) * (t / arc.radius);
  const d = dirOf(arc);
  return { x: -Math.sin(th) * d, y: Math.cos(th) * d };
}

/** Projeta um ponto no sistema do arco: t (comprimento do eixo, pode sair de [0, L]) e s (lateral à esquerda). */
export function arcLocal(arc: Arc, p: Vec2): { t: number; s: number } {
  const th = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const d = dirOf(arc);
  // O arco ocupa [0, |sweep|]. A janela de 2π centrada no arco manda os pontos antes do início para
  // valores negativos e os depois do fim para valores acima de |sweep|, cortando no meio do vão oposto.
  const mag = Math.abs(arc.sweep);
  const lower = mag / 2 - Math.PI;
  let dth = (th - arc.a0) * d - lower;
  dth = ((dth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) + lower;
  const rho = Math.hypot(p.x - arc.center.x, p.y - arc.center.y);
  return { t: dth * arc.radius, s: (rho - arc.radius) * arc.k };
}

/** Pontos ao longo da curva paralela `s`, de t0 a t1, com erro de corda ≤ `tol` metros. */
export function arcSample(arc: Arc, t0: number, t1: number, s = 0, tol = 0.002): Vec2[] {
  const rho = Math.max(EPS, arc.radius + arc.k * s);
  const span = Math.abs(t1 - t0) / arc.radius;
  const step = 2 * Math.acos(Math.max(0, 1 - tol / rho));
  const n = Math.max(2, Math.min(720, Math.ceil(span / Math.max(step, 1e-3))));
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(arcPointAt(arc, t0 + ((t1 - t0) * i) / n, s));
  return out;
}

/** Concêntrico: desloca o arco `d` metros à esquerda (afastando ou aproximando do centro). */
export function offsetArc(a: Vec2, b: Vec2, sag: number, d: number): { a: Vec2; b: Vec2; sag: number } | null {
  const arc = arcFromSagitta(a, b, sag);
  if (!arc) return null;
  const r2 = arc.radius + arc.k * d;
  if (r2 <= 1e-6) return null;
  const f = r2 / arc.radius;
  const a2 = add(arc.center, mul(sub(a, arc.center), f));
  const b2 = add(arc.center, mul(sub(b, arc.center), f));
  const chord = len(sub(b2, a2));
  const sag2 = Math.sign(sag) * (r2 - Math.sqrt(Math.max(0, r2 * r2 - (chord * chord) / 4)));
  return { a: a2, b: b2, sag: sag2 };
}

/** Flecha do arco que passa pelos três pontos (a, m, b). Zero se estiverem alinhados. */
export function sagFromThreePoints(a: Vec2, m: Vec2, b: Vec2): number {
  const u = norm(sub(b, a));
  const n = perp(u);
  const chord = len(sub(b, a));
  const dm = (m.x - a.x) * n.x + (m.y - a.y) * n.y; // distância assinada do ponto m à corda
  const tm = (m.x - a.x) * u.x + (m.y - a.y) * u.y;
  if (Math.abs(dm) < 1e-6 || chord < 1e-6) return 0;
  // Círculo por a, b, m: o ponto médio da corda tem t = c/2; usamos a potência do ponto.
  // Distância ao centro na direção n: h_c = ((tm − 0)(tm − c) + dm²) / (2 dm)  (centro em (c/2, h_c))
  const hc = (tm * (tm - chord) + dm * dm) / (2 * dm);
  const r = Math.hypot(chord / 2, hc);
  const apex = hc + Math.sign(dm) * r; // ponto do arco mais afastado da corda, do lado de m
  const sag = Math.abs(dm) > 0 ? (Math.sign(dm) * Math.min(Math.abs(apex), chord / 2)) : 0;
  return sag;
}
