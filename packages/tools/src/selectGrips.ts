import { dist, sagFromThreePoints, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isFloor, isRoof, isSlab, isWall, type Id, type Project } from '@hestia/model';
import type { InferContext } from './infer.ts';
import { followingEnds, gripAt, type Grip } from './pick.ts';
import { floorGripAt, ringInsertAfter, ringMoveVertex } from './floorPick.ts';
import { slabGripAt } from './slabPick.ts';
import { roofGripAt } from './roofPick.ts';
import { roofRingPatch } from './roofEdges.ts';
import { commitRoofPatch } from './roofCheck.ts';
import { slopeArrowLength, slopePreview } from './slabSlope.ts';
import { stairGripAt, stairHold } from './stairGrips.ts';
import type { PointerInfo, PreviewItem, ToolEnv } from './types.ts';

/** Vértice de contorno em foco (clicado com a alça): o Delete o remove. */
export interface GripFocus {
  id: Id;
  index: number;
}

/** Alça pressionada ou sob o cursor. A ferramenta de seleção só a manipula por esta interface. */
export interface GripHold {
  /** Ponto da alça (indicador de captura no hover). */
  readonly at: Vec2;
  /** Vértice de contorno: o foco segue como estava até o próximo clique. Alças de parede não mexem no foco. */
  readonly keepsFocus: boolean;
  /** Prévia do arrasto. `snap` captura o cursor e devolve o ponto (só as alças que capturam chamam). */
  drag(p: PointerInfo, snap: (extra: Partial<InferContext>) => Vec2): PreviewItem[];
  /** Ao soltar: grava a mudança; sem arrasto, um vértice de contorno vai para o foco. */
  release(p: PointerInfo, setFocus: (f: GripFocus) => void): void;
}

/**
 * Provedor de alças: devolve a alça de um tipo de elemento sob `at`, entre a seleção, ou null.
 * Pontos de extensão: `gripProviders` (ordem = prioridade). Para alças de outro elemento, acrescente um provedor.
 */
export type GripProvider = (env: ToolEnv, at: Vec2) => GripHold | null;

/** Contorno editável por alças (piso, laje ou telhado). `boundary` é null se o elemento não é deste tipo. */
interface RingOwner {
  boundary(p: Project, id: Id): Vec2[] | null;
  /** Grava o contorno novo. `insertEdge` é a aresta de um vértice novo (só o telhado usa: balanço e inclinação por aresta). */
  commit(env: ToolEnv, id: Id, ring: Vec2[], insertEdge: number | null): void;
}

const commitBoundary = (env: ToolEnv, id: Id, ring: Vec2[]): void => env.exec({ type: 'updateElements', ids: [id], patch: { boundary: ring } });

const FLOOR_OWNER: RingOwner = {
  boundary: (p, id) => {
    const f = p.elements[id];
    return isFloor(f) ? f.boundary : null;
  },
  commit: (env, id, ring) => commitBoundary(env, id, ring),
};

const SLAB_OWNER: RingOwner = {
  boundary: (p, id) => {
    const s = p.elements[id];
    return isSlab(s) ? s.boundary : null;
  },
  commit: (env, id, ring) => commitBoundary(env, id, ring),
};

const ROOF_OWNER: RingOwner = {
  boundary: (p, id) => {
    const r = p.elements[id];
    return isRoof(r) ? r.boundary : null;
  },
  commit: (env, id, ring, insertEdge) => {
    const r = env.project().elements[id];
    if (isRoof(r)) commitRoofPatch(env, [id], roofRingPatch(r, ring, insertEdge === null ? null : { kind: 'insert', edge: insertEdge }));
  },
};

/** Contorno com o vértice `index` levado a `pt`, ou com um vértice novo logo depois dele (meio da aresta). */
const ringAfter = (ring: Vec2[], vertex: boolean, index: number, pt: Vec2): Vec2[] => (vertex ? ringMoveVertex(ring, index, pt) : ringInsertAfter(ring, index, pt));

