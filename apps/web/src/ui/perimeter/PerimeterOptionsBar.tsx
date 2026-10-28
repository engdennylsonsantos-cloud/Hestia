import type { ReactElement } from 'react';
import type { SketchTarget } from '@hestia/geom';
import { PERIMETER_MODIFY_LABEL, type PerimeterModifyKind } from '@hestia/tools';
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
  /** Vincular às paredes (piso e laje). Só com o esboço de "Por perímetro". Ausente = desmarcada. */
  linkToWalls?: boolean;
  /** Acompanhar o ambiente (forro). Só com o contorno de "Por ambiente". Ausente = desmarcada. */
  followRoom?: boolean;
}

export interface PerimeterOptionsBarProps {
  target: SketchTarget;
  options: PerimeterOptions;
  /** Comando de Modificar ativo sobre o esboço: o nome aparece ao lado do título. */
  modify?: PerimeterModifyKind | null;
  onChange: (patch: Partial<PerimeterOptions>) => void;
}

/** Barra de opções (`.optbar`) do modo de perímetro, com as mesmas classes das outras barras. */
export function PerimeterOptionsBar({ target, options: o, modify, onChange }: PerimeterOptionsBarProps): ReactElement {
  const roof = target === 'roof';
  return (
    <div className="optbar" role="group" aria-label="Opções da ferramenta">
      <span className="tool-name">{modify ? `${PERIMETER_TOOL[target]} · ${PERIMETER_MODIFY_LABEL[modify]}` : PERIMETER_TOOL[target]}</span>
      {roof && (
        <label>
          Balanço
          <NumField id="opt-pm-overhang" value={o.overhang} onCommit={(v) => onChange({ overhang: v })} quantity="length" min={0} />
        </label>
      )}
      {!roof && (
        <label>
          Deslocamento do nível
          <NumField id="opt-pm-offset" value={o.heightOffset} onCommit={(v) => onChange({ heightOffset: v })} quantity="length" />
        </label>
      )}
      {(target === 'floor' || target === 'slab') && (
        <Check
          id="opt-pm-link"
          checked={!!o.linkToWalls}
          disabled={!o.linkToWalls && o.extendToCore}
          onChange={(v) => onChange({ linkToWalls: v })}
        >
          Vincular às paredes (esboço por perímetro)
        </Check>
      )}
      {target === 'ceiling' && (
        <Check id="opt-pm-room" checked={!!o.followRoom} onChange={(v) => onChange({ followRoom: v })}>
          Acompanhar o ambiente (esboço por ambiente)
        </Check>
      )}
      <Check id="opt-pm-extend" checked={o.extendToCore} disabled={!!o.linkToWalls} onChange={(v) => onChange({ extendToCore: v })}>
        Estender até o núcleo da parede
      </Check>
      {roof && (
        <label>
          Inclinação padrão das arestas
          <NumField id="opt-pm-slope" value={o.slopePct / 100} onCommit={(v) => onChange({ slopePct: v * 100 })} quantity="slope" min={0.001} max={2} />
        </label>
      )}
    </div>
  );
}
