import { describe, expect, it } from 'vitest';
import { LIGHT, type PlanDrawList, type Viewport } from '@hestia/render';
import { caixaDe, empacotarAnel } from '@hestia/engine/src/fluxoGeometria.ts';
import type { ElementoGeometrico, PatchProvisorio } from '@hestia/engine/src/fluxoPatch.ts';
import type { ResolvedLevel } from '@hestia/engine';
import { ProvisoriosAtivos } from '../editor/fluxoEdicao.ts';
import { QuadroPlanta, type EntradaDesenho } from './quadroPlanta.ts';

const v: Viewport = { cx: 0, cy: 0, zoom: 50, width: 800, height: 600 };
const NIVEL = 'n1';

const parede = (id: string, x0: number): ElementoGeometrico => {
  const geometria = empacotarAnel([{ x: x0, y: -0.1 }, { x: x0 + 4, y: -0.1 }, { x: x0 + 4, y: 0.1 }, { x: x0, y: 0.1 }]);
  return { id, kind: 'wall', provisorio: true, z0: 0, z1: 3, geometria, caixa: caixaDe(geometria) };
};

/** Aplica uma edição provisória (a parede `w` passa de `de` a `para`) como o fluxo emitiria. */
function editar(ativos: ProvisoriosAtivos, versao: number, de: number, para: number): void {
  const patch: PatchProvisorio = { nivel: NIVEL, versao, elementos: [parede('w', para)], removidos: [] };
  ativos.aplicar({
    tipo: 'provisorio',
    versao,
    alteracao: { versao, versaoAnterior: versao - 1, adicionados: [], alterados: ['w'], removidos: [], niveis: new Set([NIVEL]) },
    patches: [patch],
    anteriores: [{ nivel: NIVEL, elemento: parede('w', de) }],
  });
}

/** Quadro, cena e pedidos de quadro falsos: registram o que o desenho fez. */
function montar() {
  const ativos = new ProvisoriosAtivos();
  const pendentes = new Set<string>();
  const tarefas: Array<() => void> = [];
  const pedidos: number[] = [];
  const chamadas: string[] = [];
  const slots: Array<{ slot: string; fills: number; strokes: number }> = [];
  const q = new QuadroPlanta({
    provisorios: ativos,
    resolverReferencia: (id) => ({ levelId: id, walls: {}, clusters: [] }) as ResolvedLevel,
    pendente: (id) => pendentes.has(id),
    pedirQuadro: () => pedidos.push(1),
    depoisDaPintura: (f) => tarefas.push(f),
  });
  const quadro = { update: () => void chamadas.push('update'), reset: () => void chamadas.push('reset') };
  const cena = { setSlot: (slot: string, fills: unknown[], strokes: unknown[]) => void slots.push({ slot, fills: fills.length, strokes: strokes.length }) };
  const entrada = (versao: number, extra: Partial<EntradaDesenho> = {}): EntradaDesenho => ({
    quadro: quadro as unknown as EntradaDesenho['quadro'],
    cena: cena as unknown as EntradaDesenho['cena'],
    v,
    tema: LIGHT,
    nivel: NIVEL,
    versao,
    contexto: 'ctx',
    atualizar: () => ({}) as ReturnType<EntradaDesenho['atualizar']>,
    ...extra,
  });
  /** Roda as tarefas "depois da pintura" que estiverem na fila. */
  const pintar = (): void => void tarefas.splice(0).forEach((f) => f());
  return { q, ativos, pendentes, entrada, pintar, chamadas, slots, pedidos, tarefas };
}

