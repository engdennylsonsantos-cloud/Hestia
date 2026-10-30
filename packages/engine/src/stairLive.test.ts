import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import {
  STAIR_COUNT_EPS,
  distributeStairRisers,
  layoutStairSegment,
  liveStairRemaining,
  stairLiveParams,
  type StairLiveParams,
} from './stairLive.ts';

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;
const params = (H: number, width?: number): StairLiveParams => {
  const p = stairLiveParams(H, mono, { width });
  if ('error' in p) throw new Error(p.error);
  return p;
};
const flights = (l: ReturnType<typeof layoutStairSegment>) => l.pieces.filter((p) => p.kind === 'flight');

describe('stairLiveParams', () => {
  it('H = 2,80: N = 16, h = 0,175, T = 0,28, M = 18, P = 1,20', () => {
    const p = params(2.8);
    expect(p.risers).toBe(16);
    expect(p.riserHeight).toBeCloseTo(0.175, 12);
    expect(p.tread).toBeCloseTo(0.28, 12);
    expect(p.maxPerFlight).toBe(18);
    expect(p.landingLength).toBe(1.2);
  });
  it('H = 3,60: N = 20, h = 0,18, T sobe ao mínimo 0,28, M = 17', () => {
    const p = params(3.6);
    expect(p.risers).toBe(20);
    expect(p.riserHeight).toBeCloseTo(0.18, 12);
    expect(p.tread).toBeCloseTo(0.28, 12);
    expect(p.maxPerFlight).toBe(17);
  });
  it('largura maior que o patamar mínimo manda no comprimento do patamar em linha', () => {
    expect(params(2.8, 1.5).landingLength).toBe(1.5);
  });
  it('fixed troca N e T; h = H ÷ N', () => {
    const p = stairLiveParams(2.8, mono, { fixed: { risers: 17, tread: 0.3125 } });
    if ('error' in p) throw new Error(p.error);
    expect(p.risers).toBe(17);
    expect(p.riserHeight).toBeCloseTo(2.8 / 17, 12);
    expect(p.tread).toBe(0.3125);
  });
  it('erros: tipo inexistente, H <= 0, N < 2', () => {
    expect(stairLiveParams(2.8, undefined as never)).toEqual({ error: 'Tipo de escada inválido.' });
    expect(stairLiveParams(0, mono)).toEqual({ error: 'A altura deve ser positiva: nada a gerar.' });
    expect(stairLiveParams(-1, mono)).toEqual({ error: 'A altura deve ser positiva: nada a gerar.' });
    expect(stairLiveParams(0.1, mono)).toEqual({ error: 'A altura é menor que um espelho: nada a gerar.' });
    expect(stairLiveParams(2.8, mono, { fixed: { risers: 1, tread: 0.3 } })).toEqual({ error: 'A altura é menor que um espelho: nada a gerar.' });
  });
});

