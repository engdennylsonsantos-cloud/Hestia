import { describe, expect, it } from 'vitest';
import { dist, type SketchSeg, type Vec2 } from '@hestia/geom';
import { newDraft } from './perimeterSession.ts';
import { PerimeterTool } from './perimeterTool.ts';
import { chainIds } from './perimeterToolModifyChain.ts';
import { P, clickAt, makeEnv } from './testEnv.ts';

const seg = (id: string, a: Vec2, b: Vec2): SketchSeg => ({ id, a, b });
const near = (p: Vec2, x: number, y: number): boolean => dist(p, { x, y }) < 1e-6;
const byId = (t: PerimeterTool, id: string): SketchSeg => t.draft().segs.find((s) => s.id === id)!;

const LINE = (): SketchSeg[] => [seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 })];
const LOOP = (): SketchSeg[] => [
  seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }),
  seg('s2', { x: 4, y: 0 }, { x: 4, y: 3 }),
  seg('s3', { x: 4, y: 3 }, { x: 0, y: 3 }),
  seg('s4', { x: 0, y: 3 }, { x: 0, y: 0 }),
];

/** Ferramenta com o rascunho dado e as mensagens da barra capturadas. */
function setup(segs: SketchSeg[] = LOOP()) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  const env = { ...ctx.env, say: (m: string) => { msgs.push(m); } };
  const t = new PerimeterTool(env, 'roof');
  t.start();
  if (segs.length > 0) t.loadDraft({ ...newDraft('roof'), segs });
  return { ...ctx, t, msgs, ultima: () => msgs[msgs.length - 1] ?? '' };
}

describe('cadeia conectada (Tab)', () => {
  it('pega as linhas ligadas pelas pontas, inclusive o laço fechado', () => {
    expect(chainIds(LOOP(), 's2')).toEqual(['s1', 's2', 's3', 's4']);
    const aberta = [seg('a', { x: 0, y: 0 }, { x: 1, y: 0 }), seg('b', { x: 1, y: 0 }, { x: 1, y: 1 }), seg('solta', { x: 5, y: 5 }, { x: 6, y: 6 })];
    expect(chainIds(aberta, 'a')).toEqual(['a', 'b']);
    expect(chainIds(aberta, 'nao-existe')).toEqual([]);
  });

  it('Tab alterna só a linha e todo o laço, com o estado na barra e o realce na prévia', () => {
    const { t, msgs, ultima } = setup();
    t.setModify('offset');
    t.move(P(2, 0));
    expect(t.preview().filter((i) => i.kind === 'line' && i.halo)).toHaveLength(1);
    t.tab();
    expect(ultima()).toMatch(/laço conectado/);
    expect(t.preview().filter((i) => i.kind === 'line' && i.halo)).toHaveLength(4);
    t.tab();
    expect(ultima()).toMatch(/só a linha/);
    msgs.length = 0;
    t.tab();
    clickAt(t, 2, 0);
    expect(t.draft().selected).toEqual(['s1', 's2', 's3', 's4']);
    expect(t.inputPrompt()).toBe('Distância (ou clique do lado)');
  });
});

