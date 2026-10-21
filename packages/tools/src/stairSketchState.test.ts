import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import type { StairCurve } from '@hestia/model';
import { analyzeDraft, counterText, desiredRisers, partsFromComponents, componentsFromParts, type StairPart } from './stairSketchState.ts';
import { chainEnd, emptyStroke, strokeClick, strokeUndo, typedPoint } from './stairStroke.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (a: Vec2, b: Vec2): StairCurve => ({ a, b, sag: 0 });
const LIM = { H: 3, maxRiser: 0.18, minRunWidth: 0.8 };

/** Lance reto de 5 m, limites em y = ±0,5, espelhos verticais em `xs` (de y = −1 a 1). */
function run(xs: number[], w = 1): StairPart {
  return {
    kind: 'run',
    run: {
      boundaryLeft: [ln(v(-0.5, w / 2), v(5, w / 2))],
      boundaryRight: [ln(v(-0.5, -w / 2), v(5, -w / 2))],
      risers: xs.map((x) => ln(v(x, -1), v(x, 1))),
      path: [],
    },
  };
}

describe('nº desejado de espelhos', () => {
  it('é ceil(H ÷ espelho máximo), sem falhar por ponto flutuante (2,8 ÷ 0,175 = 16)', () => {
    expect(desiredRisers(2.8, 0.175)).toBe(16);
    expect(desiredRisers(3, 0.18)).toBe(17);
    expect(desiredRisers(0, 0.18)).toBe(0);
    expect(desiredRisers(3, 0)).toBe(0);
  });
});

describe('análise do croqui', () => {
  it('lance completo e válido: sem erro, contador "criados / restantes"', () => {
    const rep = analyzeDraft([run([0, 1, 2])], LIM);
    expect(rep.errors).toBe(0);
    expect(rep.canFinish).toBe(true);
    expect(rep.created).toBe(3);
    expect(rep.desired).toBe(17);
    expect(rep.remaining).toBe(14);
    expect(counterText(rep)).toBe('Espelhos: 3 criados, 14 restantes');
  });

  it('contador com espelho a mais mostra "a mais"', () => {
    const rep = analyzeDraft([run(Array.from({ length: 18 }, (_, i) => i * 0.1))], LIM);
    expect(counterText(rep)).toMatch(/1 a mais/);
  });

  it('sem limites: erro de completude, sem espelhos: erro, nada desenhado: "Desenhe os limites do lance."', () => {
    expect(analyzeDraft([], LIM).firstError).toBe('Desenhe os limites do lance.');
    const semDireito: StairPart = { kind: 'run', run: { boundaryLeft: [ln(v(0, 0.5), v(5, 0.5))], boundaryRight: [], risers: [], path: [] } };
    expect(analyzeDraft([semDireito], LIM).firstError).toBe('Desenhe o limite direito do lance.');
    const semEspelho: StairPart = { kind: 'run', run: { boundaryLeft: [ln(v(0, 0.5), v(5, 0.5))], boundaryRight: [ln(v(0, -0.5), v(5, -0.5))], risers: [], path: [] } };
    expect(analyzeDraft([semEspelho], LIM).firstError).toBe('Desenhe os espelhos.');
  });

  it('limites que se tocam são erro de geometria e impedem concluir', () => {
    const toca: StairPart = { kind: 'run', run: { boundaryLeft: [ln(v(0, 0.5), v(5, 0.5))], boundaryRight: [ln(v(0, 0.5), v(5, 0.5))], risers: [ln(v(1, -1), v(1, 1))], path: [] } };
    const rep = analyzeDraft([toca], LIM);
    expect(rep.firstError).toBe('Os limites esquerdo e direito do lance não podem se tocar.');
    expect(rep.canFinish).toBe(false);
  });

  it('altura real acima do espelho máximo é aviso, não erro', () => {
    const rep = analyzeDraft([run([0, 1])], LIM);
    const alt = rep.issues.find((i) => i.code === 'stair-riser-too-high');
    expect(alt?.severity).toBe('warning');
    expect(alt?.message).toMatch(/1,500 m\) excede a máxima do tipo \(0,180 m\)/);
    expect(rep.canFinish).toBe(true);
  });

  it('nº de espelhos diferente do desejado é aviso', () => {
    const rep = analyzeDraft([run([0, 1, 2])], LIM);
    const c = rep.issues.find((i) => i.code === 'stair-risers-count');
    expect(c?.severity).toBe('warning');
    expect(c?.message).toMatch(/O nº de espelhos \(3\) difere do nº desejado \(17\)/);
  });

  it('largura do lance abaixo do mínimo do tipo é aviso (menor espelho aparado)', () => {
    const rep = analyzeDraft([run([0, 1, 2], 0.6)], { ...LIM, minRunWidth: 0.8 });
    const w = rep.issues.find((i) => i.code === 'stair-width-min');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toMatch(/0,600 m\)/);
  });

  it('patamar aberto é erro com a mensagem da decisão 0011', () => {
    const aberto: StairPart = { kind: 'landing', landing: { boundary: [ln(v(0, 0), v(1, 0)), ln(v(1, 0), v(1, 1))] } };
    expect(analyzeDraft([run([0, 1]), aberto], LIM).firstError).toBe('O contorno do patamar deve ser um laço fechado.');
  });

  it('sem tipo (limites nulos): só a geometria é avaliada, sem avisos de norma', () => {
    const rep = analyzeDraft([run([0, 1, 2])], null);
    expect(rep.issues.filter((i) => i.severity === 'warning')).toEqual([]);
    expect(rep.desired).toBe(0);
  });
});

