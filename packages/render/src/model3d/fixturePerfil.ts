import type { OpeningModel, OpeningPart, PartBox, PartProfile } from '@hestia/engine';

/**
 * Fixture do batente em peça única (spec E3 §2) para os testes do render enquanto o motor de FR1 não está integrado.
 * Dimensões do `ot_p90` de referência: `J = 0,05`, `D = 0,09`, `L = 0,035`, `ov = 0,015`, `R = L + 0,004`.
 */
export const PERFIL = {
  width: 0.9,
  height: 2.1,
  thickness: 0.184,
  core: { s0: -0.07, s1: 0.07 },
  J: 0.05,
  D: 0.09,
  L: 0.035,
  ov: 0.015,
  R: 0.039,
  hw: 0.45,
  sN: -0.045,
  sS: 0.045,
} as const;

function caixa(t0: number, t1: number, s0: number, s1: number, z0: number, z1: number): PartBox {
  return { t0: Math.min(t0, t1), t1: Math.max(t0, t1), s0: Math.min(s0, s1), s1: Math.max(s0, s1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) };
}

/** Seção em L da ombreira, no plano (t, s); `j = ±1` é o lado. */
export function perfilDaOmbreira(j: 1 | -1): { box: PartBox; profile: PartProfile } {
  const { hw, J, ov, R, sN, sS, height } = PERFIL;
  const ts = hw - J + ov;
  const ti = hw - J;
  const pts: Array<[number, number]> = [
    [j * hw, sN],
    [j * hw, sS],
    [j * ts, sS],
    [j * ts, sS - R],
    [j * ti, sS - R],
    [j * ti, sN],
  ];
  return { box: caixa(j * hw, j * ti, sN, sS, 0, height), profile: { plane: 'ts', pts } };
}

/** Seção em L da travessa, no plano (s, z), extrudada em t de −hw a hw. */
export function perfilDaTravessa(): { box: PartBox; profile: PartProfile } {
  const { hw, J, ov, R, sN, sS, height } = PERFIL;
  const zTop = height;
  const zBase = height - J;
  const pts: Array<[number, number]> = [
    [sN, zTop],
    [sS, zTop],
    [sS, zBase + ov],
    [sS - R, zBase + ov],
    [sS - R, zBase],
    [sN, zBase],
  ];
  return { box: caixa(-hw, hw, sN, sS, zBase, zTop), profile: { plane: 'sz', pts } };
}

/** Folha do modelo, apoiada no batente (não interfere na seção do batente). */
function folha(): OpeningPart {
  const { hw, J, ov, L, D, height } = PERFIL;
  const gap = 0.004;
  const lh = hw - J + ov - gap;
  const sStop = D / 2 - (L + gap);
  return {
    id: 'leaf-0',
    role: 'leaf',
    material: 'leaf',
    box: caixa(-lh, lh, sStop, sStop + L, 0.008, height - J + ov - gap),
    motion: { kind: 'rotate', axis: 'z', t: -lh, s: sStop, sign: 1 },
    leaf: 0,
  };
}

/** Três caixas do alizar de uma face, no mesmo `group` (uma peça física em U). */
export function caixasDoAlizar(): OpeningPart[] {
  const { hw, J, height, thickness } = PERFIL;
  const width = 0.05;
  const ct = 0.015;
  const s0 = thickness / 2;
  const s1 = s0 + ct;
  const inner = hw - J;
  const outer = inner + width;
  return [
    { id: 'casing-n-left', role: 'casing', material: 'casing', box: caixa(-outer, -inner, s0, s1, 0, height), group: 'casing-n' },
    { id: 'casing-n-right', role: 'casing', material: 'casing', box: caixa(inner, outer, s0, s1, 0, height), group: 'casing-n' },
    { id: 'casing-n-head', role: 'casing', material: 'casing', box: caixa(-outer, outer, s0, s1, height - width, height), group: 'casing-n' },
  ];
}

/** Porta-fixture com ombreiras e travessa em L; `alizar` acrescenta o grupo de três caixas do acabamento. */
export function modeloComPerfil(opcoes: { alizar?: boolean } = {}): OpeningModel {
  const { width, height, thickness, core, hw } = PERFIL;
  const jambD = perfilDaOmbreira(1);
  const jambE = perfilDaOmbreira(-1);
  const head = perfilDaTravessa();
  const partes: OpeningPart[] = [
    { id: 'jamb-left', role: 'jamb', material: 'frame', box: jambE.box, profile: jambE.profile },
    { id: 'jamb-right', role: 'jamb', material: 'frame', box: jambD.box, profile: jambD.profile },
    { id: 'head', role: 'head', material: 'frame', box: head.box, profile: head.profile },
    folha(),
  ];
  if (opcoes.alizar) partes.push(...caixasDoAlizar());
  return {
    kind: 'door',
    width,
    height,
    thickness,
    core: { ...core },
    parts: partes,
    openings: [
      {
        leaf: 0,
        kind: 'side',
        side: 1,
        hingeT: -(hw - PERFIL.J + PERFIL.ov - 0.004),
        latchT: hw - PERFIL.J + PERFIL.ov - 0.004,
        pivot: { t: -(hw - PERFIL.J + PERFIL.ov - 0.004), s: PERFIL.D / 2 - (PERFIL.L + 0.004) },
        radius: 2 * (hw - PERFIL.J + PERFIL.ov - 0.004),
        z0: 0.008,
        z1: height - PERFIL.J + PERFIL.ov - 0.004,
      },
    ],
    void: false,
  };
}
