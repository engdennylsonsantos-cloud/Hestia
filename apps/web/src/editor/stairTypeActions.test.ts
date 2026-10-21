import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, makeStair, DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import { instancesOfType, compatibleTypes } from './typeActions.ts';
import { duplicateStairType, duplicateStairTypeFor, renameStairType, stairTypeDeleteBlock, stairTypeError, tryDeleteStairType } from './stairTypeActions.ts';

/** Casa-modelo com uma escada monolítica no térreo (usa o tipo stt_monolitica). */
function withStair(): ProjectStore {
  const store = new ProjectStore(buildTemplate('house2'));
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0' }) });
  return store;
}

const monolithic = (): StairType => structuredClone(DEFAULT_STAIR_TYPES[0]!);

describe('tipos de escada: uso, substituição e exclusão', () => {
  it('lista as escadas do tipo e os tipos compatíveis (outros tipos de escada)', () => {
    const p = withStair().project;
    expect(instancesOfType(p, 'stair', 'stt_monolitica')).toEqual(['st1']);
    expect(compatibleTypes(p, 'stair', 'stt_monolitica').map((t) => t.id)).toEqual(['stt_piso_espelho']);
  });

  it('bloqueia a exclusão do tipo em uso e do único tipo', () => {
    const store = withStair();
    expect(stairTypeDeleteBlock(store.project, 'stt_monolitica')).toBe('Em uso por 1 escada.');
    const r = tryDeleteStairType(store, 'stt_monolitica');
    expect(r.ok).toBe(false);
  });

  it('exclui um tipo sem uso e não mexe nas escadas', () => {
    const store = withStair();
    const copy = duplicateStairType(store, 'stt_monolitica')!;
    expect(tryDeleteStairType(store, copy).ok).toBe(true);
    expect(store.project.stairTypes[copy]).toBeUndefined();
    expect(store.project.elements.st1).toBeDefined();
  });

  it('duplica com nome "(cópia)" e renomeia; nome vazio não é aceito', () => {
    const store = withStair();
    const copy = duplicateStairType(store, 'stt_monolitica')!;
    expect(store.project.stairTypes[copy]!.name).toBe('Escada monolítica concreto (cópia)');
    expect(renameStairType(store, copy, '  Lance A  ')).toEqual({ ok: true });
    expect(store.project.stairTypes[copy]!.name).toBe('Lance A');
    expect(renameStairType(store, copy, '   ').ok).toBe(false);
  });

  it('duplicar para as escadas selecionadas é um só passo de desfazer', () => {
    const store = withStair();
    const copy = duplicateStairTypeFor(store, ['st1'], 'stt_monolitica')!;
    expect(store.project.elements.st1).toMatchObject({ typeId: copy });
    store.undo();
    expect(store.project.elements.st1).toMatchObject({ typeId: 'stt_monolitica' });
    expect(store.project.stairTypes[copy]).toBeUndefined();
  });
});

describe('validação do tipo de escada', () => {
  it('aceita o tipo padrão dos dois estilos', () => {
    expect(stairTypeError(monolithic())).toBeNull();
    expect(stairTypeError(DEFAULT_STAIR_TYPES[1]!)).toBeNull();
  });

  it('exige profundidade no monolítico e espessuras no montado', () => {
    expect(stairTypeError({ ...monolithic(), structuralDepth: 0 })).toMatch(/profundidade estrutural/);
    expect(stairTypeError({ ...DEFAULT_STAIR_TYPES[1]!, treadThickness: 0 })).toMatch(/piso e do espelho/);
  });

  it('rejeita medidas não positivas', () => {
    expect(stairTypeError({ ...monolithic(), maxRiser: 0 })).toMatch(/espelho máximo/);
    expect(stairTypeError({ ...monolithic(), minTread: -1 })).toMatch(/piso mínimo/);
    expect(stairTypeError({ ...monolithic(), name: '  ' })).toMatch(/nome/);
  });
});

describe('face inferior do tipo de escada', () => {
  it('duplicar e renomear mantêm a face escalonada', () => {
    const store = withStair();
    store.exec({ type: 'upsertStairType', stairType: { ...monolithic(), id: 'stt_esc', undersideStyle: 'stepped' } });
    const copy = duplicateStairType(store, 'stt_esc')!;
    expect(store.project.stairTypes[copy]!.undersideStyle).toBe('stepped');
    expect(renameStairType(store, copy, 'Lance B')).toEqual({ ok: true });
    expect(store.project.stairTypes[copy]).toMatchObject({ name: 'Lance B', undersideStyle: 'stepped' });
  });

  it('duplicar para as escadas selecionadas copia a face e desfaz em um passo', () => {
    const store = withStair();
    store.exec({ type: 'upsertStairType', stairType: { ...monolithic(), id: 'stt_esc', undersideStyle: 'stepped' } });
    store.exec({ type: 'updateElements', ids: ['st1'], patch: { typeId: 'stt_esc' } });
    const copy = duplicateStairTypeFor(store, ['st1'], 'stt_esc')!;
    expect(store.project.stairTypes[copy]!.undersideStyle).toBe('stepped');
    store.undo();
    expect(store.project.stairTypes[copy]).toBeUndefined();
  });
});
