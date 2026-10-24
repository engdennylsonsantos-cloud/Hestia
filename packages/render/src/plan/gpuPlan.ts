import * as THREE from 'three';
import { triangulate, type Mesh2D, type Polygon, type Vec2 } from '@hestia/geom';
import type { Viewport } from '../viewport.ts';
import { DOT_PX, HATCH_PX, hatchSegments } from './hatch.ts';
import type { PlanDrawList, StrokeOp } from './types.ts';

const triCache = new WeakMap<Polygon, Mesh2D>();
function tri(p: Polygon): Mesh2D {
  let m = triCache.get(p);
  if (!m) {
    m = triangulate(p);
    triCache.set(p, m);
  }
  return m;
}

interface Batch {
  key: string;
  color: string;
  alpha: number;
  pos: number[];
  idx: number[];
}

/** Cena ortográfica 2D: consome a lista de desenho neutra e a transforma em malhas na GPU. */
export class PlanScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  private group = new THREE.Group();
  private mats = new Map<string, THREE.MeshBasicMaterial>();

  constructor() {
    this.scene.add(this.group);
    this.camera.position.set(0, 0, 10);
  }

  /**
   * Todo material é transparente (mesmo opaco): o three.js desenha os opacos antes dos transparentes, e isso poria a hachura
   * por cima das paredes, que vêm depois na lista. Com tudo no mesmo grupo, a ordem é a da lista (`renderOrder`),
   * como no CPU (decisão 0015 §2.4). A hachura é vetorial (linhas e pontos), então não há textura para amostrar com o zoom.
   */
  private material(key: string, color: string, alpha: number): THREE.MeshBasicMaterial {
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: alpha,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.mats.set(key, m);
    }
    return m;
  }

  setViewport(v: Viewport): void {
    const hw = v.width / 2 / v.zoom;
    const hh = v.height / 2 / v.zoom;
    this.camera.left = -hw;
    this.camera.right = hw;
    this.camera.top = hh;
    this.camera.bottom = -hh;
    this.camera.position.set(v.cx, v.cy, 10);
    this.camera.updateProjectionMatrix();
  }

  private clear(): void {
    for (const ch of [...this.group.children]) {
      const m = ch as THREE.Mesh;
      m.geometry.dispose();
      this.group.remove(m);
    }
  }

  setDrawList(dl: PlanDrawList, v: Viewport): void {
    this.clear();
    this.scene.background = new THREE.Color(dl.background);
    let order = 0;
    const flush = (b: Batch | null): void => {
      if (!b || b.idx.length === 0) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setIndex(b.idx);
      const mesh = new THREE.Mesh(g, this.material(b.key, b.color, b.alpha));
      mesh.renderOrder = order++;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    };

    // Uma lista corrente: troca de lote só quando muda cor, alfa ou tipo, na ordem em que os itens aparecem.
    let cur: Batch | null = null;
    const batchFor = (key: string, color: string, alpha: number): Batch => {
      if (cur && cur.key === key) return cur;
      flush(cur);
      cur = { key, color, alpha, pos: [], idx: [] };
      return cur;
    };
    const fillPolygon = (poly: Polygon, color: string, alpha: number): void => {
      const m = tri(poly);
      if (m.indices.length === 0) return;
      const b = batchFor(`f|${color}|${alpha}`, color, alpha);
      const base = b.pos.length / 3;
      for (let i = 0; i < m.positions.length; i += 2) b.pos.push(m.positions[i]!, m.positions[i + 1]!, 0);
      for (const k of m.indices) b.idx.push(base + k);
    };
    for (const f of dl.fills) {
      for (const poly of f.polygons) fillPolygon(poly, f.color, f.alpha);
      if (!f.hatch) continue;
      const { kind, color } = f.hatch;
      const alpha = f.hatch.alpha ?? 1;
      if (kind === 'solid') {
        for (const poly of f.polygons) fillPolygon(poly, color, alpha);
        continue;
      }
      // Hachura vetorial: linhas de HATCH_PX (pontos de DOT_PX) recortadas ao contorno, com a mesma espessura em qualquer zoom.
      for (const poly of f.polygons) {
        for (const s of hatchSegments(poly, kind)) {
          const b = batchFor(`h|${color}|${alpha}`, color, alpha);
          quad(b, s.a, s.b, (s.dot ? DOT_PX : HATCH_PX) / v.zoom);
        }
      }
    }
    flush(cur);
    cur = null;

    const strokeBatch = (s: StrokeOp): Batch => batchFor(`s|${s.color}|${s.alpha}`, s.color, s.alpha);
    for (const s of dl.strokes) {
      const b = strokeBatch(s);
      const w = s.widthPx / v.zoom;
      const segs = s.dash ? dashSegments(s.pts, s.closed, s.dash[0] / v.zoom, s.dash[1] / v.zoom) : edges(s.pts, s.closed);
      for (const [p, q] of segs) quad(b, p, q, w);
    }
    flush(cur);
  }

  dispose(): void {
    this.clear();
    for (const m of this.mats.values()) m.dispose();
  }
}

function edges(pts: Vec2[], closed: boolean): Array<[Vec2, Vec2]> {
  const out: Array<[Vec2, Vec2]> = [];
  for (let i = 0; i < pts.length - 1; i++) out.push([pts[i]!, pts[i + 1]!]);
  if (closed && pts.length > 2) out.push([pts[pts.length - 1]!, pts[0]!]);
  return out;
}

function dashSegments(pts: Vec2[], closed: boolean, dash: number, gap: number): Array<[Vec2, Vec2]> {
  const out: Array<[Vec2, Vec2]> = [];
  let on = true;
  let left = dash;
  for (const [a, b] of edges(pts, closed)) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1e-12) continue;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    let t = 0;
    while (t < L) {
      const step = Math.min(left, L - t);
      if (on) out.push([{ x: a.x + ux * t, y: a.y + uy * t }, { x: a.x + ux * (t + step), y: a.y + uy * (t + step) }]);
      t += step;
      left -= step;
      if (left <= 1e-12) {
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
  return out;
}

/**
 * Traço de espessura `w` (metros) de `p` a `q`, com ponta de meia espessura em cada extremo. Vale para linhas inteiras,
 * tracejados e hachura: a ponta evita a falha de cobertura nos cantos de contornos tracejados.
 */
function quad(b: Batch, p: Vec2, q: Vec2, w: number): void {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return;
  const ux = dx / L;
  const uy = dy / L;
  const h = w / 2;
  const nx = -uy * h;
  const ny = ux * h;
  const ax = p.x - ux * h;
  const ay = p.y - uy * h;
  const bx = q.x + ux * h;
  const by = q.y + uy * h;
  const base = b.pos.length / 3;
  b.pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0);
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
