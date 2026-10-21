import * as THREE from 'three';

/**
 * Vista padrão do app (botão Início e abertura da vista 3D): azimute −45° (câmera a sudeste, x leste, y norte) e
 * elevação de 0,5 rad.
 */
export const HOME_VIEW: { readonly azimuth: number; readonly elevation: number } = { azimuth: -Math.PI / 4, elevation: 0.5 };

/** Elevação da órbita por arrasto: a câmera fica acima do chão (o drag não passa de −0,05 nem de 1,5 rad). */
const DRAG_ELEVATION = { min: -0.05, max: 1.5 };
/** Elevação das vistas de topo e de base (cubo): quase 90°, sem degenerar a orientação da câmera. */
export const POLE_ELEVATION = Math.PI / 2 - 0.02;
const DISTANCE = { min: 0.5, max: 600 };

/** Vista destino de uma animação. `target` e `distance` são opcionais: sem eles, o alvo e a distância ficam como estão. */
export interface OrbitView {
  azimuth: number;
  elevation: number;
  distance?: number;
  target?: THREE.Vector3;
}

interface Tween {
  from: { azimuth: number; elevation: number; distance: number; target: THREE.Vector3 };
  to: { azimuth: number; elevation: number; distance: number; target: THREE.Vector3 | null };
  ms: number;
  /** Instante do primeiro passo (ms, como performance.now()); null até o primeiro `step`. */
  t0: number | null;
}

/** Ângulo normalizado para (−π, π]. */
export function wrapAngle(a: number): number {
  const t = ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return t === -Math.PI ? Math.PI : t;
}

