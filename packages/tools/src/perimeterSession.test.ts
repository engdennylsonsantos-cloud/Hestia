import { beforeEach, describe, expect, it, vi } from 'vitest';
import { equal, v2, validateSketch, type SketchLoop, type SketchResult, type SketchSeg, type Vec2 } from '@hestia/geom';
import {
  addSeg,
  addSegs,
  cancel,
  canFinish,
  closeAnalysis,
  editDraft,
  effectiveSeg,
  finish,
  moveSegs,
  newDraft,
  removeSegs,
  replaceSegs,
  selectSegs,
  setDefaults,
  setSegSlope,
} from './perimeterSession.ts';

// validateSketch é outro módulo em implementação: aqui ela é substituída por um laço simples.
vi.mock('@hestia/geom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@hestia/geom')>();
  return { ...mod, validateSketch: vi.fn(mod.validateSketch) };
});

/** Encadeia as linhas numa única volta; arco (sag) ganha um ponto amostrado no meio. */
function chainValidate(segs: SketchSeg[]): SketchResult {
  if (segs.length === 0) return { loops: [], issues: [{ code: 'empty', message: 'Esboço vazio.', segIds: [] }], ok: false };
  const left = segs.slice();
  const first = left.shift()!;
  const pieces: { seg: SketchSeg; from: Vec2; to: Vec2 }[] = [{ seg: first, from: first.a, to: first.b }];
  let end = first.b;
  while (left.length) {
    const i = left.findIndex((s) => equal(s.a, end) || equal(s.b, end));
    if (i < 0) break;
    const s = left.splice(i, 1)[0]!;
    const from = equal(s.a, end) ? s.a : s.b;
    const to = from === s.a ? s.b : s.a;
    pieces.push({ seg: s, from, to });
    end = to;
  }
  const closed = left.length === 0 && equal(end, first.a);
  if (!closed) {
    return { loops: [], ok: false, issues: [{ code: 'open', message: 'Laço aberto.', segIds: left.map((s) => s.id) }] };
  }
  const ring: Vec2[] = [];
  for (const p of pieces) {
    ring.push(p.from);
    if (p.seg.sag) {
      const dx = p.to.x - p.from.x;
      const dy = p.to.y - p.from.y;
      const L = Math.hypot(dx, dy);
      const mx = (p.from.x + p.to.x) / 2;
      const my = (p.from.y + p.to.y) / 2;
      ring.push({ x: mx - (dy / L) * p.seg.sag, y: my + (dx / L) * p.seg.sag });
    }
  }
  const loop: SketchLoop = { role: 'outer', segs: pieces.map((p) => p.seg), ring };
  return { loops: [loop], issues: [], ok: true };
}

const SQUARE: Vec2[] = [v2(0, 0), v2(4, 0), v2(4, 3), v2(0, 3)];

beforeEach(() => {
  vi.mocked(validateSketch).mockReset();
  vi.mocked(validateSketch).mockImplementation(chainValidate);
});

describe('newDraft', () => {
  it('nasce vazio, com os padrões do telhado', () => {
    const d = newDraft('roof');
    expect(d.target).toBe('roof');
    expect(d.segs).toEqual([]);
    expect(d.selected).toEqual([]);
    expect(d.editing).toBeUndefined();
    expect(d.defaults).toEqual({ definesSlope: true, slopePct: 30, overhang: 0.5 });
  });

  it('aceita padrões parciais sem perder os demais', () => {
    expect(newDraft('roof', { slopePct: 20 }).defaults).toEqual({ definesSlope: true, slopePct: 20, overhang: 0.5 });
  });
});

