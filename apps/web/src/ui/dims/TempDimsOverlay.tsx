import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { worldToScreen } from '@hestia/render';
import { toPermanent, type TempDim } from '@hestia/tools';
import { editor } from '../../editor/controller.ts';
import { setDimOverride, useUi } from '../../editor/state.ts';
import { currentUnits, useFormat } from '../useUnits.ts';
import { INVALID_FLASH_MS, resolveDimEdit } from './dimsActions.ts';
import { capturesPointer, rectAround, swallowsPointerButton } from './dimsHit.ts';
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
  const dims: TempDim[] = useMemo(() => (previewing ? (ctx.settings.showOnPlacement ? toolDims(ctx.overrides) : []) : selDims), [previewing, ctx, selDims, tick]);
  if (!viewport || dims.length === 0) return null;

  const toScreen = (p: { x: number; y: number }): { x: number; y: number } => worldToScreen(viewport, p);
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
    editor.store.transaction('Alterar cota', () => r.commands.forEach((c) => editor.store.exec(c)));
    useUi.setState({ status: r.note ?? 'Cota atualizada.' });
  };

  const makePermanent = (): void => {
    const cmds = toPermanent(ctx.levelId, dims);
    editor.store.transaction('Converter em cotas permanentes', () => cmds.forEach((c) => editor.store.exec(c)));
    useUi.setState({ status: 'Cotas criadas.' });
  };

  const cursorPx = cursor ? toScreen(cursor) : null;
  const captures = (rect: ReturnType<typeof rectAround>): 'auto' | 'none' => auto(capturesPointer(rect, cursorPx, previewing));
  const first = views[0]!.view.textAt;
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
        const active = editing?.key === dim.key;
        const shown = format('length', dim.value, { withUnit: false, trim: true });
        return (
          <div key={view.key}>
            <input
              className="input num"
              aria-label={`Cota: ${dim.key.split(':').pop()}`}
              title={view.editable ? 'Digite a medida e pressione Enter' : 'Cota de leitura'}
              readOnly={!view.editable}
              style={{ ...BOX, left: view.textAt.x - 31, top: view.textAt.y - 11, pointerEvents: view.editable ? 'auto' : captures({ x: view.textAt.x - 31, y: view.textAt.y - 11, w: 62, h: 22 }), ...(view.invalid ? { borderColor: DANGER, color: DANGER } : {}) }}
              value={active ? editing.text : shown}
              onPointerDown={stop}
              onPointerUp={stop}
              onClick={stop}
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
        style={{ position: 'absolute', left: first.x + 40, top: first.y - 11, width: 22, height: 22, padding: 0, pointerEvents: captures({ x: first.x + 40, y: first.y - 11, w: 22, h: 22 }), zIndex: 13 }}
        onPointerDown={stop}
        onPointerUp={stop}
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
