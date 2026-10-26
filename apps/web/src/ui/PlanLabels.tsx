import { forwardRef, useImperativeHandle, useRef } from 'react';
import { worldToScreen, type LabelOp, type Viewport } from '@hestia/render';

/** Rótulos da planta (DOM sobre o canvas): etiquetas de tipo, cotas e textos de anotação (decisão 0019). */
export interface PlanLabelsHandle { syncView(v: Viewport): void; }

export const PlanLabels = forwardRef<PlanLabelsHandle, { labels: LabelOp[]; v: Viewport | null }>(function PlanLabels({ labels, v }, ref) {
  const nodes = useRef<Array<HTMLSpanElement | null>>([]);
  const masks = useRef<Array<SVGPolygonElement | null>>([]);
  useImperativeHandle(ref, () => ({
    syncView(view) {
      labels.forEach((label, i) => {
        if (label.maskBoundary) {
          const mask = masks.current[i];
          if (mask) mask.setAttribute('points', label.maskBoundary.map((p) => { const s = worldToScreen(view, p); return `${s.x},${s.y}`; }).join(' '));
          return;
        }
        const node = nodes.current[i];
        if (!node) return;
        const screen = worldToScreen(view, label.at);
        node.style.left = `${screen.x + (label.dx ?? 0)}px`;
        node.style.top = `${screen.y + (label.dy ?? 0)}px`;
      });
    },
  }), [labels]);
  return (
    <div className="labels" aria-hidden="true">
      {v && labels.some((l) => l.maskBoundary) ? (
        <svg className="plan-mask-layer" width={v.width} height={v.height} viewBox={`0 0 ${v.width} ${v.height}`}>
          {labels.map((l, i) => l.maskBoundary ? <polygon key={i} ref={(node) => { masks.current[i] = node; }} points={l.maskBoundary.map((p) => { const s = worldToScreen(v, p); return `${s.x},${s.y}`; }).join(' ')} fill={l.maskColor ?? '#fbfbfa'} stroke={l.maskBorderColor ?? 'none'} strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null)}
        </svg>
      ) : null}
      {v
        ? labels.map((l, i) => {
            if (l.maskBoundary) return null;
            const sp = worldToScreen(v, l.at);
            // Anotação (cota ou texto, decisão 0019): fonte e rotação do papel, centrada no ponto.
            if (l.fontPx !== undefined && l.center)
              return (
                <span key={i} ref={(node) => { nodes.current[i] = node; }} className="plan-note" style={{ left: sp.x + (l.dx ?? 0), top: sp.y + (l.dy ?? 0), fontSize: l.fontPx, width: l.widthPx, whiteSpace: l.widthPx ? 'normal' : 'nowrap', textAlign: l.align, fontWeight: l.bold ? 700 : undefined, fontStyle: l.italic ? 'italic' : undefined, textDecoration: l.underline ? 'underline' : undefined, transform: `translate(-50%, -50%) rotate(${-(l.rotation ?? 0)}deg)` }}>
                  {l.text}
                </span>
              );
            // Rótulo com fonte em mm de papel, mas não centrado (etiqueta de parede, ambiente, escada): usa plan-note
            // sem centralizar em X, só em Y (para o ponto de ancoragem ficar no centro vertical do texto).
            if (l.fontPx !== undefined)
              return (
                <span key={i} ref={(node) => { nodes.current[i] = node; }} className="plan-note" style={{ left: sp.x + (l.dx ?? 0), top: sp.y + (l.dy ?? 0), fontSize: l.fontPx, transform: 'translate(0, -50%)' }}>
                  {l.text}
                </span>
              );
            return (
              <span key={i} ref={(node) => { nodes.current[i] = node; }} className={l.tone === 'soft' ? 'dim-label dim-label--soft' : 'dim-label'} style={{ left: sp.x + (l.dx ?? 0), top: sp.y + (l.dy ?? 0) }}>
                {l.text}
              </span>
            );
          })
        : null}
    </div>
  );
});
