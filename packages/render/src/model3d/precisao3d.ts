/**
 * Precisão da vista 3D (Fase 2.7): diagnóstico de profundidade, de coordenadas de mundo (RTC) e da disponibilidade de
 * profundidade reversa. Não muda a imagem: mede o que a cena tem e devolve o que é seguro mudar.
 *
 * Decisão desta frente, com números: o z-fighting que aparece em projeto grande **não** é falta de bits de profundidade,
 * é geometria coplanar (piso sobre laje, camadas de parede no mesmo plano). Num buffer de 24 bits com plano próximo de
 * 0,5 m, a resolução a 100 m é ~1,2 mm e a 600 m é ~4 cm; reduzir o plano distante de 2000 m para ~500 m muda a resolução
 * em ~0,1 % (o plano próximo domina), então o ganho não justifica o risco de recortar o chão/névoa. O caminho que muda a
 * ordem de grandeza é a profundidade reversa (ou logarítmica), que depende do `WebGLRenderer` (`gpu.ts`, dono do R1/W1):
 * `precisao3d.ts` detecta `EXT_clip_control` e deixa o diagnóstico pronto para essa troca.
 */

/** Bits do buffer de profundidade padrão do WebGL2 (24 bits, sem stencil de 8). */
export const BITS_PROFUNDIDADE = 24;

/** Profundidade reversa: disponível quando o contexto expõe `EXT_clip_control` (o three exige a extensão). */
export const EXTENSAO_CLIP_CONTROL = 'EXT_clip_control';

/** Diagnóstico de precisão de uma câmera em perspectiva. */
export interface DiagnosticoProfundidade {
  near: number;
  far: number;
  /** Relação far/near (quanto maior, pior a distribuição do buffer clássico). */
  relacao: number;
  bits: number;
  /** Menor distância distinguível (m) a 1 m, 10 m, 100 m e no plano distante. */
  resolucao: { em1m: number; em10m: number; em100m: number; noFar: number };
  /** Câmera usa profundidade reversa (three: `camera.reversedDepth`). */
  reversa: boolean;
}

/**
 * Menor distância (m) que o buffer de profundidade distingue a `z` metros da câmera, no mapeamento clássico
 * `d = f/(f−n) · (1 − n/z)`: `Δz = (f−n)·z² / (f·n·(2^bits − 1))`. Perto do plano próximo a precisão é alta; longe, cai
 * com z².
 */
export function resolucaoProfundidade(z: number, near: number, far: number, bits = BITS_PROFUNDIDADE): number {
  const n = Number.isFinite(near) ? Math.max(1e-6, near) : 1e-6;
  const f = Number.isFinite(far) ? Math.max(n, far) : n;
  const b = Number.isFinite(bits) ? Math.max(1, Math.min(32, Math.floor(bits))) : BITS_PROFUNDIDADE;
  const distancia = Number.isFinite(z) ? Math.max(0, Math.min(f, z)) : 0;
  return ((f - n) * distancia * distancia) / (f * n * (2 ** b - 1));
}

/** Diagnóstico de uma câmera: planos, relação, resolução em pontos de referência e profundidade reversa. */
export function diagnosticarProfundidade(
  camera: { near: number; far: number; reversedDepth?: boolean },
  bits = BITS_PROFUNDIDADE,
): DiagnosticoProfundidade {
  const near = Number.isFinite(camera.near) ? Math.max(1e-6, camera.near) : 1e-6;
  const far = Number.isFinite(camera.far) ? Math.max(near, camera.far) : near;
  return {
    near,
    far,
    relacao: far / near,
    bits,
    resolucao: {
      em1m: resolucaoProfundidade(1, near, far, bits),
      em10m: resolucaoProfundidade(10, near, far, bits),
      em100m: resolucaoProfundidade(100, near, far, bits),
      noFar: resolucaoProfundidade(far, near, far, bits),
    },
    reversa: camera.reversedDepth === true,
  };
}

/** Se o contexto WebGL2 pode usar profundidade reversa (o three exige `EXT_clip_control`). */
export function clipControlDisponivel(gl: { getExtension(nome: string): unknown } | null | undefined): boolean {
  if (!gl) return false;
  try {
    return gl.getExtension(EXTENSAO_CLIP_CONTROL) !== null;
  } catch {
    return false;
  }
}

/** Análise de rebase de origem (RTC) para um modelo numa caixa de mundo. */
export interface DiagnosticoOrigem {
  /** Maior coordenada absoluta da caixa (m). */
  maiorCoordenada: number;
  /** Resolução do float32 nessa coordenada (m): `|x| · 2^−23`. */
  resolucaoFloat32: number;
  /** A origem deve ser rebaseada para a cena manter precisão abaixo de `tolerancia`. */
  rebaseNecessario: boolean;
  /** Sugestão de origem local (centro da caixa, arredondado ao metro). */
  origemSugerida: { x: number; y: number; z: number };
}

/**
 * RTC (rebased origin): com `float32`, a resolução absoluta cresce com a coordenada. Em projeto local (origem no próprio
 * prédio) a maior coordenada fica na casa das centenas de metros e a resolução é sub-milimétrica; um projeto georreferenciado
 * (UTM, ~5·10^5 m) perde precisão de centímetros e precisa de rebase. A cena não rebaseia sozinha (mudaria a origem do
 * picking e das cotas); o diagnóstico diz quando o rebase é necessário, para o dono da vista decidir.
 */
export function diagnosticarOrigem(caixa: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null, tolerancia = 0.001): DiagnosticoOrigem {
  if (!caixa) {
    return { maiorCoordenada: 0, resolucaoFloat32: 0, rebaseNecessario: false, origemSugerida: { x: 0, y: 0, z: 0 } };
  }
  const coordenadas = [caixa.min.x, caixa.min.y, caixa.min.z, caixa.max.x, caixa.max.y, caixa.max.z];
  const maiorCoordenada = coordenadas.reduce((m, v) => Math.max(m, Number.isFinite(v) ? Math.abs(v) : 0), 0);
  const resolucaoFloat32 = maiorCoordenada * 2 ** -23;
  return {
    maiorCoordenada,
    resolucaoFloat32,
    rebaseNecessario: resolucaoFloat32 > tolerancia,
    origemSugerida: {
      x: Math.round((caixa.min.x + caixa.max.x) / 2),
      y: Math.round((caixa.min.y + caixa.max.y) / 2),
      z: Math.round((caixa.min.z + caixa.max.z) / 2),
    },
  };
}
