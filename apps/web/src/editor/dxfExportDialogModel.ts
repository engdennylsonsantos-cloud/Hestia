import { unitsOf, type Id, type Project } from '@hestia/model';
import type { DxfUnit } from '@hestia/io';
import type { DxfBatchGroup, DxfBatchTarget } from './dxfBatch.types.ts';

/**
 * Lógica pura do diálogo de exportação em lote (fase 4): unidade padrão, agrupamento da lista, alvo ativo e seleção
 * inicial. Fica fora do componente para ser testável sem React e para o diálogo só cuidar da tela.
 */

/** Unidades que o DXF entende, na ordem do seletor (o `$INSUNITS` de cada uma está em `DXF_UNITS`). */
export const DXF_UNIT_OPTIONS: ReadonlyArray<{ value: DxfUnit; label: string }> = [
  { value: 'mm', label: 'Milímetros (mm)' },
  { value: 'cm', label: 'Centímetros (cm)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'ft', label: 'Pés (ft)' },
  { value: 'in', label: 'Polegadas (in)' },
];

/** Unidade de saída padrão: a do desenho (unidade de comprimento do projeto). `ft-in` não tem `$INSUNITS` próprio e cai em ft. */
export function defaultDxfUnitOf(p: Pick<Project, 'settings'> | undefined): DxfUnit {
  const unit = unitsOf(p).length.unit;
  return unit === 'ft-in' ? 'ft' : unit;
}

/** Grupo do diálogo: rótulo e alvos na ordem do projeto. Grupo sem alvo não entra. */
export interface DxfGroupRow {
  group: DxfBatchGroup;
  label: string;
  targets: DxfBatchTarget[];
}

const GROUP_LABEL: Record<DxfBatchGroup, string> = {
  plantas: 'Plantas de piso',
  areas: 'Plantas de área',
  cortes: 'Cortes e elevações',
  pranchas: 'Pranchas',
};

const GROUP_ORDER: readonly DxfBatchGroup[] = ['plantas', 'areas', 'cortes', 'pranchas'];

/** Agrupa os alvos para a lista, mantendo a ordem dos grupos e a ordem de `targets` dentro de cada um. */
export function dxfGroupRows(targets: readonly DxfBatchTarget[]): DxfGroupRow[] {
  return GROUP_ORDER.map((group) => ({ group, label: GROUP_LABEL[group], targets: targets.filter((t) => t.group === group) })).filter((row) => row.targets.length > 0);
}

/** Estado do "marcar todos" de um grupo: todos, nenhum ou alguns. */
export function dxfGroupState(targets: readonly DxfBatchTarget[], selected: readonly string[], group: DxfBatchGroup): 'all' | 'none' | 'some' {
  const keys = targets.filter((t) => t.group === group).map((t) => t.key);
  if (keys.length === 0) return 'none';
  const chosen = keys.filter((k) => selected.includes(k)).length;
  return chosen === 0 ? 'none' : chosen === keys.length ? 'all' : 'some';
}

/** Estado da tela que interessa para achar o alvo ativo (subconjunto do `UiState`). */
export interface DxfActiveView {
  view: string;
  planKind: string;
  levelId: Id;
  areaPlanId: Id | null;
  sectionId: Id | null;
}

/**
 * Chave do alvo que está na tela, para o diálogo abrir com ele marcado. Prancha, 3D e planta de cobertura não têm DXF
 * próprio: devolve null e o diálogo cai na primeira planta.
 */
export function activeDxfTargetKey(ui: DxfActiveView): string | null {
  if (ui.view === 'plan' && ui.planKind === 'area' && ui.areaPlanId) return `area:${ui.areaPlanId}`;
  if (ui.view === 'section' && ui.sectionId) return `section:${ui.sectionId}`;
  if (ui.view === 'plan' && ui.planKind !== 'area' && ui.planKind !== 'roof') return `plan:${ui.levelId}`;
  return null;
}

/** Seleção inicial: o alvo ativo, se existir na lista; senão a primeira planta (ou o primeiro alvo de qualquer tipo). */
export function defaultDxfSelection(targets: readonly DxfBatchTarget[], activeKey: string | null): string[] {
  if (activeKey && targets.some((t) => t.key === activeKey)) return [activeKey];
  const first = targets.find((t) => t.group === 'plantas') ?? targets[0];
  return first ? [first.key] : [];
}
