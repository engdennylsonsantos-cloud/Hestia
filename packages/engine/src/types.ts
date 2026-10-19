import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { Id } from '@hestia/model';

export interface ResolvedLayer {
  layerIndex: number;
  materialId: Id;
  priority: number;
  /** Fragmento da camada depois da prioridade de junção, SEM os vãos (base do 3D). */
  fragment: MultiPolygon;
  /** Fragmento com os vãos recortados (planta). */
  cut: MultiPolygon;
}

/** Pedaço de camada acima/abaixo de um vão, para o 3D. z relativo à base da parede. */
export interface OpeningPiece {
  openingId: Id;
  layerIndex: number;
  materialId: Id;
  poly: MultiPolygon;
  z0: number;
  z1: number;
}

export interface ResolvedWall {
  wallId: Id;
  /** Eixo (linha de localização) original. */
  a: Vec2;
  b: Vec2;
  u: Vec2;
  n: Vec2;
  length: number;
  sHi: number;
  sLo: number;
  baseZ: number;
  height: number;
  layers: ResolvedLayer[];
  pieces: OpeningPiece[];
}

export interface Region {
  materialId: Id;
  polygons: MultiPolygon;
}

export interface ResolvedCluster {
  wallIds: Id[];
  /** Região por material (união entre paredes): hachura e preenchimento da planta. */
  regions: Region[];
  /** Contorno externo do corte: linha pesada da planta. */
  silhouette: MultiPolygon;
}

export interface ResolvedLevel {
  levelId: Id;
  walls: Record<Id, ResolvedWall>;
  clusters: ResolvedCluster[];
}

export interface OpeningGeometry {
  openingId: Id;
  hostId: Id;
  kind: 'door' | 'window';
  center: Vec2;
  /** Direção ao longo da parede. */
  u: Vec2;
  /** Normal à esquerda. */
  n: Vec2;
  width: number;
  height: number;
  sill: number;
  thickness: number;
  /** Faixa s da parede em que o vão está. */
  sHi: number;
  sLo: number;
  leaves: 1 | 2;
  flipHand: boolean;
  flipFacing: boolean;
  /** Distância ao longo do eixo a partir de `a`. */
  offset: number;
}
