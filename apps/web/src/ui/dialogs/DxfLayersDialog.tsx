import { useMemo, type ReactElement } from 'react';
import { DXF_LINE_WEIGHTS, DXF_LINE_WEIGHT_DEFAULT, dxfLineWeightLabel, type DxfLayerStyle } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { exportDxf } from '../../editor/fileActions.ts';
import { dxfLayerTableOf, type DxfExportTarget } from '../../editor/dxfExport.ts';
import { useUi, type UiState } from '../../editor/state.ts';
import { Dialog } from './Dialog.tsx';

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

/** Alvo do diálogo: a mesma escolha do menu Arquivo › Exportar › DXF (planta, corte ou planta de área). */
function targetOf(ui: UiState): DxfExportTarget | null {
  if (ui.view === 'plan' && ui.planKind === 'area' && ui.areaPlanId) return { kind: 'area', planId: ui.areaPlanId };
  if (ui.view === 'section' && ui.sectionId) return { kind: 'section', sectionId: ui.sectionId };
  // A planta de cobertura não tem DXF próprio (o menu avisa em vez de exportar a planta de piso).
  if (ui.view === 'plan' && ui.planKind === 'roof') return null;
  return { kind: 'plan', levelId: ui.levelId, showRoofProjection: ui.showRoofProjection };
}

/**
 * Diálogo de exportação do DXF com a tabela de camadas (fase 3): cor ACI, tipo de linha e espessura por camada, com o padrão
 * montado pela categoria gráfica e pela escala. Cada edição é um comando (desfazer vale) e fica salva em `project.dxfLayers`;
 * as camadas sem edição seguem o padrão. O botão exporta com os estilos atuais.
 */
export function DxfLayersDialog(): ReactElement {
  const p = useProject();
  const ui = useUi();
  const target = useMemo(() => targetOf(ui), [ui]);
  const close = (): void => useUi.setState({ dialog: null });
  // Recalcula quando o projeto muda (cada edição é um comando) ou o alvo muda de vista.
  const rows = useMemo(() => (target ? dxfLayerTableOf(p, target) : []), [p, target]);
  const setStyle = (layer: string, patch: Partial<DxfLayerStyle>): void => {
    const row = rows.find((r) => r.name === layer);
    if (!row) return;
    editor.store.exec({ type: 'setDxfLayerStyle', layer, style: { ...row.style, ...patch } }, 'Estilo da camada do DXF');
  };
  const reset = (): void => {
    editor.store.exec({ type: 'resetDxfLayers' }, 'Restaurar as camadas do DXF');
  };
  const doExport = async (): Promise<void> => {
    await exportDxf();
    close();
  };
  return (
    <Dialog
      title="Exportar DXF"
      sub="R2000 (AC1015) — camadas editáveis"
      onClose={close}
      size="wide"
      footer={
        <>
          <button className="btn" onClick={reset} disabled={!p.dxfLayers}>Restaurar padrão</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={() => void doExport()} disabled={!target}>Exportar DXF</button>
        </>
      }
    >
      {!target ? (
        <p>A planta de cobertura não tem DXF próprio: abra a planta de piso do nível.</p>
      ) : rows.length === 0 ? (
        <p>Esta vista não tem camadas para exportar.</p>
      ) : (
        <>
          <p style={{ margin: '2px 0 8px', opacity: 0.75 }}>
            A cor, o tipo de linha e a espessura valem por camada no arquivo. A espessura é a do DXF (código 370): “Padrão” deixa o
            AutoCAD usar a espessura padrão da camada.
          </p>
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
                    <select
                      aria-label={`Cor da camada ${name}`}
                      value={style.color}
                      onChange={(e) => setStyle(name, { color: Number(e.target.value) })}
                    >
                      {(COLORS.some(([c]) => c === style.color) ? COLORS : [...COLORS, [style.color, `ACI ${style.color}`] as [number, string]]).map(([c, label]) => (
                        <option key={c} value={c}>{c} · {label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Tipo de linha da camada ${name}`}
                      value={style.linetype}
                      onChange={(e) => setStyle(name, { linetype: e.target.value as DxfLayerStyle['linetype'] })}
                    >
                      {LINETYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Espessura da camada ${name}`}
                      value={style.lineWeight}
                      onChange={(e) => setStyle(name, { lineWeight: Number(e.target.value) })}
                    >
                      {[DXF_LINE_WEIGHT_DEFAULT, ...DXF_LINE_WEIGHTS].map((w) => <option key={w} value={w}>{dxfLineWeightLabel(w)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Dialog>
  );
}
