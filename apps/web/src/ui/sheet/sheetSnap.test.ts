import { describe, expect, it } from 'vitest';
import { alignmentGuides, snapMove } from './sheetSnap.ts';

const inner = { x0: 10, y0: 10, x1: 410, y1: 287 };
const other = { x: 100, y: 100, w: 100, h: 50 };

describe('encaixe ao mover', () => {
  it('encosta a borda esquerda na borda esquerda da outra vista e devolve a guia', () => {
    const r = snapMove({ x: 98, y: 200, w: 60, h: 40 }, { boxes: [other], inner }, { tolMm: 3 });
    expect(r.box.x).toBe(100);
    expect(r.delta.x).toBeCloseTo(2, 9);
    expect(r.guides).toEqual([{ axis: 'v', at: 100 }]);
  });

  it('centraliza quando o centro está mais perto que as bordas', () => {
    // caixa 60 de largura: centro 98+30 = 128; alvo 150 (centro da outra) → delta 22
    const r = snapMove({ x: 120, y: 200, w: 60, h: 40 }, { boxes: [other], inner }, { tolMm: 25 });
    expect(r.box.x).toBe(120);
    expect(r.guides.some((g) => g.axis === 'v' && g.at === 150)).toBe(true);
  });

  it('não encaixa fora da tolerância', () => {
    const r = snapMove({ x: 250, y: 250, w: 60, h: 40 }, { boxes: [other], inner }, { tolMm: 2 });
    expect(r.box.x).toBe(250);
    expect(r.guides).toEqual([]);
  });

  it('encaixa na grade de 5 mm e nas bordas da área de desenho', () => {
    const r = snapMove({ x: 62, y: 61, w: 50, h: 40 }, { boxes: [], inner, step: 5 }, { tolMm: 3 });
    expect(r.box.x).toBe(60);
    expect(r.box.y).toBe(60);
    expect(r.guides).toHaveLength(2);
    const edge = snapMove({ x: 12, y: 200, w: 50, h: 40 }, { boxes: [], inner }, { tolMm: 3 });
    expect(edge.box.x).toBe(10);
  });

  it('sem alvo por perto, a caixa não muda', () => {
    const r = snapMove({ x: 200, y: 200, w: 50, h: 40 }, { boxes: [other], inner }, { tolMm: 2 });
    expect(r.box).toEqual({ x: 200, y: 200, w: 50, h: 40 });
    expect(r.delta).toEqual({ x: 0, y: 0 });
  });
});

describe('guias de alinhamento', () => {
  it('mostra guias quando bordas coincidem, sem mexer na caixa', () => {
    const g = alignmentGuides({ x: 100, y: 300, w: 40, h: 20 }, [other], 1);
    expect(g).toContainEqual({ axis: 'v', at: 100 });
    expect(alignmentGuides({ x: 300, y: 300, w: 40, h: 20 }, [other], 1)).toEqual([]);
  });
});

describe('encaixe em linhas do desenho', () => {
  it('encaixa a borda esquerda exatamente na linha vertical e devolve a guia', () => {
    // esquerda em 198,5; linha em 200 → delta 1,5 (a área de desenho não tem alvo mais perto).
    const r = snapMove(
      { x: 198.5, y: 160, w: 60, h: 40 },
      { boxes: [], inner, lines: [{ axis: 'v', at: 200 }] },
      { tolMm: 3 },
    );
    expect(r.box.x).toBe(200);
    expect(r.delta.x).toBeCloseTo(1.5, 9);
    expect(r.guides).toEqual([{ axis: 'v', at: 200 }]);
  });

  it('encaixa o topo em uma linha horizontal', () => {
    const r = snapMove(
      { x: 200, y: 160, w: 40, h: 40 },
      { boxes: [], inner, lines: [{ axis: 'h', at: 201.5 }] },
      { tolMm: 3 },
    );
    expect(r.box.y).toBe(161.5);
    expect(r.guides).toEqual([{ axis: 'h', at: 201.5 }]);
  });

  it('a linha mais próxima vence a borda de outra vista quando o delta é menor', () => {
    // outras bordas: 100/150/200; linha em 203. Esquerda 202 → linha (1) ganha da borda (2).
    const r = snapMove(
      { x: 202, y: 160, w: 60, h: 40 },
      { boxes: [other], inner, lines: [{ axis: 'v', at: 203 }] },
      { tolMm: 3 },
    );
    expect(r.box.x).toBe(203);
    expect(r.guides).toEqual([{ axis: 'v', at: 203 }]);
  });

  it('a grade continua funcionando quando não há linha por perto', () => {
    const r = snapMove(
      { x: 62, y: 61, w: 50, h: 40 },
      { boxes: [], inner, step: 5, lines: [{ axis: 'v', at: 400 }, { axis: 'h', at: 280 }] },
      { tolMm: 3 },
    );
    expect(r.box.x).toBe(60);
    expect(r.box.y).toBe(60);
    expect(r.guides).toHaveLength(2);
  });

  it('linhas duplicadas não geram guias repetidas', () => {
    const r = snapMove(
      { x: 198.5, y: 160, w: 60, h: 40 },
      {
        boxes: [],
        inner,
        lines: [
          { axis: 'v', at: 200 },
          { axis: 'v', at: 200 + 5e-7 },
          { axis: 'v', at: 200 },
        ],
      },
      { tolMm: 3 },
    );
    expect(r.box.x).toBe(200);
    expect(r.guides).toEqual([{ axis: 'v', at: 200 }]);
  });

  it('ignora linhas acima do limite por eixo (corte silencioso)', () => {
    // 300 linhas verticais; a que coincide com a caixa é a 251ª e cai fora do limite de 200.
    const lines = Array.from({ length: 300 }, (_, i) => ({ axis: 'v' as const, at: 300 + i * 10 }));
    const r = snapMove({ x: 2798.5, y: 160, w: 60, h: 40 }, { boxes: [], inner, lines }, { tolMm: 3 });
    expect(r.box.x).toBe(2798.5);
    expect(r.delta.x).toBe(0);
    expect(r.guides).toEqual([]);
  });
});

describe('guias de alinhamento com linhas', () => {
  it('mostra guia de linha quando a borda coincide', () => {
    const g = alignmentGuides({ x: 100, y: 300, w: 40, h: 20 }, [], 1, [
      { axis: 'v', at: 100 },
      { axis: 'h', at: 300 },
    ]);
    expect(g).toContainEqual({ axis: 'v', at: 100 });
    expect(g).toContainEqual({ axis: 'h', at: 300 });
    expect(g).toHaveLength(2);
  });

  it('não mostra guia de linha fora da tolerância e mantém as chamadas sem linhas', () => {
    expect(alignmentGuides({ x: 100, y: 300, w: 40, h: 20 }, [], 1, [{ axis: 'v', at: 110 }])).toEqual([]);
    expect(alignmentGuides({ x: 100, y: 300, w: 40, h: 20 }, [other], 1)).toContainEqual({ axis: 'v', at: 100 });
  });
});
