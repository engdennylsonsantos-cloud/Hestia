import type { Vec2 } from '@hestia/geom';
import { coreSpan, type Id, type Project } from '@hestia/model';
import { sAtDepth } from './frame.ts';
import { computeEnds } from './joins.ts';
import { endPoint } from './layerGeom.ts';
import { levelFrames } from './resolve.ts';

export type Seg = [Vec2, Vec2];

/** Faces de uma parede para captura (snap): arestas das faces de acabamento, do núcleo e das pontas, já esquadrejadas. */
export interface WallFaces {
  wallId: Id;
  /** Arestas das faces de acabamento (os dois lados) e das pontas livres. */
  faces: Seg[];
  /** Arestas das faces do núcleo (estrutura). */
  core: Seg[];
}

/**
 * Geometria das faces de todas as paredes do nível, com os cantos das junções (esquadria, encosto, T) como o motor
 * os resolve. Barata: só `computeEnds` e alguns pontos por parede. Parede curva entrega só os pontos das pontas.
 */
export function wallFaces(p: Project, levelId: Id): WallFaces[] {
  const frames = levelFrames(p, levelId);
  const ends = computeEnds(frames, p.settings?.joinTolerance);
  return frames.map((f) => {
    const e = ends.get(f.wall.id)!;
    const cs = coreSpan(f.type);
    const line = (s: number): Seg => [endPoint(f, 'a', e.a, s), endPoint(f, 'b', e.b, s)];
    const cap = (which: 'a' | 'b'): Seg => [endPoint(f, which, which === 'a' ? e.a : e.b, f.sHi), endPoint(f, which, which === 'a' ? e.a : e.b, f.sLo)];
    const sCore = [sAtDepth(f, cs.from), sAtDepth(f, cs.to)];
    const sides = f.arc ? [] : [line(f.sHi), line(f.sLo)];
    const core = f.arc ? [] : sCore.map(line);
    return { wallId: f.wall.id, faces: [...sides, cap('a'), cap('b')], core };
  });
}
