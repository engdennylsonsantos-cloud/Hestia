import { cross, dist, dot, intersectCircleLine, intersectCircles, intersectLines, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall, normalAt, pointAt, toLocal, type WallFrame } from '@hestia/engine';
import { isWall, type Id, type Project } from '@hestia/model';
import { ToolBase } from './base.ts';
import { moveWalls } from './edit.ts';
import { vizinhaCurta } from './alignNeighbors.ts';
import { algumMudou, NADA_A_APARAR } from './trimChange.ts';
import type { EdgePick, EdgeRef } from './ringEdge.ts';
import { commitRingEdit, pickLineTarget, ringOfRef } from './ringTarget.ts';
import { ringOps } from './ringOps.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

type Axis = { kind: 'line'; p: Vec2; d: Vec2 } | { kind: 'circle'; c: Vec2; r: number };

/** Eixo da parede como curva de interseção: reta (ponto + direção) ou circunferência do arco. */
function axisOf(f: WallFrame): Axis {
  return f.arc ? { kind: 'circle', c: f.arc.center, r: f.arc.radius } : { kind: 'line', p: f.a, d: f.u };
}

/** Interseções dos eixos (reta×reta, reta×arco e arco×arco), inclusive as que exigem estender as paredes. */
function axisIntersections(a: Axis, b: Axis): Vec2[] {
  if (a.kind === 'line' && b.kind === 'line') {
    const r = intersectLines(a.p, a.d, b.p, b.d);
    return r ? [r.point] : [];
  }
  if (a.kind === 'line' && b.kind === 'circle') return intersectCircleLine(b.c, b.r, a.p, a.d);
  if (a.kind === 'circle' && b.kind === 'line') return intersectCircleLine(a.c, a.r, b.p, b.d);
  if (a.kind === 'circle' && b.kind === 'circle') return intersectCircles(a.c, a.r, b.c, b.r);
  return [];
}

/**
 * Canto entre duas paredes: a interseção dos eixos mais próxima dos dois cliques. Duas circunferências podem se
 * cruzar em dois pontos; o canto é o que fica do lado das partes que o usuário quer manter.
 */
function cornerBetween(fa: WallFrame, fb: WallFrame, clickA: Vec2, clickB: Vec2): Vec2 | null {
  const hits = axisIntersections(axisOf(fa), axisOf(fb));
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const p of hits) {
    const d = dist(p, clickA) + dist(p, clickB);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Ajuste de uma extremidade ao canto; em arco, o `sag` é recalculado sobre a mesma circunferência. */
interface EndPatch {
  a?: Vec2;
  b?: Vec2;
  sag?: number;
}

/** Qual extremidade fica é a do lado do clique; no arco o novo trecho continua na circunferência original. */
function cornerPatch(f: WallFrame, corner: Vec2, click: Vec2): EndPatch | null {
  const tI = toLocal(f, corner).t;
  const tC = toLocal(f, click).t;
  const atA = tI <= tC;
  if (!f.arc) return atA ? { a: corner } : { b: corner };
  const fixedT = atA ? f.length : 0;
  // Acima de meia volta o arco não é representável por uma flecha: o canto está fora do alcance.
  if (Math.abs(tI - fixedT) > Math.PI * f.arc.radius + 1e-9) return null;
  const mid = pointAt(f, (tI + fixedT) / 2, 0);
  const sag = atA ? sagFromThreePoints(corner, mid, f.b) : sagFromThreePoints(f.a, mid, corner);
  return atA ? { a: corner, sag } : { b: corner, sag };
}

interface CornerPlan {
  patches: Array<{ id: Id; patch: EndPatch }>;
}

/** Plano do canto; `null` quando não há interseção ou o arco não alcança o canto. */
function cornerPlan(fa: WallFrame, fb: WallFrame, clickA: Vec2, clickB: Vec2): CornerPlan | null {
  const corner = cornerBetween(fa, fb, clickA, clickB);
  if (!corner) return null;
  const pa = cornerPatch(fa, corner, clickA);
  const pb = cornerPatch(fb, corner, clickB);
  if (!pa || !pb) return null;
  return { patches: [{ id: fa.wall.id, patch: pa }, { id: fb.wall.id, patch: pb }] };
}

/**
 * Frase de confirmação do canto (antes de aplicar, com o projeto ainda antigo): "estendida" quando a parede ficou
 * mais longa, "aparada" quando ficou mais curta, e as duas quando o canto mexe nas duas paredes.
 */
function confirmaCanto(pr: Project, patches: Array<{ id: Id; patch: EndPatch }>): string {
  let estendidas = 0;
  let aparadas = 0;
  for (const { id, patch } of patches) {
    const w = pr.elements[id];
    if (!isWall(w)) continue;
    const antes = dist(w.a, w.b);
    const depois = dist(patch.a ?? w.a, patch.b ?? w.b);
    if (depois > antes + 1e-6) estendidas += 1;
    else if (depois < antes - 1e-6) aparadas += 1;
  }
  if (estendidas && aparadas) return 'Cantos ajustados.';
  if (estendidas) return estendidas === 1 ? 'Parede estendida.' : 'Paredes estendidas.';
  return aparadas === 1 ? 'Parede aparada.' : 'Paredes aparadas.';
}

/** Parede escolhida para aparar, com o ponto clicado (define a parte que fica). */
interface TrimPick {
  id: Id;
  at: Vec2;
}

/** Duas referências do mesmo anel: mesma aresta de anel (elemento, furo e índice). */
function sameEdge(a: EdgeRef, b: EdgeRef): boolean {
  return a.elementId === b.elementId && a.hole === b.hole && a.index === b.index;
}

/** Anel igual ao outro em todos os vértices (tolerância 1e-9 m). */
function sameRing(a: Vec2[], b: Vec2[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v.x - b[i]!.x) <= 1e-9 && Math.abs(v.y - b[i]!.y) <= 1e-9);
}

