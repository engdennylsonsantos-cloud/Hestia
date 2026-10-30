import { dist, type Vec2 } from '@hestia/geom';
import { isStair, type Id, type Project, type Stair } from '@hestia/model';
import type { SpiralParams } from '@hestia/engine';
import type { InferContext } from './infer.ts';
import type { GripHold } from './selectGrips.ts';
import { stairLimits, updateStairComponents } from './stairCommands.ts';
import { stairEndpoints } from './stairPick.ts';
import { componentsPreview, treadItems } from './stairPreview.ts';
import { partsFromComponents } from './stairSketchState.ts';
import { clampSweepKeepSign, polarPoint, regenSpiralComponents, spiralAt, wrapAngle, type StairComponent } from './stairSpiralRun.ts';
import type { PointerInfo, PreviewItem, ToolEnv } from './types.ts';

/**
 * Alças do caracol (decisão 0014 §1 item 2): centro (move o conjunto), raio externo, raio interno, ângulo inicial (gira
 * tudo, mantém a varredura) e ângulo final (muda a varredura, até 720°, mínimo 30°). Cada arraste regenera o croqui com
 * `generateSpiralRun` (N pela altura, como na criação) e grava em UMA transação ao soltar. Têm prioridade sobre as alças
 * comuns da escada (`selectGrips.ts`).
 */

export type SpiralHandle = 'center' | 'outer' | 'inner' | 'start' | 'sweep';

const HANDLES: SpiralHandle[] = ['center', 'outer', 'inner', 'start', 'sweep'];

/** Alça de um caracol: o lance `part` (índice em `components`) da escada `stairId`, e o ponto da alça. */
export interface SpiralGrip {
  stairId: Id;
  part: number;
  handle: SpiralHandle;
  at: Vec2;
}

/**
 * Posição das alças: raio externo e interno no meio da varredura; ângulo inicial na borda externa do 1º espelho e ângulo
 * final na borda externa do último.
 */
export function spiralHandlePoints(sp: SpiralParams): Record<SpiralHandle, Vec2> {
  const { center: c, rInner, rOuter, startAngle: a0, sweep } = sp;
  return {
    center: c,
    outer: polarPoint(c, rOuter, a0 + sweep / 2),
    inner: polarPoint(c, rInner, a0 + sweep / 2),
    start: polarPoint(c, rOuter, a0),
    sweep: polarPoint(c, rOuter, a0 + sweep),
  };
}

/** Alças de todos os caracóis de uma escada. */
export function spiralHandles(s: Stair): SpiralGrip[] {
  const out: SpiralGrip[] = [];
  s.components.forEach((c, part) => {
    if (c.kind !== 'run' || !c.spiral) return;
    const pts = spiralHandlePoints(c.spiral);
    for (const handle of HANDLES) out.push({ stairId: s.id, part, handle, at: pts[handle] });
  });
  return out;
}

/** Alça de caracol sob o cursor, entre as escadas selecionadas: a mais próxima, dentro de 9 px. */
export function spiralGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): SpiralGrip | null {
  const tol = 9 * mpp;
  let best: SpiralGrip | null = null;
  let bestD = Infinity;
  for (const id of ids) {
    const s = p.elements[id];
    if (!isStair(s)) continue;
    for (const g of spiralHandles(s)) {
      const d = dist(g.at, at);
      if (d <= tol && d < bestD) {
        best = g;
        bestD = d;
      }
    }
  }
  return best;
}

/** Ângulo do vetor c→q (rad). */
const angleFrom = (c: Vec2, q: Vec2): number => Math.atan2(q.y - c.y, q.x - c.x);

/** Mesmos parâmetros (sem arraste útil): solta sem gravar. */
function sameParams(a: SpiralParams, b: SpiralParams): boolean {
  return a.center.x === b.center.x && a.center.y === b.center.y && a.rInner === b.rInner && a.rOuter === b.rOuter && a.startAngle === b.startAngle && a.sweep === b.sweep;
}

/** Altura do espelho do caracol regenerado (H ÷ N), para a prévia dos degraus; null sem altura. */
function riserHeightOf(p: Project, s: Stair, comps: StairComponent[], part: number): number | null {
  const lim = stairLimits(p, s);
  const run = comps[part];
  if (!lim || !(lim.H > 0) || run?.kind !== 'run' || run.risers.length === 0) return null;
  return lim.H / run.risers.length;
}

