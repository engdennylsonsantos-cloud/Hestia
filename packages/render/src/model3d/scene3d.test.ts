import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { resolveFloors, resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { DEFAULT_OPENING_TYPES, ProjectStore, createEmptyProject, defaultStairTypeId, makeFloor, makeRoof, makeStair, makeWall, type Opening, type OpeningType, type Project, type StairRun, type View3DSettings } from '@hestia/model';
import { mix } from '../plan/color.ts';
import { ModelScene, sunDirection } from './scene3d.ts';
import { buildFloorSolids, buildLevelSolids } from './solids.ts';

const curve = (ax: number, ay: number, bx: number, by: number, sag = 0) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag });
/** Lance reto de 17 espelhos de 0,28 m (cota de 3 m = 0,176 m por espelho, dentro da norma): gera degraus. */
const lanceReto = (): StairRun => {
  const n = 17;
  const sp = 0.28;
  const y0 = 1;
  const y1 = 2;
  return {
    id: 'r1',
    kind: 'run',
    boundaryLeft: [curve(-0.5, y1, (n - 1) * sp + 0.5, y1)],
    boundaryRight: [curve(-0.5, y0, (n - 1) * sp + 0.5, y0)],
    risers: Array.from({ length: n }, (_, k) => curve(k * sp, y0, k * sp, y1)),
    path: [],
  };
};

/** Sala 4 × 3 m: porta na parede a, janela na c e piso. Opcionalmente, telhado e escada (para as categorias). */
function casa(extra: { telhado?: boolean; escada?: boolean } = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const pts = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const lados: Array<[string, number, number]> = [
    ['a', 0, 1],
    ['b', 1, 2],
    ['c', 2, 3],
    ['d', 3, 0],
  ];
  for (const [id, i, j] of lados) {
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: pts[i]!, b: pts[j]! }) });
  }
  const porta: Opening = { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'a', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
  const janela: Opening = { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'c', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
  s.exec({ type: 'addOpening', opening: porta });
  s.exec({ type: 'addOpening', opening: janela });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: 'lv_0', boundary: pts }) });
  if (extra.telhado) s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: pts, heightOffset: 0.2 }) });
  if (extra.escada) s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [lanceReto()] }) });
  return s.project;
}

/** Projeto com a vista 3D dada (campos ausentes valem o padrão de `view3dOf`). */
function comVista(p: Project, view: Partial<View3DSettings>): Project {
  return { ...p, view3d: view as View3DSettings };
}

function niveis(p: Project): ResolvedLevel[] {
  return p.levels.map((l) => resolveLevel(p, l.id));
}

/** Cena montada com a vista de `p` (o `dark` vem do tema, como no app). */
function cena(p: Project, dark = false): ModelScene {
  const ms = new ModelScene();
  ms.update(p, niveis(p), { edges: false, shadows: false, dark });
  return ms;
}

/** Grupo do modelo (o primeiro `Group` filho da cena; luzes, chão e grade não são grupos). */
function modelo(ms: ModelScene): THREE.Group {
  return ms.scene.children.find((c): c is THREE.Group => c instanceof THREE.Group)!;
}

/** Malhas de faces do modelo (sem as linhas). */
function malhas(ms: ModelScene): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  modelo(ms).traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

/** Material de uma malha (um só: as malhas do modelo não usam arrays de materiais). */
const materialOf = (m: THREE.Mesh): THREE.Material => m.material as THREE.Material;

/** Linhas de arestas do modelo. */
function linhas(ms: ModelScene): THREE.LineSegments[] {
  const out: THREE.LineSegments[] = [];
  modelo(ms).traverse((o) => {
    if (o instanceof THREE.LineSegments) out.push(o);
  });
  return out;
}

