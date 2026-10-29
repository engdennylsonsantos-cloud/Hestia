import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type LocationLine } from '@hestia/model';
import { frameOfWall } from './resolve.ts';
import { wallPlaneAt, wallPlanes } from './wallPlanes.ts';

type Camada = { function: 'finish2' | 'substrate' | 'structure'; thickness: number };

function frameDe(layers: Camada[], locationLine: LocationLine = 'wallCenter', flipped = false) {
  const s = new ProjectStore(createEmptyProject());
  const base = s.project.wallTypes['wt_alv14']!;
  s.exec({ type: 'upsertWallType', wallType: { ...base, id: 'wt_t', layers: layers.map((l) => ({ ...l, materialId: 'mat_reboco', wraps: false })) } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_t', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, locationLine, flipped }) });
  return frameOfWall(s.project, 'w')!;
}

const ASSIMETRICA: Camada[] = [
  { function: 'finish2', thickness: 0.02 },
  { function: 'structure', thickness: 0.14 },
];

describe('wallPlanes', () => {
  it('uma camada: núcleo = espessura total, eixo no meio', () => {
    const pl = wallPlanes(frameDe([{ function: 'structure', thickness: 0.2 }]));
    expect(pl.faceHi).toBeCloseTo(0.1, 9);
    expect(pl.faceLo).toBeCloseTo(-0.1, 9);
    expect(pl.coreHi).toBeCloseTo(pl.faceHi, 9);
    expect(pl.coreLo).toBeCloseTo(pl.faceLo, 9);
    expect(pl.axis).toBeCloseTo(0, 9);
    expect(pl.coreCenter).toBeCloseTo(0, 9);
  });

  it('três camadas assimétricas: revestimento de 2 cm só de um lado, núcleo de 14 cm', () => {
    // finishExterior: a linha de localização é a face externa (s = 0); a espessura vai para s negativo.
    const pl = wallPlanes(frameDe(ASSIMETRICA, 'finishExterior'));
    expect(pl.faceHi).toBeCloseTo(0, 9);
    expect(pl.faceLo).toBeCloseTo(-0.16, 9);
    expect(pl.coreHi).toBeCloseTo(-0.02, 9);
    expect(pl.coreLo).toBeCloseTo(-0.16, 9);
    expect(pl.axis).toBeCloseTo(-0.08, 9);
    expect(pl.coreCenter).toBeCloseTo(-0.09, 9);
  });

  it('linha de localização no eixo do núcleo desloca os planos mas mantém as distâncias', () => {
    const pl = wallPlanes(frameDe(ASSIMETRICA, 'coreCenter'));
    expect(pl.coreCenter).toBeCloseTo(0, 9);
    expect(pl.coreHi - pl.coreLo).toBeCloseTo(0.14, 9);
    expect(pl.faceHi - pl.coreHi).toBeCloseTo(0.02, 9);
    expect(pl.faceHi - pl.faceLo).toBeCloseTo(0.16, 9);
  });

  it('parede invertida (flipped) troca o lado do revestimento', () => {
    const pl = wallPlanes(frameDe(ASSIMETRICA, 'finishExterior', true));
    expect(pl.faceLo).toBeCloseTo(0, 9);
    expect(pl.faceHi).toBeCloseTo(0.16, 9);
    expect(pl.coreLo).toBeCloseTo(0.02, 9);
    expect(pl.coreHi).toBeCloseTo(0.16, 9);
  });
});

describe('wallPlaneAt', () => {
  const pl = { axis: -0.08, faceLo: -0.16, faceHi: 0, coreLo: -0.16, coreHi: -0.02, coreCenter: -0.09 };
  it('eixo e eixo do núcleo ignoram o lado', () => {
    expect(wallPlaneAt(pl, 'axis', 1)).toBe(-0.08);
    expect(wallPlaneAt(pl, 'axis', -1)).toBe(-0.08);
    expect(wallPlaneAt(pl, 'coreCenter', 1)).toBe(-0.09);
    expect(wallPlaneAt(pl, 'coreCenter', -1)).toBe(-0.09);
  });
  it('faces dependem do lado voltado para o elemento', () => {
    expect(wallPlaneAt(pl, 'finish', 1)).toBe(0);
    expect(wallPlaneAt(pl, 'finish', -1)).toBe(-0.16);
    expect(wallPlaneAt(pl, 'coreFace', 1)).toBe(-0.02);
    expect(wallPlaneAt(pl, 'coreFace', -1)).toBe(-0.16);
  });
});
