import {
  sectionLabelOf,
  sectionMarkGeometry,
  sectionPoints,
  SECTION_TEXT_MM,
  type Project,
} from '@hestia/model';
import { DXF_LAYER_CORTES, DXF_LAYER_ELEVACOES, type DxfSectionMarks } from './dxf.ts';

/**
 * Marcas de corte/elevação da planta em metros de desenho, para o DXF. `scale` é o denominador da vista (1:100 → 100):
 * a geometria usa as mesmas medidas de papel da tela e da prancha. Quem chama decide a visibilidade da categoria.
 */
export function sectionMarksDxfOf(p: Pick<Project, 'views' | 'elements'>, scale: number): DxfSectionMarks {
  const mPerMm = scale / 1000;
  const out: DxfSectionMarks = { lines: [], texts: [] };
  for (const view of p.views) {
    if (view.mark?.visible === false) continue;
    const pts = sectionPoints(p, view);
    const g = sectionMarkGeometry(pts.a, pts.b, view.kind, sectionLabelOf(view), mPerMm, view.mark);
    const layer = view.kind === 'elevation' ? DXF_LAYER_ELEVACOES : DXF_LAYER_CORTES;
    for (const [a, b] of g.segments) out.lines.push({ a, b, layer });
    for (const ring of g.arrows) {
      for (let i = 0; i < ring.length; i++) out.lines.push({ a: ring[i]!, b: ring[(i + 1) % ring.length]!, layer });
    }
    for (const label of g.labels) {
      out.texts.push({
        at: label.at,
        text: label.text,
        height: (view.mark?.textMm ?? SECTION_TEXT_MM) * mPerMm,
        rotation: label.rotation,
        layer,
      });
    }
  }
  return out;
}
