import { TOOL_LABEL, type ToolId } from './registry.ts';

/**
 * Atalhos padrão, em dados. Um comando é uma ferramenta do registro ou a tela de atalhos (`atalhos`).
 * A sequência é de letras e dígitos (ex.: `WA`); o usuário altera pela tela "Atalhos de teclado" e o app guarda a alteração.
 */
export type ShortcutCommand = ToolId | 'atalhos';
export type ShortcutProfile = 'revit' | 'simples';
export type ShortcutMap = Partial<Record<ShortcutCommand, string>>;

/**
 * Perfil Revit (padrão): sequências de duas letras, como no Revit (parede WA).
 * Selecionar não tem tecla: o Esc cancela o passo e volta à seleção.
 * As sequências livres de conflito dos comandos sem atalho no Revit: Extrusão de telhado (TE), Separador de ambiente (RS), Atalhos de teclado (KS).
 */
export const PERFIL_REVIT: ShortcutMap = {
  wall: 'WA', door: 'DR', window: 'WN', floor: 'SB', slab: 'LJ', ceiling: 'FR', slope: 'IN', roof: 'TL', roofarrow: 'SI', roofextrusion: 'TE',
  attachroof: 'AT', detachroof: 'DT', stair: 'ES', stairrun: 'LE', room: 'RM', roomsep: 'RS', dimension: 'DI', text: 'TX',
  move: 'MV', copy: 'CO', rotate: 'RO', mirror: 'MM', array: 'AR', offset: 'OF', parallel: 'PP', trim: 'TR', align: 'AL', joins: 'UG',
  split: 'SL', measure: 'ME', section: 'CT', rehost: 'TH', atalhos: 'KS',
  detailLine: 'DL', filledRegion: 'RP', tag: 'TG', grid: 'GR',
};

/**
 * Perfil simples: uma tecla por comando (as letras atuais do app).
 * Sem letra livre para as ferramentas novas (forro, inclinação, seta, extrusão, anexar/desanexar, separador de ambiente) e para o atalho da tela:
 * usam os dígitos 1 a 8, que não conflitam com as letras (o "K" da Corte impediria "KS" por prefixo).
 * Etiqueta (VT) e Grade (VG) dividem a letra V: acabaram as teclas livres, então as duas usam duas teclas.
 */
export const PERFIL_SIMPLES: ShortcutMap = {
  wall: 'W', floor: 'F', slab: 'B', roof: 'U', door: 'D', window: 'J', move: 'M', copy: 'C', rotate: 'R', mirror: 'S', array: 'A', offset: 'O',
  parallel: 'G', trim: 'T', align: 'L', joins: 'N', split: 'P', measure: 'E', section: 'K', rehost: 'H', stair: 'I', stairrun: 'Q',
  dimension: 'Y', text: 'X', room: 'Z',
  ceiling: '1', slope: '2', roofarrow: '3', roofextrusion: '4', attachroof: '5', detachroof: '6', roomsep: '7', atalhos: '8',
  detailLine: '9', filledRegion: '0', tag: 'VT', grid: 'VG',
};

export const SHORTCUT_PROFILES: Record<ShortcutProfile, ShortcutMap> = { revit: PERFIL_REVIT, simples: PERFIL_SIMPLES };

export const PERFIL_PADRAO: ShortcutProfile = 'revit';

export const PERFIL_NOMES: Record<ShortcutProfile, string> = { revit: 'Revit (duas letras)', simples: 'Simples (uma tecla)' };

/** Todos os comandos que podem ter atalho (exceto Selecionar, que não tem tecla). */
export const COMANDOS_COM_ATALHO: ShortcutCommand[] = [
  ...(Object.keys(TOOL_LABEL) as ToolId[]).filter((id) => id !== 'select'),
  'atalhos',
];

/** Nome de exibição de um comando (rótulo da ferramenta, ou o da tela de atalhos). */
export function nomeComando(cmd: ShortcutCommand): string {
  return cmd === 'atalhos' ? 'Atalhos de teclado' : TOOL_LABEL[cmd];
}
