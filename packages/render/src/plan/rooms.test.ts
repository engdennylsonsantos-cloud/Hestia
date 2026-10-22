import { describe, expect, it } from 'vitest';
import { resolveLevel, resolveRooms, type ResolvedRoom } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoom, makeWall, type Project } from '@hestia/model';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { roomLabelText, roomOps, roomSelectionOps } from './rooms.ts';
import { DARK, LIGHT } from './types.ts';
import { defaultPaint } from './style.ts';
import type { Viewport } from '../viewport.ts';

const P = (x: number, y: number) => ({ x, y });
const VIEW = (zoom: number): Viewport => ({ cx: 3, cy: 2, zoom, width: 800, height: 600 });

/** Quatro paredes de um retângulo 6 × 4 (eixo) no nível térreo, com um ambiente no centro. */
function sala(name = 'Sala', number = '101', extra: Partial<Parameters<typeof makeRoom>[0]> = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const corners = [P(0, 0), P(6, 0), P(6, 4), P(0, 4)];
  corners.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b: corners[(i + 1) % 4]! }) }));
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name, number, point: P(3, 2), ...extra }) });
  return s.project;
}

function input(p: Project, over: Partial<PlanInput> = {}): PlanInput {
  return {
    project: p,
    levelId: 'lv_0',
    resolved: resolveLevel(p, 'lv_0', new Map()),
    below: null,
    viewport: VIEW(100),
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
    ...over,
  };
}

describe('ambiente na planta (D1, E3)', () => {
  it('etiqueta: nome, número entre parênteses e área com 2 casas; no grosso, só o nome', () => {
    const r = { name: 'Sala', number: '101', area: 20 } as ResolvedRoom;
    expect(roomLabelText(r, 'fine')).toBe('Sala (101) · 20,00 m²');
    expect(roomLabelText(r, 'medium')).toBe('Sala (101) · 20,00 m²');
    expect(roomLabelText(r, 'coarse')).toBe('Sala');
    expect(roomLabelText({ name: '', number: '7', area: 1.5 } as ResolvedRoom, 'fine')).toBe('Ambiente 7 (7) · 1,50 m²');
  });

  it('desenha o preenchimento e a etiqueta do ambiente, com a área do circuito (4 × 6 menos as paredes)', () => {
    const p = sala();
    const ops = roomOps(p, 'lv_0', LIGHT, false, 'fine', undefined, defaultPaint('room', 100));
    expect(ops.fills).toHaveLength(1);
    expect(ops.labels).toHaveLength(1);
    const text = ops.labels[0]!.text;
    expect(text).toMatch(/^Sala \(101\) · \d+,\d\d m²$/);
    const area = Number(text.match(/· (\d+),(\d\d) m²/)!.slice(1).join('.'));
    expect(area).toBeGreaterThan(19);
    expect(area).toBeLessThan(24);
  });

  it('ambiente oculto ou sem circuito não é desenhado', () => {
    const p = sala();
    const paint = defaultPaint('room', 100);
    expect(roomOps(p, 'lv_0', LIGHT, false, 'fine', new Set(['r1']), paint).fills).toHaveLength(0);
    const aberto = sala('Sala', '101', { point: P(20, 20) });
    expect(roomOps(aberto, 'lv_0', LIGHT, false, 'fine', undefined, paint).fills).toHaveLength(0);
  });

  it('cor própria do ambiente substitui o padrão; no tema escuro o preenchimento muda', () => {
    const paint = defaultPaint('room', 100);
    const claro = roomOps(sala('Sala', '101', { color: '#ff0000' }), 'lv_0', LIGHT, false, 'fine', undefined, paint).fills[0]!.color;
    const escuro = roomOps(sala(), 'lv_0', DARK, true, 'fine', undefined, paint).fills[0]!.color;
    expect(claro).toMatch(/^#/);
    expect(claro).not.toBe(roomOps(sala(), 'lv_0', LIGHT, false, 'fine', undefined, paint).fills[0]!.color);
    expect(escuro).not.toBe(claro);
  });

  it('seleção destaca o contorno do ambiente selecionado e o hover, e nada sem seleção', () => {
    const p = sala();
    expect(roomSelectionOps(p, 'lv_0', [], null, LIGHT).fills).toHaveLength(0);
    const sel = roomSelectionOps(p, 'lv_0', ['r1'], null, LIGHT);
    expect(sel.fills).toHaveLength(1);
    expect(sel.strokes.length).toBeGreaterThan(0);
    expect(roomSelectionOps(p, 'lv_0', [], 'r1', LIGHT).fills[0]!.alpha).toBeLessThan(sel.fills[0]!.alpha);
  });

  it('entra na lista de desenho da planta, com a etiqueta', () => {
    const p = sala();
    const dl = buildPlanDrawList(input(p));
    expect(dl.labels.some((l) => /^Sala \(101\) · /.test(l.text))).toBe(true);
    expect(resolveRooms(p, 'lv_0')).toHaveLength(1);
  });
});
