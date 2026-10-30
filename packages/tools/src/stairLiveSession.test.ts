import { describe, expect, it, vi } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import { planStairFree, resolveStairs } from '@hestia/engine';
import { STAIR_LIVE_MAX_VERTICES, StairLiveSession, type StairLiveConfig } from './stairLiveSession.ts';
import type { PreviewItem } from './types.ts';

vi.mock('@hestia/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hestia/engine')>();
  return { ...actual, planStairFree: vi.fn(actual.planStairFree), resolveStairs: vi.fn(actual.resolveStairs) };
});

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;
const v = (x: number, y: number): Vec2 => ({ x, y });
const cfg = (extra: Partial<StairLiveConfig> = {}): StairLiveConfig => ({ H: 2.8, type: mono, width: 1.2, ...extra });
const labelOf = (items: PreviewItem[]): string => {
  const l = items.find((i) => i.kind === 'label');
  return l && l.kind === 'label' ? l.text : '';
};
const acute = (from: Vec2): Vec2 => ({ x: from.x + 2 * Math.cos((170 * Math.PI) / 180), y: from.y + 2 * Math.sin((170 * Math.PI) / 180) });
const almostStraight = (from: Vec2): Vec2 => ({ x: from.x + 2 * Math.cos((2 * Math.PI) / 180), y: from.y + 2 * Math.sin((2 * Math.PI) / 180) });

