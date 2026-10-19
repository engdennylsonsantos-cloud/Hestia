import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';

/** Água resolvida: região em planta e plano da face superior (cota absoluta z0 em `origin`, subida `up`, `percent`). */
export interface ResolvedRoofPlane {
  polygon: MultiPolygon;
  origin: Vec2;
  /** Direção unitária de subida. */
  up: Vec2;
  percent: number;
  /** Cota absoluta da face superior em `origin`. */
  z0: number;
}

/** Linha notável do telhado em planta (para desenho e quantitativos). */
export interface RoofLine {
  kind: 'ridge' | 'hip' | 'valley' | 'eave';
  a: Vec2;
  b: Vec2;
}

export interface ResolvedRoofLayer {
  layerIndex: number;
  materialId: Id;
  /** Espessura vertical. */
  thickness: number;
  /** Distância vertical da face superior do telhado ao topo desta camada (soma das camadas acima). */
  below: number;
}

export interface ResolvedRoof {
  roofId: Id;
  typeId: Id;
  levelId: Id;
  planes: ResolvedRoofPlane[];
  lines: RoofLine[];
  layers: ResolvedRoofLayer[];
  /** Cota absoluta do beiral (nível + deslocamento). */
  eaveZ: number;
}

/** Cota absoluta da face superior do telhado em `p`, ou null fora de todas as águas. */
export function roofTopAt(r: ResolvedRoof, _p: Vec2): number | null {
  void r;
  return null;
}

/** IMPLEMENTAÇÃO PENDENTE (agente de motor): águas, linhas notáveis e camadas dos telhados de um nível. */
export function resolveRoofs(_p: Project, _levelId: Id): ResolvedRoof[] {
  return [];
}
