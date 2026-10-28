import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildOpeningModel, frameOfWall, openingGeometry, type OpeningGeometry } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall, view3dOf, type Opening, type OpeningType, type Project } from '@hestia/model';
import { caixasEPrismasDoModelo, montarAberturaDoModelo } from './aberturas3d.ts';
import { arestasDasCaixas, matrizDaCaixa } from './caixas3d.ts';
import { modeloComPerfil, perfilDaOmbreira, PERFIL } from './fixturePerfil.ts';
import { geometriaDaPeca } from './geometriaPeca3d.ts';
import { pecasDoModelo, type OpeningPiece } from './openingParts.ts';
import { arestasDaSilhuetaDeCaixas } from './silhuetaCaixas3d.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

function cena(): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes['ot_p90']!;
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: 'door', typeId: 'ot_p90', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), t };
}

/** Área com sinal de um polígono (t, s). */
function area(pts: ReadonlyArray<readonly [number, number]>): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Volume e centro de massa de uma geometria fechada (tétrades em relação à origem). */
function volumeECentro(geo: THREE.BufferGeometry, posicoes?: ArrayLike<number>): { volume: number; centro: THREE.Vector3 } {
  const pos = posicoes ?? geo.getAttribute('position').array;
  const attr = geo.getAttribute('position');
  const idx = geo.index ? Array.from(geo.index.array) : Array.from({ length: attr.count }, (_, i) => i);
  let volume = 0;
  const centro = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromArray(pos, idx[i]! * 3);
    b.fromArray(pos, idx[i + 1]! * 3);
    c.fromArray(pos, idx[i + 2]! * 3);
    const v = a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    volume += v;
    centro.addScaledVector(a.clone().add(b).add(c), v / 4);
  }
  if (Math.abs(volume) > 1e-15) centro.divideScalar(volume);
  return { volume, centro };
}

/**
 * Volume do prisma com as coordenadas do perfil em precisão dupla. O `ExtrudeGeometry` guarda as posições em float32
 * (precisão da GPU); aqui cada vértice é levado ao canto exato do perfil e da extrusão para medir a seção sem esse erro.
 * Devolve também o maior desvio do snap, para provar que a geometria está nos cantos certos.
 */
function volumeDoPrisma(geo: THREE.BufferGeometry, piece: OpeningPiece): { volume: number; desvio: number } {
  const attr = geo.getAttribute('position');
  const out = new Float64Array(attr.count * 3);
  const pts = piece.profile!.pts;
  let desvio = 0;
  const box = { t0: piece.x - piece.w / 2, t1: piece.x + piece.w / 2, s0: piece.y - piece.d / 2, s1: piece.y + piece.d / 2, z0: piece.z - piece.h / 2, z1: piece.z + piece.h / 2 };
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const z = attr.getZ(i);
    if (piece.profile!.plane === 'ts') {
      let melhor = pts[0]!;
      let d2 = Infinity;
      for (const q of pts) {
        const d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
        if (d < d2) {
          d2 = d;
          melhor = q;
        }
      }
      desvio = Math.max(desvio, Math.sqrt(d2), Math.min(Math.abs(z - box.z0), Math.abs(z - box.z1)));
      out[i * 3] = melhor[0];
      out[i * 3 + 1] = melhor[1];
      out[i * 3 + 2] = Math.abs(z - box.z0) <= Math.abs(z - box.z1) ? box.z0 : box.z1;
    } else {
      let melhor = pts[0]!;
      let d2 = Infinity;
      for (const q of pts) {
        const d = (q[0] - y) ** 2 + (q[1] - z) ** 2;
        if (d < d2) {
          d2 = d;
          melhor = q;
        }
      }
      desvio = Math.max(desvio, Math.sqrt(d2), Math.min(Math.abs(x - box.t0), Math.abs(x - box.t1)));
      out[i * 3] = Math.abs(x - box.t0) <= Math.abs(x - box.t1) ? box.t0 : box.t1;
      out[i * 3 + 1] = melhor[0];
      out[i * 3 + 2] = melhor[1];
    }
  }
  return { volume: Math.abs(volumeECentro(geo, out).volume), desvio };
}

const f32 = (x: number): number => Math.fround(x);

/** Volume e centro de uma caixa unitária levada pela matriz (rotação + escala). */
function volumeDaMatriz(m: THREE.Matrix4): number {
  const e = m.elements;
  const c0 = new THREE.Vector3(e[0]!, e[1]!, e[2]!);
  const c1 = new THREE.Vector3(e[4]!, e[5]!, e[6]!);
  const c2 = new THREE.Vector3(e[8]!, e[9]!, e[10]!);
  return Math.abs(c0.dot(new THREE.Vector3().crossVectors(c1, c2)));
}

