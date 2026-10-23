import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeSlab, makeWall, type Project, type SlabType } from '@hestia/model';
import { resolveLevel } from './resolve.ts';

/**
 * Parede anexada ao piso/laje respeita o término por camada (decisão 0025): onde a camada da laje termina na face da
 * parede, o vazio deixado é preenchido pela parede, em vez de a parede parar na face inferior da laje inteira.
 * Laje de 0,15 m (estrutura) + 0,05 m (regularização) no nível de cima (topo na cota do nível, 3 m); parede do térreo
 * com topo anexado à laje; parede do alto com base anexada.
 */
const tipo = (term: 'auto' | 'face'): SlabType => ({
  id: 'ls_t',
  name: 'Laje teste',
  code: 'LT-01',
  description: '',
  cost: 0,
  layers: [
    { function: 'finish1', materialId: 'mat_argamassa', thickness: 0.05, wraps: false, termino: term },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false, termino: term },
  ],
});

function cena(term: 'auto' | 'face'): Project {
  const base = createEmptyProject();
  const s = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 3 } : l)) });
  s.exec({ type: 'upsertSlabType', slabType: tipo(term) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'lj', typeId: 'ls_t', levelId: 'lv_1', boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] }) });
  const parede = { typeId: 'wt_alv14', a: { x: 5, y: 1 }, b: { x: 5, y: 7 }, height: 3, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } } as const;
  s.exec({ type: 'addWall', wall: makeWall({ id: 'baixo', levelId: 'lv_0', topLevelId: 'lv_1', attachTopToFloor: true, ...parede }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'cima', levelId: 'lv_1', attachBottomToFloor: true, ...parede }) });
  return s.project;
}

describe('parede anexada × término por camada', () => {
  it('sem regra de término: o topo da parede de baixo para na face inferior da laje (como antes)', () => {
    const p = cena('auto');
    const w = resolveLevel(p, 'lv_0').walls.baixo!;
    expect(w.baseZ + w.height).toBeCloseTo(3 - 0.2, 6);
  });

  it('término na face em todas as camadas: a parede de baixo atravessa o vazio da laje até o topo dela', () => {
    const p = cena('face');
    const w = resolveLevel(p, 'lv_0').walls.baixo!;
    expect(w.baseZ + w.height).toBeCloseTo(3, 6);
  });

  it('término na face: a parede de cima mantém a base no topo da laje', () => {
    const p = cena('face');
    const w = resolveLevel(p, 'lv_1').walls.cima!;
    expect(w.baseZ).toBeCloseTo(3, 6);
  });
});

/**
 * Caso real (casa de alto padrão): a laje tem acabamento **abaixo** da estrutura (`ls_mac15`: argamassa 2 cm em cima,
 * concreto 15 cm, tinta 2 cm embaixo) e as duas pontas com término `face`. A cota do topo da parede não pode sair das
 * camadas que a própria parede recorta — senão o topo fica em dois níveis ao longo do mesmo eixo (2,91 e 2,93 m) e
 * aparece uma fresta de 2 cm acima de algumas aberturas.
 */
describe('parede anexada × laje com acabamento embaixo da estrutura', () => {
  const LAJE: SlabType = {
    id: 'ls_t',
    name: 'Laje maciça com regularização',
    code: 'LT-02',
    description: '',
    cost: 0,
    layers: [
      { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: 'face' },
      { function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false },
      { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: 'face' },
    ],
  };

  function casa(): Project {
    const base = createEmptyProject();
    const s = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 3 } : l)) });
    s.exec({ type: 'upsertSlabType', slabType: LAJE });
    // topo em 3,10 → estrutura de 2,93 a 3,08 e acabamento de baixo de 2,91 a 2,93
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'lj', typeId: 'ls_t', levelId: 'lv_1', heightOffset: 0.1, boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] }) });
    const parede = { typeId: 'wt_alv14', a: { x: 5, y: 1 }, b: { x: 5, y: 7 }, height: 2.8, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } } as const;
    s.exec({ type: 'addWall', wall: makeWall({ id: 'baixo', levelId: 'lv_0', topLevelId: 'lv_1', attachTopToFloor: true, ...parede }) });
    return s.project;
  }

  it('o topo da parede fica num nível só: na face inferior da estrutura (2,93), não oscilando com o acabamento', () => {
    const p = casa();
    const w = resolveLevel(p, 'lv_0').walls.baixo!;
    const topos = new Set(w.layers.flatMap((l) => l.bands.map((b) => Math.round((w.baseZ + b.z1) * 1e6) / 1e6)));
    const maior = Math.max(...topos);
    expect(maior).toBeCloseTo(2.93, 6);
    // antes da correção o mesmo eixo tinha 2,91 e 2,93 (degrau de 2 cm acima das aberturas)
    expect([...topos].filter((z) => z > 2.9)).toHaveLength(1);
  });

  it('com o acabamento de baixo em `auto`, o topo vai até a face inferior dele (2,91) e também fica uniforme', () => {
    const p = casa();
    const alt = structuredClone(p) as Project;
    const tipo = alt.slabTypes['ls_t']!;
    tipo.layers = tipo.layers.map((l, i) => (i === 2 ? { ...l, termino: 'auto' as const } : l));
    const w = resolveLevel(alt, 'lv_0').walls.baixo!;
    const topos = new Set(w.layers.flatMap((l) => l.bands.map((b) => Math.round((w.baseZ + b.z1) * 1e6) / 1e6)));
    expect(Math.max(...topos)).toBeCloseTo(2.91, 6);
    expect([...topos].filter((z) => z > 2.9)).toHaveLength(1);
  });
});

