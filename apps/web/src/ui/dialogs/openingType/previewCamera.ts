import { buildOpeningModel, frameOfWall, openingGeometry, partTransformed } from '@hestia/engine';
import { openingAngle3d, wallBaseElevation, type Opening, type Project, type Wall } from '@hestia/model';
import type { OrbitCamera } from '@hestia/render';

/** Ponto no mundo da prévia (metros). */
export interface PreviewPoint {
  x: number;
  y: number;
  z: number;
}

/** Caixa alinhada aos eixos do mundo. */
export interface PreviewBox {
  min: PreviewPoint;
  max: PreviewPoint;
}

/** Câmera orbital da prévia 3D, já enquadrada na esquadria. */
export interface PreviewCamera {
  /** Posição da câmera no mundo. */
  position: PreviewPoint;
  /** Centro do vão (alvo da órbita). */
  target: PreviewPoint;
  /** Distância do alvo à câmera (m). */
  distance: number;
  /** Zoom adicional da câmera (a distância já enquadra; fica em 1). */
  zoom: number;
  /** Azimute da órbita (rad). */
  yaw: number;
  /** Elevação da órbita (rad). */
  pitch: number;
  /** Campo de visão vertical da câmera do projeto (graus). */
  fov: number;
  /** Proporção da área de prévia (4:3). */
  aspect: number;
  /** Caixa englobante da esquadria (vão, folha aberta e alizar). */
  box: PreviewBox;
  /** Fração da altura da área ocupada pela caixa (0,7 = 70%). */
  occupancy: number;
}

/** Ângulos e ocupação da câmera da prévia (spec E §4.4 e acabamento visual). */
export const PREVIEW_CAMERA = {
  yaw: (-35 * Math.PI) / 180,
  pitch: (20 * Math.PI) / 180,
  fov: 38,
  aspect: 4 / 3,
  occupancy: 0.7,
  /** Folga horizontal desejada, para o vão nunca encostar nas laterais. */
  sideFill: 0.82,
} as const;

interface Basis {
  toCamera: PreviewPoint;
  right: PreviewPoint;
  up: PreviewPoint;
}

const negate = (v: PreviewPoint): PreviewPoint => ({ x: -v.x, y: -v.y, z: -v.z });

/** Base da órbita: mesma convenção de `cameraBasis` do render (`toCamera`, `right`, `up`). */
function basis(yaw = PREVIEW_CAMERA.yaw, pitch = PREVIEW_CAMERA.pitch): Basis {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const ce = Math.cos(pitch);
  const se = Math.sin(pitch);
  const toCamera = { x: ce * ca, y: ce * sa, z: se };
  const right = { x: -sa, y: ca, z: 0 };
  const forward = negate(toCamera);
  const c = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  const len = Math.hypot(c.x, c.y, c.z) || 1;
  return { toCamera, right, up: { x: c.x / len, y: c.y / len, z: c.z / len } };
}

function emptyBox(): PreviewBox {
  return {
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };
}

function include(box: PreviewBox, p: PreviewPoint): void {
  box.min.x = Math.min(box.min.x, p.x);
  box.min.y = Math.min(box.min.y, p.y);
  box.min.z = Math.min(box.min.z, p.z);
  box.max.x = Math.max(box.max.x, p.x);
  box.max.y = Math.max(box.max.y, p.y);
  box.max.z = Math.max(box.max.z, p.z);
}

const centerOf = (box: PreviewBox): PreviewPoint => ({
  x: (box.min.x + box.max.x) / 2,
  y: (box.min.y + box.max.y) / 2,
  z: (box.min.z + box.max.z) / 2,
});

/** Os oito cantos da caixa. */
function cornersOf(box: PreviewBox): PreviewPoint[] {
  const out: PreviewPoint[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) out.push({ x, y, z });
    }
  }
  return out;
}

/** Extensão da caixa na direção unitária `axis`. */
function extentOn(box: PreviewBox, axis: PreviewPoint): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of cornersOf(box)) {
    const d = p.x * axis.x + p.y * axis.y + p.z * axis.z;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return max - min;
}