const luz = (ms: ModelScene): THREE.DirectionalLight => ms.scene.children.find((o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight)!;

/** Nº de lotes de parede do nível (um por material): cada um vira uma malha. */
const lotesParede = (p: Project): number => buildLevelSolids(niveis(p)[0]!).batches.length;

describe('ModelScene: padrão da vista 3D (mesmo resultado de antes)', () => {
  it('a fixture padrão tem 16 malhas, 6 linhas e 10 materiais (9 padrão de superfície e 1 de linha)', () => {
    const ms = cena(casa());
    expect(malhas(ms)).toHaveLength(16);
    expect(linhas(ms)).toHaveLength(6);
    const materiais = new Set<THREE.Material>();
    modelo(ms).traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) materiais.add(m);
    });
    expect(materiais.size).toBe(10);
    const tipos = [...materiais].map((m) => m.type);
    expect(tipos.filter((t) => t === 'MeshStandardMaterial')).toHaveLength(9);
    expect(tipos.filter((t) => t === 'LineBasicMaterial')).toHaveLength(1);
  });

  it('a luz padrão fica na posição de antes: c + r·(0,7; −0,5; 1,1), com r = 8 m nesta fixture', () => {
    const ms = cena(casa());
    const sol = luz(ms);
    const c = sol.target.position;
    expect(sol.position.x).toBeCloseTo(c.x + 8 * 0.7, 1);
    expect(sol.position.y).toBeCloseTo(c.y - 8 * 0.5, 1);
    expect(sol.position.z).toBeCloseTo(c.z + 8 * 1.1, 1);
    expect(sol.castShadow).toBe(true);
  });
});

describe('estilos visuais', () => {
  it('realista: MeshStandardMaterial nas faces, com arestas', () => {
    const ms = cena(casa());
    expect(malhas(ms).every((m) => m.material instanceof THREE.MeshStandardMaterial)).toBe(true);
    expect(linhas(ms)).toHaveLength(6);
  });

  it('sombreado: MeshLambertMaterial nas faces e sem sombras', () => {
    const ms = cena(comVista(casa(), { style: 'shaded' }));
    const faces = malhas(ms);
    expect(faces.length).toBe(16);
    expect(faces.every((m) => m.material instanceof THREE.MeshLambertMaterial)).toBe(true);
    expect(faces.every((m) => !m.castShadow && !m.receiveShadow)).toBe(true);
    expect(luz(ms).castShadow).toBe(false);
  });

  it('cores consistentes: MeshBasicMaterial com a cor do material (sem luz)', () => {
    const p = casa();
    const ms = cena(comVista(p, { style: 'consistentColors' }));
    const faces = malhas(ms);
    expect(faces.every((m) => m.material instanceof THREE.MeshBasicMaterial)).toBe(true);
    const cores = new Set(Object.values(p.materials).map((m) => m.color.toLowerCase().slice(1)));
    expect(faces.every((m) => cores.has((m.material as THREE.MeshBasicMaterial).color.getHexString()))).toBe(true);
  });

  it('linhas ocultas: faces do papel (branco), com polygonOffset, e arestas sempre, mesmo com edges desligado', () => {
    const ms = cena(comVista(casa(), { style: 'hiddenLine', edges: false }));
    const faces = malhas(ms);
    expect(faces).toHaveLength(16);
    for (const m of faces) {
      const mat = m.material as THREE.MeshBasicMaterial;
      expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(mat.color.getHexString()).toBe('ffffff');
      expect(mat.polygonOffset).toBe(true);
    }
    // 6 lotes de sólidos + 10 peças das esquadrias (4 da porta, 6 da janela).
    expect(linhas(ms)).toHaveLength(16);
  });

  it('linhas ocultas no tema escuro: faces cinza escuro e arestas claras', () => {
    const ms = cena(comVista(casa(), { style: 'hiddenLine' }), true);
    expect(malhas(ms).every((m) => (m.material as THREE.MeshBasicMaterial).color.getHexString() === '2a2f36')).toBe(true);
    const cor = (linhas(ms)[0]!.material as THREE.LineBasicMaterial).color.getHex();
    expect(cor).toBe(0xd7dde5);
  });

  it('só arestas: nenhuma malha no modelo, arestas de todas as peças (inclusive as de trás) e chão oculto', () => {
    const ms = cena(comVista(casa(), { style: 'wireframe' }));
    expect(malhas(ms)).toHaveLength(0);
    expect(linhas(ms)).toHaveLength(16);
    expect(ms.scene.children.find((o) => o instanceof THREE.Mesh && o.geometry instanceof THREE.PlaneGeometry)?.visible).toBe(false);
  });

  it('realista com sombras: as faces projetam e recebem; com sombras desligadas, não', () => {
    const com = cena(casa());
    expect(malhas(com).every((m) => m.castShadow && m.receiveShadow)).toBe(true);
    expect(luz(com).castShadow).toBe(true);
    const sem = cena(comVista(casa(), { shadows: false }));
    expect(malhas(sem).every((m) => !m.castShadow)).toBe(true);
    expect(luz(sem).castShadow).toBe(false);
  });
});

