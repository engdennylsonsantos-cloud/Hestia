import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, dimensionGeometry, dimensionPoints, dimensionText, dimensionValue, formatDimensionValue, makeWall, type Dimension } from './index.ts';

const LV0 = 'lv_0';
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

function storeWithWall(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: LV0, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  return s;
}

const dim = (over: Partial<Dimension> = {}): Dimension => ({ id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1, ...over });

describe('texto da cota', () => {
  it('sem texto fixo, mostra o valor medido', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(dimensionText(s.project, dim())).toBe('4,00 m');
  });

  it('texto fixo substitui o valor medido; vazio ou só espaços voltam ao valor medido', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(dimensionText(s.project, dim({ text: 'Vão 3,60' }))).toBe('Vão 3,60');
    expect(dimensionText(s.project, dim({ text: '   ' }))).toBe('4,00 m');
  });
});

describe('valor da cota', () => {
  it('é a distância a–b arredondada a 1 mm', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(dimensionValue(s.project, dim({ b: { x: 3.4564, y: 0 } }))).toBe(3.456);
  });

  it('formata com duas casas e vírgula, em metros', () => {
    expect(formatDimensionValue(3.5)).toBe('3,50 m');
    expect(formatDimensionValue(0.125)).toBe('0,13 m');
  });

  it('segue a extremidade da parede quando há referência', () => {
    const s = storeWithWall();
    // Parede movida: b vai para x = 6. A cota guardada (x = 4) não é mais a verdade.
    s.exec({ type: 'setWallEnds', id: 'w1', b: { x: 6, y: 0 } });
    const d = dim({ refs: { b: { wallId: 'w1', end: 'b' } } });
    expect(dimensionPoints(s.project, d).b).toEqual({ x: 6, y: 0 });
    expect(dimensionValue(s.project, d)).toBe(6);
  });

  it('sem a parede, vira livre e usa o ponto guardado', () => {
    const s = new ProjectStore(createEmptyProject());
    const d = dim({ refs: { b: { wallId: 'sumiu', end: 'b' } } });
    expect(dimensionPoints(s.project, d).b).toEqual({ x: 4, y: 0 });
    expect(dimensionValue(s.project, d)).toBe(4);
  });

  it('com eixo, a referência projeta só a coordenada do eixo (cadeia reta)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: LV0, a: { x: 0, y: 0 }, b: { x: 4, y: 2 } }) });
    // A ponta b está em (4, 2); a cota corre em y = 5 e só acompanha o x da parede.
    const d = dim({ a: { x: 0, y: 5 }, b: { x: 0, y: 5 }, refs: { b: { wallId: 'w1', end: 'b', axis: 'x' } } });
    expect(dimensionPoints(s.project, d).b).toEqual({ x: 4, y: 5 });
    expect(dimensionValue(s.project, d)).toBe(4);
  });
});

describe('geometria da cota', () => {
  it('linha de cota paralela a a–b, deslocada pelo offset para a esquerda de a→b', () => {
    const g = dimensionGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 0.01);
    close(g.line[0], { x: 0, y: 1 });
    close(g.line[1], { x: 4, y: 1 });
    expect(g.length).toBe(4);
  });

  it('offset negativo leva a linha para o outro lado', () => {
    const g = dimensionGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, -1, 0.01);
    close(g.line[0], { x: 0, y: -1 });
    close(g.line[1], { x: 4, y: -1 });
    // A chamada parte do ponto medido e passa da linha de cota no mesmo lado.
    expect(g.extensions[0][0].y).toBeLessThan(0);
    expect(g.extensions[0][1].y).toBeLessThan(-1);
  });

  it('chamadas vão do ponto medido até 2 mm de papel além da linha', () => {
    const g = dimensionGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 0.01);
    close(g.extensions[0][0], { x: 0, y: 0.015 });
    close(g.extensions[0][1], { x: 0, y: 1.02 });
    close(g.extensions[1][1], { x: 4, y: 1.02 });
  });

  it('marcas a 45° nas extremidades: meia-marca de 1,4 mm de papel', () => {
    const g = dimensionGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 0.01);
    const [p0, p1] = g.ticks[0];
    const half = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2;
    expect(half).toBeCloseTo(0.014, 9);
    // Direção da marca: (1, 1) normalizado, isto é, 45° em relação à linha de cota.
    expect((p1.x - p0.x) / (p1.y - p0.y)).toBeCloseTo(1, 9);
  });

  it('texto centrado no meio, acima da linha de cota', () => {
    const g = dimensionGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 0.01);
    expect(g.textAt.x).toBeCloseTo(2, 9);
    expect(g.textAt.y).toBeGreaterThan(1);
    expect(g.textRotation).toBe(0);
  });

  it('rotação do texto fica legível da esquerda ou de baixo', () => {
    expect(dimensionGeometry({ x: 4, y: 0 }, { x: 0, y: 0 }, 1, 0.01).textRotation).toBe(0);
    expect(dimensionGeometry({ x: 0, y: 0 }, { x: 0, y: 4 }, 1, 0.01).textRotation).toBe(90);
    expect(dimensionGeometry({ x: 0, y: 4 }, { x: 0, y: 0 }, 1, 0.01).textRotation).toBe(90);
  });
});