function bbox(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!.clone();
}

describe('adaptador 3D do batente em peça única (fixture E3 §2)', () => {
  it('ombreiras e travessa viram UMA peça com profile de 6 pontos; nenhum batedor extra', () => {
    const { p, t } = cena();
    const pecas = pecasDoModelo(p, t, modeloComPerfil(), false);
    const ombreiras = pecas.filter((x) => x.role === 'jamb');
    expect(ombreiras).toHaveLength(2);
    for (const j of ombreiras) {
      expect(j.profile?.plane).toBe('ts');
      expect(j.profile?.pts).toHaveLength(6);
    }
    const travessa = pecas.find((x) => x.role === 'head')!;
    expect(travessa.profile?.plane).toBe('sz');
    expect(travessa.profile?.pts).toHaveLength(6);
    expect(pecas.filter((x) => x.role === 'stop')).toHaveLength(0);
    expect(pecas.filter((x) => x.role === 'jamb' || x.role === 'head')).toHaveLength(3);
  });

  it('a geometria extrudada da ombreira: volume = área do L × altura e caixa envolvente = box do modelo', () => {
    const { p, t } = cena();
    const pecas = pecasDoModelo(p, t, modeloComPerfil(), false);
    for (const piece of pecas.filter((x) => x.role === 'jamb')) {
      const geo = geometriaDaPeca(piece);
      const prism = volumeDoPrisma(geo, piece);
      expect(prism.desvio).toBeLessThan(1e-6); // a geometria está nos cantos do perfil (float32)
      expect(prism.volume).toBeCloseTo(Math.abs(area(piece.profile!.pts)) * piece.h, 9);
      const caixa = bbox(geo);
      expect(caixa.min.x).toBeCloseTo(f32(piece.x - piece.w / 2), 9);
      expect(caixa.max.x).toBeCloseTo(f32(piece.x + piece.w / 2), 9);
      expect(caixa.min.y).toBeCloseTo(f32(piece.y - piece.d / 2), 9);
      expect(caixa.max.y).toBeCloseTo(f32(piece.y + piece.d / 2), 9);
      expect(caixa.min.z).toBeCloseTo(f32(piece.z - piece.h / 2), 9);
      expect(caixa.max.z).toBeCloseTo(f32(piece.z + piece.h / 2), 9);
      geo.dispose();
    }
  });

  it('a travessa em L também tem volume e caixa iguais ao modelo', () => {
    const { p, t } = cena();
    const piece = pecasDoModelo(p, t, modeloComPerfil(), false).find((x) => x.role === 'head')!;
    const geo = geometriaDaPeca(piece);
    const prism = volumeDoPrisma(geo, piece);
    expect(prism.desvio).toBeLessThan(1e-6);
    expect(prism.volume).toBeCloseTo(Math.abs(area(piece.profile!.pts)) * piece.w, 9);
    const caixa = bbox(geo);
    expect(caixa.min.x).toBeCloseTo(f32(piece.x - piece.w / 2), 9);
    expect(caixa.max.x).toBeCloseTo(f32(piece.x + piece.w / 2), 9);
    expect(caixa.min.y).toBeCloseTo(f32(piece.y - piece.d / 2), 9);
    expect(caixa.max.y).toBeCloseTo(f32(piece.y + piece.d / 2), 9);
    expect(caixa.min.z).toBeCloseTo(f32(piece.z - piece.h / 2), 9);
    expect(caixa.max.z).toBeCloseTo(f32(piece.z + piece.h / 2), 9);
    geo.dispose();
  });

  it('quando o motor tiver profile, a posição da peça 3D bate com a box do buildOpeningModel', () => {
    const { p, o, g } = cena();
    const real = buildOpeningModel(p, o, g, frameOfWall(p, 'w')!);
    const t = p.openingTypes[o.typeId]!;
    const pecas = pecasDoModelo(p, t, real, false);
    const doModelo = real.parts.filter((x) => x.role === 'jamb' || x.role === 'head');
    // FR1 ainda não integrado: sem profile no modelo real, o teste fica preparado para a comparação.
    if (!doModelo.some((x) => x.profile)) return;
    for (const part of doModelo) {
      // Duas ombreiras têm o mesmo papel: a peça certa é a que está na posição t da peça do modelo.
      const cx = (part.box.t0 + part.box.t1) / 2;
      const piece = pecas.find((x) => x.role === part.role && x.profile && Math.abs(x.x - cx) < 1e-9)!;
      expect(piece).toBeDefined();
      expect(piece.profile).toEqual(part.profile);
      expect(piece.x).toBeCloseTo((part.box.t0 + part.box.t1) / 2, 9);
      expect(piece.y).toBeCloseTo((part.box.s0 + part.box.s1) / 2, 9);
      expect(piece.z).toBeCloseTo((part.box.z0 + part.box.z1) / 2, 9);
    }
  });
});

