import { angularDimensionGeometry, dimensionGeometry, dimensionPoints, dimensionText, DIM_TEXT_MM, levelDimensions, levelRoomSeparators, levelTexts, planAnnotationsOf, unitsOf, type AreaPlan, type AreaPlanAnnotations, type Id, type Project, type TextNote } from '@hestia/model';
import { resolveAngularDimension } from '@hestia/engine';
import type { Vec2 } from '@hestia/geom';
import type { Viewport } from '../viewport.ts';
import { quadradoEm } from './marcadores.ts';
import { elementTagOps, noteLabel } from './tags.ts';
import { dimensionLabelOps } from './dimLabels.ts';
import { espessuraDeCorte, espessuraDeProjecao, type PlanPaint } from './style.ts';
import { espessuraVezes } from './espessura.ts';
import { areaPlanProfile, type Espessura, type FillOp, type LabelOp, type StrokeOp } from './types.ts';

/** Cores e seleção para desenhar as anotações. */
export interface NoteLook {
  ink: string;
  select: string;
  /** Cor do realce sob o cursor (ausente usa `select`). */
  hoverColor?: string;
  paper?: string;
  selection: Id[];
}

/** Espessura relativa das linhas de separação selecionadas (um pouco maior que a normal, traço mantido). */
const SEPARATOR_SELECTED_WIDTH = 1.5;

/** Largura média de um caractere, em múltiplos do corpo da fonte (a mesma estimativa da seleção em `annotationPick`). */
const CARACTERE_EM = 0.6;
/** Entrelinha, em múltiplos do corpo (o CSS de `.plan-note` usa 1,15; aqui um pouco de folga para a caixa). */
const LINHA_EM = 1.25;
/** Folga entre o texto e a moldura da caixa (`TextNote.frame`), em mm de papel. */
const MOLDURA_MM = 0.35;
/** Folga da caixa de seleção em volta do bloco, em mm de papel. */
const SELECAO_MM = 0.8;
/** Meio lado da alça quadrada do texto, em pixels de tela (o ponto de ancoragem é `text.at`). */
const ALCA_TEXTO_PX = 4;
/** Alfa do realce leve sob o cursor (o preenchimento não esconde o desenho de trás). */
const HOVER_ALPHA = 0.12;

/**
 * Linhas do texto: as quebras de `\n` e, quando há `width` (mm de papel), a quebra por largura. A largura do caractere
 * é estimada (`CARACTERE_EM` do corpo), a mesma conta da caixa da moldura e da seleção do texto.
 */
