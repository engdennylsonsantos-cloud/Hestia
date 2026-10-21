import { dist, len, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';
import { isStair, type Id, type Project, type StairCurve, type StairLanding, type StairRun } from '@hestia/model';
import type { GripHold } from './selectGrips.ts';
import { updateStairComponents } from './stairCommands.ts';
import { stairEndpoints } from './stairPick.ts';
import { componentsPreview } from './stairPreview.ts';
import { CONNECT_TOL } from './stairStroke.ts';
import { discardSpiralOnEdit } from './stairSpiralRun.ts';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Cadeia de um componente: limites, espelhos (soltos), caminhada, ou o contorno do patamar. */
export type StairChainKey = 'boundaryLeft' | 'boundaryRight' | 'risers' | 'path' | 'boundary';

/**
 * Alça de uma escada selecionada: uma extremidade de curva (`a` ou `b`) ou o meio de um arco (`mid`, muda a flecha).
 * `part` é o índice do componente em `Stair.components`.
 */
export interface StairGrip {
  stairId: Id;
  part: number;
  key: StairChainKey;
  index: number;
  end: 'a' | 'b' | 'mid';
  at: Vec2;
}

type Component = StairRun | StairLanding;

const keysOf = (c: Component): StairChainKey[] => (c.kind === 'landing' ? ['boundary'] : ['boundaryLeft', 'boundaryRight', 'risers', 'path']);

function chainOf(c: Component, key: StairChainKey): StairCurve[] | null {
  if (c.kind === 'landing') return key === 'boundary' ? c.boundary : null;
  if (key === 'boundary') return null;
  return c[key];
}

/** Ponto do meio do arco (a flecha sai para a esquerda de a→b, como em `arcFromSagitta`). */
export function arcApex(c: StairCurve): Vec2 {
  const m = { x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 };
  if (Math.abs(c.sag) < 1e-9) return m;
  const d = sub(c.b, c.a);
  const l = len(d);
  if (l < 1e-12) return m;
  return { x: m.x - (d.y / l) * c.sag, y: m.y + (d.x / l) * c.sag };
}

/** Alça sob o cursor entre as escadas selecionadas: extremidades primeiro, depois o meio dos arcos. */
export function stairGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): StairGrip | null {
  const tol = 9 * mpp;
  const stairs = ids.map((id) => p.elements[id]).filter(isStair);
  for (const s of stairs) {
    for (let part = 0; part < s.components.length; part++) {
      const comp = s.components[part]!;
      for (const key of keysOf(comp)) {
        const chain = chainOf(comp, key) ?? [];
        for (let index = 0; index < chain.length; index++) {
          for (const end of ['a', 'b'] as const) {
            const q = chain[index]![end];
            if (dist(q, at) <= tol) return { stairId: s.id, part, key, index, end, at: q };
          }
        }
      }
    }
  }
  for (const s of stairs) {
    for (let part = 0; part < s.components.length; part++) {
      const comp = s.components[part]!;
      for (const key of keysOf(comp)) {
        const chain = chainOf(comp, key) ?? [];
        for (let index = 0; index < chain.length; index++) {
          const c = chain[index]!;
          if (Math.abs(c.sag) < 1e-6) continue;
          const m = arcApex(c);
          if (dist(m, at) <= tol) return { stairId: s.id, part, key, index, end: 'mid', at: m };
        }
      }
    }
  }
  return null;
}

/**
 * Componentes com a alça movida para `pt`. Em cadeias (limites, caminhada, contorno), a extremidade vizinha que coincide
 * com a original acompanha, para a cadeia continuar contínua. Não muta a entrada: devolve cópias.
 */
export function applyStairGrip(cs: Component[], g: Pick<StairGrip, 'part' | 'key' | 'index' | 'end'>, pt: Vec2): Component[] {
  const out = cs.map(copyComponent);
  const comp = out[g.part];
  if (!comp) return out;
  const chain = chainOf(comp, g.key);
  const cur = chain?.[g.index];
  if (!chain || !cur) return out;
  if (g.end === 'mid') {
    chain[g.index] = { ...cur, sag: sagFromThreePoints(cur.a, pt, cur.b) };
    return out;
  }
  const old = cur[g.end];
  chain[g.index] = g.end === 'a' ? { ...cur, a: pt } : { ...cur, b: pt };
  if (g.key === 'risers') return out;
  if (g.end === 'a' && g.index > 0) {
    const prev = chain[g.index - 1]!;
    if (dist(prev.b, old) <= CONNECT_TOL) chain[g.index - 1] = { ...prev, b: pt };
  }
  if (g.end === 'b' && g.index < chain.length - 1) {
    const next = chain[g.index + 1]!;
    if (dist(next.a, old) <= CONNECT_TOL) chain[g.index + 1] = { ...next, a: pt };
  }
  return out;
}

function copyCurves(cs: StairCurve[]): StairCurve[] {
  return cs.map((c) => ({ a: { ...c.a }, b: { ...c.b }, sag: c.sag }));
}

function copyComponent(c: Component): Component {
  if (c.kind === 'landing') return { ...c, boundary: copyCurves(c.boundary) };
  return { ...c, boundaryLeft: copyCurves(c.boundaryLeft), boundaryRight: copyCurves(c.boundaryRight), risers: copyCurves(c.risers), path: copyCurves(c.path) };
}

/**
 * Alça de escada como `GripHold`: arrastar mostra a escada nova (e a antiga tracejada); soltar grava por `updateElements`
 * em uma transação. Croqui com erro de geometria é recusado com o motivo na barra de status.
 */
export function stairHold(env: ToolEnv, g: StairGrip): GripHold {
  let point: Vec2 = g.at;
  return {
    at: g.at,
    keepsFocus: false,
    drag(p, snap): PreviewItem[] {
      const s = env.project().elements[g.stairId];
      if (!isStair(s)) return [];
      const others = stairEndpoints(s).filter((q) => dist(q, g.at) > 1e-9);
      point = g.end === 'mid' ? p.raw : snap({ extraPoints: others });
      const next = applyStairGrip(s.components, g, point);
      return [...componentsPreview(s.components, true), ...componentsPreview(next)];
    },
    release(): void {
      const s = env.project().elements[g.stairId];
      if (!isStair(s) || dist(point, g.at) < 1e-9) return;
      // Alça comum = edição à mão: se mudar limite ou espelho de um caracol, ele perde `spiral` (decisão 0014 §2).
      const next = discardSpiralOnEdit(s.components, applyStairGrip(s.components, g, point));
      const r = updateStairComponents(env, g.stairId, next);
      env.say('error' in r ? `Não é possível mover a alça: ${r.error}` : 'Alça ajustada. Ctrl+Z desfaz.');
    },
  };
}

/** Pontos de alça das escadas selecionadas (extremidades e meio dos arcos), para o indicador no hover. */
export function stairHandlePreview(p: Project, ids: Id[]): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of ids) {
    const s = p.elements[id];
    if (!isStair(s)) continue;
    for (const q of stairEndpoints(s)) out.push({ kind: 'point', at: q });
    for (const comp of s.components) {
      for (const key of keysOf(comp)) {
        for (const c of chainOf(comp, key) ?? []) if (Math.abs(c.sag) >= 1e-6) out.push({ kind: 'point', at: arcApex(c) });
      }
    }
  }
  return out;
}
