import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';
import type { ElementHit, LeitorDeIdsGpu } from './pick3d.ts';

/**
 * Picking por **ID buffer** na GPU (Fase 2.4): o modelo é desenhado uma vez num alvo de 1×1 pixel com dois anexos (MRT):
 * o código do elemento e a distância do raio. A leitura é assíncrona (`readRenderTargetPixelsAsync`) e o resultado fica
 * em cache por pixel/câmera; enquanto ele não chega, `pickElement` responde pelo BVH (`pick3d.ts`), então a tela nunca
 * fica sem resposta.
 *
 * O que este caminho **não** faz: copiar triângulos. O passe de IDs usa a mesma `position` e o mesmo `index` das malhas
 * do modelo (a mesma instância de `BufferAttribute`, portanto os mesmos buffers da GPU) e só acrescenta um atributo
 * `aId` por vértice, montado uma vez por versão da geometria (`geometry.userData.versao`, o contador do R1).
 *
 * Encaixe no app (o R3 não altera `scene3d.ts` nem `ViewportCanvas.tsx`):
 * ```ts
 * const picker = new PickGpu3d({ renderer: g.gpu.renderer, raiz: model.current.scene });
 * picker.redimensionar(w * dpr, h * dpr);
 * // no lugar de pickElement(cena, camera, ndc), sem mudar mais nada:
 * const hit = pickElement(cena, camera, ndc, picker);
 * // para o hover aproveitar a leitura assíncrona no quadro seguinte:
 * picker.aoResolver = () => useUi.setState({ previewTick: ... });
 * // e, quando o modelo muda, descartar os pixels lidos:
 * picker.invalidar();
 * ```
 * `raiz` é a cena inteira (não o grupo do modelo): o filtro do passe é `userData.ranges`, então o chão, a grade, as
 * arestas, o realce e as caixas instanciadas ficam de fora — e as malhas de picking do wireframe (que vivem fora do grupo
 * do modelo) entram.
 */

/** Código 0 = nenhum elemento (o alvo é limpo com zero). */
export const CODIGO_VAZIO = 0;
/** 24 bits de código: 16,7 M de elementos (o cenário de 60×256 tem ~39 mil). */
export const MAX_CODIGOS = 0xff_ffff;
const ESCALA_24 = 0xff_ffff;

/** Categoria e id de um código. */
interface EntradaDaTabela {
  id: Id;
  kind: GraphicsCategory;
}

/**
 * Tabela id ↔ código (uint32, 1-based, 0 = vazio). Os códigos são estáveis: um id novo ganha o próximo código livre e
 * nunca é reaproveitado, então o atributo `aId` de uma geometria continua válido enquanto a tabela viver.
 */
export class TabelaDeIds {
  private porId = new Map<Id, number>();
  private entradas: Array<EntradaDaTabela | null> = [null];

  /** Código do id, registrando-o se for novo. `null` quando a tabela estourou os 24 bits. */
  codigo(id: Id, kind: GraphicsCategory): number | null {
    const existente = this.porId.get(id);
    if (existente !== undefined) return existente;
    const n = this.entradas.length;
    if (n > MAX_CODIGOS) return null;
    this.porId.set(id, n);
    this.entradas.push({ id, kind });
    return n;
  }

  /** Código já registrado, sem registrar. */
  codigoDe(id: Id): number | null {
    return this.porId.get(id) ?? null;
  }

  /** Id e categoria do código; `null` no vazio (0) e nos códigos fora da tabela. */
  entrada(codigo: number): EntradaDaTabela | null {
    return this.entradas[codigo] ?? null;
  }

  get tamanho(): number {
    return this.entradas.length - 1;
  }
}

// ---- geometria do passe de IDs (uma vez por versão da geometria) ----

interface GeometriaDeId {
  versao: number;
  tabela: TabelaDeIds;
  geometria: THREE.BufferGeometry | null;
}

const cacheDeIds = new WeakMap<THREE.BufferGeometry, GeometriaDeId>();