export function linhasDoTexto(text: string, fontMm: number, widthMm?: number): string[] {
  const paragrafos = text.split('\n');
  if (!widthMm || widthMm <= 0 || fontMm <= 0) return paragrafos;
  const porLinha = Math.max(1, Math.floor(widthMm / (fontMm * CARACTERE_EM)));
  const linhas: string[] = [];
  for (const paragrafo of paragrafos) {
    let atual = '';
    for (const palavra of paragrafo.split(' ')) {
      let resto = palavra;
      while (resto.length > porLinha) {
        if (atual) {
          linhas.push(atual);
          atual = '';
        }
        linhas.push(resto.slice(0, porLinha));
        resto = resto.slice(porLinha);
      }
      const candidata = atual ? `${atual} ${resto}` : resto;
      if (candidata.length <= porLinha) atual = candidata;
      else {
        linhas.push(atual);
        atual = resto;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Bloco do texto em metros: as linhas (quebradas como na tela) e a largura/altura da caixa. */
export interface TextBlockModel {
  lines: string[];
  /** Largura da caixa em metros (a de `width`, ou a estimada pelo maior verso). */
  w: number;
  /** Altura da caixa em metros (todas as linhas). */
  h: number;
}

/** Bloco de um texto em metros: `width` limita a largura e quebra as linhas; `height` é o corpo em mm de papel. */
export function textBlockModel(t: Pick<TextNote, 'text' | 'height' | 'width'>, escala: number): TextBlockModel {
  const mPerMm = escala / 1000;
  const fontMm = t.height > 0 ? t.height : DIM_TEXT_MM;
  const lines = linhasDoTexto(t.text, fontMm, t.width);
  const doVerso = Math.max(1, ...lines.map((l) => l.length)) * fontMm * CARACTERE_EM;
  const w = (t.width && t.width > 0 ? t.width : doVerso) * mPerMm;
  const h = Math.max(1, lines.length) * fontMm * LINHA_EM * mPerMm;
  return { lines, w, h };
}

/**
 * Ponto da alça de movimento: canto inferior esquerdo da caixa de seleção do texto. Fica fora do bloco (o texto é
 * desenhado por cima do canvas), para o quadradinho não sumir atrás das letras; é o mesmo ponto que `textGripAt` pega.
 */
export function alcaDoTextoEm(t: Pick<TextNote, 'at' | 'text' | 'height' | 'width' | 'rotation'>, escala: number): Vec2 {
  const b = textBlockModel(t, escala);
  const folga = (SELECAO_MM + MOLDURA_MM) * escala / 1000;
  const hw = b.w / 2 + folga;
  const hh = b.h / 2 + folga;
  const r = (t.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // Canto inferior esquerdo no referencial do texto: x negativo, y negativo (o eixo y do modelo aponta para cima).
  return { x: t.at.x + -hw * c - -hh * s, y: t.at.y + -hw * s + -hh * c };
}

/**
 * Retângulo do bloco (polígono fechado) centrado em `at`, girado por `rotation` graus (o mesmo sentido do texto na
 * planta) e com `folga` em metros em cada lado. É a caixa da moldura, da seleção e do realce sob o cursor.
 */
export function blocoEm(at: Vec2, w: number, h: number, rotation: number, folga = 0): Vec2[] {
  const hw = w / 2 + folga;
  const hh = h / 2 + folga;
  const r = (rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: at.x + x! * c - y! * s, y: at.y + x! * s + y! * c }));
}

/**
 * Anotações que a vista desenha: as próprias da planta de área (`plan.annotations`) ou, sem elas, as do nível. O perfil
 * da vista filtra o que aparece (a mesma regra de `build.ts`), para o destaque não cercar anotação oculta.
 */
export function drawnAnnotations(p: Project, levelId: Id, plan?: AreaPlan): AreaPlanAnnotations {
  const all: AreaPlanAnnotations = plan?.annotations ? planAnnotationsOf(plan) : annotationsOfLevel(p, levelId);
  if (!plan) return all;
  const prof = areaPlanProfile(plan);
  return {
    dimensions: prof.dimensions ? all.dimensions : [],
    texts: prof.texts ? all.texts : [],
    detailLines: prof.detail ? all.detailLines : [],
    detailRegions: prof.detail ? all.detailRegions : [],
    tags: prof.tags ? all.tags : [],
  };
}

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
 * Anotações do nível no mesmo formato da vista (`AreaPlanAnnotations`): é o fallback da planta de área quando ela ainda
 * não tem anotações próprias. As linhas de separação continuam no nível e não entram neste conjunto.
 */
export function annotationsOfLevel(p: Project, levelId: Id): AreaPlanAnnotations {
  const level = p.levels.find((x) => x.id === levelId);
  return {
    dimensions: levelDimensions(p, levelId),
    texts: levelTexts(p, levelId),
    detailLines: level?.detailLines ?? [],
    detailRegions: level?.detailRegions ?? [],
    tags: level?.tags ?? [],
  };
}

/**
 * Cotas e textos do nível na planta (decisão 0019). Só desenha com a categoria 'annotation' visível; a espessura é a de
 * corte dela. O texto do valor sai centrado acima da linha de cota, com o tamanho de `DIM_TEXT_MM` em papel.
 *
 * `annotations` (planta de área) substitui as anotações do nível: usa as cotas, textos, linhas/regiões de detalhe e
 * etiquetas de elemento DA VISTA, sem somar as do nível. Sem ele, o comportamento é o de sempre. As linhas de separação
 * de ambiente não são anotação de vista: continuam vindo do nível (com `annotations`, o chamador as desenha).
 */
export function noteOps(p: Project, levelId: Id, pt: PlanPaint, look: NoteLook, scale: number, v?: Viewport, annotations?: AreaPlanAnnotations): NoteOps {
  const out: NoteOps = { fills: [], strokes: [], labels: [] };
  if (!pt.visible) return out;
  const color = pt.color ?? look.ink;
  const picked = (id: Id): boolean => look.selection.includes(id);
  const mPerMm = scale / 1000;
  const level = p.levels.find((x) => x.id === levelId);
  const dimensions = annotations ? annotations.dimensions : levelDimensions(p, levelId);
  const texts = annotations ? annotations.texts : levelTexts(p, levelId);
  const detailLines = annotations ? annotations.detailLines : (level?.detailLines ?? []);
  const detailRegions = annotations ? annotations.detailRegions : (level?.detailRegions ?? []);
  const corte = espessuraDeCorte(pt);
  const projecao = espessuraDeProjecao(pt);
  // Trechos curtos (valor maior que o trecho) saem com rótulo afastado; `lane` alterna as alturas entre vizinhos.
  let lane = 0;
  for (const d of dimensions) {
    const textMm = d.textHeight ?? DIM_TEXT_MM;
    const c = picked(d.id) ? look.select : color;
    if (d.angular) {
      const rd = resolveAngularDimension(p, levelId, d);
      const g = angularDimensionGeometry(rd);
      if (!g) continue;
      out.strokes.push({ pts: g.arc, closed: false, ...corte, color: c, alpha: 1 });
      for (const seg of g.extensions) out.strokes.push({ pts: [...seg], closed: false, ...projecao, color: c, alpha: 1 });
      for (const seg of g.ticks) out.strokes.push({ pts: [...seg], closed: false, ...corte, color: c, alpha: 1 });
      out.labels.push({ ...noteLabel(g.textAt, dimensionText(p, rd, unitsOf(p)), textMm, scale, g.textRotation), ...(picked(d.id) ? { color: c } : {}) });
      continue;
    }
    const { a, b } = dimensionPoints(p, d);
    const base = dimensionGeometry(a, b, d.offset, mPerMm, textMm);
    const g = d.textAt ? dimensionGeometry(a, b, d.offset, mPerMm, textMm, d.textAt) : base;
    for (const seg of [g.line, ...g.extensions]) out.strokes.push({ pts: [...seg], closed: false, ...corte, color: c, alpha: 1 });
    out.strokes.push(...dimensionMarkStrokes(g, d.tickStyle ?? 'slash', mPerMm, c, corte));
    if (d.textAt && Math.hypot(d.textAt.x - base.textAt.x, d.textAt.y - base.textAt.y) > 0.002) out.strokes.push({ pts: [{ x: (g.line[0].x + g.line[1].x) / 2, y: (g.line[0].y + g.line[1].y) / 2 }, d.textAt], closed: false, ...projecao, color: c, alpha: 1 });
    const lab = dimensionLabelOps(g, d.offset, dimensionText(p, d, unitsOf(p)), textMm, scale, mPerMm, lane, c, corte, v);
    if (lab.short) lane++;
    out.labels.push(...lab.labels);
    out.strokes.push(...lab.strokes);
  }
  for (const t of texts) {
    const selecionado = picked(t.id);
    const c = selecionado ? look.select : color;
    const mPorMm = scale / 1000;
    const bloco = textBlockModel(t, scale);
    if (t.leader) for (let i = 0; i < t.leader.length - 1; i++) out.strokes.push({ pts: [t.leader[i]!, t.leader[i + 1]!], closed: false, ...projecao, color: c, alpha: 1 });
    // Moldura do texto (`frame`): fundo do papel e contorno em volta do bloco, quebrado por `width` quando houver.
    if (t.frame) {
      const folga = MOLDURA_MM * mPorMm;
      out.fills.push({ polygons: [[blocoEm(t.at, bloco.w, bloco.h, t.rotation, folga)]], color: look.paper ?? '#fbfbfa', alpha: 1 });
      out.strokes.push({ pts: blocoEm(t.at, bloco.w, bloco.h, t.rotation, folga), closed: true, ...projecao, color: c, alpha: 1 });
    }
    // Seleção: caixa em volta do bloco e o quadradinho da alça no canto inferior esquerdo, fora do texto.
    if (selecionado) {
      out.strokes.push({ pts: blocoEm(t.at, bloco.w, bloco.h, t.rotation, (MOLDURA_MM + SELECAO_MM) * mPorMm), closed: true, widthPx: 2, color: look.select, alpha: 1 });
      const q = quadradoEm(alcaDoTextoEm(t, scale), ALCA_TEXTO_PX);
      out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
      out.strokes.push({ ...q.traco, widthPx: 1.5, color: look.select, alpha: 1 });
    }
    const label = noteLabel(t.at, t.text, t.height, scale, t.rotation);
    if (t.width) label.papel = { ...label.papel!, widthMm: t.width };
    // `whiteSpace: pre-wrap` preserva as quebras de `\n` (e as de `width`) no texto de tela; a cor de seleção tinge o texto.
    out.labels.push({ ...label, whiteSpace: 'pre-wrap', bold: t.bold, italic: t.italic, underline: t.underline, align: t.align, ...(selecionado ? { color: look.select } : {}) });
  }
  for (const line of detailLines) {
    const selected = picked(line.id);
    out.strokes.push({ pts: [line.a, line.b], closed: false, ...(selected ? espessuraVezes(projecao, 1.7) : projecao), color: selected ? look.select : color, alpha: 1, dash: line.style === 'dashed' ? [7, 4] : line.style === 'dotted' ? [1, 3] : undefined });
  }
  for (const region of detailRegions) {
    const ink = picked(region.id) ? look.select : color;
    if (region.mask) {
      out.labels.push({ at: region.boundary[0]!, text: '', maskBoundary: region.boundary, maskColor: look.paper ?? '#fbfbfa', maskBorderColor: ink });
    } else {
      out.fills.push({ polygons: [[region.boundary]], color: region.color ?? '#f5d782', alpha: 0.48 });
      out.strokes.push({ pts: region.boundary, closed: true, ...projecao, color: ink, alpha: 1 });
    }
  }
  // Sem anotações de vista, as linhas de separação saem daqui (como sempre). Com elas (planta de área), o chamador as
  // desenha no lugar e na cor de sempre: separador não é anotação da vista.
  if (!annotations) out.strokes.push(...roomSeparatorStrokes(p, levelId, pt, color, new Set(look.selection), look.select));
  // Etiquetas de elemento da vista (planta de área): mesmo desenho das etiquetas do nível, com os hóspedes do modelo.
  // Só entram quando a vista traz as suas anotações; sem elas, `build.ts` desenha as do nível à parte (como antes).
  if (annotations) {
    const comTags: Project = { ...p, levels: p.levels.map((x) => (x.id === levelId ? { ...x, tags: annotations.tags } : x)) };
    const tags = elementTagOps(comTags, levelId, pt, scale);
    out.strokes.push(...tags.strokes);
    out.labels.push(...tags.labels);
  }
  return out;
}

/** O que destacar nas anotações: a seleção (caixa e alça do texto) e o alvo sob o cursor (realce leve). */
export interface NoteTarget {
  selection?: readonly Id[];
  hover?: Id | null;
}

/**
 * Destaque de seleção e hover das anotações (textos e cotas) em camada própria: só a caixa, a alça do texto e o realce
 * leve sob o cursor. O texto e a cota continuam vindo de `noteOps` (a cor de seleção deles sai de lá, quando a geometria
 * é refeita), e aqui nada é redesenhado: a camada de hover pode ser refeita sem tocar na geometria do nível.
 *
 * A alça do texto é o quadradinho de `ALCA_TEXTO_PX` px em `text.at` — o mesmo ponto que o `selectTool` usa para pegar o
 * texto e arrastá-lo. Para cotas, a seleção continua só na cor; o hover cercar o valor com um realce leve.
 */
export function annotationHighlightOps(
  p: Project,
  levelId: Id,
  scale: number,
  look: Pick<NoteLook, 'select' | 'paper' | 'hoverColor'>,
  target: NoteTarget,
  annotations?: AreaPlanAnnotations,
): NoteOps {
  const out: NoteOps = { fills: [], strokes: [], labels: [] };
  const selected = new Set(target.selection ?? []);
  const hover = target.hover ?? null;
  if (selected.size === 0 && hover === null) return out;
  const a = annotations ?? drawnAnnotations(p, levelId);
  const mPerMm = scale / 1000;
  const hoverColor = look.hoverColor ?? look.select;
  const folga = (MOLDURA_MM + SELECAO_MM) * mPerMm;
  for (const t of a.texts) {
    const selecionado = selected.has(t.id);
    const alvo = !selecionado && hover === t.id;
    if (!selecionado && !alvo) continue;
    const bloco = textBlockModel(t, scale);
    if (alvo) {
      out.fills.push({ polygons: [[blocoEm(t.at, bloco.w, bloco.h, t.rotation, folga)]], color: hoverColor, alpha: HOVER_ALPHA });
      out.strokes.push({ pts: blocoEm(t.at, bloco.w, bloco.h, t.rotation, folga), closed: true, widthPx: 1.2, color: hoverColor, alpha: 0.7 });
      continue;
    }
    out.strokes.push({ pts: blocoEm(t.at, bloco.w, bloco.h, t.rotation, folga), closed: true, widthPx: 2, color: look.select, alpha: 1 });
    const q = quadradoEm(alcaDoTextoEm(t, scale), ALCA_TEXTO_PX);
    out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
    out.strokes.push({ ...q.traco, widthPx: 1.5, color: look.select, alpha: 1 });
  }
  // Cotas: o hover cerca o valor (a seleção já muda a cor da cota em `noteOps`).
  for (const d of a.dimensions) {
    if (hover !== d.id || selected.has(d.id)) continue;
    const textMm = d.textHeight ?? DIM_TEXT_MM;
    if (d.angular) {
      const rd = resolveAngularDimension(p, levelId, d);
      const g = angularDimensionGeometry(rd);
      if (!g) continue;
      const bloco = textBlockModel({ text: dimensionText(p, rd, unitsOf(p)), height: textMm }, scale);
      out.fills.push({ polygons: [[blocoEm(g.textAt, bloco.w, bloco.h, g.textRotation, folga)]], color: hoverColor, alpha: HOVER_ALPHA });
      out.strokes.push({ pts: blocoEm(g.textAt, bloco.w, bloco.h, g.textRotation, folga), closed: true, widthPx: 1.2, color: hoverColor, alpha: 0.7 });
      continue;
    }
    const { a: pa, b: pb } = dimensionPoints(p, d);
    const g = dimensionGeometry(pa, pb, d.offset, mPerMm, textMm, d.textAt);
    const bloco = textBlockModel({ text: dimensionText(p, d, unitsOf(p)), height: textMm }, scale);
    out.fills.push({ polygons: [[blocoEm(g.textAt, bloco.w, bloco.h, g.textRotation, folga)]], color: hoverColor, alpha: HOVER_ALPHA });
    out.strokes.push({ pts: blocoEm(g.textAt, bloco.w, bloco.h, g.textRotation, folga), closed: true, widthPx: 1.2, color: hoverColor, alpha: 0.7 });
  }
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
