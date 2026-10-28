import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, ProjectStore, createEmptyProject, type Command, type Material, type OpeningType, type Project } from './index.ts';
import { duplicateOpeningType, exportOpeningTypes, importOpeningTypes, materiaisDoTipo } from './openingTypeLibrary.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

/** Arquivo como sai do disco: serializado e lido de volta. */
const emDisco = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

/** Executa os comandos da importação numa só transação, como o chamador faz. */
function aplica(p: Project, commands: Command[]): Project {
  const s = new ProjectStore(p);
  s.exec({ type: 'batch', commands }, 'Importar tipos');
  return s.project;
}

const arquivo = (types: unknown[], materials: unknown[] = []): unknown => ({ kind: 'hestia-opening-types', schemaVersion: 1, types, materials });

const material = (id: string, cor = '#123456'): Material => ({ id, name: `Material ${id}`, color: cor, hatch: 'solid', gloss: 0.2, opacity: 1, cost: 10, unit: 'm2' });

describe('duplicar tipo de abertura', () => {
  it('cópia com id novo, nome "(cópia)" e código com sufixo livre; o original não muda', () => {
    const p = createEmptyProject();
    const c = duplicateOpeningType(p, 'ot_p80');
    expect(c.id).not.toBe('ot_p80');
    expect(c.name).toBe('Porta 80 x 210 (cópia)');
    expect(c.code).toBe('P-02-2');
    expect(c.width).toBe(tipo('ot_p80').width);
    expect(p.openingTypes.ot_p80!.code).toBe('P-02');
  });

  it('pega o próximo sufixo livre quando o código-base já tem cópia', () => {
    const p = createEmptyProject();
    p.openingTypes.ot_x = { ...tipo('ot_p80'), id: 'ot_x', code: 'P-02-2' };
    expect(duplicateOpeningType(p, 'ot_p80').code).toBe('P-02-3');
  });

  it('código vazio continua vazio (não informado)', () => {
    const p = createEmptyProject();
    p.openingTypes.ot_p80 = { ...tipo('ot_p80'), code: '' };
    expect(duplicateOpeningType(p, 'ot_p80').code).toBe('');
  });

  it('cópia profunda: mudar um objeto aninhado da cópia não altera o original', () => {
    const p = createEmptyProject();
    p.openingTypes.ot_p80 = { ...tipo('ot_p80'), threshold: { thickness: 0.02 } };
    const c = duplicateOpeningType(p, 'ot_p80');
    c.threshold!.thickness = 0.5;
    expect(p.openingTypes.ot_p80!.threshold!.thickness).toBe(0.02);
  });

  it('tipo inexistente lança erro em português', () => {
    expect(() => duplicateOpeningType(createEmptyProject(), 'nao_existe')).toThrow('Tipo de abertura inexistente');
  });
});

describe('exportar tipos de abertura', () => {
  it('leva os tipos escolhidos e só os materiais que eles referenciam', () => {
    const p = createEmptyProject();
    const arq = exportOpeningTypes(p, ['ot_p80']);
    expect(arq.kind).toBe('hestia-opening-types');
    expect(arq.schemaVersion).toBe(1);
    expect(arq.types.map((t) => t.id)).toEqual(['ot_p80']);
    const ids = arq.materials.map((m) => m.id);
    expect(ids).toContain(tipo('ot_p80').frameMaterialId);
    expect(ids).not.toContain('mat_concreto');
    expect(ids.every((id) => materiaisDoTipo(arq.types[0]!).includes(id))).toBe(true);
  });

  it('junta o material da folha e o da soleira, em qualquer campo materialId', () => {
    const p = createEmptyProject();
    p.openingTypes.ot_p80 = { ...tipo('ot_p80'), leafMaterialId: 'mat_aco', threshold: { thickness: 0.02, materialId: 'mat_concreto' } };
    const ids = exportOpeningTypes(p, ['ot_p80']).materials.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['mat_aco', 'mat_concreto']));
  });

  it('ids repetidos saem uma vez; id inexistente lança erro', () => {
    const p = createEmptyProject();
    expect(exportOpeningTypes(p, ['ot_p80', 'ot_p80']).types).toHaveLength(1);
    expect(() => exportOpeningTypes(p, ['nao_existe'])).toThrow('Tipo de abertura inexistente');
  });

  it('a saída não compartilha objetos com o projeto', () => {
    const p = createEmptyProject();
    const arq = exportOpeningTypes(p, ['ot_p80']);
    arq.types[0]!.name = 'alterado';
    expect(p.openingTypes.ot_p80!.name).not.toBe('alterado');
  });
});