/**
 * Geometria do passe de IDs: a mesma `position` e o mesmo `index` da malha (instâncias compartilhadas) mais o atributo
 * `aId` por vértice, montado a partir das faixas (`userData.ranges`). Devolve `null` quando a malha não é indexada ou
 * quando os ids não cabem na tabela.
 */
export function geometriaDeId(mesh: THREE.Mesh, tabela: TabelaDeIds): THREE.BufferGeometry | null {
  const origem = mesh.geometry as THREE.BufferGeometry;
  const index = origem.index;
  const pos = origem.getAttribute('position');
  const faixas = mesh.userData.ranges as ElementRange[] | undefined;
  if (!index || !pos || !faixas) return null;
  const versao = Number(origem.userData.versao ?? 0);
  const emCache = cacheDeIds.get(origem);
  if (emCache && emCache.versao === versao && emCache.tabela === tabela) return emCache.geometria;

  const ids = new Uint32Array(pos.count);
  let ok = true;
  for (const r of faixas) {
    const c = tabela.codigo(r.id, mesh.userData.kind as GraphicsCategory);
    if (c === null) {
      ok = false;
      continue;
    }
    for (let k = r.start; k < r.start + r.count; k++) ids[index.getX(k)] = c;
  }
  let geometria: THREE.BufferGeometry | null = null;
  if (ok) {
    geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', pos);
    geometria.setIndex(index);
    geometria.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    const limite = Number.isFinite(origem.drawRange.count) ? origem.drawRange.count : index.count;
    geometria.setDrawRange(origem.drawRange.start, limite);
    // Os buffers de posição/índice são do modelo: nunca liberar por esta geometria.
    geometria.userData = { compartilhada: true };
  }
  cacheDeIds.set(origem, { versao, tabela, geometria });
  return geometria;
}

// ---- material do passe (GLSL3 com dois anexos) ----

const VERTEX_DE_ID = /* glsl */ `
in uint aId;
flat out uint vId;
out float vDistancia;
void main() {
  vId = aId;
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vDistancia = length(mundo.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT_DE_ID = /* glsl */ `
uniform float uLimite;
flat in uint vId;
in float vDistancia;
layout(location = 0) out vec4 oId;
layout(location = 1) out vec4 oDistancia;

vec3 empacotar(uint valor) {
  return vec3(float((valor >> 16u) & 255u), float((valor >> 8u) & 255u), float(valor & 255u)) / 255.0;
}

