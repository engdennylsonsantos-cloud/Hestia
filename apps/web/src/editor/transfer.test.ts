import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeLevel, makeRoom, makeStair, makeWall, stairsOnLevel, wallsOnLevel, type StairLanding, type StairRun, type Wall } from '@hestia/model';
import { Transfer } from './transfer.ts';
import { useUi } from './state.ts';

function setup() {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_1', name: 'Pav. 1', elevation: 3 }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'A', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'B', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 9 }, b: { x: 2, y: 9 } }) });
  useUi.setState({ selection: ['A'], levelId: 'lv_0' });
  return s;
}

describe('transferência do editor (copiar, colar alinhado, mesmo tipo)', () => {
  it('copia a seleção e cola alinhado no nível pedido, selecionando o resultado', () => {
    const s = setup();
    const t = new Transfer();
    expect(t.copy(s.project, ['A'])).toBe(true);
    expect(t.paste(s, 'lv_1')).toBe(true);
    const onLv1 = wallsOnLevel(s.project, 'lv_1') as Wall[];
    expect(onLv1).toHaveLength(2);
    expect(onLv1[1]!.a).toEqual({ x: 0, y: 0 });
    expect(useUi.getState().selection).toHaveLength(1);
    s.undo();
    expect(wallsOnLevel(s.project, 'lv_1')).toHaveLength(1);
  });

  it('o buffer fica disponível para o Colar com prévia', () => {
    const s = setup();
    const t = new Transfer();
    expect(t.clipBuffer()).toBeNull();
    t.copy(s.project, ['A']);
    expect(t.clipBuffer()?.walls.map((w) => w.id)).toEqual(['A']);
  });

  it('copiar sem parede mantém o buffer anterior', () => {
    const s = setup();
    const t = new Transfer();
    t.copy(s.project, ['A']);
    expect(t.copy(s.project, [])).toBe(false);
    expect(t.paste(s, 'lv_1')).toBe(true);
  });

  it('colar sem nada copiado não altera o modelo', () => {
    const s = setup();
    expect(new Transfer().paste(s, 'lv_1')).toBe(false);
    expect(wallsOnLevel(s.project, 'lv_1')).toHaveLength(1);
  });

  it('mesmo tipo seleciona todas do tipo no nível ativo', () => {
    const s = setup();
    useUi.setState({ selection: ['A'], levelId: 'lv_0' });
    expect(new Transfer().sameType(s.project, 'lv_0')).toBe(1);
    expect(useUi.getState().selection).toEqual(['A']);
  });

  it('mesmo nome seleciona os ambientes de mesmo nome (e só eles); sem ambiente na seleção, não seleciona e explica', () => {
    const s = setup();
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '1', point: { x: 1, y: 1 } }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Sala', number: '2', point: { x: 3, y: 1 } }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r3', levelId: 'lv_0', name: 'Cozinha', number: '3', point: { x: 5, y: 1 } }) });
    useUi.setState({ selection: ['A'], levelId: 'lv_0' });
    expect(new Transfer().sameName(s.project, 'lv_0')).toBe(0);
    expect(useUi.getState().status).toMatch(/Selecione um ambiente primeiro/);
    useUi.setState({ selection: ['r1'], levelId: 'lv_0' });
    expect(new Transfer().sameName(s.project, 'lv_0')).toBe(2);
    expect([...useUi.getState().selection].sort()).toEqual(['r1', 'r2']);
  });

  it('mesmo tipo com seleção vazia informa e não seleciona', () => {
    const s = setup();
    useUi.setState({ selection: [], levelId: 'lv_0' });
    expect(new Transfer().sameType(s.project, 'lv_0')).toBe(0);
    expect(useUi.getState().status).toMatch(/Selecione/);
  });
});

