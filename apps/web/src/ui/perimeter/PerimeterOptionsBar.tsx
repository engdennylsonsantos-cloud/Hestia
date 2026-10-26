import type { ReactElement } from 'react';
import type { SketchTarget } from '@hestia/geom';
import { Check, NumField } from '../fields.tsx';
import { PERIMETER_TOOL } from './PerimeterStatus.ts';

/** Opções do modo de perímetro. Cada alvo usa só as que se aplicam. */
export interface PerimeterOptions {
  /** Balanço padrão do beiral (m). Só telhado. */
  overhang: number;
  /** Inclinação padrão das arestas (%). Só telhado. */
  slopePct: number;
  /** Estender a linha até o núcleo da parede. Todos os alvos. */
  extendToCore: boolean;
  /** Deslocamento do nível (m). Piso, laje e forro. */
  heightOffset: number;
}

export interface PerimeterOptionsBarProps {
  target: SketchTarget;
  options: PerimeterOptions;
  onChange: (patch: Partial<PerimeterOptions>) => void;
}

/** Barra de opções (`.optbar`) do modo de perímetro, com as mesmas classes das outras barras. */
export function PerimeterOptionsBar({ target, options: o, onChange }: PerimeterOptionsBarProps): ReactElement {
  const roof = target === 'roof';
  return (
    <div className="optbar" role="group" aria-label="Opções da ferramenta">
      <span className="tool-name">{PERIMETER_TOOL[target]}</span>
      {roof && (
        <label>
          Balanço
          <NumField id="opt-pm-overhang" value={o.overhang} onCommit={(v) => onChange({ overhang: v })} unit="m" min={0} />
        </label>
      )}
      {!roof && (
        <label>
          Deslocamento do nível
          <NumField id="opt-pm-offset" value={o.heightOffset} onCommit={(v) => onChange({ heightOffset: v })} unit="m" />
        </label>
      )}
      <Check id="opt-pm-extend" checked={o.extendToCore} onChange={(v) => onChange({ extendToCore: v })}>
        Estender até o núcleo da parede
      </Check>
      {roof && (
        <label>
          Inclinação padrão das arestas
          <NumField id="opt-pm-slope" value={o.slopePct} onCommit={(v) => onChange({ slopePct: v })} unit="%" min={0.1} max={200} />
        </label>
      )}
    </div>
  );
}
