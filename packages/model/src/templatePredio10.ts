import type { Vec2 } from '@hestia/geom';
import type { Command } from './commands.ts';
import { makeFloor } from './floor.ts';
import { makeSlab } from './slab.ts';
import { makeWall } from './wall.ts';
import type { FloorType, Id, Level, SectionView, SlabType } from './types.ts';

/**
 * Prédio residencial de 10 pavimentos — exemplo de **estabilidade geral** (plantas, cortes e 3D). Planta retangular de
 * 20 × 12 m com núcleo de circulação central de 6 × 4 m e quatro unidades por andar (norte, sul, oeste e leste). Piso a
 * piso de 2,80 m: 10 pavimentos, 28,00 m até o topo da laje de cobertura.
 *
 * Configuração de junção pedida pelo dono (decisões 0025 e 0027):
 * - lajes e pisos terminam na **face externa do núcleo** da parede: camada estrutural com `limiteExterno: 'nucleo'`;
 * - as camadas de **acabamento** terminam na **face interna do núcleo**: `termino: 'nucleo'`.
 * Assim a estrutura da laje passa sob o acabamento e para no núcleo, e o acabamento para na face interna dele — o
 * acabamento externo da parede fica contínuo por fora da laje.
 *
 * Paredes **sem anexo** de base e de topo (padrão do modelo): o topo vai ao topo da laje pelo nível de topo + `topOffset`.
 */

const H = 2.8;
const W = 20;
const D = 12;
const N = 10;
/** Face externa do acabamento da parede externa `wt_ext19`: 0,242 m de espessura, metade para cada lado do eixo. */
const EXT = 0.121;
const CORE = { x0: 7, x1: 13, y0: 4, y1: 8 } as const;

const lv = (i: number): Id => `lv_${i}`;
const elev = (i: number): number => i * H;

const NIVEL: Level[] = Array.from({ length: N }, (_, i) => ({
  id: lv(i),
  name: i === 0 ? 'Térreo' : `Pavimento ${i + 1}`,
  elevation: elev(i),
  viewRange: { top: 2.3, cut: 1.2, bottom: 0, depth: 0, direction: 'down' },
}));

/** Laje: argamassa em cima e tinta embaixo param na face interna do núcleo; o concreto para na face externa dele. */
const LAJE: SlabType = {
  id: 'pd_laje',
  name: 'Laje maciça 19 (prédio)',
  code: 'PD-LJ',
  description: 'Regularização e forro param na face interna do núcleo; a estrutura para na face externa do núcleo.',
  cost: 240,
  layers: [
    { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: 'nucleo' },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false, limiteExterno: 'nucleo' },
    { function: 'substrate', materialId: 'mat_tinta', thickness: 0.02, wraps: false, termino: 'nucleo' },
  ],
};

/** Piso das unidades: mesmo critério da laje (acabamento na face interna do núcleo, estrutura na face externa). */
const PISO: FloorType = {
  id: 'pd_piso',
  name: 'Piso cerâmico (prédio)',
  code: 'PD-PS',
  description: 'Cerâmica e contrapiso param na face interna do núcleo; a estrutura para na face externa do núcleo.',
  cost: 160,
  layers: [
    { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false, termino: 'nucleo' },
    { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.04, wraps: false, termino: 'nucleo' },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.10, wraps: false, limiteExterno: 'nucleo' },
  ],
};

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Perímetro no sentido horário: a face externa fica à esquerda de a→b (docs/05 §3). */
function perimeter(cmds: Command[], levelId: Id, typeId: Id, box: { x0: number; x1: number; y0: number; y1: number }, pre: string, topo: Partial<{ topLevelId: Id | null; topOffset: number }>): void {
  const lados: Array<[string, Vec2, Vec2]> = [
    ['s', { x: box.x1, y: box.y0 }, { x: box.x0, y: box.y0 }],
    ['l', { x: box.x1, y: box.y1 }, { x: box.x1, y: box.y0 }],
    ['n', { x: box.x0, y: box.y1 }, { x: box.x1, y: box.y1 }],
    ['o', { x: box.x0, y: box.y0 }, { x: box.x0, y: box.y1 }],
  ];
  for (const [nome, a, b] of lados) {
    cmds.push({ type: 'addWall', wall: makeWall({ id: `${pre}-${nome}`, typeId, levelId, a, b, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, ...topo }) });
  }
}

