import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, type Floor, type ValidationIssue } from '@hestia/model';
import { issueTarget } from './issuesView.ts';
import { compatibleTypes, duplicateFloorType, floorTypeDeleteBlock, floorTypeError, instancesOfType, renameFloorType, replaceType, tryDeleteFloorType } from './typeActions.ts';

const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

function storeWithFloor(): ProjectStore {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: square }) });
  return store;
}

describe('validação do tipo de piso (B1)', () => {
  const base = { name: 'Piso', layers: [{ function: 'finish1' as const, materialId: 'mat_ceramica', thickness: 0.01, wraps: false }] };

  it('tipo válido não tem erro', () => {
    expect(floorTypeError(base)).toBeNull();
  });

  it('exige nome, ao menos uma camada e espessura maior que zero fora da membrana', () => {
    expect(floorTypeError({ ...base, name: '  ' })).toContain('nome');
    expect(floorTypeError({ ...base, layers: [] })).toContain('ao menos uma camada');
    expect(floorTypeError({ ...base, layers: [{ ...base.layers[0]!, thickness: 0 }] })).toContain('Camada 1');
    expect(floorTypeError({ ...base, layers: [{ ...base.layers[0]!, function: 'membrane', thickness: 0 }] })).toBeNull();
  });
});

describe('operações de tipo de piso (B4)', () => {
  it('piso conta como instância do tipo e aparece nas substituições compatíveis', () => {
    const store = storeWithFloor();
    expect(instancesOfType(store.project, 'floor', 'ft_ceram')).toEqual(['f1']);
    expect(compatibleTypes(store.project, 'floor', 'ft_ceram').map((t) => t.id)).toContain('ft_laje12');
  });

  it('substituir o tipo troca o tipo do piso em uma transação', () => {
    const store = storeWithFloor();
    expect(replaceType(store, 'floor', 'ft_ceram', 'ft_madeira')).toBe(1);
    expect((store.project.elements.f1 as Floor).typeId).toBe('ft_madeira');
    store.undo();
    expect((store.project.elements.f1 as Floor).typeId).toBe('ft_ceram');
  });

  it('tipo em uso não pode ser excluído; o motivo aparece', () => {
    const store = storeWithFloor();
    expect(floorTypeDeleteBlock(store.project, 'ft_ceram')).toContain('Em uso');
    expect(tryDeleteFloorType(store, 'ft_ceram')).toMatchObject({ ok: false });
    expect(store.project.floorTypes.ft_ceram).toBeDefined();
  });

  it('tipo sem uso é excluído, desde que não seja o último', () => {
    const store = storeWithFloor();
    expect(floorTypeDeleteBlock(store.project, 'ft_laje12')).toBeNull();
    expect(tryDeleteFloorType(store, 'ft_laje12')).toEqual({ ok: true });
    expect(store.project.floorTypes.ft_laje12).toBeUndefined();
  });

  it('duplicar cria tipo novo com "(cópia)" e as mesmas camadas', () => {
    const store = storeWithFloor();
    const id = duplicateFloorType(store, 'ft_ceram');
    expect(id).toBeTruthy();
    const copy = store.project.floorTypes[id!]!;
    expect(copy.name).toBe('Cerâmico sobre contrapiso (cópia)');
    expect(copy.layers).toEqual(store.project.floorTypes.ft_ceram!.layers);
  });

  it('renomear troca o nome e recusa nome vazio', () => {
    const store = storeWithFloor();
    expect(renameFloorType(store, 'ft_ceram', '  Cerâmica  ')).toEqual({ ok: true });
    expect(store.project.floorTypes.ft_ceram!.name).toBe('Cerâmica');
    expect(renameFloorType(store, 'ft_ceram', ' ')).toMatchObject({ ok: false });
  });
});

describe('aviso de piso: "Ir para" (G2)', () => {
  it('piso leva ao seu nível, ao centro e à caixa do contorno', () => {
    const store = storeWithFloor();
    const issue: ValidationIssue = { severity: 'error', code: 'floor-zero-area', message: 'x', elementId: 'f1' };
    expect(issueTarget(store.project, issue)).toEqual({
      elementId: 'f1',
      levelId: 'lv_0',
      center: { x: 2, y: 1.5 },
      box: { minX: 0, minY: 0, maxX: 4, maxY: 3 },
    });
  });

  it('piso em nível que não existe fica sem nível', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f2', typeId: 'ft_ceram', levelId: 'lv_9', boundary: square }) });
    const issue: ValidationIssue = { severity: 'error', code: 'level-missing', message: 'x', elementId: 'f2' };
    expect(issueTarget(store.project, issue)?.levelId).toBeNull();
  });
});
