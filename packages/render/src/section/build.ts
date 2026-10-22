import type { MultiPolygon, Ring, Vec2 } from '@hestia/geom';
import type { SectionOpening, SectionResult } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { mix } from '../plan/color.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from '../plan/types.ts';
import type { Viewport } from '../viewport.ts';
import { sectionItems } from './pick.ts';

export interface SectionInput {
  project: Project;
  section: SectionResult;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  showGrid: boolean;
  /** Seleção e cursor (decisão 0016): realçados por cima do desenho. Sem ele, o desenho é o de sempre. */
  highlight?: { selection: Id[]; hover: Id | null };
}

/** Caixilho de vidro (opaco na linha oculta, como o dono decidiu) e folha de porta: cores fixas do desenho. */
const GLASS_FILL = '#bfe3f5';
const DOOR_FILL = '#e6d2ae';

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

const fmt = (z: number): string => `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2).replace('.', ',')}`;

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

  // Solo e níveis: linhas finas tracejadas ao longo de todo o comprimento.
  for (const l of s.levels) {
    const edge = [
      { x: -0.5, y: l.z },
      { x: s.length + 0.5, y: l.z },
    ];
    strokes.push({ pts: edge, closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.9, dash: [10, 5] });
    labels.push({ at: edge[1]!, text: `${l.name} ${fmt(l.z)}`, dx: 6, dy: -8, tone: 'info' });
  }

  const drawBeyond = (polygons: MultiPolygon, materialColor: string | undefined, depth: number): void => {
    const fade = 0.55 + 0.35 * (depth / maxDepth);
    const color = mix(mix(materialColor ?? '#999999', paper, 0.55), paper, fade * 0.35);
    fills.push({ polygons, color, alpha: 1 });
    for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35 + 0.4 * (depth / maxDepth)), alpha: 1 });
  };

  /**
   * Desenho do vão no corte e na elevação, a partir do tipo e da FAMÍLIA (`o.esquadria`): batente com a espessura do
   * perfil (`frameWidth`) — no corte transversal, com a profundidade do batente (`frameDepth`) centrada na parede —,
   * vidro com a espessura do tipo, folha de porta, e os símbolos de elevação (arco do maxim-ar/basculante, giro da
   * porta e seta de correr). Sem `esquadria` (lista sintética), cai no retângulo de antes.
   */
  const drawOpening = (o: SectionOpening): void => {
    const { polygons, kind, cut, t0, t1, z0, z1 } = o;
    const edge = cut ? 1.6 : 1.2;
    const outline = (): void => {
      for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: edge, color: theme.ink, alpha: 1 });
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
      fills.push({ polygons: [[ring]], color, alpha: 1 });
      strokes.push({ pts: ring, closed: true, widthPx: edge, color: theme.ink, alpha: 1 });
    };
    // Traço simbólico da elevação (abertura, giro, seta): fino e tracejado (dash [4,3], distinto do tracejado dos níveis [10,5]).
    const symbol = (pts: Vec2[]): void => {
      strokes.push({ pts, closed: false, widthPx: 1, color: theme.inkSoft, alpha: 1, dash: [4, 3] });
    };
    const esq = o.esquadria;
    if (!esq) {
      // Lista sintética sem esquadria: retângulo com o fundo e o contorno de antes.
      fills.push({ polygons, color: kind === 'window' ? GLASS_FILL : DOOR_FILL, alpha: 1 });
      outline();
      return;
    }
    const fw = esq.frameWidth;
    // Vista face (t = largura do vão) x corte transversal (t = espessura da parede): a projeção da pegada
    // (largura × espessura) sobre a linha diz qual é. A vista face é a da elevação e a do corte longitudinal.
    const faceOn = Math.abs(t1 - t0 - esq.width) <= Math.abs(t1 - t0 - esq.thickness);
    const frameColor = mix(p.materials[esq.frameMaterialId]?.color ?? '#9aa0a6', paper, 0.5);
    // Vão livre (sem folha): nenhum batente nem vidro. A porta é só o vão aberto (o vazio mostra o papel); a janela
    // sem folha fica com a soleira, como no 3D.
    if (esq.leaves === 0) {
      if (kind === 'window') piece(t0, t1, z0, z0 + fw, frameColor);
      outline();
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
        fills.push({ polygons: [[quad(t0 + fw, t1 - fw, z0 + fw, z1 - fw)]], color: GLASS_FILL, alpha: 1 });
        // Linha central (C6): só na janela de correr (2 ou 3 folhas); a fixa, a basculante e a maxim-ar não a têm.
        if (esq.leaves >= 2) {
          const inner = t1 - t0 - 2 * fw;
          for (let i = 1; i < esq.leaves; i++) {
            const t = t0 + fw + (i * inner) / esq.leaves;
            strokes.push({ pts: [{ x: t, y: z0 + fw }, { x: t, y: z1 - fw }], closed: false, widthPx: 1, color: theme.ink, alpha: 0.7 });
          }
        }
        // Símbolos da elevação: seta de correr (E2) ou arco tracejado do maxim-ar/basculante (E1).
        if (esq.plan === 'sliding') {
          const zc = (z0 + z1) / 2;
          symbol([{ x: t0 + fw, y: zc }, { x: t1 - fw, y: zc }]);
          symbol([{ x: t1 - fw - 0.1, y: zc + 0.04 }, { x: t1 - fw, y: zc }, { x: t1 - fw - 0.1, y: zc - 0.04 }]);
        } else if (esq.family === 'window_casement' || esq.family === 'window_tilt') {
          // Símbolo de abertura (E1): arco tracejado dentro do vão, saindo da verga (ou da soleira, com o sentido
          // invertido) para o lado da abertura.
          const dip = Math.min(0.25 * (z1 - z0), 0.4);
          const base = esq.flipFacing ? z0 + fw : z1 - fw;
          const dir = esq.flipFacing ? 1 : -1;
          const pts: Vec2[] = [];
          for (let i = 0; i <= 18; i++) {
            const t = t0 + fw + ((t1 - t0 - 2 * fw) * i) / 18;
            pts.push({ x: t, y: base + dir * dip * Math.sin((Math.PI * i) / 18) });
          }
          symbol(pts);
        }
      } else {
        // Corte transversal: verga e soleira com a profundidade do batente, centradas na parede; vidro com a espessura.
        const tc = (t0 + t1) / 2;
        piece(tc - esq.frameDepth / 2, tc + esq.frameDepth / 2, z1 - fw, z1, frameColor);
        piece(tc - esq.frameDepth / 2, tc + esq.frameDepth / 2, z0, z0 + fw, frameColor);
        fills.push({ polygons: [[quad(tc - esq.glassThickness / 2, tc + esq.glassThickness / 2, z0 + fw, z1 - fw)]], color: GLASS_FILL, alpha: 1 });
      }
    } else {
      // Porta com folha: a folha fechada preenche o vão (C5). O vão livre (0 folhas) saiu acima, sem preenchimento.
      fills.push({ polygons, color: DOOR_FILL, alpha: 1 });
      outline();
      if (faceOn) {
        // Símbolos da elevação: seta de correr da porta (E2) ou giro do lado da dobradiça (E1).
        if (esq.family === 'door_sliding') {
          const zc = (z0 + z1) / 2;
          symbol([{ x: t0, y: zc }, { x: t1, y: zc }]);
          symbol([{ x: t1 - 0.12, y: zc + 0.05 }, { x: t1, y: zc }, { x: t1 - 0.12, y: zc - 0.05 }]);
        } else {
          const hinge = esq.flipHand ? t1 : t0;
          const opp = esq.flipHand ? t0 : t1;
          symbol([{ x: hinge, y: z1 }, { x: opp, y: z0 }]);
        }
      }
    }
  };

  // Pintura do mais longe ao mais perto: além e vãos pela profundidade; o corte (profundidade 0) por último.
  type Paint = { depth: number; cut: boolean; draw: () => void };
  const paint: Paint[] = [
    ...s.beyond.map((b): Paint => ({ depth: b.depth, cut: false, draw: () => drawBeyond(b.polygons, p.materials[b.materialId]?.color, b.depth) })),
    ...s.openings.map((o): Paint => ({ depth: o.depth, cut: false, draw: () => drawOpening(o) })),
    ...s.cut.map((r): Paint => ({
      depth: 0,
      cut: true,
      draw: () => {
        const m = p.materials[r.materialId];
        const color = mix(m?.color ?? '#999999', paper, input.dark ? 0.5 : 0.58);
        const hatch = m && m.hatch !== 'none' && v.zoom >= 40 ? { kind: m.hatch, color: mix(m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
        fills.push({ polygons: r.polygons, color, alpha: 1, hatch });
        for (const ring of ringsOf(r.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35), alpha: 1 });
      },
    })),
  ];
  paint.sort((x, y) => y.depth - x.depth || Number(x.cut) - Number(y.cut));
  for (const item of paint) item.draw();

  // Contorno externo: a união das regiões visíveis (o que está atrás de um sólido não entra).
  for (const ring of ringsOf(s.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });

  if (input.highlight) highlightOps(s, input.highlight, theme, fills, strokes);

  return { background: theme.bg, fills, strokes, labels };
}

