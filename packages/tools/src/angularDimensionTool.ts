import { add, dist, dot, len, mul, norm, sub, type Vec2 } from '@hestia/geom';
import {
  angularDimensionData,
  angularDimensionGeometry,
  formatDimension,
  newId,
  unitsOf,
  type AngularDimension,
  type AngularDimensionSide,
  type Dimension,
  type Project,
} from '@hestia/model';
import { alignFeaturesAt, type AlignFeature } from './alignFeatures.ts';
import { ToolBase, viewPlanId } from './base.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

const LABEL_HALF = 1.2;
const MIN_RADIUS = 0.05;
const LINE_REFERENCE_KINDS = new Set(['faceParede', 'eixoParede', 'nucleoParede', 'arestaAnel', 'linhaEsboco', 'arestaEscada', 'linhaGrade', 'linhaDetalhe', 'separador']);

/** Direção de uma referência: a reta, orientada para o lado do elemento (para o arco sair no encontro certo). */
interface RefLine {
  feature: AlignFeature;
  from: Vec2;
  to: Vec2;
  anchor: Vec2;
}

const angleOf = (v: Vec2): number => Math.atan2(v.y, v.x);

const wrapPi = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
};

/** Ponto que representa a referência (meio da parede, do segmento ou o próprio ponto da reta). */
function featureAnchor(f: AlignFeature, project: Project): Vec2 {
  if (f.seg) return { x: (f.seg.a.x + f.seg.b.x) / 2, y: (f.seg.a.y + f.seg.b.y) / 2 };
  const el = project.elements[f.ownerId];
  if (el && el.kind === 'wall') {
    return { x: (el.a.x + el.b.x) / 2, y: (el.a.y + el.b.y) / 2 };
  }
  return f.line.p;
}

/** Interseção de duas retas infinitas; null quando são paralelas. */
function intersection(a: Vec2, da: Vec2, b: Vec2, db: Vec2): Vec2 | null {
  const det = da.x * db.y - da.y * db.x;
  if (Math.abs(det) < 1e-9) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = (dx * db.y - dy * db.x) / det;
  return { x: a.x + da.x * t, y: a.y + da.y * t };
}

/**
 * Cota angular (Anotar): clique em duas linhas de referência — face, eixo ou núcleo de parede, como no Alinhar —
 * e depois escolha o lado e o raio do arco com o cursor. Tab alterna as candidatas sob o cursor.
 */
export class AngularDimensionTool extends ToolBase {
  readonly id = 'angularDimension';
  readonly label = 'Cota angular';
  readonly hint = 'Cota angular: clique na primeira referência, depois na segunda. Mova o cursor para escolher o lado (interno = menor, externo = volta >180°) e o raio do arco; clique para criar. Tab alterna a referência.';
  private refA: AlignFeature | null = null;
  private refB: AlignFeature | null = null;
  private hover: AlignFeature[] = [];
  private hoverIndex = 0;
  private placing = false;
  private previewDim: Dimension | null = null;

  protected reset(): void {
    this.refA = null;
    this.refB = null;
    this.hover = [];
    this.hoverIndex = 0;
    this.placing = false;
    this.previewDim = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.refA !== null || this.refB !== null;
  }

  private candidates(at: Vec2): AlignFeature[] {
    return alignFeaturesAt({
      project: this.env.project(),
      levelId: this.env.levelId(),
      at,
      metersPerPixel: this.env.metersPerPixel(),
      prefer: this.env.options().alignPrefer ?? 'faces',
      hidden: this.env.hiddenInView?.(),
      referenceOnly: true,
      planId: this.env.areaPlanId?.() ?? undefined,
    }).filter((f) => LINE_REFERENCE_KINDS.has(f.kind));
  }

  private updateHover(at: Vec2): void {
    const previous = this.hover[this.hoverIndex]?.key;
    const other = this.refA?.key;
    const candidates = this.candidates(at).filter((f) => f.key !== other);
    this.hover = candidates;
    const found = previous ? candidates.findIndex((f) => f.key === previous) : -1;
    this.hoverIndex = found >= 0 ? found : 0;
  }

  private current(): AlignFeature | null {
    return this.hover[this.hoverIndex] ?? null;
  }

