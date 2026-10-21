import * as THREE from 'three';
import { applyPartialStructure, frameOfWall, openingGeometry, resolveFloors, resolveRoofs, resolveSlabs, resolveStairs, stairArrivalTopZ, type ResolvedLevel } from '@hestia/engine';
import { openingsOfWall, view3dOf, wallBaseElevation, wallHeight, wallsOnLevel, type GraphicsCategory, type Material, type Project, type View3DSettings, type VisualStyle } from '@hestia/model';
import { mix } from '../plan/color.ts';
import { OrbitCamera } from './orbit.ts';
import { buildEaveSolids } from './eaveSolids.ts';
import { buildStairSolids } from './stairSolids.ts';
import { buildFloorSolids, buildLevelSolids, buildRoofSolids, buildSlabSolids, type SolidBatch } from './solids.ts';

/**
 * Opções herdadas. A vista 3D lê arestas e sombras de `view3dOf(p)` (decisão 0015 §2.2): `edges` e `shadows` são
 * ignorados e ficam só por compatibilidade. `dark` vem do tema.
 */
export interface Scene3DOptions {
  edges: boolean;
  shadows: boolean;
  dark: boolean;
}

/** Ângulo (graus) acima do qual uma aresta da malha é desenhada. */
const EDGE_ANGLE = 28;
/** Cor do papel nas linhas ocultas: branco no claro e cinza escuro no escuro (a cor do chão escuro). */
const PAPER = { light: 0xffffff, dark: 0x2a2f36 };
/** Fundo do tema, quando `view3d.background` é null. */
const BACKGROUND = { light: '#dfe7ee', dark: '#14171b' };
/** Distância da luz em raios do modelo: |(0,7; −0,5; 1,1)|, a posição do sol antes da vista 3D configurável. */
const SUN_DISTANCE = Math.hypot(0.7, 0.5, 1.1);

/** Direção unitária do sol, de alvo para luz: azimute em graus (0 = leste, anti-horário) e elevação acima do horizonte. */
export function sunDirection(azimuth: number, elevation: number): THREE.Vector3 {
  const a = (azimuth * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e));
}

/** Estilos de linhas: sempre mostram as arestas, com ou sem faces. */
const isLineStyle = (s: VisualStyle): boolean => s === 'hiddenLine' || s === 'wireframe';
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Estado de uma atualização: a vista 3D, o tema e as arestas e sombras efetivas desta vista. */
interface Frame3D {
  view: View3DSettings;
  dark: boolean;
  /** Arestas das malhas do modelo (paredes, pisos, lajes, telhados, escadas). Nas linhas, sempre. */
  edges: boolean;
  /** Sombras projetadas: só no estilo realista, com `view.shadows`. */
  shadows: boolean;
}

/** Cena 3D do modelo: paredes e pisos por camada com material, esquadrias, luz e chão. */
export class ModelScene {
  readonly scene = new THREE.Scene();
  readonly orbit = new OrbitCamera();
  private model = new THREE.Group();
  /** Materiais por chave (estilo, tema, categoria, transparência, meio-tom, material). Os que a última atualização não usou saem. */
  private mats = new Map<string, THREE.Material>();
  private used = new Set<string>();
  private frame: Frame3D = { view: view3dOf({}), dark: false, edges: false, shadows: false };
  private sun = new THREE.DirectionalLight(0xffffff, 2.1);
  private ground: THREE.Mesh;
  private grid: THREE.GridHelper;
  private boxCache = new THREE.Box3();

