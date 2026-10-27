/**
 * Cópia do realce de HEAD (antes do R3), só para a medição antes/depois. NÃO versionar: `scripts/r3-bench.mts` importa
 * este arquivo apenas na janela de medição.
 */
import * as THREE from 'three';
import type { Id } from '@hestia/model';
import type { ElementRange } from '../packages/render/src/model3d/solids.ts';

const HIGHLIGHT_EDGE_ANGLE = 28;

export interface HighlightStyle {
  color: THREE.ColorRepresentation;
  fill: number;
  edges: number;
}

export function highlightOfAntes(model: THREE.Object3D, ids: readonly Id[], style: HighlightStyle): THREE.Object3D {
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

export function caixaDaSelecaoAntes(model: THREE.Object3D, ids: readonly Id[]): THREE.Box3 | null {
  if (!ids.length) return null;
  const want = new Set(ids);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const ranges = mesh.userData.ranges as ElementRange[] | undefined;
    const index = (mesh.geometry as THREE.BufferGeometry | undefined)?.index;
    if (!mesh.isMesh || !ranges || !index) {
      if (mesh.userData.elementId && want.has(mesh.userData.elementId as Id)) box.expandByObject(mesh);
      return;
    }
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const r of ranges) {
      if (!want.has(r.id)) continue;
      for (let k = r.start; k < r.start + r.count; k++) {
        v.fromBufferAttribute(attr, index.getX(k)).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(v);
      }
    }
  });
  return box.isEmpty() ? null : box;
}
