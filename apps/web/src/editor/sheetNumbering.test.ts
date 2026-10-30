import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, projectSheets, sheetOf, type Id, type Sheet } from '@hestia/model';
import {
  emitRevisionCommand,
  formatSheetNumber,
  moveSheetCommand,
  nextRevisionTag,
  numberPrefix,
  numberSequence,
  renumberCommand,
} from './sheetNumbering.ts';

/** Projeto com as pranchas dadas, na ordem dos números; devolve o store e os ids. */
function storeWith(numbers: string[]): { store: ProjectStore; ids: Id[] } {
  const store = new ProjectStore(createEmptyProject());
  const ids: Id[] = [];
  numbers.forEach((number, i) => {
    const sheet: Sheet = {
      id: `sht_${i + 1}`,
      number,
      name: `Prancha ${i + 1}`,
      size: 'A3',
      orientation: 'landscape',
      margin: 10,
      titleBlock: { project: 'Casa', client: '', author: 'Ana', date: '01/01/2026', revision: '' },
      viewports: [],
    };
    store.exec({ type: 'addSheet', sheet }, 'Criar prancha');
    ids.push(sheet.id);
  });
  return { store, ids };
}

const numbers = (s: ProjectStore): string[] => projectSheets(s.project).map((x) => x.number);

describe('numeração de pranchas: prefixo e sequência', () => {
  it('separa o prefixo antes do último hífen', () => {
    expect(numberPrefix('A-101')).toBe('A');
    expect(numberPrefix('ARQ-A-101')).toBe('ARQ-A');
    expect(numberPrefix('101')).toBe('');
  });

  it('lê a sequência numérica final', () => {
    expect(numberSequence('A-101')).toBe(101);
    expect(numberSequence('101')).toBe(101);
    expect(numberSequence('A')).toBeNull();
    expect(numberSequence('')).toBeNull();
  });

  it('formata com zeros à esquerda e sem prefixo', () => {
    expect(formatSheetNumber('E', 1, 3)).toBe('E-001');
    expect(formatSheetNumber('', 7, 2)).toBe('07');
  });
});

describe('renumeração em lote', () => {
  it('renumera três pranchas para E-201, E-202 e E-203 num passo só', () => {
    const { store, ids } = storeWith(['A-101', 'A-102', 'A-103']);
    const cmd = renumberCommand(store.project, ids, { prefix: 'E', start: 201 });
    expect(cmd?.type).toBe('batch');
    store.exec(cmd!, 'Renumerar pranchas');
    expect(numbers(store)).toEqual(['E-201', 'E-202', 'E-203']);
    store.undo();
    expect(numbers(store)).toEqual(['A-101', 'A-102', 'A-103']);
  });

  it('sem opções usa o prefixo e a sequência da primeira prancha e as casas padrão', () => {
    const { store, ids } = storeWith(['ARQ-7', 'ARQ-9']);
    store.exec(renumberCommand(store.project, ids)!, 'Renumerar pranchas');
    expect(numbers(store)).toEqual(['ARQ-007', 'ARQ-008']);
  });

  it('sem sequência na primeira prancha começa em 101', () => {
    const { store, ids } = storeWith(['A', 'A-102']);
    store.exec(renumberCommand(store.project, ids)!, 'Renumerar pranchas');
    expect(numbers(store)).toEqual(['101', '102']);
  });

  it('ignora ids inexistentes, respeita o passo e preserva as demais pranchas', () => {
    const { store, ids } = storeWith(['A-101', 'A-102', 'A-103']);
    const cmd = renumberCommand(store.project, [ids[2]!, 'nao_existe', ids[0]!], { prefix: 'P', start: 1, step: 2, padding: 2 });
    store.exec(cmd!, 'Renumerar pranchas');
    expect(numbers(store)).toEqual(['P-03', 'A-102', 'P-01']);
  });

  it('sem ids válidos devolve null', () => {
    const { store } = storeWith(['A-101']);
    expect(renumberCommand(store.project, [])).toBeNull();
    expect(renumberCommand(store.project, ['nao_existe'])).toBeNull();
  });
});

