/**
 * Política do backend gráfico (W1): ordem de fallback WebGPU → WebGL2 → CPU, restauração de contexto WebGL2 e
 * orçamento de recuperação. Sem three e sem DOM: `gpu.ts` executa o que está decidido aqui e os testes rodam em Node.
 *
 * Duas lições da sonda S0 estão codificadas neste arquivo:
 * 1. `restoreContext()` só pega depois de um `requestAnimationFrame`; uma tentativa síncrona deixa o 3D morto.
 * 2. O `GPUAdapter` do Chrome é de uso único: cada dispositivo novo pede adapter novo (feito em `gpu.ts`).
 */

export type CamadaGpu = 'webgpu' | 'webgl2' | 'cpu';
export type PreferenciaGpu = 'auto' | 'webgl2' | 'cpu';
export type EstadoRestauracao = 'nenhuma' | 'em-curso' | 'contexto' | 'dispositivo' | 'fallback';
export type EstadoTimer = 'disponivel' | 'indisponivel' | 'sem-gpu';

/** Uma tentativa de criar uma camada (o histórico fica no `?perf=1`, em `window.__hestiaGpu`). */
export interface TentativaGpu {
  camada: CamadaGpu;
  ok: boolean;
  motivo: string | null;
  ms: number;
}

/** Estado observável do backend: o que o `?perf=1` publica e o teste de recuperação lê. */
export interface EstadoGpu {
  atual: CamadaGpu | 'none';
  preferencia: PreferenciaGpu;
  tentativas: TentativaGpu[];
  /** Perdas de dispositivo/contexto desde o boot (inclui as recuperadas no lugar). */
  perdas: number;
  restauracao: EstadoRestauracao;
  /** Tentativas de `restoreContext()` da última restauração no lugar (0 quando não houve). */
  tentativasRestauracao: number;
  motivo: string | null;
  timer: EstadoTimer;
}

/** Ordem de preferência das camadas; CPU é sempre o fim da linha (`createGpu` devolve `null` e o app desenha em 2D). */
export const CAMADAS: readonly CamadaGpu[] = ['webgpu', 'webgl2', 'cpu'];

/** Quantos quadros o restore de contexto tenta antes de escalar (~6 quadros ≈ 100 ms a 60 Hz). */
export const MAX_TENTATIVAS_RESTORE = 6;
/** Recriações de dispositivo WebGPU permitidas dentro da janela antes de cair para WebGL2. */
export const MAX_RECRIACOES_WEBGPU = 2;
/** Reinícios de contexto WebGL2 (canvas novo) permitidos antes de cair para CPU. */
export const MAX_REINICIOS_WEBGL2 = 1;
/** Perdas rápidas demais: nem tenta restaurar no lugar, escala direto. */
export const MAX_PERDAS_JANELA = 6;
/** Passada a janela, o orçamento de recuperação volta ao zero (uma perda isolada por hora é normal). */
export const JANELA_RECUPERACAO_MS = 60_000;

/** Camadas a tentar, na ordem, para uma preferência. `auto` = WebGPU primeiro (usado por `?gpu=webgpu`). */
export function ordemDeFallback(preferencia: PreferenciaGpu): CamadaGpu[] {
  if (preferencia === 'cpu') return ['cpu'];
  if (preferencia === 'webgl2') return ['webgl2', 'cpu'];
  return ['webgpu', 'webgl2', 'cpu'];
}

/** Próxima camada abaixo de `camada`, ou `null` se já é a última. */
export function proximaCamada(camada: CamadaGpu): CamadaGpu | null {
  const i = CAMADAS.indexOf(camada);
  return i >= 0 && i < CAMADAS.length - 1 ? CAMADAS[i + 1]! : null;
}

export interface OpcoesRestauracao {
  /** Chama `gl.restoreContext()` (ou equivalente). */
  tentar(): void;
  /**
   * Resolve `true` quando o contexto volta ou `false` no fim do prazo. A primeira chamada acontece **antes** da
   * primeira tentativa e deve esperar um quadro: a sonda S0 mostrou que o restore síncrono nunca pega.
   */
  esperarVoltar(prazoMs: number): Promise<boolean>;
  maxTentativas?: number;
  /** Prazo de cada tentativa (padrão 150 ms). Só conta quando o contexto não volta. */
  intervaloMs?: number;
  aoTentar?(tentativa: number): void;
}

