import { newId, openingFamilies, type OpeningFamily, type OpeningLeaves, type OpeningType } from '@hestia/model';

/** Famílias oferecidas ao tipo (portas ou janelas), na ordem da interface. */
export function familyOptionsFor(kind: OpeningType['kind']): OpeningFamily[] {
  return openingFamilies(kind);
}

/** Rótulo da contagem de folhas ("Vão livre (sem folha)", "1 folha", "2 folhas", "3 folhas"). */
export function leavesLabel(leaves: OpeningLeaves): string {
  if (leaves === 0) return 'Vão livre (sem folha)';
  return `${leaves} folha${leaves > 1 ? 's' : ''}`;
}

/** Opções de contagem de folhas aceitas pela família, com o rótulo da interface. */
export function leavesChoicesFor(family: OpeningFamily): Array<{ value: OpeningLeaves; label: string }> {
  return family.leaves.map((value) => ({ value, label: leavesLabel(value) }));
}

/** Aplica a família escolhida ao tipo: grava o símbolo e a 1ª contagem de folhas que ela aceita. */
export function applyFamily(t: OpeningType, family: OpeningFamily): OpeningType {
  return { ...t, plan: family.plan, leaves: family.leaves[0] ?? t.leaves };
}

/** Tipo novo a partir da família escolhida, com nome e medidas padrão da porta ou da janela. */
export function newOpeningTypeFromFamily(family: OpeningFamily): OpeningType {
  const door = family.kind === 'door';
  return {
    id: newId('ot'),
    kind: family.kind,
    name: door ? 'Nova porta' : 'Nova janela',
    code: '',
    description: '',
    width: door ? 0.8 : 1.2,
    height: door ? 2.1 : 1.2,
    sill: door ? 0 : 1.1,
    leaves: family.leaves[0] ?? 1,
    plan: family.plan,
    frameMaterialId: door ? 'mat_madeira' : 'mat_aluminio',
    glassMaterialId: 'mat_vidro',
    closure: 'inherit',
  };
}
