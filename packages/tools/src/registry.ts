import type { Tool, ToolEnv } from './types.ts';
import { WallTool } from './wallTool.ts';
import { OpeningTool } from './openingTool.ts';
import { SelectTool } from './selectTool.ts';
import { ArrayTool, MirrorTool, MoveTool, RotateTool } from './transformTools.ts';
import { OffsetTool } from './offsetTool.ts';
import { AlignTool, MeasureTool, TrimTool } from './trimAlign.ts';
import { JoinTool } from './joinTool.ts';
import { SplitTool } from './splitTool.ts';
import { SectionTool } from './sectionTool.ts';
import { RehostTool } from './rehostTool.ts';
import { FloorTool } from './floorTool.ts';
import { SlabTool } from './slabTool.ts';
import { CeilingTool } from './ceilingTool.ts';
import { SlopeTool } from './slabSlopeTool.ts';
import { ParallelTool } from './parallelTool.ts';
import { RoofTool } from './roofTool.ts';
import { RoofExtrusionTool } from './roofExtrusionTool.ts';
import { RoofArrowTool } from './roofArrowTool.ts';
import { AttachRoofTool, DetachRoofTool } from './attachRoofTool.ts';
import { StairTool } from './stairTool.ts';
import { StairRunTool } from './stairRunTool.ts';
import { DimensionTool } from './dimensionTool.ts';
import { TextTool } from './textTool.ts';
import { RoomTool } from './roomTool.ts';
import { RoomSeparatorTool } from './roomSeparatorTool.ts';

export type ToolId = 'select' | 'wall' | 'floor' | 'slab' | 'ceiling' | 'slope' | 'door' | 'window' | 'move' | 'copy' | 'rotate' | 'mirror' | 'array' | 'offset' | 'parallel' | 'trim' | 'align' | 'joins' | 'split' | 'measure' | 'section' | 'rehost' | 'roof' | 'roofarrow' | 'roofextrusion' | 'attachroof' | 'detachroof' | 'stair' | 'stairrun' | 'dimension' | 'text' | 'room' | 'roomsep';

export const TOOL_GROUPS: Array<{ title: string; tools: ToolId[] }> = [
  { title: 'Construir', tools: ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'stair', 'stairrun', 'room'] },
  { title: 'Modificar', tools: ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'parallel', 'trim', 'align', 'joins', 'split', 'rehost', 'slope', 'attachroof', 'detachroof'] },
  { title: 'Anotar', tools: ['dimension', 'text'] },
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
    case 'slab':
      return new SlabTool(env);
    case 'ceiling':
      return new CeilingTool(env);
    case 'slope':
      return new SlopeTool(env);
    case 'roof':
      return new RoofTool(env);
    case 'roofarrow':
      return new RoofArrowTool(env);
    case 'roofextrusion':
      return new RoofExtrusionTool(env);
    case 'attachroof':
      return new AttachRoofTool(env);
    case 'detachroof':
      return new DetachRoofTool(env);
    case 'stair':
      return new StairTool(env);
    case 'stairrun':
      return new StairRunTool(env);
    case 'dimension':
      return new DimensionTool(env);
    case 'text':
      return new TextTool(env);
    case 'room':
      return new RoomTool(env);
    case 'roomsep':
      return new RoomSeparatorTool(env);
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
    case 'parallel':
      return new ParallelTool(env);
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
  slab: 'Laje',
  ceiling: 'Forro',
  roof: 'Telhado',
  slope: 'Inclinação',
  roofarrow: 'Seta de inclinação',
  roofextrusion: 'Telhado por extrusão',
  door: 'Porta',
  window: 'Janela',
  move: 'Mover',
  copy: 'Copiar',
  rotate: 'Girar',
  mirror: 'Espelhar',
  array: 'Matriz',
  offset: 'Deslocar',
  parallel: 'Parede paralela',
  trim: 'Aparar',
  align: 'Alinhar',
  joins: 'Junção',
  split: 'Dividir',
  measure: 'Medir',
  section: 'Corte',
  rehost: 'Trocar anfitriã',
  attachroof: 'Anexar topo',
  detachroof: 'Desanexar topo',
  stair: 'Escada por croqui',
  stairrun: 'Escada (reta/L/U/caracol)',
  dimension: 'Cota',
  text: 'Texto',
  room: 'Ambiente',
  roomsep: 'Separador de ambiente',
};

export const TOOL_SHORTCUT: Partial<Record<ToolId, string>> = {
  select: 'V',
  wall: 'W',
  floor: 'F',
  slab: 'B',
  roof: 'U',
  door: 'D',
  window: 'J',
  move: 'M',
  copy: 'C',
  rotate: 'R',
  mirror: 'S',
  array: 'A',
  offset: 'O',
  parallel: 'G',
  trim: 'T',
  align: 'L',
  joins: 'N',
  split: 'P',
  measure: 'E',
  section: 'K',
  rehost: 'H',
  stair: 'I',
  stairrun: 'Q',
  dimension: 'Y',
  text: 'X',
  room: 'Z',
};
