import type { ReactElement } from 'react';
import { editor } from '../editor/controller.ts';
import { useI18n } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';

/** Câmera 3D: só o que a barra de navegação usa (a classe real fica em `ViewportCanvas`). */
interface Camera3d {
  fit: () => void;
  orbit: { zoom: (delta: number) => void };
}

/**
 * Barra de navegação (canto da vista, como no Revit): roda de navegação (ainda não disponível), aproximar, afastar e
 * enquadrar tudo. No 3D fica logo abaixo do ViewCube.
 */
export function NavBar({ model, center }: { model: Camera3d; center: () => { x: number; y: number } }): ReactElement {
  const view = useUi((s) => s.view);
  const pt = useI18n((s) => s.lang) === 'pt';
  const zoom = (dir: 1 | -1): void => (view === '3d' ? model.orbit.zoom(-dir * 240) : editor.zoomWheel(center(), -dir * 240));
  const fit = (): void => {
    if (view === '3d') {
      model.fit();
      useUi.setState((x) => ({ previewTick: x.previewTick + 1 }));
    } else editor.zoomExtents();
  };
  return (
    <div className={`navbar${view === '3d' ? ' below-cube' : ''}`} role="toolbar" aria-label={pt ? 'Barra de navegação' : 'Navigation bar'}>
      <button disabled className="soon" title={`${pt ? 'Roda de navegação' : 'Steering Wheel'}\n— ${pt ? 'ainda não disponível' : 'not available yet'}`} aria-label={pt ? 'Roda de navegação' : 'Steering Wheel'}><Icon name="nav" size={16} /></button>
      <button title={pt ? 'Aproximar' : 'Zoom In'} aria-label={pt ? 'Aproximar' : 'Zoom In'} onClick={() => zoom(1)}><Icon name="zoom" size={16} /></button>
      <button title={pt ? 'Afastar' : 'Zoom Out'} aria-label={pt ? 'Afastar' : 'Zoom Out'} onClick={() => zoom(-1)}><span className="navminus">−</span></button>
      <button title={pt ? 'Enquadrar tudo' : 'Zoom to Fit'} aria-label={pt ? 'Enquadrar tudo' : 'Zoom to Fit'} onClick={fit}><Icon name="fit" size={16} /></button>
    </div>
  );
}
