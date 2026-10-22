import { cross, dist, lerp, norm, sub, type Vec2 } from '@hestia/geom';
import type { ResolvedStair, ResolvedStairRiser } from './stairs.ts';
import { DEFAULT_STAIR_NORMS, type StairNorms } from './stairNorms.ts';

/** Aviso ou erro de uma escada. `componentIndex` (posição em `components`) quando o caso é de um lance ou patamar. */
export interface StairIssueItem {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  stairId: string;
  componentIndex?: number;
  /** Elementos envolvidos, para o "Ir para" (ex.: escada e parede invadida). */
  ids?: string[];
}

/** Tolerância (m) nas comparações com faixas e com o nº de espelhos (evita 0,28 × 0,9999… virar aviso). */
const EPS = 1e-9;

const num = (n: number, digits: number): string => n.toFixed(digits).replace('.', ',');

export function makeStairIssue(
  stairId: string,
  code: string,
  severity: 'error' | 'warning',
  message: string,
  componentIndex?: number,
): StairIssueItem {
  const out: StairIssueItem = { code, severity, message, stairId };
  if (componentIndex !== undefined) out.componentIndex = componentIndex;
  return out;
}

/** Comprimento de uma polilinha (m). */
function polyLength(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) s += dist(pts[i]!, pts[i + 1]!);
  return s;
}

/** Ponto médio por comprimento de arco de uma polilinha (com pelo menos dois pontos). */
function arcMid(pts: Vec2[]): Vec2 {
  const half = polyLength(pts) / 2;
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const l = dist(a, b);
    if (acc + l >= half) return lerp(a, b, l > 0 ? (half - acc) / l : 0);
    acc += l;
  }
  return pts[pts.length - 1]!;
}

/** Cascas convexas (cadeia monótona de Andrew). */
function convexHull(pts: Vec2[]): Vec2[] {
  const s = [...pts].sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Menor dimensão de um polígono: menor largura da casca convexa (distância máxima a cada aresta da casca). */
export function minWidth(ring: Vec2[]): number {
  const hull = convexHull(ring);
  if (hull.length < 3) return 0;
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const L = dist(a, b);
    if (L < 1e-12) continue;
    const dx = (b.x - a.x) / L;
    const dy = (b.y - a.y) / L;
    let far = 0;
    for (const p of hull) far = Math.max(far, Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)));
    best = Math.min(best, far);
  }
  return best === Infinity ? 0 : best;
}

function risersByRun(risers: ResolvedStairRiser[]): Array<[number, ResolvedStairRiser[]]> {
  const groups = new Map<number, ResolvedStairRiser[]>();
  for (const r of risers) {
    const list = groups.get(r.componentIndex);
    if (list) list.push(r);
    else groups.set(r.componentIndex, [r]);
  }
  return [...groups.entries()];
}

/** Espelho (altura real h = H ÷ N) contra o tipo e a faixa de norma. Sem espelhos ou sem altura, nada. */
function riserChecks(rs: ResolvedStair, norms: StairNorms, out: StairIssueItem[]): void {
  const h = rs.riserHeight;
  if (rs.riserCount === 0 || !(h > 0)) return;
  const H = rs.topZ - rs.baseZ;
  const max = rs.type.maxRiser;
  if (max > 0) {
    const desired = Math.ceil(H / max - EPS);
    if (rs.riserCount !== desired) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-risers-count',
          'warning',
          `O nº de espelhos (${rs.riserCount}) difere do nº desejado (${desired}): adicione/remova espelhos ou ajuste a altura.`,
        ),
      );
    }
    if (h > max + EPS) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-riser-too-high',
          'error',
          `A altura real do espelho (${num(h, 3)} m) excede a máxima do tipo (${num(max, 3)} m).`,
        ),
      );
    }
  }
  if (h < norms.riserMin - EPS || h > norms.riserMax + EPS) {
    out.push(
      makeStairIssue(
        rs.id,
        'stair-riser-range',
        'warning',
        `A altura do espelho (${num(h, 3)} m) está fora da faixa de norma (${num(norms.riserMin, 2)} a ${num(norms.riserMax, 2)} m).`,
      ),
    );
  }
}

