import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, createEmptyProject, migrateProject, SCHEMA_VERSION } from './index.ts';

/** Projeto no formato da versão 5: sem os campos acrescentados em 6. */
function legacyV5(): Record<string, unknown> {
  const p = JSON.parse(JSON.stringify(createEmptyProject())) as {
    schemaVersion: number;
    settings: unknown;
    wallTypes: Record<string, Record<string, unknown>>;
    openingTypes: Record<string, Record<string, unknown>>;
  };
  p.schemaVersion = 5;
  p.settings = { joinTolerance: 0.02 };
  for (const t of Object.values(p.wallTypes)) {
    delete t.cost;
    delete t.thermalU;
    delete t.acousticRw;
    delete t.fireRating;
    delete t.manufacturer;
  }
  for (const t of Object.values(p.openingTypes)) delete t.plan;
  delete p.openingTypes.ot_vao90;
  return p;
}

describe('vão livre e símbolos de planta', () => {
  it('o tipo padrão Vão livre 90 x 210 é porta sem folha, com fechamento herdado', () => {
    const t = DEFAULT_OPENING_TYPES.find((x) => x.id === 'ot_vao90');
    expect(t).toMatchObject({ kind: 'door', leaves: 0, closure: 'inherit', width: 0.9, height: 2.1 });
  });
  it('cada porta e janela padrão tem família de planta compatível com as folhas', () => {
    for (const t of DEFAULT_OPENING_TYPES) {
      if (t.kind === 'door') expect(t.plan).toBe(t.leaves === 2 ? 'double' : 'swing');
      if (t.kind === 'window') expect(['sliding', 'casement']).toContain(t.plan);
    }
  });
});

describe('migração 5 → 6', () => {
  it('acrescenta custo e desempenho vazios aos tipos de parede', () => {
    const m = migrateProject(legacyV5());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    for (const t of Object.values(m.wallTypes)) {
      expect(t).toMatchObject({ cost: 0, thermalU: null, acousticRw: null, fireRating: null, manufacturer: '' });
    }
  });
  it('deriva o símbolo de planta das folhas e da família', () => {
    const m = migrateProject(legacyV5());
    expect(m.openingTypes.ot_p80!.plan).toBe('swing');
    expect(m.openingTypes.ot_p160!.plan).toBe('double');
    expect(m.openingTypes.ot_j120!.plan).toBe('sliding');
    expect(m.openingTypes.ot_j60!.plan).toBe('casement');
    expect(migrateProject({ ...legacyV5(), openingTypes: { w0: { id: 'w0', kind: 'window', leaves: 0 } } }).openingTypes.w0!.plan).toBe('fixed');
  });
  it('configurações novas começam desligadas e no nível médio', () => {
    const m = migrateProject(legacyV5());
    expect(m.settings).toMatchObject({ joinTolerance: 0.02, showTags: false, debugJoins: false, detail: 'medium' });
  });
  it('projeto novo já traz os campos com os mesmos defaults', () => {
    const p = createEmptyProject();
    expect(p.settings).toMatchObject({ showTags: false, debugJoins: false, detail: 'medium' });
    expect(p.wallTypes.wt_alv14).toMatchObject({ cost: 0, thermalU: null, manufacturer: '' });
  });
});
