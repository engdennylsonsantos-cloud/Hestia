import { describe, expect, it } from 'vitest';
import { enclosedRooms } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Floor } from '@hestia/model';
import { NO_CIRCUIT_TEXT, linkAllOutlines, linkOutlineToWalls, linkOutcomeText, linkPreviewText, previewLinkOutlines } from './outlineLink.ts';

/** Cômodo de paredes com o eixo na borda (wt_alv14), canto (x0, y0). */
function room(s: ProjectStore, levelId: string, x0: number, y0: number, w: number, h: number): void {
  const pts = [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];
  pts.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${x0}_${y0}_${i}`, typeId: 'wt_alv14', levelId, a, b: pts[(i + 1) % 4]! }) }));
}

/** Piso por croqui com o contorno do espaço livre do cômodo (finish), ou um contorno qualquer. */
function floorOn(s: ProjectStore, id: string, levelId: string, boundary: { x: number; y: number }[]): void {
  s.exec({ type: 'addFloor', floor: makeFloor({ id, typeId: 'ft_ceram', levelId, boundary }) });
}

const roomFinish = (s: ProjectStore, levelId: string, x0: number): { x: number; y: number }[] =>
  enclosedRooms(s.project, levelId, 'finish').find((r) => r[0]![0]!.x < x0 + 0.5 && r[0]![0]!.x > x0 - 0.5)![0]!;

const isLinked = (s: ProjectStore, id: string): boolean => (s.project.elements[id] as Floor).outlineSource?.linked === true;

describe('vínculo do contorno às paredes: comandos e prévia (decisão 0023 §8.2)', () => {
  it('vincular um piso de croqui sobre o espaço entre paredes e desfazer volta ao estático', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    floorOn(s, 'f1', 'lv_0', roomFinish(s, 'lv_0', 0));
    const out = linkOutlineToWalls(s, 'f1');
    expect(out).toEqual({ vinculados: 1, semCorrespondencia: 0 });
    expect((s.project.elements.f1 as Floor).outlineSource).toMatchObject({ mode: 'walls-finish', linked: true });
    s.undo();
    expect((s.project.elements.f1 as Floor).outlineSource).toBeUndefined();
  });

  it('piso sem correspondência: o comando não grava nada nem cria passo de desfazer', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    floorOn(s, 'f1', 'lv_0', [{ x: 0.7, y: 0.4 }, { x: 3.1, y: 0.2 }, { x: 2.2, y: 2.6 }]);
    const before = s.project;
    expect(linkOutlineToWalls(s, 'f1')).toEqual({ vinculados: 0, semCorrespondencia: 1 });
    expect(s.project).toBe(before);
  });

  it('lote no nível: dois vinculáveis e um sem correspondência; um passo de desfazer desfaz os dois', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    room(s, 'lv_0', 10, 0, 2, 2);
    floorOn(s, 'fa', 'lv_0', roomFinish(s, 'lv_0', 0));
    floorOn(s, 'fb', 'lv_0', roomFinish(s, 'lv_0', 10));
    floorOn(s, 'fx', 'lv_0', [{ x: 0.7, y: 0.4 }, { x: 3.1, y: 0.2 }, { x: 2.2, y: 2.6 }]);
    expect(linkAllOutlines(s, 'lv_0')).toEqual({ vinculados: 2, semCorrespondencia: 1 });
    expect(isLinked(s, 'fa') && isLinked(s, 'fb')).toBe(true);
    expect(isLinked(s, 'fx')).toBe(false);
    s.undo();
    expect(isLinked(s, 'fa') || isLinked(s, 'fb')).toBe(false);
    expect((s.project.elements.fa as Floor).outlineSource).toBeUndefined();
  });

  it('prévia de um elemento: "O contorno vai de X m² para Y m² (Z%). Vincular?"', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    floorOn(s, 'f1', 'lv_0', roomFinish(s, 'lv_0', 0));
    expect(linkPreviewText(previewLinkOutlines(s.project, ['f1']))).toBe('O contorno vai de 10,75 m² para 10,75 m² (0,0%). Vincular?');
  });

  it('prévia agregada informa quantos não casam e a variação somada', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    floorOn(s, 'fa', 'lv_0', roomFinish(s, 'lv_0', 0));
    floorOn(s, 'fx', 'lv_0', [{ x: 0.7, y: 0.4 }, { x: 3.1, y: 0.2 }, { x: 2.2, y: 2.6 }]);
    expect(linkPreviewText(previewLinkOutlines(s.project, ['fa', 'fx']))).toMatch(/^1 vinculável, 1 sem correspondência\. A área vai de .* Vincular\?$/);
  });

  it('sem correspondência, a barra de status diz o motivo', () => {
    expect(linkOutcomeText({ vinculados: 0, semCorrespondencia: 2 })).toBe(NO_CIRCUIT_TEXT);
    expect(linkOutcomeText({ vinculados: 2, semCorrespondencia: 1 })).toBe('2 pisos e lajes vinculados às paredes. 1 sem correspondência, como estavam.');
  });

  it('ids que não são piso nem laje são ignorados na prévia', () => {
    const s = new ProjectStore(createEmptyProject());
    room(s, 'lv_0', 0, 0, 4, 3);
    expect(previewLinkOutlines(s.project, ['wll_inexistente']).vinculaveis).toEqual([]);
  });
});