describe('conversão rascunho ↔ componentes', () => {
  it('preserva ids e ordem; copia (não compartilha) os arrays', () => {
    const comps = componentsFromParts([run([0]), { kind: 'landing', landing: { id: 'p_x', boundary: [ln(v(0, 0), v(1, 0))] } }]);
    const parts = partsFromComponents(comps);
    expect(parts.map((p) => p.kind)).toEqual(['run', 'landing']);
    const again = componentsFromParts(parts);
    expect(again[1]!.id).toBe('p_x');
    expect(again[0]!.kind).toBe('run');
    if (parts[0]!.kind === 'run') expect(parts[0]!.run.risers).not.toBe((comps[0] as { risers: StairCurve[] }).risers);
  });
});

describe('traçado: linha encadeada e arco', () => {
  it('linha: o 1º clique fixa o início, cada clique seguinte fecha um segmento', () => {
    let s = emptyStroke('line');
    s = strokeClick(s, v(0, 0), true).next;
    const r = strokeClick(s, v(2, 0), true);
    expect(r.event.kind).toBe('segment');
    expect(r.next.chain).toHaveLength(1);
    expect(chainEnd(r.next)).toEqual(v(2, 0));
  });

  it('arco: início, fim e flecha dão um segmento com sag positivo à esquerda de a→b', () => {
    let s = emptyStroke('arc');
    s = strokeClick(s, v(0, 0), false).next;
    s = strokeClick(s, v(4, 0), false).next;
    const r = strokeClick(s, v(2, 1), false);
    expect(r.event.kind).toBe('segment');
    if (r.event.kind === 'segment') expect(r.event.curve.sag).toBeCloseTo(1, 9);
  });

  it('arco com flecha sobre a corda é recusado', () => {
    let s = emptyStroke('arc');
    s = strokeClick(s, v(0, 0), false).next;
    s = strokeClick(s, v(4, 0), false).next;
    expect(strokeClick(s, v(2, 0), false).event.kind).toBe('reject');
  });

  it('desfazer: o último segmento da cadeia sai e o cursor volta ao seu início', () => {
    let s = emptyStroke('line');
    for (const p of [v(0, 0), v(2, 0), v(2, 2)]) s = strokeClick(s, p, true).next;
    s = strokeUndo(s);
    expect(s.chain).toHaveLength(1);
    expect(chainEnd(s)).toEqual(v(2, 0));
  });

  it('entrada numérica: a distância na direção do cursor; sem direção, +x', () => {
    expect(typedPoint(v(1, 1), v(5, 1), 2)).toEqual(v(3, 1));
    const p = typedPoint(v(1, 1), v(1, 1), 2);
    expect(p.x).toBeCloseTo(3, 9);
    expect(p.y).toBeCloseTo(1, 9);
  });
});
