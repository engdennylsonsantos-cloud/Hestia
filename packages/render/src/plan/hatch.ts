import type { Polygon, Vec2 } from '@hestia/geom';
import type { HatchKind } from '@hestia/model';

/** Espaçamento entre linhas paralelas da hachura, em metros (o mesmo passo do padrão anterior de 16 px por 0,2 m). */
export const HATCH_SPACING = 0.05;
/** Espessura das linhas de hachura, em pixels de tela: não engrossa nem afina com o zoom. */
export const HATCH_PX = 1;
/** Espessura e comprimento do ponto do padrão `dots`. */
export const DOT_PX = 2;
const DOT_LEN = 0.0125;
/** Trecho pintado do tracejado `gesso` (10 px de 16 px do padrão anterior, em metros). */
const GESSO_ON = (10 / 16) * HATCH_SPACING;

/** Segmento de hachura em metros. `dot` marca um ponto (traço curto de `DOT_PX`) em vez de uma linha de `HATCH_PX`. */
export interface HatchSegment {
  a: Vec2;
  b: Vec2;
  dot?: boolean;
}

const cache = new WeakMap<Polygon, Map<HatchKind, HatchSegment[]>>();

/**
 * Hachura vetorial de um contorno: segmentos recortados à região (regra par-ímpar, então furos ficam vazios), em metros.
 * `solid` não tem linhas: é só a cor de preenchimento, desenhada pelo chamador. Resultado por contorno fica em cache, com
 * a mesma identidade que o triangulado de `gpuPlan` usa.
 */
export function hatchSegments(poly: Polygon, kind: HatchKind): HatchSegment[] {
  if (kind === 'none' || kind === 'solid') return [];
  let byKind = cache.get(poly);
  if (!byKind) {
    byKind = new Map();
    cache.set(poly, byKind);
  }
  let out = byKind.get(kind);
  if (!out) {
    out = build(poly, kind);
    byKind.set(kind, out);
  }
  return out;
}

function build(poly: Polygon, kind: HatchKind): HatchSegment[] {
  const out: HatchSegment[] = [];
  const line = (a: Vec2, b: Vec2): void => {
    out.push({ a, b });
  };
  if (kind === 'diagonal') scanLines(poly, Math.PI / 4, HATCH_SPACING, line);
  if (kind === 'cross') {
    scanLines(poly, Math.PI / 4, HATCH_SPACING, line);
    scanLines(poly, -Math.PI / 4, HATCH_SPACING, line);
  }
  if (kind === 'gesso') {
    scanLines(poly, 0, HATCH_SPACING, (a, b, _d, u0, u1) => {
      // Trechos pintados a cada passo: a linha horizontal é cortada em traços de GESSO_ON.
      for (let k = Math.floor(u0 / HATCH_SPACING); k * HATCH_SPACING < u1; k++) {
        const s = Math.max(u0, k * HATCH_SPACING);
        const e = Math.min(u1, k * HATCH_SPACING + GESSO_ON);
        if (e - s > 1e-9) line(pointAt(a, b, s, u0, u1), pointAt(a, b, e, u0, u1));
      }
    });
  }
  if (kind === 'dots') {
    scanLines(poly, 0, HATCH_SPACING, (a, b, _d, u0, u1) => {
      // Um ponto por passo, no meio do passo: a grade é a mesma das linhas, deslocada meio passo.
      for (let k = Math.floor(u0 / HATCH_SPACING); k * HATCH_SPACING < u1; k++) {
        const s = k * HATCH_SPACING + HATCH_SPACING / 2;
        if (s < u0 || s + DOT_LEN > u1) continue;
        out.push({ a: pointAt(a, b, s, u0, u1), b: pointAt(a, b, s + DOT_LEN, u0, u1), dot: true });
      }
    });
  }
  return out;
}

type Emit = (a: Vec2, b: Vec2, d: Vec2, u0: number, u1: number) => void;

/**
 * Linhas paralelas à direção `ang`, espaçadas em `spacing` (perpendicular). Para cada linha, as interseções com as arestas
 * de todos os anéis são ordenadas ao longo da direção e pareadas: o trecho entre a 1ª e a 2ª fica dentro, o seguinte fora.
 * Vértices exatamente sobre a linha contam pelo lado de baixo (regra de meia-aberta), para não duplicar nem perder cruzamentos.
 */
function scanLines(poly: Polygon, ang: number, spacing: number, emit: Emit): void {
  const d = { x: Math.cos(ang), y: Math.sin(ang) };
  const n = { x: -d.y, y: d.x };
  let lo = Infinity;
  let hi = -Infinity;
  for (const ring of poly) {
    for (const p of ring) {
      const s = p.x * n.x + p.y * n.y;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
  }
  if (!Number.isFinite(lo)) return;
  for (let k = Math.ceil(lo / spacing); k * spacing <= hi; k++) {
    const c = k * spacing;
    const us: number[] = [];
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]!;
        const q = ring[(i + 1) % ring.length]!;
        const s0 = p.x * n.x + p.y * n.y - c;
        const s1 = q.x * n.x + q.y * n.y - c;
        if ((s0 > 0) === (s1 > 0)) continue;
        const t = s0 / (s0 - s1);
        const x = p.x + (q.x - p.x) * t;
        const y = p.y + (q.y - p.y) * t;
        us.push(x * d.x + y * d.y);
      }
    }
    us.sort((x, y) => x - y);
    for (let j = 0; j + 1 < us.length; j += 2) {
      const u0 = us[j]!;
      const u1 = us[j + 1]!;
      if (u1 - u0 < 1e-9) continue;
      const a = { x: n.x * c + d.x * u0, y: n.y * c + d.y * u0 };
      const b = { x: n.x * c + d.x * u1, y: n.y * c + d.y * u1 };
      emit(a, b, d, u0, u1);
    }
  }
}

/** Ponto na linha `a`→`b` (extremos de `u0`..`u1`) no parâmetro `u`, em metros. */
function pointAt(a: Vec2, b: Vec2, u: number, u0: number, u1: number): Vec2 {
  const t = (u - u0) / (u1 - u0);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
