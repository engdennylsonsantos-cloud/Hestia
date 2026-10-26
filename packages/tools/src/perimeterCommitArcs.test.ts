import { describe, expect, it } from 'vitest';
import { closestOnSegment, dist, type SketchSeg, type Vec2 } from '@hestia/geom';
import { createEmptyProject, ProjectStore, type Floor, type Roof } from '@hestia/model';
import { addSegs, newDraft, type NewSeg } from './perimeterSession.ts';
import { commitPerimeter, draftFromElement } from './perimeterCommit.ts';
import type { CommitPerimeterResult } from './perimeterCommitTypes.ts';

/** Maior distância de um vértice de `a` ao traço de `b` (e o contrário): erro de forma entre dois anéis. */
function hausdorff(a: Vec2[], b: Vec2[]): number {
  const to = (p: Vec2, r: Vec2[]): number => Math.min(...r.map((q, i) => dist(p, closestOnSegment(p, q, r[(i + 1) % r.length]!))));
  return Math.max(...a.map((p) => to(p, b)), ...b.map((p) => to(p, a)));
}

/** Retângulo `w` × `h` com o lado de cima trocado por um arco de semicírculo (flecha = w/2), para cima. */
function rectWithTopArc(w: number, h: number): NewSeg[] {
  return [
    { a: { x: 0, y: 0 }, b: { x: w, y: 0 } },
    { a: { x: w, y: 0 }, b: { x: w, y: h } },
    { a: { x: w, y: h }, b: { x: 0, y: h }, sag: -w / 2 },
    { a: { x: 0, y: h }, b: { x: 0, y: 0 } },
  ];
}

const ok = (r: CommitPerimeterResult): Extract<CommitPerimeterResult, { ok: true }> => {
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  return r;
};

/** Campos gravados por um comando de edição. */
function patchOf(r: Extract<CommitPerimeterResult, { ok: true }>): Record<string, unknown> {
  const c = r.commands[0];
  if (c?.type !== 'updateElements') throw new Error('esperava updateElements');
  return c.patch as Record<string, unknown>;
}

/** Sag > 0 e a corda entre os vértices do arco: o arco sobe (ou desce) pelo lado indicado pelo sinal. */
const arcsOf = (segs: SketchSeg[]): SketchSeg[] => segs.filter((s) => s.sag !== undefined && s.sag !== 0);

describe('perímetro: recuperação de arcos na edição', () => {
  it('piso com semicírculo: draftFromElement devolve um arco e as retas; recommit gera o mesmo anel em 2 mm', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, addSegs(newDraft('floor'), rectWithTopArc(4, 3)), { typeId: 'ft_ceram', levelId: 'lv_0' });
    for (const c of ok(r).commands) store.exec(c);
    const floor = store.project.elements[ok(r).id] as Floor;

    const draft = draftFromElement(store.project, floor.id)!;
    expect(draft.segs).toHaveLength(4);
    const arcs = arcsOf(draft.segs);
    expect(arcs).toHaveLength(1);
    expect(Math.abs(arcs[0]!.sag!)).toBeCloseTo(2, 2);

    const again = ok(commitPerimeter(store.project, draft));
    expect(hausdorff(patchOf(again).boundary as Vec2[], floor.boundary)).toBeLessThanOrEqual(0.002 + 1e-6);
  });

  it('piso circular (dois arcos de 180°): volta com dois arcos e o mesmo contorno', () => {
    const store = new ProjectStore(createEmptyProject());
    const circle: NewSeg[] = [
      { a: { x: 3, y: 0 }, b: { x: -3, y: 0 }, sag: 3 },
      { a: { x: -3, y: 0 }, b: { x: 3, y: 0 }, sag: 3 },
    ];
    const r = commitPerimeter(store.project, addSegs(newDraft('floor'), circle), { typeId: 'ft_ceram', levelId: 'lv_0' });
    for (const c of ok(r).commands) store.exec(c);
    const floor = store.project.elements[ok(r).id] as Floor;
    expect(floor.boundary.length).toBeGreaterThan(40);

    const draft = draftFromElement(store.project, floor.id)!;
    expect(draft.segs).toHaveLength(2);
    expect(draft.segs.every((s) => s.sag !== undefined && Math.abs(s.sag) > 2.99)).toBe(true);

    const again = ok(commitPerimeter(store.project, draft));
    expect(hausdorff(patchOf(again).boundary as Vec2[], floor.boundary)).toBeLessThanOrEqual(0.002 + 1e-6);
  });

  it('telhado com semicírculo: criar, editar sem mudanças, e o contorno volta com um arco e as retas', () => {
    const store = new ProjectStore(createEmptyProject());
    const r = commitPerimeter(store.project, addSegs(newDraft('roof'), rectWithTopArc(6, 4)), { typeId: 'rt_ceramica', levelId: 'lv_0' });
    for (const c of ok(r).commands) store.exec(c);
    const roof = store.project.elements[ok(r).id] as Roof;

    const draft = draftFromElement(store.project, roof.id)!;
    expect(draft.segs).toHaveLength(4);
    expect(arcsOf(draft.segs)).toHaveLength(1);
    expect(draft.segs.filter((s) => s.sag === undefined)).toHaveLength(3);

    const again = ok(commitPerimeter(store.project, draft));
    expect(hausdorff(patchOf(again).footprint as Vec2[], roof.footprint!)).toBeLessThanOrEqual(0.002 + 1e-6);
  });
});
