import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, migrateProject, openingFamilyOf, SCHEMA_VERSION, type Project } from './index.ts';

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
  it('cada porta e janela padrão tem uma família de abertura válida', () => {
    // O catálogo cresceu com as famílias de correr, pivotante, fixa e vão livre: a regra passou a ser a do modelo —
    // todo tipo padrão precisa ter família em `OPENING_FAMILIES` (antes o teste fixava o par plano × folhas antigo).
    for (const t of DEFAULT_OPENING_TYPES) expect(openingFamilyOf(t)).not.toBeNull();
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

describe('migração 10 → 11 (Esquadro removido)', () => {
  /** Projeto v10 com uma parede de junção esquadro (ponta inicial) e uma em esquadria (ponta final). */
  function legacyV10(): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown> & { elements: Record<string, unknown> };
    p.schemaVersion = 10;
    const base = { id: 'w', kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, noJoinStart: false, noJoinEnd: false };
    p.elements = {
      w: { ...base, joinStart: { kind: 'square', flip: true }, joinEnd: { kind: 'miter', flip: false } },
    };
    return p;
  }

  it('junção esquadro vira encosto e mantém a ordem (flip)', () => {
    const m = migrateProject(legacyV10());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    const w = m.elements.w as unknown as { joinStart: unknown; joinEnd: unknown };
    expect(w.joinStart).toEqual({ kind: 'butt', flip: true });
  });
  it('esquadria e encosto já salvos não mudam', () => {
    const m = migrateProject(legacyV10());
    const w = m.elements.w as unknown as { joinEnd: unknown };
    expect(w.joinEnd).toEqual({ kind: 'miter', flip: false });
  });
});

describe('migração 11 → 12 (escadas)', () => {
  /** Projeto no formato da versão 11: sem tipos de escada. */
  function legacyV11(): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown>;
    p.schemaVersion = 11;
    delete p.stairTypes;
    return p;
  }

  it('projeto antigo ganha os tipos de escada padrão', () => {
    const m = migrateProject(legacyV11());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(m.stairTypes).sort()).toEqual(DEFAULT_STAIR_TYPES.map((t) => t.id).sort());
  });

  it('tipo de escada já existente no arquivo é preservado', () => {
    const custom = { ...DEFAULT_STAIR_TYPES[0]!, name: 'Minha escada', maxRiser: 0.17 };
    const m = migrateProject({ ...legacyV11(), stairTypes: { [custom.id]: custom } });
    expect(m.stairTypes[custom.id]).toEqual(custom);
    expect(m.stairTypes[DEFAULT_STAIR_TYPES[1]!.id]).toBeDefined();
  });

  it('ida e volta de JSON preserva escadas com croqui, patamar e tipos', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addStair',
      stair: makeStair({
        id: 'st1',
        typeId: 'stt_piso_espelho',
        levelId: 'lv_0',
        openingMode: 'none',
        components: [
          {
            id: 'r1',
            kind: 'run',
            boundaryLeft: [{ a: { x: 0, y: 0 }, b: { x: 0, y: 3 }, sag: 0 }],
            boundaryRight: [{ a: { x: 1, y: 0 }, b: { x: 1, y: 3 }, sag: 0.1 }],
            risers: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, sag: 0 }],
            path: [],
            generatedBy: 'straight',
          },
          { id: 'l1', kind: 'landing', boundary: [{ a: { x: 0, y: 3 }, b: { x: 1, y: 3 }, sag: 0 }, { a: { x: 1, y: 3 }, b: { x: 0, y: 3 }, sag: 0 }] },
        ],
      }),
    });
    const original: Project = s.project;
    const back = migrateProject(JSON.parse(JSON.stringify(original)));
    expect(back).toEqual(original);
    expect(back.elements.st1).toMatchObject({ kind: 'stair', openingMode: 'none', typeId: 'stt_piso_espelho' });
  });
});

describe('migração 12 → 13 (face inferior da escada)', () => {
  /** Projeto no formato da versão 12: tipos de escada sem `undersideStyle`. */
  function legacyV12(): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown> & { stairTypes: Record<string, Record<string, unknown>> };
    p.schemaVersion = 12;
    for (const t of Object.values(p.stairTypes)) delete t.undersideStyle;
    return p;
  }

  it('todo tipo de escada existente ganha face lisa', () => {
    const m = migrateProject(legacyV12());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(16);
    for (const t of Object.values(m.stairTypes)) expect(t.undersideStyle).toBe('smooth');
  });

  it('preserva os demais campos do tipo e os tipos padrão continuam os mesmos', () => {
    const custom = { ...DEFAULT_STAIR_TYPES[0]!, name: 'Minha escada', maxRiser: 0.17 };
    delete (custom as Partial<typeof custom>).undersideStyle;
    const m = migrateProject({ ...legacyV12(), stairTypes: { [custom.id]: custom } });
    expect(m.stairTypes[custom.id]).toEqual({ ...custom, undersideStyle: 'smooth' });
  });

  it('face escalonada já salva no arquivo é preservada', () => {
    const custom = { ...DEFAULT_STAIR_TYPES[0]!, undersideStyle: 'stepped' as const };
    const m = migrateProject({ ...legacyV12(), stairTypes: { [custom.id]: custom } });
    expect(m.stairTypes[custom.id]!.undersideStyle).toBe('stepped');
  });

  it('projeto já na versão 13 não muda na migração', () => {
    const p = createEmptyProject();
    p.stairTypes.stt_monolitica = { ...p.stairTypes.stt_monolitica!, undersideStyle: 'stepped' };
    const raw = JSON.parse(JSON.stringify(p)) as Project;
    expect(migrateProject(raw)).toEqual(p);
  });

  it('ida e volta de JSON preserva a face inferior escalonada', () => {
    const p = createEmptyProject();
    p.stairTypes.stt_monolitica = { ...p.stairTypes.stt_monolitica!, undersideStyle: 'stepped' };
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.stairTypes.stt_monolitica!.undersideStyle).toBe('stepped');
  });
});