/** Diferença máxima (m) entre pisos consecutivos de um lance reto (decisão 0011 §1 item 10). */
const TREAD_EVEN_TOL = 0.005;
/** Seno máximo do ângulo entre dois espelhos para contar como paralelos (~0,06°). */
const PARALLEL_SIN = 1e-3;

/**
 * Degraus iguais (`stair-uneven`): num lance de espelhos paralelos, o piso entre pares de espelhos consecutivos não pode
 * variar mais de 5 mm. Em leque os espelhos não são paralelos e a variação do piso é esperada: não avisa.
 *
 * Alturas entre lances: não se checam. A altura do espelho é uma só por escada (h = H ÷ N, decisão 0011 §1 item 4),
 * então todo espelho de todo lance tem a mesma altura por construção. Se o modelo passar a aceitar altura por lance,
 * a comparação entra aqui, por `componentIndex`.
 */
function evenTreadCheck(rs: ResolvedStair, ci: number, risers: ResolvedStairRiser[], out: StairIssueItem[]): void {
  if (risers.length < 3) return;
  const u0 = norm(sub(risers[0]!.b, risers[0]!.a));
  if (!risers.every((r) => Math.abs(cross(u0, norm(sub(r.b, r.a)))) < PARALLEL_SIN)) return;
  const mids = risers.map((r) => arcMid(r.points));
  const treads = mids.slice(1).map((m, i) => dist(mids[i]!, m));
  const spread = Math.max(...treads) - Math.min(...treads);
  if (spread > TREAD_EVEN_TOL + EPS) {
    out.push(
      makeStairIssue(
        rs.id,
        'stair-uneven',
        'warning',
        `Degraus desiguais: o piso entre espelhos consecutivos varia ${Math.round(spread * 1000)} mm (máximo ${Math.round(TREAD_EVEN_TOL * 1000)} mm).`,
        ci,
      ),
    );
  }
}

/**
 * Piso do leque (decisão 0011 §1 item 10, aviso `stair-winder-tread`): entre dois espelhos que NÃO são paralelos, o piso
 * medido a `winderTreadAt` m da borda interna — a corda entre os dois espelhos nesse afastamento — não pode ser menor
 * que `winderTreadMin`. O lado interno é o lado em que as pontas dos espelhos ficam mais próximas entre si. O caracol
 * tem a sua própria regra (`stair-spiral-tread`), com os mesmos números: aqui ele é pulado.
 */
function winderTreadCheck(rs: ResolvedStair, ci: number, risers: ResolvedStairRiser[], norms: StairNorms, out: StairIssueItem[]): void {
  if (risers.length < 2 || rs.spiral?.componentIndex === ci) return;
  const pointAt = (inner: Vec2, outer: Vec2): Vec2 => {
    const l = dist(inner, outer);
    return lerp(inner, outer, l > EPS ? Math.min(1, norms.winderTreadAt / l) : 0);
  };
  let worst = Infinity;
  for (let i = 1; i < risers.length; i++) {
    const p = risers[i - 1]!;
    const q = risers[i]!;
    if (Math.abs(cross(norm(sub(p.b, p.a)), norm(sub(q.b, q.a)))) < PARALLEL_SIN) continue;
    // O lado interno é o par de pontas mais próximo; o outro par é a borda externa.
    const straightPair = dist(p.a, q.a) + dist(p.b, q.b);
    const crossedPair = dist(p.a, q.b) + dist(p.b, q.a);
    const [i0, o0, i1, o1] = straightPair <= crossedPair ? [p.a, p.b, q.a, q.b] : [p.b, p.a, q.b, q.a];
    worst = Math.min(worst, dist(pointAt(i0, o0), pointAt(i1, o1)));
  }
  if (worst < norms.winderTreadMin - EPS) {
    out.push(
      makeStairIssue(
        rs.id,
        'stair-winder-tread',
        'warning',
        `O piso do degrau do leque a ${num(norms.winderTreadAt, 2)} m da borda interna (${num(worst, 2)} m) é menor que o mínimo de ${num(norms.winderTreadMin, 2)} m.`,
        ci,
      ),
    );
  }
}

