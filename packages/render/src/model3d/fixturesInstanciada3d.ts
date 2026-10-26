import * as THREE from 'three';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeSlab, makeWall, view3dOf, type Id, type Opening, type Project, type VisualStyle } from '@hestia/model';
import { ModelScene } from './scene3d.ts';

/**
 * Apoio dos testes da cena com caixas instanciadas: prédio de `n` pavimentos, montagem da cena nos dois caminhos (geometria e
 * caixas), triângulos e arestas da cena no mundo, e contagem de chamadas de desenho. Não é um teste.
 */

const CAIXA = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

/** Variações do prédio: aberturas (porta e janela por pavimento), uma parede girada e uma parede curva. */
export interface OpcoesPredio {
  aberturas?: boolean;
  girada?: boolean;
  curva?: boolean;
}

/** Prédio de `n` pavimentos (3 m): 4 paredes de contorno e uma divisória, piso e laje por pavimento. */
export function predio(n: number, o: OpcoesPredio = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const ids: Id[] = Array.from({ length: n }, (_, i) => `lv_${i}`);
  ids.forEach((id, i) => s.exec({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) }));
  const lados = [
    [CAIXA[0]!, CAIXA[1]!],
    [CAIXA[1]!, CAIXA[2]!],
    [CAIXA[2]!, CAIXA[3]!],
    [CAIXA[3]!, CAIXA[0]!],
    [{ x: 2, y: 0 }, { x: 2, y: 3 }],
  ] as const;
  ids.forEach((levelId, i) => {
    lados.forEach(([a, b], j) => s.exec({ type: 'addWall', wall: makeWall({ id: `w_${i}_${j}`, typeId: 'wt_alv14', levelId, a, b }) }));
    if (o.girada) s.exec({ type: 'addWall', wall: makeWall({ id: `wg_${i}`, typeId: 'wt_alv14', levelId, a: { x: 6, y: 0 }, b: { x: 9, y: 2 } }) });
    if (o.curva) s.exec({ type: 'addWall', wall: makeWall({ id: `wc_${i}`, typeId: 'wt_alv14', levelId, a: { x: 0, y: 5 }, b: { x: 4, y: 5 }, sag: 1 }) });
    if (o.aberturas) {
      const base = { flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
      const porta: Opening = { id: `d_${i}`, kind: 'door', typeId: 'ot_p80', hostId: `w_${i}_0`, offset: 1, ...base };
      const janela: Opening = { id: `j_${i}`, kind: 'window', typeId: 'ot_j120', hostId: `w_${i}_2`, offset: 2, ...base };
      s.exec({ type: 'addOpening', opening: porta });
      s.exec({ type: 'addOpening', opening: janela });
    }
    s.exec({ type: 'addFloor', floor: makeFloor({ id: `f_${i}`, typeId: 'ft_ceram', levelId, boundary: CAIXA }) });
    s.exec({ type: 'addSlab', slab: makeSlab({ id: `s_${i}`, typeId: 'ls_mac12', levelId, boundary: CAIXA }) });
  });
  return s.project;
}

/** Cena do projeto, com as arestas ligadas (padrão) ou não, no caminho de caixas (`instanciar`) ou de geometria. */
export function montar(p: Project, instanciar: boolean, style: VisualStyle = 'realistic', arestas = true): ModelScene {
  const pv: Project = { ...p, view3d: { ...view3dOf(p), style, edges: arestas } };
  const niveis: ResolvedLevel[] = pv.levels.map((l) => resolveLevel(pv, l.id));
  const ms = new ModelScene({ instanciar });
  ms.update(pv, niveis, { edges: arestas, shadows: false, dark: false });
  return ms;
}

/** Triângulo no mundo: categoria, cor do material e os 9 números dos três vértices. */
export interface TrianguloMundo {
  kind: string;
  cor: number;
  v: number[];
}

/** Triângulos visíveis da cena no mundo: malhas comuns (geometria) e caixas instanciadas (caixa unitária × matriz). Ignora o chão. */
export function triangulos(ms: ModelScene): TrianguloMundo[] {
  const out: TrianguloMundo[] = [];
  const a = new THREE.Vector3();
  const empurrar = (kind: string, cor: number, geo: THREE.BufferGeometry, m: THREE.Matrix4): void => {
    const pos = geo.getAttribute('position');
    const idx = geo.index!;
    const limite = Number.isFinite(geo.drawRange.count) ? Math.min(geo.drawRange.count, idx.count) : idx.count;
    for (let t = 0; t < limite; t += 3) {
      const v: number[] = [];
      for (let k = 0; k < 3; k++) {
        a.fromBufferAttribute(pos, idx.getX(t + k)).applyMatrix4(m);
        v.push(a.x, a.y, a.z);
      }
      out.push({ kind, cor, v });
    }
  };
  ms.scene.updateMatrixWorld(true);
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible || o.userData.kind === undefined) return;
    const cor = (o.material as THREE.MeshStandardMaterial).color.getHex();
    if (o instanceof THREE.InstancedMesh) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        empurrar(String(o.userData.kind), cor, o.geometry, m.premultiply(o.matrixWorld));
      }
    } else empurrar(String(o.userData.kind), cor, o.geometry, o.matrixWorld);
  });
  return out;
}

/** Segmentos das arestas da cena no mundo (todas as linhas do modelo e da camada instanciada), seis números cada. */
export function segmentos(ms: ModelScene): number[][] {
  const out: number[][] = [];
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.LineSegments) || o instanceof THREE.GridHelper) return;
    const pos = o.geometry.getAttribute('position');
    const limite = Number.isFinite(o.geometry.drawRange.count) ? Math.min(o.geometry.drawRange.count, pos.count) : pos.count;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i + 1 < limite; i += 2) {
      a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld);
      out.push([a.x, a.y, a.z, b.x, b.y, b.z]);
    }
  });
  return out;
}

/** Chamadas de desenho da cena: malhas e linhas visíveis (as malhas de picking são invisíveis e não contam). O chão e a grade entram nos dois lados. */
export function chamadasDeDesenho(ms: ModelScene): { malhas: number; linhas: number; total: number } {
  let malhas = 0;
  let linhas = 0;
  ms.scene.traverse((o) => {
    let visivel = true;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) visivel &&= p.visible;
    if (!visivel) return;
    if (o instanceof THREE.Line) linhas++;
    else if (o instanceof THREE.Mesh) malhas++;
  });
  return { malhas, linhas, total: malhas + linhas };
}

/** Número de malhas (visíveis ou não) e de objetos instanciados da cena. */
export function contarObjetos(ms: ModelScene): { malhas: number; instanciadas: number } {
  let malhas = 0;
  let instanciadas = 0;
  ms.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) instanciadas++;
    else if (o instanceof THREE.Mesh) malhas++;
  });
  return { malhas, instanciadas };
}
