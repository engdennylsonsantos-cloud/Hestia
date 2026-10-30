import { isCad, type CadDrawing, type Id, type Project } from '@hestia/model';
import type { LabelOp, PlanTheme, StrokeOp } from './types.ts';

/**
 * Planta do CAD importado (fase 5): cada traço do desenho vira um traço fino de 1 px na cor da camada (ou da entidade,
 * quando ela tem cor própria) e cada texto vira um rótulo na mesma cor. As coordenadas já estão em metros de mundo: o
 * importador aplicou a unidade do arquivo e a inserção.
 */

/** Cores ACI do DXF em hex, para a planta: as do AutoCAD clássico, suavizadas para ler nos dois temas. */
const ACI_HEX: Record<number, string> = {
  1: '#d32f2f', // vermelho
  2: '#c9a227', // amarelo
  3: '#2e7d32', // verde
  4: '#00838f', // ciano
  5: '#1565c0', // azul
  6: '#ad1457', // magenta
  8: '#6b7280', // cinza
  9: '#9ca3af', // cinza claro
};

/** Cor da planta de uma cor ACI: 7 é a tinta do tema; ausente ou desconhecida é a tinta fraca do tema. */
export function cadAciColor(aci: number | undefined, theme: PlanTheme): string {
  if (aci === undefined) return theme.inkSoft;
  if (aci === 7) return theme.ink;
  return ACI_HEX[aci] ?? theme.inkSoft;
}

/** Desenhos CAD do nível, visíveis, na ordem de desenho (a mesma das outras categorias). */
function cadDrawingsOf(p: Project, levelId: Id): CadDrawing[] {
  return Object.values(p.elements)
    .filter((e): e is CadDrawing => isCad(e) && e.levelId === levelId && e.visible !== false)
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Cor ACI da camada do desenho; ausente = a da entidade (ou a padrão, ver `cadAciColor`). */
const layerAciOf = (d: CadDrawing, layer: string): number | undefined => d.layers.find((l) => l.name === layer)?.color;

/** Traços e rótulos do CAD importado do nível (desenhos invisíveis ficam de fora); `scale` é o denominador da vista. */
export function cadPlanOps(p: Project, levelId: Id, theme: PlanTheme, scale = 100): { strokes: StrokeOp[]; labels: LabelOp[] } {
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  for (const d of cadDrawingsOf(p, levelId)) {
    for (const path of d.paths) {
      if (path.pts.length < 2) continue;
      const color = cadAciColor(path.color ?? layerAciOf(d, path.layer), theme);
      strokes.push({ pts: path.pts.map((q) => ({ x: q.x, y: q.y })), closed: path.closed, widthPx: 1, color, alpha: 1 });
    }
    for (const t of d.texts) {
      if (t.text === '') continue;
      labels.push({
        at: { x: t.at.x, y: t.at.y },
        text: t.text,
        color: cadAciColor(t.color ?? layerAciOf(d, t.layer), theme),
        rotation: t.rotation,
        // Altura em metros de desenho → mm de papel na escala da vista (1:100 → altura × 10).
        papel: { escala: scale, fontMm: Math.max(t.height, 0) * (1000 / scale) },
      });
    }
  }
  return { strokes, labels };
}
