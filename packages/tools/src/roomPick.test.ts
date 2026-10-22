import { describe, expect, it } from 'vitest';
import { makeLevel, type ProjectStore } from '@hestia/model';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { pickRoomAt, roomIdsInBox, sameNameRoomIds, selectedRooms } from './roomPick.ts';
import { clickAt, drawWall, makeEnv, tool } from './testEnv.ts';
import { selectedMovables } from './edit.ts';
import { idsOfCategory } from './selectionFilters.ts';

/** Quatro paredes de um retângulo 4 × 3 (eixo), com dois ambientes: um à esquerda, um à direita da divisória em x=2. */
function dois(): { s: ProjectStore; ids: [string, string] } {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [4, 0], [4, 3]);
  drawWall(ctx.env, [4, 3], [0, 3]);
  drawWall(ctx.env, [0, 3], [0, 0]);
  drawWall(ctx.env, [2, 0], [2, 3]);
  const t = tool('room', ctx.env);
  clickAt(t, 1, 1.5);
  clickAt(t, 3, 1.5);
  const ids = Object.values(ctx.store.project.elements).filter((e) => e.kind === 'room').map((e) => e.id);
  return { s: ctx.store, ids: [ids[0]!, ids[1]!] };
}

describe('seleção de ambientes (F2, F5)', () => {
  it('clique: o ambiente sob o cursor; fora de qualquer circuito, nenhum', () => {
    const { s, ids } = dois();
    expect(pickRoomAt(s.project, 'lv_0', { x: 1, y: 1.5 })).toBe(ids[0]);
    expect(pickRoomAt(s.project, 'lv_0', { x: 3, y: 1.5 })).toBe(ids[1]);
    expect(pickRoomAt(s.project, 'lv_0', { x: 30, y: 30 })).toBeNull();
  });

  it('janela esq→dir pega só os contidos; dir→esq pega os que cruzam', () => {
    const { s, ids } = dois();
    expect(roomIdsInBox(s.project, 'lv_0', { x: -1, y: -1 }, { x: 2, y: 4 })).toEqual([ids[0]]);
    expect(roomIdsInBox(s.project, 'lv_0', { x: 5, y: -1 }, { x: 2.5, y: 4 })).toEqual([ids[1]]);
    expect(roomIdsInBox(s.project, 'lv_0', { x: -1, y: -1 }, { x: 10, y: 10 })).toHaveLength(2);
  });

  it('mesmo nome: seleciona os ambientes do nível com o nome dos selecionados', () => {
    const { s, ids } = dois();
    s.exec({ type: 'updateElements', ids: [ids[1]], patch: { name: 'Sala' } });
    s.exec({ type: 'updateElements', ids: [ids[0]], patch: { name: 'Sala' } });
    expect(sameNameRoomIds(s.project, 'lv_0', [ids[0]]).sort()).toEqual([...ids].sort());
    expect(sameNameRoomIds(s.project, 'lv_0', [])).toEqual([]);
  });

  it('mover e copiar: ambientes entram nos movíveis; a categoria "rooms" lista os do nível', () => {
    const { s, ids } = dois();
    expect(selectedRooms(s.project, [ids[0], 'w_x'])).toEqual([ids[0]]);
    expect(selectedMovables(s.project, [ids[0]])).toEqual([ids[0]]);
    expect(idsOfCategory(s.project, 'lv_0', 'rooms').sort()).toEqual([...ids].sort());
  });
});

describe('copiar e colar alinhado com ambientes (F4)', () => {
  it('cola no outro nível nas mesmas coordenadas, com ids novos', () => {
    const { s, ids } = dois();
    s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_1', name: 'Pav 1', elevation: 3 }) });
    const clip = clipboardFrom(s.project, [ids[0]!]);
    expect(clip?.rooms).toHaveLength(1);
    const r = pasteAlignedCommand(s.project, clip!, 'lv_1');
    expect(r?.roomIds).toHaveLength(1);
    expect(r?.roomIds[0]).not.toBe(ids[0]);
    s.exec(r!.command);
    const pasted = s.project.elements[r!.roomIds[0]!];
    expect(pasted?.kind === 'room' && pasted.levelId).toBe('lv_1');
    expect(pasted?.kind === 'room' && pasted.point).toEqual({ x: 1, y: 1.5 });
  });
});
