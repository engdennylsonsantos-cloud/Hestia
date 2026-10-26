import { describe, expect, it } from 'vitest';
import { dist, type SketchSeg, type Vec2 } from '@hestia/geom';
import { newDraft } from './perimeterSession.ts';
import { PerimeterTool } from './perimeterTool.ts';
import { P, clickAt, makeEnv } from './testEnv.ts';

const seg = (id: string, a: Vec2, b: Vec2): SketchSeg => ({ id, a, b });
const near = (p: Vec2, x: number, y: number): boolean => dist(p, { x, y }) < 1e-6;
const byId = (t: PerimeterTool, id: string): SketchSeg => t.draft().segs.find((s) => s.id === id)!;

/** Ferramenta com o rascunho dado (linhas soltas, como o desenho deixa). */
function setup(segs: SketchSeg[] = []) {
  const ctx = makeEnv();
  const t = new PerimeterTool(ctx.env, 'roof');
  t.start();
  if (segs.length > 0) t.loadDraft({ ...newDraft('roof'), segs });
  return { ...ctx, t };
}

/** Retângulo de 4×3 com as quatro linhas passando dos cantos (1 m para cada lado). */
const OVERSHOOT = (): SketchSeg[] => [
  seg('s1', { x: -1, y: 0 }, { x: 5, y: 0 }),
  seg('s2', { x: 4, y: -1 }, { x: 4, y: 4 }),
  seg('s3', { x: 5, y: 3 }, { x: -1, y: 3 }),
  seg('s4', { x: 0, y: 4 }, { x: 0, y: -1 }),
];

/** Seleciona linhas no modo de seleção (sem comando de Modificar), com Shift para somar. */
function select(t: PerimeterTool, pts: Array<[number, number]>): void {
  t.setModify(null);
  pts.forEach(([x, y], i) => clickAt(t, x, y, { shift: i > 0 }));
}

describe('Modificar: ligar e desligar', () => {
  it('recusa sem linhas e liga com linhas, devolvendo true', () => {
    const empty = setup();
    expect(empty.t.setModify('trim')).toBe(false);
    expect(empty.t.modifyKind()).toBeNull();
    const { t } = setup(OVERSHOOT());
    expect(t.setModify('trim')).toBe(true);
    expect(t.modifyKind()).toBe('trim');
  });

  it('Esc cancela o passo e, sem passo, desliga o comando (segundo Esc)', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0);
    t.cancel();
    expect(t.modifyKind()).toBe('trim');
    t.cancel();
    expect(t.modifyKind()).toBeNull();
    expect(t.activeShape()).toBeNull();
  });

  it('escolher uma forma desliga o comando de Modificar', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    t.setShape('line');
    expect(t.modifyKind()).toBeNull();
  });
});

describe('Modificar: aparar e estender', () => {
  it('retângulo com 4 linhas que passam dos cantos fecha com 4 aplicações de canto', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0); clickAt(t, 4, 2); // s1 × s2 no canto (4,0)
    clickAt(t, 2, 0); clickAt(t, 0, 2); // s1 × s4 no canto (0,0)
    clickAt(t, 2, 3); clickAt(t, 4, 2); // s3 × s2 no canto (4,3)
    clickAt(t, 2, 3); clickAt(t, 0, 2); // s3 × s4 no canto (0,3)
    expect(t.draft().segs).toHaveLength(4);
    expect(t.closeInfo().ok).toBe(true);
    expect(t.finish().ok).toBe(true);
  });

  it('a linha fica do lado clicado do canto', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0); clickAt(t, 4, 2);
    expect(near(byId(t, 's1').a, -1, 0)).toBe(true);
    expect(near(byId(t, 's1').b, 4, 0)).toBe(true);
  });

  it('Tab vai para aparar até limite: o limite é a 1ª linha clicada, e a 2ª é aparada', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    t.tab();
    clickAt(t, 4, 1.5); // limite: s2 (x = 4)
    clickAt(t, 2, 0); // aparada: s1, fica o trecho do clique
    expect(near(byId(t, 's1').b, 4, 0)).toBe(true);
    expect(near(byId(t, 's1').a, -1, 0)).toBe(true);
  });

  it('Tab três vezes volta ao canto; estender até limite prolonga a ponta mais próxima', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 3, y: 0 }), seg('s2', { x: 5, y: -2 }, { x: 5, y: 2 })]);
    t.setModify('trim');
    t.tab();
    t.tab();
    clickAt(t, 5, 1); // limite: s2 (x = 5)
    clickAt(t, 2.5, 0); // a ponta mais próxima do clique (b, x = 3) vai ao limite
    expect(near(byId(t, 's1').b, 5, 0)).toBe(true);
  });

  it('operação impossível avisa e não muda o rascunho', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0);
    clickAt(t, 2, 0); // mesma linha
    expect(t.draft().segs).toHaveLength(4);
    expect(t.draftHistory.canUndo).toBe(false);
  });
});