describe('arestas', () => {
  it('em estilos com cor, as arestas seguem `edges`', () => {
    expect(linhas(cena(comVista(casa(), { style: 'realistic', edges: false })))).toHaveLength(0);
    expect(linhas(cena(comVista(casa(), { style: 'shaded', edges: false })))).toHaveLength(0);
    expect(linhas(cena(comVista(casa(), { style: 'consistentColors', edges: true })))).toHaveLength(6);
  });

  it('aberturas não têm arestas nos estilos com cor (como antes)', () => {
    const ms = cena(comVista(casa(), { style: 'realistic', edges: true }));
    expect(linhas(ms)).toHaveLength(6);
  });
});

describe('exibição por categoria (substituições)', () => {
  it('ocultar porta tira as 4 peças da porta; janela tira 6; a linha não muda', () => {
    const p = casa();
    const base = malhas(cena(p)).length;
    const semPorta = cena(comVista(p, { overrides: { ...defaultsOverrides(), door: { visible: false, transparency: 0, halftone: false } } }));
    const semJanela = cena(comVista(p, { overrides: { ...defaultsOverrides(), window: { visible: false, transparency: 0, halftone: false } } }));
    expect(malhas(semPorta)).toHaveLength(base - 4);
    expect(malhas(semJanela)).toHaveLength(base - 6);
    expect(linhas(semPorta)).toHaveLength(6);
  });

  it('ocultar paredes, piso e escada: não gera as malhas da categoria', () => {
    const p = casa({ escada: true });
    const base = malhas(cena(p)).length;
    const paredes = lotesParede(p);
    const pisos = buildFloorSolids(resolveFloors(p, 'lv_0')).length;
    const semParede = malhas(cena(comVista(p, { overrides: { ...defaultsOverrides(), wall: { visible: false, transparency: 0, halftone: false } } }))).length;
    const semPiso = malhas(cena(comVista(p, { overrides: { ...defaultsOverrides(), floor: { visible: false, transparency: 0, halftone: false } } }))).length;
    const semEscada = malhas(cena(comVista(p, { overrides: { ...defaultsOverrides(), stair: { visible: false, transparency: 0, halftone: false } } }))).length;
    expect(semParede).toBe(base - paredes);
    expect(semPiso).toBe(base - pisos);
    expect(semEscada).toBeLessThan(base);
  });

  it('ocultar telhado tira as malhas dele', () => {
    const p = casa({ telhado: true });
    const base = malhas(cena(p)).length;
    const semTelhado = malhas(cena(comVista(p, { overrides: { ...defaultsOverrides(), roof: { visible: false, transparency: 0, halftone: false } } }))).length;
    expect(semTelhado).toBeLessThan(base);
    expect(base).toBeGreaterThan(malhas(cena(casa())).length);
  });

  it('transparência: as faces da categoria ficam com opacidade 1 − transparência; as demais, opacas', () => {
    const p = comVista(casa(), { overrides: { ...defaultsOverrides(), wall: { visible: true, transparency: 0.6, halftone: false } } });
    const ms = cena(p);
    const translucidas = malhas(ms).filter((m) => (m.material as THREE.MeshStandardMaterial).opacity === 0.4);
    expect(translucidas).toHaveLength(lotesParede(p));
    expect(translucidas.every((m) => materialOf(m).transparent)).toBe(true);
    // O vidro da janela tem opacidade própria (< 1) e não entra na categoria da parede: continua com a sua.
    expect(malhas(ms).some((m) => (m.material as THREE.MeshStandardMaterial).opacity < 1 && (m.material as THREE.MeshStandardMaterial).opacity !== 0.4)).toBe(true);
  });

  it('meio-tom: a cor da categoria clareia (mistura com branco a 50 %)', () => {
    const p0 = casa();
    const lote = buildLevelSolids(niveis(p0)[0]!).batches[0]!;
    const base = p0.materials[lote.materialId]!.color;
    const clara = mix(base, '#ffffff', 0.5).slice(1);
    const p = comVista(p0, { overrides: { ...defaultsOverrides(), wall: { visible: true, transparency: 0, halftone: true } } });
    const ms = cena(p);
    expect(malhas(ms).some((m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === clara)).toBe(true);
  });

  it('cor da categoria substitui a do material só nessa categoria', () => {
    const p = comVista(casa(), { overrides: { ...defaultsOverrides(), wall: { visible: true, transparency: 0, halftone: false, color: '#123456' } } });
    const ms = cena(p);
    expect(malhas(ms).filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === '123456')).toHaveLength(lotesParede(p));
  });
});

