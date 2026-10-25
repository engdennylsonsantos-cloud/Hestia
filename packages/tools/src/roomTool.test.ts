import { describe, expect, it, vi } from 'vitest';
import { roomsOnLevel } from '@hestia/model';
import { polygonArea } from '@hestia/geom';
import { makeEnv, drawWall, clickAt, tool, P } from './testEnv.ts';
import { ROOM_PROBLEM_TEXT } from './roomTool.ts';

/** Ambiente de teste com as quatro paredes de um retângulo 4 × 3 (eixo), sem fechar o último lado quando `open`. */
function box(open = false) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [4, 0], [4, 3]);
  drawWall(ctx.env, [4, 3], [0, 3]);
  if (!open) drawWall(ctx.env, [0, 3], [0, 0]);
  return { ...ctx, msgs };
}

describe('ferramenta Ambiente (A4, F2)', () => {
  it('passar o cursor pré-visualiza o circuito com nome e área; o clique cria o ambiente e o desfazer o remove', () => {
    const ctx = box();
    const t = tool('room', ctx.env);
    t.move(P(2, 1.5));
    const label = t.preview().find((i) => i.kind === 'label');
    expect(label).toBeDefined();
    expect(label && 'text' in label ? label.text : '').toMatch(/^Ambiente 1 · \d+,\d\d m²$/);
    expect(t.preview().some((i) => i.kind === 'polygon')).toBe(true);
    clickAt(t, 2, 1.5);
    const rooms = roomsOnLevel(ctx.store.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.name).toBe('Ambiente 1');
    expect(rooms[0]!.point).toEqual({ x: 2, y: 1.5 });
    expect(ctx.sel()).toEqual([rooms[0]!.id]);
    expect(ctx.msgs.at(-1)).toMatch(/Ambiente 1 criado: \d+,\d\d m²/);
    ctx.store.undo();
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('segundo clique no mesmo circuito cria outro ambiente e avisa que o circuito já tinha um', () => {
    const ctx = box();
    const t = tool('room', ctx.env);
    clickAt(t, 1, 1);
    clickAt(t, 3, 2);
    const rooms = roomsOnLevel(ctx.store.project, 'lv_0');
    expect(rooms.map((r) => r.number)).toEqual(['1', '2']);
    expect(ctx.msgs.at(-1)).toContain('duplicado');
  });

  it('duplo clique (dois cliques no mesmo ponto, em sequência) cria um só ambiente; Ctrl+Z desfaz tudo', () => {
    const ctx = box();
    let agora = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => agora);
    const t = tool('room', ctx.env);
    clickAt(t, 2, 1.5);
    agora += 120;
    clickAt(t, 2, 1.5);
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(1);
    ctx.store.undo();
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('dois cliques no mesmo ponto, espaçados no tempo, criam dois ambientes (o aviso de duplicado segue)', () => {
    const ctx = box();
    let agora = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => agora);
    const t = tool('room', ctx.env);
    clickAt(t, 2, 1.5);
    agora += 2000;
    clickAt(t, 2, 1.5);
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(2);
    expect(ctx.msgs.at(-1)).toContain('duplicado');
    vi.restoreAllMocks();
  });

  it('fora de circuito mostra o motivo e não cria nada', () => {
    const ctx = box();
    const t = tool('room', ctx.env);
    clickAt(t, 10, 10);
    expect(ctx.msgs.at(-1)).toBe(ROOM_PROBLEM_TEXT.fora);
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('circuito aberto (sem uma parede) mostra o motivo "aberto"', () => {
    const ctx = box(true);
    const t = tool('room', ctx.env);
    t.move(P(2, 1.5));
    expect(ctx.msgs.at(-1)).toBe(ROOM_PROBLEM_TEXT.aberto);
    clickAt(t, 2, 1.5);
    expect(roomsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('a área da pré-visualização é a do circuito interno (4 × 3 menos a espessura das paredes)', () => {
    const ctx = box();
    const t = tool('room', ctx.env);
    t.move(P(2, 1.5));
    const poly = t.preview().find((i) => i.kind === 'polygon');
    expect(poly && 'ring' in poly ? polygonArea([poly.ring]) : 0).toBeGreaterThan(8);
    expect(poly && 'ring' in poly ? polygonArea([poly.ring]) : 0).toBeLessThan(12);
  });
});
