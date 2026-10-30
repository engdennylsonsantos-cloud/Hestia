import type { SheetDrawList } from '@hestia/render';
import type { SheetViewport } from '@hestia/model';
import type { InnerBox, PaperBox, PaperPoint } from './sheetSelection.ts';

/**
 * Encaixe (snap) e guias inteligentes ao mover uma vista na prancha: bordas e centros das outras vistas, as bordas e o
 * centro da área de desenho, linhas de referência do desenho (faces de parede, eixos, arestas) e, opcionalmente, a
 * grade de 5 mm. É o comportamento do *Align* do Revit e dos guias do ArchiCAD, reduzido ao que a prancha precisa.
 */

export interface SnapGuide {
  /** `v` = linha vertical (x constante); `h` = horizontal (y constante). */
  axis: 'v' | 'h';
  /** Coordenada da guia em mm de papel. */
  at: number;
}

/** Linha de referência do desenho em mm de papel (`v` = x constante, `h` = y constante). */
export interface SnapLine {
  axis: 'v' | 'h';
  at: number;
}

export interface SnapTargets {
  boxes: readonly PaperBox[];
  inner: InnerBox;
  /** Passo da grade em mm; ausente = sem encaixe na grade. */
  step?: number;
  /** Linhas de referência extras (mm de papel), ex.: faces de parede desenhadas dentro das vistas. */
  lines?: readonly SnapLine[];
}

export interface SnapOptions {
  /** Tolerância em mm de papel (o chamador converte px de tela para mm). */
  tolMm?: number;
}

export interface SnapResult {
  box: PaperBox;
  guides: SnapGuide[];
  /** Deslocamento aplicado em mm. */
  delta: PaperPoint;
}

export const SNAP_TOL_MM = 3;

/** Máximo de linhas consideradas por eixo; o excedente é descartado em silêncio para não pesar no arraste. */
export const MAX_SNAP_LINES_PER_AXIS = 200;

interface Candidate {
  delta: number;
  at: number;
}

/** Menor candidato por eixo, dentro da tolerância. Empate mantém o primeiro (área > vistas > linhas > grade). */
function best(cands: Candidate[], tol: number): Candidate | null {
  let out: Candidate | null = null;
  for (const c of cands) {
    if (Math.abs(c.delta) > tol) continue;
    if (!out || Math.abs(c.delta) < Math.abs(out.delta) - 1e-9) out = c;
  }
  return out;
}

/** Bordas e centros de uma caixa: [esquerda, centro, direita] em x e [base, meio, topo] em y. */
const edgesX = (b: PaperBox): number[] => [b.x, b.x + b.w / 2, b.x + b.w];
const edgesY = (b: PaperBox): number[] => [b.y, b.y + b.h / 2, b.y + b.h];

/**
 * Coordenadas únicas das linhas por eixo: descarta valores não finitos, duplicatas (tolerância de 1e-6) e o excedente
 * acima de {@link MAX_SNAP_LINES_PER_AXIS}. A ordem original é preservada, então o desempate fica estável.
 */
function uniqueLineCoords(lines: readonly SnapLine[] | undefined): { x: number[]; y: number[] } {
  const out: { x: number[]; y: number[] } = { x: [], y: [] };
  if (!lines) return out;
  for (const l of lines) {
    if (!Number.isFinite(l.at)) continue;
    const bucket = l.axis === 'v' ? out.x : out.y;
    if (bucket.length >= MAX_SNAP_LINES_PER_AXIS) continue;
    if (bucket.some((v) => Math.abs(v - l.at) <= 1e-6)) continue;
    bucket.push(l.at);
  }
  return out;
}

/**
 * Encaixa a caixa movida nas bordas/centros das outras vistas, na área de desenho, nas linhas de referência e na grade.
 * Devolve a caixa ajustada e as guias a desenhar (uma por eixo quando houve encaixe).
 */
