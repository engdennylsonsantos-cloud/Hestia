import { describe, expect, it } from 'vitest';
import { roofsOnLevel, type Roof } from '@hestia/model';
import { roofShapePatch } from './roofEdges.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Telhado retangular 6 × 4 criado pela ferramenta e convertido em águas livres (uma água sobre o contorno). */
function freeRoof() {
  const ctx = makeEnv();
  ctx.options.roofMode = 'rect';
  ctx.options.roofShape = 'gable';
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  const t = tool('roof', ctx.env);
  clickAt(t, 0, 0);
  clickAt(t, 6, 4);
  const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
  ctx.store.exec({ type: 'updateElements', ids: [r.id], patch: roofShapePatch(r, 'free', 20) });
  ctx.env.setSelection([r.id]);
  return { ...ctx, msgs, id: r.id, roof: () => ctx.store.project.elements[r.id] as Roof };
}

describe('seta de inclinação (A5)', () => {
  it('dois cliques acrescentam uma água com a subida do primeiro para o segundo e a inclinação da barra', () => {
    const ctx = freeRoof();
    const before = ctx.roof().planes.length;
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 0, 2);
    clickAt(a, 3, 2);
    const planes = ctx.roof().planes;
    expect(planes).toHaveLength(before + 1);
    const added = planes[planes.length - 1]!;
    expect(added.up.x).toBeCloseTo(1, 9);
    expect(added.up.y).toBeCloseTo(0, 9);
    expect(added.percent).toBe(30);
    expect(added.polygon).toEqual(ctx.roof().boundary);
    expect(ctx.msgs.at(-1)).toMatch(/Água adicionada/);
  });

  it('sem telhado de águas livres selecionado, avisa e não adiciona', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    const t = tool('roofarrow', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    expect(msgs.at(-1)).toMatch(/Selecione um telhado/);
  });

  it('telhado que não é de águas livres: a mensagem diz como converter (botão da barra ou Propriedades)', () => {
    const ctx = makeEnv();
    ctx.options.roofMode = 'rect';
    ctx.options.roofShape = 'gable';
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
    ctx.env.setSelection([r.id]);
    tool('roofarrow', ctx.env);
    expect(msgs.at(-1)).toMatch(/só vale em telhado de águas livres/);
    expect(msgs.at(-1)).toMatch(/Converter para águas livres/);
  });

  it('Esc no meio do passo cancela só o passo e diz que outro Esc sai da ferramenta', () => {
    const ctx = freeRoof();
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 0, 2);
    a.cancel();
    expect(ctx.msgs.at(-1)).toMatch(/Esc de novo sai da ferramenta/);
  });

  it('a direção nula não cria água', () => {
    const ctx = freeRoof();
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 1, 1);
    clickAt(a, 1, 1);
    expect(ctx.roof().planes).toHaveLength(1);
    expect(ctx.msgs.at(-1)).toMatch(/Direção nula/);
  });
});
