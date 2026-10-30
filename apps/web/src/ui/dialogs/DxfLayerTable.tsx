import { useMemo, type ReactElement } from 'react';
import { DXF_LINE_WEIGHTS, DXF_LINE_WEIGHT_DEFAULT, dxfLineWeightLabel, type DxfLayerStyle } from '@hestia/model';
import type { DxfLayerRow } from '../../editor/dxfExport.ts';

/** Cores ACI oferecidas na tabela (as do AutoCAD clássico); um valor gravado fora delas vira uma opção a mais. */
const COLORS: Array<[number, string]> = [
  [1, 'Vermelho'],
  [2, 'Amarelo'],
  [3, 'Verde'],
  [4, 'Ciano'],
  [5, 'Azul'],
  [6, 'Magenta'],
  [7, 'Branco/preto'],
  [8, 'Cinza escuro'],
  [9, 'Cinza claro'],
];

const LINETYPES: Array<[DxfLayerStyle['linetype'], string]> = [
  ['CONTINUOUS', 'Contínua'],
  ['DASHED', 'Tracejada'],
];

interface Props {
  rows: readonly DxfLayerRow[];
  onStyle: (layer: string, patch: Partial<DxfLayerStyle>) => void;
}

/**
 * Tabela de camadas do DXF (fase 3): cor ACI, tipo de linha e espessura por camada, com o padrão já montado. É
 * apresentação pura: quem chama guarda a edição no projeto (comando `setDxfLayerStyle`).
 */
export function DxfLayerTable({ rows, onStyle }: Props): ReactElement {
  const options = useMemo(() => [DXF_LINE_WEIGHT_DEFAULT, ...DXF_LINE_WEIGHTS], []);
  return (
    <table className="layers" aria-label="Camadas do DXF">
      <thead>
        <tr>
          <th>Camada</th>
          <th>Cor</th>
          <th>Tipo de linha</th>
          <th>Espessura</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ name, style }) => (
          <tr key={name}>
            <td style={{ fontFamily: 'monospace' }}>{name}</td>
            <td>
              <select aria-label={`Cor da camada ${name}`} value={style.color} onChange={(e) => onStyle(name, { color: Number(e.target.value) })}>
                {(COLORS.some(([c]) => c === style.color) ? COLORS : [...COLORS, [style.color, `ACI ${style.color}`] as [number, string]]).map(([c, label]) => (
                  <option key={c} value={c}>{c} · {label}</option>
                ))}
              </select>
            </td>
            <td>
              <select aria-label={`Tipo de linha da camada ${name}`} value={style.linetype} onChange={(e) => onStyle(name, { linetype: e.target.value as DxfLayerStyle['linetype'] })}>
                {LINETYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </td>
            <td>
              <select aria-label={`Espessura da camada ${name}`} value={style.lineWeight} onChange={(e) => onStyle(name, { lineWeight: Number(e.target.value) })}>
                {options.map((w) => <option key={w} value={w}>{dxfLineWeightLabel(w)}</option>)}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
