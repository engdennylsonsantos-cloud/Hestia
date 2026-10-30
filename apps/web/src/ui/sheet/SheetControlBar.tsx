import type { ReactElement } from 'react';
import type { Sheet, SheetViewport } from '@hestia/model';
import { sheetDimsMm } from '@hestia/model';
import type { SheetCamera, SheetSize } from './sheetCamera.ts';
import type { AlignMode } from '../../editor/sheetAlign.ts';
import { Icon } from '../Icon.tsx';

/** Escalas oferecidas na prancha (as mesmas de `sheetActions.SCALE_OPTIONS`, sem importar o editor aqui). */
const SCALES = [20, 25, 50, 100, 200, 500] as const;
/** Pixels de tela por mm a 100% (96 dpi), para mostrar o zoom relativo ao tamanho real. */
const PX_PER_MM = 96 / 25.4;

export interface SheetControlBarProps {
  sheet: Sheet;
  camera: SheetCamera;
  view: SheetSize;
  selected: readonly SheetViewport[];
  grid: boolean;
  snap: boolean;
  fitScale: boolean;
  /** Ferramenta Alinhar ativa. */
  alignOn: boolean;
  onToggleAlign: () => void;
  /** Ferramenta Mover ativa. */
  moveOn: boolean;
  onToggleMove: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onActualSize: () => void;
  onZoomToSelection: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleFitScale: () => void;
  onScale: (scale: number) => void;
  onToggleClip: () => void;
  onToggleFrame: () => void;
  onToggleLabel: () => void;
  onToggleLock: () => void;
  onFitFrame: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onAddView: () => void;
  onProps: () => void;
}

const ALIGN: { mode: AlignMode; label: string; icon: string; title: string }[] = [
  { mode: 'left', label: 'Esquerda', icon: 'align', title: 'Alinhar as vistas selecionadas à esquerda' },
  { mode: 'hcenter', label: 'Centro H', icon: 'align', title: 'Centralizar as vistas selecionadas na horizontal' },
  { mode: 'right', label: 'Direita', icon: 'align', title: 'Alinhar as vistas selecionadas à direita' },
  { mode: 'top', label: 'Topo', icon: 'align', title: 'Alinhar as vistas selecionadas pelo topo' },
  { mode: 'vcenter', label: 'Centro V', icon: 'align', title: 'Centralizar as vistas selecionadas na vertical' },
  { mode: 'bottom', label: 'Base', icon: 'align', title: 'Alinhar as vistas selecionadas pela base' },
];

/**
 * Barra inferior da prancha (o mesmo lugar da Barra de Controle de Vista): zoom, encaixe, escala e propriedades da
 * vista selecionada, alinhamento/distribuição e adicionar vista. Como no Revit, o zoom é da sessão, não do arquivo.
 */
