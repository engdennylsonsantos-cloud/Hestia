import * as THREE from 'three';
import { applyPartialStructure, frameOfWall, openingGeometry, resolveCeilings, junctionLevel, resolveFloors, resolveRoofs, resolveSlabs, resolveStairs, stairArrivalTopZ, type ResolvedLevel } from '@hestia/engine';
import { openingsOfWall, view3dOf, wallBaseElevation, wallHeight, wallsOnLevel, type GraphicsCategory, type Id, type Material, type Project, type View3DSettings, type VisualStyle } from '@hestia/model';
import { DARK, LIGHT } from '../plan/types.ts';
import { mix } from '../plan/color.ts';
import { OrbitCamera } from './orbit.ts';
import { firstSurfaceDistance } from './pick3d.ts';
import { openingPieces } from './openingParts.ts';
import { buildEaveSolids } from './eaveSolids.ts';
import { buildStairSolids } from './stairSolids.ts';
import { disposeHighlight, highlightOf, type HighlightStyle } from './highlight3d.ts';
import { buildCeilingSolids, buildFloorSolids, buildLevelSolids, buildRoofSolids, buildSlabSolids, type ElementRange, type SolidBatch } from './solids.ts';

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

/** Sobreposição de realce (seleção ou elemento sob o cursor) e a chave que a identifica, para não refazê-la à toa. */
interface Highlight {
  key: string;
  obj: THREE.Object3D;
}
/** Ranhuras do realce: a seleção (`sel`) e o elemento sob o cursor (`hov`). */
type HighlightSlot = 'sel' | 'hov';

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
  /** Sobreposições de realce, fora do modelo: não entram nas malhas do modelo nem no picking por faixas. */
  private highlightLayer = new THREE.Object3D();
  /** Malhas só de picking no wireframe (fora do modelo; ver `buildPickLayer`) e as peças que as originam nesta atualização. */
  private pickLayer = new THREE.Object3D();
  private pickSources: Array<{ geo: THREE.BufferGeometry; owner: THREE.Object3D; kind: GraphicsCategory; ranges: ElementRange[] }> = [];
  private hl: Record<HighlightSlot, Highlight | null> = { sel: null, hov: null };
  /** Materiais por chave (estilo, tema, categoria, transparência, meio-tom, material). Os que a última atualização não usou saem. */
  private mats = new Map<string, THREE.Material>();
  private used = new Set<string>();
  private frame: Frame3D = { view: view3dOf({}), dark: false, edges: false, shadows: false };
  private sun = new THREE.DirectionalLight(0xffffff, 2.1);
  private ground: THREE.Mesh;
  private grid: THREE.GridHelper;
  private boxCache = new THREE.Box3();

  constructor() {
    // O zoom da órbita não atravessa as paredes do modelo (a cena fornece a primeira superfície sobre o eixo de visão).
    this.orbit.obstacle = (origin, dir) => firstSurfaceDistance(this.model, origin, dir);
    this.scene.add(this.model);
    this.scene.add(this.pickLayer);
    this.scene.add(this.highlightLayer);
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
   * Desenha uma peça: a malha, quando o estilo tem faces, e as arestas, quando `edges`. A malha leva `userData.kind`
   * (categoria) e `userData.ranges` (faixas dos elementos, decisão 0016), que é o que o picking lê. No wireframe não há
   * faces na cena (decisão 0015): a geometria vai para a lista de picking, montada à parte no fim (`buildPickLayer`).
   */
  private draw(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: Material | undefined, cat: GraphicsCategory, edges: boolean, ranges: ElementRange[]): void {
    if (this.frame.view.style !== 'wireframe') {
      const mesh = new THREE.Mesh(geo, this.faceMaterial(m, cat));
      mesh.castShadow = this.frame.shadows;
      mesh.receiveShadow = this.frame.shadows;
      mesh.userData = { kind: cat, ranges };
      parent.add(mesh);
    } else this.pickSources.push({ geo, owner: parent, kind: cat, ranges });
    if (edges) parent.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, EDGE_ANGLE), this.edgeMaterial()));
  }

  /**
   * Malhas só de picking no wireframe: sem cor nem profundidade (não aparecem), na transformação do grupo de origem. Fora do
   * modelo (`pickLayer`), para o modelo continuar sem malhas nesse estilo.
   */
  private buildPickLayer(): void {
    if (!this.pickSources.length) return;
    this.model.updateMatrixWorld(true);
    const pick = this.cached('pick', () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    for (const s of this.pickSources) {
      const mesh = new THREE.Mesh(s.geo, pick);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(s.owner.matrixWorld);
      mesh.userData = { kind: s.kind, ranges: s.ranges };
      this.pickLayer.add(mesh);
    }
    this.pickSources = [];
  }

  private clearModel(): void {
    for (const ch of [...this.model.children]) {
      this.model.remove(ch);
      ch.traverse((o) => {
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        g?.dispose();
      });
    }
    for (const ch of [...this.pickLayer.children]) {
      this.pickLayer.remove(ch);
      ch.traverse((o) => {
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        g?.dispose();
      });
    }
    this.pickSources = [];
  }

  /**
   * Realce na vista 3D (decisão 0016 §4): a seleção (preenchimento 0,35, arestas firmes) e o elemento sob o cursor
   * (0,15, se não for da seleção). Só refaz a sobreposição que mudou; a malha do modelo não é reconstruída.
   */
  highlight(selection: readonly Id[], hover: Id | null): void {
    const color = this.frame.dark ? DARK.select : LIGHT.select;
    this.setHighlight('sel', selection, { color, fill: 0.35, edges: 1 });
    this.setHighlight('hov', hover && !selection.includes(hover) ? [hover] : [], { color, fill: 0.15, edges: 0.6 });
  }

  private setHighlight(slot: HighlightSlot, ids: readonly Id[], style: HighlightStyle): void {
    const key = `${String(style.color)}|${ids.join(',')}`;
    const cur = this.hl[slot];
    if (cur?.key === key) return;
    if (cur) this.dropHighlight(slot);
    if (!ids.length) return;
    const obj = highlightOf(this.scene, ids, style);
    this.highlightLayer.add(obj);
    this.hl[slot] = { key, obj };
  }

  private dropHighlight(slot: HighlightSlot): void {
    const cur = this.hl[slot];
    if (!cur) return;
    this.highlightLayer.remove(cur.obj);
    disposeHighlight(cur.obj);
    this.hl[slot] = null;
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
    // O realce guarda cópias dos triângulos: com o modelo refeito, refaz-se (a seleção e o cursor são lidos de novo).
    this.dropHighlight('sel');
    this.dropHighlight('hov');
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
        // Paredes com a junção (0023 F4): cada faixa é extrudada só nas partes que sobram dela, como o corte e a planta.
        ...(shown('wall') ? buildLevelSolids(lv, junctionLevel(p, lv.levelId)).batches : []),
        ...(shown('floor') ? buildFloorSolids(resolveFloors(p, lv.levelId), junctionLevel(p, lv.levelId)) : []),
        ...(shown('floor') ? buildCeilingSolids(resolveCeilings(p, lv.levelId)) : []),
        ...(shown('slab') ? buildSlabSolids(resolveSlabs(p, lv.levelId), junctionLevel(p, lv.levelId)) : []),
        ...buildRoofSolids(roofs),
        ...eave.batches,
        ...(shown('stair') ? buildStairSolids(stairs.filter((s) => s.levelId === lv.levelId), (s) => stairArrivalTopZ(p, s)) : []),
      ];
      for (const b of batches) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
        g.setIndex(b.indices);
        this.draw(this.model, g, p.materials[b.materialId] ?? eave.materials[b.materialId], b.category, this.frame.edges, b.ids);
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
    this.buildPickLayer();
    this.boxCache = new THREE.Box3().setFromObject(this.model);
    this.orbit.sceneRadius = this.boxCache.isEmpty() ? 0 : this.boxCache.getSize(new THREE.Vector3()).length() / 2;
    this.orbit.apply();
    const bg =new THREE.Color(view.background ?? (opt.dark ? BACKGROUND.dark : BACKGROUND.light));
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
    // Vão livre de porta: só o recorte da parede; sem folha nem caixilho.
    if (g.kind === 'door' && g.leaves === 0) return null;
    const grp = new THREE.Group();
    // Aberturas só têm arestas nos estilos de linhas (nos estilos com cor, como antes, não).
    const edges = isLineStyle(this.frame.view.style);
    // Cada peça da esquadria é um elemento inteiro: a faixa cobre a geometria toda (decisão 0016).
    const range = (count: number): ElementRange[] => [{ id: o.id, start: 0, count }];
    const pieces = openingPieces(p, o, g, f, H, this.frame.view.openOpenings === true);
    for (const piece of pieces) {
      const mat = p.materials[piece.materialId];
      // Folha aberta: a caixa é desenhada num grupo na dobradiça, que gira a peça inteira.
      if (piece.hinge) {
        const pivot = new THREE.Group();
        let dx = 0;
        if (piece.hinge.axis === 'z') {
          pivot.position.x = piece.hinge.at;
          pivot.rotation.z = piece.hinge.angle;
          dx = piece.hinge.at;
        } else {
          pivot.position.z = piece.hinge.at;
          pivot.rotation.x = piece.hinge.angle;
        }
        const box = new THREE.BoxGeometry(piece.w, piece.d, piece.h).translate(piece.x - dx, piece.y, piece.z - (piece.hinge.axis === 'x' ? piece.hinge.at : 0));
        this.draw(pivot, box, mat, cat, edges, range(box.index?.count ?? 0));
        grp.add(pivot);
      } else {
        const box = new THREE.BoxGeometry(piece.w, piece.d, piece.h).translate(piece.x, piece.y, piece.z);
        this.draw(grp, box, mat, cat, edges, range(box.index?.count ?? 0));
      }
    }
    grp.rotation.z = Math.atan2(g.u.y, g.u.x);
    grp.position.set(g.center.x, g.center.y, baseZ + g.sill);
    grp.userData.elementId = o.id;
    grp.traverse((c) => {
      c.userData.elementId = o.id;
    });
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
    this.dropHighlight('sel');
    this.dropHighlight('hov');
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
  }
}
