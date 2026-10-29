import { dist, type SketchDraft, type Vec2 } from '@hestia/geom';
import { dimensionSettingsOf, type Id, type Project } from '@hestia/model';
import { subjectDims } from './dims/registry.ts';
import type { DimRef, TempDim } from './dims/types.ts';
import { anchorOf, type ShapeStep } from './perimeterToolShape.ts';

/**
 * Cotas do rascunho do Perímetro: as linhas selecionadas ou o lado em desenho (só leitura; digitar o comprimento
 * segue no fluxo da sessão). `cursor` é o ponto capturado da prévia.
 */
export function perimeterDraftDims(
  project: Project,
  levelId: Id,
  draft: SketchDraft,
  step: ShapeStep | null,
  cursor: Vec2 | null,
  overrides: Readonly<Record<string, DimRef>>,
): TempDim[] {
  const ctx = { project, levelId, settings: dimensionSettingsOf(project), overrides };
  const selected = draft.segs.filter((s) => draft.selected.includes(s.id));
  if (selected.length > 0) return subjectDims(ctx, 'perimeterLine', { segs: selected });
  const anchor = anchorOf(step);
  if (!step || step.shape.id !== 'line' || !anchor || !cursor || dist(anchor, cursor) < 1e-6) return [];
  return subjectDims(ctx, 'perimeterLine', { segs: [{ id: 'draft', a: anchor, b: cursor }] });
}
