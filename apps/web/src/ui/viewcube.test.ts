import { describe, expect, it } from 'vitest';
import { POLE_ELEVATION, cameraBasis } from '@hestia/render';
import {
  CUBE_FACES,
  CUBE_HALF_PX,
  CUBE_ZONES,
  FACE_NORMAL_CSS,
  applyMatrixValues,
  cellCenter,
  cellSign,
  cubeMatrix,
  cubeMatrixValues,
  faceCells,
  turnAzimuth,
  viewForZone,
  worldToCss,
  zoneAtPoint,
  zoneById,
  zoneId,
  type Face,
} from './viewcube.ts';

const DEG = Math.PI / 180;
const TH = Math.sqrt(1 / 3);

/** Vistas de teste: cobrem todos os quadrantes e elevações baixas, médias e de polo. */
const VIEWS: [number, number][] = [];
for (const az of [-180, -135, -90, -45, 0, 45, 90, 135, 179]) for (const el of [-POLE_ELEVATION, -1.1, -0.3, 0, 0.5, 1.2, POLE_ELEVATION]) VIEWS.push([az * DEG, el]);

/** Tela CSS esperada de um ponto do mundo: x = p·direita, y = −p·cima, z = p·até-a-câmera. */
function screenOf(p: readonly [number, number, number], az: number, el: number): [number, number, number] {
  const { toCamera: d, right: r, up: u } = cameraBasis(az, el);
  const dot = (v: { x: number; y: number; z: number }): number => p[0] * v.x + p[1] * v.y + p[2] * v.z;
  return [dot(r), -dot(u), dot(d)];
}

describe('zonas do ViewCube', () => {
  it('são 26 zonas: 6 faces, 12 arestas e 8 cantos, com ids únicos', () => {
    expect(CUBE_ZONES).toHaveLength(26);
    expect(CUBE_ZONES.filter((z) => z.kind === 'face')).toHaveLength(6);
    expect(CUBE_ZONES.filter((z) => z.kind === 'edge')).toHaveLength(12);
    expect(CUBE_ZONES.filter((z) => z.kind === 'corner')).toHaveLength(8);
    expect(new Set(CUBE_ZONES.map((z) => z.id)).size).toBe(26);
  });

  it('o id segue a ordem topo/frente-trás/direita-esquerda', () => {
    expect(zoneId([1, -1, 1])).toBe('top-front-right');
    expect(zoneId([-1, 1, 0])).toBe('back-left');
    expect(zoneId([0, 0, -1])).toBe('bottom');
    expect(zoneById('top-front-left').kind).toBe('corner');
  });

  it('rótulos em pt-BR nas faces; nomes de vista para qualquer zona', () => {
    const labels = CUBE_ZONES.filter((z) => z.kind === 'face').map((z) => z.label).sort();
    expect(labels).toEqual(['BASE', 'DIREITA', 'ESQUERDA', 'FRENTE', 'TOPO', 'TRASEIRA']);
    expect(zoneById('front').name).toBe('Vista de frente');
    expect(zoneById('front-right').name).toBe('Vista de frente e direita');
    expect(zoneById('top-front-right').name).toBe('Vista de topo, frente e direita');
    expect(zoneById('top-front').label).toBe('');
  });

  it('cada face tem 9 células; uma aresta aparece em duas faces e um canto em três', () => {
    const count = new Map<string, number>();
    for (const f of CUBE_FACES) for (const c of faceCells(f)) count.set(c.zone.id, (count.get(c.zone.id) ?? 0) + 1);
    expect(count.size).toBe(26);
    for (const z of CUBE_ZONES) {
      const want = z.kind === 'face' ? 1 : z.kind === 'edge' ? 2 : 3;
      expect(count.get(z.id), z.id).toBe(want);
    }
  });

  it('o centro de cada face é a zona da face; as bordas da grade são arestas e os cantos são cantos', () => {
    for (const f of CUBE_FACES) {
      const cells = faceCells(f);
      const center = cells.find((c) => c.row === 1 && c.col === 1)!;
      expect(center.zone.kind).toBe('face');
      expect(center.zone.id).toBe(f);
      for (const c of cells) {
        const onRim = (c.row !== 1) !== (c.col !== 1);
        const corner = c.row !== 1 && c.col !== 1;
        expect(c.zone.kind).toBe(corner ? 'corner' : onRim ? 'edge' : 'face');
      }
    }
  });

  it('a grade fica certa: frente no topo à esquerda é topo-frente-esquerda; topo da face direita é a aresta traseira', () => {
    expect(zoneId(cellSign('front', 0, 0))).toBe('top-front-left');
    expect(zoneId(cellSign('front', 2, 2))).toBe('bottom-front-right');
    // Face direita (leste) vista de fora: a coluna da direita é o norte.
    expect(zoneId(cellSign('right', 1, 2))).toBe('back-right');
    expect(zoneId(cellSign('right', 1, 0))).toBe('front-right');
    // Topo: a linha de cima é o norte.
    expect(zoneId(cellSign('top', 0, 1))).toBe('top-back');
    expect(zoneId(cellSign('bottom', 0, 1))).toBe('bottom-front');
  });
});

