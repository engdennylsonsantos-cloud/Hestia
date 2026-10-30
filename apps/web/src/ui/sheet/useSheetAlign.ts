import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Sheet } from '@hestia/model';
import type { SheetDrawList } from '@hestia/render';
import { editor } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { commitMove } from './sheetCommit.ts';
import { alignDelta, sameOwner, sheetAlignFeatures, type SheetAlignFeature } from './sheetAlignTool.ts';
import { viewportBox } from '@hestia/model';
import type { PaperBox, PaperPoint } from './sheetSelection.ts';

const say = (status: string): void => useUi.setState({ status });

const HINT = 'Alinhar: clique na referência e depois no que deseja alinhar. Ctrl+clique acumula vários; Tab alterna a feição; Esc volta um passo.';

export interface SheetAlignOverlay {
  ref: SheetAlignFeature | null;
  candidate: SheetAlignFeature | null;
  queue: readonly SheetAlignFeature[];
  ghost: { box: PaperBox; delta: { x: number; y: number } } | null;
}

export interface SheetAlignApi {
  /** Ferramenta ativa (fonte: `useUi.sheetAlign`, para o botão da faixa e o da barra ficarem sincronizados). */
  on: boolean;
  toggle: () => void;
  /** Atualiza a candidata sob o cursor (no `pointermove`). */
  hover: (pt: PaperPoint) => void;
  /** Clique: escolhe a referência, soma à fila (Ctrl) ou aplica. */
  click: (pt: PaperPoint, ctrl: boolean) => void;
  /** Tab: alterna entre as feições sob o cursor (mesmo gesto do Alinhar do modelo). */
  cycle: () => void;
  /** Esc: limpa a fila, depois a referência, depois desliga a ferramenta. */
  back: () => void;
  /** Enter: aplica a fila acumulada com Ctrl+clique. */
  confirm: () => void;
  overlay: SheetAlignOverlay | null;
}

/**
 * Ferramenta Alinhar na prancha: reaproveita a captura do Alinhar do modelo (`alignFeaturesAt`) para achar faces,
 * eixos e arestas **dentro** das vistas, e também aceita a moldura da vista e as bordas da folha. Segue o gesto do
 * Revit: referência → alvo, Ctrl+clique acumula, Tab alterna, Esc volta um passo; a referência fica até o Esc.
 */
