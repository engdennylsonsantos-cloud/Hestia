import { afterEach, describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { useUi } from './state.ts';
import { categoryIdsOf, mergeHidden, removeHidden, visibilityKeyOf, visibilityOf } from './viewVisibility.ts';

afterEach(() => useUi.setState({ view: 'plan', planKind: 'floor', levelId: 'lv_0', areaPlanId: null, sectionId: null, viewTemp: {}, selection: [] }));

const parede = (p: ReturnType<typeof buildTemplate>) => Object.values(p.elements).find((e) => e.kind === 'wall')!;
const porta = (p: ReturnType<typeof buildTemplate>) => Object.values(p.elements).find((e) => e.kind === 'door')!;

describe('visibilidade por vista', () => {
  it('chave por vista: piso, cobertura, área, corte e 3D são distintos', () => {
    useUi.setState({ view: 'plan', planKind: 'floor', levelId: 'lv_0' });
    expect(visibilityKeyOf(useUi.getState())).toBe('plan:lv_0');
    useUi.setState({ planKind: 'roof' });
    expect(visibilityKeyOf(useUi.getState())).toBe('roof:lv_0');
    useUi.setState({ planKind: 'area', areaPlanId: 'ap1' });
    expect(visibilityKeyOf(useUi.getState())).toBe('area:ap1');
    useUi.setState({ view: 'section', sectionId: 'sec1' });
    expect(visibilityKeyOf(useUi.getState())).toBe('section:sec1');
    useUi.setState({ view: '3d' });
    expect(visibilityKeyOf(useUi.getState())).toBe('3d');
  });

  it('junta e remove ocultações sem repetir', () => {
    expect(mergeHidden({ elements: ['a'], categories: ['wall'] }, { elements: ['a', 'b'], categories: ['door'] })).toEqual({ elements: ['a', 'b'], categories: ['wall', 'door'] });
    expect(removeHidden({ elements: ['a', 'b'], categories: ['wall'] }, { elements: ['a'], categories: ['wall'] })).toEqual({ elements: ['b'] });
    expect(removeHidden({ elements: ['a'] }, { elements: ['a'] })).toBeUndefined();
  });

  it('hide permanente e categoria oculta somem; Reveal os devolve com borda', () => {
    const p = structuredClone(buildTemplate('house2'));
    const w = parede(p);
    const d = porta(p);
    const level = p.levels[0]!;
    level.hidden = { elements: [w.id], categories: ['door'] };
    useUi.setState({ view: 'plan', planKind: 'floor', levelId: level.id, viewTemp: {} });
    const normal = visibilityOf(p, useUi.getState());
    expect(normal.hidden.has(w.id)).toBe(true);
    expect(normal.hidden.has(d.id)).toBe(true);
    expect(normal.reveal).toBe(false);
    expect(categoryIdsOf(p, ['door'])).toContain(d.id);

    useUi.setState({ viewTemp: { [`plan:${level.id}`]: { reveal: true } } });
    const revelado = visibilityOf(p, useUi.getState());
    expect(revelado.reveal).toBe(true);
    expect(revelado.hidden.has(w.id)).toBe(false);
    expect(revelado.revealed.has(w.id)).toBe(true);
    expect(revelado.revealed.has(d.id)).toBe(true);
  });

  it('temporário: HH oculta, HI isola e HR limpa', () => {
    const p = buildTemplate('house2');
    const w = parede(p);
    const d = porta(p);
    const level = p.levels[0]!;
    const key = `plan:${level.id}`;
    useUi.setState({ view: 'plan', planKind: 'floor', levelId: level.id, viewTemp: { [key]: { hidden: { elements: [w.id] } } } });
    expect(visibilityOf(p, useUi.getState()).hidden.has(w.id)).toBe(true);
    useUi.setState({ viewTemp: { [key]: { isolated: { elements: [d.id] } } } });
    const iso = visibilityOf(p, useUi.getState());
    expect(iso.hidden.has(w.id)).toBe(true);
    expect(iso.hidden.has(d.id)).toBe(false);
    useUi.setState({ viewTemp: {} });
    expect(visibilityOf(p, useUi.getState()).hidden.size).toBe(0);
  });
});
