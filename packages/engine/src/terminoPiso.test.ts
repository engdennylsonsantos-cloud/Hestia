import { describe, expect, it } from 'vitest';
import { multiArea, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type LayerTermino, type Project } from '@hestia/model';
import { junctionLevel } from './junctionLevel.ts';
import { resolveFloors } from './floors.ts';
import { quantifyFloors } from './floorQuantities.ts';

/**
 * Piso único com término por camada (decisão 0025). Cenário: piso de 10 × 8 m (o contorno cobre a obra inteira) com
 * paredes de 0,184 m (`wt_alv14`: 2 × 2,2 cm de reboco e 14 cm de núcleo) atravessando o contorno. Os números são
 * calculados à mão; a área de cada camada é a do polígono resolvido (planta).
 */

type Pt = { x: number; y: number };
const RECT: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
const ENTRE = { x: 5, y: -1 };
const ATE = { x: 5, y: 9 };
/** Esquadria livre: a parede atravessa o contorno, então as pontas ficam fora dele. */
const LIVRE = { kind: 'butt' as const, flip: false };

const L = (fn: Layer['function'], materialId: string, thickness: number, termino?: LayerTermino, priority?: number): Layer => ({
  function: fn,
  materialId,
  thickness,
  wraps: false,
  ...(termino === undefined ? {} : { termino }),
  ...(priority === undefined ? {} : { priority }),
});

/** Piso único: acabamento, assentamento e contrapiso até a face; estrutura passa por baixo (o padrão `ft_unico`). */
const UNICO_LAYERS: Layer[] = [
  L('finish1', 'mat_ceramica', 0.01, 'face'),
  L('substrate', 'mat_argamassa', 0.02, 'face'),
  L('substrate', 'mat_argamassa', 0.04, 'face'),
  L('structure', 'mat_concreto', 0.12, 'passa'),
];

interface Cenario {
  layers?: Layer[];
  wallLayers?: Layer[];
  wallType?: string | null;
  wallA?: Pt;
  wallB?: Pt;
  opening?: { kind: 'door' | 'window'; typeId: string; offset: number };
}

