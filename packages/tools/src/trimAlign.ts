import { cross, dist, dot, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall, normalAt, pointAt, toLocal, type WallFrame } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { ToolBase } from './base.ts';
import { moveWalls } from './edit.ts';
import { vizinhaCurta } from './alignNeighbors.ts';
import type { EdgePick } from './ringEdge.ts';
import { commitRingEdit, pickLineTarget, ringOfRef } from './ringTarget.ts';
import { ringOps } from './ringOps.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

/** Anel igual ao outro em todos os vértices (tolerância 1e-9 m). */
function sameRing(a: Vec2[], b: Vec2[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v.x - b[i]!.x) <= 1e-9 && Math.abs(v.y - b[i]!.y) <= 1e-9);
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
    { kind: 'line', a, b, halo: true },
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
    this.items.push({ kind: 'line', a: this.a, b: inf.point, halo: true });
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
