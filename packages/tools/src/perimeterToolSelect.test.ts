import { describe, expect, it } from 'vitest';
import type { SketchDraft, SketchSeg, Vec2 } from '@hestia/geom';
import { selectAllSegs, selectSegsMode } from './perimeterSession.ts';
import { boxSelection } from './perimeterToolPick.ts';
import { selectClick } from './perimeterToolInput.ts';
import { BoxSelection, selectionModeOf } from './perimeterToolSelect.ts';
import type { PointerInfo } from './types.ts';

const P = (x: number, y: number): Vec2 => ({ x, y });
const SEGS: SketchSeg[] = [
  { id: 's0', a: P(0.5, 0.5), b: P(1.5, 0.5) },
  { id: 's1', a: P(0, 0.5), b: P(4, 0.5) },
  { id: 's2', a: P(10, 10), b: P(11, 11) },
];

const draft = (segs: SketchSeg[] = SEGS, selected: string[] = []): SketchDraft => ({
  target: 'floor',
  segs,
  selected,
  defaults: { definesSlope: true, slopePct: 30, overhang: 0.5 },
});

const pointer = (raw: Vec2, mods: Partial<Pick<PointerInfo, 'shift' | 'ctrl'>> = {}): PointerInfo => ({
  raw,
  shift: false,
  ctrl: false,
  alt: false,
  ...mods,
});

describe('boxSelection: janela e cruzamento', () => {
  it('da esquerda para a direita pega só as linhas inteiras dentro da caixa', () => {
    expect(boxSelection(SEGS, P(0, 0), P(2, 1))).toEqual(['s0']);
  });

  it('da direita para a esquerda pega as linhas que tocam a caixa', () => {
    expect(boxSelection(SEGS, P(2, 1), P(0, 0))).toEqual(['s0', 's1']);
  });

  it('linha que só toca a borda entra no cruzamento, mas não na janela', () => {
    const touching: SketchSeg[] = [{ id: 't', a: P(1.5, 0.5), b: P(3, 0.5) }];
    expect(boxSelection(touching, P(0, 0), P(2, 1))).toEqual([]);
    expect(boxSelection(touching, P(2, 1), P(0, 0))).toEqual(['t']);
  });

  it('linha colinear com a borda da caixa também é tocada', () => {
    const along: SketchSeg[] = [{ id: 'a', a: P(-1, 1), b: P(3, 1) }];
    expect(boxSelection(along, P(2, 1), P(0, 0))).toEqual(['a']);
  });
});

describe('mudança de seleção', () => {
  it('substitui, soma (Shift) e subtrai (Ctrl)', () => {
    const d = draft();
    expect(selectSegsMode(d, ['s0']).selected).toEqual(['s0']);
    expect(selectSegsMode(selectSegsMode(d, ['s0']), ['s1'], 'add').selected).toEqual(['s0', 's1']);
    expect(selectSegsMode(selectSegsMode(d, ['s0', 's1']), ['s0'], 'subtract').selected).toEqual(['s1']);
  });

  it('ignora ids desconhecidos', () => {
    expect(selectSegsMode(draft(), ['s0', 'nope']).selected).toEqual(['s0']);
  });

  it('Ctrl+A seleciona todas as linhas do esboço', () => {
    expect(selectAllSegs(draft(SEGS, ['s1'])).selected).toEqual(['s0', 's1', 's2']);
  });

  it('Ctrl subtrai, Shift soma, sem modificador substitui', () => {
    expect(selectionModeOf(pointer(P(0, 0), { ctrl: true }))).toBe('subtract');
    expect(selectionModeOf(pointer(P(0, 0), { shift: true }))).toBe('add');
    expect(selectionModeOf(pointer(P(0, 0)))).toBe('replace');
  });
});

describe('selectClick: clique nas linhas e no vazio', () => {
  const click = (p: PointerInfo, d = draft(SEGS, ['s0'])) => selectClick(d, p, false, 0.01, 'dica');

  it('Ctrl subtrai a linha clicada; Shift soma', () => {
    expect(click(pointer(P(1, 0.5), { ctrl: true })).next.selected).toEqual([]);
    expect(click(pointer(P(1, 0.5), { shift: true }), draft(SEGS, ['s1'])).next.selected).toEqual(['s1', 's0']);
  });

  it('clique no vazio sem Shift limpa; com Shift mantém; com Ctrl sem Shift também limpa', () => {
    expect(click(pointer(P(9, 9))).next.selected).toEqual([]);
    expect(click(pointer(P(9, 9), { shift: true })).next.selected).toEqual(['s0']);
    expect(click(pointer(P(9, 9), { ctrl: true })).next.selected).toEqual([]);
  });
});

describe('BoxSelection: arraste no vazio', () => {
  function host(d: SketchDraft) {
    const saidas: string[] = [];
    let atual = d;
    const box = new BoxSelection({
      draft: () => atual,
      mpp: () => 0.01,
      replace: (next) => {
        atual = next;
      },
      say: (msg) => saidas.push(msg),
    });
    return { box, saidas, atual: () => atual };
  }

  it('começa no vazio, desenha durante o arrasto e aplica a janela ao soltar', () => {
    const h = host(draft());
    h.box.down(pointer(P(0, 0)));
    expect(h.box.current()).toBeNull();
    h.box.drag(pointer(P(2, 1)));
    expect(h.box.current()).toEqual({ a: P(0, 0), b: P(2, 1), window: true });
    expect(h.box.up(pointer(P(2, 1)))).toBe(true);
    expect(h.atual().selected).toEqual(['s0']);
    expect(h.box.current()).toBeNull();
  });

  it('Shift soma e Ctrl subtrai ao soltar', () => {
    const soma = host(draft(SEGS, ['s1']));
    soma.box.down(pointer(P(0, 0)));
    soma.box.drag(pointer(P(2, 1)));
    soma.box.up(pointer(P(2, 1), { shift: true }));
    expect(soma.atual().selected).toEqual(['s1', 's0']);

    const subtrai = host(draft(SEGS, ['s0', 's1']));
    subtrai.box.down(pointer(P(1, 1)));
    subtrai.box.drag(pointer(P(0, 0)));
    subtrai.box.up(pointer(P(0, 0), { ctrl: true }));
    expect(subtrai.atual().selected).toEqual([]);
  });

  it('clique numa linha não começa a caixa', () => {
    const h = host(draft());
    h.box.down(pointer(P(1, 0.5)));
    expect(h.box.active()).toBe(false);
  });

  it('sem arrasto, o up não trata como janela (o clique limpa a seleção no caminho normal)', () => {
    const h = host(draft(SEGS, ['s0']));
    h.box.down(pointer(P(0, 0)));
    expect(h.box.up(pointer(P(0, 0)))).toBe(false);
    expect(h.atual().selected).toEqual(['s0']);
  });
});
