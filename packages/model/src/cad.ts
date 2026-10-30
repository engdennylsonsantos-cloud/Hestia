import type { Vec2 } from '@hestia/geom';
import type { Id } from './types.ts';

/**
 * Desenho CAD importado de um DXF (fase 5). É um objeto só, tipo bloco: guarda as linhas e os textos nas camadas do
 * arquivo, já em coordenadas de mundo (m). O importador aplica a unidade do arquivo e a inserção (ponto, rotação e
 * escala); o modelo guarda o resultado pronto, e o objeto se move/gira/escala como um elemento qualquer.
 */

/** Camada de um desenho CAD importado: nome e cor ACI do arquivo (ausente = 7). */
export interface CadLayer {
  name: string;
  color?: number;
}

/** Traço do CAD importado, em coordenadas de mundo (m). */
export interface CadPath {
  layer: string;
  pts: Vec2[];
  closed: boolean;
  /** Cor ACI da entidade no arquivo; ausente = a da camada. */
  color?: number;
}

/** Texto do CAD importado, em coordenadas de mundo (m); altura em metros de desenho. */
export interface CadText {
  layer: string;
  at: Vec2;
  text: string;
  height: number;
  rotation: number;
  color?: number;
}

/** Unidades de comprimento que o importador/exportador DXF entendem. */
export type CadUnit = 'mm' | 'cm' | 'm' | 'ft' | 'in';

/** Desenho CAD importado (um objeto selecionável, com as camadas do arquivo). */
export interface CadDrawing {
  id: Id;
  kind: 'cad';
  levelId: Id;
  name: string;
  source: 'dxf';
  /** Unidade detectada no arquivo; só para exibir e reexportar com a mesma unidade. */
  unit: CadUnit;
  /** Deslocamento vertical em relação ao nível (m); ausente = 0. */
  offsetZ?: number;
  /** Visível nas plantas e no 3D; ausente = true. */
  visible?: boolean;
  layers: CadLayer[];
  paths: CadPath[];
  texts: CadText[];
  order: number;
}

/** É um desenho CAD importado? (aceita `Element` ou qualquer objeto com `kind`). */
export function isCad(e: { kind?: string } | undefined | null): e is CadDrawing {
  return e?.kind === 'cad';
}
