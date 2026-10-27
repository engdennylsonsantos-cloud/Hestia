import { describe, expect, it } from 'vitest';
import { dist } from '@hestia/geom';
import { createEmptyProject, ProjectStore, type Roof } from '@hestia/model';
import { addSegs, newDraft, type NewSeg } from './perimeterSession.ts';
import { commitPerimeter, draftFromElement } from './perimeterCommit.ts';
import type { CommitPerimeterResult } from './perimeterCommitTypes.ts';

const ok = (r: CommitPerimeterResult): Extract<CommitPerimeterResult, { ok: true }> => {
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  return r;
};

/** Retângulo 8 x 6 com o lado de cima trocado por um arco de flecha 1,5 (sentido de percurso b→a, abaulando para cima). */
const segs = (overhang?: number): NewSeg[] => [
  { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } },
  { a: { x: 8, y: 0 }, b: { x: 8, y: 6 } },
  { a: { x: 8, y: 6 }, b: { x: 0, y: 6 }, sag: -1.5 },
  { a: { x: 0, y: 6 }, b: { x: 0, y: 0 } },
].map((s) => (overhang === undefined ? s : { ...s, overhang }));

function create(overhang?: number) {
  const store = new ProjectStore(createEmptyProject());
  const r = ok(commitPerimeter(store.project, addSegs(newDraft('roof'), segs(overhang)), { typeId: 'rt_ceramica', levelId: 'lv_0' }));
  for (const c of r.commands) store.exec(c);
  return { store, roof: store.project.elements[r.id] as Roof };
}

describe('telhado: arco do esboço vira edgeSag', () => {
  it('grava só os cantos e uma flecha, com listas do mesmo tamanho do contorno', () => {
    const { roof } = create(0);
    expect(roof.boundary).toHaveLength(4);
    expect(roof.edgeSag).toHaveLength(4);
    expect(roof.footprint).toHaveLength(4);
    expect(roof.edgeOverhangs).toHaveLength(4);
    expect(roof.edgeSlopes).toHaveLength(4);
    expect(roof.edgeSag!.filter((v) => Math.abs(v) > 1e-6)).toHaveLength(1);
    expect(roof.edgeSag!.map(Math.abs).sort((a, b) => b - a)[0]).toBeCloseTo(1.5, 2);
  });

  it('com balanço, o arco acompanha: flecha dentro do limite e mesmo comprimento', () => {
    const { roof } = create(0.5);
    expect(roof.boundary).toHaveLength(4);
    expect(roof.edgeSag).toHaveLength(4);
    roof.edgeSag!.forEach((v, i) => expect(Math.abs(v)).toBeLessThanOrEqual(dist(roof.boundary[i]!, roof.boundary[(i + 1) % 4]!) / 2 + 1e-9));
  });

  it('Editar perímetro devolve o arco ao esboço e o recommit mantém a flecha', () => {
    const { store, roof } = create(0);
    const draft = draftFromElement(store.project, roof.id)!;
    expect(draft.segs).toHaveLength(4);
    const arcs = draft.segs.filter((s) => s.sag);
    expect(arcs).toHaveLength(1);
    expect(Math.abs(arcs[0]!.sag!)).toBeCloseTo(1.5, 2);
    const again = ok(commitPerimeter(store.project, draft));
    const c = again.commands[0];
    if (c?.type !== 'updateElements') throw new Error('esperava updateElements');
    const patch = c.patch as Partial<Roof>;
    expect(patch.boundary).toHaveLength(4);
    // O anel pode voltar girado: compara as flechas como conjunto.
    const sorted = (v: number[]): number[] => v.slice().sort((x, y) => x - y);
    sorted(patch.edgeSag!).forEach((v, i) => expect(Math.abs(v - sorted(roof.edgeSag!)[i]!)).toBeLessThan(0.005));
  });

  it('esboço reto não grava edgeSag', () => {
    const store = new ProjectStore(createEmptyProject());
    const rect: NewSeg[] = [
      { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } },
      { a: { x: 8, y: 0 }, b: { x: 8, y: 6 } },
      { a: { x: 8, y: 6 }, b: { x: 0, y: 6 } },
      { a: { x: 0, y: 6 }, b: { x: 0, y: 0 } },
    ];
    const r = ok(commitPerimeter(store.project, addSegs(newDraft('roof'), rect), { typeId: 'rt_ceramica', levelId: 'lv_0' }));
    const c = r.commands[0];
    if (c?.type !== 'addRoof') throw new Error('esperava addRoof');
    expect((c.roof as Roof).edgeSag).toBeUndefined();
  });
});

