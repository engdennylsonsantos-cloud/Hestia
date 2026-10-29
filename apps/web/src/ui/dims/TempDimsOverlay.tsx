import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { worldToScreen } from '@hestia/render';
import { toPermanent, type TempDim } from '@hestia/tools';
import { editor } from '../../editor/controller.ts';
import { setDimOverride, suspendSelectionDims, useUi } from '../../editor/state.ts';
import { currentUnits, useFormat } from '../useUnits.ts';
import { INVALID_FLASH_MS, resolveDimEdit, suspensionAfterConversion } from './dimsActions.ts';
import { larguraDoCampo } from './dimsBox.ts';
import { capturesPointer, holdsLastPreview, rectAround, swallowsPointerButton, type ScreenRect } from './dimsHit.ts';
import { placeConvertButton, valueRect } from './dimsLayout.ts';
import { viewOfDim } from './dimsView.ts';
import { toolDims, useDimContext, useSelectionDims } from './useSelectionDims.ts';

const DANGER = 'var(--danger, #d33)';

const BOX: CSSProperties = {
  position: 'absolute',
  width: 62,
  height: 22,
  padding: '0 4px',
  textAlign: 'center',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  background: 'var(--panel)',
  color: 'var(--accent)',
  pointerEvents: 'auto',
  zIndex: 13,
};

const GRIP: CSSProperties = {
  position: 'absolute',
  width: 10,
  height: 10,
  padding: 0,
  borderRadius: '50%',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'auto',
  cursor: 'pointer',
};

/** Engole só o clique principal; botão do meio e direito seguem para o canvas (pan e menu sobre uma cota). */
const stop = (e: { stopPropagation(): void; button?: number }): void => {
  if (swallowsPointerButton(e.button ?? 0)) e.stopPropagation();
};
const auto = (captures: boolean): 'auto' | 'none' => (captures ? 'auto' : 'none');
/**
 * Passar o mouse sobre a cota não move o cursor da ferramenta: senão a prévia (e a cota, que a segue) fugiria do ponteiro
 * e o clique acabaria no canvas (C05/C06). Com botão pressionado (pan) o movimento segue para o canvas.
 */
const hover = (e: { buttons: number; stopPropagation(): void }): void => {
  if (e.buttons === 0) e.stopPropagation();
};

/**
 * Cotas dinâmicas (temporárias) de qualquer ferramenta ou seleção: um componente só. Desenha as linhas, o texto azul
 * editável, as alças das pontas (trocam a referência) e o ícone "I" (converte em cotas permanentes). Não conhece
 * nenhum elemento: tudo vem dos provedores (`TempDim`).
 */
