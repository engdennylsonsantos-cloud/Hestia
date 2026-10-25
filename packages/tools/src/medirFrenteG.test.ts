import { describe, expect, it } from 'vitest';
import { clickAt, drawWall, makeEnv, P, tool, walls } from './testEnv.ts';

/** Ambiente com a parede (0,0)-(4,0) e uma lista das mensagens da barra de status. */
function cena() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  const msgs: string[] = [];
  ctx.env.say = (m) => msgs.push(m);
  return { ...ctx, msgs };
}

describe('Medir: cota fica no desenho até Esc ou novo clique', () => {
  it('depois do segundo clique, a linha e o valor continuam na pré-visualização e nada entra no modelo', () => {
    const { store, env, msgs } = cena();
    const elementos = Object.keys(store.project.elements).length;
    const m = tool('measure', env);
    clickAt(m, 0, 2);
    clickAt(m, 3, 2);
    const cota = m.preview();
    expect(cota.some((i) => i.kind === 'line')).toBe(true);
    expect(cota).toContainEqual(expect.objectContaining({ kind: 'label', text: '3,000 m' }));
    // A mensagem de status continua trazendo a distância e os deltas.
    expect(msgs.at(-1)).toMatch(/Distância 3,000 m · ΔX 3,000 · ΔY 0,000/);
    // O mouse parado (sem novo clique) não apaga a cota.
    m.move(P(1, 1));
    expect(m.preview().some((i) => i.kind === 'label' && i.text === '3,000 m')).toBe(true);
    expect(Object.keys(store.project.elements).length).toBe(elementos);
  });

  it('Esc remove a cota (sem sair da ferramenta); o segundo Esc sai', () => {
    const { env, done } = cena();
    const m = tool('measure', env);
    clickAt(m, 0, 2);
    clickAt(m, 3, 2);
    m.cancel();
    expect(m.preview().some((i) => i.kind === 'line')).toBe(false);
    expect(done()).toBe(0);
    m.cancel();
    expect(done()).toBe(1);
  });

  it('um novo clique substitui a cota anterior: o valor antigo some ao começar outra medida', () => {
    const { env } = cena();
    const m = tool('measure', env);
    clickAt(m, 0, 2);
    clickAt(m, 3, 2);
    clickAt(m, 0, 4);
    expect(m.preview().some((i) => i.kind === 'label' && i.text === '3,000 m')).toBe(false);
    clickAt(m, 0, 6);
    expect(m.preview()).toContainEqual(expect.objectContaining({ kind: 'label', text: '2,000 m' }));
  });
});

describe('Parede paralela: modo mostrado antes do clique', () => {
  it('ao ativar, a mensagem diz o modo padrão (face a face); com eixos, diz entre eixos', () => {
    const { env, msgs, options } = cena();
    tool('parallel', env);
    expect(msgs.at(-1)).toContain('face a face');
    options.offsetFrom = 'axis';
    tool('parallel', env);
    expect(msgs.at(-1)).toContain('entre eixos');
  });

  it('depois de escolher a base, a mensagem do cursor já informa o modo e a distância', () => {
    const { env, msgs } = cena();
    const pt = tool('parallel', env);
    clickAt(pt, 2, 0.092);
    pt.move(P(2, 3.092));
    expect(msgs.at(-1)).toContain('face a face');
    expect(msgs.at(-1)).toMatch(/a \d,\d{3} m \(face a face\)/);
  });
});

describe('Unir (junção): aviso claro quando o clique é ignorado', () => {
  it('clique no meio do vão diz que não há junção ali', () => {
    const { env, msgs } = cena();
    const j = tool('joins', env);
    clickAt(j, 2, 0);
    expect(msgs.at(-1)).toMatch(/^Clique no canto\/ponta onde duas paredes se encontram\./);
    expect(msgs.at(-1)).toContain('No meio do vão não há junção');
  });

  it('clique numa ponta livre diz que a ponta não tem outra parede para unir', () => {
    const { env, msgs } = cena();
    const j = tool('joins', env);
    clickAt(j, 0, 0);
    expect(msgs.at(-1)).toContain('Esta ponta não tem outra parede para unir');
  });

  it('clique longe de qualquer parede: mensagem genérica com a instrução', () => {
    const { env, msgs } = cena();
    const j = tool('joins', env);
    clickAt(j, 10, 10);
    expect(msgs.at(-1)).toBe('Clique no canto/ponta onde duas paredes se encontram.');
  });
});

describe('Dividir: texto exato da posição', () => {
  it('a distância digitada diz "do início do trecho" e o resultado também', () => {
    const { store, env, msgs } = cena();
    const sp = tool('split', env);
    sp.move(P(2, 0));
    expect(sp.inputPrompt()).toBe('Distância do início da parede');
    expect(sp.type('1,5')).toBe(true);
    expect(msgs.at(-1)).toBe('Parede dividida a 1,50 m do início do trecho.');
    expect(walls(store).length).toBe(2);
  });

  it('valor inválido avisa que a medida é do início do trecho sob o cursor', () => {
    const { env, msgs } = cena();
    const sp = tool('split', env);
    sp.move(P(2, 0));
    expect(sp.type('abc')).toBe(false);
    expect(msgs.at(-1)).toContain('desde o início do trecho sob o cursor');
  });
});
