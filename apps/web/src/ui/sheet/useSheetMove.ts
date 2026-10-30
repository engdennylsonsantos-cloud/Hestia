import { useCallback, useEffect, useRef, useState } from 'react';
import type { Sheet } from '@hestia/model';
import { viewportBox } from '@hestia/model';
import type { SheetDrawList } from '@hestia/render';
import { editor } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { commitMove } from './sheetCommit.ts';
import { hitBox, type PaperBox, type PaperPoint } from './sheetSelection.ts';
import { nearestPoint, snapPointsAt, type SnapPoint } from './sheetSnapPoints.ts';

const say = (status: string): void => useUi.setState({ status });

/** Fase do Mover: escolher a vista, marcar o ponto base ou o destino (como o Mover do modelo). */
export type SheetMovePhase = 'pick' | 'base' | 'dest';

export interface SheetMoveOverlay {
  /** Fantasmas das vistas na posição de destino. */
  ghosts: { id: string; box: PaperBox }[];
  base: PaperPoint | null;
  snap: SnapPoint | null;
  /** Texto da cota temporária (distância · ângulo) ou da distância digitada. */
  text: string | null;
  phase: SheetMovePhase;
}

export interface SheetMoveApi {
  on: boolean;
  toggle: () => void;
  phase: SheetMovePhase | null;
  hover: (pt: PaperPoint) => void;
  click: (pt: PaperPoint) => void;
  escape: () => void;
  confirm: () => void;
  char: (ch: string) => boolean;
  backspace: () => boolean;
  overlay: SheetMoveOverlay | null;
}

const fmtText = (d: { x: number; y: number }): string => {
  const dist = Math.hypot(d.x, d.y);
  const angle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  return `${dist.toFixed(1).replace('.', ',')} mm · ${angle.toFixed(0)}°`;
};

/**
 * Ferramenta Mover na prancha, no gesto do Mover do modelo: (1) escolhe a vista — pela moldura ou por qualquer linha
 * do desenho —, (2) ponto base e (3) destino, com captura de pontos (extremidade, interseção, meio, cantos da moldura
 * e da folha), cota temporária, distância digitada e um único desfazer. Move só a vista (caixa + construção juntas).
 */
