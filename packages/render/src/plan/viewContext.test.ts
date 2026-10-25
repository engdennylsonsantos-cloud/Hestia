import { describe, expect, it } from 'vitest';
import { classifyLevelEntries, resolveRoofs, viewContextOf } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeRoof, makeWall, viewRangeOf, type Project } from '@hestia/model';
import { contextoDaVista } from './viewContext.ts';

const BOX = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }];

/** Dois pavimentos com paredes, piso e telhado no de cima; `anexada` liga o topo de uma parede ao telhado. */
function projeto(anexada: boolean): Project {
  const s = new ProjectStore(createEmptyProject('Vista'));
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_0', name: 'Térreo', elevation: 0 }) });
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_1', name: 'Pavimento 2', elevation: 3 }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w0', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_ext19', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, attachTopToRoof: anexada }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_ext19', levelId: 'lv_1', a: { x: 6, y: 0 }, b: { x: 6, y: 6 } }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_1', boundary: BOX }) });
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_1', boundary: BOX, shape: 'gable', slopePercent: 30 }) });
  return s.project;
}

/** Entradas da classificação em ordem (a de `classifyLevelEntries` já vem ordenada por id). */
const entradas = (p: Project, levelId: string) => classifyLevelEntries(p, levelId, viewRangeOf(p, levelId), contextoDaVista(p, levelId));
const entradasPadrao = (p: Project, levelId: string) => classifyLevelEntries(p, levelId, viewRangeOf(p, levelId));

describe('contexto de cotas da vista (contextoDaVista)', () => {
  it('sem parede anexada, a classificação do nível é a mesma que com o projeto inteiro', () => {
    const p = projeto(false);
    for (const id of ['lv_0', 'lv_1']) expect(entradas(p, id)).toEqual(entradasPadrao(p, id));
  });

  it('sem anexo, o contexto não resolve piso nem laje de outros níveis', () => {
    const p = projeto(false);
    const ctx = contextoDaVista(p, 'lv_0');
    expect(ctx.floors).toEqual([]);
    expect(ctx.slabs).toEqual([]);
    expect(ctx.roofs).toEqual(resolveRoofs(p, 'lv_0'));
  });

  it('com parede anexada ao telhado, usa o projeto inteiro e a classificação continua igual', () => {
    const p = projeto(true);
    const ctx = contextoDaVista(p, 'lv_1');
    expect(ctx).toEqual(viewContextOf(p));
    expect(entradas(p, 'lv_1')).toEqual(entradasPadrao(p, 'lv_1'));
  });

  it('a faixa do telhado do próprio nível sai igual (sem anexo, o contexto só tem os telhados do nível)', () => {
    const p = projeto(false);
    const roof = entradas(p, 'lv_1').find((e) => e.id === 'r1');
    const roofPadrao = entradasPadrao(p, 'lv_1').find((e) => e.id === 'r1');
    expect(roof).toBeDefined();
    expect(roof).toEqual(roofPadrao);
  });
});
