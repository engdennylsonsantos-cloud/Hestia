import type { ReactElement } from 'react';
import type { OpeningCheck } from '@hestia/engine';
import type { OpeningType } from '@hestia/model';
import { NumField } from '../../fields.tsx';
import { TypePreview } from '../../TypePreview.tsx';

export type PreviewTab = 'plan' | 'elevation' | 'section' | 'lines3d' | 'shaded3d';

const TABS: ReadonlyArray<{ id: PreviewTab; label: string }> = [
  { id: 'plan', label: 'Planta' },
  { id: 'elevation', label: 'Elevação' },
  { id: 'section', label: 'Corte' },
  { id: 'lines3d', label: '3D linhas' },
  { id: 'shaded3d', label: '3D sombreado' },
];

interface OpeningTypePreviewProps {
  d: OpeningType;
  tab: PreviewTab;
  onTab: (tab: PreviewTab) => void;
  flipHand: boolean;
  flipFacing: boolean;
  onFlipHand: () => void;
  onFlipFacing: () => void;
  angle: number;
  onAngle: (angle: number) => void;
  checks: readonly OpeningCheck[];
}

/**
 * Coluna de prévia: abas das cinco vistas (só a elevação desenha nesta parte; as demais ficam "Em breve"), os
 * controles de dobradiça/sentido/ângulo (estado da prévia, não do tipo) e a faixa de verificações.
 */
export function OpeningTypePreview({
  d,
  tab,
  onTab,
  flipHand,
  flipFacing,
  onFlipHand,
  onFlipFacing,
  angle,
  onAngle,
  checks,
}: OpeningTypePreviewProps): ReactElement {
  return (
    <aside className="op-preview" aria-label="Pré-visualização do tipo">
      <div className="op-tabs" role="tablist" aria-label="Vistas da prévia">
        {TABS.map((t) => {
          const enabled = t.id === 'elevation';
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={`op-tab${t.id === tab ? ' on' : ''}`}
              aria-selected={t.id === tab}
              disabled={!enabled}
              title={enabled ? t.label : 'Em breve'}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="op-pv-box" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label ?? 'Prévia'}>
        {tab === 'elevation' ? (
          <TypePreview subject={{ kind: d.kind, type: d }} />
        ) : (
          <div className="op-pv-soon">Em breve</div>
        )}
      </div>
      <div className="op-pv-actions">
        <button type="button" className="btn small" aria-pressed={flipHand} onClick={onFlipHand}>Inverter dobradiça</button>
        <button type="button" className="btn small" aria-pressed={flipFacing} onClick={onFlipFacing}>Inverter sentido</button>
        <label htmlFor="op-pv-angle">Ângulo</label>
        <NumField id="op-pv-angle" value={angle} decimals={0} unit="°" onCommit={onAngle} />
      </div>
      <div className="op-pv-state">
        <span>Dobradiça: {flipHand ? 'direita' : 'esquerda'}</span>
        <span>Sentido: {flipFacing ? 'oposto' : 'padrão'}</span>
      </div>
      <div className="op-checks" aria-label="Verificações">
        <div className="op-checks-title">Verificações</div>
        {checks.length === 0 ? <p className="hint">Sem verificações.</p> : (
          <ul>
            {checks.map((c, i) => (
              <li key={`${c.level}-${i}`} className={c.level}>
                <span className="op-check-mark" aria-hidden="true">{c.level === 'ok' ? '✓' : '!'}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