export interface ResultadoRestauracao {
  estado: 'restaurado' | 'esgotado';
  tentativas: number;
}

/**
 * Tenta restaurar o mesmo contexto WebGL2. Cada tentativa chama `restoreContext()` **uma vez** e espera o evento
 * `webglcontextrestored` (ou o prazo); repetir a chamada a cada quadro reiniciava a restauração e nunca terminava.
 */
export async function restaurarContexto(opcoes: OpcoesRestauracao): Promise<ResultadoRestauracao> {
  const max = Math.max(1, Math.trunc(opcoes.maxTentativas ?? MAX_TENTATIVAS_RESTORE));
  const prazo = Math.max(16, Math.trunc(opcoes.intervaloMs ?? 150));
  let tentativas = 0;
  if (await opcoes.esperarVoltar(prazo)) return { estado: 'restaurado', tentativas };
  for (let n = 1; n <= max; n++) {
    tentativas = n;
    opcoes.aoTentar?.(n);
    try {
      opcoes.tentar();
    } catch {
      // contexto já descartado pelo navegador: a próxima tentativa (ou a queda) decide
    }
    if (await opcoes.esperarVoltar(prazo)) return { estado: 'restaurado', tentativas };
  }
  return { estado: 'esgotado', tentativas };
}

export interface OpcoesGuarda {
  maxRecriacoesWebgpu?: number;
  maxReiniciosWebgl2?: number;
  maxPerdas?: number;
  janelaMs?: number;
  /** Relógio injetável para os testes; padrão `Date.now`. */
  agora?: () => number;
}

/**
 * Orçamento de recuperação por janela de tempo. Sem ele, um driver que perde o contexto em laço faria o app
 * reiniciar a GPU para sempre; com ele, a matriz termina em CPU e o usuário continua trabalhando em 2D.
 */
export class GuardaDeRecuperacao {
  private readonly maxWebgpu: number;
  private readonly maxWebgl2: number;
  private readonly maxPerdas: number;
  private readonly janelaMs: number;
  private readonly relogio: () => number;
  private recriacoesWebgpu = 0;
  private reiniciosWebgl2 = 0;
  private perdas = 0;
  private inicio: number | null = null;

  constructor(opcoes: OpcoesGuarda = {}) {
    this.maxWebgpu = Math.max(0, Math.trunc(opcoes.maxRecriacoesWebgpu ?? MAX_RECRIACOES_WEBGPU));
    this.maxWebgl2 = Math.max(0, Math.trunc(opcoes.maxReiniciosWebgl2 ?? MAX_REINICIOS_WEBGL2));
    this.maxPerdas = Math.max(1, Math.trunc(opcoes.maxPerdas ?? MAX_PERDAS_JANELA));
    this.janelaMs = Math.max(1, opcoes.janelaMs ?? JANELA_RECUPERACAO_MS);
    this.relogio = opcoes.agora ?? Date.now;
  }

  /** Zera a contagem quando a janela expirou; sem isso o orçamento seria vitalício. */
  private abrirJanela(agora: number): void {
    if (this.inicio === null) {
      this.inicio = agora;
      return;
    }
    if (agora - this.inicio >= this.janelaMs) {
      this.inicio = agora;
      this.perdas = 0;
      this.recriacoesWebgpu = 0;
      this.reiniciosWebgl2 = 0;
    }
  }

  registrarPerda(agora = this.relogio()): void {
    this.abrirJanela(agora);
    this.perdas += 1;
  }

  registrarRecriacaoWebgpu(agora = this.relogio()): void {
    this.abrirJanela(agora);
    this.recriacoesWebgpu += 1;
  }

  registrarReinicioWebgl2(agora = this.relogio()): void {
    this.abrirJanela(agora);
    this.reiniciosWebgl2 += 1;
  }

  podeRecriarWebgpu(agora = this.relogio()): boolean {
    this.abrirJanela(agora);
    return this.perdas <= this.maxPerdas && this.recriacoesWebgpu < this.maxWebgpu;
  }

  podeReiniciarWebgl2(agora = this.relogio()): boolean {
    this.abrirJanela(agora);
    return this.perdas <= this.maxPerdas && this.reiniciosWebgl2 < this.maxWebgl2;
  }

