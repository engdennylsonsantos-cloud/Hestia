import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { DARK, LIGHT, ModelScene, PlanScene, buildPlanDrawList, createGpu, drawPlanCpu, hiddenSelectionOps, pickElement, pickModelPoint, planViewOf, screenToWorld, type GpuContext, type LabelOp, type PlanDrawList, type PlanTheme, type Viewport } from '@hestia/render';
import { resolveFloors, resolveRooms, resolveRoofs, resolveSlabs } from '@hestia/engine';
import { view3dOf, type Id, type Project } from '@hestia/model';
import { editor, useProjectVersion } from '../editor/controller.ts';
import { hoverSectionAt, sectionPickAt } from '../editor/sectionPick.ts';
import { clickSelect3d, useUi } from '../editor/state.ts';
import { thinLinesOn } from '../editor/graphicsActions.ts';
import { Icon } from './Icon.tsx';
import { SectionBadge, buildSectionFrame } from './SectionCanvas.tsx';
import { ViewCube } from './ViewCube.tsx';
import { PlanLabels } from './PlanLabels';
import { ViewControlBar } from './ViewControlBar.tsx';

/** Escuro se o usuário escolheu escuro, ou se o tema do host/sistema for escuro. */
export function useDark(): boolean {
  const theme = useUi((s) => s.theme);
  const read = (): boolean => {
    if (theme !== 'system') return theme === 'dark';
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    setDark(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (): void => setDark(read());
    mq.addEventListener('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', on);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return dark;
}

interface Pt {
  x: number;
  y: number;
}

/** Planta com o contorno fantasma dos selecionados fora do intervalo de vista (decisão 0013 §4): a planta não os desenha. */
function withHiddenSelection(dl: PlanDrawList, p: Project, levelId: Id, selection: Id[], theme: PlanTheme): PlanDrawList {
  const ghosts = hiddenSelectionOps(p, levelId, planViewOf(p, levelId), selection, theme);
  return ghosts.length ? { ...dl, strokes: [...dl.strokes, ...ghosts] } : dl;
}

/** Desenha o plano (GPU ou CPU) e o 3D, e traduz o ponteiro em chamadas ao editor. */
export function ViewportCanvas(): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const gpuRef = useRef<{ gpu: GpuContext; canvas: HTMLCanvasElement } | null>(null);
  const cpuRef = useRef<HTMLCanvasElement | null>(null);
  const plan = useRef(new PlanScene());
  const model = useRef(new ModelScene());
  // Gancho de depuração (?debug=1): câmera orbital do 3D para os testes no navegador.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) (window as unknown as { __hestia3d?: unknown }).__hestia3d = model.current.orbit;
  // Mesmo gancho para o e2e contar as peças da cena 3D (`scene`, o grupo com as malhas do modelo).
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) (window as unknown as { __hestia3dModel?: unknown }).__hestia3dModel = model.current;
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
  const bootRef = useRef<(prefer: 'auto' | 'webgl2' | 'cpu') => Promise<void>>(async () => {});
  useEffect(() => {
    let cancelled = false;
    const el = host.current!;
    const qs = new URLSearchParams(location.search);
    const teardown = (): void => {
      gpuRef.current?.gpu.dispose();
      gpuRef.current?.canvas.remove();
      cpuRef.current?.remove();
      gpuRef.current = null;
      cpuRef.current = null;
    };
    const boot = async (prefer: 'auto' | 'webgl2' | 'cpu'): Promise<void> => {
      teardown();
      const res = prefer === 'cpu' ? null : await createGpu(() => document.createElement('canvas'), prefer);
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      if (res) {
        res.canvas.setAttribute('aria-label', 'Área de desenho');
        el.prepend(res.canvas);
        res.gpu.renderer.shadowMap.enabled = true;
        gpuRef.current = res;
        res.gpu.onLost((reason) => {
          useUi.setState({ status: `GPU reiniciada (${reason}). Trocando para WebGL2.` });
          void boot(res.gpu.backend === 'webgpu' ? 'webgl2' : 'cpu');
        });
        useUi.setState({ gpu: res.gpu.backend });
      } else {
        const c = document.createElement('canvas');
        c.setAttribute('aria-label', 'Área de desenho');
        el.prepend(c);
        cpuRef.current = c;
        useUi.setState({ gpu: 'cpu' });
      }
      modelKey.current = '';
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      setReady(true);
      useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
    };
    bootRef.current = boot;
    // WebGPU só quando pedido (?gpu=webgpu) até ser validado em GPU real; o padrão é WebGL2 (docs/decisoes/0003).
    const prefer = qs.get('cpu') === '1' ? 'cpu' : qs.get('gpu') === 'webgpu' ? 'auto' : 'webgl2';
    void boot(prefer);
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
      teardown();
    };
  }, []);

  const safeRender = (g: { gpu: GpuContext }, scene: Parameters<GpuContext['render']>[0], camera: Parameters<GpuContext['render']>[1]): void => {
    try {
      g.gpu.render(scene, camera);
    } catch {
      if (g.gpu.backend === 'webgpu') void bootRef.current('webgl2');
    }
  };

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
      // Sombras e arestas são da vista 3D no projeto (decisão 0015 §1): a chave inclui a versão do projeto.
      const v3 = view3dOf(p);
      const key = `${editor.store.version}|${dark}|${v3.shadows}|${v3.edges}|${v3.openOpenings === true}`;
      if (key !== modelKey.current) {
        modelKey.current = key;
        const levels = p.levels.map((l) => editor.resolved(l.id));
        m.update(p, levels, { edges: v3.edges, shadows: v3.shadows, dark });
        if (!st.seen3d) {
          m.fit();
          useUi.setState({ seen3d: true });
        }
      }
      // Realce da seleção e do elemento sob o cursor: só a sobreposição muda, o modelo não é refeito (decisão 0016 §4).
      m.highlight(st.selection, st.hover);
      g.gpu.renderer.shadowMap.enabled = v3.shadows;
      g.gpu.setSize(w, h, dpr);
      // Animação da câmera (ViewCube, Início): avança a cada quadro e pede o próximo enquanto anima.
      if (m.orbit.step(performance.now())) useUi.setState((x) => ({ previewTick: x.previewTick + 1 }));
      m.orbit.setAspect(w, h);
      safeRender(g, m.scene, m.orbit.camera);
      setLabels([]);
      return;
    }
    const v = editor.ensureViewport(w, h);
    const resolved = editor.resolved(st.levelId);
    const idx = p.levels.findIndex((l) => l.id === st.levelId);
    const below = st.showUnderlay && idx > 0 ? editor.resolved(p.levels[idx - 1]!.id) : null;
    const tool = editor.activeTool;
    const dl =
      st.view === 'section'
        ? (buildSectionFrame(v, dark) ?? { background: theme.bg, fills: [], strokes: [], labels: [] })
        : withHiddenSelection(
            buildPlanDrawList({
                project: p,
                levelId: st.levelId,
                resolved,
                below,
                belowFloors: below ? resolveFloors(p, p.levels[idx - 1]!.id) : undefined,
                belowSlabs: below ? resolveSlabs(p, p.levels[idx - 1]!.id) : undefined,
                belowRoofs: below ? resolveRoofs(p, p.levels[idx - 1]!.id) : undefined,
                belowRooms: below ? resolveRooms(p, p.levels[idx - 1]!.id) : undefined,
                viewport: v,
                theme,
                dark,
                selection: st.selection,
                hover: st.hover,
                preview: tool.preview(),
                inference: tool.inference(),
                showGrid: st.showGrid,
                // Linhas finas da planta do nível (decisão 0015): só na tela; a plotagem não passa a opção.
                thinLines: thinLinesOn(p, { levelId: st.levelId }),
                // Opção de vista (padrão ligada). Espalhada para compilar antes de PlanInput ganhar o campo (agente B3).
                ...{ showRoofProjection: st.showRoofProjection },
            }),
            p,
            st.levelId,
            st.selection,
            theme,
          );
    if (g) {
      g.gpu.setSize(w, h, dpr);
      plan.current.setViewport(v);
      plan.current.setDrawList(dl, v);
      safeRender(g, plan.current.scene, plan.current.camera);
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
  }, [render, pv, ui.previewTick, ui.view, ui.levelId, ui.sectionId, ui.selection, ui.hover, ui.showGrid, ui.showUnderlay, ui.showRoofProjection, ui.tool]);

  // ---- ponteiro ----
  const pointers = useRef(new Map<number, Pt>());
  /** `pick`: o ponteiro foi o botão esquerdo sem Espaço, então um clique sem arrasto na vista 3D escolhe um elemento (Shift pode ser pan). */
  const drag = useRef<{ mode: 'tool' | 'pan' | 'orbit' | 'none'; start: Pt; last: Pt; moved: boolean; pick: boolean }>({ mode: 'none', start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false, pick: false });
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
  /** Ponto do plano (m) da superfície 3D sob o cursor; null se o raio não atinge o modelo. */
  const pick3dAt = (s: Pt): Pt | null => {
    const r = host.current!.getBoundingClientRect();
    return pickModelPoint(model.current.scene, model.current.orbit.camera, { x: (s.x / r.width) * 2 - 1, y: 1 - (s.y / r.height) * 2 });
  };
  /** Elemento (parede, abertura, piso, laje, telhado, escada) sob o cursor na vista 3D; null no vazio (decisão 0016). */
  const elementAt3d = (s: Pt) => {
    const r = host.current!.getBoundingClientRect();
    return pickElement(model.current.scene, model.current.orbit.camera, { x: (s.x / r.width) * 2 - 1, y: 1 - (s.y / r.height) * 2 });
  };
  /**
   * Realce ao passar o cursor sobre o 3D. Um raio por quadro (não por evento de ponteiro): o último ponto ganha.
   */
  const hover3d = useRef<{ at: Pt | null; frame: number }>({ at: null, frame: 0 });
  const pickHover3d = (s: Pt): void => {
    hover3d.current.at = s;
    if (hover3d.current.frame) return;
    hover3d.current.frame = requestAnimationFrame(() => {
      hover3d.current.frame = 0;
      const at = hover3d.current.at;
      if (!at || useUi.getState().view !== '3d') return;
      const id = elementAt3d(at)?.id ?? null;
      if (useUi.getState().hover !== id) useUi.setState({ hover: id });
    });
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
    const isMiddleBtn = e.button === 1;
    const isOrbitReq = (isMiddleBtn && e.shiftKey) || (e.button === 0 && e.altKey);
    const isPanReq = (isMiddleBtn && !e.shiftKey) || (e.button === 0 && (spaceDown.current || (view !== '3d' && e.shiftKey)));
    if (e.button === 2) {
      if (view === 'plan') editor.activeTool.cancel();
      editor.bump();
      return;
    }
    if (view === '3d') {
      const mode = isOrbitReq ? 'orbit' : isPanReq ? 'pan' : (e.button === 0 ? 'orbit' : 'none');
      drag.current = { mode, start: s, last: s, moved: false, pick: e.button === 0 && !spaceDown.current && !e.altKey };
      // Ao pressionar, o realce some: enquanto arrasta, o cursor orbita e não destaca.
      if (useUi.getState().hover) useUi.setState({ hover: null });
      return;
    }
    // Na vista de corte não há ferramentas: o botão esquerdo arrasta a vista e, sem arrasto, seleciona (decisão 0016).
    if (isPanReq || isMiddleBtn || view === 'section') {
      drag.current = { mode: 'pan', start: s, last: s, moved: false, pick: view === 'section' && !isPanReq && e.button === 0 };
      if (view === 'section' && useUi.getState().hover) useUi.setState({ hover: null });
      return;
    }
    if (!editor.viewport()) return;
    drag.current = { mode: 'tool', start: s, last: s, moved: false, pick: false };
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
      if (view !== '3d') {
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
        if (!d.moved && Math.hypot(s.x - d.start.x, s.y - d.start.y) > 3) d.moved = true;
        d.last = s;
        useUi.setState((st) => ({ previewTick: st.previewTick + 1 }));
      } else pickHover3d(s);
      return;
    }
    if (d.mode === 'pan') {
      if (!d.moved && Math.hypot(s.x - d.start.x, s.y - d.start.y) > 3) d.moved = true;
      editor.pan(s.x - d.last.x, s.y - d.last.y);
      d.last = s;
      return;
    }
    // Sem botão pressionado, o corte realça o elemento sob o cursor (decisão 0016).
    if (view === 'section') { if (d.mode === 'none') hoverSectionAt(s); return; }
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
    // Clique sem arrasto na vista 3D. Com ferramenta que aceita pick3d: vai o ponto da superfície sob o cursor (no plano).
    // Sem essa ferramenta (seleção): seleciona o elemento sob o cursor; Shift/Ctrl acrescenta ou alterna (decisão 0016 §3).
    // Clique no vazio deseleciona.
    if (!d.moved && d.pick && useUi.getState().view === '3d') {
      const hit = pick3dAt(s);
      const el = elementAt3d(s);
      if (editor.activeTool.pick3d) {
        if (hit || el) {
          editor.pointer('click', { raw: hit ?? { x: 0, y: 0 }, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, hit3d: el?.id ?? null });
        } else {
          // Clique no vazio cancela/sai para a ferramenta de seleção
          editor.activeTool.cancel();
          clickSelect3d(null, false);
          useUi.setState({ status: 'Modo de seleção ativado.' });
        }
      } else {
        clickSelect3d(el?.id ?? null, e.shiftKey || e.ctrlKey || e.metaKey);
      }
    }
    // Clique sem arrasto no corte ou na elevação: o mesmo caminho da 3D (clickSelect3d, que usa selectionAfterClick).
    if (!d.moved && d.pick && useUi.getState().view === 'section') clickSelect3d(sectionPickAt(s)?.id ?? null, e.shiftKey || e.ctrlKey || e.metaKey);
    drag.current = { mode: 'none', start: s, last: s, moved: false, pick: false };
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

  /** Saiu do canvas: o realce do 3D e o do corte somem (o da planta não é tocado). */
  const onLeave = (): void => { if (['3d', 'section'].includes(useUi.getState().view) && useUi.getState().hover) useUi.setState({ hover: null }); };

  const v = editor.viewport();
  // Cursores refinados estilo Revit:
  // - No 3D: sobre objeto = pointer; arrastando órbita/pan = grabbing; repouso = default
  const isDragging = drag.current.mode !== 'none' && drag.current.moved;
  const cursorCss = ui.view === '3d'
    ? (isDragging ? 'grabbing' : (ui.hover ? 'pointer' : 'default'))
    : ui.view === 'section'
    ? (ui.hover ? 'pointer' : 'grab')
    : ui.tool === 'select'
    ? 'default'
    : 'crosshair';
  return (
    <div
      ref={host}
      className="canvas-wrap"
      style={{ cursor: cursorCss }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PlanLabels labels={ui.view !== '3d' && v ? labels : []} v={v} />
      {ui.gpu === 'cpu' && <div className="cpu-note">Sem GPU: planta em modo CPU. O 3D fica indisponível.</div>}
      {ui.gpu === 'cpu' && ui.view === '3d' && (
        <div className="hint" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--sheet)' }}>
          Este navegador não oferece WebGL nem WebGPU. Use a planta.
        </div>
      )}
      <div className="cornerbtns">
        <button className="ibtn" title="Enquadrar tudo" onClick={() => (ui.view !== '3d' ? editor.zoomExtents() : (model.current.fit(), useUi.setState((x) => ({ previewTick: x.previewTick + 1 }))))}>
          <Icon name="fit" size={18} />
        </button>
      </div>
      {ui.view === '3d' && ui.gpu !== 'cpu' ? <ViewCube model={model.current} /> : null}
      {ui.view === 'section' ? <SectionBadge /> : null}
      <ViewControlBar />
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
