import { dist, intersectCircleLine, intersectCircles, intersectLines, sagFromThreePoints, type Vec2 } from '@hestia/geom';
import { frameOfWall, pointAt, toLocal, type WallFrame } from '@hestia/engine';
import { isWall, type Id, type Project } from '@hestia/model';
import { ToolBase } from './base.ts';
import { algumMudou, NADA_A_APARAR } from './trimChange.ts';
import type { EdgePick, EdgeRef } from './ringEdge.ts';
import { commitRingEdit, pickLineTarget, ringOfRef } from './ringTarget.ts';
import { ringOps } from './ringOps.ts';
import type { PointerInfo, TrimMode } from './types.ts';

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
 * Interseção dos eixos mais próxima dos dois cliques. Duas circunferências podem se cruzar em dois pontos; o canto é o
 * que fica do lado das partes que o usuário quer manter.
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
export interface EndPatch {
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

/**
 * Frase de confirmação do canto (antes de aplicar, com o projeto ainda antigo): "estendida" quando a parede ficou
 * mais longa, "aparada" quando ficou mais curta.
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

/**
 * Aparar/Estender com três modos (Revit):
 * - 'canto' (Trim/Extend to Corner): clique na parte que deve ficar de cada parede; as duas mudam.
 * - 'unico' (Trim/Extend Single Element): 1º clique é a referência, 2º é a parede a estender/aparar, no lado que fica.
 *   Só a segunda parede muda; a ponta vai até a interseção dos eixos.
 * - 'varios' (Trim/Extend Multiple): Shift+clique acumula paredes a aparar; o clique final, numa referência sem Shift,
 *   aplica todas num único passo de desfazer. A referência não muda.
 * Arestas de anel (piso, laje, telhado, forro): duas arestas, canto, em qualquer modo.
 */
export class TrimTool extends ToolBase {
  readonly id = 'trim';
  readonly label = 'Aparar/Estender';
  readonly hint = 'Aparar/Estender: clique na parede de referência e depois na parede a estender, no lado que deve ficar.';
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

  override start(): void {
    this.reset();
    this.env.say(this.prompt());
  }

  /** Modo vindo da barra; sem opção (chamada antiga), mantém o comportamento de várias/canto. */
  private mode(): TrimMode {
    return this.env.options().trimMode ?? 'varios';
  }

  /** Texto do passo atual, por modo. */
  private prompt(): string {
    if (this.firstEdge) return 'Aparar/Estender: agora clique na segunda aresta.';
    const mode = this.mode();
    if (mode === 'unico') {
      return this.first
        ? 'Aparar/Estender: clique na parede a estender, no lado que deve ficar.'
        : 'Aparar/Estender: clique na parede de referência.';
    }
    if (mode === 'canto') {
      return this.first
        ? 'Aparar/Estender ao canto: clique na parte que deseja manter da segunda parede.'
        : 'Aparar/Estender ao canto: clique na parte que deseja manter da primeira parede.';
    }
    if (this.group.length) return `${this.group.length} parede(s) para aparar. Clique na parede de referência (sem Shift).`;
    if (this.first) return 'Aparar/Estender ao canto: clique na parte que deseja manter da segunda parede.';
    return 'Aparar/Estender: Shift+clique acumula paredes a aparar; o clique sem Shift na referência aplica a todas.';
  }

  /** Esc volta um passo: grupo, depois primeira parede/aresta; sem passo, sai da ferramenta. */
  override cancel(): void {
    if (this.firstEdge) {
      this.firstEdge = null;
      this.items = [];
      this.env.say(this.prompt());
      return;
    }
    if (this.group.length) {
      this.group = [];
      this.items = [];
      this.env.say(this.prompt());
      return;
    }
    if (this.first) {
      this.first = null;
      this.items = [];
      this.env.say(this.prompt());
      return;
    }
    this.env.done();
  }

