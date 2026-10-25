import { dist, dot, len, sub, type Vec2 } from '@hestia/geom';
import { dimensionGeometry, dimensionPoints, levelDimensions, levelGraphicsOf, levelTexts, wallsOnLevel, type DimensionRef, type Id, type Project, type TextNote } from '@hestia/model';

/** Tolerância (m) para dizer que um ponto é a extremidade de uma parede. */
const END_TOL = 1e-4;

/**
 * Referência a uma extremidade de parede do nível quando o ponto cai nela (a cota passa a acompanhar a parede).
 * Ponto no meio da face ou no vazio: sem referência, a cota fica livre.
 */
export function endRefAt(p: Project, levelId: Id, point: Vec2): DimensionRef | undefined {
  for (const w of wallsOnLevel(p, levelId)) {
    if (dist(w.a, point) <= END_TOL) return { wallId: w.id, end: 'a' };
    if (dist(w.b, point) <= END_TOL) return { wallId: w.id, end: 'b' };
  }
  return undefined;
}

/** Normal esquerda da direção a→b (unitária), ou null se a ou b coincidem. */
export function leftNormal(a: Vec2, b: Vec2): Vec2 | null {
  const d = sub(b, a);
  const l = len(d);
  if (l < 1e-9) return null;
  return { x: -d.y / l, y: d.x / l };
}

/** Distância com sinal do ponto `q` à reta a–b, medida no lado da normal esquerda de a→b. */
export const signedOffset = (a: Vec2, b: Vec2, q: Vec2): number => {
  const n = leftNormal(a, b);
  return n ? dot(sub(q, a), n) : 0;
};

/** Distância de `q` ao segmento p–r. */
function distToSegment(q: Vec2, p: Vec2, r: Vec2): number {
  const d = sub(r, p);
  const l2 = dot(d, d);
  const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(q, p), d) / l2)) : 0;
  return dist(q, { x: p.x + d.x * t, y: p.y + d.y * t });
}

/** Largura média de um caractere, em múltiplos do corpo da fonte (estimativa para o retângulo do texto). */
const TEXT_CHAR_EM = 0.6;

/**
 * Texto sob o cursor: o retângulo do texto, centrado na âncora e girado com ele, mais a tolerância de 6 px.
 * Corpo (m de modelo) = altura em mm de papel × escala ÷ 1000; largura = caracteres × 0,6 do corpo.
 */
export function textHit(t: TextNote, scale: number, at: Vec2, tol: number): boolean {
  const body = (t.height * scale) / 1000;
  const hw = (Math.max(1, [...t.text].length) * TEXT_CHAR_EM * body) / 2 + tol;
  const hh = body / 2 + tol;
  // Coordenadas do cursor no referencial do texto (girado por `rotation` graus, anti-horário, como na planta).
  const r = (t.rotation * Math.PI) / 180;
  const dx = at.x - t.at.x, dy = at.y - t.at.y;
  const u = dx * Math.cos(r) + dy * Math.sin(r);
  const v = -dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(u) <= hw && Math.abs(v) <= hh;
}

/** Cota ou texto de anotação sob o cursor (tolerância de 6 px, como a cota; o texto vale pelo retângulo, não só pela âncora). */
export function annotationAt(p: Project, levelId: Id, at: Vec2, mpp: number): { id: Id; kind: 'dimension' | 'text' } | null {
  const scale = levelGraphicsOf(p, levelId).scale;
  for (const t of levelTexts(p, levelId)) if (textHit(t, scale, at, 6 * mpp)) return { id: t.id, kind: 'text' };
  for (const d of levelDimensions(p, levelId)) {
    const pts = dimensionPoints(p, d);
    const g = dimensionGeometry(pts.a, pts.b, d.offset, mpp * 4);
    for (const [s, e] of [g.line, ...g.extensions]) if (distToSegment(at, s, e) <= 6 * mpp) return { id: d.id, kind: 'dimension' };
  }
  return null;
}

/** Alça da cota selecionada: o ponto médio da linha de cota. Arrastá-la muda o deslocamento. */
export function dimGripAt(p: Project, levelId: Id, sel: Id[], at: Vec2, mpp: number): Id | null {
  if (sel.length !== 1) return null;
  const d = levelDimensions(p, levelId).find((x) => x.id === sel[0]);
  if (!d) return null;
  const pts = dimensionPoints(p, d);
  const g = dimensionGeometry(pts.a, pts.b, d.offset, mpp * 4);
  return dist(at, mid(g.line[0], g.line[1])) <= 6 * mpp ? d.id : null;
}

/** Ponto médio de um segmento. */
export const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
