import { useUi, type DialogKind } from '../editor/state.ts';
import { useProject } from '../editor/controller.ts';
import { stairTypeId } from '@hestia/tools';
import type { ReactElement } from 'react';
import { TypeSelector } from './TypeSelector.tsx';
import { floorOptions, ceilingOptions, openingOptions, roofOptions, slabOptions, stairOptions, wallOptions } from './typeOptions.ts';
import { setStairOpt } from './StairOptionsBar.tsx';

/** Ferramentas de colocação com tipo: a paleta mostra o tipo escolhido antes de desenhar (o mesmo valor da barra de opções). */
export type ToolTypeKind = 'wall' | 'door' | 'window' | 'floor' | 'slab' | 'ceiling' | 'roof' | 'stair';
const TOOL_TYPE_LABEL: Record<ToolTypeKind, string> = {
  wall: 'Colocar Parede',
  door: 'Colocar Porta',
  window: 'Colocar Janela',
  floor: 'Colocar Piso',
  slab: 'Colocar Laje',
  ceiling: 'Colocar Forro',
  roof: 'Colocar Telhado',
  stair: 'Colocar Escada',
};

export function isToolTypeKind(tool: string): tool is ToolTypeKind {
  return tool in TOOL_TYPE_LABEL;
}

/** Seletor de tipo da ferramenta ativa, sem seleção: lê e grava o tipo nas opções, como a barra de opções faz. */
export function ToolTypeProps({ tool }: { tool: ToolTypeKind }): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const setOpt = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  const categoryLabel = TOOL_TYPE_LABEL[tool];
  const edit = (dialog: DialogKind, id: string | undefined): void => {
    if (id) useUi.setState({ dialog, dialogArg: id });
  };
  switch (tool) {
    case 'wall':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-walltype" label="Tipo de parede" options={wallOptions(p)} selectedId={o.wallTypeId ?? null}
          onSelect={(id) => setOpt({ wallTypeId: id })} onEdit={() => edit('wallType', o.wallTypeId)} />
      );
    case 'door':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-opentype" label="Tipo de abertura" options={openingOptions(p, 'door')} selectedId={o.doorTypeId ?? null}
          favoriteIds={p.settings.favoriteOpeningTypes ?? []} onSelect={(id) => setOpt({ doorTypeId: id })} onEdit={() => edit('openingType', o.doorTypeId)} />
      );
    case 'window':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-opentype" label="Tipo de abertura" options={openingOptions(p, 'window')} selectedId={o.windowTypeId ?? null}
          favoriteIds={p.settings.favoriteOpeningTypes ?? []} onSelect={(id) => setOpt({ windowTypeId: id })} onEdit={() => edit('openingType', o.windowTypeId)} />
      );
    case 'floor':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-floortype" label="Tipo de piso" options={floorOptions(p)} selectedId={o.floorTypeId ?? null}
          onSelect={(id) => setOpt({ floorTypeId: id })} onEdit={() => edit('floorType', o.floorTypeId)} />
      );
    case 'slab':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-slabtype" label="Tipo de laje" options={slabOptions(p)} selectedId={o.slabTypeId ?? null}
          onSelect={(id) => setOpt({ slabTypeId: id })} onEdit={() => edit('slabType', o.slabTypeId)} />
      );
    case 'ceiling':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-ceilingtype" label="Tipo de forro" options={ceilingOptions(p)} selectedId={o.ceilingTypeId ?? null}
          onSelect={(id) => setOpt({ ceilingTypeId: id })} onEdit={() => edit('ceilingType', o.ceilingTypeId)} />
      );
    case 'roof':
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-rooftype" label="Tipo de telhado" options={roofOptions(p)} selectedId={o.roofTypeId ?? null}
          onSelect={(id) => setOpt({ roofTypeId: id })} onEdit={() => edit('roofType', o.roofTypeId)} />
      );
    case 'stair': {
      const sid = stairTypeId(p, o.stair?.typeId) ?? '';
      return (
        <TypeSelector categoryLabel={categoryLabel} triggerId="prop-stairtype" label="Tipo de escada" options={stairOptions(p)} selectedId={sid || null}
          onSelect={(id) => setStairOpt({ typeId: id })} onEdit={() => edit('stairType', sid)} />
      );
    }
  }
}

