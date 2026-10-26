import type { SketchDraft, SketchSeg, Vec2 } from '@hestia/geom';
import { MOD_TOL, curveOf, gap, moveEnd, traceHits } from './perimeterModifyCurve.ts';
import { replaceById } from './perimeterModifyDraft.ts';

/** Ajuste máximo das pontas: 5 cm. Acima disso a tolerância pedida é cortada (não é conexão, é outro traçado). */
export const JOIN_LIMIT = 0.05;

/** Ponta de uma linha: id, lado ('a' ou 'b') e posição. */
interface EndRef {
  id: string;
  which: 'a' | 'b';
  p: Vec2;
}

function endsOf(segs: SketchSeg[]): EndRef[] {
  return segs.flatMap((s) => [
    { id: s.id, which: 'a' as const, p: s.a },
    { id: s.id, which: 'b' as const, p: s.b },
  ]);
}

/** Ponta solta: nenhuma outra linha tem ponta a menos de 1 mm dela. */
function isLoose(segs: SketchSeg[], e: EndRef): boolean {
  return !segs.some((s) => s.id !== e.id && (gap(s.a, e.p) <= MOD_TOL || gap(s.b, e.p) <= MOD_TOL));
}

/**
 * Une pontas soltas próximas (até 5 cm, ou a tolerância pedida se menor): as duas pontas vão para o ponto médio.
 * Pareamento guloso, do mais próximo para o mais longe; cada ponta entra em um só par. Null se nada se une.
 */
export function joinLoose(d: SketchDraft, tol: number): SketchDraft | null {
  const lim = Math.min(tol, JOIN_LIMIT);
  if (!(lim > MOD_TOL)) return null;
  const loose = endsOf(d.segs).filter((e) => isLoose(d.segs, e));
  const pairs: Array<{ x: EndRef; y: EndRef; g: number }> = [];
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const x = loose[i]!;
      const y = loose[j]!;
      const g = gap(x.p, y.p);
      if (x.id !== y.id && g > MOD_TOL && g <= lim) pairs.push({ x, y, g });
    }
  }
  pairs.sort((p, q) => p.g - q.g);

  const cur = new Map<string, SketchSeg>(d.segs.map((s) => [s.id, s]));
  const used = new Set<string>();
  const key = (e: EndRef): string => `${e.id}:${e.which}`;
  for (const { x, y } of pairs) {
    if (used.has(key(x)) || used.has(key(y))) continue;
    const mid = { x: (x.p.x + y.p.x) / 2, y: (x.p.y + y.p.y) / 2 };
    const sx = moveEnd(cur.get(x.id)!, x.which, mid);
    const sy = sx && moveEnd(cur.get(y.id)!, y.which, mid);
    if (!sx || !sy) continue;
    cur.set(x.id, sx);
    cur.set(y.id, sy);
    used.add(key(x));
    used.add(key(y));
  }
  if (used.size === 0) return null;
  const changed = new Map<string, SketchSeg>();
  for (const s of d.segs) {
    const next = cur.get(s.id)!;
    if (next !== s) changed.set(s.id, next);
  }
  return replaceById(d, changed);
}

/**
 * Ponto de canto mais próximo de `p`: interseção dos traços de duas outras linhas, a até `lim` de `p`.
 * Null se não há canto perto.
 */
function nearestCorner(segs: SketchSeg[], selfId: string, p: Vec2, lim: number): Vec2 | null {
  const others = segs.filter((s) => s.id !== selfId);
  let best: Vec2 | null = null;
  let bestD = lim;
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      for (const h of traceHits(curveOf(others[i]!), curveOf(others[j]!))) {
        const g = gap(h.p, p);
        if (g > MOD_TOL && g <= bestD) {
          best = h.p;
          bestD = g;
        }
      }
    }
  }
  return best;
}

/**
 * Encaixa pontas soltas em cantos (até 5 cm, ou a tolerância pedida se menor): ponta solta a pouca distância do
 * encontro de duas outras linhas vai para esse encontro. Null se nenhuma ponta encaixa.
 */
export function snapEndsToCorners(d: SketchDraft, tol: number): SketchDraft | null {
  const lim = Math.min(tol, JOIN_LIMIT);
  if (!(lim > MOD_TOL)) return null;
  const cur = new Map<string, SketchSeg>(d.segs.map((s) => [s.id, s]));
  const changed = new Map<string, SketchSeg>();
  for (const e of endsOf(d.segs)) {
    const live = [...cur.values()];
    const seg = cur.get(e.id)!;
    const p = e.which === 'a' ? seg.a : seg.b;
    if (!isLoose(live, { id: e.id, which: e.which, p })) continue;
    const corner = nearestCorner(live, e.id, p, lim);
    if (!corner) continue;
    const next = moveEnd(seg, e.which, corner);
    if (!next) continue;
    cur.set(e.id, next);
    changed.set(e.id, next);
  }
  return changed.size ? replaceById(d, changed) : null;
}
