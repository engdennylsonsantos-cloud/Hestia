import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject } from '@hestia/model';
import { noteOps, roomSeparatorStrokes } from './notes.ts';
import { defaultPaint } from './style.ts';

const LV0 = 'lv_0';
const ZOOM = 40;
const SCALE = 100;
const LOOK = { ink: '#000', select: '#f00', selection: [] as string[] };

function comSeparador(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoomSeparator', levelId: LV0, separator: { id: 's1', a: { x: 2, y: -0.5 }, b: { x: 2, y: 5.5 } } });
  return s;
}

describe('linhas de separação de ambiente na planta', () => {
  it('uma linha de separação gera um traço tracejado que cobre exatamente a linha', () => {
    const p = comSeparador().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE);
    const sep = ops.strokes.filter((s) => s.dash);
    expect(sep).toHaveLength(1);
    expect(sep[0]!.closed).toBe(false);
    expect(sep[0]!.pts).toEqual([{ x: 2, y: -0.5 }, { x: 2, y: 5.5 }]);
    expect(sep[0]!.dash).toEqual([6, 3]);
  });

  it('usa a cor e a espessura de projeção da categoria anotação (sem cor nova)', () => {
    const p = comSeparador().project;
    const pt = { ...defaultPaint('annotation', ZOOM), color: '#123456' };
    const [st] = roomSeparatorStrokes(p, LV0, pt, pt.color ?? LOOK.ink);
    expect(st).toMatchObject({ widthPx: pt.projPx, color: '#123456', alpha: 1 });
  });

  it('categoria anotação oculta: a linha não sai', () => {
    const p = comSeparador().project;
    const off = { ...defaultPaint('annotation', ZOOM), visible: false };
    expect(roomSeparatorStrokes(p, LV0, off, '#000')).toEqual([]);
  });

  it('outro nível (ou nível inexistente) não recebe a linha deste nível', () => {
    const p = comSeparador().project;
    const ops = noteOps(p, 'lv_inexistente', defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE);
    expect(ops.strokes.filter((s) => s.dash)).toEqual([]);
  });
});
