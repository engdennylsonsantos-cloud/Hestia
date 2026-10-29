import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, createEmptyProject, makeFloor, makeSlab, type Floor, type Project, type Slab } from '@hestia/model';
import { quantifyFloors, quantifySlabs } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const L = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];

/** Projeto com os pisos adicionados pelo comando addFloor (como na aplicação). */
function build(
  floors: Array<Partial<Floor> & Pick<Floor, 'id' | 'boundary'>>,
  extra?: (p: Project) => void,
  slabs: Array<Partial<Slab> & Pick<Slab, 'id' | 'boundary'>> = [],
): Project {
  const base = createEmptyProject();
  extra?.(base);
  const s = new ProjectStore(base);
  for (const f of floors) s.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_ceram', levelId: 'lv_0', ...f }) });
  for (const x of slabs) s.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_mac12', levelId: 'lv_0', ...x }) });
  return s.project;
}

const T = 0.19; // espessura do ft_ceram: 0,01 + 0,02 + 0,04 + 0,12

describe('quantitativo de pisos', () => {
  it('retângulo 4 x 3 com ft_ceram: área 12, perímetro 14, espessura 0,19 e volume 2,28', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    expect(q.floors).toHaveLength(1);
    const f = q.floors[0]!;
    expect(f.area).toBeCloseTo(12, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
    expect(f.holesPerimeter).toBe(0);
    expect(f.thickness).toBeCloseTo(T, 9);
    expect(f.volume).toBeCloseTo(12 * T, 9);
  });

  it('volume por camada = área × espessura, e a soma das camadas é o volume do piso', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0').floors[0]!;
    expect(f.layers.map((l) => l.thickness)).toEqual([0.01, 0.02, 0.04, 0.12].map((x) => expect.closeTo(x, 9)));
    for (const l of f.layers) expect(l.volume).toBeCloseTo(12 * l.thickness, 9);
    expect(f.layers.reduce((s, l) => s + l.volume, 0)).toBeCloseTo(f.volume, 9);
  });

  it('agregado por material: volume em m³ e área de face superior em m²', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    // Argamassa tem duas camadas (2 cm e 4 cm), cada uma com face de 12 m².
    expect(q.volumeByMaterial.mat_argamassa).toBeCloseTo(12 * 0.06, 9);
    expect(q.faceAreaByMaterial.mat_argamassa).toBeCloseTo(24, 9);
    expect(q.volumeByMaterial.mat_concreto).toBeCloseTo(12 * 0.12, 9);
    expect(q.faceAreaByMaterial.mat_concreto).toBeCloseTo(12, 9);
    expect(q.volumeByMaterial.mat_ceramica).toBeCloseTo(12 * 0.01, 9);
    const sum = Object.values(q.volumeByMaterial).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(q.totalVolume, 9);
  });

  it('piso em L: área 6 e perímetro 14', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: L }]), 'lv_0').floors[0]!;
    expect(f.area).toBeCloseTo(6, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
  });

  it('furo 1 x 1 em retângulo 4 x 3: área 11, perímetro do furo 4 e volumes proporcionais', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)] }]), 'lv_0');
    const f = q.floors[0]!;
    expect(f.area).toBeCloseTo(11, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
    expect(f.holesPerimeter).toBeCloseTo(4, 9);
    expect(f.volume).toBeCloseTo(11 * T, 9);
    for (const l of f.layers) expect(l.volume).toBeCloseTo(11 * l.thickness, 9);
  });

  it('o furo não muda a espessura nem o deslocamento do piso', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)], heightOffset: 0.05 }]), 'lv_0').floors[0]!;
    expect(f.thickness).toBeCloseTo(T, 9);
  });

  it('membrana de espessura zero: aparece com área de face e volume zero (decisão 0023 §5)', () => {
    const q = quantifyFloors(
      build([{ id: 'f1', boundary: rect(0, 0, 4, 3), typeId: 'ft_zero' }], (p) => {
        p.floorTypes.ft_zero = {
          id: 'ft_zero',
          name: 'Teste',
          code: 'T-0',
          description: '',
          cost: 0,
          layers: [
            { function: 'membrane', materialId: 'mat_tinta', thickness: 0, wraps: false },
            { function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false },
          ],
        };
      }),
      'lv_0',
    );
    expect(q.layers).toHaveLength(2);
    const [membrane, concrete] = q.layers;
    expect(membrane).toMatchObject({ layerIndex: 0, membrane: true, thickness: 0, volume: 0 });
    expect(membrane!.area).toBeCloseTo(12, 9);
    expect(concrete).toMatchObject({ layerIndex: 1, membrane: false });
    expect(q.floors[0]!.volume).toBeCloseTo(1.2, 9);
    expect(q.volumeByMaterial.mat_tinta).toBe(0);
    expect(q.faceAreaByMaterial.mat_tinta).toBeCloseTo(12, 9);
  });

  it('nível com dois pisos: totais são a soma dos pisos', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }, { id: 'f2', boundary: rect(5, 0, 6, 2) }]), 'lv_0');
    expect(q.floors).toHaveLength(2);
    expect(q.totalArea).toBeCloseTo(14, 9);
    expect(q.totalVolume).toBeCloseTo(14 * T, 9);
  });

  it('pisos de outro nível não entram', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), levelId: 'lv_1' }]), 'lv_0');
    expect(q.floors).toEqual([]);
    expect(q.totalArea).toBe(0);
    expect(q.totalVolume).toBe(0);
  });
});

