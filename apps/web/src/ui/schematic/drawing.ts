export type Pt = readonly [x: number, y: number];
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export type Tone = 'body' | 'ground' | 'guide' | 'muted' | 'accent' | 'ok' | 'warn' | 'danger';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Weight = 'thin' | 'normal' | 'heavy';
export type HatchPattern = 'concrete' | 'ground' | 'wood' | 'diagonal';
export type TextAnchor = 'start' | 'middle' | 'end';
export type Role = 'body' | 'aux';
export interface PolygonPrim  { kind: 'polygon';  id: string; pts: Pt[]; fill: 'body' | 'soft' | 'none'; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface PolylinePrim { kind: 'polyline'; id: string; pts: Pt[]; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role; arrowEnd?: boolean }
export interface LinePrim     { kind: 'line';     id: string; a: Pt; b: Pt; tone: Tone; weight: Weight; lineStyle: LineStyle; role: Role }
export interface HatchPrim    { kind: 'hatch';    id: string; pts: Pt[]; pattern: HatchPattern }
export interface DimensionPrim { kind: 'dimension'; id: string; p1: Pt; p2: Pt; axis: 'x' | 'y' | 'aligned'; line: number; text: string; tone: Tone; broken?: boolean }
export interface LabelPrim { kind: 'label'; id: string; at: Pt; text: string; anchor: TextAnchor; tone: Tone; leader?: Pt }
export type Prim = PolygonPrim | PolylinePrim | LinePrim | HatchPrim | DimensionPrim | LabelPrim;
export interface Drawing {
  frame: Rect; em: number; prims: Prim[]; caption?: string;
  meta: { kind: 'stair-section' | 'ramp-section' | 'ramp-plan'; vExag?: number };
}
export interface DrawingIssue { code: string; ids: string[] }
export const CHAR_W = 0.56;
export const LINE_H = 1.15;
export const MIN_FONT_RATIO = 0.026;