  override move(p: PointerInfo): void {
    const pr = this.env.project();
    const target = pickLineTarget(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.items = target ? [{ kind: 'highlight', ids: [target.kind === 'wall' ? target.id : target.pick.ref.elementId] }] : [];
    const held = [
      ...(this.first ? [this.first.id] : []),
      ...(this.firstEdge ? [this.firstEdge.ref.elementId] : []),
      ...this.group.map((g) => g.id),
    ];
    if (held.length) this.items.push({ kind: 'highlight', ids: held });
    // No modo um elemento, com a referência escolhida, a prévia mostra o eixo novo da parede a mudar.
    if (this.mode() === 'unico' && this.first && target?.kind === 'wall' && target.id !== this.first.id) {
      const fr = frameOfWall(pr, this.first.id);
      const ft = frameOfWall(pr, target.id);
      if (!fr || !ft || ft.arc) return;
      const corner = cornerBetween(fr, ft, this.first.at, p.raw);
      const patch = corner ? cornerPatch(ft, corner, p.raw) : null;
      if (patch) this.items.push({ kind: 'line', a: patch.a ?? ft.wall.a, b: patch.b ?? ft.wall.b, dashed: true });
    }
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
    this.env.say(this.prompt());
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
      const corner = f ? cornerBetween(f, ref, g.at, refAt) : null;
      const mine = f && corner ? cornerPatch(f, corner, g.at) : null;
      if (!mine) {
        skipped += 1;
        continue;
      }
      patches.push({ id: g.id, patch: mine });
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
    this.env.say(`${frase}${skipped ? ` ${skipped} ignorada(s): sem canto possível.` : ''} ${this.prompt()}`);
  }

  /**
   * Modo um elemento: leva a ponta da parede clicada até a interseção dos eixos, mantendo a parte do lado do clique.
   * A referência não é alterada.
   */
  private clickUnico(hitId: Id, at: Vec2, pr: Project): void {
    if (!this.first) {
      this.first = { id: hitId, at };
      this.env.say(this.prompt());
      return;
    }
    if (this.first.id === hitId) {
      this.env.say('Escolha outra parede.');
      return;
    }
    const ref = this.first;
    const fr = frameOfWall(pr, ref.id);
    const ft = frameOfWall(pr, hitId);
    if (!fr || !ft) return;
    const corner = cornerBetween(fr, ft, ref.at, at);
    if (!corner) {
      const cruzam = axisIntersections(axisOf(fr), axisOf(ft)).length > 0;
      this.env.say(cruzam ? 'O arco não pode ser estendido até o canto (mais de 180°).' : 'As paredes não se cruzam: não há canto.');
      this.reset();
      return;
    }
    const patch = cornerPatch(ft, corner, at);
    if (!patch) {
      this.env.say('O arco não pode ser estendido até o canto (mais de 180°).');
      this.reset();
      return;
    }
    const patches = [{ id: hitId, patch }];
    if (!algumMudou(pr, patches)) {
      this.reset();
      this.env.say(NADA_A_APARAR);
      return;
    }
    const frase = confirmaCanto(pr, patches);
    this.env.transaction('Aparar/Estender parede', () => this.applyPatch(hitId, patch));
    this.reset();
    this.env.say(`${frase} ${this.prompt()}`);
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
      this.env.say(this.prompt());
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
    if (ok) this.env.say(`Canto aplicado. ${this.prompt()}`);
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
    const mode = this.mode();
    if (mode === 'unico') {
      this.clickUnico(target.id, p.raw, pr);
      return;
    }
    const hitId = target.id;
    if (p.shift && mode === 'varios') {
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
      this.env.say(this.prompt());
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
    const corner = cornerBetween(fa, fb, first.at, p.raw);
    const pa = corner ? cornerPatch(fa, corner, first.at) : null;
    const pb = corner ? cornerPatch(fb, corner, p.raw) : null;
    if (!pa || !pb) {
      const cruzam = axisIntersections(axisOf(fa), axisOf(fb)).length > 0;
      this.env.say(cruzam ? 'O arco não pode ser estendido até o canto (mais de 180°).' : 'As paredes não se cruzam: não há canto.');
      this.reset();
      return;
    }
    const patches = [
      { id: fa.wall.id, patch: pa },
      { id: fb.wall.id, patch: pb },
    ];
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
    this.env.say(`${frase} ${this.prompt()}`);
  }
}