describe('editDraft', () => {
  it('cria uma linha por lado do externo e dos furos, em laço fechado', () => {
    const hole: Vec2[] = [v2(1, 1), v2(2, 1), v2(2, 2)];
    const d = editDraft('floor', 'el1', SQUARE, [hole]);
    expect(d.editing).toBe('el1');
    expect(d.segs.map((s) => s.id)).toEqual(['el1:o0', 'el1:o1', 'el1:o2', 'el1:o3', 'el1:h0.0', 'el1:h0.1', 'el1:h0.2']);
    const outer = d.segs.slice(0, 4);
    outer.forEach((s, i) => {
      expect(equal(s.a, SQUARE[i]!)).toBe(true);
      expect(equal(s.b, SQUARE[(i + 1) % 4]!)).toBe(true);
    });
  });

  it('tem ids estáveis: a mesma entrada gera os mesmos ids', () => {
    const a = editDraft('roof', 'x', SQUARE).segs.map((s) => s.id);
    const b = editDraft('roof', 'x', SQUARE).segs.map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('não repete o ponto de fechamento do anel', () => {
    const closed = [...SQUARE, v2(0, 0)];
    expect(editDraft('floor', 'e', closed).segs).toHaveLength(4);
  });

  it('aplica flags por lado só quando informadas', () => {
    const d = editDraft('roof', 'r', SQUARE, [], { outer: [{ definesSlope: false, slopePct: 15 }, {}, {}, { overhang: 1.2 }] });
    expect(d.segs[0]).toMatchObject({ definesSlope: false, slopePct: 15 });
    expect('overhang' in d.segs[0]!).toBe(false);
    expect('definesSlope' in d.segs[1]!).toBe(false);
    expect(d.segs[3]).toMatchObject({ overhang: 1.2 });
    expect('definesSlope' in d.segs[3]!).toBe(false);
  });
});

describe('addSeg / addSegs', () => {
  it('gera ids únicos e não muda a entrada', () => {
    const d0 = newDraft('floor');
    const d1 = addSeg(d0, { a: v2(0, 0), b: v2(1, 0) });
    const d2 = addSegs(d1, [
      { a: v2(1, 0), b: v2(1, 1) },
      { a: v2(1, 1), b: v2(0, 0) },
    ]);
    expect(d0.segs).toEqual([]);
    expect(d1.segs.map((s) => s.id)).toEqual(['s1']);
    expect(d2.segs.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(new Set(d2.segs.map((s) => s.id)).size).toBe(3);
  });

  it('não colide com ids de lados de edição', () => {
    const d = addSeg(editDraft('roof', 'r', SQUARE), { a: v2(9, 9), b: v2(8, 8) });
    expect(d.segs[4]!.id).toBe('s1');
    expect(new Set(d.segs.map((s) => s.id)).size).toBe(5);
  });
});

describe('removeSegs / replaceSegs', () => {
  it('remove linhas e as tira da seleção; ids desconhecidos são ignorados', () => {
    const d = selectSegs(editDraft('floor', 'e', SQUARE), ['e:o0', 'e:o1']);
    const r = removeSegs(d, ['e:o1', 'nope']);
    expect(r.segs.map((s) => s.id)).toEqual(['e:o0', 'e:o2', 'e:o3']);
    expect(r.selected).toEqual(['e:o0']);
  });

  it('replaceSegs põe as novas linhas no lugar da primeira removida', () => {
    const d = editDraft('floor', 'e', SQUARE);
    const r = replaceSegs(d, ['e:o1'], [{ a: v2(4, 0), b: v2(4, 1.5) }, { a: v2(4, 1.5), b: v2(4, 3) }]);
    expect(r.segs.map((s) => s.id)).toEqual(['e:o0', 's1', 's2', 'e:o2', 'e:o3']);
    expect(r.segs[1]!.b).toEqual(v2(4, 1.5));
  });

  it('replaceSegs sem remoção anexa ao fim', () => {
    const r = replaceSegs(newDraft('floor'), [], [{ a: v2(0, 0), b: v2(1, 0) }]);
    expect(r.segs.map((s) => s.id)).toEqual(['s1']);
  });
});

describe('moveSegs / selectSegs', () => {
  it('desloca só as linhas indicadas, preservando arco e flags', () => {
    const d = setSegSlope(addSegs(newDraft('roof'), [{ a: v2(0, 0), b: v2(2, 0), sag: 0.5 }, { a: v2(2, 0), b: v2(2, 2) }]), 's1', {
      slopePct: 10,
    });
    const m = moveSegs(d, ['s1'], v2(1, 1));
    expect(m.segs[0]).toMatchObject({ a: v2(1, 1), b: v2(3, 1), sag: 0.5, slopePct: 10 });
    expect(m.segs[1]).toEqual(d.segs[1]);
  });

  it('selectSegs substitui por padrão e soma com additive, sem duplicar', () => {
    const d = editDraft('floor', 'e', SQUARE);
    const a = selectSegs(d, ['e:o0', 'bogus']);
    expect(a.selected).toEqual(['e:o0']);
    const b = selectSegs(a, ['e:o1', 'e:o0'], true);
    expect(b.selected).toEqual(['e:o0', 'e:o1']);
    expect(selectSegs(b, ['e:o2']).selected).toEqual(['e:o2']);
  });
});

describe('setSegSlope / setDefaults / effectiveSeg', () => {
  it('altera só os campos informados; null volta ao padrão', () => {
    const d0 = addSeg(newDraft('roof'), { a: v2(0, 0), b: v2(1, 0) });
    const d1 = setSegSlope(d0, 's1', { slopePct: 25, overhang: 0.8 });
    expect(d1.segs[0]).toMatchObject({ slopePct: 25, overhang: 0.8 });
    const d2 = setSegSlope(d1, 's1', { slopePct: null, definesSlope: false });
    expect('slopePct' in d2.segs[0]!).toBe(false);
    expect(d2.segs[0]).toMatchObject({ overhang: 0.8, definesSlope: false });
  });

  it('setDefaults mescla e effectiveSeg aplica padrão ou valor próprio', () => {
    const d = setDefaults(newDraft('roof'), { slopePct: 40 });
    expect(d.defaults.slopePct).toBe(40);
    const plain = addSeg(d, { a: v2(0, 0), b: v2(1, 0) }).segs[0]!;
    expect(effectiveSeg(d, plain)).toMatchObject({ definesSlope: true, slopePct: 40, overhang: 0.5 });
    const own = { ...plain, slopePct: 12, overhang: 0 };
    expect(effectiveSeg(d, own)).toMatchObject({ slopePct: 12, overhang: 0 });
  });
});

describe('closeAnalysis / canFinish / finish', () => {
  it('rascunho vazio não conclui', () => {
    const d = newDraft('floor');
    expect(canFinish(d)).toBe(false);
    expect(finish(d)).toMatchObject({ ok: false, issues: [{ code: 'empty' }] });
  });

  it('usa validateSketch com as linhas do rascunho', () => {
    const d = editDraft('floor', 'e', SQUARE);
    expect(closeAnalysis(d).ok).toBe(true);
    expect(validateSketch).toHaveBeenCalledWith(d.segs);
  });

  it('laço aberto: não conclui e devolve os problemas', () => {
    const d = removeSegs(editDraft('floor', 'e', SQUARE), ['e:o3']);
    expect(canFinish(d)).toBe(false);
    const r = finish(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.code).toBe('open');
  });

  it('laço fechado: conclui com externo, arestas na ordem do anel e flags de telhado', () => {
    const d = editDraft('roof', 'r', SQUARE, [], {
      outer: [{ definesSlope: false }, { slopePct: 20 }, {}, { overhang: 1.2 }],
    });
    expect(canFinish(d)).toBe(true);
    const r = finish(d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outer).toEqual(SQUARE);
    expect(r.holes).toEqual([]);
    expect(r.edges).toEqual([
      { segId: 'r:o0', definesSlope: false, slopePct: 30, overhang: 0.5 },
      { segId: 'r:o1', definesSlope: true, slopePct: 20, overhang: 0.5 },
      { segId: 'r:o2', definesSlope: true, slopePct: 30, overhang: 0.5 },
      { segId: 'r:o3', definesSlope: true, slopePct: 30, overhang: 1.2 },
    ]);
  });

  it('nos outros alvos as flags são ignoradas: arestas neutras', () => {
    const d = editDraft('floor', 'f', SQUARE, [], { outer: [{ slopePct: 50, overhang: 2 }] });
    const r = finish(d);
    expect(r.ok && r.edges[0]).toEqual({ segId: 'f:o0', definesSlope: false, slopePct: 0, overhang: 0 });
  });

  it('arco amostrado repete o mesmo seg nos lados do anel', () => {
    let d = newDraft('roof');
    d = addSegs(d, [
      { a: v2(0, 0), b: v2(4, 0) },
      { a: v2(4, 0), b: v2(4, 3), sag: 1 },
      { a: v2(4, 3), b: v2(0, 3) },
      { a: v2(0, 3), b: v2(0, 0) },
    ]);
    d = setSegSlope(d, 's2', { slopePct: 45 });
    const r = finish(d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outer).toHaveLength(5);
    expect(r.edges.map((e) => e.segId)).toEqual(['s1', 's2', 's2', 's3', 's4']);
    expect(r.edges[1]!.slopePct).toBe(45);
    expect(r.edges[2]!.slopePct).toBe(45);
  });

  it('furos vêm como anéis próprios', () => {
    const hole: Vec2[] = [v2(1, 1), v2(2, 1), v2(2, 2), v2(1, 2)];
    const outerSegs = addSegs(newDraft('floor'), [
      { a: v2(0, 0), b: v2(4, 0) },
      { a: v2(4, 0), b: v2(4, 3) },
      { a: v2(4, 3), b: v2(0, 3) },
      { a: v2(0, 3), b: v2(0, 0) },
    ]).segs;
    vi.mocked(validateSketch).mockReturnValueOnce({
      ok: true,
      issues: [],
      loops: [
        { role: 'outer', segs: outerSegs, ring: SQUARE },
        { role: 'hole', segs: [], ring: hole },
      ],
    });
    const r = finish(addSegs(newDraft('floor'), []));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outer).toEqual(SQUARE);
      expect(r.holes).toEqual([hole]);
    }
  });
});

describe('cancel e imutabilidade', () => {
  it('cancel devolve null', () => {
    expect(cancel(newDraft('roof'))).toBeNull();
  });

  it('nenhuma operação altera o rascunho de entrada', () => {
    const d0 = setDefaults(editDraft('roof', 'r', SQUARE, [[v2(1, 1), v2(2, 1), v2(2, 2)]]), { overhang: 2 });
    const snap = structuredClone(d0);
    addSeg(d0, { a: v2(0, 0), b: v2(1, 0) });
    addSegs(d0, [{ a: v2(0, 0), b: v2(1, 0) }]);
    removeSegs(d0, ['r:o0']);
    replaceSegs(d0, ['r:o1'], [{ a: v2(4, 0), b: v2(5, 0) }]);
    moveSegs(d0, ['r:o0'], v2(3, 3));
    selectSegs(d0, ['r:o0'], true);
    setSegSlope(d0, 'r:o0', { slopePct: null, definesSlope: false });
    setDefaults(d0, { slopePct: 9 });
    finish(d0);
    canFinish(d0);
    expect(d0).toEqual(snap);
  });
});
