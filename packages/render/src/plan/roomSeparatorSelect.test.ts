import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject } from '@hestia/model';
import { noteOps, roomSeparatorStrokes } from './notes.ts';
import { defaultPaint } from './style.ts';

const LV0 = 'lv_0';
const ZOOM = 40;
const SCALE = 100;
const SELECT = '#f00';
const LOOK = { ink: '#000', select: SELECT, selection: [] as string[] };

function comSeparador(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoomSeparator', levelId: LV0, separator: { id: 's1', a: { x: 2, y: -0.5 }, b: { x: 2, y: 5.5 } } });
  return s;
}

describe('linha de separação selecionada na planta', () => {
  it('com a linha selecionada, usa a cor de seleção e espessura maior, mantendo o traço', () => {
    const p = comSeparador().project;
    const pt = { ...defaultPaint('annotation', ZOOM), color: '#123456' };
    const [st] = roomSeparatorStrokes(p, LV0, pt, '#123456', new Set(['s1']), SELECT);
    expect(st!.color).toBe(SELECT);
    expect(st!.widthPx).toBeGreaterThan(pt.projPx);
    expect(st!.dash).toEqual([6, 3]);
    expect(st!.alpha).toBe(1);
  });

  it('sem seleção, usa o traço normal da categoria anotação', () => {
    const p = comSeparador().project;
    const pt = { ...defaultPaint('annotation', ZOOM), color: '#123456' };
    const [st] = roomSeparatorStrokes(p, LV0, pt, '#123456');
    expect(st).toMatchObject({ widthPx: pt.projPx, color: '#123456', alpha: 1 });
    expect(st!.dash).toEqual([6, 3]);
  });

  it('seleção de outro id não destaca a linha', () => {
    const p = comSeparador().project;
    const pt = defaultPaint('annotation', ZOOM);
    const [st] = roomSeparatorStrokes(p, LV0, pt, '#000', new Set(['outro']), SELECT);
    expect(st).toMatchObject({ widthPx: pt.projPx, color: '#000' });
  });

  it('noteOps usa look.selection para destacar a linha selecionada', () => {
    const p = comSeparador().project;
    const pt = defaultPaint('annotation', ZOOM);
    const sel = noteOps(p, LV0, pt, { ...LOOK, selection: ['s1'] }, ZOOM, SCALE).strokes.filter((s) => s.dash);
    const nao = noteOps(p, LV0, pt, LOOK, ZOOM, SCALE).strokes.filter((s) => s.dash);
    expect(sel).toHaveLength(1);
    expect(sel[0]!.color).toBe(SELECT);
    expect(sel[0]!.widthPx).toBeGreaterThan(nao[0]!.widthPx);
  });
});
