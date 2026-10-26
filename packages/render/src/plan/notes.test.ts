import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, paperMmToPx } from '@hestia/model';
import { noteOps } from './notes.ts';
import { defaultPaint } from './style.ts';

const LV0 = 'lv_0';
const ZOOM = 40;
const SCALE = 100;
const LOOK = { ink: '#000', select: '#f00', selection: [] as string[] };

function comCota(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
  s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 2, y: 2 }, text: 'Sala', height: 3, rotation: 90 } });
  return s;
}

describe('anotações na planta', () => {
  it('cota: texto do valor "4,00 m" centrado acima da linha, com a fonte em mm de papel × escala', () => {
    const p = comCota().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE);
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
    const ops = noteOps(p, LV0, pt, LOOK, ZOOM, SCALE);
    expect(ops.strokes).toHaveLength(5);
    for (const st of ops.strokes) expect(st.widthPx).toBe(pt.cutPx);
  });

  it('cota curta (valor maior que o trecho): rótulo afastado com linha de chamada, alternando alturas entre vizinhos', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c1', a: { x: 0, y: 0 }, b: { x: 0.12, y: 0 }, offset: 1 } });
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c2', a: { x: 0.12, y: 0 }, b: { x: 0.3, y: 0 }, offset: 1 } });
    const ops = noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE);
    const [r1, r2] = [ops.labels[0]!, ops.labels[1]!];
    // Trecho de 0,12 m a 40 px/m (~4,8 px) não cabe o texto "0,12 m": o rótulo sai fora da linha (acima do centro, em y negativo do desenho)
    expect(r1.text).toBe('0,12 m');
    expect(r1.at.y).toBeGreaterThan(1.5);
    expect(r2.at.y).toBeGreaterThan(r1.at.y);
    expect(ops.strokes.filter((st) => st.pts.length === 2 && st.widthPx === defaultPaint('annotation', ZOOM).cutPx)).toHaveLength(2 * 5 + 2);
  });

  it('texto livre: valor, altura em mm de papel e rotação do próprio texto', () => {
    const p = comCota().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE);
    const t = ops.labels[1]!;
    expect(t).toMatchObject({ text: 'Sala', rotation: 90, at: { x: 2, y: 2 } });
    expect(t.fontPx).toBeCloseTo(paperMmToPx(3, ZOOM, SCALE), 9);
  });

  it('categoria anotação oculta: nada sai', () => {
    const p = comCota().project;
    const off = { ...defaultPaint('annotation', ZOOM), visible: false };
    expect(noteOps(p, LV0, off, LOOK, ZOOM, SCALE)).toEqual({ fills: [], strokes: [], labels: [] });
  });

  it('nível sem anotações: nada sai', () => {
    const p = createEmptyProject();
    expect(noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, ZOOM, SCALE)).toEqual({ fills: [], strokes: [], labels: [] });
  });
});
