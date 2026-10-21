import { describe, expect, it } from 'vitest';
import { createEmptyProject, type DetailLevel, type Project } from '@hestia/model';
import { straightStair } from '../stairFixture.helper.ts';
import type { ResolvedStairStep } from '@hestia/engine';
import { belowStairOps, stairFills, stairSelectionOps, STAIR_CUT_HEIGHT, treadNumber } from './stairs.ts';
import { defaultPaint } from './style.ts';

/** Espessura de corte da escada no zoom dos testes (100 px/m, 1:100): antes, 1,4 px fixos. */
const RISER_PX = defaultPaint('stair', 100).cutPx;
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const N = 10;
const P = 0.28;
const H = 0.175;
const ZOOM = 100;
const VIEW: Viewport = { cx: 0.5, cy: 1.5, zoom: ZOOM, width: 800, height: 600 };
const PROJECT: Project = createEmptyProject();

const stair = () => straightStair({ risers: N, tread: P, riserH: H, width: 1 });
const ops = (detail: DetailLevel = 'medium', s = stair()) => stairFills(PROJECT, [s], LIGHT, false, detail, VIEW);

/** Linhas de espelho: abertas, de dois pontos, sem tracejado (o único tipo de traço com 2 pontos). */
const risersOf = (strokes: ReturnType<typeof ops>['strokes']) => strokes.filter((s) => !s.closed && s.pts.length === 2 && !s.dash && s.widthPx === RISER_PX);

