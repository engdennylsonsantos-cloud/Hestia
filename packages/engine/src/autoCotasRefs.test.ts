import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Project } from '@hestia/model';
import { cotasAutomaticas, type AutoCotaOptions } from './autoCotas.ts';

/**
 * Referências unificadas das cotas automáticas (vocabulário de `WallDimRef`/`OpeningDimRef`). Mesma sala de 6 × 4 m do
 * teste principal: alvenaria 14 (acabada 0,092 de cada lado do eixo; núcleo 0,07), porta de 0,90 m (batente de 5 cm)
 * com o centro a 2,00 m do início da parede sul.
 */
const RECT: Array<[number, number, number, number]> = [
  [0, 0, 6, 0],
  [6, 0, 6, 4],
  [6, 4, 0, 4],
  [0, 4, 0, 0],
];

function sala(dimensions?: Project['settings']['dimensions']): Project {
  const s = new ProjectStore(createEmptyProject());
  ['s', 'l', 'n', 'o'].forEach((id, i) => {
    const [x0, y0, x1, y1] = RECT[i]!;
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: x0, y: y0 }, b: { x: x1, y: y1 }, flipped: true, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } }) });
  });
  s.exec({ type: 'addOpening', opening: { id: 'p1', kind: 'door', typeId: 'ot_p90', hostId: 's', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  if (dimensions) s.exec({ type: 'setSettings', patch: { dimensions } });
  return s.project;
}

const medidas = (p: Project, o: AutoCotaOptions): number[] =>
  cotasAutomaticas(p, 'lv_0', { lados: 'sul', paredes: false, geometria: false, geral: false, ...o })
    .map((c) => Math.round(Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) * 1000) / 1000)
    .sort((a, b) => a - b);

describe('autoCotas com wallRef e openingRef', () => {
  it('cada wallRef mede até o plano esperado (centro do vão)', () => {
    const p = sala();
    expect(medidas(p, { wallRef: 'finish', openingRef: 'center' })).toEqual([2.092, 4.092]);
    expect(medidas(p, { wallRef: 'coreFace', openingRef: 'center' })).toEqual([2.07, 4.07]);
    expect(medidas(p, { wallRef: 'axis', openingRef: 'center' })).toEqual([2, 4]);
    expect(medidas(p, { wallRef: 'coreCenter', openingRef: 'center' })).toEqual([2, 4]);
  });

  it('cada openingRef usa a meia-largura da esquadria (centro, vão livre, vão externo, alizar)', () => {
    const p = sala();
    const base = { wallRef: 'axis' as const };
    expect(medidas(p, { ...base, openingRef: 'center' })).toEqual([2, 4]);
    expect(medidas(p, { ...base, openingRef: 'frame' })).toEqual([0.9, 1.55, 3.55]);
    expect(medidas(p, { ...base, openingRef: 'clear' })).toEqual([0.8, 1.6, 3.6]);
    // Tipo sem alizar: a referência "com alizar" coincide com o vão externo.
    expect(medidas(p, { ...base, openingRef: 'casing' })).toEqual([0.9, 1.55, 3.55]);
  });

  it('opções antigas continuam produzindo o mesmo resultado', () => {
    const p = sala();
    expect(medidas(p, { referencia: 'externa', modoAberturas: 'arestas' })).toEqual(medidas(p, { wallRef: 'finish', openingRef: 'frame' }));
    expect(medidas(p, { referencia: 'nucleo', modoAberturas: 'centro' })).toEqual(medidas(p, { wallRef: 'coreFace', openingRef: 'center' }));
    expect(medidas(p, { referencia: 'eixo' })).toEqual(medidas(p, { wallRef: 'axis', openingRef: 'frame' }));
    // Valores de antes da unificação (teste de regressão fixo).
    expect(medidas(p, { referencia: 'externa', modoAberturas: 'centro' })).toEqual([2.092, 4.092]);
    expect(medidas(p, { referencia: 'eixo' })).toEqual([0.9, 1.55, 3.55]);
  });

  it('sem opções vale a configuração de cotas do projeto', () => {
    expect(medidas(sala(), {})).toEqual(medidas(sala(), { wallRef: 'finish', openingRef: 'frame' }));
    expect(medidas(sala({ wallRef: 'axis', openingRef: 'center' }), {})).toEqual([2, 4]);
    // A opção explícita vence o projeto.
    expect(medidas(sala({ wallRef: 'axis', openingRef: 'center' }), { wallRef: 'finish' })).toEqual([2.092, 4.092]);
  });
});