describe('vista de cada zona', () => {
  it('faces olham de frente: frente = sul (câmera ao sul), direita = leste, traseira = norte, esquerda = oeste', () => {
    const at = (id: Face, az = 0.4): { azimuth: number; elevation: number } => viewForZone(zoneById(id).sign, az);
    expect(at('front').azimuth).toBeCloseTo(-Math.PI / 2, 12);
    expect(at('front').elevation).toBeCloseTo(0, 12);
    expect(at('right').azimuth).toBeCloseTo(0, 12);
    expect(at('back').azimuth).toBeCloseTo(Math.PI / 2, 12);
    expect(Math.abs(at('left').azimuth)).toBeCloseTo(Math.PI, 12);
  });

  it('topo e base: elevação de polo e azimute atual, sem girar a tela', () => {
    expect(viewForZone(zoneById('top').sign, 1.1)).toEqual({ azimuth: 1.1, elevation: POLE_ELEVATION });
    expect(viewForZone(zoneById('bottom').sign, -0.6)).toEqual({ azimuth: -0.6, elevation: -POLE_ELEVATION });
  });

  it('arestas e cantos olham na diagonal', () => {
    const v = (id: string): { azimuth: number; elevation: number } => viewForZone(zoneById(id).sign, 0);
    expect(v('front-right').azimuth).toBeCloseTo(-Math.PI / 4, 12);
    expect(v('front-right').elevation).toBeCloseTo(0, 12);
    expect(v('top-front').elevation).toBeCloseTo(Math.PI / 4, 12);
    expect(v('top-front').azimuth).toBeCloseTo(-Math.PI / 2, 12);
    expect(v('top-front-right').azimuth).toBeCloseTo(-Math.PI / 4, 12);
    expect(v('top-front-right').elevation).toBeCloseTo(Math.asin(TH), 12);
    expect(v('bottom-back-left').elevation).toBeCloseTo(-Math.asin(TH), 12);
  });

  it('a direção da câmera é a da zona: a câmera fica do lado da zona', () => {
    for (const z of CUBE_ZONES) {
      const v = viewForZone(z.sign, 0.3);
      const d = cameraBasis(v.azimuth, v.elevation).toCamera;
      const s = z.sign;
      const n = Math.hypot(s[0], s[1], s[2]);
      const dot = (s[0] * d.x + s[1] * d.y + s[2] * d.z) / n;
      expect(dot, z.id).toBeGreaterThan(0.9995);
    }
  });

  it('girar 90° soma ou subtrai π/2 do azimute; esquerda é +', () => {
    expect(turnAzimuth(0, 1)).toBeCloseTo(Math.PI / 2, 12);
    expect(turnAzimuth(0, -1)).toBeCloseTo(-Math.PI / 2, 12);
    expect(turnAzimuth(-Math.PI / 4, -1)).toBeCloseTo(-3 * Math.PI / 4, 12);
  });
});

