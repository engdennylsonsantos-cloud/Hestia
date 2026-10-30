import { pickLevel, type ModelScene } from '@hestia/render';
import { editor } from '../editor/controller.ts';
import { selectLevel } from '../editor/state.ts';

/**
 * Clique no datum do nível no 3D (linha, bolha, texto ou plano de seleção): seleciona o nível e reaplica o datum à cena,
 * sem abrir diálogo. Devolve `false` quando o clique não atingiu um nível; aí o chamador segue com a seleção de elemento.
 * `rect` é o retângulo do canvas em px e `at` o ponto do ponteiro dentro dele.
 */
export function selecionarNivelNoClique(
  scene: ModelScene,
  rect: { width: number; height: number },
  at: { x: number; y: number },
): boolean {
  const level = pickLevel(scene.scene, scene.orbit.camera, { x: (at.x / rect.width) * 2 - 1, y: 1 - (at.y / rect.height) * 2 });
  if (!level) return false;
  selectLevel(level.levelId);
  scene.selecionarNivel(editor.project, level.levelId);
  return true;
}
