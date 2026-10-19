import { dist, lerp } from '@hestia/geom';
import type { Command } from './commands.ts';
import { DEFAULT_JOIN } from './wall.ts';
import { splitProfile } from './profile.ts';
import { isOpening, isWall, type Opening, type Project, type Wall } from './types.ts';

const EPS = 1e-9;
/** Largura usada quando o tipo de abertura não existe (mesmo padrão de clampOffset). */
const DEFAULT_WIDTH = 0.8;

/**
 * Divide uma parede reta em duas (Revit: Split Wall / Split with Gap).
 * `t` é a distância ao longo de a→b a partir de `a`. Com `gap`, o trecho [t−gap/2, t+gap/2] é removido.
 * A original vai de `a` até t−gap/2; a nova (`newId`) vai de t+gap/2 até `b`.
 * Aberturas com centro antes do corte ficam na original; as depois, na nova (offset recalculado);
 * as que não cabem no novo comprimento, ou caem no intervalo removido, são apagadas.
 * Tudo ocorre dentro de um único `produce`: se a validação falhar, o projeto não muda.
 */
export function splitWall(p: Project, c: Extract<Command, { type: 'splitWall' }>): void {
  const w = p.elements[c.id];
  if (!isWall(w)) throw new Error('Parede não encontrada');
  if (w.sag !== 0) throw new Error('Dividir parede curva ainda não é suportado');
  if (p.elements[c.newId]) throw new Error('Identificador da nova parede já existe');

  const gap = c.gap ?? 0;
  const L = dist(w.a, w.b);
  const lo = c.t - gap / 2;
  const hi = c.t + gap / 2;
  // Negações escritas como comparações positivas: NaN também é rejeitado.
  if (!(gap >= 0 && lo > EPS && hi < L - EPS)) throw new Error('Ponto de corte inválido para esta parede');

  const a = { x: w.a.x, y: w.a.y };
  const b = { x: w.b.x, y: w.b.y };
  const cutStart = lerp(a, b, lo / L);
  const cutEnd = lerp(a, b, hi / L);
  const newLen = L - hi;

  for (const o of Object.values(p.elements).filter(isOpening).filter((x) => x.hostId === w.id)) {
    const half = (p.openingTypes[o.typeId]?.width ?? DEFAULT_WIDTH) / 2;
    if (o.offset < lo) {
      // Fica na original: só cabe se o vão terminar antes do novo fim.
      if (o.offset - half < -EPS || o.offset + half > lo + EPS) delete p.elements[o.id];
      continue;
    }
    const off = o.offset - hi;
    if (o.offset >= hi && off - half >= -EPS && off + half <= newLen + EPS) {
      moveOpening(p, o, c.newId, off, c.idMap?.[o.id] ?? o.id);
    } else {
      delete p.elements[o.id];
    }
  }

  const joinEnd = { ...w.joinEnd };
  const noJoinEnd = w.noJoinEnd;
  const [profL, profR] = w.topProfile ? splitProfile(w.topProfile, lo, hi) : [null, null];
  const right: Wall = {
    ...w,
    topProfile: profR,
    id: c.newId,
    a: cutEnd,
    b,
    joinStart: { ...DEFAULT_JOIN },
    noJoinStart: false,
    joinEnd,
    noJoinEnd,
    order: p.nextOrder++,
  };
  p.elements[c.newId] = right;

  w.b = cutStart;
  w.topProfile = profL;
  w.joinEnd = { ...DEFAULT_JOIN };
  w.noJoinEnd = false;
}

function moveOpening(p: Project, o: Opening, hostId: string, offset: number, newOpeningId: string): void {
  if (newOpeningId !== o.id && p.elements[newOpeningId]) throw new Error('Identificador de abertura já existe');
  delete p.elements[o.id];
  p.elements[newOpeningId] = { ...o, id: newOpeningId, hostId, offset };
}
