import { describe, expect, it } from 'vitest';
import { ProjectStore, wallsOnLevel, type Id, type Project } from '@hestia/model';
import { adjacentLevelIds } from './junctionNet.ts';
import { junctionLevel } from './junctionLevel.ts';
import { syntheticProject } from './fixtureSintetica.ts';

/**
 * Junção com projeto reduzido igual à do projeto inteiro (cache de cortadores por conteúdo). A redução replica a da
 * vista (`projetoDaJuncao`): o nível, os vizinhos por cota e, para parede fixada a piso ou telhado, os níveis que ela lê.
 * O resultado tem de sair igual ao do projeto inteiro, nível a nível, com 1, 10 e 20 pavimentos.
 */

/** Projeto com paredes fixadas: ao piso (base e topo) no pavimento do meio e ao telhado no pavimento de cima. */
function comFixacoes(n: number): Project {
  const p = syntheticProject(n);
  const niveis = [...p.levels].sort((a, b) => a.elevation - b.elevation).map((l) => l.id);
  const meio = niveis[Math.floor(niveis.length / 2)]!;
  const topo = niveis[niveis.length - 1]!;
  const ids = (id: Id) => wallsOnLevel(p, id).slice(0, 3).map((w) => w.id);
  const s = new ProjectStore(p);
  s.exec({ type: 'updateElements', ids: ids(meio), patch: { attachBottomToFloor: true, attachTopToFloor: true } });
  s.exec({ type: 'updateElements', ids: ids(topo), patch: { attachTopToRoof: true } });
  return s.project;
}

/** Reduzido ao que a junção do nível lê: ele mesmo, os vizinhos por cota e, para parede fixada, o piso de base e de topo. */
function reduzido(p: Project, levelId: Id): Project {
  const mantidos = new Set<Id>([levelId, ...adjacentLevelIds(p, levelId)]);
  for (const w of wallsOnLevel(p, levelId)) {
    if (w.attachBottomToFloor === true || w.attachTopToFloor === true) {
      for (const d of [levelId, ...adjacentLevelIds(p, levelId)]) mantidos.add(d);
    }
    if (w.attachTopToRoof === true) mantidos.add(w.topLevelId ?? levelId);
  }
  return { ...p, levels: p.levels.filter((l) => mantidos.has(l.id)) };
}

describe('junção com projeto reduzido é igual à do projeto inteiro', () => {
  for (const n of [1, 10, 20]) {
    it(`${n} pavimento(s), paredes sem fixação`, () => {
      const p = syntheticProject(n);
      for (const l of p.levels) {
        expect(junctionLevel(reduzido(p, l.id), l.id)).toEqual(junctionLevel(p, l.id));
      }
    });

    it(`${n} pavimento(s), parede fixada ao piso e ao telhado`, () => {
      const p = comFixacoes(n);
      for (const l of p.levels) {
        expect(junctionLevel(reduzido(p, l.id), l.id)).toEqual(junctionLevel(p, l.id));
      }
    });
  }
});
