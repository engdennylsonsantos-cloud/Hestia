import type { Id, Project } from './types.ts';
import { isOpening, isWall } from './types.ts';
import { wallLength } from './queries.ts';
import { openingTypeById } from './openingNominal.ts';

/** Largura usada quando o tipo de abertura não existe (mesmo padrão de clampOffset e splitWall). */
const DEFAULT_WIDTH = 0.8;
const EPS = 1e-9;

/**
 * Troca a parede anfitriã de uma abertura (D7). Valida tudo antes de alterar: a nova anfitriã é uma parede
 * do mesmo nível, o vão cabe, fica inteiro dentro da parede e não se sobrepõe a outra abertura dela.
 * `offset` é a distância do centro da abertura ao início (a) da nova parede. Erro em texto = nada muda.
 */
export function setOpeningHost(p: Project, c: { id: Id; hostId: Id; offset: number }): void {
  const o = p.elements[c.id];
  if (!isOpening(o)) throw new Error('Abertura não encontrada');
  const host = p.elements[c.hostId];
  if (!isWall(host)) throw new Error('A nova anfitriã precisa ser uma parede');
  const current = p.elements[o.hostId];
  if (isWall(current) && current.levelId !== host.levelId) throw new Error('A nova parede precisa estar no mesmo nível');
  const width = openingTypeById(p, o.typeId)?.width ?? DEFAULT_WIDTH;
  const half = width / 2;
  const L = wallLength(host);
  if (!(L >= width)) throw new Error('A abertura não cabe nesta parede');
  // Negações escritas como comparações positivas: NaN também é rejeitado.
  if (!(Number.isFinite(c.offset) && c.offset - half >= -EPS && c.offset + half <= L + EPS)) {
    throw new Error('A abertura ficaria fora da parede');
  }
  for (const other of Object.values(p.elements).filter(isOpening)) {
    if (other.id === o.id || other.hostId !== host.id) continue;
    const oh = (openingTypeById(p, other.typeId)?.width ?? DEFAULT_WIDTH) / 2;
    if (c.offset + half > other.offset - oh + EPS && c.offset - half < other.offset + oh - EPS) {
      throw new Error('A abertura se sobreporia a outra abertura desta parede');
    }
  }
  p.elements[o.id] = { ...o, hostId: host.id, offset: c.offset };
}
