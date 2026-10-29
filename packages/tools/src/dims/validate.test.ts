import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Project } from '@hestia/model';
import { hostedConflicts } from './validate.ts';

/** Parede `h` de 0 a 6 com a porta P-02 (0,80) em 5,50 (encostada na ponta: 5,10..5,90) e a janela J-01 (1,20) em 1,50. */
function cena(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 5.5, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  s.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: null, mark: 'JX' } });
  return s.project;
}

describe('hostedConflicts', () => {
  it('encurtar a parede com porta na ponta falha, com mensagem e sem comando', () => {
    expect(hostedConflicts(cena(), 'h', { length: 5.5 })).toBe('A porta P-02 sairia da parede. Mova ou apague a esquadria antes.');
  });

  it('encurtar com folga passa', () => {
    expect(hostedConflicts(cena(), 'h', { length: 5.9 })).toBeNull();
    expect(hostedConflicts(cena(), 'h', { length: 6 })).toBeNull();
  });

  it('a janela usa a marca no texto', () => {
    expect(hostedConflicts(cena(), 'h', { startShift: 1.0 })).toBe('A janela JX sairia da parede. Mova ou apague a esquadria antes.');
  });

  it('mover o início para dentro respeita a posição no mundo das esquadrias', () => {
    expect(hostedConflicts(cena(), 'h', { startShift: 0.8 })).toBeNull();
    expect(hostedConflicts(cena(), 'h', { startShift: -0.5, length: 6.5 })).toBeNull();
    // Recuar o início 0,5 e manter o comprimento de 6: a porta (5,10..5,90 no sistema antigo) passa a 5,60..6,40 e sai.
    expect(hostedConflicts(cena(), 'h', { startShift: -0.5 })).toContain('A porta P-02');
  });

  it('mover a parede inteira (sem mudar comprimento nem início) não altera nada', () => {
    expect(hostedConflicts(cena(), 'h', {})).toBeNull();
  });

  it('parede inexistente ou sem esquadrias', () => {
    expect(hostedConflicts(cena(), 'nao-existe', { length: 1 })).toBeNull();
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'x', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }) });
    expect(hostedConflicts(s.project, 'x', { length: 0.5 })).toBeNull();
  });
});
