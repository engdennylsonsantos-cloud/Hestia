import { dist, type Vec2 } from '@hestia/geom';
import { regenStairFree } from '@hestia/engine';
import { isStair, type Id, type Project } from '@hestia/model';
import type { GripHold } from './selectGrips.ts';
import { componentsPreview } from './stairPreview.ts';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Alça de uma escada livre selecionada: um vértice do `freePath`. */
export interface StairFreeGrip {
  stairId: Id;
  /** Índice do vértice em `Stair.freePath`. */
  index: number;
  at: Vec2;
}

/** Alça de vértice sob o cursor entre as escadas livres selecionadas. */
export function stairFreeGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): StairFreeGrip | null {
  const tol = 9 * mpp;
  for (const id of ids) {
    const s = p.elements[id];
    if (!isStair(s) || !s.freePath) continue;
    for (let index = 0; index < s.freePath.length; index++) {
      const q = s.freePath[index]!;
      if (dist(q, at) <= tol) return { stairId: s.id, index, at: q };
    }
  }
  return null;
}

/**
 * Alça de vértice como `GripHold`: arrastar mostra a escada regenerada (e a antiga tracejada); soltar grava os
 * componentes, o `freePath` e os patamares manuais novos em UMA transação ("Mover vértice da escada"). Trajeto que o
 * motor recusa não grava e mostra o motivo na barra de status.
 */
export function stairFreeHold(env: ToolEnv, g: StairFreeGrip): GripHold {
  let point: Vec2 = g.at;
  return {
    at: g.at,
    keepsFocus: false,
    drag(_p, snap): PreviewItem[] {
      const s = env.project().elements[g.stairId];
      if (!isStair(s) || !s.freePath) return [];
      point = snap({ extraPoints: s.freePath.filter((_, i) => i !== g.index) });
      const res = regenStairFree(s, env.project(), { freePath: s.freePath.map((v, i) => (i === g.index ? point : v)) });
      return [...componentsPreview(s.components, true), ...('error' in res ? [] : componentsPreview(res.components))];
    },
    release(): void {
      const p = env.project();
      const s = p.elements[g.stairId];
      if (!isStair(s) || !s.freePath || dist(point, g.at) < 1e-9) return;
      const res = regenStairFree(s, p, { freePath: s.freePath.map((v, i) => (i === g.index ? point : v)) });
      if ('error' in res) {
        env.say(`Não é possível mover o vértice: ${res.error}`);
        return;
      }
      env.transaction('Mover vértice da escada', () =>
        env.exec({
          type: 'updateElements',
          ids: [g.stairId],
          patch: { components: res.components, freePath: res.freePath, manualLandings: res.manualLandings },
        }),
      );
      env.say('Vértice movido. Ctrl+Z desfaz.');
    },
  };
}

/** Pontos de alça (vértices do trajeto) das escadas livres selecionadas, para o indicador no hover. */
export function stairFreeHandlePreview(p: Project, ids: Id[]): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of ids) {
    const s = p.elements[id];
    if (isStair(s) && s.freePath) for (const q of s.freePath) out.push({ kind: 'point', at: q });
  }
  return out;
}
