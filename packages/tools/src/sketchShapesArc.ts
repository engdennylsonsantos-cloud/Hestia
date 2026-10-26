import { EPS, add, angleOf, cross, dist, dot, len, mul, norm, perp, sub, type SketchSeg, type Vec2 } from '@hestia/geom';
import { newId } from '@hestia/model';

/** Gerador de ids de linha do esboço. Injetável para testes (ids determinísticos). */
export type SketchIdFn = () => string;
export const defaultSketchId: SketchIdFn = () => newId('sk');

const TWO_PI = Math.PI * 2;

/** Ângulo reduzido a [0, 2π). Varredura que dá uma volta inteira (≈2π) vira 0. */
const sweepMod = (a: number): number => {
  const w = ((a % TWO_PI) + TWO_PI) % TWO_PI;
  return w > TWO_PI - 1e-9 ? 0 : w;
};

const onCircle = (c: Vec2, r: number, th: number): Vec2 => ({ x: c.x + r * Math.cos(th), y: c.y + r * Math.sin(th) });

/**
 * Arcos de uma circunferência (centro `c`, raio `r`) que varrem `span` radianos a partir de `a0`
 * (positivo = anti-horário). Cada peça tem no máximo 180° (limite de `arcFromSagitta`): varreduras
 * maiores são divididas em partes iguais. A flecha de cada peça é `r·(1 − cos(θ/2))`, com o sinal
 * que faz o arco ficar do lado certo do percurso.
 */
export function arcPieces(c: Vec2, r: number, a0: number, span: number, nid: SketchIdFn = defaultSketchId): SketchSeg[] {
  if (r < EPS || Math.abs(span) < EPS) return [];
  const n = Math.max(1, Math.ceil(Math.abs(span) / Math.PI - 1e-9));
  const step = span / n;
  const h = r * (1 - Math.cos(Math.abs(step) / 2));
  const out: SketchSeg[] = [];
  for (let i = 0; i < n; i++) {
    const a = onCircle(c, r, a0 + i * step);
    const b = onCircle(c, r, a0 + (i + 1) * step);
    // Sag positivo abaula à esquerda de a→b; percurso anti-horário abaula à direita (sinal negativo).
    out.push({ id: nid(), a, b, sag: step > 0 ? -h : h });
  }
  return out;
}

