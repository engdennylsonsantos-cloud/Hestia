import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import { RampLiveSession, LIVE_MAX_VERTICES, type RampLiveConfig } from './rampLiveSession.ts';
import type { PreviewItem } from './types.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
const v = (x: number, y: number): Vec2 => ({ x, y });
const cfg = (extra: Partial<RampLiveConfig> = {}): RampLiveConfig => ({ H: 0.8, type, mode: 'slope', slope: 1 / 12, width: 1.5, ...extra });
const labelOf = (items: PreviewItem[]): string => {
  const l = items.find((i) => i.kind === 'label');
  return l && l.kind === 'label' ? l.text : '';
};

describe('sessão da rampa livre: transições', () => {
  it('IDLE → ORIGIN: o 1º clique fixa o ponto inicial', () => {
    const s = new RampLiveSession(cfg());
    expect(s.state).toBe('IDLE');
    expect(s.click(v(0, 0))).toEqual({ kind: 'added', state: 'ORIGIN' });
    expect(s.state).toBe('ORIGIN');
    expect(s.points).toEqual([v(0, 0)]);
  });

  it('ORIGIN: clique a menos de 0,01 m é ignorado; a partir disso confirma o trecho → DRAWING', () => {
    const s = new RampLiveSession(cfg({ H: 1.5 }));
    s.click(v(0, 0));
    expect(s.click(v(0.005, 0)).kind).toBe('ignored');
    expect(s.state).toBe('ORIGIN');
    expect(s.click(v(5, 0))).toEqual({ kind: 'added', state: 'DRAWING' });
    expect(s.state).toBe('DRAWING');
    expect(s.points).toHaveLength(2);
  });

  it('ORIGIN → REACHED quando o 1º trecho já fecha o desnível', () => {
    const s = new RampLiveSession(cfg());
    s.click(v(0, 0));
    const e = s.click(v(9.6, 0));
    expect(e.kind).toBe('added');
    expect(s.state).toBe('REACHED');
  });

  it('DRAWING → REACHED: o clique além do topo trunca o trecho onde o desnível fecha', () => {
    const s = new RampLiveSession(cfg());
    s.click(v(0, 0));
    const e = s.click(v(12, 0));
    expect(s.state).toBe('REACHED');
    expect(e.kind === 'added' && e.message).toMatch(/encurtado/);
    const last = s.points[1]!;
    expect(last.x).toBeCloseTo(9.6, 6);
    expect(last.y).toBeCloseTo(0, 9);
  });

  it('DRAWING → DRAWING: segundo trecho confirma e acumula o desnível (exemplo 4: 5 m + 6 m, falta 0,01 m)', () => {
    const s = new RampLiveSession(cfg());
    s.click(v(0, 0));
    s.click(v(5, 0));
    expect(s.state).toBe('DRAWING');
    expect(labelOf(s.move(v(5, 6)))).toContain('faltam 0,01 m de desnível');
    s.click(v(5, 6));
    expect(s.state).toBe('DRAWING');
    expect(s.faltaConfirmada).toBeCloseTo(0.0083, 3);
  });

  it('DRAWING: o rótulo mostra faltam, alcançado e passou', () => {
    const s = new RampLiveSession(cfg());
    s.click(v(0, 0));
    expect(labelOf(s.move(v(5, 0)))).toContain('faltam 0,38 m de desnível');
    expect(labelOf(s.move(v(9.6, 0)))).toContain('nível de topo alcançado');
    expect(labelOf(s.move(v(11, 0)))).toContain('passou 0,12 m');
  });

  it('clique repetido no último vértice conclui; falta desnível avisa primeiro e cria no 2º pedido', () => {
    const s = new RampLiveSession(cfg({ H: 1.5 }));
    s.click(v(0, 0));
    s.click(v(5, 0));
    const w = s.click(v(5.01, 0));
    expect(w.kind).toBe('warn');
    expect(w.kind === 'warn' && w.message).toMatch(/^Faltam 1,08 m de desnível\. Enter de novo cria assim\.$/);
    expect(s.state).toBe('DRAWING');
    const d = s.click(v(5, 0));
    expect(d.kind).toBe('done');
    expect(d.kind === 'done' && d.path).toEqual([v(0, 0), v(5, 0)]);
    expect(d.kind === 'done' && d.falta).toBeCloseTo(1.5 - 5 / 12, 6);
    expect(s.state).toBe('IDLE');
  });

  it('finish com o desnível fechado conclui direto; em REACHED o clique também conclui', () => {
    const a = new RampLiveSession(cfg());
    a.click(v(0, 0));
    a.click(v(9.6, 0));
    expect(a.finish().kind).toBe('done');
    const b = new RampLiveSession(cfg());
    b.click(v(0, 0));
    b.click(v(9.6, 0));
    expect(b.click(v(20, 20)).kind).toBe('done');
    expect(b.state).toBe('IDLE');
  });

  it('finish com menos de 2 pontos é ignorado', () => {
    const s = new RampLiveSession(cfg());
    expect(s.finish().kind).toBe('ignored');
    s.click(v(0, 0));
    expect(s.finish().kind).toBe('ignored');
    expect(s.state).toBe('ORIGIN');
  });

  it('Backspace volta REACHED → DRAWING → ORIGIN → IDLE; sem nada devolve false', () => {
    const s = new RampLiveSession(cfg({ H: 1.0 }));
    expect(s.back()).toBe(false);
    s.click(v(0, 0));
    s.click(v(6, 0));
    s.click(v(6, 20));
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
    const s = new RampLiveSession(cfg({ H: 1.5 }));
    s.click(v(0, 0));
    s.click(v(5, 0));
    s.cancel();
    expect(s.state).toBe('IDLE');
    expect(s.points).toEqual([]);
    expect(s.preview()).toEqual([]);
  });

  it('comprimento digitado vale na direção do cursor; sem direção é ignorado', () => {
    const s = new RampLiveSession(cfg({ H: 1.5 }));
    expect(s.typeLength(3).kind).toBe('ignored');
    s.click(v(0, 0));
    expect(s.typeLength(3).kind).toBe('ignored');
    s.move(v(0, 10));
    expect(s.typeLength(4)).toEqual({ kind: 'added', state: 'DRAWING' });
    expect(s.points[1]!.x).toBeCloseTo(0, 9);
    expect(s.points[1]!.y).toBeCloseTo(4, 9);
  });

  it('o giro cria o patamar de giro na prévia e recusa retorno agudo', () => {
    const s = new RampLiveSession(cfg({ H: 3 }));
    s.click(v(0, 0));
    s.click(v(5, 0));
    const items = s.move(v(5, 6));
    expect(items.filter((i) => i.kind === 'polygon' && i.tone === 'landing').length).toBeGreaterThanOrEqual(1);
    const back = s.move(v(0.2, 0.3));
    expect(labelOf(back)).toMatch(/Retorno agudo/);
    expect(s.click(v(0.2, 0.3)).kind).toBe('ignored');
  });

  it('modo comprimento: nunca chega a REACHED e o rótulo diz Resulta', () => {
    const s = new RampLiveSession(cfg({ mode: 'length', slope: undefined, H: 0.8 }));
    s.click(v(0, 0));
    expect(labelOf(s.move(v(11, 0)))).toMatch(/Resulta .*dentro da norma/);
    s.click(v(11, 0));
    expect(s.state).toBe('DRAWING');
  });

  it('limite de vértices', () => {
    const s = new RampLiveSession(cfg({ H: 1000 }));
    s.click(v(0, 0));
    for (let i = 1; i < LIVE_MAX_VERTICES; i++) s.click(v(i * 3, 0));
    expect(s.points).toHaveLength(LIVE_MAX_VERTICES);
    expect(s.click(v(500, 0)).kind).toBe('ignored');
  });
});

