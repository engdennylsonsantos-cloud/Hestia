import { dist, type Vec2 } from '@hestia/geom';
import { gridOf } from '@hestia/model';
import { gridGripAt, gridPreviewItems, gridWithGrip, type GridGrip } from './gridGeom.ts';
import type { GripHold } from './selectGrips.ts';
import type { ToolEnv } from './types.ts';

/** Alça de grade: arrastar uma ponta/vértice muda o ponto; o meio do arco muda a flecha. Recusa do modelo vira mensagem. */
export function gridHold(env: ToolEnv, grip: GridGrip): GripHold {
  let to: Vec2 = grip.at;
  return {
    at: grip.at,
    keepsFocus: false,
    drag(p, snap) {
      const g = gridOf(env.project(), grip.id);
      if (!g) return [];
      // O meio do arco segue o cursor cru (a flecha é contínua); as pontas usam a captura.
      to = grip.kind === 'mid' ? p.raw : snap({});
      return [...gridPreviewItems(g), ...gridPreviewItems({ ...g, ...gridWithGrip(g, grip, to) }, false)];
    },
    release() {
      const g = gridOf(env.project(), grip.id);
      if (!g || dist(to, grip.at) < 1e-6) return;
      try {
        env.transaction('Editar grade', () => env.exec({ type: 'updateGrid', id: g.id, patch: gridWithGrip(g, grip, to) }));
      } catch (e) {
        env.say(e instanceof Error ? e.message : String(e));
      }
    },
  };
}

/** Provedor de alças das grades selecionadas (registrado em `gripProviders`). */
export const gridGripProvider = (env: ToolEnv, at: Vec2): GripHold | null => {
  const g = gridGripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? gridHold(env, g) : null;
};
