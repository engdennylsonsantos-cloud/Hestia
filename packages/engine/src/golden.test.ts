import { describe, expect, it } from 'vitest';
import { multiArea, union, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * Casos dourados de geometria (item K2): contornos esperados, derivados à mão da regra de cada junção
 * (docs/05 §1 e §9; decisões 0002–0004), não copiados da saída. Alvenaria 14: núcleo ±0,070, total ±0,092
 * (tinta 2 mm + reboco 20 mm de cada lado). Alvenaria 9: núcleo ±0,045, total ±0,062.
 * Os anéis são comparados como conjuntos de vértices (independe do ponto inicial e do sentido).
 */
type W = Omit<Wall, 'order'>;
const wall = (id: string, a: [number, number], b: [number, number], extra: Partial<Wall> = {}): W =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, ...extra });
const miter = { kind: 'miter', flip: false } as const;
const square = { kind: 'square', flip: false } as const;

function level(walls: W[]) {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return resolveLevel(s.project, 'lv_0');
}

const key = (x: number, y: number): string => `${(Math.round(x * 1e3) / 1e3).toFixed(3)},${(Math.round(y * 1e3) / 1e3).toFixed(3)}`;
/** Conjunto ordenado de vértices do anel externo de cada polígono (arredondado a 1 mm). */
function shape(m: MultiPolygon): string[][] {
  return m.map((p) => [...new Set(p[0]!.map((v) => key(v.x, v.y)))].sort()).sort((a, b) => a.join('|').localeCompare(b.join('|')));
}
const expected = (...rings: Array<Array<[number, number]>>): string[][] =>
  rings.map((r) => r.map(([x, y]) => key(x, y)).sort()).sort((a, b) => a.join('|').localeCompare(b.join('|')));

const material = (r: ReturnType<typeof level>, mat: string): MultiPolygon =>
  union(...r.clusters.flatMap((c) => c.regions.filter((x) => x.materialId === mat).map((x) => x.polygons)));
const silhouette = (r: ReturnType<typeof level>): MultiPolygon => union(...r.clusters.map((c) => c.silhouette));

const A: [number, number] = [0, 0];
const B: [number, number] = [4, 0];
const C: [number, number] = [4, 3];