describe('QuadroPlanta: provisório e exato', () => {
  it('sem edição o quadro é exato direto', () => {
    const t = montar();
    expect(t.q.desenhar(t.entrada(1))).toBeNull();
    expect(t.chamadas).toEqual(['update']);
    expect(t.slots).toEqual([]);
  });

  it('editar uma parede: o quadro seguinte sai provisório (sem exato) e o exato vem depois da pintura', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1)); // exato da versão 1
    t.chamadas.length = 0;
    editar(t.ativos, 2, 0, 1);
    const extra = t.q.desenhar(t.entrada(2));
    // Mesmo quadro da edição: só a sobreposição provisória, sem recalcular a geometria exata.
    expect(t.chamadas).toEqual([]);
    expect(extra).not.toBeNull();
    expect(extra!.fills.length).toBeGreaterThan(0);
    expect(t.slots.map((s) => s.slot)).toEqual(['fillsOver', 'strokesOver']);
    expect(t.slots[0]!.fills).toBe(extra!.fills.length);
    expect(t.tarefas).toHaveLength(1);
    // Depois da pintura: pede novo quadro, que sai exato e limpa a base para o provisório não voltar.
    t.pintar();
    expect(t.pedidos).toHaveLength(1);
    expect(t.q.desenhar(t.entrada(2))).toBeNull();
    expect(t.chamadas).toEqual(['update']);
    expect(t.q.modo(NIVEL, 2, 'ctx')).toBe('exato');
  });

  it('o exato do fluxo chegar antes da hora não deixa o provisório preso: versão já desenhada é exata', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1));
    editar(t.ativos, 2, 0, 1);
    t.q.desenhar(t.entrada(2));
    t.pintar();
    t.q.desenhar(t.entrada(2));
    // O provisório ainda está no fluxo (o exato dele não chegou), mas a planta já tem o exato da versão 2.
    expect(t.ativos.doNivel(NIVEL)).not.toEqual([]);
    expect(t.q.modo(NIVEL, 2, 'ctx')).toBe('exato');
  });

  it('edição nova antes do exato: o provisório redesenha com a versão nova e a velha não volta', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1));
    editar(t.ativos, 2, 0, 1);
    t.q.desenhar(t.entrada(2));
    editar(t.ativos, 3, 1, 2);
    const extra = t.q.desenhar(t.entrada(3));
    expect(t.tarefas).toHaveLength(1); // um pedido de exato só
    // O apagador é o contorno do último exato (x0 = 0); o desenho, o da edição mais nova (x0 = 2).
    const xs = extra!.fills.flatMap((f) => f.polygons.flatMap((p) => p.flatMap((a) => a.map((pt) => pt.x))));
    expect(Math.min(...extra!.fills[0]!.polygons.flatMap((p) => p.flatMap((a) => a.map((pt) => pt.x))))).toBe(0);
    expect(Math.max(...xs)).toBe(6);
    expect(Math.min(...extra!.fills.at(-1)!.polygons.flatMap((p) => p.flatMap((a) => a.map((pt) => pt.x))))).toBe(2);
  });

  it('muda o contexto (tema, zoom, GPU) ou o nível: exato direto, sem provisório', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1));
    editar(t.ativos, 2, 0, 1);
    expect(t.q.modo(NIVEL, 2, 'outro')).toBe('exato');
    expect(t.q.modo('n2', 2, 'ctx')).toBe('exato');
    expect(t.q.modo(NIVEL, 2, 'ctx')).toBe('provisorio');
  });

  it('provisório sem contorno (escada, ambiente) não adia o exato', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1));
    t.ativos.aplicar({
      tipo: 'provisorio',
      versao: 2,
      alteracao: { versao: 2, versaoAnterior: 1, adicionados: [], alterados: ['e'], removidos: [], niveis: new Set([NIVEL]) },
      patches: [{ nivel: NIVEL, versao: 2, elementos: [{ ...parede('e', 0), kind: 'stair', geometria: empacotarAnel([]), caixa: new Float64Array(4) }], removidos: [] }],
    });
    expect(t.q.modo(NIVEL, 2, 'ctx')).toBe('exato');
  });

  it('invalidar esquece a base (saiu da planta): o próximo quadro é exato', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1));
    editar(t.ativos, 2, 0, 1);
    t.q.invalidar();
    expect(t.q.modo(NIVEL, 2, 'ctx')).toBe('exato');
  });

  it('no modo CPU (sem cena) o provisório sai na lista de desenho', () => {
    const t = montar();
    t.q.desenhar(t.entrada(1, { cena: null }));
    editar(t.ativos, 2, 0, 1);
    const extra = t.q.desenhar(t.entrada(2, { cena: null }));
    const base: PlanDrawList = { background: LIGHT.bg, fills: [], strokes: [], labels: [] };
    const lista = QuadroPlanta.comProvisorio(base, extra);
    expect(lista.fills).toHaveLength(extra!.fills.length);
    expect(lista.strokes).toHaveLength(extra!.strokes.length);
    expect(QuadroPlanta.comProvisorio(base, null)).toBe(base);
  });
});

describe('QuadroPlanta: referências assíncronas', () => {
  it('referência que veio do exato antigo refaz a planta por inteiro quando o novo chega', () => {
    const t = montar();
    // A planta pede o pavimento de baixo ao montar a geometria (dentro de `atualizar`).
    const usaReferencia = (): EntradaDesenho => t.entrada(1, { atualizar: () => (t.q.resolver('abaixo'), {}) as ReturnType<EntradaDesenho['atualizar']> });
    t.pendentes.add('abaixo');
    t.q.desenhar(usaReferencia());
    t.q.desenhar(usaReferencia());
    expect(t.chamadas).toEqual(['update', 'update']); // ainda pendente: não refaz
    t.chamadas.length = 0;
    t.pendentes.delete('abaixo'); // o exato novo chegou
    t.q.desenhar(usaReferencia());
    expect(t.chamadas).toEqual(['reset', 'update']);
    t.chamadas.length = 0;
    t.q.desenhar(usaReferencia());
    expect(t.chamadas).toEqual(['update']); // só uma vez
  });
});
