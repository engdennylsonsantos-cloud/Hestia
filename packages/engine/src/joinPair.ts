import { dist, dot, type Vec2 } from '@hestia/geom';
import { planeHit, toLocal, type WallFrame } from './frame.ts';
import type { JoinKind } from '@hestia/model';
import type { EndRef, MiterSide, SideSpec, WallEnds } from './joinTypes.ts';
import { both, crossAt, miterPoint, setEnd, sOfDepth, sideOf, stairSpec, sub2 } from './joinSides.ts';

const MITER_LIMIT = 6;

/** Ponto em que o eixo do ramal (tangente na extremidade) encontra a linha de centro da parede atravessada. */
export function centerlineHit(branch: EndRef, through: WallFrame): Vec2 | null {
  const o = branch.o;
  const d = branch.dir;
  if (!through.arc) {
    const den = dot(d, through.n);
    if (Math.abs(den) < 0.05) return null;
    const lam = (through.sMid - dot(sub2(o, through.a), through.n)) / den;
    return { x: o.x + d.x * lam, y: o.y + d.y * lam };
  }
  // Círculo da linha de centro: |o + λd − C|² = ρ².
  const rho = through.arc.radius + through.arc.k * through.sMid;
  const w = sub2(o, through.arc.center);
  const bq = dot(w, d);
  const disc = bq * bq - (dot(w, w) - rho * rho);
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const l1 = -bq - sq;
  const l2 = -bq + sq;
  const lam = Math.abs(l1) <= Math.abs(l2) ? l1 : l2;
  return { x: o.x + d.x * lam, y: o.y + d.y * lam };
}

/** Ramal que termina no meio de outra parede: o fim vai até a linha de centro da parede atravessada. */
export function toCenterline(branch: EndRef, through: WallFrame): SideSpec | null {
  const hit = centerlineHit(branch, through);
  if (!hit) return null;
  const t = toLocal(branch.f, hit).t;
  if (branch.which === 'a') return { kind: 'flat', t: Math.min(t, branch.f.length - 0.01) };
  return { kind: 'flat', t: Math.max(t, 0.01) };
}

/** Corte reto afastado `ext` do eixo, para a extremidade ficar além do canto. */
const flatAt = (r: EndRef, ext: number): SideSpec => ({ kind: 'flat', t: r.which === 'a' ? -ext : r.f.length + ext });

/** Extensão (corte reto) necessária para cobrir o canto externo com `other`. */
function outerExtension(a: EndRef, b: EndRef): number {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const p = miterPoint(sa, sb, 0);
  if (!p) return 0;
  return Math.max(0, -dot(sub2(p, a.o), a.dir));
}

const capExt = (ext: number, ...f: WallFrame[]): number => Math.min(ext, MITER_LIMIT * Math.max(0.05, ...f.map((x) => x.thickness)));

/** Papéis de uma junção de duas paredes: o tipo vem da mais antiga e `flip` troca quem domina (docs/05 §9). */
export function pairRoles(a: EndRef, b: EndRef): { lead: EndRef; follower: EndRef; kind: JoinKind } {
  const [first, second] = a.f.wall.order <= b.f.wall.order ? [a, b] : [b, a];
  const cfg = first.which === 'a' ? first.f.wall.joinStart : first.f.wall.joinEnd;
  return { lead: cfg.flip ? second : first, follower: cfg.flip ? first : second, kind: cfg.kind };
}

/** Corte das duas pontas de um par de paredes, usado pela junção de duas paredes e por cada lado de um nó. */
export interface PairSpecs {
  lead: SideSpec;
  follower: SideSpec;
}

/**
 * Especificações de corte do par (lead, follower) segundo o tipo de junção. `null` quando o par não tem pareamento
 * possível (encosto: quem chama aplica a linha de centro; esquadria mal condicionada: mantém o corte que já estava).
 *
 * Encosto pareia por face, em degraus (docs/08 §5.4 passo 3; decisão 0009 #11): a dominante fica com as células do
 * canto (é ela que atravessa até o canto externo) e a outra para nas faces das camadas dela.
 */
/** Corte reto perpendicular no nó (a extremidade de cada parede está em t = 0 ou t = L). */
const flatNo = (r: EndRef): SideSpec => ({ kind: 'flat', t: r.which === 'a' ? 0 : r.f.length });

