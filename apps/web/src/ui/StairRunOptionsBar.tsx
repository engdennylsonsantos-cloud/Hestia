import type { ReactElement } from 'react';
import { stairTypeForShape, stairTypesForShape, type StairRunShape, type StairRunToolOptions } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { I18N, useI18n } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';
import { stairRunFields, stairShapeOptions } from './stairRunFields.ts';

/** Dica da barra por forma: o caracol tem três cliques; as demais, dois (ou um e a digitação do ângulo). */
const HINT: Record<StairRunShape, string> = {
  straight: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  lshape: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  ushape: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  winder: 'Clique o centro do 1º espelho, depois a direção de subida (ou digite o ângulo em graus).',
  spiral: 'Caracol: clique o centro, o raio externo e o ângulo inicial; gire para a varredura (ou digite os valores). Enter confirma.',
  free: 'Escada livre: clique os pontos do trajeto; Enter conclui, A ajusta, Backspace volta.',
};

/** Raio interno padrão (m) do caracol, como em `SPIRAL_DEFAULT_INNER`. */
const INNER_DEFAULT = 0.1;

/**
 * Barra da ferramenta de escada por cliques (`stairrun`): forma (reta, L, U, leque, caracol ou livre), largura, patamar,
 * giro ou os campos do caracol (raios, varredura e sentido) e tipo. A lista de formas vem de `stairShapeOptions`, a mesma
 * do painel de Propriedades (a escada livre precisa aparecer nos dois lugares). A lista de tipos segue a forma: o caracol
 * lista os tipos caracol; as outras formas, os demais. Trocar a forma reinicia o desenho (como o modo do piso e do
 * telhado); os demais campos valem no próximo clique.
 */
export function StairRunOptionsBar(): ReactElement {
  const p = useProject();
  const t = I18N[useI18n((s) => s.lang)];
  const options = useUi((s) => s.options);
  const o: StairRunToolOptions = options.stairRun ?? { shape: 'straight', width: 1.2, turn: 'left' };
  const set = (patch: Partial<StairRunToolOptions>): void => {
    const cur = useUi.getState().options;
    useUi.setState({ options: { ...cur, stairRun: { ...(cur.stairRun ?? o), ...patch } } });
  };
  const fields = stairRunFields(o.shape);
  const { spiral, turn: turnable, landing } = fields;
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
          {stairShapeOptions(t.stair_shape_free).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      {fields.width && (
        <label>
          Largura
          <NumField id="opt-stairwidth" value={o.width} onCommit={(v) => set({ width: Math.max(0.1, v) })} quantity="length" min={0.1} />
        </label>
      )}
      {landing && (
        <label>
          Prof. patamar
          <NumField
            id="opt-stairlanding"
            value={o.landingDepth ?? null}
            placeholder="largura"
            min={0.1}
            onCommit={(v) => set({ landingDepth: Math.max(0.1, v) })}
            onClear={() => set({ landingDepth: undefined })}
            quantity="length"
          />
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
