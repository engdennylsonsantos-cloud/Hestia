import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { arestasDasCaixas, criarCaixaUnitaria, folgaEntreCaixas, geometriaDeCaixas, INDICES_POR_CAIXA, matrizDaCaixa, retanguloDoAnel, type CaixaPlanta } from './caixas3d.ts';
import { faixasDosIds } from './caixasDoNivel3d.ts';

const anel = (...p: Array<[number, number]>) => p.map(([x, y]) => ({ x, y }));

describe('matrizDaCaixa', () => {
  it('leva a caixa unitária ao mesmo lugar que centro · giro · escala do three', () => {
    const m = matrizDaCaixa(1, 2, 3, 0.7, 4, 0.2, 2.8);
    const ref = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7), new THREE.Vector3(4, 0.2, 2.8));
    m.forEach((x, i) => expect(x).toBeCloseTo(ref.elements[i]!, 12));
  });
});

describe('retanguloDoAnel', () => {
  it('lê um retângulo em qualquer sentido, giro e canto inicial', () => {
    const r = retanguloDoAnel(anel([0, 0], [4, 0], [4, 0.14], [0, 0.14]))!;
    expect([r.cx, r.cy, r.w, r.d]).toEqual([2, 0.07, 4, 0.14]);
    const horario = retanguloDoAnel(anel([0, 0], [0, 0.14], [4, 0.14], [4, 0]))!;
    expect(horario.w).toBeCloseTo(0.14, 12);
    expect(horario.d).toBeCloseTo(4, 12);
    const c = Math.cos(0.5);
    const s = Math.sin(0.5);
    const rot = retanguloDoAnel(anel([0, 0], [4 * c, 4 * s], [4 * c - 0.2 * s, 4 * s + 0.2 * c], [-0.2 * s, 0.2 * c]))!;
    expect(rot.ang).toBeCloseTo(0.5, 12);
    expect([rot.w, rot.d].map((x) => +x.toFixed(9))).toEqual([4, 0.2]);
  });

  it('ignora vértices repetidos ou colineares no meio dos lados', () => {
    const r = retanguloDoAnel(anel([0, 0], [2, 0], [4, 0], [4, 1], [4, 1], [0, 1]))!;
    expect([r.w, r.d]).toEqual([4, 1]);
  });

  it('recusa trapézio, triângulo, paralelogramo e peça fina demais', () => {
    expect(retanguloDoAnel(anel([0, 0], [4, 0], [3.9, 1], [0, 1]))).toBeNull();
    expect(retanguloDoAnel(anel([0, 0], [4, 0], [0, 1]))).toBeNull();
    expect(retanguloDoAnel(anel([0, 0], [4, 0], [4.5, 1], [0.5, 1]))).toBeNull();
    expect(retanguloDoAnel(anel([0, 0], [4, 0], [4, 5e-5], [0, 5e-5]))).toBeNull();
  });
});

describe('folgaEntreCaixas', () => {
  const caixa = (cx: number, z0 = 0, ang = 0): CaixaPlanta => ({ cx, cy: 0, ang, w: 1, d: 0.2, z0, h: 1 });
  it('positiva se separadas, zero se encostadas, negativa se uma entra na outra', () => {
    expect(folgaEntreCaixas(caixa(0), caixa(3))).toBeCloseTo(2, 12);
    expect(folgaEntreCaixas(caixa(0), caixa(1))).toBeCloseTo(0, 12);
    // A penetração é a menor sobreposição entre os eixos: aqui a espessura (0,2), não o deslocamento em x.
    expect(folgaEntreCaixas(caixa(0), caixa(0.5))).toBeCloseTo(-0.2, 12);
  });
  it('conta a cota: caixas empilhadas encostam, e a separação vertical vale', () => {
    expect(folgaEntreCaixas(caixa(0), caixa(0, 1))).toBeCloseTo(0, 12);
    expect(folgaEntreCaixas(caixa(0), caixa(0, 3))).toBeCloseTo(2, 12);
  });
  it('funciona com giro: duas caixas giradas lado a lado', () => {
    const a = caixa(0, 0, 0.6);
    const b: CaixaPlanta = { ...a, cx: Math.cos(0.6), cy: Math.sin(0.6) };
    expect(folgaEntreCaixas(a, b)).toBeCloseTo(0, 9);
  });
});

describe('arestas e geometria de picking das caixas', () => {
  it('cada caixa dá 12 arestas, todas nos cantos da caixa', () => {
    const m = matrizDaCaixa(5, 6, 1, 0.3, 2, 0.5, 2);
    const out: number[] = [];
    arestasDasCaixas(m, out);
    expect(out).toHaveLength(12 * 6);
    const caixa = new THREE.Box3().setFromPoints(Array.from({ length: 24 }, (_, i) => new THREE.Vector3(out[i * 3], out[i * 3 + 1], out[i * 3 + 2])));
    expect(caixa.min.z).toBeCloseTo(0, 12);
    expect(caixa.max.z).toBeCloseTo(2, 12);
  });

  it('a geometria de picking tem 36 índices por caixa, volume igual ao da caixa e faces para fora', () => {
    const ms = [...matrizDaCaixa(0, 0, 1, 0.4, 3, 0.2, 2), ...matrizDaCaixa(10, 0, 1, 0, 1, 1, 2)];
    const g = geometriaDeCaixas(ms);
    expect(g.index!.count).toBe(2 * INDICES_POR_CAIXA);
    const pos = g.getAttribute('position');
    const idx = g.index!;
    let vol = 0;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let t = 0; t < idx.count; t += 3) {
      for (let k = 0; k < 3; k++) v[k]!.fromBufferAttribute(pos, idx.getX(t + k));
      vol += v[0]!.dot(new THREE.Vector3().crossVectors(v[1]!, v[2]!)) / 6;
    }
    expect(vol).toBeCloseTo(3 * 0.2 * 2 + 2, 5);
  });

  it('a caixa unitária tem lado 1 e centro na origem', () => {
    const g = criarCaixaUnitaria();
    g.computeBoundingBox();
    expect(g.boundingBox!.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
    expect(g.boundingBox!.max.toArray()).toEqual([0.5, 0.5, 0.5]);
  });

  it('faixasDosIds: caixas seguidas do mesmo elemento viram uma faixa só', () => {
    expect(faixasDosIds(['a', 'a', 'b', 'a'])).toEqual([
      { id: 'a', start: 0, count: 72 },
      { id: 'b', start: 72, count: 36 },
      { id: 'a', start: 108, count: 36 },
    ]);
  });
});
