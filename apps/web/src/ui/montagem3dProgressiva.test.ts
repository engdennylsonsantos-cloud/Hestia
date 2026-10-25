import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LevelResolveCache, type ResolvedLevel } from '@hestia/engine';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import type { Id, Project } from '@hestia/model';
import { ModelScene, type Scene3DOptions } from '@hestia/render';
import { Montagem3dProgressiva, ordemDeMontagem, proximoLote, type CenaMontagem, type FonteNiveis } from './montagem3dProgressiva.ts';

/** Projeto mínimo só com os ids dos níveis (a montagem não lê mais nada além deles nos testes de fila). */
const projetoDeIds = (ids: Id[]): Project => ({ levels: ids.map((id) => ({ id })) }) as unknown as Project;
/** Nível falso: a montagem só repassa o objeto à cena. */
const nivelFalso = (id: Id): ResolvedLevel => ({ levelId: id }) as unknown as ResolvedLevel;
const OPT: Scene3DOptions = { edges: false, shadows: false, dark: false };

/** Cena que anota cada atualização (ids dos níveis e o projeto). */
class CenaAnotada implements CenaMontagem {
  readonly chamadas: Array<{ ids: Id[]; projeto: Project }> = [];
  update(p: Project, niveis: ResolvedLevel[]): void {
    this.chamadas.push({ ids: niveis.map((n) => (n as unknown as { levelId: Id }).levelId), projeto: p });
  }
}

/** Agendador manual: as tarefas ficam numa fila até o teste rodá-las. */
function filaManual(): { agendar: (t: () => void) => void; rodar: () => void } {
  const fila: Array<() => void> = [];
  return {
    agendar: (t) => fila.push(t),
    rodar: () => {
      while (fila.length > 0) fila.shift()!();
    },
  };
}

/** Fonte que conta quantas vezes cada nível foi calculado na hora. */
function fonteContada(pronto?: (id: Id) => ResolvedLevel | null): FonteNiveis & { calculados: Id[] } {
  const calculados: Id[] = [];
  return {
    calculados,
    pronto,
    resolver: (id) => {
      calculados.push(id);
      return nivelFalso(id);
    },
  };
}

describe('ordemDeMontagem', () => {
  it('o visível vem primeiro, depois os mais perto dele (empate: a ordem do projeto)', () => {
    expect(ordemDeMontagem(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual(['c', 'b', 'd', 'a', 'e']);
  });

  it('sem visível, ou com visível desconhecido, começa pelo primeiro nível', () => {
    expect(ordemDeMontagem(['a', 'b', 'c'], null)).toEqual(['a', 'b', 'c']);
    expect(ordemDeMontagem(['a', 'b', 'c'], 'x')).toEqual(['a', 'b', 'c']);
  });
});

describe('proximoLote', () => {
  it('dobra quando a fatia coube com folga', () => {
    expect(proximoLote(2, 1, 12)).toBe(4);
  });

  it('divide quando a fatia estourou o orçamento, sem passar de 1 para baixo', () => {
    expect(proximoLote(4, 20, 12)).toBe(2);
    expect(proximoLote(1, 20, 12)).toBe(1);
  });

  it('mantém o tamanho quando a fatia ficou na faixa do orçamento', () => {
    expect(proximoLote(3, 8, 12)).toBe(3);
  });

  it('não passa do teto', () => {
    expect(proximoLote(8, 1, 12)).toBe(8);
  });
});

describe('Montagem3dProgressiva: fatias', () => {
  it('a primeira fatia é síncrona e traz o visível com os dois vizinhos, na ordem do projeto', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const p = projetoDeIds(ids);
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    m.iniciar(p, OPT, 'n10');
    expect(cena.chamadas).toHaveLength(1);
    expect(cena.chamadas[0]!.ids).toEqual(['n9', 'n10', 'n11']);
  });

  it('a cena cresce a cada fatia e termina com todos os níveis na ordem do projeto', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const p = projetoDeIds(ids);
    const cena = new CenaAnotada();
    const fila = filaManual();
    let atualizacoes = 0;
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => atualizacoes++, aoConcluir: () => concluidas++, agendar: fila.agendar });
    m.iniciar(p, OPT, 'n0');
    fila.rodar();
    const tamanhos = cena.chamadas.map((c) => c.ids.length);
    expect(tamanhos.every((t, i) => i === 0 || t > tamanhos[i - 1]!)).toBe(true);
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
    expect(atualizacoes).toBe(cena.chamadas.length);
    expect(concluidas).toBe(1);
    expect(m.montados).toBe(20);
  });

  it('o lote cresce quando a fatia é barata (3, 6, 8, 3)', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar, relogio: () => 0 });
    m.iniciar(projetoDeIds(ids), OPT, 'n0');
    fila.rodar();
    expect(cena.chamadas.map((c) => c.ids.length)).toEqual([3, 9, 17, 20]);
  });

  it('o lote encolhe quando a fatia estoura o orçamento', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `n${i}`);
    const cena = new CenaAnotada();
    const fila = filaManual();
    let t = 0;
    // Cada leitura do relógio avança 20 ms: a fatia dura 20 ms, acima do orçamento de 12 ms.
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar, relogio: () => (t += 20), orcamentoMs: 12 });
    m.iniciar(projetoDeIds(ids), OPT, 'n0');
    fila.rodar();
    expect(cena.chamadas.map((c) => c.ids.length)).toEqual([3, 4, 5, 6]);
  });

  it('sem níveis: a cena é atualizada uma vez, vazia, e a montagem conclui', () => {
    const cena = new CenaAnotada();
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => concluidas++ });
    m.iniciar(projetoDeIds([]), OPT, null);
    expect(cena.chamadas).toHaveLength(1);
    expect(cena.chamadas[0]!.ids).toEqual([]);
    expect(concluidas).toBe(1);
  });
});