/** Projeto com um piso no nível térreo (lv_0) e uma parede atravessando o contorno. Sem parede quando `wallType` é `null`. */
function cenario(c: Cenario = {}): Project {
  const base = createEmptyProject();
  base.floorTypes.ft_teste = { ...base.floorTypes.ft_unico!, id: 'ft_teste', layers: c.layers ?? UNICO_LAYERS };
  if (c.wallLayers) base.wallTypes.wt_teste = { ...base.wallTypes.wt_alv14!, id: 'wt_teste', layers: c.wallLayers };
  const s = new ProjectStore(base);
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_teste', levelId: 'lv_0', boundary: RECT.map((q) => ({ ...q })) }) });
  if (c.wallType !== null) {
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: 'w1', typeId: c.wallType ?? (c.wallLayers ? 'wt_teste' : 'wt_alv14'), levelId: 'lv_0', a: c.wallA ?? ENTRE, b: c.wallB ?? ATE, height: 2.8, joinStart: LIVRE, joinEnd: LIVRE }),
    });
  }
  if (c.opening) {
    s.exec({ type: 'addOpening', opening: { id: 'o1', kind: c.opening.kind, typeId: c.opening.typeId, hostId: 'w1', offset: c.opening.offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  }
  return s.project;
}

/** Área (m²) da camada `i` do piso `f1`. */
const area = (p: Project, i: number): number => multiArea(resolveFloors(p, 'lv_0')[0]!.layers[i]!.polygon);
const poligono = (p: Project, i: number): MultiPolygon => resolveFloors(p, 'lv_0')[0]!.layers[i]!.polygon;
const BRUTA = 10 * 8;
/** Pegada da parede dentro do contorno: 0,184 m de espessura × 8 m de comprimento interno. */
const PEGADA = 0.184 * 8;

describe('piso único: término por camada (decisão 0025)', () => {
  it('(a) acabamento até a face vira duas partes e perde a pegada; a estrutura que passa mantém a área bruta', () => {
    const p = cenario();
    expect(poligono(p, 0)).toHaveLength(2);
    expect(area(p, 0)).toBeCloseTo(BRUTA - PEGADA, 6);
    expect(area(p, 1)).toBeCloseTo(BRUTA - PEGADA, 6);
    expect(area(p, 3)).toBeCloseTo(BRUTA, 6);
  });

  it('(b) até o núcleo: a camada avança sob o reboco e para no núcleo (perde só o núcleo de 0,14 m)', () => {
    const p = cenario({ layers: [L('finish1', 'mat_ceramica', 0.01, 'nucleo'), L('structure', 'mat_concreto', 0.12, 'passa')] });
    expect(area(p, 0)).toBeCloseTo(BRUTA - 0.14 * 8, 6);
  });

  it('(c) prioridade ≤ N com uma parede de quatro camadas (prioridades 4, 3, 1, 4): cada N recorta a faixa certa', () => {
    // Ordem de dentro da parede (de uma face à outra): reboco 0,02 (4), térmica 0,05 (3), núcleo 0,10 (1), reboco 0,02 (4).
    const wallLayers = [L('finish1', 'mat_argamassa', 0.02), L('thermal', 'mat_isolante', 0.05), L('structure', 'mat_bloco14', 0.1), L('finish1', 'mat_argamassa', 0.02)];
    const ate = (n: number): LayerTermino => ({ ate: { prioridade: n } });
    const com = (n: number) => cenario({ wallLayers, layers: [L('finish1', 'mat_ceramica', 0.01, ate(n)), L('structure', 'mat_concreto', 0.12, 'passa')] });
    // ≤ 1: só o núcleo (1); a faixa vai do núcleo ao núcleo: 0,10 m.
    expect(area(com(1), 0)).toBeCloseTo(BRUTA - 0.1 * 8, 6);
    // ≤ 3: térmica (3) e núcleo (1): faixa de 0,05 + 0,10 = 0,15 m.
    expect(area(com(3), 0)).toBeCloseTo(BRUTA - 0.15 * 8, 6);
    // ≤ 4: todas as camadas (prioridades 4, 3, 1 e 4): a parede inteira, 0,19 m.
    expect(area(com(4), 0)).toBeCloseTo(BRUTA - 0.19 * 8, 6);
  });

  it('(c) sem camada da parede com prioridade ≤ N, a parede é passa (nenhuma zona bloqueada)', () => {
    const acabamento = [L('finish1', 'mat_argamassa', 0.02), L('finish2', 'mat_tinta', 0.002)];
    const p = cenario({ wallLayers: acabamento, layers: [L('finish1', 'mat_ceramica', 0.01, { ate: { prioridade: 3 } })] });
    expect(area(p, 0)).toBeCloseTo(BRUTA, 6);
  });

  it('(d) vão de porta que chega ao piso: o acabamento continua no vão (recupera largura × espessura)', () => {
    const p = cenario({ opening: { kind: 'door', typeId: 'ot_p80', offset: 5 } });
    const largura = p.openingTypes.ot_p80!.width;
    expect(area(p, 0)).toBeCloseTo(BRUTA - PEGADA + largura * 0.184, 6);
  });

  it('(d) janela não entra: o piso não passa pelo vão de janela, que tem peitoril acima do piso', () => {
    const p = cenario({ opening: { kind: 'window', typeId: 'ot_j120', offset: 5 } });
    expect(area(p, 0)).toBeCloseTo(BRUTA - PEGADA, 6);
  });

  it('(e) o resultado acompanha a parede: mover e trocar a espessura mudam a área, sem comando', () => {
    const p = cenario({ wallA: { x: 3, y: -1 }, wallB: { x: 3, y: 9 } });
    expect(area(p, 0)).toBeCloseTo(BRUTA - PEGADA, 6);
    const q = cenario({ wallLayers: [L('finish1', 'mat_argamassa', 0.02), L('structure', 'mat_bloco14', 0.2), L('finish1', 'mat_argamassa', 0.02)] });
    expect(area(q, 0)).toBeCloseTo(BRUTA - 0.24 * 8, 6);
  });

  it('(f) sem regra explícita (auto), o piso fica com o contorno inteiro, como antes', () => {
    const auto = UNICO_LAYERS.map((l) => ({ ...l, termino: undefined as LayerTermino | undefined }));
    for (const l of auto) delete (l as { termino?: LayerTermino }).termino;
    const p = cenario({ layers: auto });
    for (let i = 0; i < auto.length; i++) expect(area(p, i)).toBeCloseTo(BRUTA, 9);
  });

  it('(g) trocar nome e material não muda nenhuma área: vale só o atributo da camada', () => {
    const outro = UNICO_LAYERS.map((l) => ({ ...l, materialId: `${l.materialId}_x`, thickness: l.thickness }));
    const a = cenario();
    const b = cenario({ layers: outro, wallLayers: undefined });
    for (let i = 0; i < 4; i++) expect(area(b, i)).toBeCloseTo(area(a, i), 9);
  });

  it('(i) partes disjuntas e furos: parede fechada dentro do contorno deixa um furo e uma ilha, sem perder área', () => {
    const p = cenario({ wallType: null });
    const base = createAnel(p);
    const m = resolveFloors(base, 'lv_0')[0]!.layers[0]!.polygon;
    // Anel de quatro paredes de 2 m e 0,184 m: a pegada é 8 m × 0,184 m. Sobram o contorno com um furo (o anel) e a ilha
    // interna, que é outra parte: duas partes, uma com furo.
    expect(m).toHaveLength(2);
    expect(m.some((poligono) => poligono.length === 2)).toBe(true);
    expect(multiArea(m)).toBeCloseTo(BRUTA - 8 * 0.184, 6);
  });
});

describe('piso único: a junção automática não recorta as camadas com regra de parede (decisão 0025)', () => {
  it('parede embutida (base 10 cm abaixo do topo): sem corte na junção, porque as camadas com regra já decidem a região', () => {
    const base = createEmptyProject();
    base.floorTypes.ft_teste = { ...base.floorTypes.ft_unico!, id: 'ft_teste', layers: UNICO_LAYERS };
    const s = new ProjectStore(base);
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pu', typeId: 'ft_teste', levelId: 'lv_0', boundary: RECT.map((q) => ({ ...q })) }) });
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: ENTRE, b: ATE, baseOffset: -0.1, height: 2.8, joinStart: LIVRE, joinEnd: LIVRE }),
    });
    expect(junctionLevel(s.project, 'lv_0').elements.get('pu')?.cut ?? false).toBe(false);
    expect(area(s.project, 0)).toBeCloseTo(BRUTA - PEGADA, 6);
  });
});

