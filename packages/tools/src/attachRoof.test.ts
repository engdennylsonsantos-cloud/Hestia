import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, roofsOnLevel, wallsOnLevel, type Project, type Roof, type Wall } from '@hestia/model';
import { roofWallIssues, wallZRange } from '@hestia/engine';
import { TOOL_LABEL, TOOL_GROUPS, createTool, type ToolEnv } from './index.ts';
import { commitPerimeter } from './perimeterCommit.ts';
import { addSegs, newDraft } from './perimeterSession.ts';
import { clickAt, drawWall, makeEnv, tool } from './testEnv.ts';

/** Ambiente com a captura das mensagens da barra de status. */
function ctxWithSay() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  const env: ToolEnv = { ...ctx.env, say: (m) => msgs.push(m) };
  return { ...ctx, env, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Telhado retangular 6 × 4 (x 0..6, y 0..4) criado pelo commit do perímetro, como em roofEdit.test. */
function withRoof() {
  const ctx = ctxWithSay();
  const cantos = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
  // Balanço zero: o beiral é o retângulo 6 × 4 desenhado, como os cálculos de cobertura destes testes esperam.
  const res = commitPerimeter(ctx.store.project, addSegs(newDraft('roof'), cantos.map((a, i) => ({ a, b: cantos[(i + 1) % 4]! }))), { typeId: 'rt_ceramica', levelId: 'lv_0', overhang: 0 });
  if (!res.ok) throw new Error(res.message);
  for (const c of res.commands) ctx.store.exec(c);
  const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
  return { ...ctx, roofId: r.id, roof: () => ctx.store.project.elements[r.id] as Roof };
}

const wallById = (p: Project, id: string): Wall => p.elements[id] as Wall;
const walls = (p: Project): Wall[] => wallsOnLevel(p, 'lv_0');

describe('Anexar topo: fluxo de dois passos (planta)', () => {
  it('paredes selecionadas + clique no telhado anexam todas, num só passo de desfazer', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    drawWall(ctx.env, [1, 3], [5, 3]);
    const [w1, w2] = walls(ctx.store.project);
    ctx.env.setSelection([w1!.id, w2!.id]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 2);
    for (const id of [w1!.id, w2!.id]) {
      expect(wallById(ctx.store.project, id).attachTopToRoof).toBe(true);
      expect(wallById(ctx.store.project, id).attachTopRoofId).toBe(ctx.roofId);
    }
    expect(ctx.last()).toBe('Topo anexado a 2 parede(s). Ctrl+Z desfaz.');
    ctx.store.undo();
    for (const w of walls(ctx.store.project)) expect(w.attachTopToRoof).toBe(false);
    ctx.store.redo();
    for (const w of walls(ctx.store.project)) expect(w.attachTopRoofId).toBe(ctx.roofId);
  });

  it('sem seleção: clicar nas paredes, Enter escolhe o telhado e o clique nele anexa', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    drawWall(ctx.env, [1, 3], [5, 3]);
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 1);
    clickAt(t, 3, 3);
    expect(ctx.last()).toBe('2 parede(s) escolhida(s). Enter escolhe o telhado.');
    t.confirm();
    expect(ctx.last()).toMatch(/^2 parede\(s\) escolhida\(s\)\. Selecione o telhado/);
    clickAt(t, 3, 2);
    expect(walls(ctx.store.project).every((w) => w.attachTopRoofId === ctx.roofId)).toBe(true);
  });

  it('clicar de novo numa parede escolhida tira ela da lista', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 1);
    clickAt(t, 3, 1);
    t.confirm();
    expect(ctx.last()).toMatch(/^Escolha ao menos uma parede/);
  });

  it('sem paredes escolhidas, Enter avisa e nada é gravado', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    t.confirm();
    expect(ctx.last()).toBe('Escolha ao menos uma parede antes do telhado.');
    expect(walls(ctx.store.project)[0]!.attachTopToRoof).toBe(false);
  });

  it('clique fora de telhado na etapa do telhado não grava', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 9, 9);
    expect(ctx.last()).toBe('Clique sobre um telhado do nível atual. Enter volta às paredes.');
    expect(wallById(ctx.store.project, w.id).attachTopToRoof).toBe(false);
  });

  it('Esc na etapa do telhado volta às paredes; o segundo Esc sai da ferramenta', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    ctx.env.setSelection([walls(ctx.store.project)[0]!.id]);
    const t = tool('attachroof', ctx.env);
    const d0 = ctx.done();
    t.cancel();
    expect(ctx.done()).toBe(d0);
    t.cancel();
    expect(ctx.done()).toBe(d0 + 1);
  });

  it('a ferramenta aceita clique na vista 3D (pick3d) e o rótulo está em português', () => {
    const ctx = makeEnv();
    expect(createTool('attachroof', ctx.env).pick3d).toBe(true);
    expect(createTool('detachroof', ctx.env).pick3d).toBe(true);
    expect(TOOL_LABEL.attachroof).toBe('Anexar topo');
    expect(TOOL_LABEL.detachroof).toBe('Desanexar topo');
    expect(TOOL_GROUPS.find((g) => g.title === 'Modificar')!.tools).toEqual(expect.arrayContaining(['attachroof', 'detachroof']));
  });
});

