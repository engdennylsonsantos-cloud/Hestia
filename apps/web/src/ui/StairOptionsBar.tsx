import type { ReactElement } from 'react';
import { counterText, isStairTool, STAIR_SUBMODE_LABEL, STAIR_SUBMODES, type StairPrimitive, type StairSubmode, type StairTool, type StairToolOptions } from '@hestia/tools';
import { levelAbove } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { stairNote } from '../editor/stairActions.ts';
import { NumField } from './fields.tsx';

/** Aplica uma ação ao croqui em curso e repinta a barra (a ferramenta não avisa a interface sozinha). */
function act(fn: (t: StairTool) => void): void {
  const t = editor.activeTool;
  if (!isStairTool(t)) return;
  fn(t);
  editor.bump();
}

/** Muda uma opção da escada e recalcula a análise (limites, topo e altura entram no cálculo do croqui). */
function setStairOpt(patch: Partial<StairToolOptions>): void {
  const o = useUi.getState().options;
  useUi.setState({ options: { ...o, stair: { ...o.stair, ...patch } } });
  // `refresh` mantém o traçado em curso e a fase do croqui; só a análise e a prévia mudam.
  act((t) => t.refresh());
}

const ERROR_COLOR = 'var(--danger, #b42318)';
const PRIMITIVES: Array<[StairPrimitive, string]> = [
  ['line', 'Linha'],
  ['arc', 'Arco'],
];

/**
 * Barra da ferramenta Escada (croqui): tipo, sub-modos (Limites, Espelhos, Caminhada, Patamar, Concluir), primitiva
 * (Tab alterna), "Distribuir N espelhos", o contador de espelhos, a 1ª mensagem do croqui e, fora da edição, nível de
 * topo, deslocamentos e altura (esta só quando não há nível acima).
 */
export function StairOptionsBar(): ReactElement | null {
  const p = useProject();
  const levelId = useUi((s) => s.levelId);
  const options = useUi((s) => s.options);
  const opts: StairToolOptions = options.stair ?? {};
  // Re-renderiza a cada passo do croqui (o `previewTick` muda com cada clique, tecla e ação).
  const tick = useUi((s) => s.previewTick);
  void tick;
  const tool = editor.activeTool;
  if (!isStairTool(tool)) return null;
  const st = tool.status();
  const note = stairNote(st);
  const noLevelAbove = levelAbove(p, levelId) === null;
  const topValue = opts.topLevelId ?? '';

  return (
    <>
      <div className="stair-modes" role="group" aria-label="Sub-modo do croqui" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STAIR_SUBMODES.map((m: StairSubmode) => (
          <button key={m} className={`btn small${st.submode === m ? ' primary' : ''}`} aria-pressed={st.submode === m} onClick={() => act((t) => t.setSubmode(m))}>
            {STAIR_SUBMODE_LABEL[m]}
          </button>
        ))}
      </div>
      <label>
        Tipo
        <select
          id="opt-stairtype"
          className="select"
          value={st.typeId ?? ''}
          disabled={st.editing}
          title={st.editing ? 'Tipo da escada em edição: altere em Propriedades.' : 'Tipo usado na criação'}
          onChange={(e) => setStairOpt({ typeId: e.target.value })}
        >
          {Object.values(p.stairTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <div className="stair-prim" role="group" aria-label="Primitiva" style={{ display: 'flex', gap: 4 }}>
        {PRIMITIVES.map(([id, label]) => (
          <button key={id} className={`btn small${st.primitive === id ? ' primary' : ''}`} aria-pressed={st.primitive === id} onClick={() => act((t) => t.setPrimitive(id))} title="Tab alterna linha e arco">
            {label}
          </button>
        ))}
      </div>
      <label>
        Espelhos
        <NumField id="opt-stairn" value={opts.distributeCount ?? st.desired} decimals={0} min={1} onCommit={(v) => setStairOpt({ distributeCount: Math.max(1, Math.round(v)) })} />
      </label>
      <button className="btn small" onClick={() => act((t) => t.distribute())} title="Distribui N espelhos igualmente entre os limites do lance">
        Distribuir espelhos
      </button>
      <button className="btn small" onClick={() => act((t) => t.clearLayer())} title="Apaga a camada do sub-modo atual (Del)">
        Apagar camada
      </button>
      <span className="stair-counter" aria-live="polite" style={{ color: 'var(--fg-soft)' }}>{counterText(st)}</span>
      {note && (
        <span className="stair-note" role="status" style={{ color: note.tone === 'error' ? ERROR_COLOR : 'var(--warn, #9a6700)' }}>
          {note.text}
        </span>
      )}
      {!st.editing && (
        <>
          <label>
            Nível de topo
            <select id="opt-stairtop" className="select" value={topValue} onChange={(e) => setStairOpt({ topLevelId: e.target.value || null })}>
              <option value="">Automático (nível acima)</option>
              {p.levels.map((l) => (
                <option key={l.id} value={l.id}>{`Até ${l.name}`}</option>
              ))}
            </select>
          </label>
          <label>
            Desloc. da base
            <NumField id="opt-stairbase" value={opts.baseOffset ?? 0} onCommit={(v) => setStairOpt({ baseOffset: v })} unit="m" />
          </label>
          <label>
            Desloc. do topo
            <NumField id="opt-stairtopoff" value={opts.topOffset ?? 0} onCommit={(v) => setStairOpt({ topOffset: v })} unit="m" />
          </label>
          {noLevelAbove && !opts.topLevelId && (
            <label>
              Altura
              <NumField id="opt-stairheight" value={opts.height ?? 2.8} min={0.1} onCommit={(v) => setStairOpt({ height: v })} unit="m" />
            </label>
          )}
        </>
      )}
      <button className="btn small primary" onClick={() => act((t) => t.setSubmode('concluir'))} title="Grava a escada (Enter em Concluir)">
        Concluir
      </button>
    </>
  );
}
