import type { Id } from './types.ts';
import {
  OPENING_PROFILE_PRESETS,
  PROFILE_MATERIAL_IDS,
  type ProfileMaterial,
  type ProfilePreset,
  type ProfileRef,
  type ProfileSpec,
  type Rect,
} from './openingComposition.ts';

/** Perfil usado na migração e como reserva quando o preset some: madeira batente 5×9 (padrão do Hestia). */
export const FALLBACK_PROFILE_ID = 'prf_mad_batente_5x9';

const cloneSpec = (s: ProfileSpec): ProfileSpec => ({ ...s, ...(s.glassRebate ? { glassRebate: { ...s.glassRebate } } : {}) });
const clonePreset = (p: ProfilePreset): ProfilePreset => ({ ...p, roles: [...p.roles], spec: cloneSpec(p.spec), confirmed: [...p.confirmed] });

/** Os presets iniciais como mapa por id (cópia: o projeto pode editá-los sem mexer na semente). */
export function defaultOpeningProfiles(): Record<Id, ProfilePreset> {
  return Object.fromEntries(OPENING_PROFILE_PRESETS.map((p) => [p.id, clonePreset(p)]));
}

/** Presets do projeto; o que faltar (projeto sem o mapa, ou preset apagado) vale o da semente. */
export function openingProfilesOf(p: { openingProfiles?: Record<Id, ProfilePreset> }): Readonly<Record<Id, ProfilePreset>> {
  return { ...defaultOpeningProfiles(), ...(p.openingProfiles ?? {}) };
}

const DEFAULT_MAP = defaultOpeningProfiles();

/** Perfil efetivo de uma referência: inline vale como está; preset recebe o `override`. Preset ausente cai no 5×9. */
export function resolveProfile(r: ProfileRef, presets: Readonly<Record<Id, ProfilePreset>> = DEFAULT_MAP): ProfileSpec {
  if ('inline' in r) return cloneSpec(r.inline);
  const base = (presets[r.presetId] ?? DEFAULT_MAP[r.presetId] ?? DEFAULT_MAP[FALLBACK_PROFILE_ID]!).spec;
  const o = r.override ?? {};
  const spec: ProfileSpec = { ...base, ...o };
  if (o.glassRebate || base.glassRebate) spec.glassRebate = { ...(base.glassRebate ?? { depth: 0, clearance: 0, bead: 0 }), ...(o.glassRebate ?? {}) };
  return cloneSpec(spec);
}

/** Material de perfil para um material lógico do projeto (aço vira alumínio até a rodada de aço; desconhecido, madeira). */
export function profileMaterialOf(materialId: Id | undefined): ProfileMaterial {
  const hit = (Object.keys(PROFILE_MATERIAL_IDS) as ProfileMaterial[]).find((k) => PROFILE_MATERIAL_IDS[k] === materialId);
  if (hit) return hit;
  return materialId === 'mat_aco' ? 'aluminum' : 'wood';
}

/** Placa de vidro no rebaixo (spec §5): luz + `max(0, depth − clearance)` por borda; perfil sem rebaixo = a própria luz. */
export function glassPlateRect(luz: Rect, profile: ProfileSpec): Rect {
  const r = profile.glassRebate;
  const e = r ? Math.max(0, r.depth - r.clearance) : 0;
  return { t0: luz.t0 - e, t1: luz.t1 + e, z0: luz.z0 - e, z1: luz.z1 + e };
}
