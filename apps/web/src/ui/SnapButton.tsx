import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { DEFAULT_SNAP, type SnapOptions } from '@hestia/tools';
import { setSnap, useUi } from '../editor/state.ts';
import { Check } from './fields.tsx';

interface SnapItemDef {
  key: keyof SnapOptions;
  label: string;
  symbol: string;
  shortcut?: string;
  hint: string;
}

/** Capturas do popover, inspiradas no AutoCAD e Revit. */
const ITEMS: SnapItemDef[] = [
  { key: 'endpoint', label: 'Extremidade', symbol: '□', hint: 'Pontas de paredes e vértices' },
  { key: 'midpoint', label: 'Ponto Médio', symbol: '△', hint: 'Centro das paredes e arestas' },
  { key: 'axis', label: 'Eixos de Parede', symbol: '┼', hint: 'Pé sobre o eixo da parede (hospeda portas e janelas)' },
  { key: 'intersections', label: 'Interseção', symbol: '✕', hint: 'Cruzamento de eixos e quinas' },
  { key: 'perpendicular', label: 'Perpendicular', symbol: '⟂', hint: 'Ângulo reto a partir do ponto anterior' },
  { key: 'alignment', label: 'Rastreamento Dinâmico', symbol: '☩', shortcut: 'F11', hint: 'Linhas-guia pontilhadas de alinhamento com outros pontos' },
  { key: 'faces', label: 'Faces de Parede', symbol: '⚏', hint: 'Cantos e arestas das faces de acabamento' },
  { key: 'core', label: 'Faces do Núcleo', symbol: '◇', hint: 'Cantos e arestas da alvenaria estrutural' },
  { key: 'grid', label: 'Pela grade', symbol: '⊞', hint: 'Captura nos pontos da grade visível (intervalo em Propriedades da vista; automático pelo zoom)' },
];

const ALL_ON: SnapOptions = {
  enabled: true,
  grid: true,
  axis: true,
  faces: true,
  core: true,
  intersections: true,
  perpendicular: true,
  alignment: true,
  endpoint: true,
  midpoint: true,
};

const ALL_OFF: SnapOptions = {
  enabled: false,
  grid: false,
  axis: false,
  faces: false,
  core: false,
  intersections: false,
  perpendicular: false,
  alignment: false,
  endpoint: false,
  midpoint: false,
};

/** Botão Snap da barra de status com checklist de capturas (AutoCAD Object Snap / Revit Snaps). */
export function SnapButton(): ReactElement {
  const snap = useUi((s) => s.options.snap) ?? DEFAULT_SNAP;
  const isEnabled = snap.enabled !== false;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();

  const activeCount = ITEMS.filter((i) => snap[i.key] !== false).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      const target = e.target;
      if (target instanceof Node && anchor.current && !anchor.current.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open]);

  return (
    <div className="snap-anchor" ref={anchor}>
      <button
        ref={trigger}
        type="button"
        className={`snap-btn${!isEnabled ? ' snap-btn--disabled' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        title="Capturas de desenho (F3): extremidades, meios, interseções e alinhamento"
      >
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        <span>Snap</span>
        {isEnabled ? (
          <span className="snap-count">{activeCount}/{ITEMS.length}</span>
        ) : (
          <span className="snap-status-tag off">OFF [F3]</span>
        )}
      </button>

      {open && (
        <div id={popId} ref={pop} role="dialog" aria-label="Capturas de desenho" className="snap-pop" tabIndex={-1}>
          <div className="snap-master-row">
            <div className="snap-master-info">
              <strong>Capturas de Objeto (Snaps)</strong>
              <span className="snap-master-hint">Atalho mestre: <code>F3</code></span>
            </div>
            <button
              type="button"
              className={`btn small ${isEnabled ? 'primary' : ''}`}
              onClick={() => setSnap({ enabled: !isEnabled })}
            >
              {isEnabled ? 'LIGADO' : 'DESLIGADO'}
            </button>
          </div>

          <div role="group" aria-label="Checklist de capturas">
            {ITEMS.map((i) => {
              const val = snap[i.key] !== false;
              return (
                <div key={i.key} className="snap-row">
                  <Check
                    id={`snap-${i.key}`}
                    checked={val}
                    onChange={(v) => setSnap({ [i.key]: v })}
                  >
                    <span className="snap-item-label">
                      <span className="snap-sym">{i.symbol}</span>
                      <span>{i.label}</span>
                      {i.shortcut && <span className="snap-shortcut">{i.shortcut}</span>}
                    </span>
                  </Check>
                  <span className="snap-desc">{i.hint}</span>
                </div>
              );
            })}
          </div>

          <div className="snap-actions">
            <button type="button" className="btn small" onClick={() => setSnap(ALL_ON)}>Tudo</button>
            <button type="button" className="btn small" onClick={() => setSnap(DEFAULT_SNAP)}>Padrão</button>
            <button type="button" className="btn small" onClick={() => setSnap(ALL_OFF)}>Nenhum</button>
          </div>
        </div>
      )}
    </div>
  );
}
