import type { CadLayer, CadPath, CadText, CadUnit } from '@hestia/model';
import type { DxfPoint } from './dxf.ts';

/**
 * Importador de DXF (fase 5): lê o arquivo de outro programa e devolve as camadas, os traços e os textos para virarem um
 * `CadDrawing`. A geometria sai em METROS (a unidade do `$INSUNITS` é aplicada) e no sistema do arquivo (x, y; y para
 * cima). A inserção (ponto, rotação, escala) e o nível ficam com quem chama.
 */

/** O que o parser devolve, já em metros e sem transformação de inserção. */
export interface DxfImportResult {
  /** Nome do desenho (normalmente o nome do arquivo, sem extensão). */
  name: string;
  /** Unidade detectada no `$INSUNITS` (ausente no arquivo = metros). */
  unit: CadUnit;
  /** Metros por unidade do arquivo (mm = 0,001; ft = 0,3048). */
  unitScale: number;
  layers: CadLayer[];
  paths: CadPath[];
  texts: CadText[];
  /** Caixa do desenho em metros (unidade já aplicada). */
  extents: { min: DxfPoint; max: DxfPoint };
  /** O que foi ignorado ou aproximado (HATCH, DIMENSION, OCS fora do plano, bloco sem suporte...). */
  warnings: string[];
}

/**
 * Lê o texto de um DXF (R12 ou R2000) e devolve o desenho em metros. Entidades suportadas na v1: LINE, LWPOLYLINE,
 * POLYLINE/VERTEX/SEQEND, ARC, CIRCLE, TEXT, MTEXT e INSERT (blocos expandidos, sem atributos). `name` vira o nome do
 * desenho; ausente = "CAD".
 */
export function parseDxfText(text: string, name = 'CAD'): DxfImportResult {
  void text;
  void name;
  throw new Error('Importador DXF ainda não implementado');
}
