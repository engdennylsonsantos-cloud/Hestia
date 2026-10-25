import * as THREE from 'three';
import { frameOfWall, openingGeometry } from '@hestia/engine';
import type { GraphicsCategory, Id, Material, Opening, Project, View3DSettings } from '@hestia/model';
import { openingPieces } from './openingParts.ts';
import { loteDeGeometria } from './lotesMalha3d.ts';
import type { ElementRange, SolidBatch } from './solids.ts';

/** Desenha uma peça articulada (folha aberta) num pai: a geometria, o material, a categoria, as arestas e as faixas. */
export type DesenhoPeca = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: Material | undefined, cat: GraphicsCategory, edges: boolean, ranges: ElementRange[]) => void;

/**
 * Uma esquadria montada: o grupo do vão (com a transformação do vão, e as folhas abertas nas dobradiças) e os lotes das
 * peças fixas, em coordenadas do vão. Quem monta desenha os lotes dentro do grupo (ver `scene3d.ts`, `desenharLotes`).
 */
export interface AberturaMontada {
  grupo: THREE.Group;
  lotes: SolidBatch[];
}

/**
 * Esquadria no vão (decisão 0015 §2.4). As peças fixas viram lotes em coordenadas do vão (a transformação fica no grupo),
 * juntados por material dentro da esquadria, para caber numa malha por material e não por peça (ver `lotesMalha3d.ts`).
 * A folha aberta, que gira na dobradiça, fica num pivô próprio (`desenhar`). Categoria oculta ou vão livre de porta: null.
 */
export function montarAbertura(
  p: Project,
  o: Opening,
  f: NonNullable<ReturnType<typeof frameOfWall>>,
  baseZ: number,
  H: number,
  view: View3DSettings,
  linhas: boolean,
  desenhar: DesenhoPeca,
): AberturaMontada | null {
  const cat: GraphicsCategory = o.kind;
  if (!view.overrides[cat].visible) return null;
  const g = openingGeometry(p, o, f);
  // Vão livre de porta: só o recorte da parede; sem folha nem caixilho.
  if (g.kind === 'door' && g.leaves === 0) return null;
  const grupo = new THREE.Group();
  grupo.rotation.z = Math.atan2(g.u.y, g.u.x);
  grupo.position.set(g.center.x, g.center.y, baseZ + g.sill);
  const lotes: SolidBatch[] = [];
  // Cada peça da esquadria é um elemento inteiro: a faixa cobre a geometria toda (decisão 0016).
  const range = (count: number): ElementRange[] => [{ id: o.id, start: 0, count }];
  for (const piece of openingPieces(p, o, g, f, H, view.openOpenings === true)) {
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
      desenhar(pivot, box, p.materials[piece.materialId], cat, linhas, range(box.index?.count ?? 0));
      grupo.add(pivot);
    } else {
      // Peça fixa: a caixa em coordenadas do vão (o grupo leva a transformação), como lote da esquadria.
      const box = new THREE.BoxGeometry(piece.w, piece.d, piece.h).translate(piece.x, piece.y, piece.z);
      lotes.push(loteDeGeometria(box, piece.materialId, cat, o.id));
    }
  }
  grupo.userData.elementId = o.id;
  return { grupo, lotes };
}

/** Uma peça de esquadria como caixa: o material e a matriz que leva a caixa unitária ao mundo. */
export interface CaixaDeAbertura {
  materialId: Id;
  matriz: number[];
}

/**
 * Esquadria em caixas (desempenho 3D): cada peça, fixa ou articulada, é uma caixa unitária levada ao mundo por
 * `vão · dobradiça · caixa`, a mesma cadeia de transformações de `montarAbertura` (grupo do vão, pivô da dobradiça, caixa
 * deslocada), só que numa matriz. Mesmas saídas nulas: categoria oculta ou vão livre de porta.
 */
export function caixasDaAbertura(
  p: Project,
  o: Opening,
  f: NonNullable<ReturnType<typeof frameOfWall>>,
  baseZ: number,
  H: number,
  view: View3DSettings,
): CaixaDeAbertura[] | null {
  if (!view.overrides[o.kind].visible) return null;
  const g = openingGeometry(p, o, f);
  if (g.kind === 'door' && g.leaves === 0) return null;
  const vao = new THREE.Matrix4().makeRotationZ(Math.atan2(g.u.y, g.u.x)).setPosition(g.center.x, g.center.y, baseZ + g.sill);
  const out: CaixaDeAbertura[] = [];
  for (const piece of openingPieces(p, o, g, f, H, view.openOpenings === true)) {
    const m = vao.clone();
    let dx = 0;
    let dz = 0;
    if (piece.hinge) {
      const pivo = new THREE.Matrix4();
      if (piece.hinge.axis === 'z') {
        pivo.makeRotationZ(piece.hinge.angle).setPosition(piece.hinge.at, 0, 0);
        dx = piece.hinge.at;
      } else {
        pivo.makeRotationX(piece.hinge.angle).setPosition(0, 0, piece.hinge.at);
        dz = piece.hinge.at;
      }
      m.multiply(pivo);
    }
    m.multiply(new THREE.Matrix4().makeTranslation(piece.x - dx, piece.y, piece.z - dz)).multiply(new THREE.Matrix4().makeScale(piece.w, piece.d, piece.h));
    out.push({ materialId: piece.materialId, matriz: m.toArray() });
  }
  return out;
}
