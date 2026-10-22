import { arcFromSagitta, arcLocal, arcTangentAt, cross, dist, dot, len, norm, sub, type Arc, type Vec2 } from '@hestia/geom';
import { totalThickness } from './wallType.ts';
import type { ValidationIssue } from './validate.ts';
import type { Project, Wall } from './types.ts';

/** Tolerância de encontro das pontas (mesma do motor: Project.settings.joinTolerance padrão). */
const JOIN_TOL = 0.02;
/** Domínio suportado das junções curvas (docs/08 §6.5). */
const MIN_RADIUS = 3;
const MIN_CORNER_DEG = 60;
const MAX_CORNER_DEG = 120;
/** Correntes tangentes entram como continuidade até 10° de deflexão (docs/08 §6.5). */
const TANGENT_KINK_DEG = 10;
const DEG = 180 / Math.PI;

const label = (w: Wall): string => (w.mark ? `"${w.mark}" (${w.id})` : `"${w.id}"`);
const fmt = (n: number): string => n.toFixed(2).replace('.', ',');

/** Distância de um ponto ao segmento a–b. */
function distToSegment(pt: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return dist(pt, a);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
  return dist(pt, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Pontas com "não unir" ligado que caem dentro do corpo de outra parede do mesmo nível: nada recorta a ponta contra
 * a outra, então as duas se sobrepõem (decide só a prioridade das camadas). É o caso típico de junção esquecida
 * desligada. Parede curva usa a corda como aproximação.
 */
export function unjoinedEndIssues(p: Project, walls: Wall[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const w of walls) {
    for (const end of ['a', 'b'] as const) {
      if (!(end === 'a' ? w.noJoinStart : w.noJoinEnd)) continue;
      const pt = end === 'a' ? w.a : w.b;
      for (const o of walls) {
        if (o.id === w.id || o.levelId !== w.levelId) continue;
        const half = (p.wallTypes[o.typeId] ? totalThickness(p.wallTypes[o.typeId]!) : 0.2) / 2;
        if (distToSegment(pt, o.a, o.b) > half) continue;
        out.push({
          severity: 'warning',
          code: 'wall-end-unjoined',
          message: `A ${end === 'a' ? 'ponta inicial' : 'ponta final'} da parede "${w.mark || w.id}" está dentro da parede "${o.mark || o.id}" com a junção desligada: as duas se sobrepõem.`,
          elementId: w.id,
        });
        break;
      }
    }
  }
  return out;
}

interface End {
  wall: Wall;
  which: 'a' | 'b';
  at: Vec2;
  /** Direção unitária saindo do nó para dentro da parede. */
  dir: Vec2;
  arc: Arc | null;
}

const arcOf = (w: Wall): Arc | null => arcFromSagitta(w.a, w.b, w.sag);

function endInfo(w: Wall, which: 'a' | 'b'): End {
  const arc = arcOf(w);
  if (arc) {
    const t = arcTangentAt(arc, which === 'a' ? 0 : arc.length);
    const dir = which === 'a' ? t : { x: -t.x, y: -t.y };
    return { wall: w, which, at: which === 'a' ? w.a : w.b, dir, arc };
  }
  const u = norm(sub(w.b, w.a));
  return { wall: w, which, at: which === 'a' ? w.a : w.b, dir: which === 'a' ? u : { x: -u.x, y: -u.y }, arc };
}

const noJoin = (e: End): boolean => (e.which === 'a' ? e.wall.noJoinStart : e.wall.noJoinEnd);

/** Ângulo entre duas direções, em [0, π]. */
function angleBetween(a: Vec2, b: Vec2): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}

/**
 * Quina fora do domínio: fora de 60°–120°, exceto a continuidade tangente (deflexão de até 10°, ou seja, ângulo
 * entre as direções de saída acima de 170°).
 */
function cornerOutOfDomain(angle: number): boolean {
  const deg = angle * DEG;
  if (deg >= MIN_CORNER_DEG - 1e-6 && deg <= MAX_CORNER_DEG + 1e-6) return false;
  return deg < 180 - TANGENT_KINK_DEG - 1e-6;
}

/** Motivos para uma junção com parede curva sair do domínio suportado (vazio = dentro). */
function domainReasons(ends: End[], angle: number): string[] {
  const reasons: string[] = [];
  const seen = new Set<string>();
  for (const e of ends) {
    if (!e.arc || e.arc.radius >= MIN_RADIUS - 1e-9 || seen.has(e.wall.id)) continue;
    seen.add(e.wall.id);
    reasons.push(`a parede ${label(e.wall)} tem raio de ${fmt(e.arc.radius)} m (mínimo 3,00 m)`);
  }
  if (cornerOutOfDomain(angle)) reasons.push(`quina de ${(angle * DEG).toFixed(1).replace('.', ',')}° fora de 60° a 120°`);
  return reasons;
}

function joinIssue(elementId: string, names: string[], reasons: string[]): ValidationIssue {
  return {
    severity: 'warning',
    code: 'wall-curve-join-domain',
    message: `Junção curva entre as paredes ${names.join(' e ')}: ${reasons.join('; ')}. Fora do domínio suportado, a junção pode deixar ponta ou anel extra.`,
    elementId,
  };
}

/** Comprimento do eixo da parede e posição (t, distância lateral) de um ponto. */
function axisPosition(w: Wall, p: Vec2): { t: number; lateral: number; length: number; arc: Arc | null } {
  const arc = arcOf(w);
  if (arc) {
    const l = arcLocal(arc, p);
    return { t: l.t, lateral: Math.abs(l.s), length: arc.length, arc };
  }
  const d = sub(w.b, w.a);
  const length = len(d);
  const u = norm(d);
  const rel = sub(p, w.a);
  return { t: dot(rel, u), lateral: Math.abs(cross(u, rel)), length, arc };
}

/** Avisos de junção curva fora do domínio suportado (CV-2): raio < 3 m ou quina fora de 60°–120°. */
export function curveJoinDomainIssues(p: Project, walls: Wall[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const ends = walls.flatMap((w) => [endInfo(w, 'a'), endInfo(w, 'b')]);
  const grouped = new Set<End>();

  // Pares (ou nós) com pontas no mesmo ponto.
  for (let i = 0; i < ends.length; i++) {
    const a = ends[i]!;
    if (noJoin(a) || grouped.has(a)) continue;
    const partners: End[] = [];
    for (let j = i + 1; j < ends.length; j++) {
      const b = ends[j]!;
      if (b.wall.id === a.wall.id || noJoin(b)) continue;
      if (dist(a.at, b.at) <= JOIN_TOL) partners.push(b);
    }
    if (!partners.length || (!a.arc && partners.every((b) => !b.arc))) continue;
    grouped.add(a);
    for (const b of partners) grouped.add(b);
    const reasons = new Set<string>();
    for (const b of partners) {
      for (const r of domainReasons([a, b], angleBetween(a.dir, b.dir))) reasons.add(r);
    }
    if (reasons.size) out.push(joinIssue(a.wall.id, [label(a.wall), ...partners.map((b) => label(b.wall))], [...reasons]));
  }

  // T: ponta de uma parede no corpo de outra (sem outra ponta no mesmo lugar).
  for (const e of ends) {
    if (grouped.has(e) || noJoin(e)) continue;
    let host: { wall: Wall; t: number; angle: number; arc: Arc | null } | null = null;
    for (const w of walls) {
      if (w.id === e.wall.id || w.levelId !== e.wall.levelId) continue;
      if (dist(e.at, w.a) <= JOIN_TOL || dist(e.at, w.b) <= JOIN_TOL) continue;
      const pos = axisPosition(w, e.at);
      if (pos.t < -JOIN_TOL || pos.t > pos.length + JOIN_TOL) continue;
      const half = (p.wallTypes[w.typeId] ? totalThickness(p.wallTypes[w.typeId]!) : 0.2) / 2;
      if (pos.lateral > half + JOIN_TOL) continue;
      const tangent = pos.arc ? arcTangentAt(pos.arc, pos.t) : norm(sub(w.b, w.a));
      const raw = angleBetween(e.dir, tangent);
      // A parede atravessada tem as duas tangentes; vale a que melhor representa a continuidade (maior ângulo).
      host = { wall: w, t: pos.t, angle: Math.max(raw, Math.PI - raw), arc: pos.arc };
      break;
    }
    if (!host || (!e.arc && !host.arc)) continue;
    const reasons: string[] = [];
    for (const arc of [e.arc, host.arc]) {
      if (arc && arc.radius < MIN_RADIUS - 1e-9) {
        const owner = arc === e.arc ? e.wall : host.wall;
        const reason = `a parede ${label(owner)} tem raio de ${fmt(arc.radius)} m (mínimo 3,00 m)`;
        if (!reasons.includes(reason)) reasons.push(reason);
      }
    }
    if (cornerOutOfDomain(host.angle)) reasons.push(`quina de ${(host.angle * DEG).toFixed(1).replace('.', ',')}° fora de 60° a 120°`);
    if (reasons.length) out.push(joinIssue(e.wall.id, [label(e.wall), label(host.wall)], reasons));
  }

  return out;
}
