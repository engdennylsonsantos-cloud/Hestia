import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Id, type Layer, type Project, type WallType } from '@hestia/model';
import { junctionLevel } from './junctionLevel.ts';
import { resolveLevel } from './resolve.ts';
import { quantifyLevel } from './quantities.ts';
import { computeSection, type SectionResult } from './section.ts';
import { cutLevelByJunction, partsRegion } from './wallJunction.ts';
import type { ResolvedLevel, ResolvedWall } from './types.ts';

type Pt = { x: number; y: number };
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Camada por atributo (função, espessura, prioridade opcional): nenhuma regra lê nome ou material. */
const camada = (fn: Layer['function'], thick: number, extra: Partial<Layer> = {}): Layer => ({ function: fn, materialId: 'mat_concreto', thickness: thick, wraps: false, ...extra });
/** Parede de 0,20 m: acabamento 0,02 + núcleo 0,16 + acabamento 0,02 (4 m de comprimento, 3 m de altura). */
const PAREDE: Layer[] = [camada('finish1', 0.02), camada('structure', 0.16), camada('finish1', 0.02)];

interface Cenario {
  /** Cota do topo da laje (a laje tem 0,10 m e desce a partir dela). Sem ele, não entra laje. */
  topo?: number;
  /** Borda da laje em y: cobre de −1 até aqui (o eixo da parede é y = 0 e a espessura vai de −0,10 a +0,10). */
  borda?: number;
  /** Prioridade efetiva da camada da laje (padrão: 1, a da função estrutura). */
  prioridade?: number;
  /** Porta de 0,80 m no eixo (offset 1 m). */
  porta?: boolean;
  /** Piso térmico de 0,05 m (prioridade 3) no lugar da laje. */
  pisoTermico?: boolean;
}

/**
 * Projeto do cenário: uma parede de 4 m e, opcionalmente, uma laje de 0,10 m que cruza parte dela (x de −1 a 2, ou seja
 * 2 m sobre a parede) e y de −1 até a borda. Com topo 0,05, a faixa comum com a parede é 0 a 0,05 m.
 */
function build(c: Cenario = {}): Project {
  const base = createEmptyProject();
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Piso teste', code: 'PT', layers: [camada('thermal', 0.05)] };
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Laje teste', code: 'LT', layers: [camada('structure', 0.1, c.prioridade ? { priority: c.prioridade } : {})] };
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Parede teste', code: 'T', layers: PAREDE };
  base.wallTypes.wt_t = wt;
  const s = new ProjectStore(base);
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_t', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
  if (c.porta) s.exec({ type: 'addOpening', opening: { id: 'o1', kind: 'door', typeId: 'ot_p80', hostId: 'w1', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  const borda = c.borda ?? 0;
  if (c.pisoTermico) s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_t', levelId: 'lv_0', boundary: rect(-1, -1, 2, borda), heightOffset: 0.05 }) });
  else if (c.topo !== undefined) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(-1, -1, 2, borda), heightOffset: c.topo }) });
  return s.project;
}

const nivel = (p: Project): ResolvedLevel => resolveLevel(p, 'lv_0');
const junc = (p: Project) => junctionLevel(p, 'lv_0');
const corte = (p: Project, planZ?: number): ResolvedWall => cutLevelByJunction(nivel(p), junc(p), planZ === undefined ? {} : { planZ }).walls.w1!;
const areas = (rw: ResolvedWall): number[] => rw.layers.map((l) => multiArea(l.cut));
/** Compara área por camada com tolerância de ponto flutuante (as booleanas não devolvem o mesmo decimal). */
const expectAreas = (rw: ResolvedWall, expected: readonly number[]): void =>
  expected.forEach((v, i) => expect(areas(rw)[i]!).toBeCloseTo(v, 9));
/** Volume (m³) das faixas desenhadas: área em planta × altura (todas as faixas deste arquivo são planas). */
const volumeOf = (rw: ResolvedWall): number => rw.layers.reduce((s, l) => s + l.bands.reduce((t, b) => t + multiArea(b.poly) * (b.z1 - b.z0), 0), 0);
const layerVolumes = (rw: ResolvedWall): number[] => rw.layers.map((l) => l.bands.reduce((t, b) => t + multiArea(b.poly) * (b.z1 - b.z0), 0));
const areaOfOrigin = (r: SectionResult, key: 'wallId' | 'slabId' | 'floorId', id: Id): number =>
  r.cut.reduce((acc, c) => acc + (c.parts ?? []).filter((q) => q.origin[key] === id).reduce((s, q) => s + multiArea(q.polygons), 0), 0);

const LINE = { a: { x: 1, y: -2 }, b: { x: 1, y: 2 }, depth: 6 };

