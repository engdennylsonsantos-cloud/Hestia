import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Id } from '@hestia/model';
import { pickElement, pickModelPoint } from './pick3d.ts';
import {
  CODIGO_VAZIO,
  PickGpu3d,
  TabelaDeIds,
  decodificarDistancia,
  desempacotar24,
  empacotar24,
  geometriaDeId,
  type RenderizadorDeIds,
} from './pickIdBuffer3d.ts';

/** Malha de um triângulo por elemento (`a`, `b`), com faixas, como os lotes globais da cena. */
function malhaComFaixas(): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 4, 0, 0, 0, 4, 0,
    0, 0, 0, -4, 0, 0, 0, -4, 0,
  ], 3));
  geo.setIndex([0, 1, 2, 3, 4, 5]);
  geo.userData.versao = 1;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.userData = { kind: 'wall', ranges: [{ id: 'a', start: 0, count: 3 }, { id: 'b', start: 3, count: 3 }] };
  return mesh;
}

function cenaDeTeste(): { raiz: THREE.Object3D; mesh: THREE.Mesh; camera: THREE.PerspectiveCamera } {
  const mesh = malhaComFaixas();
  const raiz = new THREE.Group();
  raiz.add(mesh);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  camera.position.set(2, -20, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return { raiz, mesh, camera };
}

/** Dublê do renderizador: no `render`, guarda o código do primeiro vértice do espelho e uma distância fixa. */
function renderizadorFalso(
  distancia = 12,
): RenderizadorDeIds & { renders: number; leituras: number; camera: THREE.Camera | null; alvos: Array<THREE.WebGLRenderTarget | null> } {
  let id: Uint8Array = Uint8Array.of(0, 0, 0, 0);
  let dist: Uint8Array = Uint8Array.of(0, 0, 0, 0);
  const r = {
    renders: 0,
    leituras: 0,
    camera: null as THREE.Camera | null,
    /** Alvos apontados por `setRenderTarget`, na ordem: o passe de IDs precisa desenhar no alvo, não no canvas. */
    alvos: [] as Array<THREE.WebGLRenderTarget | null>,
    setRenderTarget(alvo: THREE.WebGLRenderTarget | null): void {
      r.alvos.push(alvo);
    },
    render(cena: THREE.Scene, camera: THREE.Camera): void {
      r.renders++;
      r.camera = camera;
      const m = cena.children[0] as THREE.Mesh | undefined;
      const codigo = m ? ((m.geometry.getAttribute('aId') as THREE.BufferAttribute).getX(0) as number) : CODIGO_VAZIO;
      id = Uint8Array.from([...empacotar24(codigo), 1]);
      const limite = (m?.material as THREE.ShaderMaterial | undefined)?.uniforms.uLimite?.value as number | undefined;
      const t = limite ? Math.round((distancia / limite) * 0xff_ffff) : 0;
      dist = Uint8Array.from([...empacotar24(t), 1]);
    },
    readRenderTargetPixelsAsync(
      _alvo: THREE.WebGLRenderTarget,
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      buffer: Uint8Array,
      _face?: number,
      textura = 0,
    ): Promise<ArrayLike<number>> {
      r.leituras++;
      const origem = textura === 0 ? id : dist;
      buffer.set(origem);
      return Promise.resolve(buffer);
    },
    setClearColor(): void {},
    getClearColor(alvo: THREE.Color): THREE.Color {
      return alvo;
    },
    getClearAlpha(): number {
      return 1;
    },
  };
  return r;
}

describe('tabela de ids (código por elemento)', () => {
  it('o WebGLRenderer do three satisfaz o contrato do renderizador de IDs (checagem de tipo)', () => {
    const renderer: RenderizadorDeIds = null as unknown as THREE.WebGLRenderer;
    expect(renderer).toBeNull();
  });

  it('códigos são 1-based, estáveis e 0 é o vazio', () => {
    const t = new TabelaDeIds();
    expect(t.tamanho).toBe(0);
    expect(t.codigo('a', 'wall')).toBe(1);
    expect(t.codigo('b', 'floor')).toBe(2);
    expect(t.codigo('a', 'wall')).toBe(1);
    expect(t.tamanho).toBe(2);
    expect(t.codigoDe('b')).toBe(2);
    expect(t.codigoDe('z')).toBeNull();
    expect(t.entrada(1)).toEqual({ id: 'a', kind: 'wall' });
    expect(t.entrada(CODIGO_VAZIO)).toBeNull();
    expect(t.entrada(99)).toBeNull();
  });
});

describe('empacotamento de 24 bits', () => {
  it('ida e volta nos extremos e em valores do meio', () => {
    for (const v of [0, 1, 255, 256, 65535, 1_000_003, 0xff_ffff]) {
      const [r, g, b] = empacotar24(v);
      expect(desempacotar24([r, g, b, 255])).toBe(v);
    }
  });

  it('distância decodificada fica dentro de meio passo do limite', () => {
    const limite = 2000;
    const t = decodificarDistancia(desempacotar24(empacotar24((12.345 / limite) * 0xff_ffff)), limite);
    expect(Math.abs(t - 12.345)).toBeLessThan(limite / 0xff_ffff);
  });
});

describe('geometria do passe de IDs', () => {
  it('compartilha posição e índice do modelo e marca o id por vértice', () => {
    const { mesh } = cenaDeTeste();
    const tabela = new TabelaDeIds();
    const geo = geometriaDeId(mesh, tabela)!;
    expect(geo.getAttribute('position')).toBe(mesh.geometry.getAttribute('position'));
    expect(geo.index).toBe(mesh.geometry.index);
    const ids = geo.getAttribute('aId') as THREE.BufferAttribute;
    const a = tabela.codigoDe('a')!;
    const b = tabela.codigoDe('b')!;
    expect([ids.getX(0), ids.getX(1), ids.getX(2)]).toEqual([a, a, a]);
    expect([ids.getX(3), ids.getX(4), ids.getX(5)]).toEqual([b, b, b]);
    expect(geo.drawRange.count).toBe(6);
    expect(geo.userData.compartilhada).toBe(true);
  });

  it('refaz o atributo quando a versão da geometria muda e reaproveita quando não muda', () => {
    const { mesh } = cenaDeTeste();
    const tabela = new TabelaDeIds();
    const um = geometriaDeId(mesh, tabela)!;
    expect(geometriaDeId(mesh, tabela)).toBe(um);
    mesh.geometry.userData.versao = 2;
    const dois = geometriaDeId(mesh, tabela)!;
    expect(dois).not.toBe(um);
  });

  it('malha sem índice ou sem faixas não entra no passe', () => {
    const tabela = new TabelaDeIds();
    const semIndice = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    semIndice.userData = { kind: 'wall', ranges: [] };
    expect(geometriaDeId(semIndice, tabela)).toBeNull();
  });
});

describe('PickGpu3d (ID buffer com leitura assíncrona)', () => {
  it('pede a leitura, decodifica id e ponto, e não repete o mesmo pixel', async () => {
    const { raiz, camera } = cenaDeTeste();
    const renderer = renderizadorFalso(12);
    let resolvidos = 0;
    const picker = new PickGpu3d({ renderer, raiz, aoResolver: () => resolvidos++ });
    picker.redimensionar(800, 600);
    const ndc = { x: 0, y: 0 };

    // Ainda não há leitura: o caminho é o BVH.
    expect(picker.ler(ndc, camera)).toBeNull();
    picker.pedir(ndc, camera);
    // O passe de IDs é desenhado na hora; só a leitura do pixel é assíncrona.
    expect(renderer.renders).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(renderer.renders).toBe(1);
    expect(renderer.leituras).toBe(2);
    expect(resolvidos).toBe(1);

    const hit = picker.ler(ndc, camera)!;
    expect(hit.id).toBe('a');
    expect(hit.kind).toBe('wall');
    // Ponto a 12 m da câmera, na direção do **centro do pixel** (o ID buffer amostra o centro, não o ndc exato):
    // ndc (0,0) em 800×600 cai no pixel (400, 299 do topo), cujo centro é (0,00125, 0,00167) em NDC.
    const centro = { x: (400.5 / 800) * 2 - 1, y: 1 - (299.5 / 600) * 2 };
    const raio = new THREE.Raycaster();
    raio.setFromCamera(new THREE.Vector2(centro.x, centro.y), camera);
    const esperado = raio.ray.origin.clone().addScaledVector(raio.ray.direction, 12);
    expect(hit.point.x).toBeCloseTo(esperado.x, 2);
    expect(hit.point.y).toBeCloseTo(esperado.y, 2);
    expect(hit.point.z).toBeCloseTo(esperado.z, 2);

    // Mesmo pixel e mesma câmera: cache, sem novo render.
    picker.pedir(ndc, camera);
    await new Promise((r) => setTimeout(r, 0));
    expect(renderer.renders).toBe(1);
  });

  it('a câmera que se move invalida o resultado do pixel', async () => {
    const { raiz, camera } = cenaDeTeste();
    const renderer = renderizadorFalso();
    const picker = new PickGpu3d({ renderer, raiz });
    picker.redimensionar(800, 600);
    const ndc = { x: 0, y: 0 };
    picker.pedir(ndc, camera);
    await new Promise((r) => setTimeout(r, 0));
    expect(picker.ler(ndc, camera)?.id).toBe('a');
    camera.position.x += 1;
    camera.updateMatrixWorld(true);
    expect(picker.ler(ndc, camera)).toBeNull();
  });

  it('o passe usa uma câmera de recorte de 1×1 e restaura a cor de limpeza', async () => {
    const { raiz, camera } = cenaDeTeste();
    const renderer = renderizadorFalso();
    const cores: Array<[unknown, number | undefined]> = [];
    const original = renderer.setClearColor.bind(renderer);
    renderer.setClearColor = (cor: THREE.ColorRepresentation, alpha?: number): void => {
      cores.push([cor, alpha]);
      original(cor, alpha);
    };
    const picker = new PickGpu3d({ renderer, raiz });
    picker.redimensionar(320, 200);
    await picker.pick({ x: 0, y: 0 }, camera);
    expect(cores).toHaveLength(2);
    expect(cores[0]![0]).toBe(0x000000);
    expect(cores[0]![1]).toBe(0);
    expect(renderer.camera).not.toBe(camera);
    expect((renderer.camera as THREE.PerspectiveCamera).view?.width).toBe(1);
    // O passe desenha no alvo de 1×1 e devolve o canvas ao dono (three ignora um 3º argumento em `render`).
    expect(renderer.alvos).toHaveLength(2);
    expect(renderer.alvos[0]).toBeInstanceOf(THREE.WebGLRenderTarget);
    expect((renderer.alvos[0] as THREE.WebGLRenderTarget).textures).toHaveLength(2);
    expect(renderer.alvos[1]).toBeNull();
  });
});

describe('pickElement com ID buffer e fallback BVH', () => {
  it('usa o resultado lido na GPU quando ele existe', () => {
    const { raiz, camera } = cenaDeTeste();
    const gpu = {
      ler: () => ({ id: 'b' as Id, kind: 'floor' as const, point: { x: 1, y: 2, z: 3 } }),
      pedir: () => undefined,
    };
    expect(pickElement(raiz, camera, { x: 0, y: 0 }, gpu)).toEqual({ id: 'b', kind: 'floor', point: { x: 1, y: 2, z: 3 } });
    expect(pickModelPoint(raiz, camera, { x: 0, y: 0 }, gpu)).toEqual({ x: 1, y: 2 });
  });

  it('sem leitura pronta, pede o pixel e devolve o mesmo resultado do BVH', () => {
    const { raiz, camera } = cenaDeTeste();
    let pedidos = 0;
    const gpu = { ler: () => null, pedir: () => pedidos++ };
    const semGpu = pickElement(raiz, camera, { x: 0, y: 0 });
    const comGpu = pickElement(raiz, camera, { x: 0, y: 0 }, gpu);
    expect(pedidos).toBe(1);
    expect(comGpu).toEqual(semGpu);
    expect(comGpu?.id).toBe('a');
  });
});