describe('Modificar: dividir e excluir', () => {
  it('dividir no ponto, depois com espaço (Tab), depois excluir um trecho', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 })]);
    t.setModify('split');
    clickAt(t, 2, 0);
    expect(t.draft().segs).toHaveLength(2);
    t.tab();
    clickAt(t, 0.5, 0);
    clickAt(t, 1.5, 0);
    expect(t.draft().segs).toHaveLength(3);
    expect(t.draft().segs.some((s) => near(s.a, 1.5, 0) || near(s.b, 1.5, 0))).toBe(true);
    t.setModify('delete');
    clickAt(t, 3, 0);
    const left = t.draft().segs;
    expect(left).toHaveLength(2);
    expect(left.every((s) => s.b.x <= 2 + 1e-9)).toBe(true);
  });

  it('excluir com seleção apaga a seleção num passo de desfazer, e segue para os cliques', () => {
    const { t } = setup(OVERSHOOT());
    select(t, [[2, 0], [4, 1.5]]);
    t.setModify('delete');
    expect(t.draft().segs).toHaveLength(2);
    expect(t.modifyKind()).toBe('delete');
    expect(t.undoDraft()).toBe(true);
    expect(t.draft().segs).toHaveLength(4);
  });

  it('excluir remove a linha clicada e Delete remove a seleção', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('delete');
    clickAt(t, 2, 3);
    expect(t.draft().segs).toHaveLength(3);
    select(t, [[2, 0]]);
    expect(t.deleteKey()).toBe(true);
    expect(t.draft().segs).toHaveLength(2);
  });
});