describe('parede recortada pela junção de piso e laje (0023 §10, P7c parte 2)', () => {
  it('parede sem piso nem laje: nenhuma camada muda e o nível volta pelo mesmo objeto', () => {
    const p = build();
    const lv = nivel(p);
    expect(junc(p).elements.get('w1')?.cut ?? false).toBe(false);
    expect(cutLevelByJunction(lv, junc(p), { planZ: 1.2 })).toBe(lv);
    expect(volumeOf(corte(p))).toBeCloseTo(2.4, 9);
    expectAreas(lv.walls.w1!, [0.08, 0.64, 0.08]);
  });

  it('planta: na cota em que a laje vence, a camada perde a região; acima dela, a parede fica inteira', () => {
    // Laje de 0,10 m com topo em 0,05: cruza a parede só de 0 a 0,05 m e só na metade −y (borda em y = 0).
    const p = build({ topo: 0.05 });
    expect(junc(p).elements.get('w1')!.cut).toBe(true);
    // Acabamento +y (0,08) está fora da laje; o núcleo perde 2 m × 0,08 m (meia espessura) e o acabamento −y 2 m × 0,02 m.
    expectAreas(corte(p, 0.01), [0.08, 0.48, 0.04]);
    // Acima do topo da laje a parede não é cortada: o plano de corte padrão (1,20 m) mostra a parede inteira.
    expectAreas(corte(p, 1.2), [0.08, 0.64, 0.08]);
    // Projeção (`outline`): a parede existe em alguma altura em toda a região, então a projeção não muda.
    const proj = cutLevelByJunction(nivel(p), junc(p), { outline: new Set(['w1']) }).walls.w1!;
    proj.layers.map((l) => multiArea(l.fragment)).forEach((v, i) => expect(v).toBeCloseTo([0.08, 0.64, 0.08][i]!, 9));
  });

  it('corte e elevação: a parede perde a mesma região em cota, por camada (valores à mão)', () => {
    const so = computeSection(build({ topo: 0.05 }), LINE);
    const semLaje = computeSection(build(), LINE);
    // Parede sozinha: 0,20 m × 3 m = 0,60 m². Com a laje: núcleo perde 0,08 × 0,05 e o acabamento −y 0,02 × 0,05.
    expect(areaOfOrigin(semLaje, 'wallId', 'w1')).toBeCloseTo(0.6, 9);
    expect(areaOfOrigin(so, 'wallId', 'w1')).toBeCloseTo(0.6 - 0.08 * 0.05 - 0.02 * 0.05, 9);
  });

  it('3D e quantitativos: o volume desenhado é o líquido, camada a camada', () => {
    const p = build({ topo: 0.05 });
    const desenhado = corte(p);
    const q = quantifyLevel(p, nivel(p));
    expect(volumeOf(desenhado)).toBeCloseTo(q.walls[0]!.volume, 9);
    expect(volumeOf(desenhado)).toBeCloseTo(2.4 - 0.01, 9);
    const liquido = q.layers.filter((l) => l.wallId === 'w1').map((l) => l.volume);
    layerVolumes(desenhado).forEach((v, i) => expect(v).toBeCloseTo(liquido[i]!, 9));
    // Núcleo: 3 m de altura menos a faixa de 0,05 m em metade da espessura.
    expect(layerVolumes(desenhado)[1]).toBeCloseTo(0.64 * 3 - 0.08 * 0.05 * 2, 9);
  });

  it('piso que morde só o acabamento interno: o núcleo e a face externa ficam', () => {
    // Piso térmico (prioridade 3) até a face do núcleo (−0,08): vence o acabamento (4) e perde para o núcleo (1).
    const p = build({ pisoTermico: true, borda: -0.08 });
    const desenhado = corte(p, 0.01);
    expectAreas(desenhado, [0.08, 0.64, 0.04]);
    expect(volumeOf(desenhado)).toBeCloseTo(2.4 - 2 * 0.02 * 0.05, 9);
    // O piso não perde nada: ele vence a camada que encontra.
    expect(junc(p).elements.get('f1')?.cut ?? false).toBe(false);
  });

  it('duas prioridades: a laje deixa de cortar o núcleo quando perde a prioridade; o acabamento fora do núcleo continua vencido', () => {
    // Laje com estrutura (núcleo) de prioridade 1: vence o núcleo da parede pelo empate na hierarquia por tipo (laje).
    const vence = build({ topo: 0.05 });
    expect(volumeOf(corte(vence))).toBeCloseTo(2.39, 9);
    expectAreas(corte(vence, 0.01), [0.08, 0.48, 0.04]);
    // Laje com prioridade 6: o núcleo da parede (1) vence. Mas o núcleo da laje ainda atravessa a camada de acabamento
    // fora do núcleo da parede (§1.2: núcleo se estende e atravessa prioridade maior fora do núcleo), então só o núcleo
    // da parede fica inteiro; o acabamento interno continua perdendo.
    const perde = build({ topo: 0.05, prioridade: 6 });
    expect(volumeOf(corte(perde))).toBeCloseTo(2.398, 9);
    expectAreas(corte(perde, 0.01), [0.08, 0.64, 0.04]);
    // Quem perde agora é a laje (o núcleo dela), não o núcleo da parede.
    expect(junc(perde).elements.get('s1')!.cut).toBe(true);
    expect(junc(vence).elements.get('s1')!.cut).toBe(false);
    expect(corte(perde).layers[1]).toBe(nivel(perde).walls.w1!.layers[1]);
  });

  it('fachada contínua: o acabamento externo passa contínuo quando a laje termina na face interna dele', () => {
    // Parede com o acabamento externo na camada 0 (+y, prioridade 1). A laje termina em y = 0,08, a face interna do
    // acabamento: o acabamento fica fora da laje e passa contínuo (não é recortado em nenhuma cota); o núcleo e o
    // acabamento interno perdem a faixa coberta. A laje não perde nada.
    const base = createEmptyProject();
    base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Laje teste', code: 'LT', layers: [camada('structure', 0.1)] };
    base.wallTypes.wt_t = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Parede teste', code: 'T', layers: [camada('finish1', 0.02, { priority: 1 }), camada('structure', 0.16), camada('finish1', 0.02)] };
    const s = new ProjectStore(base);
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_t', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(-1, -1, 2, 0.08), heightOffset: 0.05 }) });
    const p = s.project;
    const lv = nivel(p);
    const desenhado = corte(p, 0.01);
    expectAreas(desenhado, [0.08, 0.32, 0.04]);
    // O acabamento externo é a própria camada de antes, em toda a altura (0,24 m³): nada foi recortado nele.
    expect(desenhado.layers[0]).toBe(lv.walls.w1!.layers[0]);
    expect(layerVolumes(desenhado)[0]).toBeCloseTo(0.08 * 3, 9);
    expect(volumeOf(desenhado)).toBeCloseTo(2.4 - 2 * (0.02 + 0.16) * 0.05, 9);
    expect(junc(p).elements.get('s1')!.cut).toBe(false);
  });

  it('abertura preservada: o vão continua aberto na planta e nas faixas do 3D', () => {
    const p = build({ topo: 0.05, porta: true });
    const desenhado = corte(p);
    // Planta em 1,20 m (fora da faixa da laje): parede inteira menos o vão de 0,80 × 0,20 m.
    expectAreas(corte(p, 1.2), [0.064, 0.512, 0.064]);
    // 3D: a faixa da porta continua aberta (a peça se parte em duas em volta do vão) e a área descontada segue a do vão.
    const porta = desenhado.layers[1]!.bands.find((b) => b.z0 <= 1.2 && b.z1 > 1.2)!;
    expect(porta.poly.length).toBeGreaterThan(1);
    expect(multiArea(porta.poly)).toBeCloseTo(0.64 - 0.8 * 0.16, 9);
  });

  it('cache: a mesma vista e a mesma junção devolvem o mesmo nível cortado', () => {
    const p = build({ topo: 0.05 });
    const lv = nivel(p);
    const jl = junc(p);
    expect(cutLevelByJunction(lv, jl, { planZ: 0.01 })).toBe(cutLevelByJunction(lv, jl, { planZ: 0.01 }));
    expect(cutLevelByJunction(lv, jl, { planZ: 0.01 })).not.toBe(cutLevelByJunction(lv, jl, { planZ: 1.2 }));
  });

  it('propriedade (10 sementes): o desenhado é o líquido e a planta é a união das partes na cota', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let st = seed * 7919;
      const r = (): number => {
        st = (st * 1103515245 + 12345) % 2147483648;
        return st / 2147483648;
      };
      const p = build({ topo: 0.02 + r() * 0.2, borda: -0.1 + r() * 0.3, prioridade: r() < 0.3 ? 6 : undefined });
      const lv = nivel(p);
      const jl = junc(p);
      const desenhado = cutLevelByJunction(lv, jl).walls.w1!;
      const q = quantifyLevel(p, lv);
      expect(volumeOf(desenhado)).toBeCloseTo(q.walls[0]!.volume, 6);
      expect(volumeOf(desenhado)).toBeLessThanOrEqual(q.walls[0]!.grossVolume + 1e-9);
      const porCamada = layerVolumes(desenhado);
      const liquido = q.layers.filter((l) => l.wallId === 'w1').map((l) => l.volume);
      porCamada.forEach((v, i) => expect(v).toBeCloseTo(liquido[i]!, 6));
      // A planta em qualquer cota é a região das partes que existem ali (nada a mais, nada a menos).
      const z = r() * 3;
      const planta = cutLevelByJunction(lv, jl, { planZ: z }).walls.w1!;
      for (const l of nivel(p).walls.w1!.layers) {
        const partes = jl.elements.get('w1')!.layers.filter((x) => x.layerIndex === l.layerIndex).flatMap((x) => x.parts);
        expect(multiArea(planta.layers.find((x) => x.layerIndex === l.layerIndex)!.cut)).toBeCloseTo(multiArea(partsRegion(partes, z)), 9);
      }
    }
  });
});
