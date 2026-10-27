import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { roofsOnLevel, type ProjectStore, type Roof } from '@hestia/model';
import { commitPerimeter } from './perimeterCommit.ts';
import type { CommitPerimeterOptions } from './perimeterCommitTypes.ts';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { roofShapePatch } from './roofEdges.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Lados de um retângulo 6 × 4 (x 0..6, y 0..4), na ordem do contorno. */
const CANTOS: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const RETANGULO: NewSeg[] = CANTOS.map((a, i) => ({ a, b: CANTOS[(i + 1) % CANTOS.length]! }));

/**
 * Cria o telhado 6 × 4 de duas águas pelo commit do perímetro (o caminho da faixa): as arestas curtas (1 e 3) ficam sem
 * inclinação, como a forma "duas águas" do antigo modo.
 */
function criarDuasAguas(store: ProjectStore, opts: CommitPerimeterOptions = {}): void {
  let d = addSegs(newDraft('roof'), RETANGULO);
  for (const i of [1, 3]) d = setSegSlope(d, d.segs[i]!.id, { definesSlope: false });
  const r = commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0', ...opts });
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  for (const c of r.commands) store.exec(c);
}

/** Telhado retangular 6 × 4 criado pelo perímetro e convertido em águas livres (uma água sobre o contorno). */
function freeRoof() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  criarDuasAguas(ctx.store);
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
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    criarDuasAguas(ctx.store);
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
