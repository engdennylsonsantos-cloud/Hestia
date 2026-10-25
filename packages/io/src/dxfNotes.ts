import { dimensionGeometry, dimensionPoints, dimensionText, DIM_TEXT_MM, levelDimensions, levelTexts, type Id, type Project } from '@hestia/model';
import type { DxfPoint } from './dxf.ts';

/** Camadas das anotações da planta (decisão 0019): cotas em LINE e TEXT; textos livres em TEXT. */
export const DXF_LAYER_COTAS = 'COTAS';
export const DXF_LAYER_TEXTOS = 'TEXTOS';

export interface DxfNoteText {
  at: DxfPoint;
  text: string;
  /** Altura em metros de desenho (já na escala da vista). */
  height: number;
  /** Graus, anti-horário. */
  rotation: number;
  layer: string;
}

/** Anotações do nível para o DXF: linhas de cota (camada `COTAS`) e textos (`COTAS` para o valor, `TEXTOS` para o livre). */
export interface DxfNotes {
  lines: Array<[DxfPoint, DxfPoint]>;
  texts: DxfNoteText[];
}

/**
 * Anotações do nível em metros de desenho. `scale` é o denominador da vista (1:100 → 100): 1 mm de papel = scale/1000 m.
 * Quem chama decide a visibilidade da categoria (a geometria sai inteira aqui).
 */
export function notesDxfOf(p: Project, levelId: Id, scale: number): DxfNotes {
  const mPerMm = scale / 1000;
  const lines: Array<[DxfPoint, DxfPoint]> = [];
  const texts: DxfNoteText[] = [];
  for (const d of levelDimensions(p, levelId)) {
    const { a, b } = dimensionPoints(p, d);
    const g = dimensionGeometry(a, b, d.offset, mPerMm);
    lines.push(g.line, ...g.extensions, ...g.ticks);
    texts.push({ at: g.textAt, text: dimensionText(p, d), height: DIM_TEXT_MM * mPerMm, rotation: g.textRotation, layer: DXF_LAYER_COTAS });
  }
  for (const t of levelTexts(p, levelId)) texts.push({ at: t.at, text: t.text, height: t.height * mPerMm, rotation: t.rotation, layer: DXF_LAYER_TEXTOS });
  return { lines, texts };
}

/** Registros do TEXT (centrado no ponto de alinhamento, código 72=1 e 73=2) como pares [código, valor]. */
export function dxfTextRecords(t: DxfNoteText): Array<[number, string | number]> {
  const x = t.at.x.toFixed(6);
  const y = t.at.y.toFixed(6);
  return [
    [0, 'TEXT'],
    [8, t.layer],
    [10, x],
    [20, y],
    [30, '0.000000'],
    [40, t.height.toFixed(6)],
    [1, t.text],
    [50, t.rotation.toFixed(6)],
    [72, 1],
    [73, 2],
    [11, x],
    [21, y],
    [31, '0.000000'],
  ];
}
