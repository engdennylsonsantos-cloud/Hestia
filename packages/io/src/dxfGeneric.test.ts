import { describe, expect, it } from 'vitest';
import { buildTemplate, type Generic } from '@hestia/model';
import { DXF_LAYER_GENERIC, dxfGenericEntities } from './dxfGeneric.ts';

/** Ponto em planta (m). */
type Pt = { x: number; y: number };

/** Objeto importado mínimo: a malha vazia, só o contorno em planta importa aqui. */
function generic(id: string, levelId: string, outline?: Pt[]): Generic {
  return {
    id,
    kind: 'generic',
    levelId,
    name: id,
    sourceClass: 'IFCBEAM',
    mesh: { positions: [], indices: [] },
    ...(outline ? { outline } : {}),
    order: 1,
  };
}

/** Planta do template (cópia mutável) com os genéricos dados, na chave `elements`. */
function projectWith(...generics: Generic[]) {
  const p = structuredClone(buildTemplate('house2'));
  for (const g of generics) p.elements[g.id] = g;
  return p;
}

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

describe('E5 · objetos importados no DXF', () => {
  it('a camada dos importados é IMPORTADO', () => {
    expect(DXF_LAYER_GENERIC).toBe('IMPORTADO');
  });

  it('um genérico vira uma polilinha fechada, cinza e sem largura, na camada IMPORTADO', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    const entities = dxfGenericEntities(p, 'lv_0');
    expect(entities).toHaveLength(1);
    expect(entities[0]).toEqual({ kind: 'polyline', layer: DXF_LAYER_GENERIC, points: square, closed: true, color: 8 });
  });

  it('sem genérico no nível a lista é vazia', () => {
    expect(dxfGenericEntities(buildTemplate('house2'), 'lv_0')).toEqual([]);
  });

  it('genérico de outro nível não sai', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    expect(dxfGenericEntities(p, 'lv_1')).toEqual([]);
  });

  it('sem contorno em planta, ou com menos de 3 pontos, não desenha', () => {
    const p = projectWith(
      generic('gn_a', 'lv_0'),
      generic('gn_b', 'lv_0', [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    );
    expect(dxfGenericEntities(p, 'lv_0')).toEqual([]);
  });

  it('ordem determinística por id, e uma polilinha por genérico', () => {
    const left: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const right: Pt[] = [
      { x: 5, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
    ];
    const p = projectWith(generic('gn_z', 'lv_0', right), generic('gn_a', 'lv_0', left));
    const entities = dxfGenericEntities(p, 'lv_0');
    expect(entities.map((q) => (q.kind === 'polyline' ? q.points.length : 0))).toEqual([3, 3]);
    expect(entities.map((q) => (q.kind === 'polyline' ? q.points[0]!.x : 0))).toEqual([0, 5]);
  });

  it('a camada pode ser trocada pelo parâmetro', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    expect(dxfGenericEntities(p, 'lv_0', 'OUTRA').map((q) => q.layer)).toEqual(['OUTRA']);
  });
});