describe('migração 13 → 14 (abertura da laje)', () => {
  /** Projeto no formato da versão 13: escadas com `openSlab` e sem os campos de abertura. */
  function legacyV13(): Record<string, unknown> {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st_on', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st_off', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st_none', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
    const p = JSON.parse(JSON.stringify(s.project)) as Record<string, unknown> & { elements: Record<string, Record<string, unknown>> };
    for (const id of ['st_on', 'st_off', 'st_none']) {
      const e = p.elements[id]!;
      delete e.openingMode;
      delete e.openingHeadroom;
      delete e.openingMargin;
      delete e.openingRect;
    }
    p.elements.st_on!.openSlab = true;
    p.elements.st_off!.openSlab = false;
    delete p.elements.st_none!.openSlab;
    p.schemaVersion = 13;
    return p;
  }

  it('"Abrir laje" ligada vira pé-direito livre; desligada vira sem abertura', () => {
    const m = migrateProject(legacyV13());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.elements.st_on).toMatchObject({ openingMode: 'headroom' });
    expect(m.elements.st_off).toMatchObject({ openingMode: 'none' });
  });

  it('escada sem o campo (arquivo antigo) segue ligada; todas ganham os campos de folga e retângulo', () => {
    const m = migrateProject(legacyV13());
    expect(m.elements.st_none).toMatchObject({ openingMode: 'headroom' });
    for (const id of ['st_on', 'st_off', 'st_none']) {
      expect(m.elements[id]).toMatchObject({ openingHeadroom: null, openingMargin: 0.05, openingRect: false });
    }
  });

  it('o campo `openSlab` sai do arquivo', () => {
    const m = migrateProject(legacyV13());
    for (const id of ['st_on', 'st_off', 'st_none']) expect(m.elements[id]).not.toHaveProperty('openSlab');
  });

  it('ida e volta depois da migração preserva o projeto', () => {
    const m = migrateProject(legacyV13());
    expect(migrateProject(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});

describe('migração 15 → 16 (escada caracol)', () => {
  /** Projeto no formato da versão 15: tipos de escada sem sobreposição e poste, sem os dois caracol e sem aço. */
  function legacyV15(): Record<string, unknown> {
    const p = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown> & {
      stairTypes: Record<string, Record<string, unknown>>;
      materials: Record<string, Record<string, unknown>>;
    };
    p.schemaVersion = 15;
    for (const t of Object.values(p.stairTypes)) {
      delete t.treadOverlap;
      delete t.postMaterialId;
    }
    delete p.stairTypes.stt_caracol_monolitica;
    delete p.stairTypes.stt_caracol_poste;
    delete p.materials.mat_aco;
    return p;
  }

  it('todo tipo existente ganha sobreposição e material do poste padrão', () => {
    const m = migrateProject(legacyV15());
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(16);
    for (const id of ['stt_monolitica', 'stt_piso_espelho']) {
      expect(m.stairTypes[id]).toMatchObject({ treadOverlap: 0.025, postMaterialId: 'mat_aco' });
    }
  });

  it('os dois tipos caracol entram com os valores padrão e o material aço entra', () => {
    const m = migrateProject(legacyV15());
    expect(m.stairTypes.stt_caracol_monolitica).toEqual(DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_caracol_monolitica'));
    expect(m.stairTypes.stt_caracol_poste).toEqual(DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_caracol_poste'));
    expect(m.stairTypes.stt_caracol_poste).toMatchObject({ runStyle: 'post', treadThickness: 0.05, riserThickness: 0 });
    expect(m.materials.mat_aco).toMatchObject({ name: 'Aço' });
  });

  it('ids existentes são preservados e nenhum tipo some; os demais campos ficam como estavam', () => {
    const raw = legacyV15();
    const ids = Object.keys(raw.stairTypes as object);
    const m = migrateProject(raw);
    for (const id of ids) expect(m.stairTypes[id]).toBeDefined();
    expect(m.stairTypes.stt_piso_espelho).toEqual({ ...DEFAULT_STAIR_TYPES[1]! });
  });

  it('tipo do usuário com o mesmo id de um caracol padrão não é sobrescrito; o campo novo recebe o padrão', () => {
    const custom = { ...DEFAULT_STAIR_TYPES[3]!, name: 'Poste da obra', maxRiser: 0.17 };
    delete (custom as Partial<typeof custom>).treadOverlap;
    delete (custom as Partial<typeof custom>).postMaterialId;
    const raw = legacyV15();
    (raw.stairTypes as Record<string, unknown>)[custom.id] = custom;
    const m = migrateProject(raw);
    expect(m.stairTypes[custom.id]).toEqual({ ...custom, treadOverlap: 0.025, postMaterialId: 'mat_aco' });
  });

  it('um material aço já salvo no arquivo é preservado', () => {
    const raw = legacyV15();
    (raw.materials as Record<string, unknown>).mat_aco = { id: 'mat_aco', name: 'Aço da obra', color: '#000000', hatch: 'solid', gloss: 0, opacity: 1, cost: 1, unit: 'm3' };
    const m = migrateProject(raw);
    expect(m.materials.mat_aco).toMatchObject({ name: 'Aço da obra', color: '#000000' });
  });

  it('ida e volta depois da migração preserva o projeto', () => {
    const m = migrateProject(legacyV15());
    expect(migrateProject(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});
