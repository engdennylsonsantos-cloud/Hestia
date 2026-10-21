import type { ReactElement } from 'react';
import { STAIR_RUN_SHAPE_LABEL, STAIR_RUN_SHAPES, type StairRunShape, type StairRunToolOptions } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { keptStairType } from '../editor/stairActions.ts';
import { NumField } from './fields.tsx';

/**
 * Barra da ferramenta Escada reta/L/U (`stairrun`): forma, largura, giro e tipo. Trocar a forma reinicia o desenho
 * (como o modo do piso e do telhado); os demais campos valem no próximo clique.
 */
export function StairRunOptionsBar(): ReactElement {
  const p = useProject();
  const options = useUi((s) => s.options);
  const o: StairRunToolOptions = options.stairRun ?? { shape: 'straight', width: 1.2, turn: 'left' };
  const set = (patch: Partial<StairRunToolOptions>): void => {
    const cur = useUi.getState().options;
    useUi.setState({ options: { ...cur, stairRun: { ...(cur.stairRun ?? o), ...patch } } });
  };
  const turnable = o.shape !== 'straight';
  return (
    <>
      <label>
        Forma
        <select
          id="opt-stairshape"
          className="select"
          value={o.shape}
          onChange={(e) => {
            set({ shape: e.target.value as StairRunShape });
            editor.setTool('stairrun');
          }}
        >
          {STAIR_RUN_SHAPES.map((s) => (
            <option key={s} value={s}>{STAIR_RUN_SHAPE_LABEL[s]}</option>
          ))}
        </select>
      </label>
      <label>
        Largura
        <NumField id="opt-stairwidth" value={o.width} onCommit={(v) => set({ width: Math.max(0.1, v) })} unit="m" min={0.1} />
      </label>
      {turnable && (
        <label>
          Giro
          <select id="opt-stairturn" className="select" value={o.turn} onChange={(e) => set({ turn: e.target.value as 'left' | 'right' })}>
            <option value="left">À esquerda</option>
            <option value="right">À direita</option>
          </select>
        </label>
      )}
      <label>
        Tipo
        <select id="opt-stairruntype" className="select" value={keptStairType(p, o.typeId)} onChange={(e) => set({ typeId: e.target.value })}>
          {Object.values(p.stairTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <span className="hint">Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).</span>
    </>
  );
}
