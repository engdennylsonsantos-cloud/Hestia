import { describe, expect, it } from 'vitest';
import { resolveRoofs, type ResolvedRoof } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof, type Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { roofOps } from './roofs.ts';
import { corDaAresta, TONE_45, tomDaAgua } from './roofsAgua.ts';
import { DARK, LIGHT, type PlanTheme } from './types.ts';

const P = (x: number, y: number) => ({ x, y });
const VIEW: Viewport = { cx: 4, cy: 3, zoom: 100, width: 800, height: 600 };
const BASE = '#b5522d';
const LAYERS = [{ layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 }];

/** Telhado de uma água com a subida `up` e a inclinação `percent`, para isolar o tom. */
function agua(up: { x: number; y: number }, percent: number): ResolvedRoof {
  return {
    roofId: 'r',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: 2.8,
    joinedArea: 0,
    layers: LAYERS,
    planes: [{ polygon: [[[P(0, 0), P(8, 0), P(8, 3), P(0, 3)]]], origin: P(0, 0), up, percent, z0: 2.8 }],
    lines: [],
  };
}

/** Cor da água desenhada na planta para o `up` e a inclinação dados, no tema pedido. */
function corDaAgua(theme: PlanTheme, dark: boolean, up: { x: number; y: number }, percent: number, p: Project = createEmptyProject()): string {
  return roofOps([agua(up, percent)], p, theme, dark, 'medium', VIEW).fills[0]!.color;
}

/** Projeto com o material da telha sem cor (mas com a hachura). */
function semCorDeTelha(): Project {
  const p = createEmptyProject();
  return { ...p, materials: { ...p.materials, mat_telha_ceramica: { ...p.materials.mat_telha_ceramica!, color: '' } } };
}

/** Projeto sem o material da telha: o tipo continua apontando para ele, e a planta cai no `roofTile`. */
function semMaterialDeTelha(): Project {
  const p = createEmptyProject();
  const materiais = { ...p.materials };
  Reflect.deleteProperty(materiais, 'mat_telha_ceramica');
  return { ...p, materials: materiais };
}

describe('tomDaAgua: luz fixa de noroeste e inclinação', () => {
  it('água plana fica com a cor base pura', () => {
    expect(tomDaAgua(BASE, P(0, 1), 0)).toBe(BASE);
    expect(tomDaAgua(BASE, P(1, 0), 0)).toBe(BASE);
    expect(tomDaAgua(BASE, P(0, -1), 0)).toBe(BASE);
  });

  it('a 45° com a queda voltada para a luz clareia e na direção oposta escurece em cerca de 14 %', () => {
    expect(tomDaAgua(BASE, P(Math.SQRT1_2, -Math.SQRT1_2), 100)).toBe(mix(BASE, '#ffffff', TONE_45));
    expect(tomDaAgua(BASE, P(-Math.SQRT1_2, Math.SQRT1_2), 100)).toBe(mix(BASE, '#000000', TONE_45));
  });

  it('as quatro orientações de 45°: queda para norte e oeste clareia; para sul e leste escurece', () => {
    // `up` aponta para o lado alto; a queda é o sentido oposto.
    const desceSul = tomDaAgua(BASE, P(0, 1), 100);
    const desceNorte = tomDaAgua(BASE, P(0, -1), 100);
    const desceLeste = tomDaAgua(BASE, P(-1, 0), 100);
    const desceOeste = tomDaAgua(BASE, P(1, 0), 100);
    const passo = TONE_45 * Math.SQRT1_2;
    expect(desceNorte).toBe(mix(BASE, '#ffffff', passo));
    expect(desceOeste).toBe(mix(BASE, '#ffffff', passo));
    expect(desceSul).toBe(mix(BASE, '#000000', passo));
    expect(desceLeste).toBe(mix(BASE, '#000000', passo));
  });

  it('a variação cresce com a inclinação: 45° mais forte que 30 % e água plana sem variação', () => {
    const plano = tomDaAgua(BASE, P(0, 1), 0);
    const trinta = tomDaAgua(BASE, P(0, 1), 30);
    const quarentaCinco = tomDaAgua(BASE, P(0, 1), 100);
    expect(plano).toBe(BASE);
    expect(trinta).not.toBe(BASE);
    expect(quarentaCinco).not.toBe(trinta);
  });

  it('a cor da aresta interna é um pouco mais escura que o preenchimento', () => {
    const fill = mix(BASE, '#ffffff', 0.5);
    expect(corDaAresta(fill)).toBe(mix(fill, '#000000', 0.38));
  });
});

describe('cor e hachura do material do tipo de telhado', () => {
  it('usa a cor do material quando existe', () => {
    const p = createEmptyProject();
    expect(p.materials.mat_telha_ceramica!.color).toBe(BASE);
    expect(corDaAgua(LIGHT, false, P(0, 1), 30)).toBe(tomDaAgua(mix(BASE, '#ffffff', 0.25), P(0, 1), 30));
  });

  it('sem cor no material, cai no token roofTile nos dois temas', () => {
    const p = semCorDeTelha();
    expect(corDaAgua(LIGHT, false, P(0, 1), 30, p)).toBe(tomDaAgua(mix(LIGHT.roofTile, '#ffffff', 0.25), P(0, 1), 30));
    expect(corDaAgua(DARK, true, P(0, 1), 30, p)).toBe(tomDaAgua(mix(DARK.roofTile, DARK.bg, 0.2), P(0, 1), 30));
    expect(LIGHT.roofTile).toBe('#c9795a');
    expect(DARK.roofTile).toBe('#8a4f3b');
  });

  it('sem material, cai no roofTile e não há hachura', () => {
    const p = semMaterialDeTelha();
    expect(corDaAgua(LIGHT, false, P(0, 1), 30, p)).toBe(tomDaAgua(mix(LIGHT.roofTile, '#ffffff', 0.25), P(0, 1), 30));
    expect(roofOps([agua(P(0, 1), 30)], p, LIGHT, false, 'medium', VIEW).fills[0]!.hatch).toBeUndefined();
  });

  it('material com hachura continua com o padrão de planta', () => {
    expect(roofOps([agua(P(0, 1), 30)], createEmptyProject(), LIGHT, false, 'medium', VIEW).fills[0]!.hatch?.kind).toBe('diagonal');
  });
});

describe('telhado real: tom por água e rincão tracejado', () => {
  it('duas águas reais leem com tons diferentes e o rincão fica tracejado na cor da aresta', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addRoof',
      roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 6.3), P(-0.3, 6.3)], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }),
    });
    const p = s.project;
    const [r] = resolveRoofs(p, 'lv_0');
    const base = mix(BASE, '#ffffff', 0.25);
    const ops = roofOps([r!], p, LIGHT, false, 'medium', VIEW);
    expect(ops.fills.some((f) => f.color === tomDaAgua(base, r!.planes[0]!.up, 30) && f.alpha === 0.55)).toBe(true);
    expect(ops.fills.some((f) => f.color === tomDaAgua(base, r!.planes[1]!.up, 30) && f.alpha === 0.55)).toBe(true);
    // O telhado de duas águas não tem rincão: acrescenta-se um para conferir o tracejado da aresta.
    const comRincao: ResolvedRoof = { ...r!, lines: [...r!.lines, { kind: 'valley', a: P(0, 0), b: P(1, 1) }] };
    const valley = roofOps([comRincao], p, LIGHT, false, 'medium', VIEW).strokes.find((st) => st.dash && st.pts[0]!.x === 0 && st.pts[0]!.y === 0);
    expect(valley?.dash).toEqual([6, 3]);
    expect(valley?.color).toBe(corDaAresta(base));
  });
});
