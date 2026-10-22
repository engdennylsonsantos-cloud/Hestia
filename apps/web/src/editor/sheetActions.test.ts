import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, sheetOf, viewportIssue } from '@hestia/model';
import { addSheetAction, addViewAction, clampedAt, defaultViewSize, duplicateSheetCommand, freeSpot, moveViewportAction, nextSheetNumber, sheetsPdfOf } from './sheetActions.ts';

const LV0 = 'lv_0';

describe('pranchas: ações', () => {
  it('numera a partir de A-101 e segue o que existe', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(nextSheetNumber(s.project)).toBe('A-101');
    addSheetAction(s);
    expect(nextSheetNumber(s.project)).toBe('A-102');
  });

  it('cria prancha com desfazer', () => {
    const s = new ProjectStore(createEmptyProject());
    const id = addSheetAction(s);
    expect(sheetOf(s.project, id)?.size).toBe('A3');
    s.undo();
    expect(s.project.sheets ?? []).toHaveLength(0);
  });

  it('adiciona vistas em lugares que não se sobrepõem e cabem na folha', () => {
    const s = new ProjectStore(createEmptyProject());
    const id = addSheetAction(s);
    const a = addViewAction(s, id, { kind: 'plan', levelId: LV0 }, 100);
    const b = addViewAction(s, id, { kind: 'plan', levelId: LV0 }, 50);
    const sh = sheetOf(s.project, id)!;
    const va = sh.viewports.find((v) => v.id === a)!;
    const vb = sh.viewports.find((v) => v.id === b)!;
    expect(viewportIssue(sh, va)).toBeNull();
    expect(viewportIssue(sh, vb)).toBeNull();
    const disjoint = vb.at.x >= va.at.x + va.size.w || va.at.x >= vb.at.x + vb.size.w || vb.at.y >= va.at.y + va.size.h || va.at.y >= vb.at.y + vb.size.h;
    expect(disjoint).toBe(true);
  });

  it('move a vista para fora e ela é limitada à área de desenho', () => {
    const s = new ProjectStore(createEmptyProject());
    const id = addSheetAction(s);
    const v = addViewAction(s, id, { kind: 'plan', levelId: LV0 }, 50);
    expect(moveViewportAction(s, id, v, { x: 9999, y: -50 })).toBeNull();
    const sh = sheetOf(s.project, id)!;
    const vp = sh.viewports[0]!;
    expect(vp.at.x + vp.size.w).toBeLessThanOrEqual(420 - 10 + 1e-9);
    expect(vp.at.y).toBeGreaterThanOrEqual(10 - 1e-9);
  });

  it('duplica a prancha com ids novos, vistas copiadas e número seguinte', () => {
    const s = new ProjectStore(createEmptyProject());
    const id = addSheetAction(s);
    addViewAction(s, id, { kind: 'plan', levelId: LV0 }, 100);
    const cmd = duplicateSheetCommand(s.project, id)!;
    s.exec(cmd, 'Duplicar prancha');
    const [orig, copy] = s.project.sheets!;
    expect(copy!.id).not.toBe(orig!.id);
    expect(copy!.number).toBe('A-102');
    expect(copy!.name).toBe('Nova prancha (cópia)');
    expect(copy!.viewports).toHaveLength(1);
    expect(copy!.viewports[0]!.id).not.toBe(orig!.viewports[0]!.id);
    s.undo();
    expect(s.project.sheets).toHaveLength(1);
  });

  it('PDF: nenhuma prancha, nada a exportar; com uma, um PDF', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(sheetsPdfOf(s.project)).toBeNull();
    addSheetAction(s);
    const bytes = sheetsPdfOf(s.project)!;
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe('%PDF-1.4');
  });
});

describe('pranchas: funções de posição', () => {
  const sh = { size: 'A3' as const, orientation: 'landscape' as const, margin: 10, viewports: [] };

  it('limita a posição à área de desenho', () => {
    expect(clampedAt(sh, { w: 100, h: 50 }, { x: -20, y: 500 })).toEqual({ x: 10, y: 237 });
  });

  it('o primeiro lugar livre é o canto da área de desenho quando a folha está vazia', () => {
    expect(freeSpot(sh, { w: 100, h: 50 })).toEqual({ x: 10, y: 10 });
  });

  it('a vista nova não cai sobre o carimbo (canto inferior direito)', () => {
    // Vista existente à esquerda, de 10 a 280 mm; o carimbo ocupa x 290–410, y 10–54: a vista nova vai acima dos dois.
    const taken = { id: 'v1', view: { kind: '3d' as const }, at: { x: 10, y: 10 }, size: { w: 270, h: 50 }, scale: 100 };
    expect(freeSpot({ ...sh, viewports: [taken] }, { w: 100, h: 50 })).toEqual({ x: 10, y: 60 });
  });

  it('a vista padrão encolhe para caber numa folha pequena', () => {
    expect(defaultViewSize({ size: 'A4', orientation: 'portrait', margin: 10 }, { kind: 'plan', levelId: LV0 })).toEqual({ w: 180, h: 130 });
    expect(defaultViewSize({ size: 'A4', orientation: 'portrait', margin: 60 }, { kind: 'plan', levelId: LV0 })).toEqual({ w: 90, h: 130 });
  });
});