describe('luz solar', () => {
  it('azimute e elevação dão a direção do sol (0 = leste, anti-horário)', () => {
    expect(sunDirection(0, 0).toArray().map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, 0]);
    expect(sunDirection(90, 0).toArray().map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 1, 0]);
    expect(sunDirection(0, 90).toArray().map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, 1]);
  });

  it('a posição da luz segue o azimute e a elevação, a partir do alvo, com a distância do padrão', () => {
    const ms = cena(comVista(casa(), { sunAzimuth: 90, sunElevation: 0 }));
    const sol = luz(ms);
    const d = sol.position.clone().sub(sol.target.position);
    expect(d.x).toBeCloseTo(0, 6);
    expect(d.y).toBeCloseTo(8 * Math.hypot(0.7, 0.5, 1.1), 6);
    expect(d.z).toBeCloseTo(0, 6);
  });

  it('o alvo e o volume de sombra não mudam com o sol', () => {
    const a = luz(cena(casa()));
    const b = luz(cena(comVista(casa(), { sunAzimuth: 10, sunElevation: 80 })));
    expect(b.target.position.toArray()).toEqual(a.target.position.toArray());
    expect(b.shadow.camera.left).toBe(a.shadow.camera.left);
    expect(b.shadow.camera.far).toBe(a.shadow.camera.far);
  });
});

describe('fundo', () => {
  it('sem cor da vista, o fundo e a neblina seguem o tema', () => {
    const claro = cena(casa());
    expect((claro.scene.background as THREE.Color).getHexString()).toBe('dfe7ee');
    expect((claro.scene.fog as THREE.Fog).color.getHexString()).toBe('dfe7ee');
    const escuro = cena(casa(), true);
    expect((escuro.scene.background as THREE.Color).getHexString()).toBe('14171b');
  });

  it('com cor da vista, o fundo e a neblina usam essa cor', () => {
    const ms = cena(comVista(casa(), { background: '#102030' }), true);
    expect((ms.scene.background as THREE.Color).getHexString()).toBe('102030');
    expect((ms.scene.fog as THREE.Fog).color.getHexString()).toBe('102030');
  });
});