void main() {
  oId = vec4(empacotar(vId), 1.0);
  uint q = uint(clamp(vDistancia / uLimite, 0.0, 1.0) * 16777215.0 + 0.5);
  oDistancia = vec4(empacotar(q), 1.0);
}
`;

function materialDeId(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uLimite: { value: 1000 } },
    vertexShader: VERTEX_DE_ID,
    fragmentShader: FRAGMENT_DE_ID,
    // O passe de IDs tem de ver as mesmas faces que o BVH (que usa o `side` do material; os materiais da cena são
    // FrontSide — `materiais3d.ts`).
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}

// ---- empacotamento de 24 bits (puro; testável sem GPU) ----

/** Valor 24 bits → bytes RGB (0..255). */
export function empacotar24(valor: number): [number, number, number] {
  const v = Math.max(0, Math.min(ESCALA_24, Math.round(valor)));
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Bytes RGBA lidos do buffer → valor 24 bits. */
export function desempacotar24(rgba: ArrayLike<number>, base = 0): number {
  return ((rgba[base] ?? 0) << 16) | ((rgba[base + 1] ?? 0) << 8) | (rgba[base + 2] ?? 0);
}

/** Distância empacotada de 24 bits → metros, dado o limite usado no uniforme. */
export function decodificarDistancia(q: number, limite: number): number {
  return (q / ESCALA_24) * limite;
}

// ---- renderizador mínimo (o WebGLRenderer do three satisfaz) ----

/**
 * O que o passe de IDs precisa do renderizador. O `WebGLRenderer` do three implementa esta forma; nos testes um dublê
 * devolve pixels prontos.
 */
export interface RenderizadorDeIds {
  /**
   * O `render` do three não recebe o alvo (o MiniBIM2 passava um 3º argumento, que o three 0.180 ignora — o passe saía no
   * canvas e a leitura voltava `undefined`). Quem tem `setRenderTarget` (o `WebGLRenderer`) aponta o alvo antes do desenho;
   * sem ele, o dublê dos testes segue devolvendo pixels prontos. Ver `executar`.
   */
  setRenderTarget?(alvo: THREE.WebGLRenderTarget | null): void;
  render(cena: THREE.Scene, camera: THREE.Camera, alvo?: THREE.WebGLRenderTarget): void;
  readRenderTargetPixelsAsync(
    alvo: THREE.WebGLRenderTarget,
    x: number,
    y: number,
    largura: number,
    altura: number,
    buffer: Uint8Array,
    face?: number,
    textura?: number,
  ): Promise<ArrayLike<number>>;
  setClearColor(cor: THREE.ColorRepresentation, alpha?: number): void;
  getClearColor(alvo: THREE.Color): THREE.Color;
  getClearAlpha(): number;
}

export interface OpcoesPickGpu {
  renderer: RenderizadorDeIds;
  /** Raiz de onde saem as malhas do picking (a cena): só as que têm `userData.ranges` entram no passe. */
  raiz: THREE.Object3D;
  /** Tabela própria (padrão: uma nova). */
  tabela?: TabelaDeIds;
  /** Chamado quando uma leitura assíncrona termina (o app atualiza o hover aqui). */
  aoResolver?: (hit: ElementHit | null) => void;
}

/**
 * Leitor de IDs por GPU (WebGL2 com MRT). O uso no app é `pickElement(cena, camera, ndc, picker)`: o resultado lido vale
 * na hora, o pixel novo é pedido para o próximo quadro e o BVH cobre o intervalo.
 */
export class PickGpu3d implements LeitorDeIdsGpu {
  readonly tabela: TabelaDeIds;
  private readonly renderer: RenderizadorDeIds;
  private readonly raiz: THREE.Object3D;
  private readonly alvo: THREE.WebGLRenderTarget;
  private readonly material = materialDeId();
  private readonly espelho = new THREE.Scene();
  private readonly corDeFundo = new THREE.Color();
  private readonly porPixel = new Map<string, ElementHit | null>();
  private readonly bytesId = new Uint8Array(4);
  private readonly bytesDistancia = new Uint8Array(4);
  private largura = 1;
  private altura = 1;
  private emVoo = false;
  private pedido: { ndc: { x: number; y: number }; camera: THREE.Camera } | null = null;
  private ultimaChave = '';
  /** Última câmera vista e a cópia da matriz dela: a versão muda quando a câmera se move. */
  private cameraVista: THREE.Camera | null = null;
  private readonly matrizVista = new Float64Array(32);
  private versaoDaCamera = 0;
  /** Chamado quando uma leitura termina (resultado pode ser null: vazio). */
  aoResolver?: (hit: ElementHit | null) => void;

  constructor(opcoes: OpcoesPickGpu) {
    this.renderer = opcoes.renderer;
    this.raiz = opcoes.raiz;
    this.tabela = opcoes.tabela ?? new TabelaDeIds();
    this.aoResolver = opcoes.aoResolver;
    this.alvo = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.alvo.textures[0]!.generateMipmaps = false;
    this.alvo.textures[1]!.generateMipmaps = false;
  }

  /** Tamanho do canvas em pixels de dispositivo (o mesmo do `setSize` do renderizador). */
  redimensionar(largura: number, altura: number): void {
    this.largura = Math.max(1, Math.round(largura));
    this.altura = Math.max(1, Math.round(altura));
    this.invalidar();
  }

  /** Descarta os resultados lidos (modelo editado, câmera trocada de vista). */
  invalidar(): void {
    this.porPixel.clear();
    this.ultimaChave = '';
  }

  /** Resultado já lido para este pixel e câmera, ou null (e aí o chamador usa o BVH). */
  ler(ndc: { x: number; y: number }, camera: THREE.Camera): ElementHit | null {
    const chave = this.chave(ndc, camera);
    return this.porPixel.get(chave) ?? null;
  }

  /** Pede a leitura do pixel para o próximo quadro (uma leitura em voo por vez). */
  pedir(ndc: { x: number; y: number }, camera: THREE.Camera): void {
    const chave = this.chave(ndc, camera);
    if (chave === this.ultimaChave || this.porPixel.has(chave)) return;
    this.pedido = { ndc: { x: ndc.x, y: ndc.y }, camera };
    this.ultimaChave = chave;
    if (!this.emVoo) void this.processar();
  }

  /** Leitura direta (clique): renderiza, espera a GPU e devolve o elemento sob o pixel. */
  async pick(ndc: { x: number; y: number }, camera: THREE.Camera): Promise<ElementHit | null> {
    const hit = await this.executar(ndc, camera);
    this.guardar(this.chave(ndc, camera), hit);
    return hit;
  }

  /** Libera o alvo e o material (a tabela e as geometrias de id saem com a cena). */
  dispose(): void {
    this.alvo.dispose();
    this.material.dispose();
    this.espelho.clear();
    this.porPixel.clear();
  }

  // ---- interno ----

  private chave(ndc: { x: number; y: number }, camera: THREE.Camera): string {
    const px = this.pixel(ndc.x, this.largura);
    const py = this.pixel(ndc.y, this.altura);
    return `${px}:${py}:${this.versaoDaCameraDe(camera)}`;
  }

  private pixel(ndc: number, tamanho: number): number {
    return Math.max(0, Math.min(tamanho - 1, Math.floor((ndc * 0.5 + 0.5) * tamanho)));
  }

  /**
   * Versão da câmera: sobe quando a matriz do mundo ou a de projeção muda. Compara os 32 números sem alocar string por
   * chamada (o hover chama isto a cada quadro).
   */
  private versaoDaCameraDe(camera: THREE.Camera): number {
    const e = camera.matrixWorld.elements;
    const p = camera.projectionMatrix.elements;
    let mudou = this.cameraVista !== camera;
    if (!mudou) {
      for (let i = 0; i < 16 && !mudou; i++) {
        if (this.matrizVista[i] !== e[i] || this.matrizVista[i + 16] !== p[i]) mudou = true;
      }
    }
    if (mudou) {
      this.cameraVista = camera;
      for (let i = 0; i < 16; i++) {
        this.matrizVista[i] = e[i]!;
        this.matrizVista[i + 16] = p[i]!;
      }
      this.versaoDaCamera++;
    }
    return this.versaoDaCamera;
  }

  /** Guarda o resultado do pixel, com teto de entradas (o hover percorre muitos pixels). */
  private guardar(chave: string, hit: ElementHit | null): void {
    if (this.porPixel.size > 512) this.porPixel.clear();
    this.porPixel.set(chave, hit);
  }

  private async processar(): Promise<void> {
    const pedido = this.pedido;
    if (!pedido) return;
    this.pedido = null;
    this.emVoo = true;
    try {
      const chave = this.chave(pedido.ndc, pedido.camera);
      let hit: ElementHit | null = null;
      try {
        hit = await this.executar(pedido.ndc, pedido.camera);
      } catch {
        // A leitura da GPU é otimização: qualquer falha (alvo recriado, contexto perdido) deixa o BVH responder.
        hit = null;
      }
      this.guardar(chave, hit);
      this.aoResolver?.(hit);
    } finally {
      this.emVoo = false;
      if (this.pedido) void this.processar();
    }
  }

  /**
   * Desenha o modelo no alvo de 1×1 recortando o pixel pedido (a câmera de recorte mantém a projeção da câmera real) e lê
   * os dois anexos. Nada da cena do app é alterado: o passe usa uma cena espelho com as mesmas geometrias.
   */
  private async executar(ndc: { x: number; y: number }, camera: THREE.Camera): Promise<ElementHit | null> {
    this.montarEspelho();
    if (this.espelho.children.length === 0) return null;
    // O app usa câmera perspectiva ou ortográfica; as duas têm `far` e `setViewOffset`.
    const alvo = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const px = this.pixel(ndc.x, this.largura);
    const pyTopo = this.altura - 1 - this.pixel(ndc.y, this.altura);
    const cam = this.cameraDeRecorte(alvo, px, pyTopo);
    const limite = Math.max(1, alvo.far * 2);
    (this.material.uniforms.uLimite as { value: number }).value = limite;

    const corAntes = this.renderer.getClearColor(this.corDeFundo).clone();
    const alphaAntes = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 0);
    // O alvo é apontado por `setRenderTarget` (o `render` do three só recebe cena e câmera): sem isto o passe de IDs saía
    // no canvas e a leitura do alvo voltava vazia. O dublê dos testes não tem o método e devolve os pixels no `render`.
    this.renderer.setRenderTarget?.(this.alvo);
    try {
      this.renderer.render(this.espelho, cam);
    } finally {
      this.renderer.setRenderTarget?.(null);
      this.renderer.setClearColor(corAntes, alphaAntes);
    }

    const [id, dist] = await Promise.all([
      this.renderer.readRenderTargetPixelsAsync(this.alvo, 0, 0, 1, 1, this.bytesId, 0, 0),
      this.renderer.readRenderTargetPixelsAsync(this.alvo, 0, 0, 1, 1, this.bytesDistancia, 0, 1),
    ]);
    // O three devolve `undefined` quando o framebuffer do alvo não está disponível (alvo recriado/contexto perdido).
    // A leitura por GPU é otimização: nesse caso o chamador cai no BVH, sem quebrar o hover.
    if (!id || !dist) return null;
    const codigo = desempacotar24(id);
    if (codigo === CODIGO_VAZIO) return null;
    const entrada = this.tabela.entrada(codigo);
    if (!entrada) return null;
    const t = decodificarDistancia(desempacotar24(dist), limite);
    const ponto = this.pontoDoRaio(cam, t);
    return { id: entrada.id, kind: entrada.kind, point: { x: ponto.x, y: ponto.y, z: ponto.z } };
  }

  /** Ponto (mundo) a `t` metros da câmera de recorte, na direção do pixel (centro do sub-frustum). */
  private pontoDoRaio(cam: THREE.Camera, t: number): THREE.Vector3 {
    const raio = new THREE.Raycaster();
    raio.setFromCamera(new THREE.Vector2(0, 0), cam);
    return raio.ray.origin.clone().addScaledVector(raio.ray.direction, t);
  }

  /**
   * Câmera de recorte: cópia da câmera real (perspectiva ou ortográfica) com o pixel pedido como viewport de 1×1. O
   * `setViewOffset` do three já trata as duas projeções; a matriz do mundo é copiada da real.
   */
  private cameraDeRecorte(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, px: number, pyTopo: number): THREE.Camera {
    const cam = camera.clone() as unknown as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    cam.matrixAutoUpdate = false;
    cam.matrixWorldAutoUpdate = false;
    cam.setViewOffset(this.largura, this.altura, px, pyTopo, 1, 1);
    cam.matrixWorld.copy(camera.matrixWorld);
    cam.matrixWorldInverse.copy(camera.matrixWorld).invert();
    return cam;
  }

  /** Cena espelho: uma malha por malha do modelo com faixas, com a geometria de IDs e a matriz do mundo. */
  private montarEspelho(): void {
    this.espelho.clear();
    this.raiz.updateMatrixWorld(true);
    this.raiz.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.ranges) return;
      const geo = geometriaDeId(mesh, this.tabela);
      if (!geo) return;
      const m = new THREE.Mesh(geo, this.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(mesh.matrixWorld);
      m.frustumCulled = false;
      this.espelho.add(m);
    });
  }
}
