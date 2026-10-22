import { describe, expect, it } from 'vitest';
import { DEFAULT_CEILING_HEIGHT, DEFAULT_CEILING_TYPES, ProjectStore, SCHEMA_VERSION, ceilingArea, ceilingsOnLevel, createEmptyProject, makeCeiling, migrateProject, type Ceiling } from './index.ts';

const sq = (x: number, y: number, s: number) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];
const ceil = (id: string, extra: Partial<Ceiling> = {}) => makeCeiling({ id, typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(0, 0, 2), ...extra });

describe('forro (modelo)', () => {
  it('makeCeiling põe o topo no pé-direito padrão e sem furos nem ambiente', () => {
    const c = ceil('c1');
    expect(c).toMatchObject({ kind: 'ceiling', heightOffset: DEFAULT_CEILING_HEIGHT, holes: [], roomId: null });
    expect(DEFAULT_CEILING_HEIGHT).toBe(2.6);
  });

  it('área líquida desconta os furos', () => {
    expect(ceilingArea(ceil('c1'))).toBeCloseTo(4, 9);
    expect(ceilingArea(ceil('c2', { holes: [sq(0.5, 0.5, 1)] }))).toBeCloseTo(3, 9);
  });

  it('os tipos padrão têm camadas válidas e códigos distintos', () => {
    const codes = DEFAULT_CEILING_TYPES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const t of DEFAULT_CEILING_TYPES) expect(t.layers.length).toBeGreaterThan(0);
  });

  it('createEmptyProject traz os tipos de forro padrão', () => {
    const p = createEmptyProject();
    expect(Object.keys(p.ceilingTypes)).toEqual(DEFAULT_CEILING_TYPES.map((t) => t.id));
  });

  it('ceilingsOnLevel filtra pelo nível e ordena pela criação', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('a') });
    s.exec({ type: 'addCeiling', ceiling: ceil('b', { levelId: 'lv_1' }) });
    s.exec({ type: 'addCeiling', ceiling: ceil('c') });
    expect(ceilingsOnLevel(s.project, 'lv_0').map((c) => c.id)).toEqual(['a', 'c']);
  });
});

