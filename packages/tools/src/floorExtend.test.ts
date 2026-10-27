import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { coreSpan, totalThickness } from '@hestia/model';
import { enclosedRooms, outerPerimeter } from './enclosed.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Paredes de um retângulo w × h (eixo nas bordas), desenhadas pela ferramenta Parede (forma retângulo). */
function rectHouse(w: number, h: number) {
  const ctx = makeEnv();
  ctx.options.wallShape = 'rect';
  const wt = tool('wall', ctx.env);
  clickAt(wt, 0, 0);
  clickAt(wt, w, h);
  ctx.options.wallShape = 'line';
  const type = ctx.store.project.wallTypes[ctx.options.wallTypeId]!;
  const t = totalThickness(type);
  /** Espessura do acabamento interno: do núcleo até a face interna. */
  const fi = t - coreSpan(type).to;
  return { ...ctx, t, fi };
}

describe('piso até o núcleo: região das paredes com extend (enclosed)', () => {
  it('extend core: o espaço avança pelo reboco até a face do núcleo', () => {
    const { store, t, fi } = rectHouse(4, 3);
    const core = enclosedRooms(store.project, 'lv_0', 'core');
    const finish = enclosedRooms(store.project, 'lv_0', 'finish');
    expect(core).toHaveLength(1);
    expect(multiArea(core)).toBeCloseTo((4 - t + 2 * fi) * (3 - t + 2 * fi), 6);
    expect(multiArea(core)).toBeGreaterThan(multiArea(finish));
    expect(multiArea(finish)).toBeCloseTo((4 - t) * (3 - t), 6);
  });

  it('o padrão (finish) não muda: enclosedRooms sem o terceiro argumento é a face de acabamento', () => {
    const { store, t } = rectHouse(4, 3);
    expect(multiArea(enclosedRooms(store.project, 'lv_0'))).toBeCloseTo((4 - t) * (3 - t), 6);
  });
});

describe('contorno pela face externa da edificação (outerPerimeter)', () => {
  it('casa retangular 6 × 4 com paredes de 0,184 m: 6,184 × 4,184 = 25,87 m²', () => {
    const { store, t } = rectHouse(6, 4);
    const ring = outerPerimeter(store.project, 'lv_0');
    expect(ring).not.toBeNull();
    expect(multiArea([[ring!]])).toBeCloseTo((6 + t) * (4 + t), 6);
    expect(multiArea([[ring!]]).toFixed(2)).toBe('25.87');
  });

  it('ponto dentro da casa devolve o mesmo contorno externo; sem furos (um anel só)', () => {
    const { store } = rectHouse(6, 4);
    const a = outerPerimeter(store.project, 'lv_0');
    const b = outerPerimeter(store.project, 'lv_0', { x: 3, y: 2 });
    expect(b).toEqual(a);
    expect(b!.length).toBeGreaterThanOrEqual(4);
  });

  it('ponto fora, perto da parede (0,5 m), ainda pega a casa; longe, devolve null', () => {
    const { store } = rectHouse(6, 4);
    expect(outerPerimeter(store.project, 'lv_0', { x: 6.5, y: 2 })).not.toBeNull();
    expect(outerPerimeter(store.project, 'lv_0', { x: 20, y: 20 })).toBeNull();
  });

  it('nível sem paredes não tem perímetro', () => {
    const { store } = makeEnv();
    expect(outerPerimeter(store.project, 'lv_1')).toBeNull();
  });
});
