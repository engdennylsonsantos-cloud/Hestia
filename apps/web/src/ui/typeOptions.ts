import type { Project } from '@hestia/model';
import { FAMILY, openingFamilyName } from './typeFamilies.ts';
import type { TypeOption } from './TypeSelector.tsx';

/** Opções do seletor de tipo de cada categoria: a lista, a família de agrupamento e o que a prévia desenha. */

export function wallOptions(p: Project): TypeOption[] {
  return Object.values(p.wallTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.wall, subject: { kind: 'wall', type: t, materials: p.materials } }));
}

export function floorOptions(p: Project): TypeOption[] {
  return Object.values(p.floorTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.floor, subject: { kind: 'floor', type: t, materials: p.materials } }));
}

export function slabOptions(p: Project): TypeOption[] {
  return Object.values(p.slabTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.slab, subject: { kind: 'slab', type: t, materials: p.materials } }));
}

export function ceilingOptions(p: Project): TypeOption[] {
  return Object.values(p.ceilingTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.ceiling, subject: { kind: 'ceiling', type: t, materials: p.materials } }));
}

export function roofOptions(p: Project): TypeOption[] {
  return Object.values(p.roofTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.roof, subject: { kind: 'roof', type: t, materials: p.materials } }));
}

export function stairOptions(p: Project): TypeOption[] {
  return Object.values(p.stairTypes).map((t) => ({ id: t.id, name: t.name, code: t.code, family: FAMILY.stair, subject: { kind: 'stair', type: t } }));
}

/** Portas (kind `door`) ou janelas (`window`), com a família do símbolo de planta (Porta de giro, Janela de correr…). */
export function openingOptions(p: Project, kind: 'door' | 'window'): TypeOption[] {
  return Object.values(p.openingTypes)
    .filter((t) => t.kind === kind)
    .map((t) => ({ id: t.id, name: t.name, code: t.code ?? '', family: openingFamilyName(t), subject: { kind, type: t } }));
}