/** Lance a lance: largura, piso médio, Blondel, desnível sem patamar, degraus iguais e piso do leque. */
function runChecks(rs: ResolvedStair, norms: StairNorms, out: StairIssueItem[]): void {  const h = rs.riserHeight;
  for (const [ci, risers] of risersByRun(rs.risers)) {
    const width = Math.min(...risers.map((r) => polyLength(r.points)));
    if (width < rs.type.minRunWidth - EPS) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-width-min',
          'warning',
          `A largura do lance (${num(width, 2)} m) é menor que a mínima do tipo (${num(rs.type.minRunWidth, 2)} m).`,
          ci,
        ),
      );
    }
    evenTreadCheck(rs, ci, risers, out);
    winderTreadCheck(rs, ci, risers, norms, out);
    if (risers.length >= 2) {
      const mids = risers.map((r) => arcMid(r.points));
      let sum = 0;
      for (let i = 1; i < mids.length; i++) sum += dist(mids[i - 1]!, mids[i]!);
      const tread = sum / (mids.length - 1);
      if (tread < norms.treadMin - EPS || tread > norms.treadMax + EPS) {
        out.push(
          makeStairIssue(
            rs.id,
            'stair-tread-range',
            'warning',
            `O piso médio do lance (${num(tread, 3)} m) está fora da faixa de norma (${num(norms.treadMin, 2)} a ${num(norms.treadMax, 2)} m).`,
            ci,
          ),
        );
      }
      const blondel = 2 * h + tread;
      if (blondel < norms.blondelMin - EPS || blondel > norms.blondelMax + EPS) {
        out.push(
          makeStairIssue(
            rs.id,
            'stair-blondel',
            'warning',
            `A relação 2h + p (${num(blondel, 3)} m) está fora da faixa de norma (${num(norms.blondelMin, 2)} a ${num(norms.blondelMax, 2)} m).`,
            ci,
          ),
        );
      }
    }
    const rise = risers.length * h;
    if (rise > norms.maxRiseBetweenLandings + EPS) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-landing-rise',
          'warning',
          `O lance sobe ${num(rise, 2)} m sem patamar; o máximo entre patamares é ${num(norms.maxRiseBetweenLandings, 2)} m.`,
          ci,
        ),
      );
    }
  }
}

/** Menor dimensão de cada patamar. */
function landingChecks(rs: ResolvedStair, norms: StairNorms, out: StairIssueItem[]): void {
  for (const st of rs.steps) {
    if (st.kind !== 'landing') continue;
    const w = minWidth(st.polygon);
    if (w < norms.landingMinLength - EPS) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-landing-length',
          'warning',
          `O patamar tem menor dimensão de ${num(w, 2)} m, abaixo do mínimo de ${num(norms.landingMinLength, 2)} m.`,
          st.componentIndex,
        ),
      );
    }
  }
}

/** Avisos de norma (decisão 0011 §3 e §1 item 10) de uma escada resolvida. Nunca bloqueiam. */
export function stairNormIssues(rs: ResolvedStair, norms: StairNorms = DEFAULT_STAIR_NORMS): StairIssueItem[] {
  const out: StairIssueItem[] = [];
  riserChecks(rs, norms, out);
  runChecks(rs, norms, out);
  landingChecks(rs, norms, out);
  return out;
}

/** Aviso fixo de todo lance de caracol (decisão 0014 §1 item 6, e): não é saída de emergência (RT 11 e IT 11 SP). */
export const SPIRAL_EXIT_MESSAGE =
  'Escada caracol não serve de saída de emergência (RS: RT 11 5.7.1.2; SP: só mezanino e área privativa).';