/** Circuncentro de três pontos; null se estiverem alinhados (ou se dois coincidirem). */
function circumcenter(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const ab = sub(b, a);
  const ac = sub(c, a);
  if (Math.abs(cross(ab, ac)) <= 1e-9 * len(ab) * len(ac)) return null;
  const d = 2 * cross(ab, ac);
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

/**
 * Arco pelos três pontos (início, fim e um ponto sobre o arco). Se o ponto do meio cair fora do
 * semicírculo, o arco é dividido em dois. Pontos alinhados viram a reta, se o meio estiver entre
 * as pontas; caso contrário, nada (não há arco).
 */
export function arcThreePoints(start: Vec2, end: Vec2, onArc: Vec2, nid: SketchIdFn = defaultSketchId): SketchSeg[] {
  const c = circumcenter(start, onArc, end);
  if (!c) return straightBetween(start, end, onArc, nid);
  const r = dist(c, start);
  const a0 = angleOf(sub(start, c));
  const aM = sweepMod(angleOf(sub(onArc, c)) - a0);
  const aE = sweepMod(angleOf(sub(end, c)) - a0);
  // O ponto do meio está no percurso anti-horário se a varredura até ele é menor que até o fim.
  const span = aM < aE ? aE : -sweepMod(a0 - angleOf(sub(end, c)));
  return arcPieces(c, r, a0, span, nid);
}

/** Reta entre as pontas se `mid` estiver entre elas (limite de arco alinhado); senão vazio. */
function straightBetween(a: Vec2, b: Vec2, mid: Vec2, nid: SketchIdFn): SketchSeg[] {
  const d = sub(b, a);
  const l2 = dot(d, d);
  if (l2 < EPS) return [];
  const t = dot(sub(mid, a), d) / l2;
  return Math.abs(cross(sub(mid, a), d)) <= 1e-9 * Math.sqrt(l2) * len(sub(mid, a)) && t > 0 && t < 1 ? [{ id: nid(), a, b }] : [];
}

/**
 * Arco pelo centro e pelas extremidades. O raio é a distância do centro ao início; o fim serve
 * pela direção angular (é projetado sobre a circunferência). `ccw` escolhe o sentido do percurso.
 */
export function arcCenterEnds(center: Vec2, start: Vec2, end: Vec2, ccw: boolean, nid: SketchIdFn = defaultSketchId): SketchSeg[] {
  const r = dist(center, start);
  if (r < EPS) return [];
  const a0 = angleOf(sub(start, center));
  const a1 = angleOf(sub(end, center));
  const span = ccw ? sweepMod(a1 - a0) : -sweepMod(a0 - a1);
  return arcPieces(center, r, a0, span, nid);
}

/**
 * Arco que sai de `start` tangente à direção `tangentDir` (vetor, ex.: ponto na tangente − início)
 * e termina em `end`. O centro fica na normal em `start`, com o raio fixado pela distância ao fim.
 * Se `end` estiver sobre a própria tangente, o resultado é a reta (limite de raio infinito).
 */
export function arcTangent(start: Vec2, tangentDir: Vec2, end: Vec2, nid: SketchIdFn = defaultSketchId): SketchSeg[] {
  const u = norm(tangentDir);
  const d = sub(end, start);
  const dl = len(d);
  if (len(tangentDir) < EPS || dl < EPS) return [];
  const n = perp(u);
  const dn = dot(d, n);
  if (Math.abs(dn) <= 1e-9 * dl) return dot(d, u) > 0 ? [{ id: nid(), a: start, b: end }] : [];
  // |start + t·n − end| = |t·n|  ⇒  t = |d|² / (2·d·n)
  const t = (dl * dl) / (2 * dn);
  const c = add(start, mul(n, t));
  const a0 = angleOf(sub(start, c));
  const a1 = angleOf(sub(end, c));
  // Com t > 0 o centro está à esquerda da tangente, e o percurso no sentido de u é anti-horário.
  const span = t > 0 ? sweepMod(a1 - a0) : -sweepMod(a0 - a1);
  return arcPieces(c, Math.abs(t), a0, span, nid);
}

/** Resultado do filete: as duas linhas aparadas (mesmos ids) e o arco de concordância. */
export interface FilletResult {
  a: SketchSeg;
  b: SketchSeg;
  arc: SketchSeg;
}

/** Semirreta de `p` na direção em que a linha está; null se `p` cai no meio da linha. */
function rayFrom(seg: SketchSeg, p: Vec2): Vec2 | null {
  const va = sub(seg.a, p);
  const vb = sub(seg.b, p);
  if (dot(va, vb) < -1e-9) return null;
  return norm(len(va) >= len(vb) ? va : vb);
}

/** Troca a ponta da linha mais próxima de `p` pelo ponto de tangência `t` (`d` ao longo de `ray`). */
function trimNear(seg: SketchSeg, p: Vec2, ray: Vec2, d: number): SketchSeg | null {
  const la = len(sub(seg.a, p));
  const lb = len(sub(seg.b, p));
  if (d > Math.max(la, lb) + 1e-9) return null; // linha curta demais: o ponto de tangência cairia após a outra ponta
  const t = add(p, mul(ray, d));
  return la <= lb ? { ...seg, a: t } : { ...seg, b: t };
}

/**
 * Filete (concordância) entre duas retas de raio `radius`. A esquina é a interseção das retas
 * (estendidas se preciso). Cada linha é aparada até o ponto de tangência, e o arco fica entre eles.
 * Devolve null para retas paralelas, raio nulo, ponto de tangência além de uma linha, ou arcos
 * (só retas são suportadas). Propriedades de telhado (`slopePct`, etc.) são preservadas.
 */
export function filletShape(segA: SketchSeg, segB: SketchSeg, radius: number, nid: SketchIdFn = defaultSketchId): FilletResult | null {
  if (!(radius > EPS) || segA.sag || segB.sag) return null;
  const va = sub(segA.b, segA.a);
  const vb = sub(segB.b, segB.a);
  const ua = norm(va);
  const ub = norm(vb);
  const cr = cross(ua, ub);
  if (len(va) < EPS || len(vb) < EPS || Math.abs(cr) < 1e-9) return null;
  const p = add(segA.a, mul(ua, cross(sub(segB.a, segA.a), ub) / cr));
  const rA = rayFrom(segA, p);
  const rB = rayFrom(segB, p);
  if (!rA || !rB) return null;
  const phi = Math.acos(Math.max(-1, Math.min(1, dot(rA, rB)))); // ângulo interno da esquina, (0, π)
  const d = radius / Math.tan(phi / 2);
  const a = trimNear(segA, p, rA, d);
  const b = trimNear(segB, p, rB, d);
  if (!a || !b) return null;
  const ta = add(p, mul(rA, d));
  const tb = add(p, mul(rB, d));
  // Arco menor (ângulo central π − φ) cuja flecha aponta para a esquina.
  const h = radius * (1 - Math.sin(phi / 2));
  const n = perp(norm(sub(tb, ta)));
  const mid = mul(add(ta, tb), 0.5);
  const sign = dot(sub(p, mid), n) >= 0 ? 1 : -1;
  return { a, b, arc: { id: nid(), a: ta, b: tb, sag: sign * h } };
}
