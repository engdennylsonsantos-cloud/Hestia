import { dimensionGeometry, dimensionPoints, dimensionText, DIM_TEXT_MM, levelDimensions, levelRoomSeparators, levelTexts, unitsOf, type Id, type Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { noteLabel } from './tags.ts';
import { dimensionLabelOps } from './dimLabels.ts';
import { espessuraDeCorte, espessuraDeProjecao, type PlanPaint } from './style.ts';
import { espessuraVezes } from './espessura.ts';
import type { Espessura, FillOp, LabelOp, StrokeOp } from './types.ts';

/** Cores e seleção para desenhar as anotações. */
export interface NoteLook {
  ink: string;
  select: string;
  paper?: string;
  selection: Id[];
}

/** Espessura relativa das linhas de separação selecionadas (um pouco maior que a normal, traço mantido). */
const SEPARATOR_SELECTED_WIDTH = 1.5;

export interface NoteOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

/** Marcas configuráveis no extremo da linha de cota, medidas em papel para preservar legibilidade. */
function dimensionMarkStrokes(g: ReturnType<typeof dimensionGeometry>, style: 'slash' | 'arrow' | 'dot', mPerMm: number, color: string, esp: Espessura): StrokeOp[] {
  if (style === 'slash') return g.ticks.map((pts): StrokeOp => ({ pts: [...pts], closed: false, ...esp, color, alpha: 1 }));
  const a = g.line[0]; const b = g.line[1];
  const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1;
  const u = { x: dx / length, y: dy / length }; const n = { x: -u.y, y: u.x };
  const r = (style === 'dot' ? 1.2 : 2.5) * mPerMm;
  if (style === 'arrow') return [a, b].flatMap((tip, i) => {
    const inward = i === 0 ? u : { x: -u.x, y: -u.y };
    return [-1, 1].map((side): StrokeOp => ({ pts: [tip, { x: tip.x + inward.x * r + n.x * r * 0.45 * side, y: tip.y + inward.y * r + n.y * r * 0.45 * side }], closed: false, ...esp, color, alpha: 1 }));
  });
  return [a, b].map((center): StrokeOp => ({ pts: Array.from({ length: 16 }, (_, i) => ({ x: center.x + Math.cos(i * Math.PI / 8) * r, y: center.y + Math.sin(i * Math.PI / 8) * r })), closed: true, ...esp, color, alpha: 1 }));
}

/**
 * Cotas e textos do nível na planta (decisão 0019). Só desenha com a categoria 'annotation' visível; a espessura é a de
 * corte dela. O texto do valor sai centrado acima da linha de cota, com o tamanho de `DIM_TEXT_MM` em papel.
 */
export function noteOps(p: Project, levelId: Id, pt: PlanPaint, look: NoteLook, scale: number, v?: Viewport): NoteOps {
  const out: NoteOps = { fills: [], strokes: [], labels: [] };
  if (!pt.visible) return out;
  const color = pt.color ?? look.ink;
  const picked = (id: Id): boolean => look.selection.includes(id);
  const mPerMm = scale / 1000;
  const level = p.levels.find((x) => x.id === levelId);
  const corte = espessuraDeCorte(pt);
  const projecao = espessuraDeProjecao(pt);
  // Trechos curtos (valor maior que o trecho) saem com rótulo afastado; `lane` alterna as alturas entre vizinhos.
  let lane = 0;
  for (const d of levelDimensions(p, levelId)) {
    const { a, b } = dimensionPoints(p, d);
    const textMm = d.textHeight ?? DIM_TEXT_MM;
    const base = dimensionGeometry(a, b, d.offset, mPerMm, textMm);
    const g = d.textAt ? dimensionGeometry(a, b, d.offset, mPerMm, textMm, d.textAt) : base;
    const c = picked(d.id) ? look.select : color;
    for (const seg of [g.line, ...g.extensions]) out.strokes.push({ pts: [...seg], closed: false, ...corte, color: c, alpha: 1 });
    out.strokes.push(...dimensionMarkStrokes(g, d.tickStyle ?? 'slash', mPerMm, c, corte));
    if (d.textAt && Math.hypot(d.textAt.x - base.textAt.x, d.textAt.y - base.textAt.y) > 0.002) out.strokes.push({ pts: [{ x: (g.line[0].x + g.line[1].x) / 2, y: (g.line[0].y + g.line[1].y) / 2 }, d.textAt], closed: false, ...projecao, color: c, alpha: 1 });
    const lab = dimensionLabelOps(g, d.offset, dimensionText(p, d, unitsOf(p)), textMm, scale, mPerMm, lane, c, corte, v);
    if (lab.short) lane++;
    out.labels.push(...lab.labels);
    out.strokes.push(...lab.strokes);
  }
  for (const t of levelTexts(p, levelId)) {
    if (t.leader) for (let i = 0; i < t.leader.length - 1; i++) out.strokes.push({ pts: [t.leader[i]!, t.leader[i + 1]!], closed: false, ...projecao, color, alpha: 1 });
    const label = noteLabel(t.at, t.text, t.height, scale, t.rotation);
    if (t.width) label.papel = { ...label.papel!, widthMm: t.width };
    out.labels.push({ ...label, bold: t.bold, italic: t.italic, underline: t.underline, align: t.align });
  }
  for (const line of level?.detailLines ?? []) {
    const selected = picked(line.id);
    out.strokes.push({ pts: [line.a, line.b], closed: false, ...(selected ? espessuraVezes(projecao, 1.7) : projecao), color: selected ? look.select : color, alpha: 1, dash: line.style === 'dashed' ? [7, 4] : line.style === 'dotted' ? [1, 3] : undefined });
  }
  for (const region of level?.detailRegions ?? []) {
    const ink = picked(region.id) ? look.select : color;
    if (region.mask) {
      out.labels.push({ at: region.boundary[0]!, text: '', maskBoundary: region.boundary, maskColor: look.paper ?? '#fbfbfa', maskBorderColor: ink });
    } else {
      out.fills.push({ polygons: [[region.boundary]], color: region.color ?? '#f5d782', alpha: 0.48 });
      out.strokes.push({ pts: region.boundary, closed: true, ...projecao, color: ink, alpha: 1 });
    }
  }
  out.strokes.push(...roomSeparatorStrokes(p, levelId, pt, color, new Set(look.selection), look.select));
  return out;
}

/**
 * Linhas de separação de ambiente do nível (tracejadas e finas, como o Revit). Usam a cor e a espessura de projeção da
 * categoria 'anotação' e o traço das membranas. Só o nível pedido: a planta de outro nível não as recebe.
 */
export function roomSeparatorStrokes(p: Project, levelId: Id, pt: PlanPaint, color: string, selected: ReadonlySet<Id> = new Set(), select: string = color): StrokeOp[] {
  if (!pt.visible) return [];
  return levelRoomSeparators(p, levelId).map((r) => {
    const picked = selected.has(r.id);
    return { pts: [r.a, r.b], closed: false, ...(picked ? espessuraVezes(espessuraDeProjecao(pt), SEPARATOR_SELECTED_WIDTH) : espessuraDeProjecao(pt)), color: picked ? select : color, alpha: 1, dash: [6, 3] as [number, number] };
  });
}
