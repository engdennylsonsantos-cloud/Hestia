import * as THREE from 'three';
import { frameOfWall, openingGeometry, resolveFloors, type ResolvedLevel } from '@hestia/engine';
import { wallBaseElevation, wallHeight, wallsOnLevel, openingsOfWall, type Material, type Project } from '@hestia/model';
import { OrbitCamera } from './orbit.ts';
import { buildFloorSolids, buildLevelSolids } from './solids.ts';

export interface Scene3DOptions {
  edges: boolean;
  shadows: boolean;
  dark: boolean;
}

/** Cena 3D do modelo: paredes e pisos por camada com material, esquadrias, luz e chão. */
export class ModelScene {
  readonly scene = new THREE.Scene();
  readonly orbit = new OrbitCamera();
  private model = new THREE.Group();
  private mats = new Map<string, THREE.MeshStandardMaterial>();
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

  private material(m: Material | undefined, fallback = '#999999'): THREE.MeshStandardMaterial {
    const key = `${m?.id}|${m?.color}|${m?.gloss}|${m?.opacity}`;
    let mat = this.mats.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(m?.color ?? fallback),
        roughness: 1 - (m?.gloss ?? 0.1) * 0.75,
        metalness: m && m.id === 'mat_aluminio' ? 0.5 : 0,
        transparent: (m?.opacity ?? 1) < 1,
        opacity: m?.opacity ?? 1,
        side: THREE.FrontSide,
      });
      this.mats.set(key, mat);
    }
    return mat;
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
    this.clearModel();
    const edgeMat = new THREE.LineBasicMaterial({ color: opt.dark ? 0xd7dde5 : 0x1c2026, transparent: true, opacity: 0.5 });
    for (const lv of levels) {
      const solids = buildLevelSolids(lv);
      // Pisos do nível: uma malha por material, com os furos (D2).
      const batches = [...solids.batches, ...buildFloorSolids(resolveFloors(p, lv.levelId))];
      for (const b of batches) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
        g.setIndex(b.indices);
        const mesh = new THREE.Mesh(g, this.material(p.materials[b.materialId]));
        mesh.castShadow = opt.shadows;
        mesh.receiveShadow = opt.shadows;
        this.model.add(mesh);
        if (opt.edges) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat);
          this.model.add(e);
        }
      }
      for (const w of wallsOnLevel(p, lv.levelId)) {
        const f = frameOfWall(p, w.id);
        if (!f) continue;
        for (const o of openingsOfWall(p, w.id)) {
          // Base e altura resolvidas (paredes anexadas a pisos mudam de cota); sem resolução, as do modelo.
          const rw = lv.walls[w.id];
          const grp = this.openingObject(p, o, f, rw?.baseZ ?? wallBaseElevation(p, w), rw?.height ?? wallHeight(p, w), opt);
          if (grp) this.model.add(grp);
        }
      }
    }
    this.boxCache = new THREE.Box3().setFromObject(this.model);
    this.ground.material = this.ground.material as THREE.Material;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(opt.dark ? 0x2a2f36 : 0xe3dfd6);
    const bg = new THREE.Color(opt.dark ? 0x14171b : 0xdfe7ee);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 60, 170);
    this.sun.castShadow = opt.shadows;
    if (!this.boxCache.isEmpty()) {
      const c = this.boxCache.getCenter(new THREE.Vector3());
      const r = Math.max(8, this.boxCache.getSize(new THREE.Vector3()).length());
      this.sun.target.position.copy(c);
      this.sun.position.set(c.x + r * 0.7, c.y - r * 0.5, c.z + r * 1.1);
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = r * 4;
      cam.updateProjectionMatrix();
    }
  }

  private openingObject(p: Project, o: ReturnType<typeof openingsOfWall>[number], f: NonNullable<ReturnType<typeof frameOfWall>>, baseZ: number, H: number, opt: Scene3DOptions): THREE.Group | null {
    const g = openingGeometry(p, o, f);
    const t = p.openingTypes[o.typeId];
    if (!t) return null;
    // Vão livre: só o recorte da parede; sem folha nem caixilho.
    if (g.kind === 'door' && g.leaves === 0) return null;
    const grp = new THREE.Group();
    const h = Math.min(g.height, H - g.sill);
    const frameMat = this.material(p.materials[t.frameMaterialId]);
    const glassMat = this.material(p.materials[t.glassMaterialId]);
    const add = (w: number, d: number, hh: number, x: number, z: number, mat: THREE.Material): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, hh), mat);
      mesh.position.set(x, 0, z);
      mesh.castShadow = opt.shadows;
      mesh.receiveShadow = opt.shadows;
      grp.add(mesh);
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
  }
}
