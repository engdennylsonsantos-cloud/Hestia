import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type Opening, type Project } from '@hestia/model';
import { resolveLevel } from './resolve.ts';
import type { ResolvedLevel } from './types.ts';

const P = (x: number, y: number): Vec2 => ({ x, y });

/** Parede de 3 m a 2,80 m com uma janela de peitoril 0,90 no meio (furo na planta quando o corte a atravessa). */
function project(extra: Partial<Parameters<typeof makeWall>[0]> = {}, withWindow = true): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: P(0, 0), b: P(3, 0), height: 2.8, ...extra }) });
  if (withWindow) {
    const j: Opening = { id: 'j', kind: 'window', typeId: 'ot_j120', hostId: 'w', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: 0.9, mark: '' };
    s.exec({ type: 'addOpening', opening: j });
  }
  return s.project;
}

const silhouetteArea = (r: ResolvedLevel): number => r.clusters.reduce((s, c) => s + multiArea(c.silhouette), 0);
const cutArea = (r: ResolvedLevel, id: string): number => r.walls[id]!.layers.reduce((s, l) => s + multiArea(l.cut), 0);

describe('resolveLevel · opções de planta (decisão 0013 §4)', () => {
  it('sem opções (ou com objeto vazio), o resultado é o de sempre; e com o corte de 1,20 m explícito, o mesmo numa parede sobre o nível', () => {
    const p = project();
    const plain = resolveLevel(p, 'lv_0', new Map());
    expect(resolveLevel(p, 'lv_0', new Map(), {})).toEqual(plain);
    expect(resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2 })).toEqual(plain);
  });

  it('sem cutZ, o corte fica 1,20 m acima da base da própria parede', () => {
    // Base a 1,50: o corte padrão cai a 2,70, acima de uma parede que vai só até 2,50.
    expect(cutArea(resolveLevel(project({ baseOffset: 1.5, height: 1 }), 'lv_0', new Map()), 'w')).toBe(0);
    // Parede de base 1,50 e altura 2,00 (até 3,50): o corte padrão em 2,70 atravessa.
    expect(cutArea(resolveLevel(project({ baseOffset: 1.5, height: 2 }), 'lv_0', new Map()), 'w')).toBeGreaterThan(0);
  });

  it('cutZ absoluto: a parede entra na planta só quando o corte a atravessa', () => {
    const p = project({ baseOffset: 1.5, height: 1 });
    // Parede de 1,50 a 2,50 m: corte em 1,20 não atravessa; corte em 2,00 atravessa.
    expect(cutArea(resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2 }), 'w')).toBe(0);
    expect(cutArea(resolveLevel(p, 'lv_0', new Map(), { cutZ: 2.0 }), 'w')).toBeGreaterThan(0);
  });

  it('planOpenings: sem a janela no conjunto, a parede fica inteira (como sem janela); com ela, fura', () => {
    const p = project();
    const pierced = resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2, planOpenings: new Set(['j']) });
    const whole = resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2, planOpenings: new Set() });
    const noWindow = resolveLevel(project({}, false), 'lv_0', new Map());
    expect(silhouetteArea(whole)).toBeCloseTo(silhouetteArea(noWindow), 9);
    expect(silhouetteArea(whole)).toBeGreaterThan(silhouetteArea(pierced));
  });

  it('outlineWalls: a parede fora do corte fica em fragment, sem cut, regiões nem silhueta', () => {
    const p = project({ baseOffset: 1.5, height: 1 }, false);
    const r = resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2, outlineWalls: new Set(['w']) });
    const layers = r.walls['w']!.layers;
    expect(layers.length).toBeGreaterThan(0);
    expect(layers.every((l) => l.fragment.length > 0)).toBe(true);
    expect(layers.every((l) => l.cut.length === 0)).toBe(true);
    expect(r.clusters.every((c) => c.regions.length === 0 && multiArea(c.silhouette) === 0)).toBe(true);
  });

  it('a parede que o corte atravessa não muda quando a mesma cena leva outlineWalls', () => {
    const p = project();
    const a = resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2, planOpenings: new Set(['j']) });
    const b = resolveLevel(p, 'lv_0', new Map(), { cutZ: 1.2, planOpenings: new Set(['j']), outlineWalls: new Set(['w']) });
    expect(silhouetteArea(b)).toBeCloseTo(silhouetteArea(a), 9);
  });

  it('cache: opções diferentes não se misturam, e a resolução padrão volta igual depois delas', () => {
    const p = project();
    const cache = new Map();
    const plain = resolveLevel(p, 'lv_0', cache);
    const whole = resolveLevel(p, 'lv_0', cache, { cutZ: 1.2, planOpenings: new Set() });
    const pierced = resolveLevel(p, 'lv_0', cache, { cutZ: 1.2, planOpenings: new Set(['j']) });
    const above = resolveLevel(p, 'lv_0', cache, { cutZ: 3.0 });
    expect(silhouetteArea(whole)).toBeGreaterThan(silhouetteArea(pierced));
    expect(silhouetteArea(above)).toBe(0);
    expect(resolveLevel(p, 'lv_0', cache)).toEqual(plain);
    expect(silhouetteArea(resolveLevel(p, 'lv_0', cache))).toBeCloseTo(silhouetteArea(pierced), 9);
  });

  it('o cache compartilhado padrão também não mistura as opções', () => {
    const p = project();
    const plainFirst = resolveLevel(p, 'lv_0');
    const whole = resolveLevel(p, 'lv_0', undefined, { cutZ: 1.2, planOpenings: new Set() });
    expect(silhouetteArea(whole)).toBeGreaterThan(silhouetteArea(plainFirst));
    expect(resolveLevel(p, 'lv_0')).toEqual(plainFirst);
  });
});
