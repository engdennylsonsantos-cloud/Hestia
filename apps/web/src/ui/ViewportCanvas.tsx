import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { DARK, LIGHT, ModelScene, PlanScene, buildPlanDrawList, createGpu, drawPlanCpu, screenToWorld, worldToScreen, type GpuContext, type LabelOp, type Viewport } from '@hestia/render';
import { editor, useProjectVersion } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';

export function useDark(): boolean {
  const theme = useUi((s) => s.theme);
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (): void => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return theme === 'dark' || (theme === 'system' && sys);
}

interface Pt {
  x: number;
  y: number;
}

/** Desenha o plano (GPU ou CPU) e o 3D, e traduz o ponteiro em chamadas ao editor. */
export function ViewportCanvas(): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const gpuRef = useRef<{ gpu: GpuContext; canvas: HTMLCanvasElement } | null>(null);
  const cpuRef = useRef<HTMLCanvasElement | null>(null);
  const plan = useRef(new PlanScene());
  const model = useRef(new ModelScene());
  const modelKey = useRef('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [labels, setLabels] = useState<LabelOp[]>([]);
  const [ready, setReady] = useState(false);
  const dark = useDark();
  const pv = useProjectVersion();
  const ui = useUi();
  const frame = useRef(0);
  const dprRef = useRef(1);

  // ---- inicialização: GPU primeiro, CPU só sem suporte ----
  useEffect(() => {
    let cancelled = false;
    const el = host.current!;
    void (async () => {
      const forceCpu = new URLSearchParams(location.search).get('cpu') === '1';
      const res = forceCpu ? null : await createGpu(() => document.createElement('canvas'), new URLSearchParams(location.search).get('gl') === '1' ? 'webgl2' : 'auto');
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      if (res) {
        res.canvas.setAttribute('aria-label', 'Área de desenho');
        el.prepend(res.canvas);
        res.gpu.renderer.shadowMap.enabled = true;
        gpuRef.current = res;
        useUi.setState({ gpu: res.gpu.backend });
      } else {
        const c = document.createElement('canvas');
        c.setAttribute('aria-label', 'Área de desenho');
        el.prepend(c);
        cpuRef.current = c;
        useUi.setState({ gpu: 'cpu' });
      }
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      setReady(true);
    })();
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
      gpuRef.current?.gpu.dispose();
    };
  }, []);

  // ---- desenho ----
  const render = useCallback(() => {
    const st = useUi.getState();
    const { w, h } = size;
    if (!ready || w < 10 || h < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    const g = gpuRef.current;
    const p = editor.project;
    const theme = dark ? DARK : LIGHT;
    if (st.view === '3d') {
      if (!g) return;
      const m = model.current;
      const key = `${editor.store.version}|${dark}|${st.shadows}|${st.edges}`;
      if (key !== modelKey.current) {
        modelKey.current = key;
        const levels = p.levels.map((l) => editor.resolved(l.id));
        m.update(p, levels, { edges: st.edges, shadows: st.shadows, dark });
        if (!st.seen3d) {
          m.fit();
          useUi.setState({ seen3d: true });
        }
      }
      g.gpu.renderer.shadowMap.enabled = st.shadows;
      g.gpu.setSize(w, h, dpr);
      m.orbit.setAspect(w, h);
      g.gpu.render(m.scene, m.orbit.camera);
      setLabels([]);
      return;
    }
    const v = editor.ensureViewport(w, h);
    const resolved = editor.resolved(st.levelId);
    const idx = p.levels.findIndex((l) => l.id === st.levelId);
    const below = st.showUnderlay && idx > 0 ? editor.resolved(p.levels[idx - 1]!.id) : null;
    const tool = editor.activeTool;
    const dl = buildPlanDrawList({
      project: p,
      levelId: st.levelId,
      resolved,
      below,
      viewport: v,
      theme,
      dark,
      selection: st.selection,
      hover: st.hover,
      preview: tool.preview(),
      inference: tool.inference(),
      showGrid: st.showGrid,
    });
    if (g) {
      g.gpu.setSize(w, h, dpr);
      plan.current.setViewport(v);
      plan.current.setDrawList(dl, v);
      g.gpu.render(plan.current.scene, plan.current.camera);
    } else if (cpuRef.current) {
      const c = cpuRef.current;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const ctx = c.getContext('2d');
      if (ctx) drawPlanCpu(ctx, dl, v, dpr);
    }
    setLabels(dl.labels);
  }, [size, ready, dark]);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame.current);
  }, [render, pv, ui.previewTick, ui.view, ui.levelId, ui.selection, ui.hover, ui.showGrid, ui.showUnderlay, ui.shadows, ui.edges, ui.tool]);

  // ---- ponteiro ----
  const pointers = useRef(new Map<number, Pt>());
  const drag = useRef<{ mode: 'tool' | 'pan' | 'orbit' | 'none'; start: Pt; last: Pt; moved: boolean }>({ mode: 'none', start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false });
  const gesture = useRef<{ dist: number; mid: Pt } | null>(null);
  const spaceDown = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Space') spaceDown.current = true;
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = host.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const info = (e: RPointerEvent, s: Pt): { raw: Pt; shift: boolean; ctrl: boolean; alt: boolean } => {
    const v = editor.viewport() as Viewport;
    return { raw: screenToWorld(v, s), shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey };
  };

  const onDown = (e: RPointerEvent): void => {
    host.current?.setPointerCapture(e.pointerId);
    const s = local(e);
    pointers.current.set(e.pointerId, s);
    const view = useUi.getState().view;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      drag.current.mode = 'none';
      return;
    }
    const panBtn = e.button === 1 || (e.button === 0 && (spaceDown.current || (view === '3d' && e.shiftKey)));
    if (e.button === 2) {
      if (view === 'plan') editor.activeTool.cancel();
      editor.bump();
      return;
    }
    if (view === '3d') {
      drag.current = { mode: panBtn ? 'pan' : 'orbit', start: s, last: s, moved: false };
      return;
    }
    if (panBtn) {
      drag.current = { mode: 'pan', start: s, last: s, moved: false };
      return;
    }
    if (!editor.viewport()) return;
    drag.current = { mode: 'tool', start: s, last: s, moved: false };
    editor.pointer('down', info(e, s));
  };

  const onMove = (e: RPointerEvent): void => {
    const s = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    const view = useUi.getState().view;
    if (gesture.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (view === 'plan') {
        editor.pan(mid.x - gesture.current.mid.x, mid.y - gesture.current.mid.y);
        editor.zoomWheel(mid, -(d - gesture.current.dist) * 2.4);
      } else {
        model.current.orbit.zoom(-(d - gesture.current.dist) * 3);
        model.current.orbit.pan(mid.x - gesture.current.mid.x, mid.y - gesture.current.mid.y);
        useUi.setState((st) => ({ previewTick: st.previewTick + 1 }));
      }
      gesture.current = { dist: d, mid };
      return;
    }
    const d = drag.current;
    if (view === '3d') {
      if (d.mode === 'orbit') model.current.orbit.orbit(s.x - d.last.x, s.y - d.last.y);
      else if (d.mode === 'pan') model.current.orbit.pan(s.x - d.last.x, s.y - d.last.y);
      if (d.mode !== 'none') {
        d.last = s;
        useUi.setState((st) => ({ previewTick: st.previewTick + 1 }));
      }
      return;
    }
    if (d.mode === 'pan') {
      editor.pan(s.x - d.last.x, s.y - d.last.y);
      d.last = s;
      return;
    }
    const v = editor.viewport();
    if (!v) return;
    const inf = info(e, s);
    useUi.setState({ cursor: inf.raw, snapKind: editor.activeTool.inference()?.kind ?? '' });
    if (d.mode === 'tool') {
      if (!d.moved && Math.hypot(s.x - d.start.x, s.y - d.start.y) > 3) d.moved = true;
      editor.pointer(d.moved ? 'drag' : 'move', inf);
      d.last = s;
    } else {
      editor.pointer('move', inf);
    }
  };

  const onUp = (e: RPointerEvent): void => {
    const s = local(e);
    pointers.current.delete(e.pointerId);
    if (gesture.current) {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    const d = drag.current;
    if (d.mode === 'tool') {
      const inf = info(e, s);
      editor.pointer('up', inf);
      if (!d.moved) editor.pointer('click', inf);
    }
    drag.current = { mode: 'none', start: s, last: s, moved: false };
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const st = useUi.getState();
    if (st.view === '3d') {
      model.current.orbit.zoom(e.deltaY);
      useUi.setState((x) => ({ previewTick: x.previewTick + 1 }));
    } else editor.zoomWheel(local(e), e.deltaY);
  };
  useEffect(() => {
    const el = host.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const v = editor.viewport();
  const cursorCss = ui.view === '3d' ? 'grab' : ui.tool === 'select' ? 'default' : 'crosshair';
  return (
    <div
      ref={host}
      className="canvas-wrap"
      style={{ cursor: cursorCss }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="labels" aria-hidden="true">
        {ui.view === 'plan' && v
          ? labels.map((l, i) => {
              const sp = worldToScreen(v, l.at);
              return (
                <span key={i} className="dim-label" style={{ left: sp.x + (l.dx ?? 0), top: sp.y + (l.dy ?? 0) }}>
                  {l.text}
                </span>
              );
            })
          : null}
      </div>
      {ui.gpu === 'cpu' && <div className="cpu-note">Sem GPU: planta em modo CPU. O 3D fica indisponível.</div>}
      {ui.gpu === 'cpu' && ui.view === '3d' && (
        <div className="hint" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--sheet)' }}>
          Este navegador não oferece WebGL nem WebGPU. Use a planta.
        </div>
      )}
      <div className="cornerbtns">
        <button className="ibtn" title="Enquadrar tudo" onClick={() => (ui.view === 'plan' ? editor.zoomExtents() : (model.current.fit(), useUi.setState((x) => ({ previewTick: x.previewTick + 1 }))))}>
          <Icon name="fit" size={18} />
        </button>
      </div>
      {ui.view === 'plan' && ui.prompt ? (
        <div className="typebox" role="status">
          <span className="cap">{ui.prompt}</span>
          <span className="buf" aria-live="polite">{ui.typed}</span>
          <span className="cap">Enter confirma</span>
        </div>
      ) : null}
    </div>
  );
}