describe('layoutStairSegment', () => {
  const p = params(2.8);
  it('Exemplo 1: vão de 5 m com 16 espelhos = 1 lance de 16, comprimento 4,20', () => {
    const l = layoutStairSegment(5, p, 16);
    expect(l.pieces).toHaveLength(1);
    expect(l.pieces[0]).toMatchObject({ kind: 'flight', at: 0, risers: 16 });
    expect(l.risers).toBe(16);
    expect(l.length).toBeCloseTo(4.2, 9);
    expect(l.leftover1).toBe(false);
  });
  it('vão de 1,5 m sem rebalanceio: 1 lance de 6 espelhos (floor(1,5 ÷ 0,28) + 1)', () => {
    const l = layoutStairSegment(1.5, p, 7, false);
    expect(l.pieces).toHaveLength(1);
    expect(l.pieces[0]!.risers).toBe(6);
    expect(l.length).toBeCloseTo(1.4, 9);
  });
  it('vão menor que um piso = nenhuma peça (span < T, negativo)', () => {
    expect(layoutStairSegment(0.1, p).pieces).toEqual([]);
    expect(layoutStairSegment(-1, p).pieces).toEqual([]);
    expect(layoutStairSegment(0.1, p).length).toBe(0);
  });
  it('Infinity com need finito: lance de 7 espelhos, comprimento 1,68', () => {
    const l = layoutStairSegment(Infinity, p, 7);
    expect(l.pieces).toHaveLength(1);
    expect(l.pieces[0]!.risers).toBe(7);
    expect(l.length).toBeCloseTo(1.68, 9);
  });
  it('2 espelhos exigem vão >= T (tolerância de contagem)', () => {
    expect(layoutStairSegment(0.28, p).risers).toBe(2);
    expect(layoutStairSegment(0.28 - 1e-12, p).risers).toBe(2);
    expect(layoutStairSegment(0.28 - 1e-6, p).risers).toBe(0);
    expect(STAIR_COUNT_EPS).toBe(1e-9);
  });

  describe('H = 3,60 (N = 20, M = 17)', () => {
    const q = params(3.6);
    it('vão de 7 m: lance 17 (4,48) + patamar em linha (at 4,48; 1,20) + lance 3 (at 5,68; 0,56)', () => {
      const l = layoutStairSegment(7, q, 20);
      expect(l.pieces.map((x) => x.kind)).toEqual(['flight', 'landing', 'flight']);
      expect(l.pieces[0]).toMatchObject({ at: 0, risers: 17 });
      expect(l.pieces[0]!.length).toBeCloseTo(4.48, 9);
      expect(l.pieces[1]!.at).toBeCloseTo(4.48, 9);
      expect(l.pieces[1]!.length).toBeCloseTo(1.2, 9);
      expect(l.pieces[2]!.at).toBeCloseTo(5.68, 9);
      expect(l.pieces[2]!.length).toBeCloseTo(0.56, 9);
      expect(l.pieces[2]!.risers).toBe(3);
      expect(l.risers).toBe(20);
      expect(l.length).toBeCloseTo(6.24, 9);
    });
    it('need = 18: regra do resto, lances 16 + 2 com patamar entre eles', () => {
      const l = layoutStairSegment(7, q, 18);
      expect(flights(l).map((f) => f.risers)).toEqual([16, 2]);
      expect(l.pieces.map((x) => x.kind)).toEqual(['flight', 'landing', 'flight']);
      expect(l.pieces[2]!.at).toBeCloseTo(15 * 0.28 + 1.2, 9);
      expect(l.leftover1).toBe(false);
    });
    it('need = 18 sem balanceTail: só o lance de 17 (o 18º fica para a extensão)', () => {
      const l = layoutStairSegment(7, q, 18, false);
      expect(l.pieces).toHaveLength(1);
      expect(l.risers).toBe(17);
    });
    it('need = 20: sem ajuste (17 + patamar + 3)', () => {
      expect(flights(layoutStairSegment(7, q, 20)).map((f) => f.risers)).toEqual([17, 3]);
    });
    it('sem espaço para P + T depois do lance cheio: não põe patamar', () => {
      const l = layoutStairSegment(4.48 + 1.2 + 0.2, q, 20, false);
      expect(l.pieces).toHaveLength(1);
      expect(l.risers).toBe(17);
    });
    it('lance sem espaço para rebalancear (patamar não caberia depois): marca leftover1 e mantém o lance cheio', () => {
      // 17 cabem exatos (4,48 m); tirar 1 espelho daria 4,20 + 1,20 + 0,28 = 5,68 m de vão, que não cabe em 4,48.
      const l = layoutStairSegment(4.48, q, 18);
      expect(l.risers).toBe(17);
      expect(l.leftover1).toBe(true);
    });
    it('lance de 2 espelhos antes de 1 sobrando: não dá para rebalancear (leftover1)', () => {
      const l = layoutStairSegment(0.3, p, 3);
      expect(l.risers).toBe(2);
      expect(l.leftover1).toBe(true);
    });
  });
});

