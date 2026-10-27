import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { DARK, LIGHT, ModelScene, PlanFrame, PlanScene, contadores, createGpu, drawPlanOnCanvas, pickElement, pickModelPoint, planFrameUpdateOf, sameView, screenToWorld, type GpuContext, type LabelOp, type PlanDrawList, type Viewport } from '@hestia/render';
import { view3dOf } from '@hestia/model';
import { useShallow } from 'zustand/react/shallow';
import { editor } from '../editor/controller.ts';
import { usePerimeter } from '../editor/perimeter.ts';
import { hoverSectionAt, sectionPickAt } from '../editor/sectionPick.ts';
import { clickSelect3d, useUi } from '../editor/state.ts';
import { thinLinesOn } from '../editor/graphicsActions.ts';
import { buildSectionFrame } from './SectionCanvas.tsx';
import { PlanLabels, type PlanLabelsHandle } from './PlanLabels';
import { ViewportOverlays } from './ViewportOverlays.tsx';
import { abrirMenuDeContexto, viewDoMenu } from './useCanvasContextMenu.ts';
import { useDark } from './useDark.ts';
import { criarMontagemVista3d, type Montagem3dProgressiva } from './montagem3dProgressiva.ts';
import { QuadroPlanta } from './quadroPlanta.ts';
import { medirQuadro, useContarCommitPerf, usePerfDaUrl } from '../debug/perf/index.ts';
import { gestosComShift } from './planGestos.ts';

interface Pt {
  x: number;
  y: number;
}

/** Rótulos vazios com referência fixa: a planta compara por identidade para não atualizar o estado à toa. */
const NO_LABELS: LabelOp[] = [];

