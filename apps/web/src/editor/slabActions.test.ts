import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeSlab, type Slab, type ValidationIssue } from '@hestia/model';
import { issueTarget } from './issuesView.ts';
import { compatibleTypes, instancesOfType, replaceType } from './typeActions.ts';
import { duplicateSlabType, keptSlabType, renameSlabType, slabTypeDeleteBlock, slabTypeError, slabTypeUsage, tryDeleteSlabType } from './slabTypeActions.ts';

const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

function storeWithSlab(): ProjectStore {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: square }) });
  return store;
}

describe('tipos de laje: uso, exclusão e substituição (B4)', () => {
  it('laje conta como instância do tipo e aparece nas substituições compatíveis', () => {
    const store = storeWithSlab();
    expect(instancesOfType(store.project, 'slab', 'ls_mac12')).toEqual(['l1']);
    expect(slabTypeUsage(store.project, 'ls_mac12')).toBe(1);
    expect(compatibleTypes(store.project, 'slab', 'ls_mac12').map((t) => t.id)).toContain('ls_mac15');
  });

  it('exclusão é bloqueada em uso e no último tipo', () => {
    const store = storeWithSlab();
    expect(slabTypeDeleteBlock(store.project, 'ls_mac12')).toContain('Em uso');
    const r = tryDeleteSlabType(store, 'ls_mac12');
    expect(r.ok).toBe(false);
    expect(slabTypeDeleteBlock(store.project, 'ls_mac15')).toBeNull();
    store.exec({ type: 'deleteSlabType', id: 'ls_mac15' });
    store.exec({ type: 'deleteSlabType', id: 'ls_cobertura' });
    expect(slabTypeDeleteBlock(store.project, 'ls_mac12')).toContain('único');
  });

  it('duplicar cria tipo com id novo e nome "(cópia)"; renomear recusa nome vazio', () => {
    const store = storeWithSlab();
    const id = duplicateSlabType(store, 'ls_mac12');
    expect(id).not.toBeNull();
    expect(store.project.slabTypes[id!]?.name).toBe('Laje maciça 12 (cópia)');
    expect(renameSlabType(store, id!, '   ').ok).toBe(false);
    expect(renameSlabType(store, id!, 'Nova').ok).toBe(true);
    expect(store.project.slabTypes[id!]?.name).toBe('Nova');
  });

  it('substituir o tipo troca em todas as lajes com um passo de desfazer', () => {
    const store = storeWithSlab();
    expect(replaceType(store, 'slab', 'ls_mac12', 'ls_mac15')).toBe(1);
    expect((store.project.elements['l1'] as Slab).typeId).toBe('ls_mac15');
    store.undo();
    expect((store.project.elements['l1'] as Slab).typeId).toBe('ls_mac12');
  });

  it('validação das camadas é a mesma do piso; tipo ausente nas opções cai no primeiro existente', () => {
    expect(slabTypeError({ name: '', layers: [] })).not.toBeNull();
    expect(slabTypeError({ name: 'Laje', layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false }] })).toBeNull();
    const p = createEmptyProject();
    expect(keptSlabType(p, 'ls_mac15')).toBe('ls_mac15');
    expect(keptSlabType(p, 'inexistente')).toBe(Object.keys(p.slabTypes)[0]);
  });
});

describe('avisos: "Ir para" de laje (G2)', () => {
  it('laje vira alvo com a caixa do contorno e o nível', () => {
    const store = storeWithSlab();
    const issue: ValidationIssue = { severity: 'warning', code: 'teste', message: 'teste', elementId: 'l1' };
    const t = issueTarget(store.project, issue);
    expect(t?.levelId).toBe('lv_0');
    expect(t?.box).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 3 });
    expect(t?.center).toEqual({ x: 2, y: 1.5 });
  });
});
