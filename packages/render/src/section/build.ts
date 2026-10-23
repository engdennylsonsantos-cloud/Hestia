import { union, voidCrossPaths, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import type { SectionBeyond, SectionOpening, SectionOrigin, SectionResult } from '@hestia/engine';
import { GRAPHICS_CATEGORIES, type GraphicsCategory, type Id, type Project } from '@hestia/model';
import { mix } from '../plan/color.ts';
import { thinStrokes } from '../plan/thin.ts';
import type { PlanPaint } from '../plan/style.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from '../plan/types.ts';
import type { Viewport } from '../viewport.ts';
import { ownerOf, sectionItems, type SectionItem } from './pick.ts';
import { sectionStyleOf } from './style.ts';

export interface SectionInput {
  project: Project;
  section: SectionResult;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  showGrid: boolean;
  /** Seleção e cursor (decisão 0016): realçados por cima do desenho. Sem ele, o desenho é o de sempre. */
  highlight?: { selection: Id[]; hover: Id | null };
  /** Linhas finas só na tela (decisão 0015): todo traço do modelo sai com 1 px. Padrão desligado; a prancha não passa. */
  thinLines?: boolean;
}

/** Caixilho de vidro (opaco na linha oculta, como o dono decidiu) e folha de porta: cores fixas do desenho. */
const GLASS_FILL = '#bfe3f5';
const DOOR_FILL = '#e6d2ae';

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

const fmt = (z: number): string => `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2).replace('.', ',')}`;

/** Categoria gráfica de uma origem do motor (parede, piso, laje, telhado ou escada). */
const categoryOf = (o: SectionOrigin): GraphicsCategory => ownerOf(o)?.kind ?? 'wall';

/**
 * Lista de desenho do corte/elevação: x = distância ao longo da linha, y = cota. Os polígonos já são a parte visível
 * (linha oculta, no motor): aqui só se pinta. Segue a hierarquia de peso do Revit: o que é cortado leva hachura e
 * linha pesada; o que está além aparece mais fino e esmaecido (mais longe, mais claro); vãos são caixilho ou folha
 * opacos. A ordem de pintura é do mais longe ao mais perto, com o corte por último.
 */
export function buildSectionDrawList(input: SectionInput): PlanDrawList {
  const { project: p, section: s, theme, viewport: v } = input;
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const paper = input.dark ? theme.bg : '#ffffff';
  const maxDepth = Math.max(1e-6, ...s.beyond.map((b) => b.depth), ...s.openings.map((o) => o.depth));
  const style = sectionStyleOf(p, v.zoom);
  const { detail, paint, visual, saved } = style;
  // Arame e grosso não têm superfícies: no arame só contornos; no grosso, só os contornos do modelo.
  const wire = visual === 'wireframe';
  const noFill = wire || detail === 'coarse';
  const cutWidth = (c: GraphicsCategory): number => (saved ? paint[c].cutPx : 1);
  const projWidth = (c: GraphicsCategory): number => (saved ? paint[c].projPx : 1);
  const openingEdge = (c: GraphicsCategory, cut: boolean): number => (saved ? (cut ? paint[c].cutPx : paint[c].projPx) : cut ? 1.6 : 1.2);
  const symbolWidth = (c: GraphicsCategory): number => (saved ? paint[c].projPx : 1);
  const halftone = (color: string, pt: PlanPaint): string => (pt.halftone ? mix(color, paper, 0.5) : color);
  // Para o contorno externo de uma vista com categoria oculta: a silhueta do motor une tudo, então ela é refeita dos itens visíveis.
  const silhouetteParts: MultiPolygon[] = [];

  // Solo e níveis: linhas finas tracejadas ao longo de todo o comprimento.
  for (const l of s.levels) {
    const edge = [
      { x: -0.5, y: l.z },
      { x: s.length + 0.5, y: l.z },
    ];
    strokes.push({ pts: edge, closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.9, dash: [10, 5] });
    labels.push({ at: edge[1]!, text: `${l.name} ${fmt(l.z)}`, dx: 6, dy: -8, tone: 'info' });
  }

  const drawBeyond = (b: SectionBeyond): void => {
    const cat = categoryOf(b);
    const pt = paint[cat];
    if (!pt.visible) return;
    silhouetteParts.push(b.polygons);
    const base = pt.color ?? p.materials[b.materialId]?.color ?? '#999999';
    if (!noFill) {
      const fade = 0.55 + 0.35 * (b.depth / maxDepth);
      const color = pt.visual === 'shaded' ? base : mix(mix(base, paper, 0.55), paper, fade * 0.35);
      const hatch = b.hatch && !wire && (detail === 'fine' || v.zoom >= 40)
        ? { kind: b.hatch, color: halftone(mix(base, input.dark ? '#ffffff' : '#000000', 0.45), pt) }
        : undefined;
      fills.push({ polygons: b.polygons, color: halftone(color, pt), alpha: pt.alpha, hatch });
    }
    const line = mix(theme.ink, paper, 0.35 + 0.4 * (b.depth / maxDepth));
    for (const ring of ringsOf(b.polygons)) strokes.push({ pts: ring, closed: true, widthPx: projWidth(cat), color: halftone(line, pt), alpha: 1 });
  };

  /**
   * Desenho do vão no corte e na elevação, a partir do tipo e da FAMÍLIA (`o.esquadria`): batente com a espessura do
   * perfil (`frameWidth`) — no corte transversal, com a profundidade do batente (`frameDepth`) centrada na parede —,
   * vidro com a espessura do tipo, folha de porta, e os símbolos de elevação (arco do maxim-ar/basculante, giro da
   * porta, em V, e seta de correr). Sem `esquadria` (lista sintética), cai no retângulo de antes.
   */
  const drawOpening = (o: SectionOpening): void => {
    const { polygons, kind, cut, t0, t1, z0, z1 } = o;
    const pt = paint[kind];
    if (!pt.visible) return;
    const edge = openingEdge(kind, cut);
    const outline = (): void => {
      for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: edge, color: halftone(theme.ink, pt), alpha: 1 });
    };
    const quad = (a: number, b: number, c: number, d: number): Ring => [
      { x: a, y: c },
      { x: b, y: c },
      { x: b, y: d },
      { x: a, y: d },
    ];
    // Peça do batente/caixilho: preenchida e contornada, no plano da vista.
    const piece = (a: number, b: number, c: number, d: number, color: string): void => {
      const ring = quad(a, b, c, d);
      if (!noFill) fills.push({ polygons: [[ring]], color: halftone(color, pt), alpha: pt.alpha });
      strokes.push({ pts: ring, closed: true, widthPx: edge, color: halftone(theme.ink, pt), alpha: 1 });
    };
    // Traço simbólico da elevação (abertura, giro, seta, X): fino. Por padrão tracejado (dash [4,3], distinto do tracejado dos
    // níveis [10,5]); `dashed = false` sai contínuo (decisão 0024 §2: tracejado = abre para o observador, contínuo = não).
    // No grosso não sai símbolo nenhum (decisão 0015; 0024 §3 e §5).
    const symbol = (pts: Vec2[], dashed = true): void => {
      if (detail === 'coarse') return;
      strokes.push({ pts, closed: false, widthPx: symbolWidth(kind), color: halftone(theme.inkSoft, pt), alpha: 1, ...(dashed ? { dash: [4, 3] as [number, number] } : {}) });
    };
    const esq = o.esquadria;
    if (!esq) {
      // Lista sintética sem esquadria: retângulo com o fundo e o contorno de antes.
      if (!noFill) fills.push({ polygons, color: halftone(pt.color ?? (kind === 'window' ? GLASS_FILL : DOOR_FILL), pt), alpha: pt.alpha });
      outline();
      return;
    }
    const fw = esq.frameWidth;
    // Giro em V (decisão 0024 §2): duas linhas saindo do vértice, no lado da dobradiça, até as duas pontas do lado do trinco,
    // num traço só de três pontos. Tracejado quando a folha abre para o observador (`swingTowardViewer`).
    const swingV = (vertex: Vec2, tipA: Vec2, tipB: Vec2): void => symbol([tipA, vertex, tipB], esq.swingTowardViewer);
    // Vista face (t = largura do vão) x corte transversal (t = espessura da parede): a projeção da pegada
    // (largura × espessura) sobre a linha diz qual é. A vista face é a da elevação e a do corte longitudinal.
    const faceOn = Math.abs(t1 - t0 - esq.width) <= Math.abs(t1 - t0 - esq.thickness);
    const frameBase = pt.color ?? p.materials[esq.frameMaterialId]?.color ?? '#9aa0a6';
    const frameColor = pt.visual === 'shaded' ? frameBase : mix(frameBase, paper, 0.5);
    // Peça de concreto (verga/contraverga): preenchida com a cor do material e hachura de corte, no mesmo critério do corte.
    const concrete = p.materials['mat_concreto'];
    const concretePiece = (a: number, b: number, c: number, d: number): void => {
      const ring = quad(a, b, c, d);
      const hatch = concrete && concrete.hatch !== 'none' && v.zoom >= 40 ? { kind: concrete.hatch, color: mix(concrete.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
      fills.push({ polygons: [[ring]], color: mix(concrete?.color ?? '#8f9296', paper, 0.35), alpha: 1, hatch });
      strokes.push({ pts: ring, closed: true, widthPx: edge, color: theme.ink, alpha: 1 });
    };
    const tc = (t0 + t1) / 2;
    const zc = (z0 + z1) / 2;
    // Verga e contraverga: transpasse além do vão na vista face e a espessura da parede no corte transversal.
    if (esq.lintel) {
      if (faceOn) concretePiece(t0 - esq.lintel.over, t1 + esq.lintel.over, z1, z1 + esq.lintel.height);
      else concretePiece(t0, t1, z1, z1 + esq.lintel.height);
    }
    if (esq.sillBeam) {
      if (faceOn) concretePiece(t0 - esq.sillBeam.over, t1 + esq.sillBeam.over, z0 - esq.sillBeam.height, z0);
      else concretePiece(t0, t1, z0 - esq.sillBeam.height, z0);
    }
    // Alizar: contorno em volta do vão, nas duas faces da parede (na elevação, o contorno da peça).
    const outlineRect = (a: number, b: number, c: number, d: number): void => {
      strokes.push({ pts: quad(a, b, c, d), closed: true, widthPx: Math.min(edge, 1.2), color: theme.ink, alpha: 1 });
    };
    if (esq.casing) {
      const cw = esq.casing.width;
      outlineRect(t0 - cw, t0, z0, z1 + cw);
      outlineRect(t1, t1 + cw, z0, z1 + cw);
      outlineRect(t0 - cw, t1 + cw, z1, z1 + cw);
      if (kind === 'window') outlineRect(t0 - cw, t1 + cw, z0 - cw, z0);
    }
    // Vão livre (sem folha): nenhum batente nem vidro. A porta é só o vão aberto (o vazio mostra o papel); a janela
    // sem folha fica com a soleira, como no 3D.
    if (esq.leaves === 0) {
      if (kind === 'window') piece(t0, t1, z0, z0 + fw, frameColor);
      outline();
      // X do vão sem esquadria, ligando os vértices opostos do contorno (decisão 0024 §3): contínuo.
      for (const seg of voidCrossPaths([
        { x: t0, y: z0 },
        { x: t1, y: z0 },
        { x: t1, y: z1 },
        { x: t0, y: z1 },
      ])) symbol(seg, false);
      return;
    }
    if (kind === 'window') {
      outline();
      if (faceOn) {
        // Batente: ombreiras, verga e soleira com a espessura do perfil, dentro do vão.
        piece(t0, t0 + fw, z0, z1, frameColor);
        piece(t1 - fw, t1, z0, z1, frameColor);
        piece(t0, t1, z1 - fw, z1, frameColor);
        piece(t0, t1, z0, z0 + fw, frameColor);
        // Vidro: região interna do caixilho (opaco, cor fixa do desenho).
        if (!noFill) fills.push({ polygons: [[quad(t0 + fw, t1 - fw, z0 + fw, z1 - fw)]], color: halftone(pt.color ?? GLASS_FILL, pt), alpha: pt.alpha });
        // Linha central (C6): só na janela de correr (2 ou 3 folhas); a fixa, a basculante e a maxim-ar não a têm.
        if (esq.leaves >= 2) {
          const inner = t1 - t0 - 2 * fw;
          for (let i = 1; i < esq.leaves; i++) {
            const t = t0 + fw + (i * inner) / esq.leaves;
            strokes.push({ pts: [{ x: t, y: z0 + fw }, { x: t, y: z1 - fw }], closed: false, widthPx: symbolWidth(kind), color: theme.ink, alpha: 0.7 });
          }
        }
        // Símbolos da elevação: seta de correr (E2) ou V de giro do maxim-ar/basculante (E1).
        if (esq.plan === 'sliding') {
          symbol([{ x: t0 + fw, y: zc }, { x: t1 - fw, y: zc }]);
          symbol([{ x: t1 - fw - 0.1, y: zc + 0.04 }, { x: t1 - fw, y: zc }, { x: t1 - fw - 0.1, y: zc - 0.04 }]);
        } else if (esq.family === 'window_casement' || esq.family === 'window_tilt') {
          // Janela de abrir (E1), com o V no lado da dobradiça e as pontas nos cantos do lado oposto do caixilho: o
          // maxim-ar tem a dobradiça no topo (vértice no meio da aresta superior); o basculante, na base.
          const left = t0 + fw;
          const right = t1 - fw;
          const top = z1 - fw;
          const bottom = z0 + fw;
          if (esq.family === 'window_casement') swingV({ x: tc, y: top }, { x: left, y: bottom }, { x: right, y: bottom });
          else swingV({ x: tc, y: bottom }, { x: left, y: top }, { x: right, y: top });
        }
      } else {
        // Corte transversal: verga e soleira com a profundidade do batente, centradas na parede; vidro com a espessura.
        piece(tc - esq.frameDepth / 2, tc + esq.frameDepth / 2, z1 - fw, z1, frameColor);
        piece(tc - esq.frameDepth / 2, tc + esq.frameDepth / 2, z0, z0 + fw, frameColor);
        if (!noFill) fills.push({ polygons: [[quad(tc - esq.glassThickness / 2, tc + esq.glassThickness / 2, z0 + fw, z1 - fw)]], color: halftone(pt.color ?? GLASS_FILL, pt), alpha: pt.alpha });
        // Peitoril saliente: no corte transversal, projeta além das duas faces (t = espessura da parede).
        if (esq.sillBoard) piece(t0 - esq.sillBoard.projection, t1 + esq.sillBoard.projection, z0 - esq.sillBoard.thickness, z0, frameColor);
      }
      // Peitoril saliente na elevação: faixa sob o vão, com a espessura da peça.
      if (faceOn && esq.sillBoard) piece(t0, t1, z0 - esq.sillBoard.thickness, z0, frameColor);
    } else {
      // Porta com folha: a folha fechada preenche o vão (C5). O vão livre (0 folhas) saiu acima, sem preenchimento.
      if (!noFill) fills.push({ polygons, color: halftone(pt.color ?? DOOR_FILL, pt), alpha: pt.alpha });
      outline();
      if (faceOn) {
        // Símbolos da elevação: seta de correr da porta (E2) ou V de giro do lado da dobradiça (E1).
        if (esq.family === 'door_sliding') {
          symbol([{ x: t0, y: zc }, { x: t1, y: zc }]);
          symbol([{ x: t1 - 0.12, y: zc + 0.05 }, { x: t1, y: zc }, { x: t1 - 0.12, y: zc - 0.05 }]);
        } else if (esq.family === 'door_double') {
          // Porta dupla: um V por folha, com o vértice na ombreira (dobradiça) e as pontas no centro, no topo e na base.
          swingV({ x: t0, y: zc }, { x: tc, y: z1 }, { x: tc, y: z0 });
          swingV({ x: t1, y: zc }, { x: tc, y: z1 }, { x: tc, y: z0 });
        } else if (esq.family === 'door_pivot') {
          // Porta pivotante: o eixo vertical a W/4 da ombreira da dobradiça (mesma convenção da planta, decisão 0017 §8),
          // com o vértice do V sobre ele, na altura média, e as pontas no lado oposto.
          const tAxis = tc + (esq.flipHand ? 1 : -1) * (esq.width / 4);
          const opp = esq.flipHand ? t0 : t1;
          symbol([{ x: tAxis, y: z1 }, { x: tAxis, y: z0 }]);
          swingV({ x: tAxis, y: zc }, { x: opp, y: z1 }, { x: opp, y: z0 });
        } else {
          const hinge = esq.flipHand ? t1 : t0;
          const opp = esq.flipHand ? t0 : t1;
          swingV({ x: hinge, y: zc }, { x: opp, y: z1 }, { x: opp, y: z0 });
        }
      }
    }
  };

  // Pintura do mais longe ao mais perto: além e vãos pela profundidade; o corte (profundidade 0) por último.
  type Paint = { depth: number; cut: boolean; draw: () => void };
  const cutPaint = s.cut.flatMap((r): Paint[] => {
    const cats = [...new Set(r.sources.map(categoryOf))];
    if (!cats.some((c) => paint[c].visible)) return [];
    const cat = cats.find((c) => paint[c].visible) ?? 'wall';
    const pt = paint[cat];
    return [{
      depth: 0,
      cut: true,
      draw: () => {
        silhouetteParts.push(r.polygons);
        const m = p.materials[r.materialId];
        if (!noFill) {
          const base = pt.color ?? m?.color ?? '#999999';
          const color = pt.visual === 'shaded' ? base : mix(base, paper, input.dark ? 0.5 : 0.58);
          const hatchKind = r.hatch ?? m?.hatch;
          const hatch = !wire && hatchKind && hatchKind !== 'none' && (detail === 'fine' || v.zoom >= 40)
            ? { kind: hatchKind, color: halftone(mix(pt.color ?? m?.color ?? '#999999', input.dark ? '#ffffff' : '#000000', 0.45), pt) }
            : undefined;
          fills.push({ polygons: r.polygons, color: halftone(color, pt), alpha: pt.alpha, hatch });
        }
        const line = halftone(mix(theme.ink, paper, 0.35), pt);
        for (const ring of ringsOf(r.polygons)) strokes.push({ pts: ring, closed: true, widthPx: cutWidth(cat), color: line, alpha: 1 });
      },
    }];
  });
  const paintList: Paint[] = [
    ...s.beyond.map((b): Paint => ({ depth: b.depth, cut: false, draw: () => drawBeyond(b) })),
    ...s.openings.map((o): Paint => ({ depth: o.depth, cut: false, draw: () => drawOpening(o) })),
    ...cutPaint,
  ];
  paintList.sort((x, y) => y.depth - x.depth || Number(x.cut) - Number(y.cut));
  for (const item of paintList) item.draw();
  // Membranas de piso e laje: linha tracejada na cota da face (decisão 0023 §5), na espessura do corte do dono.
  for (const m of s.membranes) {
    const cat = categoryOf(m);
    if (!paint[cat].visible) continue;
    strokes.push({ pts: [...m.pts], closed: false, widthPx: cutWidth(cat), color: theme.inkSoft, alpha: 0.9, dash: [6, 3] });
  }

  // Contorno externo: a união das regiões visíveis (o que está atrás de um sólido não entra). Com categoria oculta,
  // a silhueta do motor (que une tudo) é refeita só com os itens que ficaram.
  const hiddenAny = GRAPHICS_CATEGORIES.some((c) => !paint[c].visible);
  const silhouette = hiddenAny ? (silhouetteParts.length > 0 ? union(...silhouetteParts) : []) : s.silhouette;
  for (const ring of ringsOf(silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });

  if (input.thinLines) thinStrokes(strokes);
  if (input.highlight) highlightOps(s, input.highlight, theme, fills, strokes);

  return { background: theme.bg, fills, strokes, labels };
}

/**
 * Realce por seleção e por cursor (decisão 0016, seção "Seleção em cortes e elevações"). Um item selecionado (ou cujo
 * dono está selecionado) ganha contorno na cor de seleção e preenchimento translúcido (0,25) sobre as partes visíveis.
 * O item sob o cursor, se não estiver selecionado, ganha só um contorno fraco. Vai por último, por cima do desenho.
 * Corte unido: as peças guardam a origem (`parts`), então só a parte do dono selecionado é realçada. Sem `parts` (o
 * motor não separa as origens), vale o item inteiro.
 */
function highlightOps(s: SectionResult, hl: { selection: Id[]; hover: Id | null }, theme: PlanTheme, fills: FillOp[], strokes: StrokeOp[]): void {
  if (hl.selection.length === 0 && hl.hover === null) return;
  const polysOf = (item: SectionItem, id: Id): MultiPolygon => {
    if (!item.owners.some((o) => o.id === id)) return [];
    if (!item.parts) return item.polygons;
    const parts = item.parts.filter((part) => ownerOf(part.origin)?.id === id);
    if (parts.length === 0) return [];
    return parts.length === 1 ? parts[0]!.polygons : union(...parts.map((part) => part.polygons));
  };
  for (const item of sectionItems(s)) {
    const sel = hl.selection.map((id) => polysOf(item, id)).filter((m) => m.length > 0);
    if (sel.length > 0) {
      const polygons = sel.length === 1 ? sel[0]! : union(...sel);
      fills.push({ polygons, color: theme.select, alpha: 0.25 });
      for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
    } else if (hl.hover !== null) {
      const polygons = polysOf(item, hl.hover);
      for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1.5, color: theme.select, alpha: 0.55 });
    }
  }
}

/** Caixa para enquadrar o desenho, com folga lateral e vertical. */
export function sectionBox(s: SectionResult): { minX: number; minY: number; maxX: number; maxY: number } {
  return { minX: -0.8, maxX: s.length + 2.2, minY: s.zMin - 0.5, maxY: s.zMax + 0.5 };
}
