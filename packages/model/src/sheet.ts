import type { Vec2 } from '@hestia/geom';
import type { Id, Project } from './types.ts';

/**
 * Pranchas (decisão 0022): folha de papel com moldura, carimbo e vistas (planta, corte ou 3D) em escala. Tudo em mm de
 * papel; as vistas usam o mundo em metros e a escala 1:`scale`. Campos opcionais em `Project.sheets`: sem eles, não há
 * pranchas e o arquivo antigo continua valendo (sem migração).
 */
export type SheetSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type SheetOrientation = 'landscape' | 'portrait';
export const SHEET_SIZES: readonly SheetSize[] = ['A0', 'A1', 'A2', 'A3', 'A4'];
export const SHEET_ORIENTATIONS: readonly SheetOrientation[] = ['landscape', 'portrait'];

/** Dimensões da folha ISO 216 em mm, na orientação de retrato (largura × altura). */
export const SHEET_PAPER_MM: Record<SheetSize, { w: number; h: number }> = {
  A0: { w: 841, h: 1189 },
  A1: { w: 594, h: 841 },
  A2: { w: 420, h: 594 },
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
};

/** Margem padrão da folha (mm de papel). */
export const SHEET_DEFAULT_MARGIN = 10;

/** Dados do carimbo (cabeçalho do bloco de título). */
export interface TitleBlock {
  project: string;
  client: string;
  author: string;
  date: string;
  revision: string;
  /** Texto livre da escala; sem ele, o carimbo mostra as escalas das vistas. */
  scaleNote?: string;
}

/** O que a vista mostra: planta de um nível, planta de área, corte/elevação de uma seção do projeto ou o 3D (só quadro no PDF). */
export type SheetViewSource = { kind: 'plan'; levelId: Id } | { kind: 'areaPlan'; planId: Id } | { kind: 'areaTable' } | { kind: 'section'; sectionId: Id } | { kind: '3d' };

/** Vista colocada numa prancha. `at` é o canto inferior esquerdo e `size` a caixa, ambos em mm de papel. */
export interface SheetViewport {
  id: Id;
  view: SheetViewSource;
  at: Vec2;
  size: { w: number; h: number };
  /** Denominador da escala: 100 = 1:100. */
  scale: number;
  title?: string;
}

export interface Sheet {
  id: Id;
  number: string;
  name: string;
  size: SheetSize;
  orientation: SheetOrientation;
  /** Margem entre a borda da folha e a moldura (mm). */
  margin: number;
  titleBlock: TitleBlock;
  viewports: SheetViewport[];
}

/** Largura e altura da folha em mm, conforme a orientação. */
export function sheetDimsMm(s: Pick<Sheet, 'size' | 'orientation'>): { w: number; h: number } {
  const { w, h } = SHEET_PAPER_MM[s.size];
  return s.orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

/** Área de desenho de uma vista: a folha menos a margem. Vistas precisam caber nela. */
export function sheetInnerBox(s: Pick<Sheet, 'size' | 'orientation' | 'margin'>): { x0: number; y0: number; x1: number; y1: number } {
  const d = sheetDimsMm(s);
  return { x0: s.margin, y0: s.margin, x1: d.w - s.margin, y1: d.h - s.margin };
}

export const emptyTitleBlock = (): TitleBlock => ({ project: '', client: '', author: '', date: '', revision: '' });

const finite = (v: Vec2): boolean => Number.isFinite(v.x) && Number.isFinite(v.y);

/** Motivo de recusa de uma prancha (tamanho, orientação, margem), ou null. */
export function sheetIssue(s: Sheet): string | null {
  if (!SHEET_SIZES.includes(s.size)) return 'Tamanho de folha desconhecido.';
  if (!SHEET_ORIENTATIONS.includes(s.orientation)) return 'Orientação de folha desconhecida.';
  const d = sheetDimsMm(s);
  if (!(Number.isFinite(s.margin) && s.margin >= 0 && s.margin * 2 < Math.min(d.w, d.h))) return 'A margem deve ser um número não negativo e menor que a folha.';
  return null;
}

/** Motivo de recusa de uma vista na prancha, ou null. Vista fora da área de desenho da folha é recusada. */
export function viewportIssue(s: Pick<Sheet, 'size' | 'orientation' | 'margin'>, v: SheetViewport): string | null {
  if (!finite(v.at)) return 'A posição da vista deve ser um ponto finito.';
  if (!(Number.isFinite(v.size.w) && Number.isFinite(v.size.h) && v.size.w > 0 && v.size.h > 0)) return 'A vista precisa de largura e altura maiores que zero.';
  if (!(Number.isFinite(v.scale) && v.scale > 0)) return 'A escala deve ser maior que zero.';
  const box = sheetInnerBox(s);
  const eps = 1e-6;
  if (v.at.x < box.x0 - eps || v.at.y < box.y0 - eps || v.at.x + v.size.w > box.x1 + eps || v.at.y + v.size.h > box.y1 + eps) return 'A vista sai da folha.';
  return null;
}

/** Pranchas do projeto (ausente = nenhuma). */
export const projectSheets = (p: Pick<Project, 'sheets'>): Sheet[] => p.sheets ?? [];

export function sheetOf(p: Pick<Project, 'sheets'>, id: Id): Sheet | undefined {
  return projectSheets(p).find((s) => s.id === id);
}
