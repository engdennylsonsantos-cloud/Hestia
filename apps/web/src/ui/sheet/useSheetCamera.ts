import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { fitCamera, panBy, screenToPaper, zoomAt, zoomToBox, type SheetCamera, type SheetSize } from './sheetCamera.ts';

/** Pixels de tela por mm de papel a 100% (96 dpi). */
export const PX_PER_MM = 96 / 25.4;
/** Zoom de cada prancha fica guardado na sessão (como no Revit: não vai para o arquivo). */
const cameraBySheet = new Map<string, SheetCamera>();

export interface SheetCameraApi {
  view: SheetSize;
  camera: SheetCamera;
  setCamera: (updater: SheetCamera | ((c: SheetCamera) => SheetCamera)) => void;
  fit: () => void;
  zoomStep: (factor: number) => void;
  actualSize: () => void;
  zoomTo: (box: { x: number; y: number; w: number; h: number }) => void;
  /** Ponto de papel (mm, y para cima) de um evento de ponteiro. */
  paperAt: (e: { clientX: number; clientY: number }) => { x: number; y: number };
}

/**
 * Câmera da prancha: mede a área de desenho, guarda zoom/pan por prancha na sessão, trata a roda do mouse (zoom no
 * ponto sob o cursor) e expõe os comandos de enquadramento usados pela barra e pelos atalhos.
 */
export function useSheetCamera(sheetId: string, paper: SheetSize, containerRef: RefObject<HTMLElement | null>): SheetCameraApi {
  const [view, setView] = useState<SheetSize>({ w: 0, h: 0 });
  const [camera, setCamera] = useState<SheetCamera>(() => cameraBySheet.get(sheetId) ?? { cx: 210, cy: 148.5, zoom: 1 });
  const camRef = useRef(camera);
  camRef.current = camera;

  // Enquadra na primeira abertura da prancha e só então guarda a câmera (trocar de aba mantém o zoom de cada uma).
  const fitted = useRef<string | null>(cameraBySheet.has(sheetId) ? sheetId : null);
  const saved = useRef<SheetCamera | undefined>(cameraBySheet.get(sheetId));
  useEffect(() => {
    if (fitted.current !== sheetId) return;
    cameraBySheet.set(sheetId, camera);
  }, [sheetId, camera]);

  useEffect(() => {
    if (view.w < 10 || view.h < 10 || fitted.current === sheetId) return;
    fitted.current = sheetId;
    setCamera(saved.current ?? fitCamera(paper, view));
  }, [sheetId, paper, view]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Mede já no primeiro quadro (o ResizeObserver só avisa depois): evita a folha com viewBox 0 na abertura.
    const r0 = el.getBoundingClientRect();
    if (r0.width > 0 && r0.height > 0) setView({ w: Math.round(r0.width), h: Math.round(r0.height) });
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r) setView({ w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  // Roda do mouse: listener nativo para poder cancelar o scroll da página.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const pt = screenToPaper(camRef.current, view, e.clientX - r.left, e.clientY - r.top);
      const factor = Math.exp(-e.deltaY * 0.0016);
      setCamera((c) => zoomAt(c, factor, pt));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, view]);

  const fit = useCallback(() => setCamera(fitCamera(paper, view)), [paper, view]);
  const zoomStep = useCallback((factor: number) => setCamera((c) => zoomAt(c, factor, { x: c.cx, y: c.cy })), []);
  const actualSize = useCallback(() => setCamera((c) => ({ ...c, zoom: PX_PER_MM })), []);
  const zoomTo = useCallback((box: { x: number; y: number; w: number; h: number }) => setCamera(zoomToBox(box, view)), [view]);
  const paperAt = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = containerRef.current?.getBoundingClientRect();
      return screenToPaper(camRef.current, view, e.clientX - (r?.left ?? 0), e.clientY - (r?.top ?? 0));
    },
    [containerRef, view],
  );

  return { view, camera, setCamera, fit, zoomStep, actualSize, zoomTo, paperAt };
}

/** Pan relativo à câmera (arrastar a folha). */
export const panCamera = panBy;
