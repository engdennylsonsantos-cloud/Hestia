import { DEFAULT_AREA_GRAPHICS, type AreaPlan, type AreaPlanGraphics } from './areaPlan.ts';

/** Camadas de desenho de uma vista de planta (espelha o `PlanProfile` do render, sem depender dele). */
export interface ProfileLayers {
  walls: 'light' | 'normal' | 'hidden';
  openings: boolean;
  floors: boolean;
  dimensions: boolean;
  texts: boolean;
  detail: boolean;
  tags: boolean;
  grids: boolean;
  sectionMarks: boolean;
  rooms: boolean;
  referenceLines: boolean;
  underlay: boolean;
  roofProjection: boolean;
}

/** Id de preset registrado em código. Planta de piso é o perfil implícito (constante, nunca migrado). */
export type ProfileBase = 'floor' | 'area';

/** Perfil resolvido: nunca tem campo indefinido. É a fonte única para render, hit-test, DXF e painel. */
export interface ResolvedProfile {
  base: ProfileBase;
  scale: number;
  /** Gráficos completos (merge profundo sobre o preset). */
  graphics: AreaPlanGraphics;
  layers: ProfileLayers;
}

export const FLOOR_PROFILE_LAYERS: ProfileLayers = {
  walls: 'normal', openings: true, floors: true, dimensions: true, texts: true, detail: true, tags: true,
  grids: true, sectionMarks: true, rooms: true, referenceLines: false, underlay: true, roofProjection: true,
};

export const DEFAULT_AREA_SCALE = 50;

/** Presets em código (versionáveis sem migrar arquivos). */
export const PROFILE_PRESETS: Record<ProfileBase, { scale: number; graphics: AreaPlanGraphics }> = {
  floor: { scale: DEFAULT_AREA_SCALE, graphics: DEFAULT_AREA_GRAPHICS },
  area: { scale: DEFAULT_AREA_SCALE, graphics: DEFAULT_AREA_GRAPHICS },
};

/** Merge profundo defensivo: `graphics` parcial/inválido cai no padrão campo a campo (inclui `tagDefault`). */
export function mergeAreaGraphics(g: Partial<AreaPlanGraphics> | null | undefined): AreaPlanGraphics {
  const src: Partial<AreaPlanGraphics> = g && typeof g === 'object' ? g : {};
  const td: Partial<AreaPlanGraphics['tagDefault']> = src.tagDefault && typeof src.tagDefault === 'object' ? src.tagDefault : {};
  const def = DEFAULT_AREA_GRAPHICS;
  const defined = Object.fromEntries(Object.entries(src).filter(([, v]) => v !== undefined)) as Partial<AreaPlanGraphics>;
  return {
    ...def,
    ...defined,
    tagDefault: {
      leader: td.leader ?? def.tagDefault.leader,
      orientation: td.orientation ?? def.tagDefault.orientation,
      fields: Array.isArray(td.fields) ? [...td.fields] : [...def.tagDefault.fields],
    },
  };
}

/** Camadas de uma planta de área a partir dos gráficos (igual ao antigo `areaPlanProfile` do render). */
export function areaLayersOf(g: AreaPlanGraphics): ProfileLayers {
  return {
    walls: g.showWalls,
    openings: g.showOpenings,
    floors: g.showFloors,
    dimensions: g.showDimensions,
    texts: g.showAnnotations,
    detail: g.showAnnotations,
    tags: g.showAnnotations,
    grids: g.showGrids === true,
    sectionMarks: g.showSectionMarks === true,
    rooms: true,
    referenceLines: g.referenceLines !== 'never',
    underlay: g.showBelowLevel,
    roofProjection: false,
  };
}

/** Única fonte do perfil de uma planta de área: preset `area` <- dados da planta, sem valores indefinidos. */
export function resolveViewProfile(plan: Partial<Pick<AreaPlan, 'graphics' | 'scale'>> | null | undefined): ResolvedProfile {
  const preset = PROFILE_PRESETS.area;
  const graphics = mergeAreaGraphics(plan?.graphics);
  const scale = plan && typeof plan.scale === 'number' && Number.isFinite(plan.scale) && plan.scale > 0 ? plan.scale : preset.scale;
  return { base: 'area', scale, graphics, layers: areaLayersOf(graphics) };
}

/** Perfil da planta de piso: constante (identidade), não é dado. */
export const resolveFloorProfile = (): ResolvedProfile => ({
  base: 'floor', scale: PROFILE_PRESETS.floor.scale, graphics: PROFILE_PRESETS.floor.graphics, layers: FLOOR_PROFILE_LAYERS,
});