/**
 * Aparar/estender até o canto (Revit: Trim/Extend to Corner). Clique na parte que deve ficar.
 * Modo várias (Revit: Trim/Extend Multiple): Shift+clique acumula paredes a aparar; o clique final,
 * numa parede de referência (sem Shift), aplica a todas num único passo de desfazer. A referência não muda.
 * Arestas de anel (piso, laje, telhado, forro): duas arestas, sem modo várias; o canto é a interseção das retas.
 */
export class TrimTool extends ToolBase {
  readonly id = 'trim';
  readonly label = 'Aparar/Estender';
  readonly hint = 'Aparar/Estender ao canto: clique na parte que deseja manter da primeira e da segunda parede. Shift+clique acumula várias paredes; o clique final, na referência, aplica a todas.';
  private first: TrimPick | null = null;
  /** Primeira aresta de anel escolhida, com o ponto do clique sobre ela. */
  private firstEdge: { ref: EdgeRef; at: Vec2 } | null = null;
  private group: TrimPick[] = [];

  protected reset(): void {
    this.first = null;
    this.firstEdge = null;
    this.group = [];
    this.items = [];
  }
  protected busy(): boolean {
    return this.first !== null || this.firstEdge !== null || this.group.length > 0;
  }

  override move(p: PointerInfo): void {
    const target = pickLineTarget(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.items = target ? [{ kind: 'highlight', ids: [target.kind === 'wall' ? target.id : target.pick.ref.elementId] }] : [];
    const held = [
      ...(this.first ? [this.first.id] : []),
      ...(this.firstEdge ? [this.firstEdge.ref.elementId] : []),
      ...this.group.map((g) => g.id),
    ];
    if (held.length) this.items.push({ kind: 'highlight', ids: held });
  }

  /** Shift+clique: inclui ou tira a parede da lista a aparar. */
  private toggleGroup(id: Id, at: Vec2): void {
    if (this.first) {
      this.group.push(this.first);
      this.first = null;
    }
    const i = this.group.findIndex((g) => g.id === id);
    if (i >= 0) this.group.splice(i, 1);
    else this.group.push({ id, at });
    this.env.say(this.group.length ? `${this.group.length} parede(s) para aparar. Clique na parede de referência (sem Shift).` : this.hint);
  }

  /** Aplica o ajuste de uma extremidade; em arco, o `sag` novo mantém a mesma circunferência. */
  private applyPatch(id: Id, patch: EndPatch): void {
    this.env.exec({ type: 'setWallEnds', id, a: patch.a, b: patch.b });
    if (patch.sag !== undefined) this.env.exec({ type: 'updateElements', ids: [id], patch: { sag: patch.sag } });
  }

  /** Clique na referência: aparar cada parede da lista ao canto com ela, em um único passo. */
  private applyGroup(refId: Id, refAt: Vec2, pr: Project): void {
    const ref = frameOfWall(pr, refId);
    if (!ref) return;
    const patches: Array<{ id: Id; patch: EndPatch }> = [];
    let skipped = 0;
    for (const g of this.group) {
      const f = frameOfWall(pr, g.id);
      const plan = f ? cornerPlan(f, ref, g.at, refAt) : null;
      const mine = plan?.patches.find((x) => x.id === g.id);
      if (!mine) {
        skipped += 1;
        continue;
      }
      patches.push(mine);
    }
    if (!patches.length) {
      this.env.say('Nenhuma parede da lista pode ser aparada a essa referência (sem interseção ou arco fora de alcance).');
      this.reset();
      return;
    }
    if (!algumMudou(pr, patches)) {
      this.reset();
      this.env.say(NADA_A_APARAR);
      return;
    }
    const frase = confirmaCanto(pr, patches);
    this.env.transaction('Aparar ao canto', () => {
      for (const { id, patch } of patches) this.applyPatch(id, patch);
    });
    this.reset();
    this.env.say(`${frase}${skipped ? ` ${skipped} ignorada(s): sem canto possível.` : ''} ${this.hint}`);
  }

  /** Mistura de parede e aresta (ou várias com uma só): desfaz a escolha e pede de novo. */
  private mixed(): void {
    this.env.say('Aparar: escolha duas paredes ou duas arestas.');
    this.reset();
  }

  /**
   * Segunda aresta (ou primeira): a extremidade da primeira aresta mais próxima do clique vai para a interseção das
   * duas retas. A segunda aresta não muda. Retas paralelas não têm canto.
   */
  private clickEdge(pick: EdgePick, p: PointerInfo, pr: Project): void {
    if (p.shift) {
      this.env.say('Shift+clique (várias) vale só para paredes.');
      return;
    }
    if (this.first || this.group.length) {
      this.mixed();
      return;
    }
    if (!this.firstEdge) {
      this.firstEdge = { ref: pick.ref, at: p.raw };
      this.env.say('Agora clique na segunda aresta.');
      return;
    }
    const first = this.firstEdge;
    if (sameEdge(first.ref, pick.ref)) {
      this.env.say('Escolha outra aresta.');
      return;
    }
    const ring = ringOfRef(pr, first.ref);
    if (!ring) {
      this.reset();
      return;
    }
    const i = first.ref.index;
    const corner = ringOps.intersectEdgeLine(ring, i, pick.a, pick.b);
    if (!corner) {
      this.env.say('Arestas paralelas: não há canto.');
      this.reset();
      return;
    }
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    // Como na parede, a parte clicada fica: sai a extremidade mais distante do clique.
    const end = dist(first.at, a) >= dist(first.at, b) ? 'a' : 'b';
    const next = ringOps.moveEdgeEnd(ring, i, end, corner);
    const ref = first.ref;
    let ok = false;
    this.env.transaction('Aparar ao canto', () => {
      ok = commitRingEdit(this.env, ref, next);
    });
    this.reset();
    // Recusado (travado): commitRingEdit já disse o motivo na barra de status; não sobrescrever.
    if (ok) this.env.say(`Canto aplicado. ${this.hint}`);
  }

  override click(p: PointerInfo): void {
    const pr = this.env.project();
    const target = pickLineTarget(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!target) {
      this.env.say('Clique sobre uma parede ou aresta.');
      return;
    }
    if (target.kind === 'edge') {
      this.clickEdge(target.pick, p, pr);
      return;
    }
    if (this.firstEdge) {
      this.mixed();
      return;
    }
    const hitId = target.id;
    if (p.shift) {
      this.toggleGroup(hitId, p.raw);
      return;
    }
    if (this.group.length) {
      if (this.group.some((g) => g.id === hitId)) {
        this.env.say('A referência não pode estar na lista. Escolha outra parede.');
        return;
      }
      this.applyGroup(hitId, p.raw, pr);
      return;
    }
    if (!this.first) {
      this.first = { id: hitId, at: p.raw };
      this.env.say('Agora clique na parte que deseja manter da segunda parede.');
      return;
    }
    if (this.first.id === hitId) {
      this.env.say('Escolha outra parede.');
      return;
    }
    const fa = frameOfWall(pr, this.first.id);
    const fb = frameOfWall(pr, hitId);
    if (!fa || !fb) return;
    const first = this.first;
    const plan = cornerPlan(fa, fb, first.at, p.raw);
    if (!plan) {
      const cruzam = axisIntersections(axisOf(fa), axisOf(fb)).length > 0;
      this.env.say(cruzam ? 'O arco não pode ser estendido até o canto (mais de 180°).' : 'As paredes não se cruzam: não há canto.');
      this.reset();
      return;
    }
    if (!algumMudou(pr, plan.patches)) {
      this.reset();
      this.env.say(NADA_A_APARAR);
      return;
    }
    const frase = confirmaCanto(pr, plan.patches);
    this.env.transaction('Aparar ao canto', () => {
      for (const { id, patch } of plan.patches) this.applyPatch(id, patch);
    });
    this.reset();
    this.env.say(`${frase} ${this.hint}`);
  }
}

interface RefFace {
  id: Id;
  /** Normal unitária da face de referência no ponto clicado. */
  n: Vec2;
  /** Um ponto da face de referência (na reta ou na circunferência). */
  at: Vec2;
  /** A face de referência é de parede em arco. */
  arc: boolean;
}

/** Alinhar: leva a face da parede escolhida até a face de referência (paredes paralelas). */
export class AlignTool extends ToolBase {
  readonly id = 'align';
  readonly label = 'Alinhar';
  readonly hint = 'Alinhar: clique na face de referência e depois na face da parede a mover.';
  private ref: RefFace | null = null;
  /** Referência de aresta de anel: a reta `p → q` da aresta (ver ringEdge). */
  private refEdge: { p: Vec2; q: Vec2 } | null = null;

