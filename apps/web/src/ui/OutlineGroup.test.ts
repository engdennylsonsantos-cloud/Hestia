import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, type Floor } from '@hestia/model';
import { outlineView, runOutlineAction, type OutlineHolder } from './OutlineGroup.tsx';

const linked = (id: string, mode: 'walls-finish' | 'walls-core' | 'perimeter' = 'walls-finish'): OutlineHolder => ({ id, outlineSource: { mode, seed: { x: 1, y: 1 }, linked: true } });
const stat = (id: string): OutlineHolder => ({ id, outlineSource: { mode: 'walls-finish', seed: { x: 1, y: 1 }, linked: false } });
const croqui = (id: string): OutlineHolder => ({ id });

describe('grupo Contorno do piso e da laje (decisão 0023 §8.2)', () => {
  it('vinculado mostra o modo e habilita só Desvincular', () => {
    const v = outlineView([linked('f1', 'walls-core')]);
    expect(v.text).toBe('Vinculado às paredes (modo: núcleo)');
    expect(v.detachIds).toEqual(['f1']);
    expect(v.relinkIds).toEqual([]);
  });

  it('estático (editado à mão) habilita só Revincular às paredes', () => {
    const v = outlineView([stat('f1')]);
    expect(v.text).toBe('Estático (editado à mão)');
    expect(v.relinkIds).toEqual(['f1']);
    expect(v.detachIds).toEqual([]);
  });

  it('piso desenhado por croqui (sem origem) fica sem vínculo e com os botões desabilitados', () => {
    const v = outlineView([croqui('f1')]);
    expect(v.text).toBe('Sem vínculo (desenhado por croqui)');
    expect(v.detachIds).toEqual([]);
    expect(v.relinkIds).toEqual([]);
  });

  it('seleção mista: separa os ids de cada ação e nomeia modos variados', () => {
    const v = outlineView([linked('a', 'walls-finish'), linked('b', 'perimeter'), stat('c'), croqui('d')]);
    expect(v.text).toBe('Vinculado às paredes (modos variados) · Estático (editado à mão) · Sem vínculo (desenhado por croqui)');
    expect(v.detachIds).toEqual(['a', 'b']);
    expect(v.relinkIds).toEqual(['c']);
  });

  it('Desvincular em vários pisos é um passo só de desfazer', () => {
    const store = new ProjectStore(createEmptyProject());
    for (const id of ['f1', 'f2']) {
      store.exec({ type: 'addFloor', floor: makeFloor({ id, typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], outlineSource: { mode: 'walls-finish', seed: { x: 0.5, y: 0.5 }, linked: true } }) });
    }
    runOutlineAction(store, 'detach', ['f1', 'f2']);
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(false);
    expect((store.project.elements.f2 as Floor).outlineSource!.linked).toBe(false);
    store.undo();
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(true);
    expect((store.project.elements.f2 as Floor).outlineSource!.linked).toBe(true);
  });

  it('Revincular volta a acompanhar, com um passo de desfazer; lista vazia não faz nada', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], outlineSource: { mode: 'walls-finish', seed: { x: 0.5, y: 0.5 }, linked: true } }) });
    runOutlineAction(store, 'detach', ['f1']);
    const before = store.project;
    runOutlineAction(store, 'relink', []);
    expect(store.project).toBe(before);
    runOutlineAction(store, 'relink', ['f1']);
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(true);
    store.undo();
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(false);
  });
});