describe('Anexar topo: aviso de cobertura (C2)', () => {
  it('parede que sai do telhado é anexada e o aviso diz quanto fica fora', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [4, 2], [9, 2]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    clickAt(tool('attachroof', ctx.env), 2, 1);
    expect(wallById(ctx.store.project, w.id).attachTopToRoof).toBe(true);
    expect(ctx.last()).toBe(`Topo anexado a 1 parede(s). Aviso: "${w.id}" tem 3,00 m do eixo fora do telhado. Ctrl+Z desfaz.`);
    expect(roofWallIssues(ctx.store.project).some((i) => i.code === 'wall-roof-uncovered' && i.elementId === w.id)).toBe(true);
  });

  it('parede fora do telhado inteiro: aviso, e o topo fica na altura normal', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [8, 2], [9, 2]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    clickAt(tool('attachroof', ctx.env), 2, 1);
    expect(ctx.last()).toContain('está fora deste telhado; o topo fica na altura normal');
  });

  it('parede curva: entra com aviso e não segue o telhado', () => {
    const ctx = withRoof();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'arc', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 1, y: 2 }, b: { x: 5, y: 2 }, sag: 0.5 }) });
    ctx.env.setSelection(['arc']);
    clickAt(tool('attachroof', ctx.env), 3, 1);
    expect(wallById(ctx.store.project, 'arc').attachTopToRoof).toBe(true);
    expect(ctx.last()).toContain('"arc" é curva e não acompanha o telhado');
    expect(wallZRange(ctx.store.project, wallById(ctx.store.project, 'arc')).profile).toBeUndefined();
  });
});

describe('Desanexar topo', () => {
  it('com paredes selecionadas, ativar a ferramenta solta o topo num só passo de desfazer', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    clickAt(tool('attachroof', ctx.env), 3, 2);
    ctx.env.setSelection([w.id]);
    tool('detachroof', ctx.env);
    const after = wallById(ctx.store.project, w.id);
    expect(after.attachTopToRoof).toBe(false);
    expect(after.attachTopRoofId).toBeUndefined();
    expect(ctx.last()).toBe('Topo desanexado de 1 parede(s). Ctrl+Z desfaz.');
    ctx.store.undo();
    expect(wallById(ctx.store.project, w.id).attachTopRoofId).toBe(ctx.roofId);
  });

  it('clicar numa parede solta só ela', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    drawWall(ctx.env, [1, 3], [5, 3]);
    const [w1, w2] = walls(ctx.store.project);
    ctx.env.setSelection([w1!.id, w2!.id]);
    clickAt(tool('attachroof', ctx.env), 3, 2);
    ctx.env.setSelection([]);
    clickAt(tool('detachroof', ctx.env), 3, 1);
    expect(wallById(ctx.store.project, w1!.id).attachTopToRoof).toBe(false);
    expect(wallById(ctx.store.project, w2!.id).attachTopToRoof).toBe(true);
  });

  it('parede que não está anexada: avisa e nada muda', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    tool('detachroof', ctx.env);
    expect(ctx.last()).toBe('Nenhuma parede escolhida está anexada ao telhado.');
    expect(wallById(ctx.store.project, w.id).attachTopToRoof).toBe(false);
  });
});