describe('Modificar: deslocar, espelhar, girar, mover, copiar, matriz, alinhar', () => {
  it('deslocar um laço: linhas escolhidas por clique (Shift soma), distância digitada, lado pelo clique', () => {
    const loop = [seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('s2', { x: 4, y: 0 }, { x: 4, y: 3 }), seg('s3', { x: 4, y: 3 }, { x: 0, y: 3 }), seg('s4', { x: 0, y: 3 }, { x: 0, y: 0 })];
    const { t } = setup(loop);
    t.setModify('offset');
    clickAt(t, 2, 0);
    clickAt(t, 4, 1.5, { shift: true });
    clickAt(t, 2, 3, { shift: true });
    clickAt(t, 0, 1.5, { shift: true });
    t.confirm();
    expect(t.inputPrompt()).toBe('Distância (ou clique do lado)');
    expect(t.type('0.5')).toBe(true);
    clickAt(t, 2, -2);
    const copies = t.draft().segs.slice(4);
    expect(copies).toHaveLength(4);
    const corners = [{ x: -0.5, y: -0.5 }, { x: 4.5, y: -0.5 }, { x: 4.5, y: 3.5 }, { x: -0.5, y: 3.5 }];
    for (const c of corners) expect(copies.some((s) => near(s.a, c.x, c.y) || near(s.b, c.x, c.y))).toBe(true);
    expect(t.draft().segs).toHaveLength(8);
  });

  it('espelhar com cópia (Tab): a original fica, a cópia nasce do outro lado; undoDraft restaura', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 3, y: 0 })]);
    select(t, [[1.5, 0]]);
    t.setModify('mirror');
    t.tab();
    clickAt(t, 1.5, -1);
    clickAt(t, 1.5, 1);
    const segs = t.draft().segs;
    expect(segs).toHaveLength(2);
    expect(near(segs[1]!.a, 3, 0) && near(segs[1]!.b, 0, 0)).toBe(true);
    expect(t.undoDraft()).toBe(true);
    expect(t.draft().segs).toHaveLength(1);
    expect(t.redoDraft()).toBe(true);
    expect(t.draft().segs).toHaveLength(2);
  });

  it('girar 90 graus pela digitação, em torno do centro clicado', () => {
    const { t } = setup([seg('s1', { x: 1, y: 0 }, { x: 2, y: 0 })]);
    select(t, [[1.5, 0]]);
    t.setModify('rotate');
    clickAt(t, 0, 0);
    expect(t.inputPrompt()).toBe('Ângulo (graus)');
    expect(t.type('90')).toBe(true);
    expect(near(byId(t, 's1').a, 0, 1) && near(byId(t, 's1').b, 0, 2)).toBe(true);
  });

  it('mover: base clicada e distância digitada na direção do cursor', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('move');
    clickAt(t, 0, 0);
    t.move(P(5, 0));
    expect(t.type('2')).toBe(true);
    expect(near(byId(t, 's1').a, 2, 0) && near(byId(t, 's1').b, 3, 0)).toBe(true);
  });

  it('mover: "2,3" sem espaço é um número só (vírgula decimal) e continua sendo distância', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('move');
    clickAt(t, 0, 0);
    t.move(P(10, 0));
    expect(t.type('2,3')).toBe(true);
    expect(near(byId(t, 's1').a, 2.3, 0) && near(byId(t, 's1').b, 3.3, 0)).toBe(true);
  });

  it('mover: destino digitado aceita "dx, dy" com vírgula seguida de espaço', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('move');
    clickAt(t, 0, 0);
    expect(t.type('2, 3')).toBe(true);
    expect(near(byId(t, 's1').a, 2, 3) && near(byId(t, 's1').b, 3, 3)).toBe(true);
  });

  it('mover: destino digitado aceita "dx;dy" com vírgula decimal nas partes', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('move');
    clickAt(t, 0, 0);
    expect(t.type('2,5;3')).toBe(true);
    expect(near(byId(t, 's1').a, 2.5, 3) && near(byId(t, 's1').b, 3.5, 3)).toBe(true);
  });

  it('mover: número sem separador continua sendo distância na direção do cursor', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('move');
    clickAt(t, 0, 0);
    t.move(P(10, 0));
    expect(t.type('2.5')).toBe(true);
    expect(near(byId(t, 's1').a, 2.5, 0) && near(byId(t, 's1').b, 3.5, 0)).toBe(true);
  });

  it('copiar: "2,5, 3,5" tem um ", " e vale como par com vírgula decimal nas partes', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('copy');
    clickAt(t, 0, 0);
    expect(t.type('2,5, 3,5')).toBe(true);
    const copia = t.draft().segs[1]!;
    expect(near(copia.a, 2.5, 3.5) && near(copia.b, 3.5, 3.5)).toBe(true);
  });

  it('copiar: "2;3" sem vírgula decimal também aceita o par', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('copy');
    clickAt(t, 0, 0);
    expect(t.type('2;3')).toBe(true);
    const copia = t.draft().segs[1]!;
    expect(near(copia.a, 2, 3) && near(copia.b, 3, 3)).toBe(true);
  });

  it('copiar com Ctrl repete a partir da mesma base; Esc encerra a repetição', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('copy');
    clickAt(t, 0, 0);
    clickAt(t, 2, 0, { ctrl: true });
    clickAt(t, 4, 0, { ctrl: true });
    expect(t.draft().segs).toHaveLength(3);
    t.cancel();
    t.cancel();
    expect(t.modifyKind()).toBeNull();
  });

  it('matriz: passo pelo clique e quantidade digitada (inclui o original)', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 1, y: 0 })]);
    select(t, [[0.5, 0]]);
    t.setModify('array');
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    expect(t.inputPrompt()).toBe('Quantidade');
    expect(t.type('3')).toBe(true);
    const segs = t.draft().segs;
    expect(segs).toHaveLength(3);
    expect(near(segs[2]!.a, 4, 0) && near(segs[2]!.b, 5, 0)).toBe(true);
  });

  it('alinhar: a linha clicada passa a ficar sobre a referência', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('s2', { x: 0, y: 1 }, { x: 4, y: 2 })]);
    t.setModify('align');
    clickAt(t, 2, 0);
    clickAt(t, 2, 1.5);
    expect(near(byId(t, 's2').a, 0, 0) && near(byId(t, 's2').b, 4, 0)).toBe(true);
  });
});

