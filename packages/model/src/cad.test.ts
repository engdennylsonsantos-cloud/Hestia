import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands.ts';
import { createEmptyProject } from './defaults.ts';
import { isCad, type CadDrawing } from './cad.ts';

/** CAD de teste: um caminho fechado (quadrado), um aberto (linha) e um texto. */
const cad = (id: string, patch: Partial<Omit<CadDrawing, 'order'>> = {}): Omit<CadDrawing, 'order'> => ({
  id,
  kind: 'cad',
  levelId: 'lv_0',
  name: `CAD ${id}`,
  source: 'dxf',
  unit: 'm',
  layers: [{ name: '0' }],
  paths: [
    { layer: '0', closed: true, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
    { layer: '0', closed: false, pts: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
  ],
  texts: [{ layer: '0', at: { x: 0, y: 0 }, text: 'SALA', height: 0.2, rotation: 0 }],
  ...patch,
});

describe('comandos do CAD importado', () => {
  it('insere com ordem crescente', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_2') });
    const e1 = p.elements['cad_1'];
    const e2 = p.elements['cad_2'];
    expect(isCad(e1) ? e1.order : null).toBe(1);
    expect(isCad(e2) ? e2.order : null).toBe(2);
    expect(p.nextOrder).toBe(3);
  });

  it('atualiza nome, visibilidade e cota de deslocamento', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, {
      type: 'updateCadDrawing',
      id: 'cad_1',
      patch: { name: 'Planta do cliente', visible: false, offsetZ: 1.2 },
    });
    expect(p.elements['cad_1']).toMatchObject({ name: 'Planta do cliente', visible: false, offsetZ: 1.2 });
  });

  it('recusa atualizar elemento que não é CAD', () => {
    const p = createEmptyProject();
    const typeId = Object.keys(p.floorTypes)[0]!;
    applyCommand(p, {
      type: 'addFloor',
      floor: {
        id: 'f1',
        kind: 'floor',
        typeId,
        levelId: 'lv_0',
        boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        holes: [],
        heightOffset: 0,
        mark: '',
        comments: '',
      },
    });
    expect(() => applyCommand(p, { type: 'updateCadDrawing', id: 'f1', patch: { name: 'x' } })).toThrow('Elemento não é CAD: f1');
  });

  it('translada pontos dos caminhos e textos', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, { type: 'transform', ids: ['cad_1'], transform: { kind: 'translate', d: { x: 10, y: 5 } } });
    const e = p.elements['cad_1'];
    expect(e && 'paths' in e ? e.paths[0]?.pts : null).toEqual([
      { x: 10, y: 5 },
      { x: 11, y: 5 },
      { x: 11, y: 6 },
      { x: 10, y: 6 },
    ]);
    expect(e && 'texts' in e ? e.texts[0]?.at : null).toEqual({ x: 10, y: 5 });
  });

  it('espelha invertendo a ordem dos caminhos fechados', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, { type: 'transform', ids: ['cad_1'], transform: { kind: 'mirror', a: { x: 10, y: 0 }, b: { x: 10, y: 1 } } });
    const e = p.elements['cad_1'];
    if (!e || !('paths' in e)) throw new Error('CAD sumiu');
    // Espelho no eixo x = 10: x' = 20 − x e o caminho fechado inverte o sentido.
    expect(e.paths[0]?.pts).toEqual([
      { x: 20, y: 1 },
      { x: 19, y: 1 },
      { x: 19, y: 0 },
      { x: 20, y: 0 },
    ]);
    // Caminho aberto mantém a ordem original.
    expect(e.paths[1]?.pts).toEqual([{ x: 18, y: 0 }, { x: 17, y: 0 }]);
    expect(e.texts[0]?.at).toEqual({ x: 20, y: 0 });
  });

  it('exclui pelo id', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, { type: 'deleteElements', ids: ['cad_1'] });
    expect(p.elements['cad_1']).toBeUndefined();
  });

  it('muda de nível (com keep offset e com keep elevation)', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'addCadDrawing', cad: cad('cad_1') });
    applyCommand(p, { type: 'setElementLevel', ids: ['cad_1'], levelId: 'lv_1', keep: 'offset' });
    expect(p.elements['cad_1']).toMatchObject({ levelId: 'lv_1' });
    // keep elevation: a cota absoluta fica igual, então o deslocamento compensa a diferença de nível (3 m).
    applyCommand(p, { type: 'setElementLevel', ids: ['cad_1'], levelId: 'lv_0', keep: 'elevation' });
    expect(p.elements['cad_1']).toMatchObject({ levelId: 'lv_0', offsetZ: 3 });
  });
});
