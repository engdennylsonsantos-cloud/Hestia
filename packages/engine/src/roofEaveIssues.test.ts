import { describe, expect, it } from 'vitest';
import { v2, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, type Project } from '@hestia/model';
import { EAVE_OPENING_DISTANCE, roofEaveIssues } from './roofEaveIssues.ts';

/** Meia espessura da parede wt_alv14 (0,184 m): o eixo das paredes fica no contorno da casa. */
const H = 0.184 / 2;

/** Retângulo em sentido horário a partir de (x0; y0). */
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [v2(x0, y0), v2(x1, y0), v2(x1, y1), v2(x0, y1)];

/** Contorno de telhado que sobra `d` metros além da face externa das paredes (casa de 8 x 6 m, eixos no contorno). */
const beiral = (d: number): Vec2[] => rect(-(H + d), -(H + d), 8 + H + d, 6 + H + d);

/**
 * Casa de 8 x 6 m no nível lv_0: quatro paredes de 0,184 m (eixos no contorno), opcionalmente uma divisória interna
 * (parede de 9 cm, dentro da área do telhado), uma janela J-01 de 1,20 m na parede sul (w_s), no meio ou no
 * `janelaEm` (distância ao início da parede), e um telhado com o contorno dado (`null` = sem telhado).
 */
function casa(telhado: Vec2[] | null, opts: { janela?: boolean; janelaEm?: number; divisoria?: boolean } = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const cantos = [v2(0, 0), v2(8, 0), v2(8, 6), v2(0, 6)];
  const ids = ['w_s', 'w_e', 'w_n', 'w_o'];
  cantos.forEach((a, i) => {
    const b = cantos[(i + 1) % cantos.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: ids[i]!, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 2.8 }) });
  });
  if (opts.divisoria) {
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w_div', typeId: 'wt_alv9', levelId: 'lv_0', a: v2(4, 0), b: v2(4, 6), height: 2.8 }) });
  }
  if (opts.janela) {
    s.exec({
      type: 'addOpening',
      opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'w_s', offset: opts.janelaEm ?? 4, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
    });
  }
  if (telhado) s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: telhado }) });
  return s.project;
}

describe('aviso de beiral (roofEaveIssues)', () => {
  it('limite de proximidade da abertura: 0,30 m', () => {
    expect(EAVE_OPENING_DISTANCE).toBe(0.3);
  });

  it('casa com beiral de 0,5 m para fora, janela e divisória interna: sem aviso', () => {
    expect(roofEaveIssues(casa(beiral(0.5), { janela: true, divisoria: true }))).toEqual([]);
  });

  it('contorno igual à pegada (sem balanço), com janela: sem aviso', () => {
    expect(roofEaveIssues(casa(beiral(0), { janela: true }))).toEqual([]);
  });

  it('contorno que corta a parede oeste: aviso roof-eave-wall apontando a parede', () => {
    // A aresta oeste do telhado fica 4 cm para dentro da face externa da parede w_o (corpo de 18,4 cm).
    const corta = rect(-H + 0.04, -(H + 0.5), 8 + H + 0.5, 6 + H + 0.5);
    const issues = roofEaveIssues(casa(corta, { janela: true }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('roof-eave-wall');
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.elementId).toBe('r1');
    expect(issues[0]!.ids).toEqual(['r1', 'w_o']);
    expect(issues[0]!.message).toMatch(/^Telhado "r1": beiral invade a parede "w_o"/);
  });

  it('beiral a 20 cm da janela: aviso roof-eave-opening com a distância', () => {
    const issues = roofEaveIssues(casa(beiral(0.2), { janela: true }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('roof-eave-opening');
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.elementId).toBe('r1');
    expect(issues[0]!.ids).toEqual(['r1', 'j1']);
    expect(issues[0]!.message).toMatch(/beiral a 20,0 cm da abertura "j1"/);
  });

  it('contorno sem balanço com janela a 20 cm do canto (a empena encosta na parede perpendicular): sem aviso', () => {
    expect(roofEaveIssues(casa(beiral(0), { janela: true, janelaEm: 0.8 }))).toEqual([]);
  });

  it('sem telhados: lista vazia', () => {
    expect(roofEaveIssues(casa(null, { janela: true, divisoria: true }))).toEqual([]);
  });
});
