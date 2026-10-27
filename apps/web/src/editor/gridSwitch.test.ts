import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SNAP } from '@hestia/tools';
import { setGridStep, setSnap, useUi } from './state.ts';

describe('grade de pontos: chave única de desenho e captura', () => {
  beforeEach(() => {
    setSnap({ grid: false });
    setGridStep(0);
  });

  it('ligar a grade liga os pontos e a captura juntos', () => {
    setSnap({ grid: true });
    expect(useUi.getState().showGrid).toBe(true);
    expect((useUi.getState().options.snap ?? DEFAULT_SNAP).grid).toBe(true);
  });

  it('desligar a captura apaga os pontos', () => {
    setSnap({ grid: true });
    setSnap({ grid: false });
    expect(useUi.getState().showGrid).toBe(false);
  });

  it('outras capturas não mexem na grade', () => {
    setSnap({ grid: true });
    setSnap({ midpoint: false });
    expect(useUi.getState().showGrid).toBe(true);
  });

  it('o intervalo é guardado e valores inválidos voltam ao automático', () => {
    setGridStep(0.5);
    expect(useUi.getState().gridStep).toBe(0.5);
    setGridStep(-1);
    expect(useUi.getState().gridStep).toBe(0);
    setGridStep(Number.NaN);
    expect(useUi.getState().gridStep).toBe(0);
  });
});
