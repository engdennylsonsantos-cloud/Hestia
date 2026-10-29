import { beforeEach, describe, expect, it, vi } from 'vitest';
import { multiArea, polygonArea } from '@hestia/geom';
import { createEmptyProject, ProjectStore, roofsOnLevel, type Project, type Roof } from '@hestia/model';
import { clickAt, makeEnv, tool } from './testEnv.ts';

// O motor é trocado por uma versão que pode zerar as águas, para cobrir o caminho "não cria e diz o motivo".
const sem = vi.hoisted(() => ({ aguas: false }));
vi.mock('@hestia/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@hestia/engine')>();
  return {
    ...real,
    resolveRoofs: (...args: Parameters<typeof real.resolveRoofs>) => real.resolveRoofs(...args).map((r) => (sem.aguas ? { ...r, planes: [] } : r)),
  };
});

const roofs = (p: Project): Roof[] => roofsOnLevel(p, 'lv_0');

/** Ambiente com as mensagens da barra de status. */
function ctxWithMessages(store?: ProjectStore) {
  const ctx = makeEnv(store);
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs };
}

beforeEach(() => {
  sem.aguas = false;
});

describe('ferramenta Telhado por extrusão (A9): dois cliques', () => {
  it('retângulo 10 x 8: o lado maior é o eixo, o arco padrão cobre os 8 m da transversal e a mensagem diz trechos e flecha', () => {
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 10, 8);
    const rs = roofs(ctx.store.project);
    expect(rs).toHaveLength(1);
    const r = rs[0]!;
    expect(r.shape).toBe('extrusion');
    expect(r.dir).toEqual({ x: 1, y: 0 });
    expect(polygonArea([r.boundary])).toBeCloseTo(80, 9);
    expect(r.profile).toHaveLength(13);
    expect(r.profile[0]!.t).toBeCloseTo(0, 12);
    expect(r.profile[12]!.t).toBeCloseTo(8, 12);
    expect(ctx.sel()).toEqual([r.id]);
    expect(ctx.msgs.at(-1)).toBe('Telhado em arco: 12 trechos, flecha 1,00 m. Ctrl+Z desfaz.');
  });

  it('Tab troca o eixo: a extrusão passa a correr no lado menor, com o arco sobre os 10 m', () => {
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    t.tab();
    clickAt(t, 0, 0);
    clickAt(t, 10, 8);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.dir.x).toBeCloseTo(0, 12);
    expect(r.dir.y).toBeCloseTo(1, 12);
    expect(r.profile[12]!.t - r.profile[0]!.t).toBeCloseTo(10, 9);
  });

  it('o motor gera 12 águas que cobrem os 80 m² do retângulo', async () => {
    const { resolveRoofs } = await import('@hestia/engine');
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 10, 8);
    const rr = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(rr.planes).toHaveLength(12);
    expect(rr.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0)).toBeCloseTo(80, 6);
  });

  it('primeiro clique: a barra diz que falta o canto oposto (dois cliques criam o telhado; não há 3º ponto nem Enter)', () => {
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    expect(ctx.msgs.at(-1)).toBe('Canto inicial marcado: clique no canto oposto. Esc cancela.');
    clickAt(t, 10, 8);
    expect(roofs(ctx.store.project)).toHaveLength(1);
  });

  it('retângulo muito estreito: não cria e pede outro canto', () => {
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 10, 0.005);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/muito estreito/);
  });

  it('projeto sem tipo de telhado: não cria e diz o motivo', () => {
    const empty = createEmptyProject();
    empty.roofTypes = {};
    const ctx = ctxWithMessages(new ProjectStore(empty));
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 10, 8);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toBe('O projeto não tem tipo de telhado.');
  });

  it('se o motor não gera águas, não cria nada e a barra diz o motivo', () => {
    sem.aguas = true;
    const ctx = ctxWithMessages();
    const t = tool('roofextrusion', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 10, 8);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/^Telhado não criado: /);
  });
});
