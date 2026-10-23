import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { buildTemplate, isWall, type Project } from '@hestia/model';
import { resolveFloors } from './floors.ts';
import { resolveLevel } from './resolve.ts';
import { resolveSlabs } from './slabs.ts';
import { computeSection } from './section.ts';

/**
 * Estabilidade do exemplo "Prédio, 10 pavimentos" (template `predio10`): 10 níveis de 2,80 m, núcleo de 6 × 4 m no
 * centro, quatro unidades por andar. As invariantes aqui são o que precisa valer em qualquer pavimento: mesma contagem,
 * mesma geometria, paredes sem anexo e lajes/pisos parando no núcleo.
 */
const p: Project = buildTemplate('predio10');
const niveis = Array.from({ length: 10 }, (_, i) => `lv_${i}`);
const area = (m: Parameters<typeof multiArea>[0]): number => multiArea(m);
const contorno = (l: { polygon: Parameters<typeof multiArea>[0] }): number => area(l.polygon);

describe('prédio de 10 pavimentos: estrutura do projeto', () => {
  it('10 níveis, de 2,80 em 2,80 m (0 a 25,20 m)', () => {
    expect(p.levels).toHaveLength(10);
    p.levels.forEach((l, i) => expect(l.elevation).toBeCloseTo(i * 2.8, 9));
    expect(p.levels[9]!.elevation).toBeCloseTo(25.2, 9);
  });

  it('todo pavimento tem as mesmas 8 paredes (4 externas + 4 do núcleo) e 4 unidades', () => {
    for (const nivel of niveis) {
      const walls = Object.values(p.elements).filter((e) => isWall(e) && e.levelId === nivel);
      const floors = Object.values(p.elements).filter((e) => e.kind === 'floor' && e.levelId === nivel);
      expect(walls, `${nivel}: paredes`).toHaveLength(8);
      expect(floors, `${nivel}: unidades`).toHaveLength(4);
    }
  });

  it('nenhuma parede anexada ao piso (o padrão é desanexado) e nenhum topo acima da cobertura', () => {
    for (const e of Object.values(p.elements)) {
      if (!isWall(e)) continue;
      expect(e.attachTopToFloor, `${e.id}: topo anexado`).toBe(false);
      expect(e.attachBottomToFloor, `${e.id}: base anexada`).toBe(false);
      const z = resolveLevel(p, e.levelId).walls[e.id]!;
      const topo = Math.max(...z.layers.flatMap((l) => l.bands.map((b) => z.baseZ + b.z1)));
      expect(topo, `${e.id}: topo`).toBeLessThanOrEqual(28 + 1e-6);
    }
  });

  it('o topo das paredes de cada pavimento chega ao topo da laje de cima', () => {
    for (let i = 0; i < 9; i++) {
      const r = resolveLevel(p, niveis[i]!);
      for (const w of Object.values(r.walls)) {
        const topo = Math.max(...w.layers.flatMap((l) => l.bands.map((b) => w.baseZ + b.z1)));
        expect(topo, `${w.wallId}: topo`).toBeCloseTo((i + 1) * 2.8, 6);
      }
    }
  });
});

describe('prédio de 10 pavimentos: lajes e pisos param no núcleo', () => {
  it('a estrutura da laje é a mesma em todos os pavimentos e para antes do contorno', () => {
    const comLaje = niveis.slice(1);
    const areas = comLaje.map((nivel) => {
      const s = resolveSlabs(p, nivel)[0]!;
      return { contorno: contorno(s), concreto: area(s.layers[1]!.polygon), acabamento: area(s.layers[0]!.polygon) };
    });
    for (const a of areas) {
      expect(a.concreto).toBeCloseTo(areas[0]!.concreto, 6);
      expect(a.acabamento).toBeCloseTo(areas[0]!.acabamento, 6);
      // estrutura para na face externa do núcleo; acabamento para na face interna dele
      expect(a.concreto).toBeLessThan(a.contorno - 1e-6);
      expect(a.acabamento).toBeLessThan(a.concreto - 1e-6);
    }
    // 10 lajes: 9 de pavimento + a de cobertura
    expect(p.elements['PD-COB']!.kind).toBe('slab');
  });

  it('as quatro unidades somam menos que a laje (o núcleo não é piso) e são iguais em todos os pavimentos', () => {
    const porNivel = niveis.map((nivel) => {
      const fs = resolveFloors(p, nivel);
      expect(fs, `${nivel}: unidades`).toHaveLength(4);
      const soma = fs.reduce((s, f) => s + area(f.layers[2]!.polygon), 0);
      for (const f of fs) expect(area(f.layers[0]!.polygon)).toBeLessThan(area(f.layers[2]!.polygon) - 1e-6);
      return soma;
    });
    for (const soma of porNivel) expect(soma).toBeCloseTo(porNivel[0]!, 6);
    const laje = resolveSlabs(p, 'lv_1')[0]!;
    expect(porNivel[0]!).toBeLessThan(area(laje.layers[1]!.polygon) - 1e-6);
  });
});

describe('prédio de 10 pavimentos: cortes', () => {
  it('o corte AA atravessa os 10 pavimentos, de 0 a 28 m', () => {    const r = computeSection(p, { a: { x: 10, y: -2 }, b: { x: 10, y: 14 }, depth: 16 });
    // o piso do térreo tem 0,15 m de camadas abaixo da cota 0, então o corte começa um pouco abaixo de zero
    expect(r.zMin).toBeCloseTo(-0.15, 6);
    expect(r.zMax).toBeGreaterThan(27.9);
    // há material cortado em cada faixa de 2,80 m (um pavimento por faixa)
    for (let i = 0; i < 10; i++) {
      const z = i * 2.8 + 1.4;
      const noNivel = r.cut.filter((c) => (c.parts ?? []).some((q) => q.polygons.length > 0 && q.polygons.some(() => true))).length;
      expect(noNivel, `faixa ${i}`).toBeGreaterThan(0);
      expect(z).toBeLessThan(28);
    }
  }, 60000);

  it('o corte BB (transversal) corta as paredes externas e as do núcleo', () => {
    const r = computeSection(p, { a: { x: -2, y: 6 }, b: { x: 22, y: 6 }, depth: 16 });
    const paredes = new Set(r.cut.flatMap((c) => (c.parts ?? []).map((q) => q.origin.wallId).filter((id): id is string => Boolean(id))));
    expect(paredes.size).toBeGreaterThanOrEqual(4);
    expect([...paredes].some((id) => id.endsWith('-EXT-o'))).toBe(true);
    expect([...paredes].some((id) => id.endsWith('-NUC-o'))).toBe(true);
  }, 60000);
});