/**
 * Realce por seleção e por cursor (decisão 0016, seção "Seleção em cortes e elevações"). Um item selecionado (ou cujo
 * dono está selecionado) ganha contorno na cor de seleção e preenchimento translúcido (0,25) sobre as partes visíveis.
 * O item sob o cursor, se não estiver selecionado, ganha só um contorno fraco. Vai por último, por cima do desenho.
 * Corte unido: se uma das origens está selecionada, a região inteira é realçada (o motor não separa as origens).
 */
function highlightOps(s: SectionResult, hl: { selection: Id[]; hover: Id | null }, theme: PlanTheme, fills: FillOp[], strokes: StrokeOp[]): void {
  if (hl.selection.length === 0 && hl.hover === null) return;
  const selected = new Set(hl.selection);
  for (const item of sectionItems(s)) {
    if (item.owners.some((o) => selected.has(o.id))) {
      fills.push({ polygons: item.polygons, color: theme.select, alpha: 0.25 });
      for (const ring of ringsOf(item.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
    } else if (hl.hover !== null && item.owners.some((o) => o.id === hl.hover)) {
      for (const ring of ringsOf(item.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1.5, color: theme.select, alpha: 0.55 });
    }
  }
}

/** Caixa para enquadrar o desenho, com folga lateral e vertical. */
export function sectionBox(s: SectionResult): { minX: number; minY: number; maxX: number; maxY: number } {
  return { minX: -0.8, maxX: s.length + 2.2, minY: s.zMin - 0.5, maxY: s.zMax + 0.5 };
}