export function useSheetAlign(args: { sheet: Sheet | null; sheetId: string; drawList: SheetDrawList | null; zoom: number }): SheetAlignApi {
  const { sheet, sheetId, drawList, zoom } = args;
  const on = useUi((s) => s.sheetAlign);
  const [ref, setRef] = useState<SheetAlignFeature | null>(null);
  const [cands, setCands] = useState<SheetAlignFeature[]>([]);
  const [idx, setIdx] = useState(0);
  const [queue, setQueue] = useState<SheetAlignFeature[]>([]);
  const wasOn = useRef(false);

  // Liga/desliga limpando referência, fila e candidatas.
  useEffect(() => {
    if (wasOn.current === on) return;
    wasOn.current = on;
    setRef(null);
    setQueue([]);
    setCands([]);
    setIdx(0);
    if (on) say(HINT);
  }, [on]);

  const candidates = useCallback(
    (at: PaperPoint): SheetAlignFeature[] => (sheet && drawList ? sheetAlignFeatures({ project: editor.project, sheet, drawList, at, zoom, prefer: 'faces' }) : []),
    [sheet, drawList, zoom],
  );

  const apply = useCallback(
    (reference: SheetAlignFeature, targets: SheetAlignFeature[]): void => {
      if (!sheet) return;
      const boxes: Record<string, PaperBox> = {};
      const notes: string[] = [];
      for (const t of targets) {
        if (sameOwner(reference, t)) {
          notes.push('a vista de referência não se move');
          continue;
        }
        const owner = t.owner;
        if (owner.type !== 'viewport') {
          notes.push('a folha não se move');
          continue;
        }
        const vp = sheet.viewports.find((v) => v.id === owner.id);
        if (!vp) continue;
        if (vp.locked) {
          notes.push('vista travada');
          continue;
        }
        const d = alignDelta(reference, t);
        if (!d) {
          notes.push('linhas não paralelas');
          continue;
        }
        if (Math.abs(d.dx) < 1e-6 && Math.abs(d.dy) < 1e-6) continue;
        boxes[vp.id] = { ...viewportBox(vp), x: vp.at.x + d.dx, y: vp.at.y + d.dy };
      }
      const ids = Object.keys(boxes);
      if (ids.length === 0) {
        say(notes.length ? `Nada a alinhar: ${notes.join('; ')}.` : 'Já estão alinhados.');
        return;
      }
      const err = commitMove(editor.store, sheetId, sheet, ids, boxes);
      if (err) {
        say(err);
        return;
      }
      const after = editor.project.sheets?.find((s) => s.id === sheetId);
      const partial = after
        ? ids.some((id) => {
            const v = after.viewports.find((x) => x.id === id);
            const want = boxes[id]!;
            return !v || Math.abs(v.at.x - want.x) > 0.01 || Math.abs(v.at.y - want.y) > 0.01;
          })
        : false;
      say(`${ids.length > 1 ? 'Vistas alinhadas' : 'Alinhada'}${partial ? ' (encostou no limite da folha)' : ''}. Referência: ${reference.label}. Clique no próximo (Esc troca a referência).`);
      setQueue([]);
    },
    [sheet, sheetId],
  );

  const hover = useCallback(
    (pt: PaperPoint): void => {
      const list = candidates(pt);
      const key = cands[idx]?.key;
      const found = key ? list.findIndex((c) => c.key === key) : -1;
      setCands(list);
      setIdx(found >= 0 ? found : 0);
    },
    [candidates, cands, idx],
  );

  const click = useCallback(
    (pt: PaperPoint, ctrl: boolean): void => {
      const list = candidates(pt);
      const cand = list[idx] ?? list[0] ?? null;
      if (!ref) {
        if (!cand) {
          say('Clique sobre uma face, eixo, aresta ou na moldura da vista.');
          return;
        }
        setRef(cand);
        setQueue([]);
        say(`Referência: ${cand.label}. Clique no que deseja alinhar (Tab troca a candidata).`);
        return;
      }
      if (!cand) {
        say('Clique sobre a feição que deseja mover.');
        return;
      }
      if (ctrl) {
        const has = queue.some((q) => q.key === cand.key);
        setQueue((q) => (has ? q.filter((x) => x.key !== cand.key) : [...q, cand]));
        say(`${has ? queue.length - 1 : queue.length + 1} feição(ões) para alinhar. Ctrl+clique soma ou tira; clique sem Ctrl (ou Enter) aplica.`);
        return;
      }
      const targets = queue.length ? [...queue.filter((q) => q.key !== cand.key), cand] : [cand];
      setQueue([]);
      apply(ref, targets);
    },
    [apply, candidates, idx, queue, ref],
  );

  const cycle = useCallback((): void => {
    const n = cands.length;
    if (n < 2) {
      if (cands[0]) say(`${cands[0].label}. ${HINT}`);
      return;
    }
    const next = (idx + 1) % n;
    setIdx(next);
    say(`${cands[next]!.label}. ${ref ? 'Clique para alinhar; Tab troca a feição.' : 'Clique para usar como referência; Tab troca a feição.'}`);
  }, [cands, idx, ref]);

  const back = useCallback((): void => {
    if (queue.length) {
      setQueue([]);
      say(`Seleção múltipla cancelada. Referência: ${ref?.label ?? 'nenhuma'}. ${HINT}`);
      return;
    }
    if (ref) {
      setRef(null);
      say(HINT);
      return;
    }
    useUi.setState({ sheetAlign: false });
  }, [queue.length, ref]);

  const confirm = useCallback((): void => {
    if (ref && queue.length) apply(ref, queue);
  }, [apply, queue, ref]);

  const overlay = useMemo((): SheetAlignOverlay | null => {
    if (!on) return null;
    const candidate = cands[idx] ?? null;
    let ghost: SheetAlignOverlay['ghost'] = null;
    if (sheet && ref && candidate && !sameOwner(ref, candidate)) {
      const owner = candidate.owner;
      if (owner.type === 'viewport') {
        const vp = sheet.viewports.find((v) => v.id === owner.id);
        const d = vp ? alignDelta(ref, candidate) : null;
        if (vp && d) ghost = { box: { x: vp.at.x + d.dx, y: vp.at.y + d.dy, w: vp.size.w, h: vp.size.h }, delta: { x: d.dx, y: d.dy } };
      }
    }
    return { ref, candidate, queue, ghost };
  }, [on, sheet, ref, cands, idx, queue]);

  const toggle = useCallback((): void => useUi.setState({ sheetAlign: !useUi.getState().sheetAlign }), []);

  return { on, toggle, hover, click, cycle, back, confirm, overlay };
}
