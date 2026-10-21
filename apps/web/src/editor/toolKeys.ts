import { TOOL_SHORTCUT, type ToolId } from '@hestia/tools';

/** Ferramenta cuja tecla (letra sem modificador) é `k`, pelo mapa `TOOL_SHORTCUT` do registro. Undefined se nenhuma. */
export function toolForKey(k: string): ToolId | undefined {
  const key = k.toLowerCase();
  const hit = (Object.entries(TOOL_SHORTCUT) as Array<[ToolId, string | undefined]>).find(([, sc]) => sc?.toLowerCase() === key);
  return hit?.[0];
}
