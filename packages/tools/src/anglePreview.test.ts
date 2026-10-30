import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore } from '@hestia/model';
import { makeEnv, P, tool } from './testEnv.ts';
import type { PerimeterTool } from './perimeterTool.ts';

const angleLabels = (items: Array<{ kind: string; text?: string }>): string[] =>
  items.filter((i): i is { kind: 'label'; text: string } => i.kind === 'label' && !!i.text).map((i) => i.text).filter((t) => t.includes('°'));

const wallAtOrigin = (): ReturnType<typeof makeEnv> => {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }) });
  return makeEnv(store);
};

describe('ângulo dinâmico universal', () => {
  it('aparece em linha de detalhe conectada ao fim da parede', () => {
    const ctx = wallAtOrigin();
    const t = tool('detailLine', ctx.env);
    t.move(P(2, 0));
    t.click(P(2, 0));
    t.move(P(2, 1));
    expect(angleLabels(t.preview() as never[]).some((x) => x.includes('90'))).toBe(true);
  });

  it('aparece em separador de ambiente conectado ao fim da parede', () => {
    const ctx = wallAtOrigin();
    const t = tool('roomsep', ctx.env);
    t.move(P(2, 0));
    t.click(P(2, 0));
    t.move(P(2, 1));
    expect(angleLabels(t.preview() as never[]).some((x) => x.includes('90'))).toBe(true);
  });

  it('aparece na grade conectada ao fim da parede', () => {
    const ctx = wallAtOrigin();
    const t = tool('grid', ctx.env);
    t.move(P(2, 0));
    t.click(P(2, 0));
    t.move(P(2, 1));
    expect(angleLabels(t.preview() as never[]).some((x) => x.includes('90'))).toBe(true);
  });

  it('aparece no perímetro de piso/laje/telhado/forro conectado à parede', () => {
    const ctx = wallAtOrigin();
    const t = tool('perimeter', ctx.env) as PerimeterTool;
    t.setShape('line');
    t.move(P(2, 0));
    t.click(P(2, 0));
    t.move(P(2, 1));
    expect(angleLabels(t.preview() as never[]).some((x) => x.includes('90'))).toBe(true);
  });

  it('o texto angular evita a ponta do trecho em criação', () => {
    const ctx = wallAtOrigin();
    const t = tool('detailLine', ctx.env);
    t.move(P(2, 0));
    t.click(P(2, 0));
    t.move(P(1, 0.15));
    const labels = t.preview().filter((i) => i.kind === 'label') as Array<{ at: { x: number; y: number }; text: string }>;
    const angle = labels.find((l) => l.text.includes('°'))!;
    expect(angle).toBeDefined();
    expect(Math.hypot(angle.at.x - 1, angle.at.y - 0.15)).toBeGreaterThan(0.02);
  });
});