describe('montarAbertura e o caminho instanciado dão o mesmo sólido', () => {
  const desenhar = (parent: THREE.Object3D, geo: THREE.BufferGeometry): void => {
    parent.add(new THREE.Mesh(geo));
  };

  /** Volume e centro do que `montarAbertura` entrega, já no mundo (grupo do vão aplicado aos lotes). */
  function montadoNoMundo(ab: NonNullable<ReturnType<typeof montarAberturaDoModelo>>): { volume: number; centro: THREE.Vector3 } {
    ab.grupo.updateMatrixWorld(true);
    let volume = 0;
    const centro = new THREE.Vector3();
    for (const lote of ab.lotes) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(lote.positions, 3));
      geo.setIndex(lote.indices);
      geo.applyMatrix4(ab.grupo.matrixWorld);
      const vc = volumeECentro(geo);
      volume += vc.volume;
      centro.addScaledVector(vc.centro, vc.volume);
      geo.dispose();
    }
    // As folhas abertas ficam nos pivôs, fora dos lotes.
    ab.grupo.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const vc = volumeECentro(geo);
      volume += vc.volume;
      centro.addScaledVector(vc.centro, vc.volume);
      geo.dispose();
    });
    return { volume, centro: centro.divideScalar(volume) };
  }

  /** Volume e centro do caminho instanciado (caixas + prismas), no mundo. */
  function instanciadoNoMundo(ab: NonNullable<ReturnType<typeof caixasEPrismasDoModelo>>): { volume: number; centro: THREE.Vector3 } {
    let volume = 0;
    const centro = new THREE.Vector3();
    for (const c of ab.caixas) {
      const m = new THREE.Matrix4().fromArray(c.matriz);
      const v = volumeDaMatriz(m);
      volume += v;
      centro.addScaledVector(new THREE.Vector3().setFromMatrixPosition(m), v);
    }
    for (const pr of ab.prismas) {
      const vc = volumeECentro(pr.geometry);
      volume += vc.volume;
      centro.addScaledVector(vc.centro, vc.volume);
    }
    return { volume, centro: centro.divideScalar(volume) };
  }

  it('fechado: mesmo volume total e mesmo centro de massa (fixture com batente em L)', () => {
    const { p, o, g } = cena();
    const view = { ...view3dOf(p), openOpenings: false };
    const model = modeloComPerfil();
    const montado = montadoNoMundo(montarAberturaDoModelo(p, o, g, 0, model, view, false, desenhar)!);
    const instanciado = instanciadoNoMundo(caixasEPrismasDoModelo(p, o, g, 0, model, view)!);
    expect(instanciado.volume).toBeCloseTo(montado.volume, 9);
    expect(instanciado.centro.distanceTo(montado.centro)).toBeLessThan(1e-6);
  });

  it('aberto: a folha girada e os prismas do batente continuam equivalentes', () => {
    const { p, o, g } = cena();
    const view = { ...view3dOf(p), openOpenings: true };
    const model = modeloComPerfil();
    const montado = montarAberturaDoModelo(p, o, g, 0, model, view, false, desenhar)!;
    const instanciado = caixasEPrismasDoModelo(p, o, g, 0, model, view)!;
    // Volume total (a folha girando não muda o volume). A geometria da cena é float32: 1e-6 m³ basta para a prova.
    expect(instanciadoNoMundo(instanciado).volume).toBeCloseTo(montadoNoMundo(montado).volume, 6);
    // Centros de cada peça aberta: os lotes fixos mais os meshes nos pivôs.
    const centrosMontados: THREE.Vector3[] = [];
    montado.grupo.updateMatrixWorld(true);
    for (const lote of montado.lotes) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(lote.positions, 3));
      geo.setIndex(lote.indices);
      geo.applyMatrix4(montado.grupo.matrixWorld);
      centrosMontados.push(volumeECentro(geo).centro);
      geo.dispose();
    }
    montado.grupo.traverse((o3) => {
      if (o3 instanceof THREE.Mesh && o3.geometry.getAttribute('position')) {
        const geo = o3.geometry.clone().applyMatrix4(o3.matrixWorld);
        centrosMontados.push(volumeECentro(geo).centro);
        geo.dispose();
      }
    });
    const centrosInstanciados = [
      ...instanciado.caixas.map((c) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(c.matriz))),
      ...instanciado.prismas.map((pr) => volumeECentro(pr.geometry).centro),
    ];
    expect(centrosInstanciados).toHaveLength(centrosMontados.length);
    // Cada centro do caminho instanciado tem um par no caminho de montagem (sem depender da ordem das peças).
    const restantes = [...centrosMontados];
    for (const centro of centrosInstanciados) {
      const i = restantes.findIndex((x) => x.distanceTo(centro) < 1e-6);
      expect(i, `centro sem par em ${centro.toArray().join(', ')}`).toBeGreaterThanOrEqual(0);
      restantes.splice(i, 1);
    }
    expect(restantes).toHaveLength(0);
  });
});