/**
 * Caixa da esquadria no mundo, incluindo a folha no estado aberto (`angle3d` e correr todo aberto) e as peças do tipo
 * (alizar, peitoril, verga). Vão livre sem peças cai no próprio retângulo do vão.
 */
export function previewCameraBox(p: Project, o: Opening): PreviewBox {
  const wall = p.elements[o.hostId] as Wall | undefined;
  const frame = frameOfWall(p, o.hostId);
  const type = p.openingTypes[o.typeId];
  if (!frame || !wall || wall.kind !== 'wall') return emptyBox();
  const g = openingGeometry(p, o, frame);
  const baseZ = wallBaseElevation(p, wall) + g.sill;
  const box = emptyBox();
  const model = buildOpeningModel(p, o, g, frame);
  const angle = ((type ? openingAngle3d(type) : 90) * Math.PI) / 180;
  const state = { angle, slide: 1 };
  for (const part of model.parts) {
    const ob = partTransformed(part, state);
    const b = ob.bounds;
    for (const t of [b.t0, b.t1]) {
      for (const s of [b.s0, b.s1]) {
        for (const z of [b.z0, b.z1]) {
          include(box, {
            x: g.center.x + g.u.x * t + g.n.x * s,
            y: g.center.y + g.u.y * t + g.n.y * s,
            z: baseZ + z,
          });
        }
      }
    }
  }
  if (!Number.isFinite(box.min.x)) {
    for (const t of [-g.width / 2, g.width / 2]) {
      for (const s of [-g.thickness / 2, g.thickness / 2]) {
        for (const z of [0, g.height]) {
          include(box, {
            x: g.center.x + g.u.x * t + g.n.x * s,
            y: g.center.y + g.u.y * t + g.n.y * s,
            z: baseZ + z,
          });
        }
      }
    }
  }
  return box;
}

/** Ocupação vertical da caixa para a câmera dada (fração da altura visível no plano do alvo). */
export function previewCameraOccupancy(camera: PreviewCamera): number {
  const { up } = basis(camera.yaw, camera.pitch);
  const extent = extentOn(camera.box, up);
  const visible = 2 * camera.distance * Math.tan((camera.fov * Math.PI) / 360);
  return visible > 1e-9 ? extent / visible : 0;
}

/**
 * Câmera orbital que enquadra a esquadria: alvo no centro da caixa do vão (com folha aberta e alizar), yaw −35°,
 * pitch 20° e distância calculada para a caixa ocupar 70% da altura da área (4:3), sem estourar as laterais. Função
 * pura: depende só do projeto e da abertura.
 */
export function previewCamera(p: Project, o: Opening): PreviewCamera {
  const { yaw, pitch, fov, aspect, occupancy, sideFill } = PREVIEW_CAMERA;
  const box = previewCameraBox(p, o);
  const target = centerOf(box);
  const { toCamera, right, up } = basis(yaw, pitch);
  const tan = Math.tan((fov * Math.PI) / 360);
  const vertical = extentOn(box, up);
  const horizontal = extentOn(box, right);
  const forVertical = vertical / (2 * occupancy * tan);
  const forHorizontal = horizontal / (2 * sideFill * tan * aspect);
  const distance = Math.max(0.5, forVertical, forHorizontal);
  const position = {
    x: target.x + toCamera.x * distance,
    y: target.y + toCamera.y * distance,
    z: target.z + toCamera.z * distance,
  };
  const camera: PreviewCamera = {
    position,
    target,
    distance,
    zoom: 1,
    yaw,
    pitch,
    fov,
    aspect,
    box,
    occupancy,
  };
  return { ...camera, occupancy: previewCameraOccupancy(camera) };
}

/** Aplica a câmera da prévia na órbita do `ModelScene` (a distância já enquadra; o zoom fica neutro). */
export function applyPreviewCamera(orbit: OrbitCamera, camera: PreviewCamera): void {
  orbit.cancelAnimation();
  orbit.target.set(camera.target.x, camera.target.y, camera.target.z);
  orbit.azimuth = camera.yaw;
  orbit.elevation = camera.pitch;
  orbit.distance = camera.distance;
  orbit.perspective.zoom = camera.zoom;
  orbit.perspective.updateProjectionMatrix();
  orbit.apply();
}
