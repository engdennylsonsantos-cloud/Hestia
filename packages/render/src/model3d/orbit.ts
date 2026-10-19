import * as THREE from 'three';

/** Câmera orbital com Z para cima: arrastar gira, Shift/botão do meio desloca, roda aproxima. */
export class OrbitCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 2000);
  target = new THREE.Vector3(0, 0, 1);
  azimuth = -Math.PI / 4;
  elevation = 0.5;
  distance = 14;
  /** Altura da área de desenho em px CSS (define a escala do pan). */
  private viewHeightPx = 600;

  constructor() {
    this.camera.up.set(0, 0, 1);
    this.apply();
  }

  setAspect(w: number, h: number): void {
    this.camera.aspect = Math.max(1e-3, w / Math.max(1, h));
    this.viewHeightPx = Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  apply(): void {
    const ce = Math.cos(this.elevation);
    this.camera.position.set(
      this.target.x + this.distance * ce * Math.cos(this.azimuth),
      this.target.y + this.distance * ce * Math.sin(this.azimuth),
      this.target.z + this.distance * Math.sin(this.elevation),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  orbit(dxPx: number, dyPx: number): void {
    this.azimuth -= dxPx * 0.006;
    this.elevation = Math.max(-0.05, Math.min(1.5, this.elevation + dyPx * 0.006));
    this.apply();
  }

  /**
   * Desloca a vista no plano da tela: a cena segue o cursor em qualquer ângulo.
   * Eixos da câmera: direita = normalizado(cross(frente, Z)), cima = cross(direita, frente).
   * Escala: a altura visível na distância do alvo é 2·d·tan(fov/2), que cobre viewHeightPx.
   */
  pan(dxPx: number, dyPx: number): void {
    const { right, up } = this.screenAxes();
    const unitsPerPx = (2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / this.viewHeightPx;
    // Arrastar para a direita/baixo move o alvo para a esquerda/cima, de modo que a cena acompanha o cursor.
    this.target.addScaledVector(right, -dxPx * unitsPerPx);
    this.target.addScaledVector(up, dyPx * unitsPerPx);
    this.apply();
  }

  /** Base da tela (direita, cima) a partir de azimute e elevação; sem degeneração para elevação alta. */
  private screenAxes(): { right: THREE.Vector3; up: THREE.Vector3 } {
    const ca = Math.cos(this.azimuth);
    const sa = Math.sin(this.azimuth);
    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    // Direita horizontal: igual a normalizado(cross(frente, Z)) para |elevação| < 90°, e nunca nula.
    const right = new THREE.Vector3(-sa, ca, 0);
    // Frente: da câmera para o alvo.
    const forward = new THREE.Vector3(-ce * ca, -ce * sa, -se);
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { right, up };
  }

  zoom(delta: number): void {
    this.distance = Math.max(0.5, Math.min(600, this.distance * Math.pow(1.0016, delta)));
    this.apply();
  }

  fit(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    this.target.copy(c);
    this.distance = Math.max(3, (r / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.05);
    this.apply();
  }
}