describe('orientação do cubo (matriz CSS)', () => {
  it('na vista de frente a matriz é a identidade (a face sul fica voltada para a tela)', () => {
    const m = cubeMatrixValues(-Math.PI / 2, 0);
    const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    m.forEach((v, i) => expect(Math.abs(v - id[i]!)).toBeLessThan(1e-9));
  });

  it('é uma rotação própria: colunas ortonormais e det = +1', () => {
    for (const [az, el] of VIEWS) {
      const m = cubeMatrixValues(az, el);
      const c = (i: number): number[] => [m[4 * i]!, m[4 * i + 1]!, m[4 * i + 2]!];
      const dot = (a: number[], b: number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
      for (let i = 0; i < 3; i++) expect(dot(c(i), c(i))).toBeCloseTo(1, 9);
      expect(dot(c(0), c(1))).toBeCloseTo(0, 9);
      expect(dot(c(0), c(2))).toBeCloseTo(0, 9);
      expect(dot(c(1), c(2))).toBeCloseTo(0, 9);
      const [a, b, cc] = [c(0), c(1), c(2)] as [number[], number[], number[]];
      const det =
        a[0]! * (b[1]! * cc[2]! - b[2]! * cc[1]!) - b[0]! * (a[1]! * cc[2]! - a[2]! * cc[1]!) + cc[0]! * (a[1]! * b[2]! - a[2]! * b[1]!);
      expect(det).toBeCloseTo(1, 9);
    }
  });

  it('leva cada ponto do mundo para a posição de tela da câmera (x direita, y para baixo, z para o observador)', () => {
    for (const [az, el] of VIEWS) {
      const m = cubeMatrixValues(az, el);
      for (const p of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.3, -0.7, 0.4],
      ] as const) {
        const got = applyMatrixValues(m, worldToCss(p));
        const want = screenOf(p, az, el);
        for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i]!, 9);
      }
    }
  });

  it('a face que aponta para a câmera tem z > 0 no espaço da tela (é a que aparece)', () => {
    const faceNormal: Record<Face, [number, number, number]> = {
      front: [0, -1, 0],
      back: [0, 1, 0],
      right: [1, 0, 0],
      left: [-1, 0, 0],
      top: [0, 0, 1],
      bottom: [0, 0, -1],
    };
    for (const [az, el] of VIEWS) {
      const m = cubeMatrixValues(az, el);
      const d = cameraBasis(az, el).toCamera;
      for (const f of CUBE_FACES) {
        const n = faceNormal[f];
        const facing = n[0] * d.x + n[1] * d.y + n[2] * d.z;
        const screen = applyMatrixValues(m, FACE_NORMAL_CSS[f]);
        // O normal CSS da face, depois da matriz, tem a mesma profundidade que o normal do mundo na direção da câmera.
        expect(screen[2]).toBeCloseTo(facing, 9);
      }
    }
  });

  it('a matriz de texto é matrix3d com 16 valores', () => {
    expect(cubeMatrix(0.2, 0.3).startsWith('matrix3d(')).toBe(true);
    expect(cubeMatrix(0.2, 0.3).split(',')).toHaveLength(16);
  });

  it('o cubo gira no mesmo sentido da tela (a vista de leste mostra o norte à direita)', () => {
    // Azimute 0: câmera a leste. A direita da tela é o norte (+y do mundo), que deve ir para +x da tela.
    const m = cubeMatrixValues(0, 0);
    const north = applyMatrixValues(m, worldToCss([0, 1, 0]));
    expect(north[0]).toBeCloseTo(1, 9);
    expect(north[1]).toBeCloseTo(0, 9);
  });
});

describe('clique por ponto (zoneAtPoint)', () => {
  const H = CUBE_HALF_PX;
  const FACE_N: Record<Face, [number, number, number]> = {
    front: [0, -1, 0],
    back: [0, 1, 0],
    right: [1, 0, 0],
    left: [-1, 0, 0],
    top: [0, 0, 1],
    bottom: [0, 0, -1],
  };

  it('o centro de cada célula visível cai na própria zona, em qualquer vista', () => {
    let checked = 0;
    for (const [az, el] of VIEWS) {
      const { toCamera: d, right: r, up: u } = cameraBasis(az, el);
      for (const f of CUBE_FACES) {
        const n = FACE_N[f];
        if (n[0] * d.x + n[1] * d.y + n[2] * d.z <= 1e-6) continue; // face de costas: não se vê
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++) {
            const w = cellCenter(f, row, col);
            const x = H * (w[0] * r.x + w[1] * r.y + w[2] * r.z);
            const y = -H * (w[0] * u.x + w[1] * u.y + w[2] * u.z);
            expect(zoneAtPoint(az, el, x, y)?.id, `${f} ${row}${col} az ${az} el ${el}`).toBe(zoneId(cellSign(f, row, col)));
            checked++;
          }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('fora da silhueta do cubo não há zona', () => {
    for (const [az, el] of VIEWS) expect(zoneAtPoint(az, el, 2 * H, 0)).toBeNull();
  });

  it('o centro da tela na vista padrão é o canto de frente, direita e topo; de frente, a face frente', () => {
    expect(zoneAtPoint(-Math.PI / 4, 0.5, 0, 0)?.id).toBe('top-front-right');
    expect(zoneAtPoint(-Math.PI / 2, 0, 0, 0)?.id).toBe('front');
    expect(zoneAtPoint(-Math.PI / 4, 0, 0, 0)?.id).toBe('front-right');
  });
});

describe('vistas de referência', () => {
  it('a casa (Início) fica na vista padrão do app: a câmera a sudeste, azimute −45°', () => {
    const v = viewForZone([1, -1, 0], 0);
    expect(v.azimuth).toBeCloseTo(-Math.PI / 4, 12);
  });
});
