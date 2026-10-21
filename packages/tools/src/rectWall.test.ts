import { describe, expect, it } from 'vitest';
import type { Wall } from '@hestia/model';
import { clickAt, makeEnv, tool, walls } from './testEnv.ts';

const rectOpts = () => {
  const ctx = makeEnv();
  ctx.options.wallShape = 'rect';
  return ctx;
};

/** Área com sinal do contorno formado pelos eixos das paredes, na ordem em que foram criadas. */
function signedArea(ws: Wall[]): number {
  let s = 0;
  for (const w of ws) s += w.a.x * w.b.y - w.b.x * w.a.y;
  return s / 2;
}

describe('parede por retângulo (A5)', () => {
  it('retângulo 4×3 cria 4 paredes encadeadas que fecham o contorno', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    const ws = walls(store);
    expect(ws).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(ws[i]!.b.x).toBeCloseTo(ws[(i + 1) % 4]!.a.x);
      expect(ws[i]!.b.y).toBeCloseTo(ws[(i + 1) % 4]!.a.y);
    }
    const lengths = ws.map((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)).sort((x, y) => x - y);
    expect(lengths[0]).toBeCloseTo(3);
    expect(lengths[3]).toBeCloseTo(4);
  });

  it('sentido anti-horário, com o lado externo para fora (flipped)', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    const ws = walls(store);
    expect(signedArea(ws)).toBeCloseTo(12);
    expect(ws.every((w) => w.flipped)).toBe(true);
    expect(ws[0]!.a).toEqual({ x: 0, y: 0 });
    expect(ws[0]!.b).toEqual({ x: 4, y: 0 });
  });

  it('o canto oposto pode vir em qualquer quadrante e continua anti-horário', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 4, 3);
    clickAt(t, 0, 0);
    const ws = walls(store);
    expect(ws).toHaveLength(4);
    expect(signedArea(ws)).toBeCloseTo(12);
  });

  it('diagonal de sinal misto (canto acima e à direita de um lado, abaixo do outro) também fecha', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, -3);
    const ws = walls(store);
    expect(ws).toHaveLength(4);
    expect(signedArea(ws)).toBeCloseTo(12);
    for (let i = 0; i < 4; i++) expect(ws[i]!.b.x).toBeCloseTo(ws[(i + 1) % 4]!.a.x);
  });

  it('um único passo de desfazer remove as quatro', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    store.undo();
    expect(walls(store)).toHaveLength(0);
  });

  it('retângulo estreito demais não cria nada', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(walls(store)).toHaveLength(0);
  });

  it('Tab inverte o lado externo (volta para dentro)', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    t.tab();
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    expect(walls(store).every((w) => !w.flipped)).toBe(true);
  });

  it('digitar comprimento não cria parede nesta forma', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    expect(t.inputPrompt()).toBeNull();
    expect(t.type('3')).toBe(false);
    expect(walls(store)).toHaveLength(0);
  });

  it('a forma reta continua criando uma parede por vez', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(walls(store)).toHaveLength(1);
    expect(walls(store)[0]!.flipped).toBe(false);
  });
});

describe('quinas ao desenhar ficam em encosto, sem troca automática (decisão 0009 #13)', () => {
  /** Tipo sem acabamento, para o caso em que a regra não deve valer. */
  function bareRect() {
    const ctx = rectOpts();
    const base = ctx.store.project.wallTypes['wt_alv14']!;
    ctx.store.exec({ type: 'upsertWallType', wallType: { ...base, id: 'wt_bare', layers: base.layers.filter((l) => l.function === 'structure') } });
    ctx.options.wallTypeId = 'wt_bare';
    return ctx;
  }
  const kinds = (ws: Wall[]) => ws.map((w) => [w.joinStart.kind, w.joinEnd.kind]);

  // Antes o desenho trocava as quinas com acabamento por esquadria (decisão 0009 #8). Agora o encosto pareia por face
  // (docs/08 §5.7), então a quina nasce como foi escolhida: encosto, sem reescrever a junção.
  it('retângulo com acabamento: os quatro cantos ficam em encosto', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    const ws = walls(store);
    expect(ws).toHaveLength(4);
    for (const w of ws) expect([w.joinStart.kind, w.joinEnd.kind]).toEqual(['butt', 'butt']);
  });

  it('retângulo com acabamento: um só passo de desfazer remove paredes e junções', () => {
    const { store, env } = rectOpts();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    store.undo();
    expect(walls(store)).toHaveLength(0);
  });

  it('retângulo sem acabamento continua em encosto', () => {
    const { store, env } = bareRect();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    expect(kinds(walls(store)).every((k) => k[0] === 'butt' && k[1] === 'butt')).toBe(true);
  });
});