describe('sessão da escada livre: transições', () => {
  it('IDLE → ORIGIN → DRAWING: cliques e recusa de um clique a menos de 0,01 m', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    expect(s.state).toBe('IDLE');
    expect(s.click(v(0, 0))).toEqual({ kind: 'added', state: 'ORIGIN' });
    expect(s.click(v(0.005, 0)).kind).toBe('ignored');
    expect(s.state).toBe('ORIGIN');
    expect(s.click(v(5, 0))).toEqual({ kind: 'added', state: 'DRAWING' });
    expect(s.state).toBe('DRAWING');
    expect(s.points).toHaveLength(2);
  });

  it('reta: os rótulos de falta, alcançado e passou com os textos exatos', () => {
    const s = new StairLiveSession(cfg());
    s.click(v(0, 0));
    expect(labelOf(s.move(v(3, 0)))).toBe('16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)');
    expect(labelOf(s.move(v(4.2, 0)))).toBe('16 espelhos · 17,5 cm · piso 28,0 cm · nível de topo alcançado');
    expect(labelOf(s.move(v(5, 0)))).toBe('16 espelhos · 17,5 cm · piso 28,0 cm · passou 2 espelhos: a escada termina antes do cursor');
  });

  it('clique além do topo trunca no último espelho e vira REACHED', () => {
    const s = new StairLiveSession(cfg());
    s.click(v(0, 0));
    s.move(v(5, 0));
    const e = s.click(v(5, 0));
    expect(e.kind).toBe('added');
    expect(e.kind === 'added' && e.state).toBe('REACHED');
    expect(e.kind === 'added' && e.message).toMatch(/^Nível de topo alcançado/);
    expect(s.points[1]!.x).toBeCloseTo(4.2, 6);
    expect(s.points[1]!.y).toBeCloseTo(0, 9);
  });

  it('em L com largura 1,0: o vão vivo depois do giro tem 2 espelhos e faltam 5', () => {
    const s = new StairLiveSession(cfg({ width: 1.0 }));
    s.click(v(0, 0));
    s.click(v(3, 0));
    expect(labelOf(s.move(v(3, 1)))).toContain('faltam 5 espelhos');
  });

  it('retorno agudo é recusado com o texto do contrato', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    s.click(v(0, 0));
    s.click(v(3, 0));
    const e = s.click(acute(v(3, 0)));
    expect(e).toEqual({ kind: 'ignored', message: 'Retorno agudo demais: use dois giros menores.' });
  });

  it('vértice quase colinear dissolve: o clique substitui o último ponto e a contagem não cresce', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    s.click(v(0, 0));
    s.click(v(2, 0));
    const c = almostStraight(v(2, 0));
    expect(s.click(c).kind).toBe('added');
    expect(s.points).toHaveLength(2);
    expect(s.points[1]!.x).toBeCloseTo(c.x, 6);
    expect(s.points[1]!.y).toBeCloseTo(c.y, 6);
  });

  it('Backspace volta REACHED → DRAWING → ORIGIN → IDLE', () => {
    const s = new StairLiveSession(cfg());
    expect(s.back()).toBe(false);
    s.click(v(0, 0));
    s.click(v(2.5, 0));
    s.click(v(2.5, 3));
    expect(s.state).toBe('REACHED');
    expect(s.back()).toBe(true);
    expect(s.state).toBe('DRAWING');
    expect(s.back()).toBe(true);
    expect(s.state).toBe('ORIGIN');
    expect(s.back()).toBe(true);
    expect(s.state).toBe('IDLE');
    expect(s.back()).toBe(false);
  });

  it('Esc (cancel) descarta o rascunho inteiro', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    s.click(v(0, 0));
    s.click(v(3, 0));
    s.cancel();
    expect(s.state).toBe('IDLE');
    expect(s.points).toEqual([]);
    expect(s.preview()).toEqual([]);
  });

  it('finish com falta: o 1º pedido avisa e o 2º devolve done com a falta', () => {
    const s = new StairLiveSession(cfg());
    s.click(v(0, 0));
    s.click(v(3, 0));
    const w = s.finish();
    expect(w.kind).toBe('warn');
    expect(w.kind === 'warn' && w.message).toBe('Faltam 5 espelhos: Enter de novo estende o último trecho em 1,40 m e cria; A ajusta.');
    const d = s.finish();
    expect(d.kind).toBe('done');
    expect(d.kind === 'done' && d.falta).toBe(5);
    expect(s.state).toBe('IDLE');
  });

  it('clique repetido a menos de 0,05 m conclui (avisando a falta antes)', () => {
    const s = new StairLiveSession(cfg());
    s.click(v(0, 0));
    s.click(v(3, 0));
    expect(s.click(v(3.01, 0)).kind).toBe('warn');
    expect(s.click(v(3.02, 0)).kind).toBe('done');
    expect(s.state).toBe('IDLE');
  });

  it('limite de vértices', () => {
    const s = new StairLiveSession(cfg({ H: 1000, width: 1.0 }));
    s.click(v(0, 0));
    for (let i = 1; i < STAIR_LIVE_MAX_VERTICES; i++) {
      const last = s.points[s.points.length - 1]!;
      const a = i % 2 === 0 ? 0.5 : -0.5;
      expect(s.click(v(last.x + 1.5 * Math.cos(a), last.y + 1.5 * Math.sin(a))).kind).toBe('added');
    }
    expect(s.points).toHaveLength(STAIR_LIVE_MAX_VERTICES);
    expect(s.click(v(500, 500)).kind).toBe('ignored');
  });

  it('comprimento digitado vale na direção do cursor', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    expect(s.typeLength(3).kind).toBe('ignored');
    s.click(v(0, 0));
    s.move(v(0, 10));
    expect(s.typeLength(4)).toEqual({ kind: 'added', state: 'DRAWING' });
    expect(s.points[1]!.y).toBeCloseTo(4, 9);
  });

  it('load restaura o rascunho; com um ponto recusado devolve false e mantém o anterior', () => {
    const s = new StairLiveSession(cfg({ H: 8 }));
    s.click(v(0, 0));
    s.click(v(5, 0));
    const pts = s.points;
    s.cancel();
    expect(s.load(pts)).toBe(true);
    expect(s.state).toBe('DRAWING');
    expect(s.points).toEqual(pts);
    expect(s.load([v(0, 0), v(3, 0), acute(v(3, 0))])).toBe(false);
    expect(s.points).toEqual(pts);
  });

  it('configure com N/T fixos muda o rótulo para 17 espelhos', () => {
    const s = new StairLiveSession(cfg());
    s.click(v(0, 0));
    expect(labelOf(s.move(v(3, 0)))).toMatch(/^16 espelhos/);
    s.configure(cfg({ fixed: { risers: 17, tread: 0.3125 } }));
    expect(labelOf(s.move(v(3, 0)))).toMatch(/^17 espelhos/);
  });
});

describe('sessão da escada livre: desempenho da prévia', () => {
  it('40 vértices: média de 2000 moves abaixo de 2 ms e nenhum plano/booleanas no movimento', () => {
    vi.mocked(planStairFree).mockClear();
    vi.mocked(resolveStairs).mockClear();
    const s = new StairLiveSession(cfg({ H: 40, width: 0.8 }));
    s.click(v(0, 0));
    for (let i = 1; i < STAIR_LIVE_MAX_VERTICES; i++) {
      const last = s.points[s.points.length - 1]!;
      const a = (i % 2 === 0 ? 40 : 100) * (Math.PI / 180);
      expect(s.click(v(last.x + 1.5 * Math.cos(a), last.y + 1.5 * Math.sin(a))).kind).toBe('added');
    }
    expect(s.points).toHaveLength(STAIR_LIVE_MAX_VERTICES);
    const last = s.points[s.points.length - 1]!;
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) s.move(v(last.x + 3 + i * 0.01, last.y + 2 + (i % 7) * 0.1), 0);
    const media = (performance.now() - t0) / 2000;
    expect(media).toBeLessThan(2);
    expect(planStairFree).not.toHaveBeenCalled();
    expect(resolveStairs).not.toHaveBeenCalled();
  });
});