  constructor() {
    this.scene.add(this.model);
    const hemi = new THREE.HemisphereLight(0xf4f7fb, 0xb9b2a4, 1.25);
    hemi.position.set(0, 0, 1);
    this.scene.add(hemi);
    this.sun.position.set(14, -10, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0xe3dfd6, roughness: 1 }),
    );
    this.ground.position.z = -0.03;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(100, 100, 0xb9b3a6, 0xcfcabd);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = -0.02;
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.45;
    this.scene.add(this.grid);
  }

  /** Material em cache com a chave dada; marca a chave como usada nesta atualização. */
  private cached<T extends THREE.Material>(key: string, make: () => T): T {
    this.used.add(key);
    let mat = this.mats.get(key) as T | undefined;
    if (!mat) {
      mat = make();
      this.mats.set(key, mat);
    }
    return mat;
  }

  /**
   * Material de uma face. Estilo realista: luz solar e brilho. Sombreado: cor do material com luz simples. Cores
   * consistentes: cor do material sem luz. Linhas ocultas: papel, com polygonOffset para as arestas não vazarem.
   * A substituição da categoria (cor, transparência, meio-tom) entra na chave: cada categoria tem seu material.
   */
  private faceMaterial(m: Material | undefined, cat: GraphicsCategory, fallback = '#999999'): THREE.Material {
    const { view, dark } = this.frame;
    const style = view.style;
    const ov = view.overrides[cat];
    const t = clamp01(ov.transparency);
    if (style === 'hiddenLine') {
      return this.cached(`${style}|${dark}|${cat}|${t}`, () => new THREE.MeshBasicMaterial({
        color: dark ? PAPER.dark : PAPER.light,
        transparent: t > 0,
        opacity: 1 - t,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }));
    }
    const gloss = m?.gloss ?? 0.1;
    const base = m?.opacity ?? 1;
    const colorOf = ov.color ?? m?.color ?? fallback;
    const color = ov.halftone ? mix(colorOf, '#ffffff', 0.5) : colorOf;
    const key = [style, dark, cat, t, ov.color ?? '', ov.halftone, m?.id ?? '', m?.color ?? '', gloss, base, fallback].join('|');
    return this.cached(key, () => {
      const opacity = base * (1 - t);
      const props = { color: new THREE.Color(color), transparent: opacity < 1, opacity, side: THREE.FrontSide };
      if (style === 'realistic') {
        return new THREE.MeshStandardMaterial({ ...props, roughness: 1 - gloss * 0.75, metalness: m && m.id === 'mat_aluminio' ? 0.5 : 0 });
      }
      if (style === 'shaded') return new THREE.MeshLambertMaterial(props);
      return new THREE.MeshBasicMaterial(props);
    });
  }

  /** Material das arestas (claro: quase preto; escuro: quase branco), meio transparente. */
  private edgeMaterial(): THREE.LineBasicMaterial {
    const dark = this.frame.dark;
    return this.cached(`edge|${dark}`, () => new THREE.LineBasicMaterial({ color: dark ? 0xd7dde5 : 0x1c2026, transparent: true, opacity: 0.5 }));
  }

  /**
   * Desenha uma peça: a malha, quando o estilo tem faces, e as arestas, quando `edges`. No wireframe a geometria serve só
   * para as arestas (que são cópias), então é descartada.
   */
  private draw(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: Material | undefined, cat: GraphicsCategory, edges: boolean): void {
    const faces = this.frame.view.style !== 'wireframe';
    if (faces) {
      const mesh = new THREE.Mesh(geo, this.faceMaterial(m, cat));
      mesh.castShadow = this.frame.shadows;
      mesh.receiveShadow = this.frame.shadows;
      parent.add(mesh);
    }
    if (edges) parent.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, EDGE_ANGLE), this.edgeMaterial()));
    if (!faces) geo.dispose();
  }

  private clearModel(): void {
    for (const ch of [...this.model.children]) {
      this.model.remove(ch);
      ch.traverse((o) => {
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        g?.dispose();
      });
    }
  }

  update(p: Project, levels: ResolvedLevel[], opt: Scene3DOptions): void {
    const view = view3dOf(p);
    this.frame = {
      view,
      dark: opt.dark,
      edges: isLineStyle(view.style) || view.edges,
      shadows: view.style === 'realistic' && view.shadows,
    };
    this.used = new Set();
    this.clearModel();
    const shown = (c: GraphicsCategory): boolean => view.overrides[c].visible;
    const stairs = resolveStairs(p);
    for (const lv0 of levels) {
      // Exibição parcial (decisão 0015 §2.5): as camadas de parede são filtradas antes dos sólidos e das aberturas.
      const lv = applyPartialStructure(p, lv0, view.partialStructure);
      // Pisos, lajes e telhados do nível: uma malha por material, com os furos e as inclinações (D2); o beiral (C5) à parte.
      // Categoria oculta: não gera as malhas dela (decisão 0015 §2.4).
      const roofs = shown('roof') ? resolveRoofs(p, lv.levelId) : [];
      const eave = buildEaveSolids(p, roofs);
      // Escadas do nível (decisão 0011 §1): uma malha por material do tipo; escada com erro não gera malha. A chegada
      // monolítica termina na face inferior da laje que cobre o último espelho (decisão 0012 §2, `stairArrivalTopZ`).
      const batches: SolidBatch[] = [
        ...(shown('wall') ? buildLevelSolids(lv).batches : []),
        ...(shown('floor') ? buildFloorSolids(resolveFloors(p, lv.levelId)) : []),
        ...(shown('slab') ? buildSlabSolids(resolveSlabs(p, lv.levelId)) : []),
        ...buildRoofSolids(roofs),
        ...eave.batches,
        ...(shown('stair') ? buildStairSolids(stairs.filter((s) => s.levelId === lv.levelId), (s) => stairArrivalTopZ(p, s)) : []),
      ];
      for (const b of batches) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
        g.setIndex(b.indices);
        this.draw(this.model, g, p.materials[b.materialId] ?? eave.materials[b.materialId], b.category, this.frame.edges);
      }
      for (const w of wallsOnLevel(p, lv.levelId)) {
        const f = frameOfWall(p, w.id);
        if (!f) continue;
        for (const o of openingsOfWall(p, w.id)) {
          // Base e altura resolvidas (paredes anexadas a pisos mudam de cota); sem resolução, as do modelo.
          const rw = lv.walls[w.id];
          const grp = this.openingObject(p, o, f, rw?.baseZ ?? wallBaseElevation(p, w), rw?.height ?? wallHeight(p, w));
          if (grp) this.model.add(grp);
        }
      }
    }
    this.boxCache = new THREE.Box3().setFromObject(this.model);
    const bg = new THREE.Color(view.background ?? (opt.dark ? BACKGROUND.dark : BACKGROUND.light));
    this.ground.visible = view.style !== 'wireframe';
    this.ground.receiveShadow = this.frame.shadows;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(opt.dark ? 0x2a2f36 : 0xe3dfd6);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 60, 170);
    this.sun.castShadow = this.frame.shadows;
    if (!this.boxCache.isEmpty()) {
      const c = this.boxCache.getCenter(new THREE.Vector3());
      const r = Math.max(8, this.boxCache.getSize(new THREE.Vector3()).length());
      this.sun.target.position.copy(c);
      this.sun.position.copy(c).addScaledVector(sunDirection(view.sunAzimuth, view.sunElevation), r * SUN_DISTANCE);
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = r * 4;
      cam.updateProjectionMatrix();
    }
    // Materiais que esta atualização não usou (outro estilo, outra substituição) saem da memória.
    for (const [k, m] of this.mats) {
      if (this.used.has(k)) continue;
      m.dispose();
      this.mats.delete(k);
    }
  }

  private openingObject(p: Project, o: ReturnType<typeof openingsOfWall>[number], f: NonNullable<ReturnType<typeof frameOfWall>>, baseZ: number, H: number): THREE.Group | null {
    const cat: GraphicsCategory = o.kind;
    if (!this.frame.view.overrides[cat].visible) return null;
    const g = openingGeometry(p, o, f);
    const t = p.openingTypes[o.typeId];
    if (!t) return null;
    // Vão livre: só o recorte da parede; sem folha nem caixilho.
    if (g.kind === 'door' && g.leaves === 0) return null;
    const grp = new THREE.Group();
    const h = Math.min(g.height, H - g.sill);
    // Aberturas só têm arestas nos estilos de linhas (nos estilos com cor, como antes, não).
    const edges = isLineStyle(this.frame.view.style);
    const frameMat = p.materials[t.frameMaterialId];
    const glassMat = p.materials[t.glassMaterialId];
    const add = (w: number, d: number, hh: number, x: number, z: number, m: Material | undefined): void => {
      this.draw(grp, new THREE.BoxGeometry(w, d, hh).translate(x, 0, z), m, cat, edges);
    };
    const jamb = 0.05;
    const depth = Math.min(g.thickness, 0.09);
    add(jamb, depth, h, -g.width / 2 + jamb / 2, h / 2, frameMat);
    add(jamb, depth, h, g.width / 2 - jamb / 2, h / 2, frameMat);
    add(g.width, depth, jamb, 0, h - jamb / 2, frameMat);
    if (g.kind === 'window') {
      add(g.width, depth, jamb, 0, jamb / 2, frameMat);
      add(g.width - jamb * 2, 0.012, h - jamb * 2, 0, h / 2, glassMat);
      if (g.leaves === 2) add(0.04, depth, h - jamb * 2, 0, h / 2, frameMat);
    } else {
      add(g.width - jamb * 2, 0.04, h - jamb, 0, (h - jamb) / 2, frameMat);
    }
    grp.rotation.z = Math.atan2(g.u.y, g.u.x);
    grp.position.set(g.center.x, g.center.y, baseZ + g.sill);
    return grp;
  }

  bounds(): THREE.Box3 {
    return this.boxCache;
  }

  fit(): void {
    if (this.boxCache.isEmpty()) {
      this.orbit.target.set(0, 0, 1);
      this.orbit.distance = 14;
      this.orbit.apply();
    } else this.orbit.fit(this.boxCache);
  }

  dispose(): void {
    this.clearModel();
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
  }
}