describe('K2 · contornos dourados por junção', () => {
  it('L em encosto (padrão): cada núcleo para na face do outro e a silhueta externa não muda', () => {
    const r = level([wall('a', A, B), wall('b', B, C)]);
    expect(shape(silhouette(r))).toEqual(expected([[0, -0.092], [4.092, -0.092], [4.092, 3], [3.908, 3], [3.908, 0.092], [0, 0.092]]));
    // Encosto pareado por face (docs/08 §5.4 passo 3): o núcleo de cada parede para na face do núcleo da outra, então
    // o contorno da estrutura é o mesmo da esquadria — o degrau do pareamento cai exatamente na fronteira do núcleo.
    // Antes a dominante ia até a face externa da outra (4,092) e o núcleo da fina subia até a linha de centro (0,07),
    // deixando a ponta da grossa exposta na quina.
    expect(shape(material(r, 'mat_bloco14'))).toEqual(expected([[0, -0.07], [4.07, -0.07], [4.07, 3], [3.93, 3], [3.93, 0.07], [0, 0.07]]));
  });

  it('L em esquadria: núcleo e acabamentos cortados na diagonal do canto', () => {
    const r = level([wall('a', A, B, { joinEnd: miter }), wall('b', B, C, { joinStart: miter })]);
    expect(shape(silhouette(r))).toEqual(expected([[0, -0.092], [4.092, -0.092], [4.092, 3], [3.908, 3], [3.908, 0.092], [0, 0.092]]));
    // Núcleo com canto externo em (4,07; −0,07) e interno em (3,93; 0,07).
    expect(shape(material(r, 'mat_bloco14'))).toEqual(expected([[0, -0.07], [4.07, -0.07], [4.07, 3], [3.93, 3], [3.93, 0.07], [0, 0.07]]));
  });

  it('L em corte reto (esquadro): cada parede avança até a face externa da outra', () => {
    const r = level([wall('a', A, B, { joinEnd: square }), wall('b', B, C, { joinStart: square })]);
    expect(shape(silhouette(r))).toEqual(expected([[0, -0.092], [4.092, -0.092], [4.092, 3], [3.908, 3], [3.908, 0.092], [0, 0.092]]));
    // Cada parede vai até a face externa da outra; entre estruturas vale a união (decisão 0004, item 7).
    expect(shape(material(r, 'mat_bloco14'))).toEqual(
      expected([[0, -0.07], [3.93, -0.07], [3.93, -0.092], [4.07, -0.092], [4.07, -0.07], [4.092, -0.07], [4.092, 0.07], [4.07, 0.07], [4.07, 3], [3.93, 3], [3.93, 0.07], [0, 0.07]]),
    );
  });

  it('T: o ramal vai até a face da parede atravessada e o núcleo é contínuo', () => {
    const r = level([wall('a', A, B), wall('c', [2, 0], [2, 3])]);
    expect(shape(silhouette(r))).toEqual(
      expected([[0, -0.092], [4, -0.092], [4, 0.092], [2.092, 0.092], [2.092, 3], [1.908, 3], [1.908, 0.092], [0, 0.092]]),
    );
    expect(shape(material(r, 'mat_bloco14'))).toEqual(
      expected([[0, -0.07], [4, -0.07], [4, 0.07], [2.07, 0.07], [2.07, 3], [1.93, 3], [1.93, 0.07], [0, 0.07]]),
    );
  });

  it('X: cruzamento sem duplicar área (contorno em cruz)', () => {
    const r = level([wall('a', A, B), wall('c', [2, -2], [2, 2])]);
    expect(shape(silhouette(r))).toEqual(
      expected([[2.092, -0.092], [4, -0.092], [4, 0.092], [2.092, 0.092], [2.092, 2], [1.908, 2], [1.908, 0.092], [0, 0.092], [0, -0.092], [1.908, -0.092], [1.908, -2], [2.092, -2]]),
    );
  });

  it('nó de 3 paredes (duas colineares + uma ortogonal) = T com a barra contínua', () => {
    const r = level([wall('a', A, [3, 0]), wall('b', [3, 0], [3, 3]), wall('c', [6, 0], [3, 0])]);
    expect(shape(silhouette(r))).toEqual(
      expected([[0, -0.092], [6, -0.092], [6, 0.092], [3.092, 0.092], [3.092, 3], [2.908, 3], [2.908, 0.092], [0, 0.092]]),
    );
    expect(multiArea(silhouette(r))).toBeCloseTo(6 * 0.184 + 2.908 * 0.184, 3);
  });

  it('colinear de espessuras diferentes (14 e 9): degrau na linha da junção, núcleos alinhados no eixo', () => {
    const r = level([wall('a', A, B), wall('c', B, [8, 0], { typeId: 'wt_alv9' })]);
    expect(shape(silhouette(r))).toEqual(
      expected([[0, -0.092], [4, -0.092], [4, -0.062], [8, -0.062], [8, 0.062], [4, 0.062], [4, 0.092], [0, 0.092]]),
    );
    expect(shape(material(r, 'mat_bloco9'))).toEqual(expected([[4, -0.045], [8, -0.045], [8, 0.045], [4, 0.045]]));
  });

  it('L de 14 com 9 em esquadria: contorno limpo (sem dentes) e núcleos pareados núcleo com núcleo', () => {
    const r = level([
      wall('a', A, B, { joinEnd: miter }),
      wall('b', B, C, { typeId: 'wt_alv9', joinStart: miter }),
    ]);
    expect(shape(silhouette(r))).toEqual(expected([[0, -0.092], [4.062, -0.092], [4.062, 3], [3.938, 3], [3.938, 0.092], [0, 0.092]]));
    // O canto externo do núcleo de 9 coincide com o do núcleo de 14: (4,045; −0,07).
    const core9 = shape(material(r, 'mat_bloco9'))[0]!;
    expect(core9).toContain(key(4.045, -0.07));
    expect(core9).toContain(key(3.955, 3));
    // Camadas dos dois lados dividem arestas exatas: nenhum vazio dentro do contorno.
    const total = multiArea(silhouette(r));
    const layers = r.clusters.flatMap((c) => c.regions.map((x) => multiArea(x.polygons)));
    expect(layers.reduce((s, a) => s + a, 0)).toBeCloseTo(total, 5);
  });
});