describe('sessão da rampa livre: desempenho da prévia', () => {
  it('movimentos de menos de 1 px mantêm a mesma prévia', () => {
    const s = new RampLiveSession(cfg({ H: 5 }));
    s.click(v(0, 0));
    const a = s.move(v(5, 0), 0.01);
    expect(s.move(v(5.005, 0.002), 0.01)).toBe(a);
    expect(s.move(v(5.05, 0), 0.01)).not.toBe(a);
  });

  it('40 vértices: 200 moves em menos de 200 ms (meta: < 2 ms por move)', () => {
    const s = new RampLiveSession(cfg({ H: 100 }));
    s.click(v(0, 0));
    for (let i = 1; i < LIVE_MAX_VERTICES; i++) {
      const a = (i % 2 === 0 ? 1 : -1) * 0.5;
      const last = s.points[s.points.length - 1]!;
      expect(s.click(v(last.x + 4 * Math.cos(a), last.y + 4 * Math.sin(a) + 0.8)).kind).toBe('added');
    }
    expect(s.points).toHaveLength(LIVE_MAX_VERTICES);
    const last = s.points[s.points.length - 1]!;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) s.move(v(last.x + 3 + i * 0.01, last.y + 2 + (i % 7) * 0.1), 0);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('sessão da rampa livre: load', () => {
  it('recarrega os vértices (volta a DRAWING) e mantém o rascunho anterior se um vértice não é aceito', () => {
    const s = new RampLiveSession(cfg({ H: 1.5 }));
    s.click(v(0, 0));
    s.click(v(6, 0));
    s.click(v(6, 4));
    const pts = s.points;
    s.cancel();
    expect(s.state).toBe('IDLE');
    expect(s.load(pts)).toBe(true);
    expect(s.state).toBe('DRAWING');
    expect(s.points).toEqual(pts);
    expect(s.load([v(0, 0), v(0.001, 0)])).toBe(false);
    expect(s.points).toEqual(pts);
  });
});
