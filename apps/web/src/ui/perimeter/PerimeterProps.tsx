import type { ReactElement } from 'react';
import type { SketchTarget } from '@hestia/geom';
import { degToPercent, percentToDeg } from '@hestia/tools';
import { Check, Group, NumField, Row } from '../fields.tsx';
import { fmtPt, PERIMETER_TITLE } from './PerimeterStatus.ts';

/** Aresta selecionada do rascunho, já resolvida pelo chamador (valores próprios ou padrões do rascunho). */
export interface PerimeterEdgeInfo {
  /** Índice de 0 a count-1. */
  index: number;
  count: number;
  lengthM: number;
  /** Só telhado. */
  definesSlope?: boolean;
  /** Só telhado: inclinação da aresta em %. */
  slopePct?: number;
  /** Só telhado: balanço da aresta em m. */
  overhangM?: number;
}

export interface PerimeterPropsProps {
  target: SketchTarget;
  /** Null quando nenhuma aresta está selecionada. */
  edge: PerimeterEdgeInfo | null;
  onDefinesSlope: (v: boolean) => void;
  onSlopePct: (v: number) => void;
  onOverhang: (v: number) => void;
}

/**
 * Grupo "Perímetro do …" da paleta de propriedades: aresta selecionada, comprimento e, no telhado, inclinação
 * (liga/desliga, % e °) e balanço da aresta. Mesmas linhas de `RoofEdgeProps`, com rótulos de até 22 caracteres.
 */
export function PerimeterProps({ target, edge, onDefinesSlope, onSlopePct, onOverhang }: PerimeterPropsProps): ReactElement {
  const roof = target === 'roof';
  const defines = edge?.definesSlope === true;
  const pct = edge?.slopePct ?? null;
  return (
    <Group title={PERIMETER_TITLE[target]}>
      <Row label="Aresta selecionada">
        <span className="val">{edge ? `${edge.index + 1} de ${edge.count}` : '—'}</span>
      </Row>
      <Row label="Comprimento">
        <span className="val">{edge ? `${fmtPt(edge.lengthM)} m` : '—'}</span>
      </Row>
      {roof && (
        <>
          <Row label="Define inclinação" htmlFor="p-pm-define">
            <Check id="p-pm-define" checked={defines} disabled={!edge} onChange={onDefinesSlope}>
              {!edge ? '' : defines ? 'sim' : 'não (empena)'}
            </Check>
          </Row>
          <Row label="Inclinação" htmlFor="p-pm-slope">
            <NumField id="p-pm-slope" value={pct} onCommit={onSlopePct} unit="%" min={0.1} max={200} disabled={!defines} />
          </Row>
          <Row label="Inclinação (°)" htmlFor="p-pm-deg">
            <NumField
              id="p-pm-deg"
              value={pct === null ? null : percentToDeg(pct)}
              unit="°"
              min={0.1}
              max={63.4}
              disabled={!defines}
              onCommit={(v) => onSlopePct(degToPercent(v))}
            />
          </Row>
          <Row label="Balanço da aresta" htmlFor="p-pm-over">
            <NumField id="p-pm-over" value={edge?.overhangM ?? null} onCommit={onOverhang} unit="m" disabled={!edge} />
          </Row>
        </>
      )}
    </Group>
  );
}
