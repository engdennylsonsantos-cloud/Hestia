import { asMulti, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import {
  stairBaseZ,
  stairs,
  stairsOnLevel,
  stairTopLevel,
  stairTopZ,
  type Id,
  type Project,
  type Stair,
  type StairType,
} from '@hestia/model';
import { makeStairIssue, stairNormIssues, type StairIssueItem } from './stairIssues.ts';
import { stairLandingPolygon, stairRunSteps } from './stairSketch.ts';

/** Degrau (kind 'tread', index 1..N−1 no lance) ou patamar (kind 'landing', index sequencial na escada, a partir de 1). */
export interface ResolvedStairStep {
  componentIndex: number;
  kind: 'tread' | 'landing';
  index: number;
  polygon: Ring;
  /** Cota absoluta do topo. */
  z: number;
}

/** Espelho na ordem de subida (index 1..N do lance); z0/z1 são cotas absolutas da base e do topo. */
export interface ResolvedStairRiser {
  componentIndex: number;
  index: number;
  a: Vec2;
  b: Vec2;
  points: Vec2[];
  z0: number;
  z1: number;
}

/** Escada resolvida (decisão 0011 §4): cotas, altura real do espelho, degraus, espelhos, pegada e avisos. */
export interface ResolvedStair {
  id: Id;
  levelId: Id;
  /** Nível de topo efetivo (explícito ou o imediatamente acima); null sem nível acima. */
  topLevelId: Id | null;
  typeId: Id;
  type: StairType;
  baseZ: number;
  topZ: number;
  /** N: total de espelhos de todos os lances (inclui lances com erro de croqui). */
  riserCount: number;
  /** Altura real h = H ÷ N; 0 sem espelhos ou sem altura. */
  riserHeight: number;
  steps: ResolvedStairStep[];
  risers: ResolvedStairRiser[];
  /** União de degraus e patamares, em planta. */
  footprint: MultiPolygon;
  /** Erros de croqui e de geometria, mais os avisos de norma. */
  issues: StairIssueItem[];
}

const sketchIssues = (s: Stair, ci: number, list: Array<{ code: string; severity: 'error' | 'warning'; message: string }>): StairIssueItem[] =>
  list.map((i) => makeStairIssue(s.id, i.code, i.severity, i.message, ci));

/** Resolve uma escada; null se o tipo não existe (o validador do modelo já aponta `stair-type-missing`). */
function resolveOne(p: Project, s: Stair): ResolvedStair | null {
  const type = p.stairTypes[s.typeId];
  if (!type) return null;
  const baseZ = stairBaseZ(p, s);
  const topZ = stairTopZ(p, s);
  const H = topZ - baseZ;
  const N = s.components.reduce((n, c) => n + (c.kind === 'run' ? c.risers.length : 0), 0);
  const h = N > 0 && H > 0 ? H / N : 0;
  const issues: StairIssueItem[] = [];
  const steps: ResolvedStairStep[] = [];
  const risers: ResolvedStairRiser[] = [];
  if (N === 0) issues.push(makeStairIssue(s.id, 'stair-empty', 'error', 'A escada não tem espelhos.'));
  let before = 0;
  let landingCount = 0;
  s.components.forEach((c, ci) => {
    const z = baseZ + before * h;
    if (c.kind === 'run') {
      before += c.risers.length;
      if (h <= 0) return;
      // Erro de croqui: o lance não gera degraus, mas conta nos espelhos e os demais componentes continuam.
      const res = stairRunSteps(c, { baseZ: z, riserHeight: h });
      issues.push(...sketchIssues(s, ci, res.issues));
      for (const t of res.treads) steps.push({ componentIndex: ci, kind: 'tread', index: t.index, polygon: t.polygon, z: t.z });
      for (const r of res.risers) {
        risers.push({ componentIndex: ci, index: r.index, a: r.a, b: r.b, points: r.points, z0: r.z0, z1: r.z1 });
      }
    } else {
      const lp = stairLandingPolygon({ boundary: c.boundary });
      issues.push(...sketchIssues(s, ci, lp.issues));
      if (lp.polygon) {
        landingCount++;
        steps.push({ componentIndex: ci, kind: 'landing', index: landingCount, polygon: lp.polygon, z });
      }
    }
  });
  const footprint: MultiPolygon = steps.length ? union(...steps.map((st) => asMulti(st.polygon))) : [];
  const rs: ResolvedStair = {
    id: s.id,
    levelId: s.levelId,
    topLevelId: stairTopLevel(p, s)?.id ?? null,
    typeId: s.typeId,
    type,
    baseZ,
    topZ,
    riserCount: N,
    riserHeight: h,
    steps,
    risers,
    footprint,
    issues,
  };
  rs.issues.push(...stairNormIssues(rs));
  return rs;
}

const resolveList = (p: Project, list: Stair[]): ResolvedStair[] =>
  list.flatMap((s) => {
    const r = resolveOne(p, s);
    return r ? [r] : [];
  });

/** Todas as escadas do projeto, resolvidas (ordem de criação). */
export function resolveStairs(p: Project): ResolvedStair[] {
  return resolveList(p, stairs(p));
}

/** Escadas cujo nível (`levelId`) é o dado. */
export function resolveStairsOnLevel(p: Project, levelId: Id): ResolvedStair[] {
  return resolveList(p, stairsOnLevel(p, levelId));
}