export function useSheetMove(args: {
  sheet: Sheet | null;
  sheetId: string;
  drawList: SheetDrawList | null;
  zoom: number;
  selection: readonly string[];
  setSelection: (ids: string[]) => void;
}): SheetMoveApi {
  const { sheet, sheetId, drawList, zoom, selection, setSelection } = args;
  const on = useUi((s) => s.sheetMove);
  const [ids, setIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<SheetMovePhase>('pick');
  const [base, setBase] = useState<PaperPoint | null>(null);
  const [cursor, setCursor] = useState<PaperPoint | null>(null);
  const [snap, setSnap] = useState<SnapPoint | null>(null);
  const [buffer, setBuffer] = useState('');
  const wasOn = useRef(false);

  // Liga a ferramenta já com a seleção atual (se houver): pula direto para o ponto base, como no modelo.
  useEffect(() => {
    if (wasOn.current === on) return;
    wasOn.current = on;
    setBase(null);
    setCursor(null);
    setSnap(null);
    setBuffer('');
    if (!on) return;
    const sel = selection.filter((id) => sheet?.viewports.some((v) => v.id === id));
    setIds(sel);
    setPhase(sel.length ? 'base' : 'pick');
    say(
      sel.length
        ? 'Mover: clique no ponto base e depois no destino (ou digite a distância). Esc cancela.'
        : 'Mover: clique numa vista (moldura ou desenho) para escolher, depois no ponto base e no destino.',
    );
    // `selection` de propósito: só interessa no instante em que a ferramenta liga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const tol = 8 / Math.max(1e-9, zoom);
  const pointsAt = useCallback(
    (pt: PaperPoint): SnapPoint[] => (sheet && drawList ? snapPointsAt({ drawList, sheet, at: pt, tol }) : []),
    [sheet, drawList, tol],
  );

  const resolve = useCallback(
    (pt: PaperPoint): { p: PaperPoint; snap: SnapPoint | null } => {
      const found = nearestPoint(pointsAt(pt), pt, tol);
      return { p: found?.p ?? pt, snap: found };
    },
    [pointsAt, tol],
  );

  const hover = useCallback(
    (pt: PaperPoint): void => {
      if (!on) return;
      const r = resolve(pt);
      setCursor(r.p);
      setSnap(r.snap);
    },
    [on, resolve],
  );

  const apply = useCallback(
    (delta: { x: number; y: number }): void => {
      if (!sheet || ids.length === 0) return;
      const boxes: Record<string, PaperBox> = {};
      for (const id of ids) {
        const vp = sheet.viewports.find((v) => v.id === id);
        if (!vp || vp.locked) continue;
        boxes[id] = { ...viewportBox(vp), x: vp.at.x + delta.x, y: vp.at.y + delta.y };
      }
      if (Object.keys(boxes).length === 0) {
        say('As vistas selecionadas estão travadas.');
        return;
      }
      const err = commitMove(editor.store, sheetId, sheet, Object.keys(boxes), boxes);
      if (err) {
        say(err);
        return;
      }
      const after = editor.project.sheets?.find((s) => s.id === sheetId);
      const partial = after
        ? Object.keys(boxes).some((id) => {
            const v = after.viewports.find((x) => x.id === id);
            const want = boxes[id]!;
            return !v || Math.abs(v.at.x - want.x) > 0.01 || Math.abs(v.at.y - want.y) > 0.01;
          })
        : false;
      say(`Movido ${fmtText(delta)}${partial ? ' (encostou no limite da folha)' : ''}.`);
      setBase(null);
      setBuffer('');
      useUi.setState({ sheetMove: false });
    },
    [sheet, sheetId, ids],
  );

  const click = useCallback(
    (pt: PaperPoint): void => {
      if (!on || !sheet) return;
      if (phase === 'pick') {
        const id = hitBox(sheet.viewports.map((v) => ({ id: v.id, box: viewportBox(v) })), pt, 0);
        if (!id) {
          say('Mover: clique sobre a moldura ou o desenho de uma vista.');
          return;
        }
        setIds([id]);
        setSelection([id]);
        setPhase('base');
        say('Mover: clique no ponto base (ponto do desenho ou da moldura).');
        return;
      }
      if (phase === 'base') {
        const r = resolve(pt);
        setBase(r.p);
        setCursor(r.p);
        setSnap(r.snap);
        setPhase('dest');
        say('Mover: clique no destino — ou digite a distância em mm e Enter. Esc cancela o ponto base.');
        return;
      }
      if (!base) return;
      const r = resolve(pt);
      const delta = { x: r.p.x - base.x, y: r.p.y - base.y };
      if (Math.abs(delta.x) < 1e-6 && Math.abs(delta.y) < 1e-6) return;
      apply(delta);
    },
    [on, sheet, phase, resolve, setSelection, base, apply],
  );

  const escape = useCallback((): void => {
    if (buffer) {
      setBuffer('');
      say('Distância cancelada. Clique no destino ou digite outra distância.');
      return;
    }
    if (phase === 'dest') {
      setBase(null);
      setPhase('base');
      say('Ponto base cancelado. Clique no ponto base.');
      return;
    }
    useUi.setState({ sheetMove: false });
  }, [buffer, phase]);

  /** Enter: aplica a distância digitada na direção do cursor (como o Mover do modelo). */
  const confirm = useCallback((): void => {
    if (!base || !buffer) return;
    const value = Number(buffer.replace(/\./g, '').replace(',', '.'));
    if (!(Number.isFinite(value) && value > 0)) {
      say('Distância inválida. Digite um número em mm.');
      return;
    }
    const dir = cursor ? { x: cursor.x - base.x, y: cursor.y - base.y } : { x: 1, y: 0 };
    const len = Math.hypot(dir.x, dir.y);
    const unit = len < 1e-9 ? { x: 1, y: 0 } : { x: dir.x / len, y: dir.y / len };
    apply({ x: unit.x * value, y: unit.y * value });
  }, [base, buffer, cursor, apply]);

  const char = useCallback(
    (ch: string): boolean => {
      if (!on || phase !== 'dest' || !base) return false;
      if (!/[0-9.,]/.test(ch)) return false;
      const next = buffer + ch;
      if (next.length > 12) return true;
      setBuffer(next);
      say(`Distância: ${next} mm — Enter aplica, Esc cancela.`);
      return true;
    },
    [on, phase, base, buffer],
  );

  const backspace = useCallback((): boolean => {
    if (!on || phase !== 'dest' || buffer === '') return false;
    const next = buffer.slice(0, -1);
    setBuffer(next);
    say(next ? `Distância: ${next} mm — Enter aplica, Esc cancela.` : 'Clique no destino ou digite a distância.');
    return true;
  }, [on, phase, buffer]);

  const overlay = ((): SheetMoveOverlay | null => {
    if (!on) return null;
    let ghosts: { id: string; box: PaperBox }[] = [];
    let text: string | null = null;
    if (phase === 'dest' && base && cursor) {
      const delta = { x: cursor.x - base.x, y: cursor.y - base.y };
      ghosts = (sheet?.viewports ?? [])
        .filter((v) => ids.includes(v.id))
        .map((v) => ({ id: v.id, box: { ...viewportBox(v), x: v.at.x + delta.x, y: v.at.y + delta.y } }));
      text = buffer ? `Distância: ${buffer} mm` : fmtText(delta);
    }
    return { ghosts, base, snap, text, phase };
  })();

  const toggle = useCallback((): void => useUi.setState({ sheetMove: !useUi.getState().sheetMove, sheetAlign: false }), []);

  return { on, toggle, phase: on ? phase : null, hover, click, escape, confirm, char, backspace, overlay };
}