describe('reordenar pranchas', () => {
  it('troca com a vizinha de cima e de baixo', () => {
    const { store, ids } = storeWith(['A-101', 'A-102', 'A-103']);
    store.exec(moveSheetCommand(store.project, ids[1]!, -1)!, 'Mover para cima');
    expect(numbers(store)).toEqual(['A-102', 'A-101', 'A-103']);
    // A-101 ficou na posição do meio; descer troca com A-103.
    store.exec(moveSheetCommand(store.project, ids[0]!, 1)!, 'Mover para baixo');
    expect(numbers(store)).toEqual(['A-102', 'A-103', 'A-101']);
    store.undo();
    store.undo();
    expect(numbers(store)).toEqual(['A-101', 'A-102', 'A-103']);
  });

  it('no limite (ou com prancha inexistente) devolve null', () => {
    const { store, ids } = storeWith(['A-101', 'A-102']);
    expect(moveSheetCommand(store.project, ids[0]!, -1)).toBeNull();
    expect(moveSheetCommand(store.project, ids[1]!, 1)).toBeNull();
    expect(moveSheetCommand(store.project, 'nao_existe', 1)).toBeNull();
  });
});

describe('rótulo da próxima revisão', () => {
  it('sem revisões começa em 0', () => {
    expect(nextRevisionTag(undefined)).toBe('0');
    expect(nextRevisionTag([])).toBe('0');
  });

  it('com todas numéricas soma um', () => {
    expect(nextRevisionTag([{ tag: '1', date: '', description: '' }])).toBe('2');
    expect(nextRevisionTag([
      { tag: '0', date: '', description: '' },
      { tag: '2', date: '', description: '' },
    ])).toBe('3');
  });

  it('com letras segue a ordem alfabética (A → B, Z → AA)', () => {
    expect(nextRevisionTag([{ tag: 'A', date: '', description: '' }])).toBe('B');
    expect(nextRevisionTag([{ tag: 'Z', date: '', description: '' }])).toBe('AA');
    expect(nextRevisionTag([{ tag: 'B', date: '', description: '' }])).toBe('C');
  });
});

describe('emitir revisão', () => {
  it('grava a revisão e leva a tag para o carimbo; um desfazer desfaz tudo', () => {
    const { store, ids } = storeWith(['A-101', 'A-102']);
    const before = sheetOf(store.project, ids[0]!)!;
    expect(before.revisions ?? []).toHaveLength(0);
    store.exec(emitRevisionCommand(store.project, [ids[0]!], { date: '30/10/2026', description: 'Troca de esquadria', by: 'Ana' })!, 'Emitir revisão');
    const after = sheetOf(store.project, ids[0]!)!;
    expect(after.revisions).toEqual([{ tag: '0', date: '30/10/2026', description: 'Troca de esquadria', by: 'Ana' }]);
    expect(after.titleBlock.revision).toBe('0');
    // A segunda prancha não é tocada.
    expect(sheetOf(store.project, ids[1]!)?.revisions ?? []).toHaveLength(0);
    store.undo();
    const undone = sheetOf(store.project, ids[0]!)!;
    expect(undone.revisions ?? []).toHaveLength(0);
    expect(undone.titleBlock.revision).toBe('');
  });

  it('acrescenta ao histórico existente com a próxima tag', () => {
    const { store, ids } = storeWith(['A-101']);
    store.exec(emitRevisionCommand(store.project, ids, { date: '01/01/2026', description: 'Primeira', tag: 'A' })!, 'Emitir revisão');
    store.exec(emitRevisionCommand(store.project, ids, { date: '02/01/2026', description: 'Segunda' })!, 'Emitir revisão');
    const sh = sheetOf(store.project, ids[0]!)!;
    expect(sh.revisions?.map((r) => r.tag)).toEqual(['A', 'B']);
    expect(sh.titleBlock.revision).toBe('B');
  });

  it('emite na mesma tag para várias pranchas e devolve null sem ids válidos', () => {
    const { store, ids } = storeWith(['A-101', 'A-102']);
    store.exec(emitRevisionCommand(store.project, ids, { date: '01/01/2026', description: 'Conjunto', tag: 'R1' })!, 'Emitir revisão');
    expect(projectSheets(store.project).map((s) => s.titleBlock.revision)).toEqual(['R1', 'R1']);
    expect(projectSheets(store.project).map((s) => s.revisions?.[0]?.tag)).toEqual(['R1', 'R1']);
    expect(emitRevisionCommand(store.project, ['nao_existe'], { date: '', description: '' })).toBeNull();
  });
});