/**
 * Canto com parede curva, qualquer tipo de junção: as duas paredes são cortadas pela MESMA reta, a que passa por O
 * (interseção das faces externas) e K (interseção das faces internas). A silhueta fica exata para qualquer par de
 * tipos e curvatura; a camada não é pareada com a da outra (aceito: canto curvo é raro). Sem O ou K dentro do limite
 * (continuidade tangente: as faces são paralelas/tangentes), corte reto no nó nas duas paredes, que é exato nesse caso.
 */
function planeSpecs(lead: EndRef, follower: EndRef, sa: MiterSide, sb: MiterSide, cap: number): PairSpecs {
  const Ta = sa.sHi - sa.sLo;
  const Tb = sb.sHi - sb.sLo;
  const O = crossAt(sa, sOfDepth(sa, 0), sb, sOfDepth(sb, 0));
  const K = crossAt(sa, sOfDepth(sa, Ta), sb, sOfDepth(sb, Tb));
  const dentro = (p: Vec2 | null): p is Vec2 => p !== null && dist(p, lead.o) <= cap;
  if (!dentro(O) || !dentro(K) || dist(O, K) < 1e-6) return { lead: flatNo(lead), follower: flatNo(follower) };
  const cruzamentos = (f: WallFrame, m: MiterSide, near: Vec2): Vec2[] =>
    m.bounds.flatMap((d) => {
      const x = planeHit(f, sOfDepth(m, d), O, K, near);
      return x ? [x] : [];
    });
  const pts = [...cruzamentos(lead.f, sa, lead.o), ...cruzamentos(follower.f, sb, lead.o)];
  const plano: SideSpec = { kind: 'plane', p: O, q: K, pts };
  return { lead: plano, follower: plano };
}

export function pairSpecs(a: EndRef, b: EndRef): PairSpecs | null {
  const { lead, follower, kind } = pairRoles(a, b);
  const cap = MITER_LIMIT * Math.max(0.05, lead.f.thickness, follower.f.thickness);
  const sa = sideOf(lead, follower.dir);
  const sb = sideOf(follower, lead.dir);
  if (lead.f.arc || follower.f.arc) return planeSpecs(lead, follower, sa, sb, cap);
  if (kind === 'miter') {
    const ok = (s: MiterSide, o: MiterSide, ref: EndRef): boolean => {
      const t = s.sHi - s.sLo;
      for (const d of [0, t]) {
        const p = miterPoint(s, o, d);
        if (!p || dist(p, ref.o) > cap) return false;
      }
      return true;
    };
    if (ok(sa, sb, lead) && ok(sb, sa, follower)) {
      return {
        lead: { kind: 'miter', self: sa, other: sb },
        follower: { kind: 'miter', self: sb, other: sa },
      };
    }
    // Ângulo agudo demais para a esquadria. Reta: mantém o corte reto. Com parede curva o canto cai no pareamento por
    // face (a circunferência corta a reta longe do nó), como encosto.
    if (!lead.f.arc && !follower.f.arc) return null;
  }
  // Encosto: pareamento por face, também com parede curva (as faces de arco são circunferências). Só não cabe quando
  // o degrau sai do limite.
  const leadSteps = stairSpec(lead, sa, sb, 'low', cap);
  const followSteps = stairSpec(follower, sb, sa, 'high', cap);
  if (leadSteps && followSteps) return { lead: leadSteps, follower: followSteps };
  return null;
}

/** Junção de duas paredes segundo a configuração da mais antiga (docs/05 §9). */
export function joinPair(out: Map<string, WallEnds>, a: EndRef, b: EndRef): void {
  const { lead, follower, kind } = pairRoles(a, b);
  const specs = pairSpecs(a, b);
  if (specs) {
    setEnd(out, lead, both(specs.lead));
    setEnd(out, follower, both(specs.follower));
    return;
  }
  if (kind === 'butt') {
    // Parede curva (ou degrau fora do limite): a dominante atravessa até o canto externo e a outra para no eixo.
    setEnd(out, lead, both(flatAt(lead, capExt(outerExtension(lead, follower), lead.f, follower.f))));
    const spec = toCenterline(follower, lead.f);
    if (spec) setEnd(out, follower, both(spec));
  }
  // Esquadria mal condicionada (ângulo agudo demais): mantém o corte reto que já estava.
}
