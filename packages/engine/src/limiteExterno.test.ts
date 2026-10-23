import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeSlab, makeWall, type LayerLimiteExterno, type LayerTermino, type Project, type SlabType } from '@hestia/model';
import { resolveSlabs } from './slabs.ts';

/**
 * Limite da camada no perímetro externo (decisão 0027): cada camada de piso ou de laje diz até onde vai na borda da
 * edificação, independente do término nas paredes internas. Parede `wt_alv14`: acabamento externo de 2,2 cm (tinta 2 mm
 * + reboco 20 mm) e núcleo de 14 cm, então a face externa da parede fica a 0,092 m do eixo e a face externa do núcleo a
 * 0,070 m. Contorno da laje desenhado 0,40 m além do eixo, para os três casos ficarem distintos.
 */
const RECT = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const LAJE = (limite?: LayerLimiteExterno, termino?: LayerTermino): SlabType => ({
  id: 'ls_lim',
  name: 'Laje do teste',
  code: 'LT-LIM',
  description: '',
  cost: 0,
  layers: [
    { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: 'face' },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.12, wraps: false, ...(limite ? { limiteExterno: limite } : {}), ...(termino ? { termino } : {}) },
  ],
});

function cena(limite?: LayerLimiteExterno, paredeInterna = false, termino?: LayerTermino): Project {
  const base = createEmptyProject();
  const s = new ProjectStore(base);
  s.exec({ type: 'upsertSlabType', slabType: LAJE(limite, termino) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'lj', typeId: 'ls_lim', levelId: 'lv_0', heightOffset: 0.2, boundary: RECT(-0.4, -0.4, 6.4, 4.4) }) });
  const w = (id: string, a: { x: number; y: number }, b: { x: number; y: number }) =>
    makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 2.8, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } });
  s.exec({ type: 'addWall', wall: w('s', { x: 6, y: 0 }, { x: 0, y: 0 }) });
  s.exec({ type: 'addWall', wall: w('n', { x: 0, y: 4 }, { x: 6, y: 4 }) });
  s.exec({ type: 'addWall', wall: w('o', { x: 0, y: 0 }, { x: 0, y: 4 }) });
  s.exec({ type: 'addWall', wall: w('l', { x: 6, y: 4 }, { x: 6, y: 0 }) });
  if (paredeInterna) s.exec({ type: 'addWall', wall: w('meio', { x: 3, y: 1 }, { x: 3, y: 3 }) });
  return s.project;
}

const areaEstrutura = (p: Project): number => multiArea(resolveSlabs(p, 'lv_0')[0]!.layers[1]!.polygon);

describe('limite no perímetro externo por camada (decisão 0027)', () => {
  it('sem limite: a camada usa o contorno do elemento, como antes', () => {
    expect(areaEstrutura(cena())).toBeCloseTo(6.8 * 4.8, 4);
  });

  it('`parede`: a camada vai até a face externa da parede (atravessa o acabamento externo)', () => {
    expect(areaEstrutura(cena('parede'))).toBeCloseTo((6 + 2 * 0.092) * (4 + 2 * 0.092), 4);
  });

  it('`nucleo`: a camada passa sob o acabamento externo e para na face externa do núcleo', () => {
    expect(areaEstrutura(cena('nucleo'))).toBeCloseTo((6 + 2 * 0.07) * (4 + 2 * 0.07), 4);
  });

  it('o limite é só da camada escolhida: as demais seguem o término', () => {
    const semLimite = multiArea(resolveSlabs(cena(), 'lv_0')[0]!.layers[0]!.polygon);
    const comLimite = multiArea(resolveSlabs(cena('nucleo'), 'lv_0')[0]!.layers[0]!.polygon);
    // a camada de cima (término `face`) não muda quando a estrutura ganha `limiteExterno`
    expect(comLimite).toBeCloseTo(semLimite, 6);
  });

  it('as duas faces ficam na ordem esperada: contorno > parede > núcleo', () => {
    expect(areaEstrutura(cena())).toBeGreaterThan(areaEstrutura(cena('parede')));
    expect(areaEstrutura(cena('parede'))).toBeGreaterThan(areaEstrutura(cena('nucleo')));
  });

  it('parede interna continua recortando pela regra do término (o limite externo não a substitui)', () => {
    // com `face` na estrutura, a parede interna do meio recorta a camada; o limite externo só age na borda
    const sem = areaEstrutura(cena('nucleo', false, 'face'));
    const comParede = areaEstrutura(cena('nucleo', true, 'face'));
    expect(comParede).toBeLessThan(sem - 1e-6);
  });
});
