import type { Id, Stair, StairType } from './types.ts';

type StairInput = { id: Id; typeId: Id; levelId: Id } & Partial<Omit<Stair, 'order' | 'kind'>>;

/** Constrói uma escada com os campos padrão (decisão 0011 §2); `order` é atribuído pelo comando addStair. */
export function makeStair(s: StairInput): Omit<Stair, 'order'> {
  return {
    kind: 'stair',
    topLevelId: null,
    baseOffset: 0,
    topOffset: 0,
    height: 2.8,
    components: [],
    openSlab: true,
    mark: '',
    comments: '',
    ...s,
  };
}

/** Valores comuns aos dois tipos iniciais (decisão 0011 §1, item 8). */
const COMMON = {
  maxRiser: 0.18,
  minTread: 0.28,
  minRunWidth: 0.8,
  nosing: 0.015,
  landingThickness: 0.15,
  minHeadroom: 2.1,
  cost: 0,
} as const;

/** Tipos de escada iniciais. Estilo monolítico usa a profundidade estrutural; o montado usa piso e espelho. */
export const DEFAULT_STAIR_TYPES: StairType[] = [
  {
    ...COMMON,
    id: 'stt_monolitica',
    name: 'Escada monolítica concreto',
    code: 'ES-01',
    description: 'Lance monolítico de concreto armado com patamares de concreto',
    runStyle: 'monolithic',
    structuralDepth: 0.2,
    treadThickness: 0,
    riserThickness: 0,
    materialId: 'mat_concreto',
  },
  {
    ...COMMON,
    id: 'stt_piso_espelho',
    name: 'Escada de piso e espelho',
    code: 'ES-02',
    description: 'Lance de degraus de madeira (piso e espelho) sobre estrutura',
    runStyle: 'assembled',
    structuralDepth: 0,
    treadThickness: 0.03,
    riserThickness: 0.02,
    materialId: 'mat_madeira',
  },
];

/** Tipo usado por padrão quando o projeto não escolhe outro. */
export const defaultStairTypeId: Id = 'stt_monolitica';
