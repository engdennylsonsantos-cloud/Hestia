import { endTangent, joinStatus, levelFrames, type WallFrame } from '@hestia/engine';
import type { Id, JoinKind, Project } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import type { LabelOp } from './types.ts';

/** Letra de cada tipo de junção de canto (B encosto, E esquadria). */
const JOIN_LETTER: Record<JoinKind, string> = { butt: 'B', miter: 'E' };
/** Mesmo critério do motor: ângulo entre as paredes abaixo de ~2° conta como colinear. */
const COLLINEAR_SIN = 0.035;
const DY = -10;

/** Direção que sai do nó, para dentro da parede, na extremidade `which`. */
const outward = (f: WallFrame, which: 'a' | 'b'): Vec2 => {
  const t = endTangent(f, which);
  return which === 'a' ? t : { x: -t.x, y: -t.y };
};
const cross = (p: Vec2, q: Vec2): number => p.x * q.y - p.y * q.x;
const dot = (p: Vec2, q: Vec2): number => p.x * q.x + p.y * q.y;

/**
 * Depuração de junção (G6): em cada extremidade com junção, uma etiqueta com a letra do tipo (B, E; T, X ou ★ nó;
 * N para "não unir") e a ordem de criação da parede dominante. Em par, domina a mais antiga, salvo `flip`.
 * Em T, domina a parede atravessada. Em nó de três ou mais, mostra a mais antiga do grupo.
 */
export function joinDebugLabels(p: Project, levelId: Id): LabelOp[] {
  const frames = levelFrames(p, levelId);
  const tol = p.settings.joinTolerance;
  const byId = new Map(frames.map((f) => [f.wall.id, f] as const));
  const seen = new Set<string>();
  const out: LabelOp[] = [];
  for (const f of frames) {
    for (const which of ['a', 'b'] as const) {
      const st = joinStatus(frames, f.wall.id, which, tol);
      if (st.kind === 'free') continue;
      const at = which === 'a' ? f.a : f.b;
      const key = `${at.x.toFixed(4)},${at.y.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let text: string;
      if (st.kind === 'disallowed') {
        text = `N·${f.wall.order}`;
      } else if (st.kind === 'pair') {
        const q = byId.get(st.partners[0]!.wallId)!;
        const qEnd = st.partners[0]!.end;
        const older = f.wall.order <= q.wall.order ? { g: f, e: which } : { g: q, e: qEnd };
        const younger = older.g === f ? q : f;
        const cfg = older.e === 'a' ? older.g.wall.joinStart : older.g.wall.joinEnd;
        const dominant = cfg.flip ? younger : older.g;
        text = `${JOIN_LETTER[cfg.kind]}·${dominant.wall.order}`;
      } else if (st.kind === 'tee') {
        text = `T·${byId.get(st.hostId)!.wall.order}`;
      } else {
        // Nó: T quando há um par colinear e três paredes; X com dois pares colineares e quatro; senão ★.
        const group: Array<{ dir: Vec2; order: number }> = [{ dir: outward(f, which), order: f.wall.order }];
        for (const pt of st.partners) {
          const g = byId.get(pt.wallId)!;
          group.push({ dir: outward(g, pt.end), order: g.wall.order });
        }
        let pairs = 0;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const di = group[i]!.dir;
            const dj = group[j]!.dir;
            if (Math.abs(cross(di, dj)) < COLLINEAR_SIN && dot(di, dj) < 0) pairs++;
          }
        }
        const n = group.length;
        const letter = n === 3 && pairs >= 1 ? 'T' : n === 4 && pairs === 2 ? 'X' : '★';
        text = `${letter}·${Math.min(...group.map((x) => x.order))}`;
      }
      out.push({ at, text, dy: DY, tone: 'accent' });
    }
  }
  return out;
}
