import type { Camera, Object3D } from 'three';
import { pickLevel } from '@hestia/render';
import { useUi } from '../editor/state.ts';

/**
 * Clique numa linha de nível no 3D: abre o diálogo de níveis com aquele destacado (como no Revit) e devolve `true`. Fora de
 * uma linha, devolve `false` e o chamador segue com a seleção normal de elemento. `rect` é o retângulo do canvas em px.
 */
export function abrirNivelNoClique(
  scene: Object3D,
  camera: Camera,
  rect: { width: number; height: number },
  at: { x: number; y: number },
): boolean {
  const level = pickLevel(scene, camera, { x: (at.x / rect.width) * 2 - 1, y: 1 - (at.y / rect.height) * 2 });
  if (!level) return false;
  useUi.setState({ dialog: 'levels', dialogArg: level.levelId });
  return true;
}