describe('piso embutido na laje do mesmo nível (decisão 0023 §4, exceção)', () => {
  it('laje mais espessa com a mesma face superior não apaga o piso: o piso mantém o volume próprio', () => {
    // ft_acab tem 0,04 m (acabamento, sem estrutura) e ls_mac12 tem 0,12 m, os dois com o topo em 0. O piso fica
    // inteiro dentro da laje: é a mesma construção repetida no modelo, não uma junta. O desconto apagaria o piso.
    const p = build([{ id: 'f1', typeId: 'ft_acab', boundary: rect(0, 0, 4, 3) }], undefined, [{ id: 's1', boundary: rect(0, 0, 4, 3) }]);
    const q = quantifyFloors(p, 'lv_0');
    const f = q.floors[0]!;
    expect(f.grossVolume).toBeCloseTo(12 * 0.04, 9);
    expect(f.volume).toBeCloseTo(12 * 0.04, 9);
    expect(f.volume).toBeCloseTo(f.grossVolume, 12);
    expect(f.netArea).toBeCloseTo(12, 9);
    // O total do nível conta as duas construções; o aviso de sobreposição é quem aponta a duplicidade
    // (validateSlabs: slab-floor-overlap e piso-estrutura-sobre-laje). A laje continua com o volume próprio.
    expect(q.totalVolume).toBeCloseTo(12 * 0.04, 9);
    expect(quantifySlabs(p, 'lv_0').totalVolume).toBeCloseTo(12 * 0.12, 9);
  });

  it('laje que cobre só parte do piso continua descontando a parte coberta', () => {
    // Metade da laje (2 x 3 m) sob o piso de 4 x 3 m: só a parte coberta sai do piso (2 * 3 * 0,04 = 0,24 m³).
    const q = quantifyFloors(
      build([{ id: 'f1', typeId: 'ft_acab', boundary: rect(0, 0, 4, 3) }], undefined, [{ id: 's1', boundary: rect(0, 0, 2, 3) }]),
      'lv_0',
    );
    const f = q.floors[0]!;
    expect(f.grossVolume).toBeCloseTo(12 * 0.04, 9);
    expect(f.volume).toBeCloseTo(12 * 0.04 - 6 * 0.04, 9);
  });

  it('laje mais fina que o piso, no mesmo nível, continua descontando (não é contenção)', () => {
    // ft_ceram tem 0,19 m e ls_mac12 tem 0,12 m: a laje não contém o piso, então a regra líquida normal vale.
    const q = quantifyFloors(
      build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }], undefined, [{ id: 's1', boundary: rect(-1, -1, 5, 4) }]),
      'lv_0',
    );
    const f = q.floors[0]!;
    expect(f.grossVolume).toBeCloseTo(12 * T, 9);
    expect(f.volume).toBeCloseTo(12 * T - 12 * 0.12, 9);
  });

  it('membrana do piso embutido na laje mantém a área de face', () => {
    const q = quantifyFloors(
      build(
        [{ id: 'f1', typeId: 'ft_zero', boundary: rect(0, 0, 4, 3) }],
        (p) => {
          p.floorTypes.ft_zero = {
            id: 'ft_zero',
            name: 'Teste',
            code: 'T-0',
            description: '',
            cost: 0,
            layers: [
              { function: 'membrane', materialId: 'mat_tinta', thickness: 0, wraps: false },
              { function: 'structure', materialId: 'mat_concreto', thickness: 0.05, wraps: false },
            ],
          };
        },
        [{ id: 's1', boundary: rect(-1, -1, 5, 4) }],
      ),
      'lv_0',
    );
    expect(q.layers[0]).toMatchObject({ membrane: true, volume: 0 });
    expect(q.layers[0]!.area).toBeCloseTo(12, 9);
    expect(q.floors[0]!.volume).toBeCloseTo(12 * 0.05, 9);
  });
});

describe('predio10: piso sobre a laje do mesmo nível', () => {
  it('nos pavimentos superiores o piso mantém o volume do desenho (90 m² × 0,15 m por unidade)', () => {
    const p = buildTemplate('predio10');
    const terreo = quantifyFloors(p, 'lv_0');
    for (const nivel of ['lv_1', 'lv_5', 'lv_9']) {
      const q = quantifyFloors(p, nivel);
      expect(q.floors).toHaveLength(4);
      for (const f of q.floors) {
        // O piso é a mesma construção da laje do nível (mesma face superior, laje mais espessa): não se anula.
        expect(f.volume, `${f.floorId}: líquido = bruto`).toBeCloseTo(f.grossVolume, 9);
        expect(f.volume, `${f.floorId}: volume do desenho`).toBeGreaterThan(f.area * 0.15 * 0.99);
      }
      // O nível inteiro vale o mesmo do térreo: 35,271 m³ (236 m² de piso a 0,15 m, com os contornos por camada).
      expect(q.totalVolume, `${nivel}: total`).toBeCloseTo(terreo.totalVolume, 6);
      expect(q.totalVolume, `${nivel}: total`).toBeCloseTo(35.271, 3);
    }
  }, 30000);
});
