import { beforeEach, describe, expect, it } from 'vitest';
import {
  ProjectStore,
  createEmptyProject,
  defaultRampTypeId,
  defaultStairTypeId,
  makeCeiling,
  makeFloor,
  makeRamp,
  makeRoof,
  makeRoom,
  makeSlab,
  makeStair,
  makeWall,
  type Opening,
} from '@hestia/model';
import { createSimilarTarget, startCreateSimilar } from './createSimilar.ts';
import { editor } from './controller.ts';
import { DEFAULT_OPTIONS, useUi } from './state.ts';

/** Retângulo de 4 × 3 m para pisos, lajes, forros e telhados. */
const RETANGULO = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

/** Projeto com uma parede anfitriã (as aberturas precisam de hospedeiro). */
function base(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  return s;
}

/** Abertura de teste hospedada na parede w1. */
const abertura = (id: string, kind: Opening['kind'], typeId: string): Opening => ({
  id,
  kind,
  typeId,
  hostId: 'w1',
  offset: 1,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
});

describe('createSimilarTarget (função pura)', () => {
  it('parede devolve a ferramenta Parede e o tipo dela', () => {
    const s = base();
    expect(createSimilarTarget(s.project, ['w1'])).toEqual({ tool: 'wall', option: 'wallTypeId', typeId: 'wt_alv14' });
  });

  it('porta devolve a ferramenta Porta e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addOpening', opening: abertura('d1', 'door', 'ot_p80') });
    expect(createSimilarTarget(s.project, ['d1'])).toEqual({ tool: 'door', option: 'doorTypeId', typeId: 'ot_p80' });
  });

  it('janela devolve a ferramenta Janela e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addOpening', opening: abertura('v1', 'window', 'ot_j120') });
    expect(createSimilarTarget(s.project, ['v1'])).toEqual({ tool: 'window', option: 'windowTypeId', typeId: 'ot_j120' });
  });

  it('piso devolve a ferramenta Piso e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RETANGULO }) });
    expect(createSimilarTarget(s.project, ['f1'])).toEqual({ tool: 'floor', option: 'floorTypeId', typeId: 'ft_ceram' });
  });

  it('laje devolve a ferramenta Laje e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: RETANGULO }) });
    expect(createSimilarTarget(s.project, ['l1'])).toEqual({ tool: 'slab', option: 'slabTypeId', typeId: 'ls_mac12' });
  });

  it('forro devolve a ferramenta Forro e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: RETANGULO }) });
    expect(createSimilarTarget(s.project, ['c1'])).toEqual({ tool: 'ceiling', option: 'ceilingTypeId', typeId: 'ct_gesso' });
  });

  it('telhado devolve a ferramenta Telhado e o tipo dela', () => {
    const s = base();
    s.exec({ type: 'addRoof', roof: makeRoof({ id: 't1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: RETANGULO }) });
    expect(createSimilarTarget(s.project, ['t1'])).toEqual({ tool: 'roof', option: 'roofTypeId', typeId: 'rt_ceramica' });
  });

  it('escada não tem ferramenta de "Criar semelhante"', () => {
    const s = base();
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0' }) });
    expect(createSimilarTarget(s.project, ['st1'])).toBeNull();
  });

  it('rampa não tem ferramenta de "Criar semelhante"', () => {
    const s = base();
    s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: defaultRampTypeId, levelId: 'lv_0' }) });
    expect(createSimilarTarget(s.project, ['rp1'])).toBeNull();
  });

  it('ambiente não tem ferramenta de "Criar semelhante"', () => {
    const s = base();
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 1, y: 1 } }) });
    expect(createSimilarTarget(s.project, ['r1'])).toBeNull();
  });

  it('seleção mista (parede + porta) não tem alvo', () => {
    const s = base();
    s.exec({ type: 'addOpening', opening: abertura('d1', 'door', 'ot_p80') });
    expect(createSimilarTarget(s.project, ['w1', 'd1'])).toBeNull();
  });

  it('dois elementos do mesmo tipo com tipos (de tipo) diferentes não têm alvo', () => {
    const s = base();
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv9', levelId: 'lv_0', a: { x: 0, y: 1 }, b: { x: 6, y: 1 } }) });
    expect(createSimilarTarget(s.project, ['w1', 'w2'])).toBeNull();
  });

  it('seleção vazia não tem alvo', () => {
    const s = base();
    expect(createSimilarTarget(s.project, [])).toBeNull();
  });

  it('id inexistente na seleção não tem alvo', () => {
    const s = base();
    expect(createSimilarTarget(s.project, ['w1', 'nao_existe'])).toBeNull();
  });
});

describe('startCreateSimilar (liga a ferramenta e grava o tipo)', () => {
  beforeEach(() => {
    useUi.setState({ selection: [], options: { ...DEFAULT_OPTIONS }, tool: 'select' });
  });

  it('com uma parede selecionada, grava options.wallTypeId e ativa a ferramenta Parede', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv9', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    editor.load(s.project, 'teste.hestia.json');
    useUi.setState({ selection: ['w1'] });

    expect(startCreateSimilar()).toBe(true);
    expect(useUi.getState().options.wallTypeId).toBe('wt_alv9');
    expect(useUi.getState().tool).toBe('wall');
  });

  it('sem alvo devolve false e não muda a ferramenta nem as opções', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 1, y: 1 } }) });
    editor.load(s.project, 'teste.hestia.json');
    useUi.setState({ selection: ['r1'] });

    expect(startCreateSimilar()).toBe(false);
    expect(useUi.getState().tool).toBe('select');
    expect(useUi.getState().options.wallTypeId).toBe(DEFAULT_OPTIONS.wallTypeId);
  });
});