  private featureItems(f: AlignFeature, prefix: string, dashed = false): PreviewItem[] {
    const a = add(f.line.p, mul(f.line.d, -LABEL_HALF));
    const b = add(f.line.p, mul(f.line.d, LABEL_HALF));
    return [
      { kind: 'line', a, b, halo: true, dashed },
      { kind: 'label', at: f.line.p, text: `${prefix}${f.label}` },
    ];
  }

  /** Reta de cada referência, apontando para o lado do elemento (o encontro fica do lado visível). */
  private refLine(f: AlignFeature): RefLine {
    const anchor = featureAnchor(f, this.env.project());
    const dir = norm(f.line.d);
    return { feature: f, anchor, from: dir, to: f.line.d };
  }

  /** Centro e direções de referência; null se as retas são paralelas. */
  private geometry(): { center: Vec2; a: RefLine; b: RefLine } | null {
    if (!this.refA || !this.refB) return null;
    const a = this.refLine(this.refA);
    const b = this.refLine(this.refB);
    const center = intersection(a.feature.line.p, a.from, b.feature.line.p, b.from);
    if (!center) return null;
    const orient = (r: RefLine): Vec2 => {
      const d = r.from;
      return dot(d, sub(r.anchor, center)) >= 0 ? d : { x: -d.x, y: -d.y };
    };
    return { center, a: { ...a, to: orient(a) }, b: { ...b, to: orient(b) } };
  }

  /** Lado escolhido pelo cursor: menor quando ele está no setor entre as direções, maior fora dele. */
  private sideAt(center: Vec2, from: Vec2, to: Vec2, cursor: Vec2): 'minor' | 'major' {
    const cd = sub(cursor, center);
    if (len(cd) < 1e-9) return 'minor';
    const cursorAngle = angleOf(norm(cd));
    const minor = Math.abs(wrapPi(angleOf(to) - angleOf(from)));
    return Math.abs(wrapPi(cursorAngle - angleOf(from))) <= minor ? 'minor' : 'major';
  }

  /** Raio limitado ao trecho visível das referências: o arco não ultrapassa as linhas selecionadas. */
  private radiusAt(g: { center: Vec2; a: RefLine; b: RefLine }, cursor: Vec2): number {
    const p = this.env.project();
    const maxFor = (r: RefLine): number => {
      const f = r.feature;
      const segs = f.seg ? [f.seg.a, f.seg.b] : (() => {
        const w = p.elements[f.ownerId];
        return w && w.kind === 'wall' ? [w.a, w.b] : [];
      })();
      let max = Infinity;
      for (const q of segs) {
        const d = dot(sub(q, g.center), r.to);
        if (d > 1e-6) max = Math.min(max, d);
      }
      return max;
    };
    const limit = Math.min(maxFor(g.a), maxFor(g.b));
    const wanted = Math.max(MIN_RADIUS, dist(cursor, g.center));
    return Number.isFinite(limit) ? Math.min(wanted, Math.max(MIN_RADIUS, limit * 0.92)) : wanted;
  }

  /** Dados da cota no lado escolhido pelo cursor: interno = menor; externo = volta >180°. */
  private angularData(g: { center: Vec2; a: RefLine; b: RefLine }, radius: number, cursor: Vec2): AngularDimension {
    const base = this.sideAt(g.center, g.a.to, g.b.to, cursor);
    const side: AngularDimensionSide = base === 'major' ? 'reflex' : 'minor';
    return angularDimensionData(g.center, g.a.to, g.b.to, radius, side, this.refA!.key, this.refB!.key, base);
  }

  private makePreview(cursor: Vec2): void {
    const g = this.geometry();
    if (!g) { this.previewDim = null; return; }
    const radius = this.radiusAt(g, cursor);
    const angular = this.angularData(g, radius, cursor);
    const o = this.env.options();
    const dim: Dimension = {
      id: 'preview-angular',
      a: g.center,
      b: add(g.center, mul(angular.to, radius)),
      offset: 0,
      angular,
      ...(o.dimensionPrecision !== undefined ? { precision: o.dimensionPrecision } : {}),
      textHeight: o.dimensionTextHeight ?? 2.5,
      tickStyle: o.dimensionTickStyle ?? 'slash',
    };
    this.previewDim = dim;
  }