describe('Modificar: captura (snap) igual à do esboço', () => {
  it('dividir usa o ponto capturado: clicar perto de um vértice corta nele', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('s2', { x: 2, y: 0 }, { x: 2, y: 1 })]);
    t.setModify('split');
    clickAt(t, 2.004, 0.001);
    const partes = t.draft().segs.filter((s) => s.id !== 's2');
    expect(partes).toHaveLength(2);
    expect(partes.some((s) => near(s.b, 2, 0))).toBe(true);
    expect(partes.some((s) => near(s.a, 2, 0))).toBe(true);
  });

  it('deslocar usa o ponto capturado do lado: a distância sai exata do esboço', () => {
    const { t } = setup([seg('s1', { x: 0, y: 0 }, { x: 4, y: 0 }), seg('guia', { x: 0, y: 2 }, { x: 4, y: 2 })]);
    select(t, [[2, 0]]);
    t.setModify('offset');
    clickAt(t, 2.004, 1.999);
    const copia = t.draft().segs.find((s) => s.id !== 's1' && s.id !== 'guia')!;
    const emY2 = (p: Vec2, x: number): boolean => near(p, x, 2);
    expect((emY2(copia.a, 0) && emY2(copia.b, 4)) || (emY2(copia.a, 4) && emY2(copia.b, 0))).toBe(true);
  });

  it('o ângulo da rotação usa o ponto capturado do esboço', () => {
    const { t } = setup([seg('s1', { x: 1, y: 0 }, { x: 2, y: 0 }), seg('ref', { x: 0, y: 1 }, { x: 0, y: 2 })]);
    select(t, [[1.5, 0]]);
    t.setModify('rotate');
    clickAt(t, 0, 0);
    clickAt(t, 0.004, 1.003);
    expect(near(byId(t, 's1').a, 0, 1) && near(byId(t, 's1').b, 0, 2)).toBe(true);
  });

  it('aparar ao canto usa o ponto capturado para escolher o lado da linha', () => {
    // Cursor cru à esquerda do canto (4,0); a captura o leva ao canto/vértice próximo, e a linha fica à direita.
    const { t } = setup([seg('s1', { x: -1, y: 0 }, { x: 5, y: 0 }), seg('s2', { x: 4, y: -1 }, { x: 4, y: 4 }), seg('ref', { x: 4.05, y: 0 }, { x: 4.05, y: 1 })]);
    t.setModify('trim');
    clickAt(t, 3.98, 0.001);
    clickAt(t, 4, 2);
    expect(near(byId(t, 's1').a, 4, 0) && near(byId(t, 's1').b, 5, 0)).toBe(true);
  });
});

describe('Modificar: desfazer e refazer', () => {
  it('undoDraft e redoDraft andam pelos passos de cada operação aplicada', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0); clickAt(t, 4, 2);
    expect(near(byId(t, 's1').b, 4, 0)).toBe(true);
    expect(t.undoDraft()).toBe(true);
    expect(near(byId(t, 's1').b, 5, 0)).toBe(true);
    expect(t.redoDraft()).toBe(true);
    expect(near(byId(t, 's1').b, 4, 0)).toBe(true);
    expect(t.redoDraft()).toBe(false);
  });

  it('desfazer sem passos avisa e devolve false', () => {
    const { t } = setup(OVERSHOOT());
    expect(t.undoDraft()).toBe(false);
    expect(t.draft().segs).toHaveLength(4);
  });

  it('o preview do comando mostra o resultado tracejado', () => {
    const { t } = setup(OVERSHOOT());
    t.setModify('trim');
    clickAt(t, 2, 0);
    t.move(P(4, 2));
    expect(t.preview().some((i) => i.kind === 'line' && i.dashed === true)).toBe(true);
  });
});