/** Parâmetros do caracol para os avisos: varredura (rad), raios e nº de espelhos (N) do lance. */
export interface SpiralNormInput {
  sweep: number;
  rInner: number;
  rOuter: number;
  risers: number;
}

/**
 * Avisos de norma do caracol (decisão 0014 §1 itens 6 e 7), sempre avisos. Δ = |sweep| ÷ (N−1); a corda entre dois
 * espelhos no raio r é 2·r·sen(Δ/2) (a mesma medida do degrau em `stairBody`):
 * - `stair-spiral-tread`: piso a 0,55 m da borda interna abaixo de 0,28 m;
 * - `stair-spiral-narrow` (informativo): piso na borda estreita (interna) abaixo de 0,07 m;
 * - `stair-spiral-headroom`: com |sweep| > 2π, folga entre voltas (n−1)·h − Tv abaixo da folga mínima do tipo, com n = 2π ÷ Δ
 *   espelhos por volta; a folga mínima é a do espelho de trás do degrau de cima (decisão 0014 §1 item 7), e
 *   Tv = T monolítico (`structuralDepth` ÷ cosθ, no raio da caminhada) ou `treadThickness` (outros);
 * - `stair-spiral-exit`: aviso fixo de saída de emergência (sempre).
 * O 2e+p no raio da caminhada já sai de `stair-blondel` (regra do leque).
 */
export function spiralNormIssues(
  rs: ResolvedStair,
  componentIndex: number,
  sp: SpiralNormInput | undefined,
  norms: StairNorms = DEFAULT_STAIR_NORMS,
): StairIssueItem[] {
  const out: StairIssueItem[] = [makeStairIssue(rs.id, 'stair-spiral-exit', 'warning', SPIRAL_EXIT_MESSAGE, componentIndex)];
  const h = rs.riserHeight;
  if (!sp || !(h > 0) || !(sp.risers >= 2) || !(Math.abs(sp.sweep) > 0)) return out;
  const step = Math.abs(sp.sweep) / (sp.risers - 1);
  const chord = (r: number): number => 2 * r * Math.sin(step / 2);

  const atTread = chord(sp.rInner + norms.spiralTreadAt);
  if (atTread < norms.spiralTreadMin - EPS) {
    out.push(
      makeStairIssue(
        rs.id,
        'stair-spiral-tread',
        'warning',
        `O piso a ${num(norms.spiralTreadAt, 2)} m da borda interna (${num(atTread, 2)} m) é menor que o mínimo de ${num(norms.spiralTreadMin, 2)} m.`,
        componentIndex,
      ),
    );
  }
  const narrow = chord(sp.rInner);
  if (narrow < norms.spiralNarrowMin - EPS) {
    out.push(
      makeStairIssue(
        rs.id,
        'stair-spiral-narrow',
        'warning',
        `O piso na borda estreita (${num(narrow, 3)} m) é menor que o mínimo de ${num(norms.spiralNarrowMin, 2)} m (informativo).`,
        componentIndex,
      ),
    );
  }
  if (Math.abs(sp.sweep) > 2 * Math.PI + EPS) {
    const p = chord((sp.rInner + sp.rOuter) / 2);
    const tv = rs.type.runStyle === 'monolithic'
      ? (p > EPS ? (rs.type.structuralDepth * Math.hypot(p, h)) / p : rs.type.structuralDepth)
      : rs.type.treadThickness;
    const perTurn = (2 * Math.PI) / step;
    const folga = (perTurn - 1) * h - tv;
    if (folga < rs.type.minHeadroom - EPS) {
      out.push(
        makeStairIssue(
          rs.id,
          'stair-spiral-headroom',
          'warning',
          `A folga entre voltas (${num(folga, 2)} m) é menor que o mínimo (${num(rs.type.minHeadroom, 2)} m): aumente o nº de espelhos por volta, o pé-direito ou a profundidade livre.`,
          componentIndex,
        ),
      );
    }
  }
  return out;
}