  protected reset(): void {
    this.ref = null;
    this.refEdge = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.ref !== null || this.refEdge !== null;
  }

  /** Face mais próxima do clique, com o ponto e a normal no sistema local (vale para reta e arco). */
  private nearestFace(f: WallFrame, at: Vec2): { point: Vec2; n: Vec2 } {
    const local = toLocal(f, at);
    const sFace = Math.abs(local.s - f.sHi) <= Math.abs(local.s - f.sLo) ? f.sHi : f.sLo;
    return { point: pointAt(f, local.t, sFace), n: normalAt(f, local.t) };
  }

  override move(p: PointerInfo): void {
    const target = pickLineTarget(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.items = target ? [{ kind: 'highlight', ids: [target.kind === 'wall' ? target.id : target.pick.ref.elementId] }] : [];
  }

  /** Mesma natureza: parede com parede, aresta com aresta. */
  private static readonly NATUREZA_MSG = 'Alinhar: mesma natureza (parede com parede, aresta com aresta).';

  /** Clique numa aresta: a referência é a reta da aresta, ou a aresta é alinhada à reta de referência. */
  private clickEdge(pick: EdgePick, pr: Project): void {
    if (this.ref) {
      this.env.say(AlignTool.NATUREZA_MSG);
      return;
    }
    if (!this.refEdge) {
      this.refEdge = { p: pick.a, q: pick.b };
      this.env.say('Referência definida. Clique na parede ou aresta a alinhar (Esc para trocar a referência).');
      return;
    }
    const ring = ringOfRef(pr, pick.ref);
    if (!ring) return;
    const next = ringOps.alignEdgeToLine(ring, pick.ref.index, this.refEdge.p, this.refEdge.q);
    if (sameRing(ring, next)) {
      this.env.say('Já estão alinhadas.');
      return;
    }
    const ref = pick.ref;
    // Travada: commitRingEdit já diz o motivo na barra de status.
    let ok = false;
    this.env.transaction('Alinhar aresta', () => {
      ok = commitRingEdit(this.env, ref, next);
    });
    if (ok) this.env.say('Alinhado. Clique na próxima parede ou aresta a alinhar (Esc para trocar a referência).');
  }

  override click(p: PointerInfo): void {
    const pr = this.env.project();
    const target = pickLineTarget(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!target) {
      this.env.say('Clique sobre uma parede ou aresta.');
      return;
    }
    if (target.kind === 'edge') {
      this.clickEdge(target.pick, pr);
      return;
    }
    if (this.refEdge) {
      this.env.say(AlignTool.NATUREZA_MSG);
      return;
    }
    const hitId = target.id;
    const f = frameOfWall(pr, hitId);
    if (!f) return;
    if (!this.ref) {
      const face = this.nearestFace(f, p.raw);
      this.ref = { id: hitId, n: face.n, at: face.point, arc: !!f.arc };
      this.env.say('Referência definida. Clique na parede a alinhar (Esc para trocar a referência).');
      return;
    }
    if (hitId === this.ref.id) return;
    const face = this.nearestFace(f, p.raw);
    if (Math.abs(cross(face.n, this.ref.n)) > 1e-3) {
      this.env.say('As paredes precisam ser paralelas para alinhar.');
      return;
    }
    const delta = sub(this.ref.at, face.point);
    // Faces retas se alinham pela normal (a posição ao longo da parede não importa). Com arco, o ponto clicado
    // da face vai até o ponto de referência, que é o que faz as duas circunferências coincidirem.
    const k = f.arc || this.ref.arc ? delta : { x: this.ref.n.x * dot(delta, this.ref.n), y: this.ref.n.y * dot(delta, this.ref.n) };
    if (Math.hypot(k.x, k.y) < 1e-6) {
      this.env.say('Já estão alinhadas.');
      return;
    }
    // Uma vizinha que zeraria (ou quase) não pode: recusa e não grava nada, em vez de deixar a parede sumir.
    const curta = vizinhaCurta(pr, this.env.levelId(), hitId, k);
    if (curta) {
      this.env.say(`Alinhar deixaria a parede ${curta.mark || curta.id} com comprimento zero: nada foi alterado.`);
      return;
    }
    moveWalls(this.env, [hitId], k);
    this.env.say('Alinhado. Clique na próxima parede a alinhar (Esc para trocar a referência).');
  }
}

/** Cota de uma medida: linha entre os dois pontos, marcas nas extremidades e o valor no meio. */
function cotaItems(a: Vec2, b: Vec2): PreviewItem[] {
  return [
    { kind: 'line', a, b },
    { kind: 'point', at: a },
    { kind: 'point', at: b },
    { kind: 'label', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, text: `${dist(a, b).toFixed(3).replace('.', ',')} m` },
  ];
}

export class MeasureTool extends ToolBase {
  readonly id = 'measure';
  readonly label = 'Medir';
  readonly hint = 'Medir: clique em dois pontos. A cota fica no desenho até Esc ou um novo clique.';
  private a: Vec2 | null = null;
  /** Última medida concluída: a cota fica no desenho até Esc ou um novo clique. Só é visual (não entra no modelo nem no desfazer). */
  private kept: { a: Vec2; b: Vec2 } | null = null;

  protected reset(): void {
    this.a = null;
    this.kept = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.a !== null || this.kept !== null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    this.items = [];
    if (!this.a) {
      if (this.kept) this.items.push(...cotaItems(this.kept.a, this.kept.b));
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.a, b: inf.point });
    this.items.push({ kind: 'label', at: inf.point, text: `${dist(this.a, inf.point).toFixed(3).replace('.', ',')} m` });
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    if (!this.a) {
      this.kept = null;
      this.items = [];
      this.a = inf.point;
      return;
    }
    const d = dist(this.a, inf.point);
    const ang = (Math.atan2(inf.point.y - this.a.y, inf.point.x - this.a.x) * 180) / Math.PI;
    this.env.say(`Distância ${d.toFixed(3).replace('.', ',')} m · ΔX ${(inf.point.x - this.a.x).toFixed(3).replace('.', ',')} · ΔY ${(inf.point.y - this.a.y).toFixed(3).replace('.', ',')} · ${((ang + 360) % 360).toFixed(1).replace('.', ',')}°`);
    this.kept = { a: this.a, b: inf.point };
    this.a = null;
    this.items = cotaItems(this.kept.a, this.kept.b);
  }
}
