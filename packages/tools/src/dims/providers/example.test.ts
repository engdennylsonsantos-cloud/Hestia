import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf, isWall, makeWall, ProjectStore } from '@hestia/model';
import { clearDimProviders, registerDimProvider, selectionDims } from '../registry.ts';
import type { DimContext, DimProvider } from '../types.ts';

/*
 * EXEMPLO COMPLETO de um provedor mínimo (o mesmo texto de docs/plano-unidades-cotas/COMO-ADICIONAR-COTA.md).
 * Mede o comprimento de uma parede; digitar o valor move a ponta `b`. Nada no overlay precisa mudar.
 */
interface ComprimentoSubject { wallId: string }

const comprimento: DimProvider<ComprimentoSubject> = {
  id: 'comprimento',
  selectionSubject: (p, id) => (isWall(p.elements[id]) ? { wallId: id } : null),
  compute(ctx, { wallId }) {
    const w = ctx.project.elements[wallId];
    if (!isWall(w)) return [];
    const end = (at: typeof w.a, slot: string) => ({ at, slot, kind: 'wall' as const, current: ctx.settings.wallRef, options: ['axis' as const] });
    return [{
      key: `comprimento:${wallId}:len`, a: w.a, b: w.b, offset: 0.3, value: Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y),
      ends: [end(w.a, 'a'), end(w.b, 'b')] as [ReturnType<typeof end>, ReturnType<typeof end>],
      edit: (v: number) => (v > 0 ? { commands: [{ type: 'setWallEnds' as const, id: wallId, b: { x: w.a.x + v, y: w.a.y } }] } : { error: 'Comprimento inválido.' }),
    }];
  },
};

describe('exemplo da documentação: provedor mínimo', () => {
  beforeEach(() => clearDimProviders());

  it('registrar com UMA linha basta: a seleção devolve a cota e a edição devolve comandos', () => {
    registerDimProvider('wall', comprimento);
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    const ctx: DimContext = { project: s.project, levelId: 'lv_0', settings: dimensionSettingsOf(s.project), overrides: {} };
    const [dim] = selectionDims(ctx, ['w']);
    expect(dim!.value).toBe(4);
    const r = dim!.edit!(5);
    if (!('commands' in r)) throw new Error('esperava comandos');
    r.commands.forEach((c) => s.exec(c));
    expect(selectionDims({ ...ctx, project: s.project }, ['w'])[0]!.value).toBe(5);
    expect(dim!.edit!(0)).toEqual({ error: 'Comprimento inválido.' });
  });

  it('sem registro nada aparece', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    expect(selectionDims({ project: s.project, levelId: 'lv_0', settings: dimensionSettingsOf(s.project), overrides: {} }, ['w'])).toEqual([]);
  });
});
