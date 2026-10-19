import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { DEFAULT_SNAP, type SnapOptions } from '@hestia/tools';
import { setSnap, useUi } from '../editor/state.ts';
import { Check } from './fields.tsx';

/** Capturas do popover, na ordem de exibição. A chave é o campo de `SnapOptions`. */
const ITEMS: Array<{ key: keyof SnapOptions; label: string; hint: string }> = [
  { key: 'grid', label: 'Grade', hint: 'Pontos da grade de desenho' },
  { key: 'axis', label: 'Eixo', hint: 'Extremidades, pontos médios e sobre o eixo das paredes' },
  { key: 'faces', label: 'Faces', hint: 'Cantos, pontos médios e arestas das faces de acabamento' },
  { key: 'core', label: 'Núcleo', hint: 'Cantos e arestas das faces do núcleo' },
  { key: 'intersections', label: 'Interseções', hint: 'Cruzamento dos eixos das paredes' },
  { key: 'perpendicular', label: 'Perpendicular', hint: 'Pé da perpendicular ao ponto anterior' },
  { key: 'alignment', label: 'Alinhamento e ortogonal', hint: 'Alinha com outros pontos e trava em 0° e 90°' },
];

const ALL_ON: SnapOptions = { grid: true, axis: true, faces: true, core: true, intersections: true, perpendicular: true, alignment: true };
const ONLY_FACES: SnapOptions = { grid: false, axis: false, faces: true, core: false, intersections: false, perpendicular: false, alignment: false };

/** Botão Snap da barra de status: popover com as capturas ligadas (Revit: Snaps). Mesmo padrão do botão de avisos. */
export function SnapButton(): ReactElement {
  const snap = useUi((s) => s.options.snap) ?? DEFAULT_SNAP;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const on = ITEMS.filter((i) => snap[i.key]).length;

  // Fecha com clique fora e com Esc. Esc é capturado antes do atalho global de cancelar ferramenta (listener da janela).
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

  // Ao abrir, o foco vai para a primeira opção.
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open]);

  return (
    <div className="snap-anchor" ref={anchor}>
      <button
        ref={trigger}
        type="button"
        className="snap-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        title="Capturas de desenho: grade, eixos, faces, núcleo e outras"
      >
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        <span>Snap</span>
        <span className="snap-count">{on}/{ITEMS.length}</span>
      </button>
      {open && (
        <div id={popId} ref={pop} role="dialog" aria-label="Capturas de desenho" className="snap-pop" tabIndex={-1}>
          <div role="group" aria-label="Capturas ligadas">
            {ITEMS.map((i) => (
              <div key={i.key} className="snap-row">
                <Check id={`snap-${i.key}`} checked={snap[i.key]} onChange={(v) => setSnap({ [i.key]: v })}>
                  {i.label}
                </Check>
                <span className="snap-desc">{i.hint}</span>
              </div>
            ))}
          </div>
          <div className="snap-actions">
            <button type="button" className="btn small" onClick={() => setSnap(ALL_ON)}>Tudo</button>
            <button type="button" className="btn small" onClick={() => setSnap(ONLY_FACES)}>Só faces</button>
          </div>
        </div>
      )}
    </div>
  );
}