  private refreshItems(): void {
    const items: PreviewItem[] = [];
    if (this.refA) items.push(...this.featureItems(this.refA, 'Referência 1: '));
    if (this.refB) items.push(...this.featureItems(this.refB, 'Referência 2: '));
    if (!this.refB) {
      const cand = this.current();
      if (cand) items.push(...this.featureItems(cand, this.refA ? 'Referência 2: ' : 'Referência 1: ', true));
    }
    if (this.previewDim?.angular) {
      const geom = angularDimensionGeometry(this.previewDim);
      if (geom) {
        for (let i = 1; i < geom.arc.length; i++) items.push({ kind: 'line', a: geom.arc[i - 1]!, b: geom.arc[i]! });
        for (const [a, b] of geom.extensions) items.push({ kind: 'line', a, b, dashed: true });
        for (const [a, b] of geom.ticks) items.push({ kind: 'line', a, b });
        items.push({ kind: 'label', at: geom.textAt, text: formatDimension(this.previewDim, 0, unitsOf(this.env.project())) });
      }
    }
    this.items = items;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    if (this.placing) {
      this.makePreview(p.raw);
      this.refreshItems();
      return;
    }
    this.updateHover(p.raw);
    this.refreshItems();
  }

  override tab(): void {
    if (this.placing) return;
    if (this.hover.length < 2) {
      if (this.hover[0]) this.env.say(`${this.hover[0].label}. ${this.hint}`);
      return;
    }
    this.hoverIndex = (this.hoverIndex + 1) % this.hover.length;
    this.refreshItems();
    this.env.say(`${this.current()!.label}. Clique para usar como referência; Tab troca a feição.`);
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    if (this.placing) {
      const g = this.geometry();
      if (!g || !this.previewDim?.angular) { this.env.say('As referências não formam um ângulo.'); return; }
      const radius = this.radiusAt(g, p.raw);
      const angular = this.angularData(g, radius, p.raw);
      const o = this.env.options();
      const dimension: Dimension = {
        id: newId('dim'),
        a: g.center,
        b: add(g.center, mul(angular.to, radius)),
        offset: 0,
        angular,
        ...(o.dimensionPrecision !== undefined ? { precision: o.dimensionPrecision } : {}),
        textHeight: o.dimensionTextHeight ?? 2.5,
        tickStyle: o.dimensionTickStyle ?? 'slash',
      };
      this.env.exec({ type: 'addDimension', levelId: this.env.levelId(), planId: viewPlanId(this.env), dimension });
      this.reset();
      this.env.say(this.hint);
      return;
    }
    this.updateHover(p.raw);
    const cand = this.current();
    if (!cand) {
      this.env.say('Clique sobre uma face, eixo ou núcleo de parede.');
      return;
    }
    if (!this.refA) {
      this.refA = cand;
      this.env.say(`Referência 1: ${cand.label}. Clique na segunda referência (Tab troca a feição).`);
      this.refreshItems();
      return;
    }
    if (cand.key === this.refA.key) {
      this.env.say('Escolha uma segunda referência diferente da primeira.');
      return;
    }
    const trial = this.geometryWith(this.refA, cand);
    if (!trial) {
      this.env.say('As duas referências são paralelas: escolha linhas que se cruzam.');
      return;
    }
    this.refB = cand;
    this.placing = true;
    this.makePreview(p.raw);
    this.refreshItems();
    this.env.say('Mova o cursor para o lado do ângulo e para o raio do arco; clique para criar a cota.');
  }

  private geometryWith(a0: AlignFeature, b0: AlignFeature): { center: Vec2; a: RefLine; b: RefLine } | null {
    const a = this.refLine(a0);
    const b = this.refLine(b0);
    const center = intersection(a.feature.line.p, a.from, b.feature.line.p, b.from);
    if (!center) return null;
    const orient = (r: RefLine): Vec2 => (dot(r.from, sub(r.anchor, center)) >= 0 ? r.from : { x: -r.from.x, y: -r.from.y });
    return { center, a: { ...a, to: orient(a) }, b: { ...b, to: orient(b) } };
  }

  override confirm(): void {
    if (this.refA && this.refB) {
      this.reset();
      this.env.say(this.hint);
      return;
    }
    super.confirm();
  }
}