/** Vão de porta de 0,90 × 2,10 centrado no trecho. */
const porta = (hostId: Id, offset: number, id: Id): Command => ({
  type: 'addOpening',
  opening: { id, kind: 'door', typeId: 'ot_p90', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
});

/** Janela de correr de 2,40 × 1,20 com peitoril de 1,10 (tipo do catálogo padrão). */
const janela = (hostId: Id, offset: number, id: Id): Command => ({
  type: 'addOpening',
  opening: { id, kind: 'window', typeId: 'ot_j240', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
});

/** Uma unidade por quadrante: norte e sul com 20 × 4 m; oeste e leste com 7 × 4 m. */
const UNIDADES: Array<{ nome: string; box: { x0: number; y0: number; x1: number; y1: number } }> = [
  { nome: 'n', box: { x0: 0, y0: CORE.y1, x1: W, y1: D } },
  { nome: 's', box: { x0: 0, y0: 0, x1: W, y1: CORE.y0 } },
  { nome: 'o', box: { x0: 0, y0: CORE.y0, x1: CORE.x0, y1: CORE.y1 } },
  { nome: 'l', box: { x0: CORE.x1, y0: CORE.y0, x1: W, y1: CORE.y1 } },
];

/** Porta interna de 0,80 × 2,10. */
const porta80 = (hostId: Id, offset: number, id: Id): Command => ({
  type: 'addOpening',
  opening: { id, kind: 'door', typeId: 'ot_p80', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
});

/** Divisória interna da unidade (parede de 9 cm) com uma porta de 0,80 no meio. */
function divisoria(cmds: Command[], levelId: Id, id: Id, a: Vec2, b: Vec2, topo: Partial<{ topLevelId: Id | null; topOffset: number }>): void {
  cmds.push({
    type: 'addWall',
    wall: makeWall({ id, typeId: 'wt_alv9', levelId, a, b, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, ...topo }),
  });
  cmds.push(porta80(id, Math.hypot(b.x - a.x, b.y - a.y) / 2, `${id}-p`));
}

const CORTES: SectionView[] = [
  // AA pelo núcleo, no eixo x = 10 (olha para o oeste, atravessa os 10 pavimentos).
  { id: 'PD-AA', name: 'Corte AA (prédio)', kind: 'section', a: { x: 10, y: -2 }, b: { x: 10, y: D + 2 }, depth: D + 4 },
  // BB transversal, no eixo y = 6.
  { id: 'PD-BB', name: 'Corte BB (prédio)', kind: 'section', a: { x: -2, y: 6 }, b: { x: W + 2, y: 6 }, depth: W + 4 },
];

/** Monta o prédio de 10 pavimentos como uma lista de comandos, no mesmo estilo de `house2` e `casaAltoPadrao`. */
export function predio10(cmds: Command[]): void {
  for (const l of NIVEL) cmds.push({ type: 'upsertLevel', level: l });
  cmds.push({ type: 'upsertSlabType', slabType: LAJE });
  cmds.push({ type: 'upsertFloorType', floorType: PISO });

  for (let i = 0; i < N; i++) {
    const nivel = lv(i);
    const acima = i + 1 < N ? lv(i + 1) : null;
    // Sem anexo: o topo das paredes vai ao topo da laje de cima (nível + topOffset 0), ou 2,80 acima no último.
    const topo = acima ? { topLevelId: acima, topOffset: 0 } : {};
    perimeter(cmds, nivel, 'wt_ext19', { x0: 0, y0: 0, x1: W, y1: D }, `PD${i}-EXT`, topo);
    perimeter(cmds, nivel, 'wt_conc15', { ...CORE }, `PD${i}-NUC`, topo);

    // Uma unidade por quadrante, com porta para o núcleo.
    for (const u of UNIDADES) {
      cmds.push({ type: 'addFloor', floor: makeFloor({ id: `PD${i}-${u.nome.toUpperCase()}`, typeId: 'pd_piso', levelId: nivel, boundary: rect(u.box.x0, u.box.y0, u.box.x1, u.box.y1) }) });
    }

    // Apartamentos: as unidades norte e sul têm dois dormitórios, banheiro e sala/cozinha; oeste e leste,
    // sala e dormitório. Cada divisória leva uma porta de 0,80.
    for (const [sufixo, y0, y1] of [['N', CORE.y1, D], ['S', 0, CORE.y0]] as const) {
      const divisorias: Array<[number, number]> = [[5, 1], [8.5, 2], [14, 3]];
      for (const [x, n] of divisorias) {
        divisoria(cmds, nivel, `PD${i}-${sufixo}-D${n}`, { x, y: y0 }, { x, y: y1 }, topo);
      }
    }
    divisoria(cmds, nivel, `PD${i}-O-D1`, { x: 0, y: (CORE.y0 + CORE.y1) / 2 }, { x: CORE.x0, y: (CORE.y0 + CORE.y1) / 2 }, topo);
    divisoria(cmds, nivel, `PD${i}-L-D1`, { x: CORE.x1, y: (CORE.y0 + CORE.y1) / 2 }, { x: W, y: (CORE.y0 + CORE.y1) / 2 }, topo);

    cmds.push(porta(`PD${i}-NUC-n`, (CORE.x1 - CORE.x0) / 2, `PD${i}-pN`));
    cmds.push(porta(`PD${i}-NUC-s`, (CORE.x1 - CORE.x0) / 2, `PD${i}-pS`));
    cmds.push(porta(`PD${i}-NUC-o`, (CORE.y1 - CORE.y0) / 2, `PD${i}-pO`));
    cmds.push(porta(`PD${i}-NUC-l`, (CORE.y1 - CORE.y0) / 2, `PD${i}-pL`));

    // Janelas nas paredes externas: duas no norte, duas no sul, uma a leste e uma a oeste.
    cmds.push(janela(`PD${i}-EXT-n`, W / 3, `PD${i}-jN1`));
    cmds.push(janela(`PD${i}-EXT-n`, (2 * W) / 3, `PD${i}-jN2`));
    cmds.push(janela(`PD${i}-EXT-s`, W / 3, `PD${i}-jS1`));
    cmds.push(janela(`PD${i}-EXT-s`, (2 * W) / 3, `PD${i}-jS2`));
    cmds.push(janela(`PD${i}-EXT-l`, D / 2, `PD${i}-jL`));
    cmds.push(janela(`PD${i}-EXT-o`, D / 2, `PD${i}-jO`));

    // Laje do pavimento (contorno na face externa do acabamento; as camadas é que param no núcleo).
    if (i > 0) {
      cmds.push({ type: 'addSlab', slab: makeSlab({ id: `PD${i}-LAJE`, typeId: 'pd_laje', levelId: nivel, boundary: rect(-EXT, -EXT, W + EXT, D + EXT) }) });
    }
  }

  // Laje de cobertura sobre o último pavimento (topo em 28,00).
  cmds.push({ type: 'addSlab', slab: makeSlab({ id: 'PD-COB', typeId: 'pd_laje', levelId: lv(N - 1), heightOffset: H, boundary: rect(-EXT, -EXT, W + EXT, D + EXT) }) });

  for (const v of CORTES) cmds.push({ type: 'addView', view: v });
}
