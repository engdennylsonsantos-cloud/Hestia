import { intersection, multiArea, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { isStair, type Id, type Project, type ValidationIssue } from '@hestia/model';
import { resolveFloors } from './floors.ts';
import { makeStairIssue, type StairIssueItem } from './stairIssues.ts';
import { resolveStairs, type ResolvedStair } from './stairs.ts';
import { resolveSlabs, slabRiseAt } from './slabs.ts';
import { stairWallOverlapIssues } from './stairWallOverlap.ts';

/**
 * Avisos que dependem da geometria das lajes e pisos do nível de topo (`stair-headroom`). Ficam fora de `stairs.ts`:
 * `resolveFloors` e `resolveSlabs` já chamam `resolveStairs` para o furo (decisão 0011 §1 item 11), então o aviso não
 * pode entrar na resolução da escada sem ciclo.
 */

/** Tolerância (m) nas comparações de folga, e área mínima (m²) para contar sobreposição entre degrau e laje. */
const EPS = 1e-9;
const EPS_AREA = 1e-6;

const num = (n: number, digits: number): string => n.toFixed(digits).replace('.', ',');

/** Elemento do nível de topo: contorno resolvido (já com os furos das escadas) e cota da face inferior em cada ponto. */
export interface TopCover {
  polygon: MultiPolygon;
  underside: (v: Vec2) => number;
}

/** Lajes e pisos do nível, como `resolveSlabs`/`resolveFloors` entregam (furo derivado incluso). */
export function topCovers(p: Project, levelId: Id): TopCover[] {
  return [
    ...resolveFloors(p, levelId).map((f): TopCover => ({ polygon: f.polygon, underside: () => f.bottomZ })),
    ...resolveSlabs(p, levelId).map((s): TopCover => ({ polygon: s.polygon, underside: (v) => s.bottomZ + slabRiseAt(s.slope, v) })),
  ];
}

/**
 * Folga de cabeça (decisão 0011 §1 item 10): para cada degrau ou patamar sob uma laje ou piso do nível de topo, a folga
 * é a cota da face inferior menos a cota do topo do degrau (no pior ponto da sobreposição). Se a menor for menor que
 * `minHeadroom` do tipo, um aviso. Com a abertura ligada, o furo já tira da laje os degraus com folga até o pé-direito
 * do modo (`openingHeadroom`, ou o mínimo do tipo): o que sobra tem folga maior, então sem aviso. Com `openingHeadroom`
 * abaixo do mínimo do tipo, os degraus entre os dois valores ficam sob a laje e avisam.
 */
export function stairHeadroomIssue(rs: ResolvedStair, covers: TopCover[]): StairIssueItem | null {
  let worst: { h: number; ci: number } | null = null;
  for (const st of rs.steps) {
    for (const c of covers) {
      for (const piece of intersection(c.polygon, [[st.polygon]])) {
        const ring = piece[0];
        if (!ring || ring.length < 3 || multiArea([piece]) < EPS_AREA) continue;
        for (const v of ring) {
          const h = c.underside(v) - st.z;
          if (!worst || h < worst.h) worst = { h, ci: st.componentIndex };
        }
      }
    }
  }
  if (!worst || worst.h >= rs.type.minHeadroom - EPS) return null;
  return makeStairIssue(
    rs.id,
    'stair-headroom',
    'warning',
    `Folga de cabeça de ${num(worst.h, 2)} m menor que a mínima do tipo (${num(rs.type.minHeadroom, 2)} m) sob a laje.`,
    worst.ci,
  );
}

/** Todos os avisos e erros das escadas: os de `resolveStairs`, `stair-headroom` e `stair-wall-overlap`. */
export function stairIssueList(p: Project): StairIssueItem[] {
  const covers = new Map<Id, TopCover[]>();
  const resolved = resolveStairs(p);
  const out = resolved.flatMap((r) => {
    const list = [...r.issues];
    if (r.topLevelId) {
      let coversOnLevel = covers.get(r.topLevelId);
      if (!coversOnLevel) {
        coversOnLevel = topCovers(p, r.topLevelId);
        covers.set(r.topLevelId, coversOnLevel);
      }
      const h = stairHeadroomIssue(r, coversOnLevel);
      if (h) list.push(h);
    }
    return list;
  });
  out.push(...stairWallOverlapIssues(p, resolved));
  return out;
}

/**
 * Avisos de uma só escada: o mesmo que `stairIssueList(p).filter((i) => i.stairId === id)`, sem resolver as outras. A criação
 * usa isto para não resolver todas as escadas do projeto só para achar o aviso da nova. A invasão de parede é conferida só
 * contra esta escada; as paredes continuam vindo do projeto inteiro, como na lista.
 */
export function stairIssuesOf(p: Project, id: Id): StairIssueItem[] {
  const e = p.elements[id];
  if (!isStair(e)) return [];
  const [r] = resolveStairs({ ...p, elements: { [id]: e } });
  if (!r) return [];
  const list = [...r.issues];
  if (r.topLevelId) {
    const h = stairHeadroomIssue(r, topCovers(p, r.topLevelId));
    if (h) list.push(h);
  }
  list.push(...stairWallOverlapIssues(p, [r]));
  return list;
}

/** Aviso no formato do painel, com os ids da relação (quando houver) além do `elementId`. */
export type StairValidationIssue = ValidationIssue & { ids?: string[] };

/** Os mesmos avisos no formato do painel (`ValidationIssue`, com `elementId` = id da escada e `ids` da relação). */
export function stairValidationIssues(p: Project): StairValidationIssue[] {
  return stairIssueList(p).map((i) => ({
    severity: i.severity,
    code: i.code,
    message: i.message,
    elementId: i.stairId,
    ...(i.ids ? { ids: i.ids } : {}),
  }));
}