export function SheetControlBar(p: SheetControlBarProps): ReactElement {
  const { sheet, camera, selected } = p;
  const dims = sheetDimsMm(sheet);
  const one = selected.length === 1 ? selected[0]! : null;
  const zoomPct = Math.round((camera.zoom / PX_PER_MM) * 100);
  const btn = (key: string, icon: string, label: string, title: string, onClick: () => void, opts: { on?: boolean; disabled?: boolean; danger?: boolean } = {}): ReactElement => (
    <button key={key} className={`vcb-btn${opts.on ? ' on' : ''}${opts.danger ? ' danger' : ''}`} title={title} aria-label={title} aria-pressed={opts.on} disabled={opts.disabled} onClick={onClick}>
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </button>
  );
  const sep = (k: string): ReactElement => <span key={k} className="vcb-sep" />;

  return (
    <div className="vcb sheet-vcb" role="toolbar" aria-label="Barra da prancha">
      {btn('zo', 'zoom', '−', 'Diminuir o zoom da folha', () => p.onZoom(1 / 1.25))}
      <span className="vcb-zoom" aria-label={`Zoom ${zoomPct}%`}>{zoomPct}%</span>
      {btn('zi', 'zoom', '+', 'Aumentar o zoom da folha', () => p.onZoom(1.25))}
      {btn('fit', 'fit', 'Ajustar', 'Enquadrar a folha inteira (Z)', p.onFit)}
      {btn('act', 'scale', '1:1', 'Tamanho real na tela (100%)', p.onActualSize)}
      {btn('zs', 'sheet', 'Ver vista', 'Enquadrar a vista selecionada', p.onZoomToSelection, { disabled: selected.length === 0 })}
      {sep('s1')}
      {btn('grid', 'grid', 'Grade', 'Mostra a grade de 10 mm da folha (G)', p.onToggleGrid, { on: p.grid })}
      {btn('snap', 'align', 'Encaixe', 'Encaixa nas bordas e centros das outras vistas', p.onToggleSnap, { on: p.snap })}
      {btn('move', 'move', 'Mover', 'Mover a vista pela moldura ou por um ponto do desenho (M)', p.onToggleMove, { on: p.moveOn })}
      {btn('align', 'align', 'Alinhar', 'Alinhar pela moldura ou por faces/eixos do desenho (A) — Esc cancela', p.onToggleAlign, { on: p.alignOn })}
      {one ? (
        <>
          {sep('s2')}
          <label className="vcb-field" title="Escala da vista selecionada">
            <Icon name="scale" size={14} />
            <span>Escala</span>
            <select
              className="vcb-select"
              value={SCALES.includes(one.scale as (typeof SCALES)[number]) ? String(one.scale) : ''}
              aria-label="Escala da vista"
              onChange={(e) => e.target.value && p.onScale(Number(e.target.value))}
            >
              {!SCALES.includes(one.scale as (typeof SCALES)[number]) && <option value="">{`1 : ${one.scale}`}</option>}
              {SCALES.map((k) => (
                <option key={k} value={k}>{`1 : ${k}`}</option>
              ))}
            </select>
          </label>
          {btn('fitframe', 'crop', 'Ajustar moldura', 'Ajusta a moldura ao desenho, na escala atual', p.onFitFrame)}
          {btn('clip', 'crop', 'Recortar', 'Recorta o desenho à moldura (Revit: Crop View)', p.onToggleClip, { on: one.clip !== false })}
          {btn('frame', 'detail', 'Moldura', 'Mostra a moldura da vista na folha', p.onToggleFrame, { on: one.frame !== false })}
          {btn('label', 'text', 'Legenda', 'Mostra a legenda da vista', p.onToggleLabel, { on: one.label?.show !== false })}
          {btn('lock', 'crop', 'Travar', 'Trava a vista: não se move nem se redimensiona', p.onToggleLock, { on: one.locked === true })}
          {btn('autofit', 'scale', 'Moldura auto', 'Ao trocar a escala, a moldura acompanha o desenho', p.onToggleFitScale, { on: p.fitScale })}
        </>
      ) : null}
      {selected.length >= 2 ? (
        <>
          {sep('s3')}
          {ALIGN.map((a) => btn(`al-${a.mode}`, a.icon, a.label, a.title, () => p.onAlign(a.mode)))}
          {btn('dist-h', 'align', 'Distribuir H', 'Distribui as vistas com vãos iguais na horizontal', () => p.onDistribute('h'))}
          {btn('dist-v', 'align', 'Distribuir V', 'Distribui as vistas com vãos iguais na vertical', () => p.onDistribute('v'))}
        </>
      ) : null}
      {sep('s4')}
      {btn('add', 'plus', 'Adicionar vista', 'Adiciona uma planta, corte ou 3D a esta prancha', p.onAddView)}
      {btn('props', 'props', 'Propriedades', 'Propriedades da prancha (folha, carimbo, revisões)', p.onProps)}
      <span className="vcb-sheet-info" title={`Folha ${sheet.size} com ${sheet.viewports.length} vistas`}>
        {sheet.number} · {dims.w} × {dims.h} mm · {sheet.viewports.length} vista{sheet.viewports.length === 1 ? '' : 's'}
        {one ? ` · vista ${Math.round(one.size.w)} × ${Math.round(one.size.h)} mm` : ''}
      </span>
    </div>
  );
}
