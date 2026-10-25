import { describe, expect, it } from 'vitest';
import type { OpeningGeometry } from '@hestia/engine';
import { LIGHT } from './types.ts';
import { openingSymbol } from './symbols.ts';

const geom = (over: Partial<OpeningGeometry>): OpeningGeometry => ({
  openingId: 'o',
  hostId: 'w',
  kind: 'door',
  center: { x: 0, y: 0 },
  u: { x: 1, y: 0 },
  n: { x: 0, y: 1 },
  width: 0.9,
  height: 2.1,
  roughWidth: 0.9,
  roughHeight: 2.1,
  sill: 0,
  thickness: 0.14,
  sHi: 0.07,
  sLo: -0.07,
  leaves: 1,
  plan: 'swing',
  flipHand: false,
  flipFacing: false,
  offset: 0,
  ...over,
});

const count = (over: Partial<OpeningGeometry>): number => openingSymbol(geom(over), LIGHT).length;

describe('vão livre (leaves 0)', () => {
  it('vão livre: duas linhas tracejadas nas faces da parede, sem X, sem folha nem caixilho', () => {
    const s = openingSymbol(geom({ leaves: 0 }), LIGHT);
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.dash !== undefined)).toBe(true);
    expect(s[0]!.pts[0]!.y).toBeCloseTo(0.07);
    expect(s[0]!.pts[1]!.y).toBeCloseTo(0.07);
    expect(s[1]!.pts[0]!.y).toBeCloseTo(-0.07);
    expect(s[0]!.pts[0]!.x).toBeCloseTo(-0.45);
    expect(s[0]!.pts[1]!.x).toBeCloseTo(0.45);
  });
});

describe('símbolo por família de planta', () => {
  it('porta de uma folha: folha e arco', () => {
    expect(count({ kind: 'door', plan: 'swing', leaves: 1 })).toBe(2);
  });
  it('porta dupla: duas folhas e dois arcos', () => {
    expect(count({ kind: 'door', plan: 'double', leaves: 2 })).toBe(4);
  });
  it('porta de correr: dois retângulos fechados e seta', () => {
    const s = openingSymbol(geom({ kind: 'door', plan: 'sliding', leaves: 2 }), LIGHT);
    expect(s).toHaveLength(4);
    expect(s.filter((x) => x.closed)).toHaveLength(2);
  });
  it('porta pivotante: círculo do eixo, folha aberta e dois arcos (um por banda)', () => {
    const s = openingSymbol(geom({ kind: 'door', plan: 'pivot', leaves: 1 }), LIGHT);
    expect(s).toHaveLength(4);
    expect(s[0]!.closed).toBe(true);
  });
  it('janela fixa: duas faces, plano médio e duas ombreiras', () => {
    expect(count({ kind: 'window', plan: 'fixed', leaves: 2 })).toBe(5);
  });
  it('janela basculante acrescenta a folha em V', () => {
    expect(count({ kind: 'window', plan: 'tilt', leaves: 1 })).toBe(6);
  });
  it('maxim-ar acrescenta um arco tracejado', () => {
    const s = openingSymbol(geom({ kind: 'window', plan: 'casement', leaves: 1 }), LIGHT);
    expect(s).toHaveLength(6);
    expect(s.at(-1)!.dash).toBeDefined();
  });
  it('janela de correr: sem plano médio, com duas folhas deslocadas e seta', () => {
    expect(count({ kind: 'window', plan: 'sliding', leaves: 2 })).toBe(8);
  });
  it('famílias diferentes geram desenhos diferentes', () => {
    const sig = (over: Partial<OpeningGeometry>): string => JSON.stringify(openingSymbol(geom({ kind: 'door', ...over }), LIGHT));
    const all = [sig({ plan: 'swing', leaves: 1 }), sig({ plan: 'double', leaves: 2 }), sig({ plan: 'sliding', leaves: 1 }), sig({ plan: 'pivot', leaves: 1 })];
    expect(new Set(all).size).toBe(all.length);
  });
});
