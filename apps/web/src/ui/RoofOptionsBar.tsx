import type { ReactElement } from 'react';
import { ROOF_SHAPE_LABEL } from '@hestia/engine';
import { percentToDeg, roofAutoOffset, roofSlopeFromDegField, type RoofMode } from '@hestia/tools';
import type { RoofShape } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

const MODES: Array<[RoofMode, string]> = [
  ['poly', 'Contorno por pontos'],
  ['rect', 'Retângulo (2 cantos)'],
  ['paredes', 'Pelas paredes (com balanço)'],
  ['extrusao', 'Por extrusão (perfil)'],
];

/** Predefinições por aresta (Revit: Define Slope): cada forma preenche as arestas que definem inclinação. Extrusão tem perfil. */
const SHAPES: RoofShape[] = ['shed', 'gable', 'hip', 'edges', 'extrusion'];

/**
 * Opções da ferramenta Telhado: tipo, modo, forma, inclinação (% e graus, convertidos entre si), balanço do beiral e
 * cota do beiral. Cota "Automática" usa a altura da parede mais alta do nível (2,8 m sem paredes).
 */
export function RoofOptionsBar({ tool }: { tool: 'roof' | 'roofextrusion' }): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const levelId = useUi((s) => s.levelId);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  const slope = o.roofSlope ?? 30;
  const offsetAuto = roofAutoOffset(p, levelId);
  // O modo "extrusao" só vale com a ferramenta própria ativa; na ferramenta Telhado o seletor mostra o contorno.
  const modeValue: RoofMode = tool === 'roofextrusion' ? 'extrusao' : o.roofMode === 'extrusao' ? 'poly' : (o.roofMode ?? 'poly');
  return (
    <>
      <label>
        Tipo
        <select id="opt-rooftype" className="select" value={o.roofTypeId ?? ''} onChange={(e) => set({ roofTypeId: e.target.value })}>
          {Object.values(p.roofTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label>
        Modo
        <select
          id="opt-roofmode"
          className="select"
          value={modeValue}
          onChange={(e) => {
            // Trocar o modo reinicia o desenho em andamento (o modo é lido pela ferramenta a cada passo).
            // "Por extrusão" é a ferramenta própria (roofextrusion); os demais modos ficam na ferramenta Telhado.
            set({ roofMode: e.target.value as RoofMode });
            editor.setTool(e.target.value === 'extrusao' ? 'roofextrusion' : 'roof');
          }}
        >
          {MODES.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        Forma
        <select id="opt-roofshape" className="select" value={o.roofShape ?? 'gable'} onChange={(e) => set({ roofShape: e.target.value as RoofShape })}>
          {SHAPES.map((s) => (
            <option key={s} value={s}>{ROOF_SHAPE_LABEL[s]}</option>
          ))}
        </select>
      </label>
      <label>
        Inclinação
        <NumField id="opt-roofslope" value={slope} onCommit={(v) => set({ roofSlope: v })} unit="%" min={0.1} max={200} />
      </label>
      <label>
        Graus
        <NumField id="opt-roofdeg" value={percentToDeg(slope)} decimals={1} unit="°" min={0.1} max={63.4} onCommit={(v) => set({ roofSlope: roofSlopeFromDegField(v, percentToDeg(slope), slope) })} />
      </label>
      <label>
        Balanço
        <NumField id="opt-roofoverhang" value={o.roofOverhang ?? 0.5} onCommit={(v) => set({ roofOverhang: v })} unit="m" min={0} />
      </label>
      <label>
        Cota do beiral
        <NumField id="opt-roofoffset" value={o.roofOffset ?? offsetAuto} onCommit={(v) => set({ roofOffset: v })} unit="m" />
      </label>
      {o.roofOffset !== null && o.roofOffset !== undefined && (
        <button type="button" className="btn" onClick={() => set({ roofOffset: null })} title="Volta à altura da parede mais alta do nível">
          Automática
        </button>
      )}
      <span className="hint">Tab troca o eixo da cumeeira. Depois de criado, cada aresta se edita na planta.</span>
    </>
  );
}