/** Escada de teste: um lance reto de três espelhos e um patamar retangular (componentes em ordem). */
function stairSetup(s: ProjectStore) {
  const ln = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag: 0 });
  const run: StairRun = {
    id: 'r_1',
    kind: 'run',
    boundaryLeft: [ln(0, 0.5, 2, 0.5)],
    boundaryRight: [ln(0, -0.5, 2, -0.5)],
    risers: [ln(0.28, -1, 0.28, 1), ln(0.56, -1, 0.56, 1), ln(0.84, -1, 0.84, 1)],
    path: [],
  };
  const landing: StairLanding = { id: 'p_1', kind: 'landing', boundary: [ln(2, 0.5, 3, 0.5), ln(3, 0.5, 3, -0.5), ln(3, -0.5, 2, -0.5), ln(2, -0.5, 2, 0.5)] };
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st_1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [run, landing] }) });
  useUi.setState({ selection: ['st_1'], levelId: 'lv_0' });
  return { run, landing };
}

describe('copiar e colar escada (controlador web)', () => {
  it('copia uma escada e cola alinhada em outro nível: componentes, tipo e ids novos', () => {
    const s = new ProjectStore(createEmptyProject());
    const { run, landing } = stairSetup(s);
    const t = new Transfer();
    expect(t.copy(s.project, ['st_1'])).toBe(true);
    expect(useUi.getState().status).toMatch(/1 escada\(s\) copiado/);
    expect(t.paste(s, 'lv_1')).toBe(true);

    const [orig] = stairsOnLevel(s.project, 'lv_0');
    const [copy, ...rest] = stairsOnLevel(s.project, 'lv_1');
    expect(rest).toHaveLength(0);
    expect(copy!.id).not.toBe('st_1');
    expect(copy!.id).toMatch(/^st/);
    expect(copy!.levelId).toBe('lv_1');
    expect(copy!.typeId).toBe(defaultStairTypeId);
    expect(copy!.components.map((c) => c.kind)).toEqual(['run', 'landing']);
    const ids = copy!.components.map((c) => c.id);
    expect(ids).not.toContain(run.id);
    expect(ids).not.toContain(landing.id);
    expect(new Set(ids).size).toBe(2);
    // Alinhada: mesma geometria nas mesmas coordenadas.
    const pastedRun = copy!.components[0] as StairRun;
    expect(pastedRun.risers).toEqual(run.risers);
    expect(pastedRun.boundaryLeft).toEqual(run.boundaryLeft);
    expect((copy!.components[1] as StairLanding).boundary).toEqual(landing.boundary);
    // A original não muda, e o resultado fica selecionado.
    expect(orig!.levelId).toBe('lv_0');
    expect(orig!.components.map((c) => c.id)).toEqual(['r_1', 'p_1']);
    expect(useUi.getState().selection).toEqual([copy!.id]);
    expect(useUi.getState().status).toMatch(/1 escada\(s\) colado\(s\)/);
  });

  it('desfazer a colagem tira a escada do nível de destino', () => {
    const s = new ProjectStore(createEmptyProject());
    stairSetup(s);
    const t = new Transfer();
    t.copy(s.project, ['st_1']);
    t.paste(s, 'lv_1');
    expect(stairsOnLevel(s.project, 'lv_1')).toHaveLength(1);
    s.undo();
    expect(stairsOnLevel(s.project, 'lv_1')).toHaveLength(0);
    expect(stairsOnLevel(s.project, 'lv_0')).toHaveLength(1);
  });
});

describe('estado do buffer e ids que o Copiar levaria', () => {
  it('hasClip é falso antes de copiar e verdadeiro depois', () => {
    const s = setup();
    const t = new Transfer();
    expect(t.hasClip()).toBe(false);
    expect(t.copy(s.project, ['A'])).toBe(true);
    expect(t.hasClip()).toBe(true);
  });

  it('seleção mista continua copiando o que é copiável; sem nada copiável o buffer segue vazio', () => {
    const s = setup();
    const t = new Transfer();
    expect(t.copy(s.project, ['nada', 'zzz'])).toBe(false);
    expect(t.hasClip()).toBe(false);
    expect(t.copy(s.project, ['A', 'zzz'])).toBe(true);
    expect(t.hasClip()).toBe(true);
  });

  it('copyableIds delega à função pura: paredes, aberturas hospedadas e nada de ids inválidos', () => {
    const s = setup();
    s.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'A', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const t = new Transfer();
    expect(t.copyableIds(s.project, ['A', 'A', 'zzz'])).toEqual(['A', 'd1']);
    expect(t.copyableIds(s.project, [])).toEqual([]);
  });
});