describe('telhado alvo e acompanhamento do telhado', () => {
  /** Telhado de água (gable, cumeeira em x, beiral em y = −1) e parede em y = 0 de x 0 a 6, como em roofWall.test. */
  function build(extra: Partial<Wall> = {}, roof: Partial<Roof> = {}): Project {
    const s = new ProjectStore(createEmptyProject());
    const rect = [{ x: -1, y: -1 }, { x: 7, y: -1 }, { x: 7, y: 9 }, { x: -1, y: 9 }];
    s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect, shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3, ...roof }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3, attachTopToRoof: true, attachTopRoofId: 'r1', ...extra }) });
    return s.project;
  }

  it('mudar a cota do beiral muda o topo da parede anexada', () => {
    const p = build();
    const h0 = wallZRange(p, wallById(p, 'w1')).height;
    const s = new ProjectStore(p);
    s.exec({ type: 'updateElements', ids: ['r1'], patch: { heightOffset: 3.5 } });
    const h1 = wallZRange(s.project, wallById(s.project, 'w1')).height;
    expect(h1 - h0).toBeCloseTo(0.5, 6);
  });

  it('mudar a inclinação do telhado muda o topo da parede (0,2 m por 1 m de eixo a 1 m do beiral)', () => {
    const p = build();
    const h0 = wallZRange(p, wallById(p, 'w1')).height;
    const s = new ProjectStore(p);
    s.exec({ type: 'updateElements', ids: ['r1'], patch: { slopePercent: 50 } });
    const h1 = wallZRange(s.project, wallById(s.project, 'w1')).height;
    expect(h1 - h0).toBeCloseTo(0.2, 6);
  });

  it('telhado escolhido que não existe: parede na altura normal e aviso C2 de cobertura', () => {
    const p = build({ attachTopRoofId: 'nao_existe' });
    expect(wallZRange(p, wallById(p, 'w1')).height).toBe(3);
    expect(roofWallIssues(p).some((i) => i.code === 'wall-roof-uncovered' && i.elementId === 'w1')).toBe(true);
  });
});

describe('Anexar topo na 3D: escolhe o elemento que a vista destaca', () => {
  it('parede escolhida pelo elemento 3D vale mesmo com o ponto fora da pegada na planta', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 30, 30, { hit3d: w.id });
    expect(ctx.last()).toBe('1 parede(s) escolhida(s). Enter escolhe o telhado.');
  });

  it('vazio na 3D não escolhe parede, mesmo com o ponto sobre ela', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 1, { hit3d: null });
    expect(ctx.last()).toMatch(/^Clique numa parede/);
  });

  it('abertura escolhida na 3D vale pela parede que a hospeda', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.exec({ type: 'addOpening', opening: { id: 'jan1', kind: 'window', typeId: 'ot_j120', hostId: w.id, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 1, { hit3d: 'jan1' });
    expect(ctx.last()).toBe('1 parede(s) escolhida(s). Enter escolhe o telhado.');
  });

  it('telhado escolhido na 3D que está na etapa de paredes avisa que o telhado vem depois', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    ctx.env.setSelection([]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 3, 2, { hit3d: ctx.roofId });
    expect(ctx.last()).toMatch(/^Isso é um telhado/);
  });

  it('na etapa do telhado, o telhado escolhido na 3D anexa mesmo com o ponto fora do beiral na planta', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    const w = walls(ctx.store.project)[0]!;
    ctx.env.setSelection([w.id]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 40, 40, { hit3d: ctx.roofId });
    expect(wallById(ctx.store.project, w.id).attachTopToRoof).toBe(true);
  });

  it('duas paredes seguidas na 3D: a segunda entra na lista e anexa com Enter (sem trocar de vista)', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [1, 1], [5, 1]);
    drawWall(ctx.env, [1, 3], [5, 3]);
    const [w1, w2] = walls(ctx.store.project);
    ctx.env.setSelection([w1!.id]);
    const t = tool('attachroof', ctx.env);
    clickAt(t, 40, 40, { hit3d: ctx.roofId });
    expect(wallById(ctx.store.project, w1!.id).attachTopToRoof).toBe(true);
    clickAt(t, 3, 3, { hit3d: w2!.id });
    t.confirm();
    clickAt(t, 40, 40, { hit3d: ctx.roofId });
    expect(wallById(ctx.store.project, w2!.id).attachTopRoofId).toBe(ctx.roofId);
    expect(wallById(ctx.store.project, w2!.id).attachTopToRoof).toBe(true);
  });
});