describe('Montagem3dProgressiva: fonte e cancelamento', () => {
  it('usa o pronto em segundo plano quando há, sem calcular esse nível de novo', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const cena = new CenaAnotada();
    const fila = filaManual();
    const fonte = fonteContada((id) => (id === 'c' ? nivelFalso('c') : null));
    const m = new Montagem3dProgressiva({ cena, fonte, aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    m.iniciar(projetoDeIds(ids), OPT, 'a');
    fila.rodar();
    expect(fonte.calculados).not.toContain('c');
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
  });

  it('iniciar de novo cancela a montagem anterior: as fatias antigas não mexem na cena', () => {
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    const antigo = projetoDeIds(['a', 'b', 'c', 'd', 'e']);
    const novo = projetoDeIds(['x', 'y']);
    m.iniciar(antigo, OPT, 'a');
    m.iniciar(novo, OPT, 'x');
    fila.rodar();
    expect(cena.chamadas.filter((c) => c.projeto === antigo)).toHaveLength(1);
    expect(cena.chamadas.at(-1)!.ids).toEqual(['x', 'y']);
  });

  it('cancelar: as fatias agendadas não atualizam a cena nem concluem', () => {
    const cena = new CenaAnotada();
    const fila = filaManual();
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => concluidas++, agendar: fila.agendar });
    m.iniciar(projetoDeIds(['a', 'b', 'c', 'd', 'e']), OPT, 'a');
    m.cancelar();
    fila.rodar();
    expect(cena.chamadas).toHaveLength(1);
    expect(concluidas).toBe(0);
  });
});

/** Conteúdo da cena: cada malha e linha com tipo, categoria, faixas de picking, matriz e posições. Na ordem da cena. */
function assinatura(ms: ModelScene): string[] {
  const linhas: string[] = [];
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
    const pos = o.geometry.getAttribute('position');
    linhas.push([o.type, String(o.userData.kind), JSON.stringify(o.userData.ranges ?? null), o.matrixWorld.elements.join(','), pos ? Array.from(pos.array as ArrayLike<number>).join(',') : ''].join('|'));
  });
  return linhas;
}

describe('Montagem3dProgressiva: resultado igual à montagem completa', () => {
  for (const opt of [OPT, { edges: true, shadows: false, dark: true }] as Scene3DOptions[]) {
    it(`20 pavimentos (edges=${opt.edges}, dark=${opt.dark}): a cena final é a mesma da montagem de uma vez`, () => {
      const p = projetoComPavimentos(20);
      const ids = p.levels.map((l) => l.id);

      const cheia = new ModelScene();
      const cacheCheia = new LevelResolveCache();
      cheia.update(p, ids.map((id) => cacheCheia.get(p, id)), opt);

      const parcial = new ModelScene();
      const cenaParcial: CenaMontagem = {
        update: (proj, niveis, o) => {
          parcial.update(proj, niveis, o);
        },
      };
      const cacheParcial = new LevelResolveCache();
      const fila = filaManual();
      let concluidas = 0;
      const m = new Montagem3dProgressiva({
        cena: cenaParcial,
        fonte: { resolver: (id) => cacheParcial.get(p, id) },
        aoAtualizar: () => undefined,
        aoConcluir: () => concluidas++,
        agendar: fila.agendar,
      });
      m.iniciar(p, opt, 'pav_10');
      fila.rodar();

      expect(concluidas).toBe(1);
      expect(assinatura(cheia).length).toBeGreaterThan(100);
      expect(assinatura(parcial)).toEqual(assinatura(cheia));
      expect(parcial.orbit.sceneRadius).toBe(cheia.orbit.sceneRadius);
    }, 120_000);
  }
});
