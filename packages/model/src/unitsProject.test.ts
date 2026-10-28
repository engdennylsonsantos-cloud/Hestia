import { describe, expect, it } from 'vitest';
import { createEmptyProject } from './defaults.ts';
import { ProjectStore } from './history.ts';
import { migrateProject } from './migrate.ts';
import { SCHEMA_VERSION } from './types.ts';
import { defaultUnits, unitsOf } from './units.ts';

describe('units em ProjectSettings', () => {
  it('projeto novo não grava units e lê os padrões', () => {
    const p = createEmptyProject();
    expect(p.settings.units).toBeUndefined();
    expect(unitsOf(p)).toBe(defaultUnits());
  });

  it('setSettings aplica, desfaz e refaz num passo', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    const aplicado = unitsOf(store.project);
    expect(aplicado.length.unit).toBe('cm');
    expect(aplicado.length.decimals).toBe(1);
    expect(aplicado.area).toEqual(defaultUnits().area);
    store.undo();
    expect(unitsOf(store.project)).toBe(defaultUnits());
    store.redo();
    expect(unitsOf(store.project).length.unit).toBe('cm');
  });

  it('preserva settings.units na ida e volta em JSON, sem mudar o esquema', () => {
    const p = createEmptyProject();
    p.settings.units = {
      length: { unit: 'ft-in', decimals: 2, denominator: 8 },
      area: { unit: 'cm2', decimals: 1 },
      decimalSymbol: '.',
      currency: 'USD',
    };
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.schemaVersion).toBe(p.schemaVersion);
    expect(back.schemaVersion).toBe(SCHEMA_VERSION);
    const u = unitsOf(back);
    expect(u.length).toEqual({ unit: 'ft-in', decimals: 2, suppressZeros: false, denominator: 8 });
    expect(u.area.unit).toBe('cm2');
    expect(u.decimalSymbol).toBe('.');
    expect(u.currency).toBe('USD');
  });

  it('arquivo antigo sem units abre e devolve os padrões', () => {
    const antigo = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown>;
    const settings = antigo.settings as Record<string, unknown>;
    delete settings.units;
    const back = migrateProject(antigo);
    expect(unitsOf(back)).toBe(defaultUnits());
  });
});
