import type { ReactElement } from 'react';
import { STAIR_RUN_SHAPE_LABEL, STAIR_RUN_SHAPES, stairTypeForShape, stairTypesForShape, type StairRunShape, type StairRunToolOptions } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

/** Dica da barra por forma: o caracol tem três cliques; as demais, dois (ou um e a digitação do ângulo). */
const HINT: Record<StairRunShape, string> = {
  straight: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  lshape: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  ushape: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  winder: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  spiral: 'Caracol: clique o centro, o raio externo e o ângulo inicial; gire para a varredura (ou digite os valores). Enter confirma.',
  free: 'Escada livre: o trajeto é definido por cliques.',
};

/** Raio interno padrão (m) do caracol, como em `SPIRAL_DEFAULT_INNER`. */
const INNER_DEFAULT = 0.1;

/**
 * Barra da ferramenta de escada por cliques (`stairrun`): forma (reta, L, U, leque ou caracol), largura, giro ou os campos
 * do caracol (raios, varredura e sentido) e tipo. A lista de tipos segue a forma: o caracol lista os tipos caracol; as
 * outras formas, os demais. Trocar a forma reinicia o desenho (como o modo do piso e do telhado); os demais campos valem
 * no próximo clique.
 */
export function StairRunOptionsBar(): ReactElement {
  const p = useProject();
  const options = useUi((s) => s.options);
  const o: StairRunToolOptions = options.stairRun ?? { shape: 'straight', width: 1.2, turn: 'left' };
  const set = (patch: Partial<StairRunToolOptions>): void => {
    const cur = useUi.getState().options;
    useUi.setState({ options: { ...cur, stairRun: { ...(cur.stairRun ?? o), ...patch } } });
  };
  const spiral = o.shape === 'spiral';
  const turnable = o.shape !== 'straight' && !spiral;
  const types = stairTypesForShape(p, o.shape);
  const typeValue = stairTypeForShape(p, o.shape, o.typeId) ?? '';
  return (
    <>
      <label>
        Forma
        <select
          id="opt-stairshape"
          className="select"
          value={o.shape}
          onChange={(e) => {
            const shape = e.target.value as StairRunShape;
            // A escolha de tipo acompanha a forma: o caracol passa a usar um tipo caracol.
            set({ shape, typeId: stairTypeForShape(p, shape, o.typeId) ?? undefined });
            editor.setTool('stairrun');
          }}
        >
          {STAIR_RUN_SHAPES.map((s) => (
            <option key={s} value={s}>{STAIR_RUN_SHAPE_LABEL[s]}</option>
          ))}
        </select>
      </label>
      {!spiral && (
        <label>
          Largura
          <NumField id="opt-stairwidth" value={o.width} onCommit={(v) => set({ width: Math.max(0.1, v) })} quantity="length" min={0.1} />
        </label>
      )}
      {turnable && (
        <label>
          Giro
          <select id="opt-stairturn" className="select" value={o.turn} onChange={(e) => set({ turn: e.target.value as 'left' | 'right' })}>
            <option value="left">À esquerda</option>
            <option value="right">À direita</option>
          </select>
        </label>
      )}
      {spiral && (
        <>
          <label>
            Raio interno (m)
            <NumField id="opt-spiralinner" value={o.spiralInner ?? INNER_DEFAULT} min={0.05} onCommit={(v) => set({ spiralInner: v })} quantity="length" />
          </label>
          <label>
            Raio externo (m)
            <NumField
              id="opt-spiralouter"
              value={o.spiralOuter ?? null}
              placeholder="clique (1,00)"
              min={0.05}
              onCommit={(v) => set({ spiralOuter: v })}
              onClear={() => set({ spiralOuter: undefined })}
              quantity="length"
            />
          </label>
          <label>
            Varredura (°)
            <NumField
              id="opt-spiralsweep"
              value={o.spiralSweep ?? null}
              placeholder="clique"
              decimals={0}
              min={30}
              max={720}
              onCommit={(v) => set({ spiralSweep: v })}
              onClear={() => set({ spiralSweep: undefined })}
            />
          </label>
          <label>
            Sentido
            <select id="opt-spiralsense" className="select" value={o.spiralSense ?? 'ccw'} onChange={(e) => set({ spiralSense: e.target.value as 'ccw' | 'cw' })}>
              <option value="ccw">Anti-horário</option>
              <option value="cw">Horário</option>
            </select>
          </label>
        </>
      )}
      <label>
        Tipo
        <select id="opt-stairruntype" className="select" value={typeValue} onChange={(e) => set({ typeId: e.target.value })}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <span className="hint">{HINT[o.shape]}</span>
    </>
  );
}
