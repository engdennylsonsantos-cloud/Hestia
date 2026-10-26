import { wallBaseElevation, wallMaxHeight, type Project } from '@hestia/model';
import type { WallFrame } from './frame.ts';

/**
 * Faixa vertical de cada parede (base e topo, sem o ajuste por piso e telhado), para a junção só unir paredes que se
 * encontram em altura (J-04). Não resolve pisos aqui: levelFrames é chamado por eles e isso faria um ciclo.
 * Quadros são construídos a cada chamada: anota no próprio objeto (copiar quebraria a identidade usada pela junção).
 */
export function withWallZ(p: Project, frames: WallFrame[]): WallFrame[] {
  for (const f of frames) {
    const z0 = wallBaseElevation(p, f.wall);
    f.z = { z0, top: z0 + wallMaxHeight(p, f.wall) };
  }
  return frames;
}