describe('comandos sem seleção prévia: um clique escolhe o alvo e avança', () => {
  it('Deslocar: linha escolhida, prévia do lado do cursor, distância com vírgula e clique do lado', () => {
    const { t, msgs } = setup(LOOP());
    t.setModify('offset');
    expect(msgs[msgs.length - 1]).toMatch(/clique na linha a deslocar/);
    clickAt(t, 2, 0);
    expect(t.draft().selected).toEqual(['s1']);
    expect(t.inputPrompt()).toBe('Distância (ou clique do lado)');
    t.move(P(2, -1));
    expect(t.preview().some((i) => i.kind === 'line' && i.dashed)).toBe(true);
    expect(t.type('0,25')).toBe(true);
    clickAt(t, 2, -1);
    const copia = t.draft().segs[4]!;
    expect(near(copia.a, 0, -0.25) && near(copia.b, 4, -0.25)).toBe(true);
    expect(t.draft().segs).toHaveLength(5);
  });

  it('Deslocar: Esc volta a escolher o alvo sem sair do comando', () => {
    const { t, ultima } = setup(LOOP());
    t.setModify('offset');
    clickAt(t, 2, 0);
    expect(t.draft().selected).toEqual(['s1']);
    t.cancel();
    expect(t.modifyKind()).toBe('offset');
    expect(t.draft().selected).toEqual([]);
    expect(ultima()).toMatch(/clique na linha a deslocar/);
    clickAt(t, 2, 0);
    expect(t.draft().selected).toEqual(['s1']);
  });

  it('Deslocar: o clique do lado define a distância quando não há valor digitado', () => {
    const { t } = setup(LINE());
    t.setModify('offset');
    clickAt(t, 2, 0);
    clickAt(t, 2, 2);
    const copia = t.draft().segs[1]!;
    expect(near(copia.a, 0, 2) && near(copia.b, 4, 2)).toBe(true);
  });

  it('Mover: escolhe a linha, depois base e destino', () => {
    const { t } = setup(LINE());
    t.setModify('move');
    clickAt(t, 2, 0);
    expect(t.draft().selected).toEqual(['s1']);
    clickAt(t, 0, 0);
    clickAt(t, 2, 1);
    expect(near(byId(t, 's1').a, 2, 1) && near(byId(t, 's1').b, 6, 1)).toBe(true);
  });

  it('Copiar: escolhe a linha, depois base e destino', () => {
    const { t } = setup(LINE());
    t.setModify('copy');
    clickAt(t, 2, 0);
    clickAt(t, 0, 0);
    clickAt(t, 1, 1);
    expect(t.draft().segs).toHaveLength(2);
    const copia = t.draft().segs[1]!;
    expect(near(copia.a, 1, 1) && near(copia.b, 5, 1)).toBe(true);
  });

  it('Rotacionar: escolhe a linha, centro e ângulo digitado', () => {
    const { t } = setup([seg('s1', { x: 1, y: 0 }, { x: 2, y: 0 })]);
    t.setModify('rotate');
    clickAt(t, 1.5, 0);
    clickAt(t, 0, 0);
    expect(t.inputPrompt()).toBe('Ângulo (graus)');
    expect(t.type('90')).toBe(true);
    expect(near(byId(t, 's1').a, 0, 1) && near(byId(t, 's1').b, 0, 2)).toBe(true);
  });

  it('Espelhar: escolhe a linha e os dois pontos do eixo', () => {
    const { t } = setup(LINE());
    t.setModify('mirror');
    clickAt(t, 2, 0);
    clickAt(t, 2, -1);
    clickAt(t, 2, 1);
    expect(near(byId(t, 's1').a, 4, 0) && near(byId(t, 's1').b, 0, 0)).toBe(true);
  });

  it('Matriz: escolhe a linha, passo e quantidade', () => {
    const { t } = setup(LINE());
    t.setModify('array');
    clickAt(t, 2, 0);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    expect(t.inputPrompt()).toBe('Quantidade');
    expect(t.type('3')).toBe(true);
    expect(t.draft().segs).toHaveLength(3);
    expect(near(t.draft().segs[2]!.a, 4, 0)).toBe(true);
  });

  it('Excluir, Dividir, Aparar/Estender e Alinhar escolhem a linha com um clique', () => {
    const del = setup(LOOP());
    del.t.setModify('delete');
    clickAt(del.t, 2, 0);
    expect(del.t.draft().segs).toHaveLength(3);

    const split = setup(LINE());
    split.t.setModify('split');
    clickAt(split.t, 2, 0);
    expect(split.t.draft().segs).toHaveLength(2);

    const trim = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('s2', { x: 4, y: 0 }, { x: 4, y: 3 })]);
    trim.t.setModify('trim');
    clickAt(trim.t, 2, 0);
    clickAt(trim.t, 4, 2);
    expect(trim.t.draft().segs).toHaveLength(2);

    const align = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('s2', { x: 0, y: 1 }, { x: 4, y: 2 })]);
    align.t.setModify('align');
    clickAt(align.t, 2, 0);
    clickAt(align.t, 2, 1.5);
    expect(near(byId(align.t, 's2').a, 0, 0) && near(byId(align.t, 's2').b, 4, 0)).toBe(true);
  });
});

describe('janela de seleção na etapa de escolher o alvo', () => {
  const janela = (t: PerimeterTool): void => {
    t.down(P(-1, -1));
    t.drag(P(5, 4));
    t.up(P(5, 4));
  };

  it('Mover: a janela escolhe as linhas e o comando avança para a base', () => {
    const { t } = setup(LOOP());
    t.setModify('move');
    janela(t);
    expect(t.draft().selected).toEqual(['s1', 's2', 's3', 's4']);
    clickAt(t, 0, 0);
    clickAt(t, 1, 1);
    expect(t.draft().segs).toHaveLength(4);
    expect(near(byId(t, 's1').a, 1, 1) && near(byId(t, 's1').b, 5, 1)).toBe(true);
  });

  it('Excluir: a janela apaga as linhas escolhidas e o comando continua ligado', () => {
    const { t } = setup(LOOP());
    t.setModify('delete');
    janela(t);
    expect(t.draft().segs).toHaveLength(0);
    expect(t.modifyKind()).toBe('delete');
  });
});
