import * as THREE from 'three';
import type { Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';

/** Ângulo (graus) das arestas do realce: as arestas duras do elemento, inclusive o contorno contra os vizinhos. */
const HIGHLIGHT_EDGE_ANGLE = 28;

/** Cor e opacidades de um realce: `fill` no preenchimento, `edges` nas arestas. */
export interface HighlightStyle {
  color: THREE.ColorRepresentation;
  fill: number;
  edges: number;
}

/**
 * Sobreposição dos elementos `ids`: copia os triângulos das faixas (`userData.ranges`) das malhas de `model`, leva-os ao
 * mundo e os desenha com preenchimento translúcido e arestas. Não altera a malha do modelo: a sobreposição é um objeto à parte.
 * Sem triângulos para os ids (elemento oculto ou fora do modelo), devolve um objeto vazio.
 */
export function highlightOf(model: THREE.Object3D, ids: readonly Id[], style: HighlightStyle): THREE.Object3D {
  const out = new THREE.Object3D();
  const want = new Set(ids);
  const pos: number[] = [];
  const v = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const ranges = mesh.userData.ranges as ElementRange[] | undefined;
    const index = (mesh.geometry as THREE.BufferGeometry | undefined)?.index;
    if (!mesh.isMesh || !ranges || !index) return;
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const r of ranges) {
      if (!want.has(r.id)) continue;
      for (let k = r.start; k < r.start + r.count; k++) {
        v.fromBufferAttribute(attr, index.getX(k)).applyMatrix4(mesh.matrixWorld);
        pos.push(v.x, v.y, v.z);
      }
    }
  });
  if (!pos.length) return out;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Sem polygonOffset: a cópia tem a mesma geometria da face que cobre, então passa no teste de profundidade sem
  // empurrar a sobreposição para a frente. Com o offset, camadas de baixo (cm abaixo do topo) vazavam pelo topo.
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: style.fill, depthTest: true, depthWrite: false }),
  );
  fill.renderOrder = 5;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, HIGHLIGHT_EDGE_ANGLE),
    new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: style.edges, depthTest: true, depthWrite: false }),
  );
  edges.renderOrder = 6;
  out.add(fill, edges);
  return out;
}

/** Libera a geometria e os materiais de uma sobreposição (o chamador a tira da cena antes). */
export function disposeHighlight(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const x = o as THREE.Mesh;
    x.geometry?.dispose();
    if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose());
  });
}
