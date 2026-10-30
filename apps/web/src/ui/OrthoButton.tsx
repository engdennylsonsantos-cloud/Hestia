import type { ReactElement } from 'react';
import { toggleOrtho, useUi } from '../editor/state.ts';

/** Botão da barra de status do modo ortogonal global (F8), no mesmo estilo do Snap. */
export function OrthoButton(): ReactElement {
  const on = useUi((s) => s.options.orthoLock);
  return (
    <button
      type="button"
      className={`snap-btn${on ? '' : ' snap-btn--disabled'}`}
      aria-pressed={on}
      onClick={() => toggleOrtho()}
      title={on ? 'Modo ortogonal ativo (F8): apenas 0°/90°' : 'Modo ortogonal desligado (F8)'}
    >
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V4h16" />
        <path d="M8 20V8h12" />
      </svg>
      <span>Ortogonal</span>
      {on ? <span className="snap-count">F8</span> : <span className="snap-status-tag off">OFF [F8]</span>}
    </button>
  );
}