/** Alça de parede: extremidade `a` ou `b` (arrasta o nó e as vizinhas que acompanham) ou o meio do arco (muda a flecha). */
function wallHold(env: ToolEnv, g: Grip): GripHold {
  let point: Vec2 | null = null;
  return {
    at: g.at,
    keepsFocus: false,
    drag(p, snap) {
      const pr = env.project();
      const w = pr.elements[g.wallId];
      if (!isWall(w)) return [];
      const f = frameOfWall(pr, w.id);
      const items: PreviewItem[] = [];
      if (g.end === 'mid') {
        // Alça do meio do arco: o arco passa a atravessar o cursor.
        point = p.raw;
        if (f) items.push({ kind: 'wallBand', a: w.a, b: w.b, thickness: f.thickness, sMid: f.sMid, sag: sagFromThreePoints(w.a, p.raw, w.b) });
        return items;
      }
      const other = g.end === 'a' ? w.b : w.a;
      const inf = snap({ from: other, ignore: new Set([w.id]) });
      point = inf;
      if (f) {
        const a = g.end === 'a' ? inf : w.a;
        const b = g.end === 'b' ? inf : w.b;
        items.push({ kind: 'wallBand', a, b, thickness: f.thickness, sMid: f.sMid, sag: w.sag });
      }
      // Vizinhas que vão acompanhar (canto simples; Alt inverte): aparecem na prévia para não haver surpresa.
      for (const c of followingEnds(pr, env.levelId(), g.at, new Set([w.id]), p.alt)) {
        const nw = pr.elements[c.wallId];
        const nf = frameOfWall(pr, c.wallId);
        if (!isWall(nw) || !nf) continue;
        items.push({ kind: 'wallBand', a: c.end === 'a' ? inf : nw.a, b: c.end === 'b' ? inf : nw.b, thickness: nf.thickness, sMid: nf.sMid, sag: nw.sag });
      }
      return items;
    },
    release(p) {
      if (!point) return;
      const pr = env.project();
      const wall = pr.elements[g.wallId];
      if (g.end === 'mid') {
        if (isWall(wall)) env.exec({ type: 'updateElements', ids: [g.wallId], patch: { sag: sagFromThreePoints(wall.a, point, wall.b) } });
        return;
      }
      const pt = point;
      const follow = followingEnds(pr, env.levelId(), g.at, new Set([g.wallId]), p.alt);
      env.transaction('Ajustar parede', () => {
        env.exec({ type: 'setWallEnds', id: g.wallId, [g.end]: pt });
        for (const c of follow) env.exec({ type: 'setWallEnds', id: c.wallId, [c.end]: pt });
      });
    },
  };
}

/** Alça de vértice ou de meio de aresta de um contorno (piso, laje ou telhado). */
function ringHold(env: ToolEnv, owner: RingOwner, id: Id, g: { kind: 'vertex' | 'edge'; index: number; at: Vec2 }): GripHold {
  const vertex = g.kind === 'vertex';
  let point: Vec2 | null = g.at;
  return {
    at: g.at,
    keepsFocus: true,
    drag(_p, snap) {
      const ring = owner.boundary(env.project(), id);
      if (!ring) return [];
      // Snap aos outros vértices do próprio contorno (o vértice arrastado não se captura a si mesmo).
      const inf = snap({ extraPoints: vertex ? ring.filter((_, i) => i !== g.index) : ring });
      point = inf;
      return [{ kind: 'polygon', ring, dashed: true }, { kind: 'polygon', ring: ringAfter(ring, vertex, g.index, inf) }];
    },
    release(_p, setFocus) {
      const ring = owner.boundary(env.project(), id);
      if (!point || !ring) return;
      if (dist(point, g.at) > 1e-6) owner.commit(env, id, ringAfter(ring, vertex, g.index, point), vertex ? null : g.index);
      else if (vertex) {
        // Clique sem arrastar num vértice: fica em foco para o Delete.
        setFocus({ id, index: g.index });
        env.say('Vértice em foco: Delete o remove (mínimo de 3).');
      }
    },
  };
}

const wallGrip: GripProvider = (env, at) => {
  const g = gripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? wallHold(env, g) : null;
};

const floorGrip: GripProvider = (env, at) => {
  const g = floorGripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? ringHold(env, FLOOR_OWNER, g.floorId, g) : null;
};

const slabGrip: GripProvider = (env, at) => {
  const g = slabGripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? ringHold(env, SLAB_OWNER, g.slabId, g) : null;
};

const roofGrip: GripProvider = (env, at) => {
  const g = roofGripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? ringHold(env, ROOF_OWNER, g.roofId, g) : null;
};

/** Alça de escada selecionada: extremidade de limite, espelho ou caminhada, ou meio de arco (`stairGrips.ts`). */
const stairGrip: GripProvider = (env, at) => {
  const g = stairGripAt(env.project(), env.selection(), at, env.metersPerPixel());
  return g ? stairHold(env, g) : null;
};

/** Registro de provedores de alça, em ordem de prioridade (o primeiro que acerta vence). */
export const gripProviders: GripProvider[] = [wallGrip, stairGrip, floorGrip, slabGrip, roofGrip];

/** Alça sob o cursor entre os elementos selecionados, por ordem de `gripProviders`. */
export function gripHoldAt(env: ToolEnv, at: Vec2): GripHold | null {
  for (const provide of gripProviders) {
    const hold = provide(env, at);
    if (hold) return hold;
  }
  return null;
}

/** Alças desenhadas no piso, laje ou telhado selecionado (vértices e meio das arestas), com o foco e a seta de caimento. */
export function ringHandlePreview(p: Project, sel: Id[], focus: GripFocus | null): PreviewItem[] {
  const f = sel.length === 1 ? p.elements[sel[0]!] : undefined;
  if (!(isFloor(f) || isSlab(f) || isRoof(f))) return [];
  const items: PreviewItem[] = [];
  const n = f.boundary.length;
  for (let i = 0; i < n; i++) {
    const a = f.boundary[i]!;
    const b = f.boundary[(i + 1) % n]!;
    items.push({ kind: 'point', at: a }, { kind: 'point', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }
  if (focus?.id === f.id && f.boundary[focus.index]) items.push({ kind: 'highlight', ids: [f.id] });
  // Laje com inclinação: a seta do caimento fica visível enquanto ela está selecionada.
  if (isSlab(f) && f.slope) items.push(...slopePreview(f.slope, slopeArrowLength(f.boundary)));
  return items;
}
