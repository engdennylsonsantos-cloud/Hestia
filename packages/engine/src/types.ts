import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { Id, PlanSymbol } from '@hestia/model';

export interface ResolvedLayer {
  layerIndex: number;
  materialId: Id;
  priority: number;
  /** Fragmento da camada depois da prioridade de junção, SEM os vãos (base do 3D). */
  fragment: MultiPolygon;
  /** Fragmento com os vãos recortados (planta). */
  cut: MultiPolygon;
  /**
   * Geometria por faixa de altura (3D e quantitativos): o vão só fura as faixas que ele atravessa e uma
   * parede só corta a vizinha onde as duas existem na mesma altura.
   */
  bands: LayerBand[];
}

/** Faixa vertical de uma camada com a mesma geometria em planta. z relativo à base da parede. */
export interface LayerBand {
  z0: number;
  z1: number;
  poly: MultiPolygon;
  /**
   * Topo inclinado (perfil superior da parede): a altura relativa em `p` é h0 + (h1−h0)·(d·(p−o) − t0)/(t1 − t0).
   * Nesse caso `z1` é a maior altura da faixa (para caixas e limites).
   */
  slope?: { o: Vec2; d: Vec2; t0: number; t1: number; h0: number; h1: number };
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
  /** Camadas de espessura zero (membranas, barreiras): linhas no limite entre camadas, em planta e nos quantitativos. */
  membranes: Membrane[];
}

export interface Membrane {
  layerIndex: number;
  materialId: Id;
  /** Linha da membrana entre as duas extremidades da parede (reta; parede curva não desenha membrana). */
  pts: Vec2[];
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
  /** 0 = vão livre: sem folha nem caixilho (só o recorte e a soleira). */
  leaves: 0 | 1 | 2;
  /** Família do símbolo de planta. */
  plan: PlanSymbol;
  flipHand: boolean;
  flipFacing: boolean;
  /** Distância ao longo do eixo a partir de `a`. */
  offset: number;
}
