import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeRoof, makeSlab, makeWall, view3dOf, type Id, type Project } from '@hestia/model';
import { projetoDaJuncao } from '../plan/viewContext.ts';
import { ModelScene } from './scene3d.ts';

/** Contorno de 4 × 3 m de cada pavimento. */
const CAIXA = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

/** Tipo de anexo das paredes: sem anexo, anexadas ao piso (base e topo) ou só uma parede anexada ao telhado. */
type Anexo = 'nenhum' | 'piso' | 'telhado';

/**
 * Prédio de `n` pavimentos (cota de 3 m): cada um com 4 paredes de contorno e uma divisória, piso e laje; cobertura no topo.
 * `anexo` põe as paredes de contorno presas ao piso (base e topo, com o nível de cima como topo) ou uma parede do último
 * pavimento presa ao telhado.
 */
function predio(n: number, anexo: Anexo): Project {
  const s = new ProjectStore(createEmptyProject());
  const ids: Id[] = Array.from({ length: n }, (_, i) => `lv_${i}`);
  ids.forEach((id, i) => s.exec({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) }));
  const lados = [
    [CAIXA[0]!, CAIXA[1]!],
    [CAIXA[1]!, CAIXA[2]!],
    [CAIXA[2]!, CAIXA[3]!],
    [CAIXA[3]!, CAIXA[0]!],
    [{ x: 2, y: 0 }, { x: 2, y: 3 }],
  ] as const;
  ids.forEach((levelId, i) => {
    const acima = ids[i + 1] ?? null;
    lados.forEach(([a, b], j) => {
      const contorno = j < 4;
      const presa = anexo === 'piso' && contorno ? { attachBottomToFloor: true, attachTopToFloor: true, topLevelId: acima } : {};
      const noTelhado = anexo === 'telhado' && i === n - 1 && j === 0 ? { attachTopToRoof: true } : {};
      s.exec({ type: 'addWall', wall: makeWall({ id: `w_${i}_${j}`, typeId: 'wt_alv14', levelId, a, b, ...presa, ...noTelhado }) });
    });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: `f_${i}`, typeId: 'ft_ceram', levelId, boundary: CAIXA }) });
    s.exec({ type: 'addSlab', slab: makeSlab({ id: `s_${i}`, typeId: 'ls_mac12', levelId, boundary: CAIXA }) });
  });
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: ids[n - 1]!, boundary: CAIXA, shape: 'gable', slopePercent: 30 }) });
  return s.project;
}

/** Monta a cena do projeto; `reduzirJuncao` escolhe a junção reduzida (padrão) ou a do projeto inteiro (referência). */
function montar(p: Project, reduzirJuncao: boolean, style: 'realistic' | 'wireframe'): ModelScene {
  const ms = new ModelScene({ reduzirJuncao });
  const pv: Project = { ...p, view3d: { ...view3dOf(p), style } };
  const niveis: ResolvedLevel[] = pv.levels.map((l) => resolveLevel(pv, l.id));
  ms.update(pv, niveis, { edges: true, shadows: false, dark: false });
  return ms;
}

/**
 * Assinatura da cena: uma linha por malha (modelo e picking), com as posições exatas, a categoria, as faixas de elemento e a
 * matriz. Em wireframe as malhas de picking ficam em `pickLayer`, que também está na cena: a varredura as alcança.
 */
function assinatura(ms: ModelScene): string[] {
  const out: string[] = [];
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.ranges === undefined) return;
    const pos = o.geometry.getAttribute('position');
    const valores: number[] = [];
    for (let i = 0; i < pos.count * pos.itemSize; i++) valores.push(pos.array[i] ?? NaN);
    out.push(`${String(o.userData.kind)}|${JSON.stringify(o.userData.ranges)}|${o.matrix.elements.join(',')}|${valores.join(',')}`);
  });
  return out;
}

describe('junção reduzida na 3D: mesma cena que a do projeto inteiro', () => {
  const casos: Array<[number, Anexo]> = [
    [10, 'nenhum'],
    [10, 'piso'],
    [10, 'telhado'],
    [20, 'nenhum'],
    [20, 'piso'],
    [20, 'telhado'],
  ];
  for (const [n, anexo] of casos) {
    for (const style of ['realistic', 'wireframe'] as const) {
      it(`${n} pavimentos, anexo ${anexo}, estilo ${style}: malhas, posições e faixas de picking iguais`, { timeout: 120000 }, () => {
        const p = predio(n, anexo);
        const reduzida = montar(p, true, style);
        const referencia = montar(p, false, style);
        const sig = assinatura(reduzida);
        expect(sig.length).toBeGreaterThan(0);
        expect(sig).toEqual(assinatura(referencia));
      });
    }
  }

  it('o caso de 20 pavimentos sem anexo reduz de fato a junção (senão a igualdade seria trivial)', () => {
    const p = predio(20, 'nenhum');
    expect(projetoDaJuncao(p, 'lv_10').levels.length).toBeLessThan(p.levels.length);
  });
});