describe('cache de materiais e limpeza', () => {
  it('refazer a cena no mesmo estilo reaproveita os materiais', () => {
    const p = casa();
    const ms = cena(p);
    const antes = new Set(malhas(ms).map((m) => m.material));
    ms.update(p, niveis(p), { edges: false, shadows: false, dark: false });
    const depois = new Set(malhas(ms).map((m) => m.material));
    expect([...depois].every((m) => antes.has(m))).toBe(true);
  });

  it('trocar de estilo descarta (dispose) os materiais que não são mais usados', () => {
    const p = casa();
    const ms = cena(p);
    const velhos = [...new Set(malhas(ms).map((m) => m.material as THREE.Material))];
    const espias = velhos.map((m) => vi.spyOn(m, 'dispose'));
    ms.update(comVista(p, { style: 'shaded' }), niveis(p), { edges: false, shadows: false, dark: false });
    expect(espias.every((e) => e.mock.calls.length === 1)).toBe(true);
    expect(malhas(ms).every((m) => m.material instanceof THREE.MeshLambertMaterial)).toBe(true);
  });

  it('a categoria com substituição ganha material próprio (não o do padrão)', () => {
    const p = comVista(casa(), { overrides: { ...defaultsOverrides(), wall: { visible: true, transparency: 0.5, halftone: false } } });
    const ms = cena(p);
    const paredes = new Set(malhas(ms).filter((m) => materialOf(m).transparent).map((m) => materialOf(m)));
    const outras = malhas(ms).filter((m) => !materialOf(m).transparent).map((m) => materialOf(m));
    expect(paredes.size).toBeGreaterThan(0);
    expect(outras.every((m) => !paredes.has(m))).toBe(true);
  });

  it('dispose libera geometrias e materiais', () => {
    const ms = cena(casa());
    const mats = [...new Set(malhas(ms).map((m) => m.material as THREE.Material))];
    const espias = mats.map((m) => vi.spyOn(m, 'dispose'));
    ms.dispose();
    expect(espias.every((e) => e.mock.calls.length === 1)).toBe(true);
    expect(malhas(ms)).toHaveLength(0);
  });
});

/** Substituições padrão (todas as categorias visíveis, sem transparência nem meio-tom). */
function defaultsOverrides(): Record<'wall' | 'door' | 'window' | 'floor' | 'slab' | 'roof' | 'stair', { visible: boolean; transparency: number; halftone: boolean; color?: string }> {
  const ok = { visible: true, transparency: 0, halftone: false };
  return { wall: ok, door: ok, window: ok, floor: ok, slab: ok, roof: ok, stair: ok };
}

