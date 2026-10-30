import { describe, expect, it } from 'vitest';
import { resolverRotulo } from './zoomOps.ts';
import { ProjectStore, createEmptyProject, angularDimensionData, paperMmToPx } from '@hestia/model';
import { noteOps } from './notes.ts';
import { defaultPaint } from './style.ts';
import { Limiares, type VistaComLimiares } from './limiares.ts';
import { valorCabeNoTrecho } from './dimLabels.ts';

const LV0 = 'lv_0';
const ZOOM = 40;
const SCALE = 100;
const VISTA = { cx: 0, cy: 0, zoom: ZOOM, width: 800, height: 600 };
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
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE);
    const cota = ops.labels[0]!;
    expect(cota.text).toBe('4,00 m');
    expect(cota.center).toBe(true);
    expect(cota.rotation).toBe(0);
    expect(resolverRotulo(cota, ZOOM).fontPx).toBeCloseTo(paperMmToPx(2.5, ZOOM, SCALE), 9);
    expect(cota.at.y).toBeGreaterThan(1);
  });

  it('o texto da cota segue as unidades do projeto', () => {
    const s = comCota();
    s.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    const ops = noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE);
    expect(ops.labels[0]!.text).toBe('400,0 cm');
  });

  it('cota gera linha, duas chamadas e duas marcas: 5 traços com a espessura de corte da categoria', () => {
    const p = comCota().project;
    const pt = defaultPaint('annotation', ZOOM);
    const ops = noteOps(p, LV0, pt, LOOK, SCALE);
    expect(ops.strokes).toHaveLength(5);
    for (const st of ops.strokes) expect(st.widthPx).toBe(pt.cutPx);
  });

  it('cota curta (valor maior que o trecho): rótulo afastado com linha de chamada, alternando alturas entre vizinhos', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c1', a: { x: 0, y: 0 }, b: { x: 0.12, y: 0 }, offset: 1 } });
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c2', a: { x: 0.12, y: 0 }, b: { x: 0.3, y: 0 }, offset: 1 } });
    const ops = noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE, VISTA);
    const [r1, r2] = [ops.labels[0]!, ops.labels[1]!];
    // Trecho de 0,12 m a 40 px/m (~4,8 px) não cabe o texto "0,12 m": o rótulo sai fora da linha (acima do centro, em y negativo do desenho)
    expect(r1.text).toBe('0,12 m');
    expect(r1.at.y).toBeGreaterThan(1.5);
    expect(r2.at.y).toBeGreaterThan(r1.at.y);
    expect(ops.strokes.filter((st) => st.pts.length === 2 && st.widthPx === defaultPaint('annotation', ZOOM).cutPx)).toHaveLength(2 * 5 + 2);
  });

  it('texto livre: valor, altura em mm de papel e rotação do próprio texto', () => {
    const p = comCota().project;
    const ops = noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE);
    const t = ops.labels[1]!;
    expect(t).toMatchObject({ text: 'Sala', rotation: 90, at: { x: 2, y: 2 } });
    expect(resolverRotulo(t, ZOOM).fontPx).toBeCloseTo(paperMmToPx(3, ZOOM, SCALE), 9);
  });

  it('categoria anotação oculta: nada sai', () => {
    const p = comCota().project;
    const off = { ...defaultPaint('annotation', ZOOM), visible: false };
    expect(noteOps(p, LV0, off, LOOK, SCALE)).toEqual({ fills: [], strokes: [], labels: [] });
  });

  it('nível sem anotações: nada sai', () => {
    const p = createEmptyProject();
    expect(noteOps(p, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE)).toEqual({ fills: [], strokes: [], labels: [] });
  });

  it('cota curta: a decisão "cabe no trecho" vira um limiar de zoom que o quadro registra', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c1', a: { x: 0, y: 0 }, b: { x: 1.2, y: 0 }, offset: 1 } });
    const limiares = new Limiares();
    const v: VistaComLimiares = { ...VISTA, limiares };
    noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE, v);
    // "1,20 m" (6 caracteres) a 0,6 em por caractere, com a fonte no piso de 1 px: cabe em 1,2 m a partir de 0,6 × 6 / 1,2 = 3 px/m
    expect(limiares.lista()).toEqual([3]);
    // Trecho de 0,12 m: a fonte de papel (0,25 px por px/m) nunca deixa o texto caber, então não há limiar a registrar
    const curta = new ProjectStore(createEmptyProject());
    curta.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c2', a: { x: 0, y: 0 }, b: { x: 0.12, y: 0 }, offset: 1 } });
    const l2 = new Limiares();
    noteOps(curta.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE, { ...VISTA, limiares: l2 } as VistaComLimiares);
    expect(l2.lista()).toEqual([]);
  });

  it('o limiar de zoom coincide com a conta direta de largura do texto em px (qualquer escala e trecho)', () => {
    for (const [escala, trecho, textMm] of [[100, 0.12, 2.5], [50, 0.3, 2.5], [200, 1, 3], [100, 4, 2.5], [20, 0.05, 1.8]] as const) {
      const { limiar } = valorCabeNoTrecho('0,12 m', trecho, textMm, escala, 1);
      for (const z of [1, 5, 12, 20, 30, 40, 60, 100, 220, 500, 2000]) {
        const { cabe } = valorCabeNoTrecho('0,12 m', trecho, textMm, escala, z);
        expect(cabe, `escala ${escala}, trecho ${trecho}, zoom ${z}`).toBe(z >= limiar);
      }
    }
  });

  it('texto com largura de caixa: a largura sai em mm de papel e vira px com o zoom', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 0, y: 0 }, text: 'Texto longo', height: 3, rotation: 0, width: 40, bold: true } });
    const t = noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE).labels[0]!;
    expect(t.papel).toMatchObject({ escala: SCALE, fontMm: 3, widthMm: 40 });
    expect(t.bold).toBe(true);
    expect(resolverRotulo(t, ZOOM).widthPx).toBeCloseTo(paperMmToPx(40, ZOOM, SCALE), 9);
  });

  it('cota angular: arco, chamadas, marcas e valor em graus', () => {
    const s = new ProjectStore(createEmptyProject());
    const angular = angularDimensionData({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 2, 'minor', 'a', 'b');
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'ang', a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, offset: 0, angular, precision: 1 } });
    const ops = noteOps(s.project, LV0, defaultPaint('annotation', ZOOM), LOOK, SCALE);
    expect(ops.labels).toHaveLength(1);
    expect(ops.labels[0]!.text).toContain('90');
    expect(ops.strokes.length).toBeGreaterThanOrEqual(5);
  });
});
