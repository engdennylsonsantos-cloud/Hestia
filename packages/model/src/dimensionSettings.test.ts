import { describe, expect, it } from 'vitest';
import { createEmptyProject } from './defaults.ts';
import { ProjectStore } from './history.ts';
import { migrateProject } from './migrate.ts';
import { DEFAULT_DIMENSION_SETTINGS, dimensionSettingsOf, isOpeningDimRef, isWallDimRef } from './dimensionSettings.ts';

describe('dimensionSettingsOf', () => {
  it('devolve os padrões e a mesma referência quando nada foi configurado', () => {
    const p = createEmptyProject();
    expect(p.settings.dimensions).toBeUndefined();
    const a = dimensionSettingsOf(p);
    expect(a).toEqual({ wallRef: 'finish', openingRef: 'frame', showOnPlacement: true, showOnSelection: true });
    expect(dimensionSettingsOf(p)).toBe(a);
    expect(a).toBe(DEFAULT_DIMENSION_SETTINGS);
  });

  it('completa configuração parcial e memoiza pela identidade', () => {
    const p = createEmptyProject();
    p.settings.dimensions = { wallRef: 'axis', showOnSelection: false };
    const r = dimensionSettingsOf(p);
    expect(r).toEqual({ wallRef: 'axis', openingRef: 'frame', showOnPlacement: true, showOnSelection: false });
    expect(dimensionSettingsOf(p)).toBe(r);
  });

  it('ignora valores inválidos vindos de arquivo', () => {
    const p = createEmptyProject();
    p.settings.dimensions = { wallRef: 'xyz' as never, openingRef: 'abc' as never };
    expect(dimensionSettingsOf(p)).toEqual(DEFAULT_DIMENSION_SETTINGS);
  });

  it('guardas de tipo', () => {
    expect(isWallDimRef('coreFace')).toBe(true);
    expect(isWallDimRef('casing')).toBe(false);
    expect(isOpeningDimRef('casing')).toBe(true);
    expect(isOpeningDimRef('axis')).toBe(false);
  });

  it('setSettings com dimensions desfaz e refaz num passo', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'setSettings', patch: { dimensions: { wallRef: 'coreFace', openingRef: 'clear' } } });
    expect(dimensionSettingsOf(store.project).wallRef).toBe('coreFace');
    store.undo();
    expect(dimensionSettingsOf(store.project)).toBe(DEFAULT_DIMENSION_SETTINGS);
    store.redo();
    expect(dimensionSettingsOf(store.project).openingRef).toBe('clear');
  });

  it('sobrevive à ida e volta em JSON sem mexer no esquema', () => {
    const p = createEmptyProject();
    p.settings.dimensions = { wallRef: 'coreCenter', openingRef: 'casing', showOnPlacement: false };
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.schemaVersion).toBe(p.schemaVersion);
    expect(dimensionSettingsOf(back)).toEqual({ wallRef: 'coreCenter', openingRef: 'casing', showOnPlacement: false, showOnSelection: true });
  });
});