describe('forro (comandos e desfazer)', () => {
  it('addCeiling valida contorno, tipo e nível', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'addCeiling', ceiling: ceil('x', { boundary: sq(0, 0, 1).slice(0, 2) }) })).toThrow('3 pontos');
    expect(() => s.exec({ type: 'addCeiling', ceiling: ceil('x', { typeId: 'nao_existe' }) })).toThrow('Tipo de forro inexistente');
    expect(() => s.exec({ type: 'addCeiling', ceiling: ceil('x', { levelId: 'lv_9' }) })).toThrow('Nível inexistente');
    expect(s.project.elements.x).toBeUndefined();
  });

  it('addCeilings cria o lote ou nada (validação antes de gravar)', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'addCeilings', ceilings: [ceil('a'), ceil('b', { typeId: 'x' })] })).toThrow();
    expect(s.project.elements.a).toBeUndefined();
    s.exec({ type: 'addCeilings', ceilings: [ceil('a'), ceil('b')] });
    expect(ceilingsOnLevel(s.project, 'lv_0')).toHaveLength(2);
    s.undo();
    expect(ceilingsOnLevel(s.project, 'lv_0')).toHaveLength(0);
  });

  it('updateCeiling altera o pé-direito e desfazer volta', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('c') });
    s.exec({ type: 'updateCeiling', id: 'c', patch: { heightOffset: 2.4, mark: 'F1' } });
    expect(s.project.elements.c).toMatchObject({ heightOffset: 2.4, mark: 'F1' });
    s.undo();
    expect(s.project.elements.c).toMatchObject({ heightOffset: 2.6, mark: '' });
  });

  it('updateCeiling e removeCeiling recusam elemento que não é forro', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'updateCeiling', id: 'zz', patch: { mark: 'x' } })).toThrow('Forro inexistente');
    expect(() => s.exec({ type: 'removeCeiling', id: 'zz' })).toThrow('Forro inexistente');
  });

  it('removeCeiling remove e desfazer restaura', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('c') });
    s.exec({ type: 'removeCeiling', id: 'c' });
    expect(s.project.elements.c).toBeUndefined();
    s.undo();
    expect(s.project.elements.c).toMatchObject({ kind: 'ceiling' });
  });

  it('tipo em uso não some; tipo livre some; o último tipo fica', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('c') });
    expect(() => s.exec({ type: 'deleteCeilingType', id: 'ct_gesso' })).toThrow('Tipo em uso');
    s.exec({ type: 'deleteCeilingType', id: 'ct_pvc' });
    expect(s.project.ceilingTypes.ct_pvc).toBeUndefined();
    s.exec({ type: 'deleteCeilingType', id: 'ct_laje' });
    s.exec({ type: 'removeCeiling', id: 'c' });
    expect(() => s.exec({ type: 'deleteCeilingType', id: 'ct_gesso' })).toThrow('ao menos um tipo');
  });

  it('upsertCeilingType grava e duplicateCeilingType copia as camadas sem compartilhar a lista', () => {
    const s = new ProjectStore(createEmptyProject());
    const base = s.project.ceilingTypes.ct_gesso!;
    s.exec({ type: 'duplicateCeilingType', id: 'ct_gesso', newId: 'ct_copia', name: 'Cópia' });
    expect(s.project.ceilingTypes.ct_copia).toMatchObject({ id: 'ct_copia', name: 'Cópia', code: base.code });
    expect(s.project.ceilingTypes.ct_copia!.layers).not.toBe(base.layers);
    expect(() => s.exec({ type: 'duplicateCeilingType', id: 'ct_copia', newId: 'ct_copia', name: 'x' })).toThrow('Já existe');
    s.exec({ type: 'upsertCeilingType', ceilingType: { ...base, name: 'Gesso novo' } });
    expect(s.project.ceilingTypes.ct_gesso!.name).toBe('Gesso novo');
  });

  it('transform move o contorno do forro e mantém a cota', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('c') });
    s.exec({ type: 'transform', ids: ['c'], transform: { kind: 'translate', d: { x: 1, y: 0 } } });
    expect((s.project.elements.c as Ceiling).boundary[0]).toEqual({ x: 1, y: 0 });
    expect((s.project.elements.c as Ceiling).heightOffset).toBe(2.6);
  });
});

describe('migração 17 → 18 (forros)', () => {
  it('arquivo v17 ganha os tipos padrão e o PVC, sem mexer no resto', () => {
    const legacy = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown>;
    delete legacy.ceilingTypes;
    delete (legacy.materials as Record<string, unknown>).mat_pvc;
    legacy.schemaVersion = 17;
    const m = migrateProject(legacy);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(m.ceilingTypes)).toEqual(DEFAULT_CEILING_TYPES.map((t) => t.id));
    expect(m.materials.mat_pvc).toBeDefined();
  });

  it('tipo de forro do arquivo prevalece sobre o padrão de mesmo id', () => {
    const legacy = JSON.parse(JSON.stringify(createEmptyProject())) as Record<string, unknown>;
    (legacy.ceilingTypes as Record<string, unknown>).ct_gesso = { id: 'ct_gesso', name: 'Meu gesso', code: 'M', description: '', layers: [], cost: 1 };
    legacy.schemaVersion = 17;
    expect(migrateProject(legacy).ceilingTypes.ct_gesso).toMatchObject({ name: 'Meu gesso' });
  });

  it('ida e volta de JSON preserva forros e tipos', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: ceil('c', { roomId: 'r1', holes: [sq(0.5, 0.5, 0.5)], mark: 'F1' }) });
    const back = migrateProject(JSON.parse(JSON.stringify(s.project)));
    expect(back.elements).toEqual(s.project.elements);
    expect(back.ceilingTypes).toEqual(s.project.ceilingTypes);
  });
});