describe('alizar: arestas do grupo sem as juntas internas', () => {
  it('três caixas encostadas têm a silhueta unida (24 arestas) e não as 36 das caixas soltas', () => {
    const { p, t } = cena();
    const pecas = pecasDoModelo(p, t, modeloComPerfil({ alizar: true }), false).filter((x) => x.group === 'casing-n');
    expect(pecas).toHaveLength(3);
    const matrizes = pecas.flatMap((x: OpeningPiece) => matrizDaCaixa(x.x, x.y, x.z, 0, x.w, x.d, x.h));
    const soltas: number[] = [];
    arestasDasCaixas(matrizes, soltas);
    expect(soltas).toHaveLength(3 * 12 * 6);
    const silhueta = arestasDaSilhuetaDeCaixas(matrizes);
    expect(silhueta).toHaveLength(24 * 6);
  });

  it('com o grupo girado (rotação do vão), a silhueta continua a mesma (24 arestas)', () => {
    const { p, t } = cena();
    const pecas = pecasDoModelo(p, t, modeloComPerfil({ alizar: true }), false).filter((x) => x.group === 'casing-n');
    const ang = 0.7;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const matrizes = pecas.flatMap((x: OpeningPiece) => matrizDaCaixa(x.x * cos - x.y * sin, x.x * sin + x.y * cos, x.z, ang, x.w, x.d, x.h));
    expect(arestasDaSilhuetaDeCaixas(matrizes)).toHaveLength(24 * 6);
  });

  it('montarAbertura devolve a silhueta do grupo e marca os lotes do grupo; caixas carregam o group', () => {
    const { p, o, g } = cena();
    const view = { ...view3dOf(p), openOpenings: false };
    const model = modeloComPerfil({ alizar: true });
    const desenhar = (parent: THREE.Object3D, geo: THREE.BufferGeometry): void => {
      parent.add(new THREE.Mesh(geo));
    };
    const montado = montarAberturaDoModelo(p, o, g, 0, model, view, true, desenhar)!;
    expect(montado.arestasGrupos).toHaveLength(24 * 6);
    expect(montado.lotes.filter((x) => x.group === 'casing-n')).toHaveLength(3);
    const instanciado = caixasEPrismasDoModelo(p, o, g, 0, model, view)!;
    const doGrupo = instanciado.caixas.filter((x) => x.group === 'casing-n');
    expect(doGrupo).toHaveLength(3);
    const matrizes = doGrupo.flatMap((x) => x.matriz);
    expect(arestasDaSilhuetaDeCaixas(matrizes)).toHaveLength(24 * 6);
  });

  it('a ombreira em L continua com uma peça por ombreira quando o alizar está ligado', () => {
    const { p, t } = cena();
    const pecas = pecasDoModelo(p, t, modeloComPerfil({ alizar: true }), false);
    expect(pecas.filter((x) => x.role === 'jamb' && x.profile)).toHaveLength(2);
    expect(pecas.filter((x) => x.role === 'stop')).toHaveLength(0);
  });
});

describe('seção do perfil no modelo', () => {
  it('o L da ombreira (t, s) tem área J·D − ov·R', () => {
    const { profile } = perfilDaOmbreira(1);
    expect(Math.abs(area(profile.pts))).toBeCloseTo(PERFIL.J * PERFIL.D - PERFIL.ov * PERFIL.R, 12);
  });
});
