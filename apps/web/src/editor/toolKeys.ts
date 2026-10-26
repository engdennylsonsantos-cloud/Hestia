import type { ShortcutCommand, ShortcutMap } from '@hestia/tools';

/** Comando cuja sequência é exatamente `seq` no mapa (sem diferenciar maiúsculas). Undefined se nenhum. */
export function comandoDaSequencia(seq: string, mapa: ShortcutMap): ShortcutCommand | undefined {
  const alvo = seq.toUpperCase();
  const hit = (Object.entries(mapa) as Array<[ShortcutCommand, string | undefined]>).find(([, sc]) => sc?.toUpperCase() === alvo);
  return hit?.[0];
}