/** Parâmetros novos com a alça `handle` levada ao ponto `raw` (ou ao `snap`, no centro). Ângulos acumulam pelo arraste. */
function moveHandle(
  handle: SpiralHandle,
  cur: SpiralParams,
  pt: PointerInfo,
  snap: (extra: Partial<InferContext>) => Vec2,
  ctx: { stair: Stair; grabbed: Vec2; prevAngle: number },
): { params: SpiralParams; prevAngle: number } {
  const raw = pt.raw;
  switch (handle) {
    case 'center': {
      const others = stairEndpoints(ctx.stair).filter((q) => dist(q, ctx.grabbed) > 1e-9);
      return { params: { ...cur, center: snap({ extraPoints: others }) }, prevAngle: ctx.prevAngle };
    }
    case 'outer':
      return { params: { ...cur, rOuter: dist(raw, cur.center) }, prevAngle: ctx.prevAngle };
    case 'inner':
      return { params: { ...cur, rInner: dist(raw, cur.center) }, prevAngle: ctx.prevAngle };
    case 'start': {
      const th = angleFrom(cur.center, raw);
      return { params: { ...cur, startAngle: cur.startAngle + wrapAngle(th - ctx.prevAngle) }, prevAngle: th };
    }
    case 'sweep': {
      const th = angleFrom(cur.center, raw);
      return { params: { ...cur, sweep: clampSweepKeepSign(cur.sweep, cur.sweep + wrapAngle(th - ctx.prevAngle)) }, prevAngle: th };
    }
  }
}

/**
 * Alça de caracol como `GripHold`: arrastar mostra o caracol novo (e o antigo tracejado); soltar grava por `updateElements`
 * em uma transação. Erro de raio, varredura ou croqui é recusado com o motivo na barra de status.
 */
export function spiralHold(env: ToolEnv, g: SpiralGrip): GripHold {
  const s0 = env.project().elements[g.stairId];
  const start = isStair(s0) ? spiralAt(s0, g.part) : null;
  let cur: SpiralParams | null = start;
  let prevAngle = start ? angleFrom(start.center, g.at) : 0;
  return {
    at: g.at,
    keepsFocus: false,
    drag(p, snap) {
      const s = env.project().elements[g.stairId];
      if (!isStair(s) || !cur) return [];
      const moved = moveHandle(g.handle, cur, p, snap, { stair: s, grabbed: g.at, prevAngle });
      cur = moved.params;
      prevAngle = moved.prevAngle;
      const items: PreviewItem[] = componentsPreview(s.components, true);
      const reg = regenSpiralComponents(env.project(), s, g.part, cur);
      if ('error' in reg) return items;
      items.push(...componentsPreview(reg.components));
      const h = riserHeightOf(env.project(), s, reg.components, g.part);
      if (h !== null) {
        const p = env.project();
        // Caracol é estilo poste (sem chegada); o contexto mantém a prévia igual à escada gravada se o tipo for outro.
        const risers = reg.components.reduce((n, c) => n + (c.kind === 'run' ? c.risers.length : 0), 0);
        items.push(...treadItems(partsFromComponents(reg.components), { project: p, type: p.stairTypes[s.typeId] ?? null, topLevelId: s.topLevelId, risers, riserHeight: h }));
      }
      return items;
    },
    release(): void {
      const s = env.project().elements[g.stairId];
      if (!isStair(s) || !start || !cur || sameParams(start, cur)) return;
      const reg = regenSpiralComponents(env.project(), s, g.part, cur);
      if ('error' in reg) return env.say(`Não é possível mover a alça: ${reg.error}`);
      const r = updateStairComponents(env, g.stairId, reg.components);
      env.say('error' in r ? `Não é possível mover a alça: ${r.error}` : 'Alça do caracol ajustada. Ctrl+Z desfaz.');
    },
  };
}

/** Pontos de alça do caracol das escadas selecionadas (indicador no hover). */
export function spiralHandlePreview(p: Project, ids: Id[]): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of ids) {
    const s = p.elements[id];
    if (!isStair(s)) continue;
    for (const g of spiralHandles(s)) out.push({ kind: 'point', at: g.at });
  }
  return out;
}