describe('esquadrias no 3D: folhas e espessuras do tipo', () => {
  const pecas = (ms: ModelScene, kind: 'door' | 'window'): THREE.Mesh[] => malhas(ms).filter((m) => m.userData.kind === kind);
  const medida = (m: THREE.Mesh): THREE.Vector3 => {
    m.geometry.computeBoundingBox();
    return m.geometry.boundingBox!.getSize(new THREE.Vector3());
  };
  const centroDa = (m: THREE.Mesh): THREE.Vector3 => {
    m.geometry.computeBoundingBox();
    return m.geometry.boundingBox!.getCenter(new THREE.Vector3());
  };
  /** Folhas de porta: peças de altura entre 1 m e 2,10 m (menos que as ombreiras, que têm a altura do vão). */
  const folhas = (ms: ModelScene): THREE.Mesh[] => pecas(ms, 'door').filter((m) => medida(m).z < 2.1 - 1e-6 && medida(m).z > 1);
  /** Porta da parede 'a' (casa) com o tipo dado. */
  const comTipo = (p: Project, tipo: OpeningType, id = 'd1'): Project => ({ ...p, openingTypes: { ...p.openingTypes, [tipo.id]: tipo }, elements: { ...p.elements, [id]: { ...(p.elements[id] as Opening), typeId: tipo.id } } });

  it('porta de 1 folha: batente de 5 cm, folha de 4 cm de espessura com a largura do vão livre', () => {
    const ms = cena(casa());
    const portas = pecas(ms, 'door');
    expect(portas).toHaveLength(4);
    const [f] = folhas(ms);
    expect(f).toBeDefined();
    expect(medida(f!).x).toBeCloseTo(0.8 - 0.1, 6);
    expect(medida(f!).y).toBeCloseTo(0.04, 6);
    expect(portas.filter((m) => Math.abs(medida(m).x - 0.05) < 1e-6)).toHaveLength(2);
  });

  it('porta dupla: duas folhas, cada uma com metade do vão livre, centros em ±1/4 do vão livre', () => {
    const p = comTipo(casa(), DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_p160')!);
    const ms = cena(p);
    expect(pecas(ms, 'door')).toHaveLength(5);
    const dupla = folhas(ms);
    expect(dupla).toHaveLength(2);
    const xs = dupla.map((m) => centroDa(m).x).sort((a, b) => a - b);
    expect(xs[0]!).toBeCloseTo(-(1.6 - 0.1) / 4, 6);
    expect(xs[1]!).toBeCloseTo((1.6 - 0.1) / 4, 6);
    for (const m of dupla) expect(medida(m).x).toBeCloseTo((1.6 - 0.1) / 2, 6);
  });

  it('janela de 2 folhas: caixilho, vidro e um montante central com a espessura da folha da janela', () => {
    const ms = cena(casa());
    const janelas = pecas(ms, 'window');
    expect(janelas).toHaveLength(6);
    const montante = janelas.find((m) => Math.abs(centroDa(m).x) < 1e-6 && medida(m).z > 0.5 && medida(m).x < 0.1)!;
    expect(montante).toBeDefined();
    // Padrão de janela: 3 cm (`OPENING_FRAME_DEFAULTS.windowLeaf`).
    expect(medida(montante).x).toBeCloseTo(0.03, 6);
  });

  it('janela sem folha: só a soleira (sem caixilho nem vidro), como a planta', () => {
    const p = casa();
    const sem = comTipo(p, { ...p.openingTypes.ot_j120!, id: 'ot_j0', leaves: 0 }, 'j1');
    const janelas = pecas(cena(sem), 'window');
    expect(janelas).toHaveLength(1);
    expect(medida(janelas[0]!).x).toBeCloseTo(1.2, 6);
    expect(medida(janelas[0]!).z).toBeCloseTo(0.05, 6);
  });

  it('espessuras do tipo: largura do perfil, folha e vidro vêm do tipo; a profundidade do batente é limitada à parede', () => {
    const p = casa();
    const tipo = { ...p.openingTypes.ot_p80!, id: 'ot_fino', frameWidth: 0.08, frameDepth: 0.2, leafThickness: 0.02 };
    const ms = cena(comTipo(p, tipo));
    const portas = pecas(ms, 'door');
    expect(portas.filter((m) => Math.abs(medida(m).x - 0.08) < 1e-6)).toHaveLength(2);
    expect(medida(folhas(ms)[0]!).y).toBeCloseTo(0.02, 6);
    // Profundidade pedida 0,20 m, mas a parede tem 0,14 m: o batente fica com 0,14 m.
    expect(medida(portas[0]!).y).toBeCloseTo(0.14, 6);
    const vidro = comTipo(p, { ...p.openingTypes.ot_j120!, id: 'ot_vid', glassThickness: 0.02 }, 'j1');
    expect(pecas(cena(vidro), 'window').some((m) => Math.abs(medida(m).y - 0.02) < 1e-6)).toBe(true);
  });

  it('sem os campos novos, as espessuras são as de antes (batente 5 cm, folha 4 cm, vidro 1,2 cm, profundidade 9 cm)', () => {
    const ms = cena(casa());
    expect(medida(folhas(ms)[0]!).y).toBeCloseTo(0.04, 6);
    expect(pecas(ms, 'window').some((m) => Math.abs(medida(m).y - 0.012) < 1e-6)).toBe(true);
    // Ombreiras e verga da porta têm a profundidade de 9 cm (parede de 14 cm, o padrão de 9 cm vale).
    expect(pecas(ms, 'door').filter((m) => Math.abs(medida(m).y - 0.09) < 1e-6)).toHaveLength(3);
  });
});