/** Suavização cúbica: começa e termina devagar. Vai de 0 a 1 e passa por 0,5 no meio. */
export function easeInOut(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/**
 * Base da câmera orbital, na mesma convenção de `OrbitCamera.apply`: `toCamera` aponta do alvo para a câmera;
 * `right` (horizontal) e `up` são os eixos da tela. Não degenera para elevação alta.
 */
export function cameraBasis(azimuth: number, elevation: number): { toCamera: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 } {
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  const toCamera = new THREE.Vector3(ce * ca, ce * sa, se);
  const right = new THREE.Vector3(-sa, ca, 0);
  const forward = toCamera.clone().negate();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { toCamera, right, up };
}

/** Câmera orbital com Z para cima: arrastar gira, Shift/botão do meio desloca, roda aproxima. */
export class OrbitCamera {
  /** Câmera em perspectiva (padrão). */
  readonly perspective = new THREE.PerspectiveCamera(38, 1, 0.05, 2000);
  /**
   * Câmera ortogonal alternativa. O enquadramento é o mesmo da perspectiva: a meia altura visível é
   * distância·tan(fov/2), que é a altura da perspectiva no plano do alvo.
   */
  readonly orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 2000);
  target = new THREE.Vector3(0, 0, 1);
  azimuth = HOME_VIEW.azimuth;
  elevation = HOME_VIEW.elevation;
  distance = 14;
  /** Projeção ativa: true usa a câmera ortogonal. */
  ortho = false;
  /** Altura da área de desenho em px CSS (define a escala do pan). */
  private viewHeightPx = 600;
  private aspect = 1;
  private anim: Tween | null = null;

  constructor() {
    this.perspective.up.set(0, 0, 1);
    this.orthographic.up.set(0, 0, 1);
    this.apply();
  }

  /** Câmera ativa (perspectiva ou ortogonal): é a que o renderizador e a seleção usam. */
  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.ortho ? this.orthographic : this.perspective;
  }

  /** Troca entre perspectiva e ortogonal; o enquadramento (alvo, distância, ângulos) não muda. */
  setOrtho(on: boolean): void {
    this.ortho = on;
    this.apply();
  }

  /** Anima até a vista dada (suave, azimute pelo menor arco). Um novo `animateTo` substitui o anterior. */
  animateTo(v: OrbitView, ms = 350): void {
    this.anim = {
      from: { azimuth: this.azimuth, elevation: this.elevation, distance: this.distance, target: this.target.clone() },
      to: {
        azimuth: v.azimuth,
        elevation: Math.max(-POLE_ELEVATION, Math.min(POLE_ELEVATION, v.elevation)),
        distance: v.distance === undefined ? this.distance : Math.max(DISTANCE.min, Math.min(DISTANCE.max, v.distance)),
        target: v.target ? v.target.clone() : null,
      },
      ms: Math.max(0, ms),
      t0: null,
    };
  }

  /** Há uma animação em curso. */
  get animating(): boolean {
    return this.anim !== null;
  }

  /** Para a animação onde ela estiver (a câmera fica na última posição). */
  cancelAnimation(): void {
    this.anim = null;
  }

  /**
   * Avança a animação até `now` (ms, como performance.now()). O primeiro passo marca o início. Devolve true enquanto
   * ainda anima, para o laço de desenho pedir o próximo quadro.
   */
  step(now: number): boolean {
    const a = this.anim;
    if (!a) return false;
    if (a.t0 === null) a.t0 = now;
    const k = a.ms <= 0 ? 1 : Math.min(1, (now - a.t0) / a.ms);
    const e = easeInOut(k);
    const { from, to } = a;
    this.azimuth = from.azimuth + wrapAngle(to.azimuth - from.azimuth) * e;
    this.elevation = from.elevation + (to.elevation - from.elevation) * e;
    this.distance = from.distance + (to.distance - from.distance) * e;
    if (to.target) this.target.lerpVectors(from.target, to.target, e);
    if (k >= 1) {
      this.azimuth = wrapAngle(this.azimuth);
      this.anim = null;
    }
    this.apply();
    return this.anim !== null;
  }

  setAspect(w: number, h: number): void {
    this.aspect = Math.max(1e-3, w / Math.max(1, h));
    this.viewHeightPx = Math.max(1, h);
    this.perspective.aspect = this.aspect;
    this.perspective.updateProjectionMatrix();
    this.updateFrustum();
  }

  apply(): void {
    const ce = Math.cos(this.elevation);
    const pos = new THREE.Vector3(
      this.target.x + this.distance * ce * Math.cos(this.azimuth),
      this.target.y + this.distance * ce * Math.sin(this.azimuth),
      this.target.z + this.distance * Math.sin(this.elevation),
    );
    for (const c of [this.perspective, this.orthographic]) {
      c.position.copy(pos);
      c.lookAt(this.target);
      c.updateMatrixWorld();
    }
    this.updateFrustum();
  }

  /** Frustro ortogonal: meia altura = distância·tan(fov/2), a mesma da perspectiva no plano do alvo. */
  private updateFrustum(): void {
    const half = this.distance * Math.tan((this.perspective.fov * Math.PI) / 360);
    const c = this.orthographic;
    c.top = half;
    c.bottom = -half;
    c.right = half * this.aspect;
    c.left = -half * this.aspect;
    c.updateProjectionMatrix();
  }

  orbit(dxPx: number, dyPx: number): void {
    this.cancelAnimation();
    this.azimuth -= dxPx * 0.006;
    // Um arrasto nunca aumenta a faixa em que a câmera já está (ex.: vista de topo sem salto para 1,5 rad).
    const lo = Math.min(DRAG_ELEVATION.min, this.elevation);
    const hi = Math.max(DRAG_ELEVATION.max, this.elevation);
    this.elevation = Math.max(lo, Math.min(hi, this.elevation + dyPx * 0.006));
    this.apply();
  }

  /**
   * Desloca a vista no plano da tela: a cena segue o cursor em qualquer ângulo.
   * Eixos da câmera: direita = normalizado(cross(frente, Z)), cima = cross(direita, frente).
   * Escala: a altura visível na distância do alvo é 2·d·tan(fov/2), que cobre viewHeightPx (vale para as duas câmeras).
   */
  pan(dxPx: number, dyPx: number): void {
    this.cancelAnimation();
    const { right, up } = cameraBasis(this.azimuth, this.elevation);
    const unitsPerPx = (2 * this.distance * Math.tan((this.perspective.fov * Math.PI) / 360)) / this.viewHeightPx;
    // Arrastar para a direita/baixo move o alvo para a esquerda/cima, de modo que a cena acompanha o cursor.
    this.target.addScaledVector(right, -dxPx * unitsPerPx);
    this.target.addScaledVector(up, dyPx * unitsPerPx);
    this.apply();
  }

  zoom(delta: number): void {
    this.cancelAnimation();
    this.distance = Math.max(DISTANCE.min, Math.min(DISTANCE.max, this.distance * Math.pow(1.0016, delta)));
    this.apply();
  }

  /** Alvo e distância que enquadram a caixa. Caixa vazia: a vista do modelo vazio (alvo na origem a 1 m do chão, 14 m). */
  framing(box: THREE.Box3): { target: THREE.Vector3; distance: number } {
    if (box.isEmpty()) return { target: new THREE.Vector3(0, 0, 1), distance: 14 };
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    return { target: c, distance: Math.max(3, (r / Math.sin((this.perspective.fov * Math.PI) / 360)) * 1.05) };
  }

  fit(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    this.cancelAnimation();
    const f = this.framing(box);
    this.target.copy(f.target);
    this.distance = f.distance;
    this.apply();
  }
}
