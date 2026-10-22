import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { PlanScene } from './gpuPlan.ts';
import type { PlanDrawList } from './types.ts';

const VIEW = { cx: 0, cy: 0, zoom: 10, width: 400, height: 300 };
const quad = (x0: number, y0: number, x1: number, y1: number) => [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];

/** Malhas do grupo da cena, na ordem em que foram criadas (ordem da lista de desenho). */
function meshesOf(scene: PlanScene): THREE.Mesh[] {
  const group = scene.scene.children[0] as THREE.Group;
  return group.children as THREE.Mesh[];
}

describe('PlanScene: ordem de desenho segue a lista (como o CPU)', () => {
  it('a parede (preenchimento sólido posterior) fica depois da hachura da laje, e todo material é transparente', () => {
    // Laje com hachura no retângulo grande, parede (sólida, posterior na lista) cobrindo parte dele.
    const dl: PlanDrawList = {
      background: '#ffffff',
      fills: [
        { polygons: [quad(0, 0, 8, 6)], color: '#cccccc', alpha: 1, hatch: { kind: 'cross', color: '#444444' } },
        { polygons: [quad(0, 0, 2, 6)], color: '#222222', alpha: 1 },
      ],
      strokes: [],
      labels: [],
    };
    const scene = new PlanScene();
    scene.setDrawList(dl, VIEW);
    const meshes = meshesOf(scene);
    // Preenchimento, hachura e parede: três malhas em ordem crescente de `renderOrder`.
    expect(meshes.map((m) => m.renderOrder)).toEqual([0, 1, 2]);
    // Transparente é o que põe todas as malhas no mesmo grupo de ordenação: a parede cobre a hachura por `renderOrder`.
    expect(meshes.every((m) => (m.material as THREE.MeshBasicMaterial).transparent)).toBe(true);
    scene.dispose();
  });

  it('traços vêm depois de todos os preenchimentos, com a mesma ordem da lista', () => {
    const dl: PlanDrawList = {
      background: '#ffffff',
      fills: [{ polygons: [quad(0, 0, 4, 4)], color: '#eeeeee', alpha: 0.5 }],
      strokes: [{ pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }], closed: false, widthPx: 2, color: '#000000', alpha: 1 }],
      labels: [],
    };
    const scene = new PlanScene();
    scene.setDrawList(dl, VIEW);
    const meshes = meshesOf(scene);
    expect(meshes.length).toBe(2);
    expect(meshes[0]!.renderOrder).toBeLessThan(meshes[1]!.renderOrder);
    scene.dispose();
  });
});
