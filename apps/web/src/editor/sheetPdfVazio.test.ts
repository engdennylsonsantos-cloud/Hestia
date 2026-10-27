import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject } from '@hestia/model';
import { pranchaDaPlantaAtual, sheetsPdfOf } from './sheetActions.ts';

describe('PDF sem prancha', () => {
  it('sem pranchas não há PDF; com a planta atual vira uma prancha e o PDF sai não vazio', () => {
    const s = new ProjectStore(createEmptyProject());
    const lv = s.project.levels[0]!.id;
    expect(sheetsPdfOf(s.project)).toBeNull();

    const id = pranchaDaPlantaAtual(s, lv);
    expect((s.project.sheets ?? []).some((sh) => sh.id === id)).toBe(true);
    const pdf = sheetsPdfOf(s.project);
    expect(pdf).not.toBeNull();
    expect(new TextDecoder().decode(pdf!.slice(0, 5))).toBe('%PDF-');
  });

  it('a criação automática é desfeita com Ctrl+Z (undo)', () => {
    const s = new ProjectStore(createEmptyProject());
    const lv = s.project.levels[0]!.id;
    pranchaDaPlantaAtual(s, lv);
    expect(s.project.sheets?.length).toBe(1);
    s.undo();
    s.undo();
    expect(s.project.sheets?.length ?? 0).toBe(0);
  });
});