export function TempDimsOverlay(): ReactElement | null {
  const ctx = useDimContext();
  const selDims = useSelectionDims();
  const tick = useUi((s) => s.previewTick);
  const tool = useUi((s) => s.tool);
  const cursor = useUi((s) => s.cursor);
  const format = useFormat();
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  // Última prévia da ferramenta: segura as cotas enquanto o cursor vai da prévia até o valor ou o "I" (C05).
  const lastPreview = useRef<{ tool: string; dims: TempDim[] }>({ tool: '', dims: [] });
  // `tick` entra só para recalcular quando a ferramenta ou a vista se mexem.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const viewport = useMemo(() => editor.viewport(), [tick, tool, ctx.project]);

  useEffect(() => {
    if (!invalidKey) return undefined;
    const t = setTimeout(() => setInvalidKey(null), INVALID_FLASH_MS);
    return () => clearTimeout(t);
  }, [invalidKey]);

  const previewing = tool !== 'select';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fresh: TempDim[] = useMemo(() => (previewing ? (ctx.settings.showOnPlacement ? toolDims(ctx.overrides) : []) : selDims), [previewing, ctx, selDims, tick]);
  if (!viewport) return null;

  const toScreen = (p: { x: number; y: number }): { x: number; y: number } => worldToScreen(viewport, p);
  const cursorPx = cursor ? toScreen(cursor) : null;
  let dims = fresh;
  if (!previewing) lastPreview.current = { tool: '', dims: [] };
  else if (fresh.length > 0) lastPreview.current = { tool, dims: fresh };
  else if (lastPreview.current.tool === tool && holdsLastPreview(0, lastPreview.current.dims.map((d) => valueRect(viewOfDim(d, toScreen, 1 / viewport.zoom, null).textAt)), cursorPx)) dims = lastPreview.current.dims;
  else lastPreview.current = { tool: '', dims: [] };
  if (dims.length === 0) return null;
  const views = dims.map((d) => ({ dim: d, view: viewOfDim(d, toScreen, 1 / viewport.zoom, invalidKey) }));

  const commit = (dim: TempDim, text: string): void => {
    const r = resolveDimEdit(dim, text, currentUnits());
    setEditing(null);
    if (r.kind === 'error') {
      useUi.setState({ status: r.message });
      setInvalidKey(dim.key);
      return;
    }
    if (r.commands.length === 0) return;
    const applied = editor.applyCommands('Alterar cota', r.commands);
    if (applied.status === 'cancelled') return;
    if (applied.status === 'pending') {
      useUi.setState({ status: 'Confirme o diálogo para aplicar a cota.' });
      return;
    }
    useUi.setState({ status: r.note ?? 'Cota atualizada.' });
  };

  const makePermanent = (): void => {
    const cmds = toPermanent(ctx.levelId, dims);
    const before = editor.store.version;
    editor.store.transaction('Converter em cotas permanentes', () => cmds.forEach((c) => editor.store.exec(c)));
    const suspended = suspensionAfterConversion(before, editor.store.version);
    if (suspended === null) {
      useUi.setState({ status: 'Nada a converter.' });
      return;
    }
    // As temporárias da seleção somem junto: as pretas nascem no mesmo lugar e não podem se sobrepor. O undo muda a
    // versão e devolve as temporárias (ver `selectionDimsSuspended`).
    suspendSelectionDims(suspended);
    useUi.setState({ status: 'Cotas criadas.' });
  };

  // Pontas vivas (em tela): só nelas o clique da prévia é do canvas; valor e "I" nunca deixam o clique criar geometria.
  const liveEnds = dims.flatMap((d) => d.ends.map((e) => toScreen(e.at)));
  // Alça: folga para o imã (o cursor fica ao lado do ponto). Valor e "I": só passam ao canvas se cobrem o cursor (trecho curto).
  const captures = (rect: ScreenRect, clearance?: number): 'auto' | 'none' => auto(capturesPointer(rect, cursorPx, previewing, liveEnds, clearance));
  const widthOf = (d: TempDim): number => larguraDoCampo(editing?.key === d.key ? editing.text : format('length', d.value, { withUnit: false, trim: true }));
  const valueRects = views.map(({ dim, view }) => valueRect(view.textAt, widthOf(dim)));
  const gripRects = views.flatMap(({ view }) => view.grips.map((g) => rectAround(g.at, 10)));
  const convert = placeConvertButton(valueRects[0]!, [...valueRects, ...gripRects]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      <svg width={viewport.width} height={viewport.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        {views.map(({ view }) => (
          <g key={view.key} stroke={view.invalid ? DANGER : 'var(--accent)'} fill="none" strokeWidth={1}>
            <line x1={view.line[0].x} y1={view.line[0].y} x2={view.line[1].x} y2={view.line[1].y} />
            {view.extensions.map(([a, b], i) => (
              <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeDasharray="3 2" />
            ))}
            {view.ticks.map(([a, b], i) => (
              <line key={`t${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1.5} />
            ))}
          </g>
        ))}
      </svg>
      {views.map(({ dim, view }) => {
        const shown = format('length', dim.value, { withUnit: false, trim: true });
        const texto = editing?.key === dim.key ? editing.text : shown;
        const width = larguraDoCampo(texto);
        return (
          <div key={view.key}>
            <input
              className="input num"
              aria-label={`Cota: ${dim.key.split(':').pop()}`}
              title={view.editable ? 'Digite a medida e pressione Enter' : 'Cota de leitura'}
              readOnly={!view.editable}
              style={{ ...BOX, width, left: view.textAt.x - width / 2, top: view.textAt.y - 11, pointerEvents: captures(valueRect(view.textAt, width), 0), ...(view.invalid ? { borderColor: DANGER, color: DANGER } : {}) }}
              value={texto}
              onPointerDown={stop}
              onPointerUp={stop}
              onPointerMove={hover}
              onClick={stop}
              // Campo de leitura não toma o foco: a digitação (ex.: o deslocamento do Mover) segue para a ferramenta (C06).
              onMouseDown={(e) => { if (!view.editable) e.preventDefault(); }}
              onFocus={(e) => {
                if (view.editable) setEditing({ key: dim.key, text: shown });
                e.currentTarget.select();
              }}
              onBlur={() => setEditing(null)}
              onChange={(e) => setEditing({ key: dim.key, text: e.target.value })}
              onKeyDown={(e) => {
                stop(e);
                if (e.key === 'Enter') {
                  commit(dim, e.currentTarget.value);
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditing(null);
                  e.currentTarget.blur();
                }
              }}
            />
            {view.grips.map((g) => (
              <button
                key={g.overrideKey}
                type="button"
                aria-label={g.title}
                title={g.title}
                style={{ ...GRIP, left: g.at.x, top: g.at.y, pointerEvents: captures(rectAround(g.at, 10)) }}
                onPointerDown={stop}
                onPointerUp={stop}
                onPointerMove={hover}
                onClick={(e) => {
                  stop(e);
                  setDimOverride(g.overrideKey, g.next);
                }}
              />
            ))}
          </div>
        );
      })}
      <button
        type="button"
        className="btn"
        aria-label="Converter em cotas permanentes"
        title="Converter em cotas permanentes"
        style={{ position: 'absolute', left: convert.x, top: convert.y, width: convert.w, height: convert.h, padding: 0, pointerEvents: captures(convert, 0), zIndex: 13 }}
        onPointerDown={stop}
        onPointerUp={stop}
        onPointerMove={hover}
        onClick={(e) => {
          stop(e);
          makePermanent();
        }}
      >
        I
      </button>
    </div>
  );
}
