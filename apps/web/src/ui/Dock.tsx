import { useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { setDock } from '../editor/dockActions.ts';
import { saveDock, type DockLayout } from '../editor/dockLayout.ts';
import { useUi } from '../editor/state.ts';
import { Browser } from './Browser.tsx';
import { Properties } from './Properties.tsx';

/** Arrasto com o ponteiro capturado: `move` recebe o deslocamento desde o início; ao soltar, guarda a disposição. */
function drag(e: ReactPointerEvent, move: (dx: number, dy: number) => void): void {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const x0 = e.clientX;
  const y0 = e.clientY;
  const onMove = (m: PointerEvent): void => move(m.clientX - x0, m.clientY - y0);
  const onUp = (): void => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    saveDock(useUi.getState().dock);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

/** Largura de cada dock (0 quando não tem painel aberto), para a grade da área de trabalho. */
export function dockWidths(propsOpen: boolean, browserOpen: boolean, dock: DockLayout): { left: number; right: number } {
  const left = propsOpen || (browserOpen && dock.browserSide === 'left');
  const right = browserOpen && dock.browserSide === 'right';
  return { left: left ? dock.leftW : 0, right: right ? dock.rightW : 0 };
}

/**
 * Dock de painéis: o esquerdo leva Propriedades (e o Navegador, no padrão do Revit), o direito leva o Navegador quando ele
 * foi movido para lá. Uma divisória vertical muda a largura; entre os dois painéis, uma horizontal muda a altura de cada um.
 */
export function Dock({ side }: { side: 'left' | 'right' }): ReactElement {
  const propsOpen = useUi((s) => s.propsOpen);
  const browserOpen = useUi((s) => s.browserOpen);
  const dock = useUi((s) => s.dock);
  const ref = useRef<HTMLDivElement>(null);
  const showProps = side === 'left' && propsOpen;
  const showBrowser = browserOpen && dock.browserSide === side;
  if (!showProps && !showBrowser) return <div className={`dock ${side} empty`} />;
  const w = side === 'left' ? dock.leftW : dock.rightW;
  const both = showProps && showBrowser;

  const resizeWidth = (e: ReactPointerEvent): void => {
    const w0 = w;
    drag(e, (dx) => setDock(side === 'left' ? { leftW: w0 + dx } : { rightW: w0 - dx }, false));
  };
  const resizeSplit = (e: ReactPointerEvent): void => {
    const h = ref.current?.getBoundingClientRect().height ?? 1;
    const s0 = dock.split;
    drag(e, (_dx, dy) => setDock({ split: s0 + dy / h }, false));
  };

  return (
    <div ref={ref} className={`dock ${side}`} style={{ width: w }}>
      {showProps && <div className="dock-pane" style={both ? { flex: `${dock.split} 1 0` } : { flex: 1 }}><Properties /></div>}
      {both && (
        <div className="dock-split h" role="separator" aria-orientation="horizontal" aria-label="Altura dos painéis" tabIndex={0} onPointerDown={resizeSplit}
          onKeyDown={(e) => { if (e.key === 'ArrowUp') setDock({ split: dock.split - 0.03 }); if (e.key === 'ArrowDown') setDock({ split: dock.split + 0.03 }); }} />
      )}
      {showBrowser && <div className="dock-pane" style={both ? { flex: `${1 - dock.split} 1 0` } : { flex: 1 }}><Browser /></div>}
      <div className={`dock-split v ${side}`} role="separator" aria-orientation="vertical" aria-label="Largura do painel" tabIndex={0} onPointerDown={resizeWidth}
        onKeyDown={(e) => { const d = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0; if (d) setDock(side === 'left' ? { leftW: w + d } : { rightW: w - d }); }} />
    </div>
  );
}