describe('piso único: quantitativos e propriedade (decisão 0025, P10)', () => {
  it('quantitativo por camada: área e volume da camada recortada, sem dobro com a estrutura que passa', () => {
    const p = cenario();
    const camadas = quantifyFloors(p, 'lv_0').layers;
    expect(camadas[0]!.area).toBeCloseTo(BRUTA - PEGADA, 6);
    expect(camadas[0]!.volume).toBeCloseTo((BRUTA - PEGADA) * 0.01, 6);
    expect(camadas[3]!.area).toBeCloseTo(BRUTA, 6);
    expect(camadas[3]!.volume).toBeCloseTo(BRUTA * 0.12, 6);
  });

  it('propriedade em 10 sementes: cada camada cabe na bruta, a estrutura que passa é igual a ela e o resultado é estável', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rnd = mulberry32(seed);
      const s = new ProjectStore(cenario({ wallType: null }));
      const n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const a = { x: -1 + rnd() * 12, y: -1 + rnd() * 10 };
        const b = { x: -1 + rnd() * 12, y: -1 + rnd() * 10 };
        s.exec({ type: 'addWall', wall: makeWall({ id: `r${k}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 2.8, joinStart: LIVRE, joinEnd: LIVRE }) });
      }
      const p = s.project;
      const areas = [0, 1, 2, 3].map((i) => area(p, i));
      for (const a of areas.slice(0, 3)) expect(a).toBeLessThanOrEqual(BRUTA + 1e-6);
      expect(areas[3]).toBeCloseTo(BRUTA, 6);
      expect([0, 1, 2, 3].map((i) => area(p, i))).toEqual(areas);
    }
  });
});

/** Gerador pseudoaleatório determinístico (sementes fixas, resultado reproduzível). */
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adiciona um anel fechado de paredes (2 × 2 m de vão) dentro do piso e devolve o projeto. */
function createAnel(p: Project): Project {
  const s = new ProjectStore(p);
  const cantos: Pt[] = [{ x: 4, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 5 }, { x: 4, y: 5 }];
  cantos.forEach((a, i) => {
    const b = cantos[(i + 1) % 4]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `a${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 2.8, joinStart: LIVRE, joinEnd: LIVRE }) });
  });
  return s.project;
}