/** Desenha o plano (GPU ou CPU) e o 3D, e traduz o ponteiro em chamadas ao editor. */
export function ViewportCanvas(): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<PlanLabelsHandle>(null);
  const gpuRef = useRef<{ gpu: GpuContext; canvas: HTMLCanvasElement } | null>(null);
  const cpuRef = useRef<HTMLCanvasElement | null>(null);
  const plan = useRef(new PlanScene());
  const model = useRef(new ModelScene());
  // Ganchos de depuração (?debug=1): câmera orbital do 3D e a cena 3D (o e2e conta as peças do modelo).
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) Object.assign(window, { __hestia3d: model.current.orbit, __hestia3dModel: model.current });
  const modelKey = useRef('');
  const montagem = useRef<Montagem3dProgressiva | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Rótulos da planta e a vista deles: o estado só troca quando o conteúdo ou a vista muda (`publish`).
  const [labels, setLabels] = useState<LabelOp[]>(NO_LABELS);
  const [labelView, setLabelView] = useState<Viewport | null>(null);
  const [ready, setReady] = useState(false);
  const dark = useDark();
  // Esboço do perímetro em edição: só a planta o desenha; o quadro refaz a sobreposição quando ele muda.
  const perim = usePerimeter();
  const sketch = useMemo(
    () => (perim.active && perim.draft && perim.result ? { draft: perim.draft, result: perim.result, hover: perim.hoverId, box: perim.selectionBox } : null),
    [perim.active, perim.draft, perim.result, perim.hoverId, perim.selectionBox],
  );
  // Só o que a própria tela lê: a mudança de outros campos não re-renderiza a planta (o redesenho sai do agendamento abaixo).
  const ui = useUi(useShallow((s) => ({ view: s.view, gpu: s.gpu, prompt: s.prompt, typed: s.typed, hover: s.hover, tool: s.tool })));
  const selection = useUi((s) => s.selection);
  const frame = useRef(0);
  const dprRef = useRef(1);
  const planFrame = useRef<PlanFrame | null>(null);
  const quadroRef = useRef<QuadroPlanta | null>(null); // provisório na hora, exato depois da pintura (quadroPlanta.ts)
  const shownLabels = useRef<LabelOp[]>(NO_LABELS);
  const shownView = useRef<Viewport | null>(null);

  // Instrumentação de desempenho (Fase 0.2): só liga com `?perf=1`; sem o parâmetro não há medição nem overlay.
  // Os hooks rodam antes do boot para que o contexto criado em seguida já saia instrumentado.
  usePerfDaUrl();
  useContarCommitPerf();

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
        contadores.definirBackend('cpu');
        contadores.marcarTimerGpu('sem-gpu');
      }
      modelKey.current = '';
      // Troca de dispositivo (GPU ou CPU): a cena da planta começa do zero.
      planFrame.current?.reset(); quadroRef.current?.invalidar();
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
      montagem.current?.cancelar();
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

  /** Publica os rótulos e a vista só quando mudam: a planta não re-renderiza a cada quadro (`null`: sem planta). */
  const publish = (next: LabelOp[], vw: Viewport | null): void => {
    if (next !== shownLabels.current) setLabels((shownLabels.current = next));
    if (!sameView(shownView.current, vw)) setLabelView((shownView.current = vw && { ...vw }));
  };

  // ---- desenho ----
  const renderQuadro = useCallback(() => {
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
        // Os níveis entram em fatias (ver montagem3dProgressiva.ts): a tela não espera o projeto inteiro.
        montagem.current ??= criarMontagemVista3d(m, (id) => editor.resolved(id), (id) => editor.resolucaoPronta(id));
        montagem.current.iniciar(p, { edges: v3.edges, shadows: v3.shadows, dark }, st.levelId);
      }
      // Realce da seleção e do elemento sob o cursor: só a sobreposição muda, o modelo não é refeito (decisão 0016 §4).
      m.highlight(st.selection, st.hover);
      g.gpu.renderer.shadowMap.enabled = v3.shadows;
      g.gpu.setSize(w, h, dpr);
      // Animação da câmera (ViewCube, Início): avança a cada quadro e pede o próximo enquanto anima.
      if (m.orbit.step(performance.now())) useUi.setState((x) => ({ previewTick: x.previewTick + 1 }));
      m.orbit.setAspect(w, h);
      m.sombra.aplicar(g.gpu.renderer);
      safeRender(g, m.scene, m.orbit.camera);
      publish(NO_LABELS, null);
      return;
    }
    const v = editor.ensureViewport(w, h);
    const pf = (planFrame.current ??= new PlanFrame(plan.current));
    // Vista de corte: a cena é refeita por inteiro (ver `PlanFrame`).
    if (st.view === 'section') {
      pf.reset(); quadroRef.current?.invalidar();
      const dl: PlanDrawList = buildSectionFrame(v, dark) ?? { background: theme.bg, fills: [], strokes: [], labels: [] };
      if (g) { g.gpu.setSize(w, h, dpr); plan.current.setViewport(v); plan.current.setDrawList(dl, v); safeRender(g, plan.current.scene, plan.current.camera); }
      else if (cpuRef.current) drawPlanOnCanvas(cpuRef.current, dl, v, dpr);
      publish(dl.labels, v);
      labelLayer.current?.syncView(v);
      return;
    }
    // Planta: pan e zoom mudam a câmera; geometria, sobreposição e grade só são refeitas quando a chave muda (PlanFrame).
    const quadro = (quadroRef.current ??= new QuadroPlanta({ provisorios: editor.provisorios, resolverReferencia: (id) => editor.resolved(id, false), pendente: (id) => editor.fluxo.pendente(id), pedirQuadro: () => useUi.setState((x) => ({ previewTick: x.previewTick + 1 })) }));
    // Grade visível quando o botão de grade está ligado ou quando a captura por grade está ativa (o que se captura, se vê).
    const gridOn = st.showGrid || (st.options.snap?.enabled !== false && !!st.options.snap?.grid);
    const extra = quadro.desenhar({ quadro: pf, cena: g ? plan.current : null, v, tema: theme, nivel: st.levelId, versao: editor.store.version, contexto: [dark, !!g, v.zoom, st.showUnderlay, st.underlayLevel, st.showRoofProjection, gridOn].join('|'), atualizar: () => planFrameUpdateOf({ project: p, version: editor.store.version, levelId: st.levelId, v, theme, dark, gpu: !!g, showGrid: gridOn, showUnderlay: st.showUnderlay, underlayLevel: st.underlayLevel, showRoofProjection: st.showRoofProjection, thinLines: thinLinesOn(p, { levelId: st.levelId }), selection: st.selection, hover: st.hover, preview: editor.activeTool.preview(), inference: editor.activeTool.inference(), resolve: quadro.resolver, sketch }) });
    if (g) {
      g.gpu.setSize(w, h, dpr);
      plan.current.setViewport(v);
      safeRender(g, plan.current.scene, plan.current.camera);
    } else if (cpuRef.current) drawPlanOnCanvas(cpuRef.current, QuadroPlanta.comProvisorio(pf.drawList(theme), extra), v, dpr);
    publish(pf.labels, v);
    // Alinha a camada HTML de texto no mesmo requestAnimationFrame do canvas da planta.
    // Isso evita o atraso de um render React entre a câmera e o texto da cota durante pan/zoom.
    labelLayer.current?.syncView(v);
  }, [size, ready, dark, sketch]);

  // Um quadro do rAF: o trabalho de CPU é medido do começo ao fim do desenho; com `?perf=1`, os contadores agrupam
  // draw calls/upload/rebuilds entre estes dois pontos. Sem perf, os métodos são no-op.
  const render = useCallback(() => medirQuadro(renderQuadro), [renderQuadro]);

  // Qualquer mudança do estado agenda um quadro; o quadro decide o que refazer (ver PlanFrame).
  useEffect(() => {
    const sched = (): void => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(render); };
    sched();
    const off = useUi.subscribe(sched);
    return () => { off(); cancelAnimationFrame(frame.current); };
  }, [render]);

  // ---- ponteiro ----
  const pointers = useRef(new Map<number, Pt>());
  /** `pick`: o ponteiro foi o botão esquerdo sem Espaço, então um clique sem arrasto na vista 3D escolhe um elemento (Shift pode ser pan). */
  /** `shiftPending`: Shift com ferramenta de desenho na planta; sem arrasto é clique com shift (trava ortogonal), com arrasto vira pan. */
  const drag = useRef<{ mode: 'tool' | 'pan' | 'orbit' | 'none'; start: Pt; last: Pt; moved: boolean; pick: boolean; shiftPending?: boolean }>({ mode: 'none', start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false, pick: false });
  const gesture = useRef<{ dist: number; mid: Pt } | null>(null);
  const spaceDown = useRef(false);
  /** Botão direito pressionado: solto sem arrasto (mais de 4 px) abre o menu de contexto. */
  const rightPress = useRef<{ start: Pt; moved: boolean } | null>(null);

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
    // Na planta, Shift com a Selecionar é da seleção (soma e janela), inclusive no Selecionar do esboço do perímetro. Com
    // ferramenta de desenho, Shift sem arrasto trava ortogonal (vai à ferramenta com shift); só vira pan se o ponteiro se
    // mover (onMove). Na vista de corte, Shift arrasta a vista.
    const { shiftDesenho: shiftDraw, shiftPan } = gestosComShift({
      view, botao: e.button, shift: e.shiftKey, espaco: spaceDown.current,
      ferramenta: editor.activeTool.id, selecionandoNoEsboco: editor.perimetro.selecionandoLinhas(),
    });
    const isPanReq = (isMiddleBtn && !e.shiftKey) || (e.button === 0 && (spaceDown.current || shiftPan));
    // Botão direito: o menu abre ao soltar sem arrasto (onUp). Não cancela a ferramenta: "Cancelar" está no menu.
    if (e.button === 2) { rightPress.current = { start: s, moved: false }; return; }
    if (view === '3d') {
      const mode = isOrbitReq ? 'orbit' : isPanReq ? 'pan' : (e.button === 0 ? 'orbit' : 'none');
      drag.current = { mode, start: s, last: s, moved: false, pick: e.button === 0 && !spaceDown.current && !e.altKey };
      // Ao pressionar, o realce some: enquanto arrasta, o cursor orbita e não destaca.
      if (useUi.getState().hover) useUi.setState({ hover: null });
      return;
    }
    // Na vista de corte não há ferramentas: o botão esquerdo arrasta a vista e, sem arrasto, seleciona (decisão 0016).
    if (isPanReq || isMiddleBtn || view === 'section') {
      // Corte: sem Espaço, o botão esquerdo também seleciona no soltar se não houve arrasto (Shift incluso).
      drag.current = { mode: 'pan', start: s, last: s, moved: false, pick: view === 'section' && e.button === 0 && !spaceDown.current };
      if (view === 'section' && useUi.getState().hover) useUi.setState({ hover: null });
      return;
    }
    if (!editor.viewport()) return;
    drag.current = { mode: 'tool', start: s, last: s, moved: false, pick: false, shiftPending: shiftDraw };
    // Com Shift pendente, o 'down' só vai ao soltar (ver onUp), para não começar um gesto da ferramenta antes de saber se é pan.
    if (!shiftDraw) editor.pointer('down', info(e, s));
  };

  const onMove = (e: RPointerEvent): void => {
    const s = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    if (rightPress.current) { if (Math.hypot(s.x - rightPress.current.start.x, s.y - rightPress.current.start.y) > 4) rightPress.current.moved = true; return; }
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
    // Shift pendente que passou de ~3 px é arrasto da vista (pan), como antes; a ferramenta não recebe o gesto.
    if (d.shiftPending && Math.hypot(s.x - d.start.x, s.y - d.start.y) > 3) {
      d.shiftPending = false; d.mode = 'pan'; d.moved = true;
      editor.pan(s.x - d.start.x, s.y - d.start.y);
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
    if (rightPress.current && e.button === 2) {
      const rp = rightPress.current;
      rightPress.current = null;
      // Alvo sob o cursor: 3D e corte pelo pick da vista; planta pelo realce da Selecionar (sem ferramenta, é null).
      if (!rp.moved) abrirMenuDeContexto(e.clientX, e.clientY, useUi.getState().view === '3d' ? (elementAt3d(s)?.id ?? null) : useUi.getState().view === 'section' ? (sectionPickAt(s)?.id ?? null) : useUi.getState().hover, viewDoMenu(useUi.getState().view));
      return;
    }
    if (gesture.current) {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    const d = drag.current;
    if (d.mode === 'tool') {
      // Shift pendente sem arrasto: é um toque com shift (trava ortogonal) e a ferramenta recebe down, up e click.
      const inf = d.shiftPending ? { ...info(e, s), shift: true } : info(e, s);
      if (d.shiftPending) editor.pointer('down', inf);
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
    // Arrasto que começou sobre o seletor de escala deixa o foco no <select>, e aí Delete e os atalhos são ignorados: solta o foco.
    if (d.moved && document.activeElement?.tagName === 'SELECT') (document.activeElement as HTMLElement).blur();
    drag.current = { mode: 'none', start: s, last: s, moved: false, pick: false };
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const st = useUi.getState();
    if (st.view === '3d') {
      // Zoom para o ponto sob o cursor: ao aproximar, o target deriva em direção ao ponto 3D sob o cursor.
      // Isso faz a órbita subsequente girar ao redor do que o usuário estava inspecionando (comportamento Revit/Blender).
      if (e.deltaY < 0) {
        const s = local(e);
        const r = host.current!.getBoundingClientRect();
        const ndc = { x: (s.x / r.width) * 2 - 1, y: 1 - (s.y / r.height) * 2 };
        const hit = pickModelPoint(model.current.scene, model.current.orbit.camera, ndc);
        if (hit) {
          // Quanto mais rola o scroll, mais o target se move em direção ao ponto sob o cursor.
          // Factor pequeno: movimento suave e sem saltos; acumula com vários scrolls.
          const factor = Math.min(0.12, Math.abs(e.deltaY) * 0.001);
          const orb = model.current.orbit;
          orb.target.x += (hit.x - orb.target.x) * factor;
          orb.target.y += (hit.y - orb.target.y) * factor;
        }
      }
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
      <PlanLabels ref={labelLayer} labels={ui.view !== '3d' && labelView ? labels : NO_LABELS} v={labelView} />
      <ViewportOverlays host={host} model={model.current} selection={selection} ui={ui} />
    </div>
  );
}
