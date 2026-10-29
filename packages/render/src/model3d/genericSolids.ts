import { isGeneric, type Id, type Project } from '@hestia/model';
import { ofElement, type SolidBatch } from './solids.ts';

/**
 * Malha dos objetos importados (viga, pilar, mobiliário, MEP...) de um nível. Cada triângulo entra com a normal da própria
 * face (sombreamento chapado, como as demais peças) e com a faixa de índices do elemento, para o picking do 3D continuar
 * funcionando do mesmo jeito que nas paredes.
 */
export function buildGenericSolids(p: Project, levelId: Id): SolidBatch[] {
  const batch: SolidBatch = {
    materialId: 'mat_concreto',
    category: 'generic',
    positions: [],
    normals: [],
    indices: [],
    ids: [],
  };
  for (const e of Object.values(p.elements)) {
    if (!isGeneric(e) || e.levelId !== levelId) continue;
    ofElement(batch, e.id, () => pushMesh(batch, e.mesh.positions, e.mesh.indices));
  }
  return batch.indices.length ? [batch] : [];
}

/** Triângulos com vértices próprios e normal plana por face. */
function pushMesh(batch: SolidBatch, positions: readonly number[], indices: readonly number[]): void {
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = (indices[i] ?? 0) * 3;
    const b = (indices[i + 1] ?? 0) * 3;
    const c = (indices[i + 2] ?? 0) * 3;
    const ax = positions[a] ?? 0;
    const ay = positions[a + 1] ?? 0;
    const az = positions[a + 2] ?? 0;
    const bx = positions[b] ?? 0;
    const by = positions[b + 1] ?? 0;
    const bz = positions[b + 2] ?? 0;
    const cx = positions[c] ?? 0;
    const cy = positions[c + 1] ?? 0;
    const cz = positions[c + 2] ?? 0;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const base = batch.positions.length / 3;
    batch.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    batch.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    batch.indices.push(base, base + 1, base + 2);
  }
}
