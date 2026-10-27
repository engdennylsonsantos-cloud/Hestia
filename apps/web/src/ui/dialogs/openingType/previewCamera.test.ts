import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, type OpeningType } from '@hestia/model';
import { previewCamera, previewCameraBox, previewCameraOccupancy } from './previewCamera.ts';
import { previewOpening, previewProject } from './previewProject.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

function cameraFor(type: OpeningType) {
  const project = previewProject(type);
  return previewCamera(project, previewOpening(project)!);
}

const assinatura = (type: OpeningType): string => {
  const c = cameraFor(type);
  return JSON.stringify([c.position, c.target, c.distance, c.box]);
};

describe('câmera da prévia 3D', () => {
  it('enquadra a esquadria com a folha aberta ocupando ~70% da altura da área (ot_p90 a 90°)', () => {
    const c = cameraFor(tipo('ot_p90'));
    expect(c.occupancy).toBeGreaterThanOrEqual(0.6);
    expect(c.occupancy).toBeLessThanOrEqual(0.8);
    expect(previewCameraOccupancy(c)).toBeCloseTo(c.occupancy, 9);
    expect(c.distance).toBeGreaterThan(0);
    expect(c.zoom).toBe(1);
    // A caixa inclui o vão, a folha aberta e as demais peças do tipo.
    expect(c.box.max.z).toBeGreaterThan(c.box.min.z);
    expect(c.box.max.x).toBeGreaterThan(c.box.min.x);
    expect(c.box.max.y).toBeGreaterThan(c.box.min.y);
  });

  it('muda com largura, altura, ângulo e alizar', () => {
    const base = tipo('ot_p90');
    const referencia = assinatura(base);
    expect(assinatura({ ...base, width: base.width + 0.3 })).not.toBe(referencia);
    expect(assinatura({ ...base, height: base.height + 0.3 })).not.toBe(referencia);
    expect(assinatura({ ...base, angle3d: 30 })).not.toBe(referencia);
    expect(assinatura({ ...base, casing: { width: 0.05, thickness: 0.015 } })).not.toBe(referencia);
  });

  it('a folha aberta aumenta a caixa em relação ao ângulo 0 (folha fechada)', () => {
    const fechada = cameraFor({ ...tipo('ot_p90'), angle3d: 0 });
    const aberta = cameraFor({ ...tipo('ot_p90'), angle3d: 90 });
    const size = (c: ReturnType<typeof cameraFor>): number =>
      (c.box.max.x - c.box.min.x) + (c.box.max.y - c.box.min.y) + (c.box.max.z - c.box.min.z);
    expect(size(aberta)).toBeGreaterThan(size(fechada));
  });

  it('a caixa do vão livre de porta usa o retângulo do furo', () => {
    const project = previewProject(tipo('ot_vao90'));
    const box = previewCameraBox(project, previewOpening(project)!);
    expect(box.max.x - box.min.x).toBeCloseTo(0.9, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(2.1, 6);
  });
});