  /** Perdas demais na janela: o contexto está instável e restaurar no lugar só adia a queda. */
  podeRestaurarNoLugar(agora = this.relogio()): boolean {
    this.abrirJanela(agora);
    return this.perdas <= this.maxPerdas;
  }

  reiniciar(): void {
    this.inicio = null;
    this.recriacoesWebgpu = 0;
    this.reiniciosWebgl2 = 0;
    this.perdas = 0;
  }

  get resumo(): { perdas: number; recriacoesWebgpu: number; reiniciosWebgl2: number } {
    return { perdas: this.perdas, recriacoesWebgpu: this.recriacoesWebgpu, reiniciosWebgl2: this.reiniciosWebgl2 };
  }
}

export type AcaoAposPerda = 'recriar-webgpu' | 'cair-webgl2' | 'reiniciar-webgl2' | 'cair-cpu';

/** Decide (e já consome o orçamento) o que fazer depois de uma perda que não pôde ser recuperada no lugar. */
export function decidirEscalonamento(camada: CamadaGpu, guarda: GuardaDeRecuperacao): AcaoAposPerda {
  if (camada === 'webgpu') {
    if (guarda.podeRecriarWebgpu()) {
      guarda.registrarRecriacaoWebgpu();
      return 'recriar-webgpu';
    }
    return 'cair-webgl2';
  }
  if (camada === 'webgl2') {
    if (guarda.podeReiniciarWebgl2()) {
      guarda.registrarReinicioWebgl2();
      return 'reiniciar-webgl2';
    }
    return 'cair-cpu';
  }
  return 'cair-cpu';
}

/** Preferência de boot que executa a ação decidida. */
export function preferenciaDaAcao(acao: AcaoAposPerda): PreferenciaGpu {
  switch (acao) {
    case 'recriar-webgpu':
      return 'auto';
    case 'cair-cpu':
      return 'cpu';
    default:
      return 'webgl2';
  }
}

const estadoInicial = (preferencia: PreferenciaGpu): EstadoGpu => ({
  atual: 'none',
  preferencia,
  tentativas: [],
  perdas: 0,
  restauracao: 'nenhuma',
  tentativasRestauracao: 0,
  motivo: null,
  timer: 'sem-gpu',
});

let estado: EstadoGpu = estadoInicial('webgl2');
const ouvintes = new Set<(e: EstadoGpu) => void>();

/** Cópia defensiva: quem lê (overlay, teste, `window.__hestiaGpu`) não mexe no estado vivo. */
export function estadoGpu(): EstadoGpu {
  return { ...estado, tentativas: estado.tentativas.map((t) => ({ ...t })) };
}

function notificar(): void {
  for (const ouvinte of [...ouvintes]) {
    try {
      ouvinte(estadoGpu());
    } catch {
      // um ouvinte quebrado não derruba o boot
    }
  }
}

/** Reinicia o estado no começo do boot da tela (mantém a preferência pedida pela URL). */
export function reiniciarEstadoGpu(preferencia: PreferenciaGpu): void {
  estado = estadoInicial(preferencia);
  notificar();
}

export function assinarEstadoGpu(ouvinte: (e: EstadoGpu) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function registrarTentativaGpu(tentativa: TentativaGpu): void {
  estado.tentativas.push({ ...tentativa });
  if (!tentativa.ok) estado.motivo = tentativa.motivo;
  notificar();
}

export function definirBackendGpu(atual: CamadaGpu | 'none'): void {
  estado.atual = atual;
  notificar();
}

export function registrarPerdaGpu(motivo: string): void {
  estado.perdas += 1;
  estado.motivo = motivo;
  estado.restauracao = 'em-curso';
  estado.tentativasRestauracao = 0;
  notificar();
}

export function definirRestauracaoGpu(restauracao: EstadoRestauracao): void {
  estado.restauracao = restauracao;
  if (restauracao === 'em-curso') estado.tentativasRestauracao = 0;
  notificar();
}

export function registrarTentativaRestauracao(tentativa: number): void {
  estado.tentativasRestauracao = Math.max(0, Math.trunc(tentativa));
  notificar();
}

export function definirTimerGpu(timer: EstadoTimer): void {
  estado.timer = timer;
  notificar();
}