describe('liveStairRemaining', () => {
  const p = params(2.8);
  it('cursor a 3,0 m: faltam 5 espelhos (≈ 1,4 m)', () => {
    const r = liveStairRemaining({ params: p, span: 3, risersBefore: 0 });
    expect(r.status).toBe('falta');
    expect(r.placed).toBe(11);
    expect(r.falta).toBe(5);
    expect(r.faltaLength).toBeCloseTo(1.4, 9);
    expect(r.closeAt).toBeNull();
    expect(r.excess).toBe(0);
  });
  it('cursor a 4,2 m: alcançado, closeAt 4,2 (também com 1e-12 a menos)', () => {
    for (const span of [4.2, 4.2 - 1e-12]) {
      const r = liveStairRemaining({ params: p, span, risersBefore: 0 });
      expect(r.status).toBe('alcancado');
      expect(r.placed).toBe(16);
      expect(r.falta).toBe(0);
      expect(r.closeAt).toBeCloseTo(4.2, 9);
    }
  });
  it('cursor a 5,0 m: passou 2 espelhos, closeAt 4,2', () => {
    const r = liveStairRemaining({ params: p, span: 5, risersBefore: 0 });
    expect(r.status).toBe('passou');
    expect(r.excess).toBe(2);
    expect(r.placed).toBe(16);
    expect(r.closeAt).toBeCloseTo(4.2, 9);
  });
  it('com 9 espelhos antes e vão de 0,5 m: o vão tem 2 espelhos, faltam 5', () => {
    const r = liveStairRemaining({ params: p, span: 0.5, risersBefore: 9 });
    expect(r.status).toBe('falta');
    expect(r.placed).toBe(11);
    expect(r.falta).toBe(5);
  });
  it('vão vivo vazio: faltam todos', () => {
    const r = liveStairRemaining({ params: p, span: 0.1, risersBefore: 9 });
    expect(r.falta).toBe(7);
  });
});

describe('distributeStairRisers', () => {
  const p = params(2.8);
  it('Exemplo 3: [2,4; 0,1; 2,4] = 9, 0 e 7 espelhos, fecha no vão 2', () => {
    const d = distributeStairRisers([2.4, 0.1, 2.4], p);
    expect(d.layouts.map((l) => l.risers)).toEqual([9, 0, 7]);
    expect(d.closedAt).toBe(2);
    expect(d.missing).toBe(0);
    expect(d.placed).toBe(16);
  });
  it('Exemplo 2: [2,4; 1,5] = 9 + 6, falta 1 (o último vão não rebalanceia)', () => {
    const d = distributeStairRisers([2.4, 1.5], p);
    expect(d.layouts.map((l) => l.risers)).toEqual([9, 6]);
    expect(d.closedAt).toBeNull();
    expect(d.missing).toBe(1);
    expect(d.placed).toBe(15);
  });
  it('1º vão sem espaço fica vazio', () => {
    const d = distributeStairRisers([0.1, 2.4], p);
    expect(d.layouts[0]!.risers).toBe(0);
    expect(d.layouts[1]!.risers).toBe(9);
    expect(d.missing).toBe(7);
  });
  it('fechamento antes do último vão: os vãos seguintes ficam vazios', () => {
    const d = distributeStairRisers([5, 3, 3], p);
    expect(d.closedAt).toBe(0);
    expect(d.layouts.map((l) => l.risers)).toEqual([16, 0, 0]);
    expect(d.missing).toBe(0);
  });
  it('vão do meio que deixaria 1 espelho é rebalanceado (n − 1) para o seguinte ter 2', () => {
    // 1º vão (4,0 m) comportaria 15, restaria 1: com rebalanceio vira 14 e o 2º vão recebe 2.
    const d = distributeStairRisers([4.0, 1.0], p);
    expect(d.layouts.map((l) => l.risers)).toEqual([14, 2]);
    expect(d.closedAt).toBe(1);
    expect(d.missing).toBe(0);
  });
});
