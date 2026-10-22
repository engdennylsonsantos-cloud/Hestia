import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, paperMmToPx } from '@hestia/model';
import { noteOps } from './notes.ts';
import { defaultPaint } from './style.ts';

const LV0 = 'lv_0';
const ZOOM = 40;
const SCALE = 100;

function comCota(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
  s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 2, y: 2 }, text: 'Sala', height: 3, rotation: 90 } });
  return s;
}

describe('anotações na planta', () => {
  it('cota: texto do valor "4,00 m" centrado acima da linha, com a fonte em mm de papel × escala', () => {
    const p = comCota().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), '#000', ZOOM, SCALE);
    const cota = ops.labels[0]!;
    expect(cota.text).toBe('4,00 m');
    expect(cota.center).toBe(true);
    expect(cota.rotation).toBe(0);
    expect(cota.fontPx).toBeCloseTo(paperMmToPx(2.5, ZOOM, SCALE), 9);
    expect(cota.at.y).toBeGreaterThan(1);
  });

  it('cota gera linha, duas chamadas e duas marcas: 5 traços com a espessura de corte da categoria', () => {
    const p = comCota().project;
    const pt = defaultPaint('annotation', ZOOM);
    const ops = noteOps(p, LV0, pt, '#000', ZOOM, SCALE);
    expect(ops.strokes).toHaveLength(5);
    for (const st of ops.strokes) expect(st.widthPx).toBe(pt.cutPx);
  });

  it('texto livre: valor, altura em mm de papel e rotação do próprio texto', () => {
    const p = comCota().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), '#000', ZOOM, SCALE);
    const t = ops.labels[1]!;
    expect(t).toMatchObject({ text: 'Sala', rotation: 90, at: { x: 2, y: 2 } });
    expect(t.fontPx).toBeCloseTo(paperMmToPx(3, ZOOM, SCALE), 9);
  });

  it('categoria anotação oculta: nada sai', () => {
    const p = comCota().project;
    const off = { ...defaultPaint('annotation', ZOOM), visible: false };
    expect(noteOps(p, LV0, off, '#000', ZOOM, SCALE)).toEqual({ strokes: [], labels: [] });
  });

  it('nível sem anotações: nada sai', () => {
    const p = createEmptyProject();
    expect(noteOps(p, LV0, defaultPaint('annotation', ZOOM), '#000', ZOOM, SCALE)).toEqual({ strokes: [], labels: [] });
  });
});