describe('escada na planta (decisão 0011 §1)', () => {
  it('uma linha de espelho por espelho (N = 10)', () => {
    expect(risersOf(ops().strokes)).toHaveLength(N);
  });

  it('degraus com topo acima da cota de corte (1,20 m) saem tracejados; os de baixo, contínuos', () => {
    const outlines = ops().strokes.filter((s) => s.closed);
    // Degrau k tem topo em k·h: k = 7, 8 e 9 passam de 1,20 m (1,225; 1,400; 1,575).
    expect(outlines.filter((s) => s.dash)).toHaveLength(3);
    expect(outlines.filter((s) => !s.dash)).toHaveLength(6);
    expect(STAIR_CUT_HEIGHT).toBe(1.2);
  });

  it('seta de subida: caminhada pelos pontos médios dos espelhos, ponta no último', () => {
    const { strokes } = ops();
    const shaft = strokes.find((s) => !s.closed && s.pts.length === N)!;
    expect(shaft.pts[0]!.y).toBeCloseTo(P, 9);
    expect(shaft.pts[N - 1]!.y).toBeCloseTo(N * P, 9);
    const head = strokes.find((s) => !s.closed && s.pts.length === 3)!;
    expect(head.pts[1]).toEqual(shaft.pts[N - 1]);
    // As pontas ficam para trás da ponta (subida em +y).
    expect(head.pts[0]!.y).toBeLessThan(N * P);
    expect(head.pts[2]!.y).toBeLessThan(N * P);
  });

  it('o rótulo SOBE fica junto ao início da seta', () => {
    const sobe = ops().labels.find((l) => l.text === 'SOBE')!;
    expect(sobe).toBeDefined();
    expect(sobe.at.x).toBeCloseTo(0.5, 9);
    expect(sobe.at.y).toBeCloseTo(P, 9);
  });

  it('símbolo de corte: zigue-zague que cruza a caminhada na cota de 1,20 m, na largura do lance', () => {
    const cut = ops().strokes.find((s) => !s.closed && s.pts.length === 9)!;
    // Cota de corte entre os pontos médios dos espelhos 7 e 8 (z = 6,5·h e 7,5·h).
    const t = (STAIR_CUT_HEIGHT - 6.5 * H) / H;
    const yCut = 7 * P + t * P;
    for (const q of cut.pts) expect(Math.abs(q.y - yCut)).toBeLessThanOrEqual(4 / ZOOM + 1e-9);
    const xs = cut.pts.map((q) => q.x);
    expect(Math.min(...xs)).toBeCloseTo(-0.08, 9);
    expect(Math.max(...xs)).toBeCloseTo(1.08, 9);
  });

  it('lance que não chega a 1,20 m não tem símbolo de corte', () => {
    const low = straightStair({ risers: 5, tread: P, riserH: H, width: 1 });
    expect(ops('medium', low).strokes.some((s) => !s.closed && s.pts.length === 9)).toBe(false);
  });

  it('ordem: espelhos recebidos fora de ordem saem em ordem de subida', () => {
    const s = stair();
    const shuffled = { ...s, risers: [...s.risers].reverse() };
    const shaft = ops('medium', shuffled).strokes.find((t) => !t.closed && t.pts.length === N)!;
    expect(shaft.pts[0]!.y).toBeCloseTo(P, 9);
    expect(shaft.pts[N - 1]!.y).toBeCloseTo(N * P, 9);
  });

  it('nível de detalhe: grosseiro só preenche a pegada; fino numera os degraus', () => {
    const coarse = ops('coarse');
    expect(coarse.fills).toHaveLength(1);
    expect(coarse.strokes).toHaveLength(0);
    expect(coarse.labels).toHaveLength(0);
    expect(ops('medium').labels.map((l) => l.text)).toEqual(['SOBE']);
    expect(ops('fine').labels.map((l) => l.text)).toEqual(['SOBE', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('subpavimento: só a pegada e os contornos, esmaecidos, sem seta nem corte', () => {
    const below = belowStairOps([stair()], LIGHT);
    expect(below.fills).toHaveLength(1);
    expect(below.fills[0]!.alpha).toBe(0.22);
    expect(below.strokes).toHaveLength(N - 1);
    expect(below.strokes.some((s) => s.dash)).toBe(false);
    expect(below.labels).toHaveLength(0);
  });

  it('seleção: destaque padrão de azul translúcido sobre a pegada', () => {
    const s = stair();
    const sel = stairSelectionOps(PROJECT, [s], [s.id], null, LIGHT, VIEW);
    expect(sel.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.26)).toBe(true);
    expect(sel.strokes.some((st) => st.closed && st.widthPx === 2 && st.color === LIGHT.select)).toBe(true);
  });
});

describe('numeração contínua dos degraus (decisão 0011 §1 item 6)', () => {
  const numbers = (labels: ReturnType<typeof ops>['labels']) => labels.map((l) => l.text).filter((t) => t !== 'SOBE');

  it('escada reta de 16 espelhos: rótulos 1..15 (degrau k alcança o espelho k+1)', () => {
    const s = straightStair({ risers: 16, tread: P, riserH: H, width: 1 });
    expect(numbers(ops('fine', s).labels)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
  });

  it('o número é a cota: com a base em 0,30 m, o 1º degrau ainda é o 1 e o 9º é o 9', () => {
    const s = straightStair({ risers: 16, tread: P, riserH: H, width: 1, baseZ: 0.3 });
    expect(treadNumber(s, s.steps[0]!)).toBe(1);
    expect(treadNumber(s, s.steps[8]!)).toBe(9);
  });

  it('degrau de um 2º lance: o index do lance reinicia em 1, mas o número segue a cota (9 depois de um patamar de 8)', () => {
    const s = straightStair({ risers: 16, tread: P, riserH: H, width: 1 });
    const second: ResolvedStairStep = { ...s.steps[0]!, componentIndex: 2, index: 1, z: s.baseZ + 9 * H };
    expect(second.index).toBe(1);
    expect(treadNumber(s, second)).toBe(9);
  });

  it('sem altura real do espelho, o número cai no índice do lance', () => {
    const s = { ...straightStair({ risers: 4, tread: P, riserH: H, width: 1 }), riserHeight: 0 };
    expect(treadNumber(s, s.steps[1]!)).toBe(2);
  });
});
