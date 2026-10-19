import type { Tool, ToolEnv } from './types.ts';
import { WallTool } from './wallTool.ts';
import { OpeningTool } from './openingTool.ts';
import { SelectTool } from './selectTool.ts';
import { ArrayTool, MirrorTool, MoveTool, OffsetTool, RotateTool } from './transformTools.ts';
import { AlignTool, MeasureTool, TrimTool } from './trimAlign.ts';
import { JoinTool } from './joinTool.ts';
import { SplitTool } from './splitTool.ts';
import { SectionTool } from './sectionTool.ts';
import { RehostTool } from './rehostTool.ts';
import { FloorTool } from './floorTool.ts';

export type ToolId = 'select' | 'wall' | 'floor' | 'door' | 'window' | 'move' | 'copy' | 'rotate' | 'mirror' | 'array' | 'offset' | 'trim' | 'align' | 'joins' | 'split' | 'measure' | 'section' | 'rehost';

export const TOOL_GROUPS: Array<{ title: string; tools: ToolId[] }> = [
  { title: 'Construir', tools: ['wall', 'door', 'window', 'floor'] },
  { title: 'Modificar', tools: ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'trim', 'align', 'joins', 'split', 'rehost'] },
  { title: 'Medir', tools: ['measure'] },
];

export function createTool(id: ToolId, env: ToolEnv): Tool {
  switch (id) {
    case 'select':
      return new SelectTool(env);
    case 'wall':
      return new WallTool(env);
    case 'floor':
      return new FloorTool(env);
    case 'door':
      return new OpeningTool(env, 'door');
    case 'window':
      return new OpeningTool(env, 'window');
    case 'move':
      return new MoveTool(env, false);
    case 'copy':
      return new MoveTool(env, true);
    case 'rotate':
      return new RotateTool(env);
    case 'mirror':
      return new MirrorTool(env);
    case 'array':
      return new ArrayTool(env);
    case 'offset':
      return new OffsetTool(env);
    case 'trim':
      return new TrimTool(env);
    case 'align':
      return new AlignTool(env);
    case 'joins':
      return new JoinTool(env);
    case 'split':
      return new SplitTool(env);
    case 'measure':
      return new MeasureTool(env);
    case 'rehost':
      return new RehostTool(env);
    case 'section':
      return new SectionTool(env);
  }
}

export const TOOL_LABEL: Record<ToolId, string> = {
  select: 'Selecionar',
  wall: 'Parede',
  floor: 'Piso',
  door: 'Porta',
  window: 'Janela',
  move: 'Mover',
  copy: 'Copiar',
  rotate: 'Girar',
  mirror: 'Espelhar',
  array: 'Matriz',
  offset: 'Deslocar',
  trim: 'Aparar',
  align: 'Alinhar',
  joins: 'Junção',
  split: 'Dividir',
  measure: 'Medir',
  section: 'Corte',
  rehost: 'Trocar anfitriã',
};

export const TOOL_SHORTCUT: Partial<Record<ToolId, string>> = {
  select: 'V',
  wall: 'W',
  floor: 'F',
  door: 'D',
  window: 'J',
  move: 'M',
  copy: 'C',
  rotate: 'R',
  mirror: 'S',
  array: 'A',
  offset: 'O',
  trim: 'T',
  align: 'L',
  joins: 'N',
  split: 'P',
  measure: 'E',
  section: 'K',
  rehost: 'H',
};
