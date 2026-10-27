import { describe, expect, it } from 'vitest';
import { frameOfWall, openingGeometry } from '@hestia/engine';
import { DEFAULT_OPENING_TYPES, isOpening, isWall, type OpeningType, type Project } from '@hestia/model';
import {
  PREVIEW_OPENING_ID,
  PREVIEW_WALL_ID,
  PREVIEW_WALL_TYPE_ID,
  previewOpening,
  previewProject,
  previewWall,
  previewWallHeight,
  previewWallLength,
} from './previewProject.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

function comprimento(p: Project): number {
  const w = previewWall(p)!;
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

describe('projeto mínimo da prévia', () => {
  it('tem um nível, uma parede reta wt_alv14 e a abertura no centro', () => {
    const p = previewProject(tipo('ot_p90'));
    expect(p.levels).toHaveLength(1);
    expect(Object.values(p.elements).filter(isWall)).toHaveLength(1);
    expect(Object.values(p.elements).filter(isOpening)).toHaveLength(1);
    const w = previewWall(p)!;
    expect(w.typeId).toBe(PREVIEW_WALL_TYPE_ID);
    expect(w.id).toBe(PREVIEW_WALL_ID);
    expect(w.a).toEqual({ x: 0, y: 0 });
    expect(w.b).toEqual({ x: comprimento(p), y: 0 });
    const o = previewOpening(p)!;
    expect(o.id).toBe(PREVIEW_OPENING_ID);
    expect(o.hostId).toBe(PREVIEW_WALL_ID);
    expect(o.offset).toBeCloseTo(comprimento(p) / 2, 9);
  });

  it('a parede mede largura + 1,2 e altura + peitoril + 0,5 (enquadra a esquadria, não a parede do editor)', () => {
    expect(previewWallLength({ width: 0.9 })).toBeCloseTo(2.1, 9);
    expect(previewWallLength({ width: 2.4 })).toBeCloseTo(3.6, 9);
    expect(previewWallHeight({ height: 2.1, sill: 0 })).toBeCloseTo(2.6, 9);
    const p = previewProject(tipo('ot_j240'));
    expect(comprimento(p)).toBeCloseTo(3.6, 9);
    const j = tipo('ot_j120');
    const parede = previewWall(p)!;
    expect(parede.height).toBeCloseTo(j.sill + j.height + 0.5, 9);
    const porta = previewWall(previewProject(tipo('ot_p90')))!;
    expect(comprimento(previewProject(tipo('ot_p90')))).toBeCloseTo(0.9 + 1.2, 9);
    expect(porta.height).toBeCloseTo(2.1 + 0.5, 9);
  });

  it('preserva todos os campos v2 do rascunho no catálogo do projeto', () => {
    const d: OpeningType = {
      ...tipo('ot_p90'),
      leafStyle: 'panel',
      handle: 'knob',
      frameStyle: 'aduela',
      angle2d: 45,
      angle3d: 60,
      grid: { cols: 2, rows: 3 },
      transom: { height: 0.3, fixed: true },
      sidelights: { left: true, right: false, width: 0.2 },
      planDisplay: 'projected',
      detail2d: 'high',
      detail3d: 'full',
      showSwing: false,
      swingStyle: 'dash',
      leafSide: 'opposite',
      casing: { width: 0.05, thickness: 0.015 },
      sillBoard: { projection: 0.03, thickness: 0.02 },
      lintel: { over: 0.3, height: 0.2 },
      sillBeam: { over: 0.3, height: 0.2 },
      roughOversize: { w: 0.02, h: 0.01 },
    };
    const p = previewProject(d);
    expect(p.openingTypes[d.id]).toEqual(d);
  });

  it('aplica flipHand e flipFacing na instância e preserva o peitoril de janela', () => {
    const d = tipo('ot_j120');
    const p = previewProject(d, true, true);
    const o = previewOpening(p)!;
    expect(o.flipHand).toBe(true);
    expect(o.flipFacing).toBe(true);
    const f = frameOfWall(p, o.hostId)!;
    const g = openingGeometry(p, o, f);
    expect(g.sill).toBeCloseTo(d.sill, 9);
  });
});
