import * as THREE from 'three';

/** Câmera orbital com Z para cima: arrastar gira, Shift/botão do meio desloca, roda aproxima. */
export class OrbitCamera {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 2000);
  target = new THREE.Vector3(0, 0, 1);
  azimuth = -Math.PI / 4;
  elevation = 0.5;
  distance = 14;

  constructor() {
    this.camera.up.set(0, 0, 1);
    this.apply();
  }

  setAspect(w: number, h: number): void {
    this.camera.aspect = Math.max(1e-3, w / Math.max(1, h));
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

  pan(dxPx: number, dyPx: number): void {
    const k = this.distance * 0.0016;
    const right = new THREE.Vector3(-Math.sin(this.azimuth), Math.cos(this.azimuth), 0);
    const forward = new THREE.Vector3(Math.cos(this.azimuth), Math.sin(this.azimuth), 0);
    this.target.addScaledVector(right, -dxPx * k);
    this.target.addScaledVector(forward, dyPx * k);
    this.apply();
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
