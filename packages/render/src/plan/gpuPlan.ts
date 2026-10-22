import * as THREE from 'three';
import { triangulate, type Mesh2D, type Polygon, type Vec2 } from '@hestia/geom';
import type { Viewport } from '../viewport.ts';
import type { PlanDrawList, StrokeOp } from './types.ts';

const HATCH_TILE = 0.2; // metros por repetição do padrão

const triCache = new WeakMap<Polygon, Mesh2D>();
function tri(p: Polygon): Mesh2D {
  let m = triCache.get(p);
  if (!m) {
    m = triangulate(p);
    triCache.set(p, m);
  }
  return m;
}

function hatchTexture(kind: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  // `solid`: textura cheia; a cor da hachura entra pelo material (cor × textura), como nos demais padrões (decisão 0015 §2.8).
  if (kind === 'solid') g.fillRect(0, 0, 64, 64);
  if (kind === 'diagonal' || kind === 'cross') {
    for (let k = -64; k <= 64; k += 16) {
      g.moveTo(k, 64);
      g.lineTo(k + 64, 0);
    }
  }
  if (kind === 'cross') {
    for (let k = -64; k <= 64; k += 16) {
      g.moveTo(k, 0);
      g.lineTo(k + 64, 64);
    }
  }
  g.stroke();
  if (kind === 'dots') {
    for (let x = 8; x < 64; x += 16) for (let y = 8; y < 64; y += 16) g.fillRect(x, y, 4, 4);
  }
  // `gesso` (forro, D3): tracejado leve, um traço horizontal a cada 16 px.
  if (kind === 'gesso') {
    for (let y = 8; y < 64; y += 16) for (let x = 0; x < 64; x += 16) g.fillRect(x, y, 10, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Batch {
  key: string;
  color: string;
  alpha: number;
  hatch?: string;
  pos: number[];
  uv: number[];
  idx: number[];
}

/** Cena ortográfica 2D: consome a lista de desenho neutra e a transforma em malhas na GPU. */
export class PlanScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  private group = new THREE.Group();
  private mats = new Map<string, THREE.MeshBasicMaterial>();
  private hatchTex = new Map<string, THREE.Texture | null>();

  constructor() {
    this.scene.add(this.group);
    this.camera.position.set(0, 0, 10);
  }

  /**
   * Todo material é transparente (mesmo opaco): o three.js desenha os opacos antes dos transparentes, e isso poria a hachura
   * (com textura) por cima das paredes, que vêm depois na lista. Com tudo no mesmo grupo, a ordem é a da lista (`renderOrder`),
   * como no CPU (decisão 0015 §2.4). Um pixel de alfa 1 sobrescreve; um de alfa 0 da textura não altera o que está embaixo.
   */
  private material(key: string, color: string, alpha: number, map?: THREE.Texture | null): THREE.MeshBasicMaterial {
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: alpha,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        map: map ?? null,
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
      if (b.hatch) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      let map: THREE.Texture | null | undefined;
      if (b.hatch) {
        if (!this.hatchTex.has(b.hatch)) this.hatchTex.set(b.hatch, hatchTexture(b.hatch));
        map = this.hatchTex.get(b.hatch);
      }
      const mesh = new THREE.Mesh(g, this.material(`${b.key}`, b.color, b.alpha, map));
      mesh.renderOrder = order++;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    };

    let cur: Batch | null = null;
    const fillBatch = (hatch: string | undefined, color: string, alpha: number): Batch => {
      const key = `${color}|${alpha}|${hatch ?? ''}`;
      if (cur && cur.key === key) return cur;
      flush(cur);
      cur = { key, color, alpha, hatch, pos: [], uv: [], idx: [] };
      return cur;
    };
    for (const f of dl.fills) {
      const pass: Array<{ hatch?: string; color: string; alpha: number }> = [{ color: f.color, alpha: f.alpha }];
      if (f.hatch) pass.push({ hatch: f.hatch.kind, color: f.hatch.color, alpha: f.hatch.alpha ?? 1 });
      for (const ps of pass) {
        for (const poly of f.polygons) {
          const m = tri(poly);
          if (m.indices.length === 0) continue;
          const b = fillBatch(ps.hatch, ps.color, ps.alpha);
          const base = b.pos.length / 3;
          for (let i = 0; i < m.positions.length; i += 2) {
            const x = m.positions[i]!;
            const y = m.positions[i + 1]!;
            b.pos.push(x, y, 0);
            if (ps.hatch) b.uv.push(x / HATCH_TILE, y / HATCH_TILE);
          }
          for (const k of m.indices) b.idx.push(base + k);
        }
      }
    }
    flush(cur);
    cur = null;

    const strokeBatch = (s: StrokeOp): Batch => {
      const key = `s|${s.color}|${s.alpha}`;
      if (cur && cur.key === key) return cur;
      flush(cur);
      cur = { key, color: s.color, alpha: s.alpha, pos: [], uv: [], idx: [] };
      return cur;
    };
    for (const s of dl.strokes) {
      const b = strokeBatch(s);
      const w = s.widthPx / v.zoom;
      const segs = s.dash ? dashSegments(s.pts, s.closed, s.dash[0] / v.zoom, s.dash[1] / v.zoom) : edges(s.pts, s.closed);
      for (const [p, q] of segs) quad(b, p, q, w, !s.dash);
    }
    flush(cur);
  }

  dispose(): void {
    this.clear();
    for (const m of this.mats.values()) m.dispose();
    for (const t of this.hatchTex.values()) t?.dispose();
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

function quad(b: Batch, p: Vec2, q: Vec2, w: number, capped: boolean): void {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return;
  const ux = dx / L;
  const uy = dy / L;
  const h = w / 2;
  const e = capped ? h : 0;
  const nx = -uy * h;
  const ny = ux * h;
  const ax = p.x - ux * e;
  const ay = p.y - uy * e;
  const bx = q.x + ux * e;
  const by = q.y + uy * e;
  const base = b.pos.length / 3;
  b.pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0);
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
