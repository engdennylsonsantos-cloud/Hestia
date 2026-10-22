import { worldToScreen, type LabelOp, type Viewport } from '@hestia/render';

/** Rótulos da planta (DOM sobre o canvas): etiquetas de tipo, cotas e textos de anotação (decisão 0019). */
export function PlanLabels({ labels, v }: { labels: LabelOp[]; v: Viewport | null }) {
  return (
    <div className="labels" aria-hidden="true">
      {v
        ? labels.map((l, i) => {
            const sp = worldToScreen(v, l.at);
            // Anotação (cota ou texto, decisão 0019): fonte e rotação do papel, centrada no ponto.
            if (l.fontPx !== undefined)
              return (
                <span key={i} className="plan-note" style={{ left: sp.x, top: sp.y, fontSize: l.fontPx, transform: `translate(-50%, -50%) rotate(${-(l.rotation ?? 0)}deg)` }}>
                  {l.text}
                </span>
              );
            return (
              <span key={i} className={l.tone === 'soft' ? 'dim-label dim-label--soft' : 'dim-label'} style={{ left: sp.x + (l.dx ?? 0), top: sp.y + (l.dy ?? 0) }}>
                {l.text}
              </span>
            );
          })
        : null}
    </div>
  );
}