describe('importar tipos de abertura', () => {
  it('round trip no mesmo projeto não perde nada: cada tipo volta com id e código novos, o resto igual', () => {
    const p = createEmptyProject();
    const originais = Object.values(p.openingTypes);
    const r = importOpeningTypes(p, emDisco(exportOpeningTypes(p, originais.map((t) => t.id))));
    expect(r.skipped).toEqual([]);
    expect(r.imported).toHaveLength(originais.length);
    expect(r.commands.some((c) => c.type === 'upsertMaterial')).toBe(false);
    const depois = aplica(p, r.commands);
    const novos = Object.values(depois.openingTypes).filter((t) => !p.openingTypes[t.id]);
    expect(novos).toHaveLength(originais.length);
    const semIdentidade = (t: OpeningType): string => JSON.stringify({ ...t, id: '', code: '' });
    expect(novos.map(semIdentidade).sort()).toEqual(originais.map(semIdentidade).sort());
    const codigos = novos.map((t) => t.code).filter((c): c is string => !!c);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const t of novos) expect(t.code && originais.some((o) => o.code === t.code)).toBeFalsy();
  });

  it('colisão de id: o tipo recebe id novo e o existente não muda', () => {
    const p = createEmptyProject();
    const antes = JSON.stringify(p.openingTypes.ot_p80);
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), name: 'Porta importada', code: 'P-99' }]));
    const depois = aplica(p, r.commands);
    expect(JSON.stringify(depois.openingTypes.ot_p80)).toBe(antes);
    const novo = Object.values(depois.openingTypes).find((t) => t.name === 'Porta importada');
    expect(novo).toBeDefined();
    expect(novo!.id).not.toBe('ot_p80');
  });

  it('dois tipos do mesmo arquivo com o mesmo id: o segundo ganha id novo', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), id: 'zz', code: 'Z-1', name: 'A' }, { ...tipo('ot_p90'), id: 'zz', code: 'Z-2', name: 'B' }]));
    expect(r.imported).toEqual(['A', 'B']);
    const depois = aplica(p, r.commands);
    expect(depois.openingTypes.zz!.name).toBe('A');
    expect(Object.values(depois.openingTypes).some((t) => t.name === 'B' && t.id !== 'zz')).toBe(true);
  });

  it('colisão de código: ganha sufixo livre; dois tipos do arquivo com o mesmo código não se confundem', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), id: 'x1', code: 'P-02', name: 'A' }, { ...tipo('ot_p90'), id: 'x2', code: 'P-02', name: 'B' }]));
    const depois = aplica(p, r.commands);
    expect(depois.openingTypes.x1!.code).toBe('P-02-2');
    expect(depois.openingTypes.x2!.code).toBe('P-02-3');
  });

  it('código vazio não ganha sufixo', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), id: 'x1', code: '' }]));
    expect(aplica(p, r.commands).openingTypes.x1!.code).toBe('');
  });

  it('tipo inválido é pulado e listado com o motivo; os outros entram', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(
      p,
      arquivo([
        { ...tipo('ot_p80'), id: 'v1', name: 'Boa' },
        { ...tipo('ot_p90'), id: 'v2', name: 'Sete folhas', leaves: 7 },
        { ...tipo('ot_p90'), id: 'v3', name: 'Largura negativa', width: -1 },
        { ...tipo('ot_p90'), id: 'v4', name: 'Símbolo inexistente', plan: 'garage', leaves: 2 },
        'lixo',
      ]),
    );
    expect(r.imported).toEqual(['Boa']);
    expect(r.skipped.map((s) => s.name)).toEqual(['Sete folhas', 'Largura negativa', 'Símbolo inexistente', '(sem nome)']);
    expect(r.skipped[0]!.reason).toMatch(/folhas/);
    expect(r.skipped[1]!.reason).toMatch(/largura/);
    expect(r.skipped[2]!.reason).toMatch(/Combinação inválida/);
    const depois = aplica(p, r.commands);
    expect(Object.values(depois.openingTypes).some((t) => t.name === 'Sete folhas')).toBe(false);
  });

  it('versão mais nova é recusada com mensagem em português', () => {
    const p = createEmptyProject();
    expect(() => importOpeningTypes(p, { kind: 'hestia-opening-types', schemaVersion: 2, types: [], materials: [] })).toThrow(/versão 2.*mais nova/);
  });

  it('arquivo de outro formato, sem versão ou sem lista de tipos é recusado', () => {
    const p = createEmptyProject();
    expect(() => importOpeningTypes(p, { kind: 'hestia-project', schemaVersion: 1, types: [] })).toThrow('não é de tipos de esquadria do Hestia');
    expect(() => importOpeningTypes(p, 'texto')).toThrow('não é de tipos de esquadria do Hestia');
    expect(() => importOpeningTypes(p, { kind: 'hestia-opening-types', types: [] })).toThrow('Versão do arquivo ausente');
    expect(() => importOpeningTypes(p, { kind: 'hestia-opening-types', schemaVersion: 1 })).toThrow('não traz a lista de tipos');
  });

  it('material que falta no projeto entra pelo id e o tipo fica apontado para ele', () => {
    const p = createEmptyProject();
    delete p.materials.mat_madeira;
    const r = importOpeningTypes(p, emDisco(exportOpeningTypes(createEmptyProject(), ['ot_p80'])));
    expect(r.commands.some((c) => c.type === 'upsertMaterial' && c.material.id === 'mat_madeira')).toBe(true);
    const depois = aplica(p, r.commands);
    expect(depois.materials.mat_madeira).toBeDefined();
    const novo = Object.values(depois.openingTypes).find((t) => t.name === tipo('ot_p80').name && t.id !== 'ot_p80');
    expect(novo!.frameMaterialId).toBe('mat_madeira');
  });

  it('material com o mesmo id e outro conteúdo entra com id novo e o tipo é reapontado', () => {
    const origem = createEmptyProject();
    origem.materials.mat_madeira = material('mat_madeira', '#101010');
    const destino = createEmptyProject();
    const antes = destino.materials.mat_madeira!.color;
    const r = importOpeningTypes(destino, emDisco(exportOpeningTypes(origem, ['ot_p80'])));
    const mat = r.commands.find((c) => c.type === 'upsertMaterial');
    expect(mat && mat.type === 'upsertMaterial' ? mat.material.id : '').not.toBe('mat_madeira');
    const depois = aplica(destino, r.commands);
    expect(depois.materials.mat_madeira!.color).toBe(antes);
    const novo = r.commands.find((c) => c.type === 'upsertOpeningType');
    const idMat = mat && mat.type === 'upsertMaterial' ? mat.material.id : '';
    expect(novo && novo.type === 'upsertOpeningType' ? novo.openingType.frameMaterialId : '').toBe(idMat);
    expect(depois.materials[idMat]!.color).toBe('#101010');
  });

  it('material do arquivo e do projeto iguais não gera comando de material', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, emDisco(exportOpeningTypes(p, ['ot_p80'])));
    expect(r.commands.filter((c) => c.type === 'upsertMaterial')).toHaveLength(0);
  });

  it('material ausente no arquivo e no projeto pula o tipo', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), id: 'm1', glassMaterialId: 'mat_faltando' }]));
    expect(r.imported).toEqual([]);
    expect(r.commands).toEqual([]);
    expect(r.skipped[0]!.reason).toContain('mat_faltando');
  });

  it('tipo pulado por material ausente não deixa material novo para trás', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(
      p,
      arquivo([{ ...tipo('ot_p80'), id: 'm2', frameMaterialId: 'mat_novo', glassMaterialId: 'mat_faltando' }], [material('mat_novo')]),
    );
    expect(r.commands).toEqual([]);
    expect(r.skipped).toHaveLength(1);
  });

  it('material inválido no arquivo é ignorado (o tipo que o usa é pulado)', () => {
    const p = createEmptyProject();
    const r = importOpeningTypes(p, arquivo([{ ...tipo('ot_p80'), id: 'm3', frameMaterialId: 'mat_ruim' }], [{ id: 'mat_ruim', name: 'x', color: 'vermelho' }]));
    expect(r.imported).toEqual([]);
    expect(r.skipped[0]!.reason).toContain('mat_ruim');
  });
});
