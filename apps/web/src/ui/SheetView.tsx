import { useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { sheetOf, type SheetViewport } from '@hestia/model';
import { buildSheetDrawList, type SheetDrawList, type SheetFill, type SheetGroup, type SheetPath, type SheetPoint, type SheetText } from '@hestia/render';
import { editor, useProject } from '../editor/controller.ts';
import { SCALE_OPTIONS, moveViewportAction } from '../editor/sheetActions.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { TextField } from './fields.tsx';

/** Número para o SVG, sem ruído de ponto flutuante. */
const n = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/** A folha é desenhada em mm (y para cima no modelo, para baixo no SVG): cada ponto é trocado pela altura. */
const at = (q: SheetPoint, h: number): string => `${n(q.x)} ${n(h - q.y)}`;

const ringsD = (rings: SheetPoint[][], h: number): string => rings.map((ring) => `M${ring.map((q) => at(q, h)).join(' L')}Z`).join(' ');

function fillEl(f: SheetFill, h: number, key: string): ReactElement {
  return <path key={key} d={f.polygons.map((poly) => ringsD(poly, h)).join(' ')} fill={f.color} fillRule="evenodd" stroke="none" />;
}

function pathEl(s: SheetPath, h: number, key: string): ReactElement {
  const d = `M${s.pts.map((q) => at(q, h)).join(' L')}${s.closed ? 'Z' : ''}`;
  return <path key={key} d={d} fill="none" stroke={s.color} strokeWidth={s.widthMm} strokeDasharray={s.dashMm ? `${n(s.dashMm[0])} ${n(s.dashMm[1])}` : undefined} />;
}

function textEl(t: SheetText, h: number, key: string): ReactElement {
  return (
    <text key={key} x={n(t.at.x)} y={n(h - t.at.y)} transform={t.rotation ? `rotate(${n(-t.rotation)} ${n(t.at.x)} ${n(h - t.at.y)})` : undefined} fontSize={t.sizeMm} fill={t.color} textAnchor={t.center ? 'middle' : 'start'} fontFamily="Helvetica, Arial, sans-serif">
      {t.text}
    </text>
  );
}

/** Um grupo da folha: vista recortada à sua caixa, ou o quadro (sem recorte). */
function groupEl(g: SheetGroup, i: number, h: number): ReactElement {
  const clipId = `sheet-clip-${i}`;
  const clip = g.clip ? (
    <defs>
      <clipPath id={clipId}>
        <rect x={n(g.clip.x)} y={n(h - g.clip.y - g.clip.h)} width={n(g.clip.w)} height={n(g.clip.h)} />
      </clipPath>
    </defs>
  ) : null;
  return (
    <g key={i} clipPath={g.clip ? `url(#${clipId})` : undefined}>
      {clip}
      {g.fills.map((f, k) => fillEl(f, h, `f${k}`))}
      {g.paths.map((s, k) => pathEl(s, h, `p${k}`))}
      {g.texts.map((t, k) => textEl(t, h, `t${k}`))}
    </g>
  );
}

/** Caixa de uma vista na folha, em mm (y para cima), para o contorno de arraste. */
const boxOf = (v: SheetViewport): { x: number; y: number; w: number; h: number } => ({ x: v.at.x, y: v.at.y, w: v.size.w, h: v.size.h });

interface Drag {
  id: string;
  grab: SheetPoint;
  start: SheetPoint;
  now: SheetPoint;
}

/**
 * Aba de uma prancha (decisão 0022): a folha em escala de tela, com a moldura, as vistas e o carimbo. Arrastar uma vista
 * move a caixa (limitada à área de desenho); a escala e a remoção ficam na faixa acima. Desenho em SVG, em mm.
 */
export function SheetView({ sheetId }: { sheetId: string }): ReactElement {
  const p = useProject();
  const sheet = sheetOf(p, sheetId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const list = useMemo<SheetDrawList | null>(() => buildSheetDrawList(p, sheetId), [p, sheetId]);
  if (!sheet || !list) return <p className="tree-empty">Prancha inexistente.</p>;
  const H = list.heightMm;
  const W = list.widthMm;
  const selected = sheet.viewports.find((v) => v.id === sel) ?? null;

  /** Ponto do ponteiro na folha, em mm e com y para cima. */
  const paperPoint = (e: PointerEvent<SVGSVGElement>): SheetPoint | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(ctm.inverse());
    return { x: q.x, y: H - q.y };
  };

  const onDown = (e: PointerEvent<SVGSVGElement>): void => {
    const target = (e.target as Element).closest('[data-vp]') as SVGElement | null;
    const id = target?.dataset.vp ?? null;
    setSel(id);
    if (!id) return;
    const v = sheet.viewports.find((x) => x.id === id);
    const q = paperPoint(e);
    if (!v || !q) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ id, grab: q, start: { ...v.at }, now: q });
  };

  const onMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (!drag) return;
    const q = paperPoint(e);
    if (q) setDrag({ ...drag, now: q });
  };

  const onUp = (): void => {
    if (!drag) return;
    const dx = drag.now.x - drag.grab.x;
    const dy = drag.now.y - drag.grab.y;
    setDrag(null);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const err = moveViewportAction(editor.store, sheetId, drag.id, { x: drag.start.x + dx, y: drag.start.y + dy });
    useUi.setState({ status: err ?? 'Vista movida.' });
  };

  const run = (fn: () => void, ok: string): void => {
    try {
      fn();
      useUi.setState({ status: ok });
    } catch (e) {
      useUi.setState({ status: e instanceof Error ? e.message : 'Operação recusada.' });
    }
  };

  const ghost = drag ? sheet.viewports.find((v) => v.id === drag.id) : undefined;
  const ghostBox = ghost ? boxOf({ ...ghost, at: { x: ghost.at.x + (drag!.now.x - drag!.grab.x), y: ghost.at.y + (drag!.now.y - drag!.grab.y) } }) : null;

  return (
    <div className="sheet-wrap" aria-label={`Prancha ${sheet.number}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, minHeight: 0, overflow: 'auto' }}>
      <div className="sheet-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button className="btn small" onClick={() => useUi.setState({ dialog: 'sheet', dialogArg: sheetId })}>Propriedades da prancha</button>
        <button className="btn small" style={{ whiteSpace: 'nowrap' }} onClick={() => useUi.setState({ dialog: 'addView', dialogArg: sheetId })}>
          <Icon name="plus" size={13} /> Adicionar vista
        </button>
        {selected ? (
          <>
            <label className="val soft" htmlFor="sheet-scale">Escala da vista</label>
            <select id="sheet-scale" value={selected.scale} onChange={(e) => run(() => editor.store.exec({ type: 'updateViewport', sheetId, id: selected.id, patch: { scale: Number(e.target.value) } }, 'Alterar escala da vista'), 'Escala alterada.')}>
              {SCALE_OPTIONS.map((k) => (
                <option key={k} value={k}>1:{k}</option>
              ))}
              {SCALE_OPTIONS.includes(selected.scale as (typeof SCALE_OPTIONS)[number]) ? null : <option value={selected.scale}>1:{selected.scale}</option>}
            </select>
            <label className="val soft" htmlFor="sheet-title">Título</label>
            <span style={{ minWidth: 170 }}>
              <TextField id="sheet-title" value={selected.title ?? ''} placeholder="Título na prancha" onCommit={(v) => run(() => editor.store.exec({ type: 'updateViewport', sheetId, id: selected.id, patch: { title: v.trim() || undefined } }, 'Alterar título da vista'), 'Título alterado.')} />
            </span>
            <button className="btn small danger" onClick={() => { run(() => editor.store.exec({ type: 'removeViewport', sheetId, id: selected.id }, 'Excluir vista da prancha'), 'Vista removida.'); setSel(null); }}>Remover vista</button>
          </>
        ) : (
          <span className="val soft">Arraste uma vista para movê-la. Clique nela para escolher.</span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', maxWidth: 1100, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.25)', touchAction: 'none', cursor: drag ? 'grabbing' : 'default' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        role="img"
        aria-label={`Folha ${sheet.size} ${sheet.orientation === 'landscape' ? 'deitada' : 'em pé'}, ${sheet.viewports.length} vistas`}
      >
        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
        {list.groups.map((g, i) => groupEl(g, i, H))}
        {sheet.viewports.map((v) => (
          <rect key={`hit-${v.id}`} data-vp={v.id} x={n(v.at.x)} y={n(H - v.at.y - v.size.h)} width={n(v.size.w)} height={n(v.size.h)} fill="transparent" stroke={v.id === sel ? '#1d6fe0' : 'none'} strokeWidth={0.6} style={{ cursor: 'move' }} />
        ))}
        {ghostBox ? <rect x={n(ghostBox.x)} y={n(H - ghostBox.y - ghostBox.h)} width={n(ghostBox.w)} height={n(ghostBox.h)} fill="rgba(29,111,224,.08)" stroke="#1d6fe0" strokeDasharray="2 1.5" strokeWidth={0.4} /> : null}
      </svg>
      {sheet.viewports.length === 0 ? <p className="val soft">A folha está vazia. Use Adicionar vista para pôr uma planta, um corte ou o 3D.</p> : null}
    </div>
  );
}
