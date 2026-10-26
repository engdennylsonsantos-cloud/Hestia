import type { PerimeterActions, PerimeterView } from './perimeterApi.ts';

const IDLE: PerimeterView = {
  active: false,
  target: 'roof',
  draft: null,
  result: null,
  shape: 'line',
  lineKind: 'boundary',
  options: { overhang: 0.5, slopePct: 30, extendToCore: false, heightOffset: 0 },
  hoverId: null,
  selectedEdge: null,
  status: '',
};

/** Estado do modo de perímetro para a tela. (Stub: a lógica entra na onda 2b.) */
export const usePerimeter = (): PerimeterView => IDLE;

export const perimeterActions: PerimeterActions = {
  begin: () => {},
  edit: () => {},
  setShape: () => {},
  setLineKind: () => {},
  setOptions: () => {},
  finish: () => {},
  cancel: () => {},
  setEdge: () => {},
};
