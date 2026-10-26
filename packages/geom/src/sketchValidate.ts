import { pointInRing, ringArea } from './polygon.ts';
import { distToSeg, contactsOf, isInterior, segGeo, SKETCH_TOL, type SegGeo } from './sketchGeom.ts';
import { buildGraph, classify, cycleOrder, groupSegs, sampleRing, type Graph, type Step } from './sketchLoops.ts';
import type { SketchIssue, SketchIssueCode, SketchLoop, SketchResult, SketchSeg } from './sketchTypes.ts';
import { dist, type Vec2 } from './vec.ts';

const MSG: Record<SketchIssueCode, string> = {
  empty: 'Esboço vazio.',
  open: 'Laço aberto: há uma ponta sem par.',
  'too-few': 'Laço com menos de 3 lados.',
  'zero-length': 'Linha de comprimento zero.',
  'self-cross': 'Linha cruza outra do mesmo laço.',
  overlap: 'Linhas colineares sobrepostas.',
  'loops-cross': 'Laços se cruzam.',
  'loops-touch': 'Laços se tocam.',
  'hole-outside': 'Furo não fica inteiro dentro do contorno externo.',
  'hole-in-hole': 'Laço dentro de furo não é permitido.',
  'multi-outer': 'Há mais de um contorno externo, separados.',
};

const mk = (code: SketchIssueCode, segIds: string[], at?: Vec2): SketchIssue =>
  at ? { code, message: MSG[code], segIds, at } : { code, message: MSG[code], segIds };

/** Laço fechado válido, ainda sem papel (externo ou furo). */
interface Cand {
  comp: number;
  steps: Step[];
  geos: SegGeo[];
  ring: Vec2[];
  area: number;
  rep: Vec2;
  segIds: string[];
}

/** Contato entre duas componentes diferentes, acumulado por par. */
interface PairInfo {
  a: number;
  b: number;
  proper: boolean;
  at: Vec2;
  ids: Set<string>;
}

const pairKey = (x: number, y: number): string => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** Agrupa as linhas em laços e aplica as regras de validação do esboço. */
export function validateSketch(segs: SketchSeg[]): SketchResult {
  if (segs.length === 0) return { loops: [], issues: [mk('empty', [])], ok: false };
  const issues: SketchIssue[] = [];
  const lines: SegGeo[] = [];
  for (const s of segs) {
    if (dist(s.a, s.b) <= SKETCH_TOL) issues.push(mk('zero-length', [s.id], s.a));
    else lines.push(segGeo(s));
  }
  const graph = buildGraph(lines);
  const comps = groupSegs(graph).map((ids) => classify(graph, ids));
  const compOf: number[] = lines.map(() => 0);
  comps.forEach((c, ci) => {
    for (const s of c.segs) compOf[s] = ci;
  });

  const cands: Cand[] = [];
  comps.forEach((c, ci) => {
    const ids = c.segs.map((s) => lines[s]?.seg.id ?? '');
    const steps = cycleOrder(graph, c.segs);
    const geos = steps.map((st) => lines[st.seg]).filter((g): g is SegGeo => g !== undefined);
    const twoArcs = geos.length === 2 && geos.every((g) => g.arc);
    if (c.kind === 'open') {
      issues.push(mk('open', ids, c.at));
    } else if (c.kind === 'branch') {
      issues.push(mk('loops-touch', ids, c.at));
    } else if (geos.length < 3 && !twoArcs) {
      issues.push(mk('too-few', ids, c.at));
    } else {
      const ring = sampleRing(steps, lines);
      cands.push({ comp: ci, steps, geos, ring, area: Math.abs(ringArea(ring)), rep: ring[0] ?? c.at, segIds: ids });
    }
  });
  cands.sort((x, y) => y.area - x.area);

  const touching = new Set<string>();
  const pairs = new Map<string, PairInfo>();
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const gi = lines[i];
      const gj = lines[j];
      if (!gi || !gj) continue;
      const cs = contactsOf(gi, gj);
      if (cs.length === 0) continue;
      const ids = [gi.seg.id, gj.seg.id];
      const sameComp = compOf[i] === compOf[j];
      if (!sameComp) touching.add(pairKey(compOf[i] ?? 0, compOf[j] ?? 0));
      const ov = cs.find((c) => c.overlap);
      if (ov) {
        issues.push(mk('overlap', ids, ov.p));
      } else if (sameComp) {
        const shared = sharedPoints(graph, i, j);
        const bad = cs.find((c) => !shared.some((q) => dist(q, c.p) <= 2 * SKETCH_TOL));
        if (bad) issues.push(mk('self-cross', ids, bad.p));
      } else {
        const key = pairKey(compOf[i] ?? 0, compOf[j] ?? 0);
        const ci = compOf[i] ?? 0;
        const cj = compOf[j] ?? 0;
        const info = pairs.get(key) ?? { a: Math.min(ci, cj), b: Math.max(ci, cj), proper: false, at: cs[0]!.p, ids: new Set<string>() };
        pairs.set(key, info);
        if (cs.some((c) => isInterior(c.t1, gi) && isInterior(c.t2, gj))) info.proper = true;
        for (const id of ids) info.ids.add(id);
      }
    }
  }

  const outer = cands[0];
  const isLoop = (comp: number): Cand | undefined => cands.find((c) => c.comp === comp);
  for (const info of pairs.values()) {
    const A = isLoop(info.a);
    const B = isLoop(info.b);
    const crossing = info.proper || (!!A && !!B && (straddles(A, B) || straddles(B, A)));
    if (!crossing) issues.push(mk('loops-touch', [...info.ids], info.at));
    else if (!!A && !!B && (info.a === outer?.comp || info.b === outer?.comp)) issues.push(mk('hole-outside', [...info.ids], info.at));
    else issues.push(mk('loops-cross', [...info.ids], info.at));
  }

  for (let i = 1; i < cands.length; i++) {
    const L = cands[i]!;
    if (cands.some((o) => o !== L && touching.has(pairKey(L.comp, o.comp)))) continue;
    const containers = cands.filter((o) => o !== L && pointInRing(L.rep, o.ring));
    if (containers.length === 0) issues.push(mk('multi-outer', L.segIds, L.rep));
    else if (containers.some((o) => o !== outer)) issues.push(mk('hole-in-hole', L.segIds, L.rep));
  }

  const loops: SketchLoop[] = cands.map((c, k) => ({
    role: k === 0 ? 'outer' : 'hole',
    segs: c.geos.map((g) => g.seg),
    ring: c.ring,
  }));
  return { loops, issues, ok: loops.length > 0 && issues.length === 0 };
}

/** Pontas compartilhadas por duas linhas: ali o encontro é conexão, não cruzamento. */
function sharedPoints(g: Graph, i: number, j: number): Vec2[] {
  const ei: number[] = g.ends[i] ?? [];
  const ej: number[] = g.ends[j] ?? [];
  return ei.filter((n) => ej.includes(n)).map((n) => g.pos[n] ?? { x: 0, y: 0 });
}

/** Um laço tem pontos dentro e fora do outro (fora dos trechos encostados). */
function straddles(x: Cand, y: Cand): boolean {
  let inside = false;
  let outside = false;
  for (const p of x.ring) {
    if (y.geos.some((g) => distToSeg(p, g) <= SKETCH_TOL)) continue;
    if (pointInRing(p, y.ring)) inside = true;
    else outside = true;
    if (inside && outside) return true;
  }
  return false;
}
