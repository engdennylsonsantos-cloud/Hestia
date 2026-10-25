import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeWall, type Command, type Id, type Project } from '@hestia/model';
import { assinaturasDoProjeto, chavesDeNivel, hashTexto } from './chaveNivel3d.ts';

/** Projeto com `n` pavimentos (cota de 3 m) e quatro paredes por nível, como o gerador do baseline. */
function predio(n: number): Project {
  const store = new ProjectStore(createEmptyProject('Chaves por nível'));
  const cmds: Command[] = [];
  const levels: Id[] = [];
  for (let i = 0; i < n; i++) {
    const id = i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `ch_lv_${i}`;
    levels.push(id);
    cmds.push({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
  }
  const contorno: Array<[[number, number], [number, number]]> = [[[0, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]], [[0, 4], [0, 0]]];
  levels.forEach((levelId, i) => {
    contorno.forEach(([[ax, ay], [bx, by]], j) => {
      cmds.push({ type: 'addWall', wall: makeWall({ id: `ch_w_${i}_${j}`, typeId: 'wt_ext19', levelId, a: { x: ax, y: ay }, b: { x: bx, y: by } }) });
    });
  });
  store.exec({ type: 'batch', commands: cmds });
  return store.project;
}

/** Projeto com a parede `j` do pavimento `i` deslocada em x (só esse elemento muda). */
function comParede(p: Project, i: number, j: number, dx: number): Project {
  const w = p.elements[`ch_w_${i}_${j}`];
  if (!w || w.kind !== 'wall') throw new Error('parede de teste não encontrada');
  return { ...p, elements: { ...p.elements, [w.id]: { ...w, b: { x: w.b.x + dx, y: w.b.y } } } };
}

const MARCA = '[false,false,false,"realistic"]';

/** Chaves como lista, na ordem dos pavimentos do projeto. */
const chaves = (p: Project, marca = MARCA): string[] => {
  const m = chavesDeNivel(p, marca);
  return p.levels.map((l) => m.get(l.id)!);
};

describe('chaves de nível (conteúdo do pavimento e dos vizinhos por cota)', () => {
  it('projeto igual dá as mesmas chaves, e a chave é um hash curto', () => {
    const p = predio(5);
    expect(chaves(p)).toEqual(chaves(predio(5)));
    expect(chaves(p).every((k) => k.length > 0 && k.length <= 16)).toBe(true);
  });

  it('editar uma parede refaz só o pavimento dela e os vizinhos por cota (acima e abaixo)', () => {
    const p = predio(5);
    const antes = chaves(p);
    const depois = chaves(comParede(p, 2, 1, 0.25));
    const mudou = depois.map((k, i) => k !== antes[i]);
    expect(mudou).toEqual([false, true, true, true, false]);
  });

  it('editar o pavimento mais baixo refaz o dele e o de cima, não o resto', () => {
    const p = predio(4);
    const antes = chaves(p);
    const mudou = chaves(comParede(p, 0, 0, 0.1)).map((k, i) => k !== antes[i]);
    expect(mudou).toEqual([true, true, false, false]);
  });

  it('mudar a vista (tema, arestas, sombras, estilo) muda todas as chaves', () => {
    const p = predio(3);
    const antes = chaves(p);
    const escuro = chaves(p, '[true,false,false,"realistic"]');
    expect(escuro.every((k, i) => k !== antes[i])).toBe(true);
  });

  it('mudar algo do projeto que não é elemento (tipo, cota de referência, altura padrão) muda todas as chaves', () => {
    const p = predio(3);
    const antes = chaves(p);
    const outro = { ...p, defaults: { ...p.defaults, wallHeight: p.defaults.wallHeight + 0.1 } };
    expect(chaves(outro).every((k, i) => k !== antes[i])).toBe(true);
  });

  it('mudar a cota de um pavimento muda todas as chaves (a ordem e as alturas mudaram)', () => {
    const p = predio(3);
    const antes = chaves(p);
    const lv = p.levels[1]!;
    const outro = { ...p, levels: p.levels.map((l) => (l.id === lv.id ? { ...l, elevation: lv.elevation + 0.5 } : l)) };
    expect(chaves(outro).every((k, i) => k !== antes[i])).toBe(true);
  });

  it('elemento sem nível entra no bloco global: mudá-lo muda todas as chaves', () => {
    const p = predio(3);
    const antes = assinaturasDoProjeto(p).global;
    const sem = { ...p, elements: { ...p.elements, 'ch_solto': { kind: 'room', id: 'ch_solto' } as never } };
    expect(assinaturasDoProjeto(sem).global).not.toBe(antes);
  });

  it('a ordem dos pavimentos é pela cota: vizinho é o de cota logo abaixo e logo acima', () => {
    const p = predio(3);
    const invertido = { ...p, levels: [...p.levels].reverse() };
    expect(assinaturasDoProjeto(invertido).ordem).toEqual(['lv_0', 'lv_1', 'ch_lv_2']);
  });

  it('hashTexto é determinístico e distingue textos diferentes', () => {
    expect(hashTexto('abc')).toBe(hashTexto('abc'));
    expect(hashTexto('abc')).not.toBe(hashTexto('abd'));
  });
});
