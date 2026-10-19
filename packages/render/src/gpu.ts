import * as THREE from 'three';

export type Backend = 'webgpu' | 'webgl2' | 'none';

export interface GpuContext {
  backend: Backend;
  renderer: THREE.WebGLRenderer;
  setSize(w: number, h: number, dpr: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  /** Chamado se o dispositivo de GPU for perdido (driver reiniciou, aba em segundo plano, etc.). */
  onLost(cb: (reason: string) => void): void;
  dispose(): void;
}

type WebGpuCtor = new (o: { canvas: HTMLCanvasElement; antialias: boolean }) => THREE.WebGLRenderer & {
  init(): Promise<void>;
  backend?: { isWebGPUBackend?: boolean };
};

async function tryWebGpu(canvas: HTMLCanvasElement): Promise<GpuContext | null> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  if (!nav.gpu) return null;
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return null;
    const mod = await import('three/webgpu');
    const Ctor = mod.WebGPURenderer as unknown as WebGpuCtor;
    const r = new Ctor({ canvas, antialias: true });
    await r.init();
    if (!r.backend?.isWebGPUBackend) {
      r.dispose();
      return null; // o three caiu sozinho para WebGL: seguimos o caminho WebGL2 padrão, com canvas novo
    }
    const ctx = wrap(r, 'webgpu');
    const dev = (r.backend as unknown as { device?: { lost?: Promise<{ message?: string }> } } | undefined)?.device;
    dev?.lost?.then((info) => lostCbs.get(ctx)?.(info?.message ?? 'dispositivo perdido'));
    return ctx;
  } catch {
    return null;
  }
}

const lostCbs = new WeakMap<GpuContext, (reason: string) => void>();

function wrap(r: THREE.WebGLRenderer, backend: Backend): GpuContext {
  const ctx: GpuContext = {
    backend,
    renderer: r,
    setSize(w, h, dpr) {
      r.setPixelRatio(dpr);
      r.setSize(w, h, false);
    },
    render(scene, camera) {
      r.render(scene, camera);
    },
    onLost(cb) {
      lostCbs.set(ctx, cb);
      r.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        cb('contexto WebGL perdido');
      });
    },
    dispose() {
      r.dispose();
    },
  };
  return ctx;
}

export interface GpuResult {
  gpu: GpuContext;
  canvas: HTMLCanvasElement;
}

/**
 * GPU primeiro (docs/01 §2): WebGPU quando existe; senão WebGL2. Devolve null sem suporte —
 * o app então usa o renderizador de planta em CPU. Um canvas só aceita um tipo de contexto,
 * por isso cada tentativa recebe um canvas novo da fábrica.
 */
export async function createGpu(newCanvas: () => HTMLCanvasElement, prefer: 'auto' | 'webgl2' = 'auto'): Promise<GpuResult | null> {
  if (prefer === 'auto') {
    const c = newCanvas();
    const gpu = await tryWebGpu(c);
    if (gpu) return { gpu, canvas: c };
  }
  try {
    const canvas = newCanvas();
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!r.getContext()) return null;
    return { gpu: wrap(r, 'webgl2'), canvas };
  } catch {
    return null;
  }
}
