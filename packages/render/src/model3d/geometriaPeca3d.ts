import * as THREE from 'three';
import type { PartBox, PartProfile } from '@hestia/engine';
import type { OpeningPiece } from './openingParts.ts';

/**
 * Geometria de uma peça da esquadria no sistema local do vão (x = t, y = s, z = altura). Peça com `profile` vira UM prisma
 * extrudado da seção do modelo: `plane 'ts'` extruda em z (ombreira) e `plane 'sz'` extruda em t (travessa). A caixa
 * envolvente da peça é a mesma que orienta e posiciona o prisma; sem `profile`, é a caixa de sempre.
 */
export function geometriaDaPeca(piece: OpeningPiece): THREE.BufferGeometry {
  if (!piece.profile) return new THREE.BoxGeometry(piece.w, piece.d, piece.h).translate(piece.x, piece.y, piece.z);
  const box = caixaDaPeca(piece);
  return geometriaDoPerfil(piece.profile, box);
}

/** Caixa alinhada de uma peça fechada (antes de dobradiça/deslocamento). */
export function caixaDaPeca(piece: OpeningPiece): PartBox {
  return {
    t0: piece.x - piece.w / 2,
    t1: piece.x + piece.w / 2,
    s0: piece.y - piece.d / 2,
    s1: piece.y + piece.d / 2,
    z0: piece.z - piece.h / 2,
    z1: piece.z + piece.h / 2,
  };
}

/** Área com sinal (anti-horário positivo) do polígono da seção. */
function areaDe(pts: PartProfile['pts']): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Contorno do `Shape` sempre anti-horário: a extrusão então nasce com as normais para fora (os espelhamentos do modelo invertem o sentido). */
function forma(pts: PartProfile['pts']): THREE.Shape {
  const p = areaDe(pts) < 0 ? [...pts].reverse() : [...pts];
  return new THREE.Shape(p.map(([a, b]) => new THREE.Vector2(a, b)));
}

/** Troca o 2.º e o 3.º vértice de cada triângulo: uma reflexão inverte o enrolamento (e a normal voltaria para dentro). */
function inverteTriangulos(g: THREE.BufferGeometry): void {
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array;
    for (let i = 0; i + 2 < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2]!, a[i + 1]!];
    idx.needsUpdate = true;
    return;
  }
  for (const attr of Object.values(g.attributes)) {
    const a = attr.array as Float32Array;
    const n = attr.itemSize;
    for (let v = 0; v + 2 < attr.count; v += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (v + 1) * n + k;
        const i2 = (v + 2) * n + k;
        [a[i1], a[i2]] = [a[i2]!, a[i1]!];
      }
    }
    attr.needsUpdate = true;
  }
}

/**
 * Prisma da seção. Em `'ts'` os pontos são (t, s) e a extrusão corre em z a partir de `box.z0`; em `'sz'` os pontos são
 * (s, z) e a extrusão corre em t a partir de `box.t0`; em `'tz'` são (t, z) e a extrusão corre em s a partir de `box.s0`
 * (disco, cilindro). A permutação final põe a geometria no sistema da peça (t, s, z).
 */
export function geometriaDoPerfil(profile: PartProfile, box: PartBox): THREE.BufferGeometry {
  const s = forma(profile.pts);
  if (profile.plane === 'ts') {
    const g = new THREE.ExtrudeGeometry(s, { depth: box.z1 - box.z0, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, box.z0);
    g.computeVertexNormals();
    return g;
  }
  if (profile.plane === 'tz') {
    const g = new THREE.ExtrudeGeometry(s, { depth: box.s1 - box.s0, bevelEnabled: false, steps: 1 });
    // (t, z, d) → (t, s, z): a extrusão em d vira s, deslocada para a face s0 da caixa. Trocar z por s é uma reflexão.
    g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, box.s0, 0, 1, 0, 0, 0, 0, 0, 1));
    inverteTriangulos(g);
    g.computeVertexNormals();
    return g;
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: box.t1 - box.t0, bevelEnabled: false, steps: 1 });
  // (s, z, d) → (t, s, z): a extrusão em d vira t, deslocada para a face t0 da caixa.
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, box.t0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
}

/** Posição do pivô da dobradiça no sistema local do vão, ou null se a peça não gira. */
export function pivoDaPeca(piece: OpeningPiece): { x: number; y: number; z: number } | null {
  const h = piece.hinge;
  if (!h) return null;
  return h.axis === 'z' ? { x: h.at, y: h.atS ?? 0, z: 0 } : { x: 0, y: h.atS ?? 0, z: h.at };
}

/** Geometria fechada da peça levada para o referencial do pivô: quem gira é o grupo da dobradiça. */
export function geometriaRelativaAoPivo(piece: OpeningPiece): THREE.BufferGeometry {
  const g = geometriaDaPeca(piece);
  const p = pivoDaPeca(piece);
  if (p) g.translate(-p.x, -p.y, -p.z);
  return g;
}

/** Deslocamento do estado aberto (correr), no sistema local do vão. */
export function deslocamentoDaPeca(piece: OpeningPiece): { dx: number; dy: number; dz: number } {
  return { dx: piece.slide?.dx ?? 0, dy: piece.slide?.dy ?? 0, dz: piece.slide?.dz ?? 0 };
}
