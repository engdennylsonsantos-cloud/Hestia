import { resolveLevel } from '@hestia/engine';
import { DEFAULT_VIEW_3D, type OpeningType, type Project, type View3DSettings } from '@hestia/model';
import { ModelScene } from '@hestia/render';
import { applyPreviewCamera, previewCamera } from './previewCamera.ts';
import { previewOpening, previewProject } from './previewProject.ts';

/** Estilos das duas abas 3D do diálogo. */
export type Preview3DStyle = 'lines' | 'shaded';

const clampAngle = (angle: number): number => Math.max(0, Math.min(120, angle));

/** Vista 3D da prévia: esquadria aberta no `angle3d` do controle e o estilo da aba (linhas ou sombreado). */
export function previewView3d(style: Preview3DStyle): View3DSettings {
  return {
    ...DEFAULT_VIEW_3D,
    style: style === 'lines' ? 'hiddenLine' : 'shaded',
    edges: style === 'lines',
    shadows: false,
    openOpenings: true,
  };
}

/** Projeto de prévia com a vista 3D da aba (o modelo continua o mesmo; só a exibição muda). */
export function previewSceneProject(p: Project, style: Preview3DStyle): Project {
  return { ...p, view3d: previewView3d(style) };
}

/**
 * Cena Three mínima montada pelo MESMO construtor de cena do projeto (`ModelScene`) sobre o projeto de prévia. Não
 * precisa de canvas nem de WebGL: a parede e o furo vêm do pipeline real, com o sólido único por camada.
 */
export function buildPreviewScene(p: Project, style: Preview3DStyle = 'lines', dark = false): ModelScene {
  const project = previewSceneProject(p, style);
  const scene = new ModelScene({ instanciar: false });
  scene.update(
    project,
    project.levels.map((level) => resolveLevel(project, level.id)),
    { edges: style === 'lines', shadows: false, dark },
  );
  scene.fit();
  return scene;
}

/** Cena da prévia para o rascunho do tipo, com o ângulo do controle e os lados da instância. */
export function previewScene(
  type: OpeningType,
  style: Preview3DStyle,
  angle?: number,
  dark = false,
  flipHand = false,
  flipFacing = false,
): ModelScene {
  const withAngle: OpeningType = { ...type, angle3d: clampAngle(angle ?? type.angle3d ?? 90) };
  const project = previewProject(withAngle, flipHand, flipFacing);
  const scene = buildPreviewScene(project, style, dark);
  const opening = previewOpening(project);
  // Enquadra a esquadria (folha aberta e alizar), não a parede inteira: o vão ocupa ~70% da altura da prévia.
  if (opening) applyPreviewCamera(scene.orbit, previewCamera(project, opening));
  return scene;
}
