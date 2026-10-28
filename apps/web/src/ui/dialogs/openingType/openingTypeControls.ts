import type { OpeningType } from '@hestia/model';

/** Recuo do batente (m): zero tira o campo, que volta ao padrão por leitura (0). Preserva a âncora. */
export function setRevealDepth(t: OpeningType, depth: number): OpeningType {
  const next: OpeningType = { ...t };
  if (depth <= 0) delete next.reveal;
  else next.reveal = { ...t.reveal, depth };
  return next;
}