export function snapMove(box: PaperBox, targets: SnapTargets, opts: SnapOptions = {}): SnapResult {
  const tol = opts.tolMm ?? SNAP_TOL_MM;
  const cx: Candidate[] = [];
  const cy: Candidate[] = [];
  const targetX: number[] = [targets.inner.x0, (targets.inner.x0 + targets.inner.x1) / 2, targets.inner.x1];
  const targetY: number[] = [targets.inner.y0, (targets.inner.y0 + targets.inner.y1) / 2, targets.inner.y1];
  for (const b of targets.boxes) {
    targetX.push(...edgesX(b));
    targetY.push(...edgesY(b));
  }

  // Linhas do desenho entram na mesma disputa das bordas: vencedor é o menor delta absoluto.
  const lineCoords = uniqueLineCoords(targets.lines);
  targetX.push(...lineCoords.x);
  targetY.push(...lineCoords.y);

  for (const moving of edgesX(box)) for (const t of targetX) cx.push({ delta: t - moving, at: t });
  for (const moving of edgesY(box)) for (const t of targetY) cy.push({ delta: t - moving, at: t });

  const step = targets.step;
  if (step !== undefined && step > 0) {
    // Grade: encaixa a borda esquerda e a base na múltiplo mais próximo (as guias caem na borda).
    const gx = Math.round(box.x / step) * step - box.x;
    const gy = Math.round(box.y / step) * step - box.y;
    cx.push({ delta: gx, at: box.x + gx });
    cy.push({ delta: gy, at: box.y + gy });
  }

  const bx = best(cx, tol);
  const by = best(cy, tol);
  const delta = { x: bx?.delta ?? 0, y: by?.delta ?? 0 };
  const guides: SnapGuide[] = [];
  if (bx) guides.push({ axis: 'v', at: bx.at });
  if (by) guides.push({ axis: 'h', at: by.at });
  return { box: { ...box, x: box.x + delta.x, y: box.y + delta.y }, guides, delta };
}

/**
 * Guias para alinhar a caixa às bordas/centros das outras vistas e às linhas de referência, sem mover (usado ao
 * desenhar a seleção). `lines` é opcional e mantém a assinatura anterior válida.
 */
export function alignmentGuides(
  box: PaperBox,
  targets: readonly PaperBox[],
  tolMm = 1,
  lines: readonly SnapLine[] = [],
): SnapGuide[] {
  const out: SnapGuide[] = [];
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= tolMm;
  const add = (axis: 'v' | 'h', at: number): void => {
    if (!out.some((g) => g.axis === axis && near(g.at, at))) out.push({ axis, at });
  };
  for (const t of targets) {
    for (const x of edgesX(box)) for (const tx of edgesX(t)) if (near(x, tx)) add('v', tx);
    for (const y of edgesY(box)) for (const ty of edgesY(t)) if (near(y, ty)) add('h', ty);
  }
  const lineCoords = uniqueLineCoords(lines);
  for (const lx of lineCoords.x) for (const x of edgesX(box)) if (near(x, lx)) add('v', lx);
  for (const ly of lineCoords.y) for (const y of edgesY(box)) if (near(y, ly)) add('h', ly);
  return out;
}

/**
 * Linhas do desenho (faces/eixos) para o encaixe ao arrastar: segmentos axiais longos de cada vista, deduplicados por
 * coordenada. O último grupo do `drawList` é o mobiliário da folha e fica de fora.
 */
export function snapLinesOf(drawList: SheetDrawList | null, viewports: readonly SheetViewport[]): SnapLine[] {
  if (!drawList) return [];
  const out: SnapLine[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < viewports.length; i++) {
    const v = viewports[i]!;
    const g = drawList.groups[i];
    if (!g) continue;
    const minLen = 0.15 * Math.max(v.size.w, v.size.h);
    for (const path of g.paths) {
      for (let k = 0; k + 1 < path.pts.length; k++) {
        const a = path.pts[k]!;
        const b = path.pts[k + 1]!;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const line = dx < 1e-6 && dy >= minLen ? { axis: 'v' as const, at: Math.round(a.x * 20) / 20 } : dy < 1e-6 && dx >= minLen ? { axis: 'h' as const, at: Math.round(a.y * 20) / 20 } : null;
        if (!line) continue;
        const key = `${line.axis}${line.at}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(line);
        if (out.length >= 300) return out;
      }
    }
  }
  return out;
}
