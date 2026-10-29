import type { ReactElement, ReactNode } from 'react';
import { openingFamilies, openingFamilyOf, type OpeningType } from '@hestia/model';
import { DEFAULT_RAMP_OPTIONS } from '@hestia/tools';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { TypeRow } from '../TypeRow.tsx';
import { FAMILY } from '../typeFamilies.ts';
import { Node } from './Tree.tsx';

/** Seção "Famílias": Categoria ▸ Família ▸ Tipo, em ordem alfabética como no Revit. */

/** Agrupa os tipos de abertura por família (um nó por família); dentro do grupo, ordena pelo código. */
function openingGroups(kind: 'door' | 'window', types: OpeningType[]): Array<{ id: string; name: string; types: OpeningType[] }> {
  const byCode = (t: OpeningType): string => t.code ?? t.name;
  const groups: Array<{ id: string; name: string; types: OpeningType[] }> = [];
  for (const f of openingFamilies(kind)) {
    const items = types.filter((t) => openingFamilyOf(t)?.id === f.id);
    if (items.length) groups.push({ id: f.id, name: f.name, types: items });
  }
  const orphans = types.filter((t) => !openingFamilyOf(t));
  if (orphans.length) groups.push({ id: 'outros', name: 'Outros', types: orphans });
  for (const g of groups) g.types.sort((a, b) => byCode(a).localeCompare(byCode(b), 'pt-BR'));
  return groups;
}

function Category({ id, name, open = false, children }: { id: string; name: string; open?: boolean; children: ReactNode }): ReactElement {
  return <Node id={`cat:${id}`} label={name} group open={open}>{children}</Node>;
}

export function FamiliesTree(): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState((st) => ({ options: { ...st.options, ...patch } }));
  const dialog = (d: 'wallType' | 'floorType' | 'slabType' | 'ceilingType' | 'roofType' | 'stairType' | 'rampType' | 'openingType', id: string): void => useUi.setState({ dialog: d, dialogArg: id });
  const doors = Object.values(p.openingTypes).filter((t) => t.kind === 'door');
  const windows = Object.values(p.openingTypes).filter((t) => t.kind === 'window');

  const openings = (kind: 'door' | 'window', types: OpeningType[], activeId: string, key: 'doorTypeId' | 'windowTypeId'): ReactElement[] =>
    openingGroups(kind, types).map((g) => (
      <Node key={g.id} id={`fam:${kind}:${g.id}`} label={g.name} group>
        {g.types.map((t) => (
          <TypeRow key={t.id} kind={kind} typeId={t.id} name={t.name} icon={kind} active={activeId === t.id} onUse={() => set({ [key]: t.id })} onEdit={() => dialog('openingType', t.id)} />
        ))}
      </Node>
    ));

  return (
    <Node id="g:families" label="Famílias" icon="layers" group open>
      <Category id="stair" name="Escadas">
        <Node id="fam:stair" label={FAMILY.stair} group>
          {Object.values(p.stairTypes).map((t) => (
            <TypeRow key={t.id} kind="stair" typeId={t.id} name={t.name} icon="stair" active={o.stair?.typeId === t.id} onUse={() => set({ stair: { ...o.stair, typeId: t.id } })} onEdit={() => dialog('stairType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="ramp" name="Rampas">
        <Node id="fam:ramp" label={FAMILY.stair} group>
          {Object.values(p.rampTypes).map((t) => (
            <TypeRow key={t.id} kind="ramp" typeId={t.id} name={t.name} icon="ramp" active={o.ramp?.typeId === t.id} onUse={() => set({ ramp: { ...(o.ramp ?? DEFAULT_RAMP_OPTIONS), typeId: t.id } })} onEdit={() => dialog('rampType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="ceiling" name="Forros">
        <Node id="fam:ceiling" label={FAMILY.ceiling} group>
          {Object.values(p.ceilingTypes).map((t) => (
            <TypeRow key={t.id} kind="ceiling" typeId={t.id} name={t.name} icon="ceiling" active={o.ceilingTypeId === t.id} onUse={() => set({ ceilingTypeId: t.id })} onEdit={() => dialog('ceilingType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="window" name="Janelas">{openings('window', windows, o.windowTypeId, 'windowTypeId')}</Category>
      <Category id="slab" name="Lajes">
        <Node id="fam:slab" label={FAMILY.slab} group>
          {Object.values(p.slabTypes).map((t) => (
            <TypeRow key={t.id} kind="slab" typeId={t.id} name={t.name} icon="slab" active={o.slabTypeId === t.id} onUse={() => set({ slabTypeId: t.id })} onEdit={() => dialog('slabType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="wall" name="Paredes" open>
        <Node id="fam:wall" label={FAMILY.wall} group open>
          {Object.values(p.wallTypes).map((t) => (
            <TypeRow key={t.id} kind="wall" typeId={t.id} name={t.name} icon="wall" active={o.wallTypeId === t.id} onUse={() => set({ wallTypeId: t.id })} onEdit={() => dialog('wallType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="floor" name="Pisos">
        <Node id="fam:floor" label={FAMILY.floor} group>
          {Object.values(p.floorTypes).map((t) => (
            <TypeRow key={t.id} kind="floor" typeId={t.id} name={t.name} icon="floor" active={o.floorTypeId === t.id} onUse={() => set({ floorTypeId: t.id })} onEdit={() => dialog('floorType', t.id)} />
          ))}
        </Node>
      </Category>
      <Category id="door" name="Portas">{openings('door', doors, o.doorTypeId, 'doorTypeId')}</Category>
      <Category id="roof" name="Telhados">
        <Node id="fam:roof" label={FAMILY.roof} group>
          {Object.values(p.roofTypes).map((t) => (
            <TypeRow key={t.id} kind="roof" typeId={t.id} name={t.name} icon="roof" active={o.roofTypeId === t.id} onUse={() => set({ roofTypeId: t.id })} onEdit={() => dialog('roofType', t.id)} />
          ))}
        </Node>
      </Category>
    </Node>
  );
}
