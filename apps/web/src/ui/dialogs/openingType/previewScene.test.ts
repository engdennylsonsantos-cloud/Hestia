import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildOpeningModel, frameOfWall, openingGeometry, resolveLevel } from '@hestia/engine';
import { DEFAULT_OPENING_TYPES, type OpeningType, type Project } from '@hestia/model';
import { buildLevelSolids, type ElementRange, type ModelScene } from '@hestia/render';
import { PREVIEW_WALL_ID, previewOpening, previewProject } from './previewProject.ts';
import { buildPreviewScene, previewScene } from './previewScene.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

/** Grupo do modelo (o primeiro `Group` da cena; luzes, chão e grade não são grupos). */
function modelo(scene: ModelScene): THREE.Group {
  return scene.scene.children.find((c): c is THREE.Group => c instanceof THREE.Group)!;
}

function malhas(scene: ModelScene): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  modelo(scene).traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

/** Nº de peças de uma categoria: cada faixa de elemento das malhas é uma peça (como no 3D do projeto). */
function pecasDe(scene: ModelScene, kind: 'door' | 'window'): number {
  return malhas(scene)
    .filter((m) => m.userData.kind === kind)
    .reduce((sum, m) => sum + (m.userData.ranges as ElementRange[]).length, 0);
}

describe('cena 3D da prévia', () => {
  it('monta a cena sem canvas, com malhas da parede e da esquadria', () => {
    const p = previewProject(tipo('ot_p90'));
    const scene = buildPreviewScene(p, 'lines');
    expect(malhas(scene).length).toBeGreaterThan(0);
    expect(malhas(scene).some((m) => m.userData.kind === 'door')).toBe(true);
    expect(malhas(scene).some((m) => m.userData.kind === 'wall')).toBe(true);
    scene.dispose();
  });

  it('a parede é um sólido por camada, sem fatias: uma malha por lote de parede e só a parede da prévia', () => {
    const p: Project = previewProject(tipo('ot_p90'));
    const scene = buildPreviewScene(p, 'lines');
    const paredes = malhas(scene).filter((m) => m.userData.kind === 'wall');
    const lotes = buildLevelSolids(resolveLevel(p, p.levels[0]!.id)).batches;
    expect(paredes).toHaveLength(lotes.length);
    const ids = new Set(paredes.flatMap((m) => (m.userData.ranges as ElementRange[]).map((r) => r.id)));
    expect([...ids]).toEqual([PREVIEW_WALL_ID]);
    scene.dispose();
  });

  it('a prévia 3D usa o caminho de montagem (sem instâncias): as peças são exatamente as do modelo único', () => {
    const p = previewProject(tipo('ot_p90'));
    const scene = buildPreviewScene(p, 'lines');
    let instanciadas = 0;
    scene.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) instanciadas++;
    });
    expect(instanciadas).toBe(0);
    const opening = previewOpening(p)!;
    const f = frameOfWall(p, PREVIEW_WALL_ID)!;
    const model = buildOpeningModel(p, opening, openingGeometry(p, opening, f), f);
    // Uma faixa por peça; a peça com seção (batente em L) entra por este mesmo caminho quando o motor a produzir.
    expect(pecasDe(scene, 'door')).toBe(model.parts.length);
    scene.dispose();
  });

  it('o estilo sombreado também monta as faces', () => {
    const scene = previewScene(tipo('ot_j120'), 'shaded');
    expect(malhas(scene).length).toBeGreaterThan(0);
    expect(malhas(scene).some((m) => m.userData.kind === 'window')).toBe(true);
    scene.dispose();
  });

  it('o ângulo do controle abre a folha e muda a cena', () => {
    const a = previewScene(tipo('ot_p90'), 'lines', 30).bounds().getSize(new THREE.Vector3());
    const b = previewScene(tipo('ot_p90'), 'lines', 90).bounds().getSize(new THREE.Vector3());
    expect(a.toArray()).not.toEqual(b.toArray());
  });

  it('grid e casing mudam a assinatura da esquadria (peças), como no 3D do projeto', () => {
    const janela = tipo('ot_jfixa60');
    const semGrid = pecasDe(previewScene({ ...janela, grid: { cols: 1, rows: 1 } }, 'lines'), 'window');
    const comGrid = pecasDe(previewScene({ ...janela, grid: { cols: 2, rows: 2 } }, 'lines'), 'window');
    expect(comGrid).toBeGreaterThan(semGrid);

    const porta = tipo('ot_p90');
    const semAlizar = pecasDe(previewScene({ ...porta, casing: undefined }, 'lines'), 'door');
    const comAlizar = pecasDe(previewScene({ ...porta, casing: { width: 0.05, thickness: 0.015 } }, 'lines'), 'door');
    expect(comAlizar).toBeGreaterThan(semAlizar);
  });
});
