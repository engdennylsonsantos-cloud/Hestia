import { describe, expect, it } from 'vitest';
import { totalThickness } from '@hestia/model';
import { DEFAULT_SNAP } from './types.ts';
import { P, clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Base (0,0)-(4,0) do tipo padrão (wt_alv14, 0,184 m de espessura) e o ambiente com a ferramenta Parede paralela. */
function base() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  const t = totalThickness(ctx.store.project.wallTypes['wt_alv14']!);
  return { ...ctx, t };
}

const ys = (store: ReturnType<typeof makeEnv>['store']) => walls(store).map((w) => [w.a.y, w.b.y]);

describe('ferramenta Parede paralela (distância entre faces, padrão)', () => {
  it('clique na face superior e distância 3 digitada: nova parede com face a face de 3 m', () => {
    const { store, env, t } = base();
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    expect(pt.inputPrompt()).toBe('Distância');
    expect(pt.type('3')).toBe(true);
    const ws = walls(store);
    expect(ws).toHaveLength(2);
    const nova = ws[1]!;
    // Eixo novo = espessura da base + 3 m: a face inferior da nova fica a 3 m da face superior da base.
    expect(nova.a.y).toBeCloseTo(t + 3, 6);
    expect(nova.b.y).toBeCloseTo(t + 3, 6);
    expect(nova.a.x).toBeCloseTo(0, 6);
    expect(nova.b.x).toBeCloseTo(4, 6);
    expect(nova.typeId).toBe('wt_alv14');
    expect(pt.inputPrompt()).toBeNull();
  });

  it('a base não muda e a ferramenta volta ao primeiro passo (pode escolher outra base)', () => {
    const { store, env } = base();
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    pt.type('3');
    expect(ys(store)[0]).toEqual([0, 0]);
    // Sem base escolhida, digitar não cria nada.
    expect(pt.type('2')).toBe(false);
  });

  it('Tab inverte o lado: a distância digitada cai do outro lado da base', () => {
    const { store, env, t } = base();
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    pt.tab();
    pt.type('3');
    const nova = walls(store)[1]!;
    expect(nova.a.y).toBeCloseTo(-(t + 3), 6);
  });

  it('clique do lado a 3 m da face: mede a distância pelo cursor (com captura desligada)', () => {
    const { store, env, t, options } = base();
    options.snap = { ...DEFAULT_SNAP, grid: false, faces: false, axis: false, intersections: false, perpendicular: false, alignment: false };
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    clickAt(pt, 2, 3.092);
    const nova = walls(store)[1]!;
    expect(nova.a.y).toBeCloseTo(t + 3, 6);
  });

  it('clique sobre a própria base não cria parede', () => {
    const { store, env } = base();
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    clickAt(pt, 2, 0.02);
    expect(walls(store)).toHaveLength(1);
  });

  it('clique longe de qualquer parede não escolhe base', () => {
    const { env, store } = base();
    const pt = tool('parallel', env);
    clickAt(pt, 10, 10);
    expect(pt.inputPrompt()).toBeNull();
    expect(walls(store)).toHaveLength(1);
  });
});

describe('ferramenta Parede paralela (distância entre eixos)', () => {
  it('com a referência em eixos, a distância 3 é entre eixos: nova parede em y = 3', () => {
    const { store, env, options } = base();
    options.offsetFrom = 'axis';
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    pt.type('3');
    expect(walls(store)[1]!.a.y).toBeCloseTo(3, 6);
  });
});

describe('ferramenta Parede paralela: Tab depois da base continua medindo pelo cursor', () => {
  it('Tab inverte o lado da nova parede sem contradizer a medida: a prévia mede pelo cursor e fica do lado oposto', () => {
    const { store, env, t, options } = base();
    options.snap = { ...DEFAULT_SNAP, grid: false, faces: false, axis: false, intersections: false, perpendicular: false, alignment: false };
    const said: string[] = [];
    env.say = (m) => said.push(m);
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    pt.tab();
    pt.move(P(2, 1.6));
    const ultima = said[said.length - 1]!;
    expect(ultima).toContain('1,508 m');
    expect(ultima).not.toContain('Afaste');
    clickAt(pt, 2, 1.6);
    const nova = walls(store)[1]!;
    expect(nova.a.y).toBeCloseTo(-(t + 1.508), 3);
  });
});
