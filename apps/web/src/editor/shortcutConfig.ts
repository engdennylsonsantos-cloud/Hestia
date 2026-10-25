import { create } from 'zustand';
import { COMANDOS_COM_ATALHO, PERFIL_PADRAO, SHORTCUT_PROFILES, nomeComando, type ShortcutCommand, type ShortcutMap, type ShortcutProfile } from '@hestia/tools';
import { CasadorSequencia, conflitoDe, conflitoNoMapa, normalizaSequencia } from './shortcuts.ts';

const CHAVE = 'hestia.atalhos.v1';
const FORMATO = 'hestia-atalhos';

/** Alterações do usuário sobre o perfil: `null` = comando sem atalho; ausente = padrão do perfil. */
export type Alteracoes = Partial<Record<ShortcutCommand, string | null>>;

export interface AtalhosState {
  perfil: ShortcutProfile;
  alteracoes: Alteracoes;
  /** Mapa efetivo (perfil + alterações), comando → sequência. */
  mapa: ShortcutMap;
  /** Sequência parcial digitada (buffer), para a barra de status. */
  pendente: string;
}

/** Monta o mapa efetivo: o padrão do perfil com as alterações por cima. */
export function montaMapa(perfil: ShortcutProfile, alteracoes: Alteracoes): ShortcutMap {
  const base = SHORTCUT_PROFILES[perfil];
  const mapa: ShortcutMap = {};
  for (const cmd of COMANDOS_COM_ATALHO) {
    const alterado = cmd in alteracoes ? alteracoes[cmd] : base[cmd];
    if (typeof alterado === 'string') mapa[cmd] = alterado;
  }
  return mapa;
}

/** Alterações que levam o padrão do perfil ao mapa dado (só o que difere). */
export function alteracoesDe(perfil: ShortcutProfile, mapa: ShortcutMap): Alteracoes {
  const base = SHORTCUT_PROFILES[perfil];
  const out: Alteracoes = {};
  for (const cmd of COMANDOS_COM_ATALHO) {
    const seq = mapa[cmd];
    if (seq !== base[cmd]) out[cmd] = seq ?? null;
  }
  return out;
}

/** Lê a configuração salva; qualquer falha (sem localStorage, JSON inválido, conflito) volta ao padrão. */
function carregaSalva(): { perfil: ShortcutProfile; alteracoes: Alteracoes } {
  const padrao = { perfil: PERFIL_PADRAO, alteracoes: {} as Alteracoes };
  try {
    const raw = globalThis.localStorage?.getItem(CHAVE);
    if (!raw) return padrao;
    const dado = JSON.parse(raw) as { perfil?: unknown; alteracoes?: unknown };
    if (!ehPerfil(dado.perfil)) return padrao;
    const perfil = dado.perfil;
    const mapa = mapaDeComandos(perfil, dado.alteracoes);
    return mapa && !conflitoNoMapa(mapa) ? { perfil, alteracoes: alteracoesDe(perfil, mapa) } : padrao;
  } catch {
    return padrao;
  }
}

/** Interpreta um objeto comando → sequência|null (vindo do arquivo ou do localStorage). Null se algo estiver fora do formato. */
function mapaDeComandos(perfil: ShortcutProfile, cmds: unknown): ShortcutMap | null {
  if (cmds === undefined) return montaMapa(perfil, {});
  if (!cmds || typeof cmds !== 'object' || Array.isArray(cmds)) return null;
  const alteracoes: Alteracoes = {};
  for (const [cmd, valor] of Object.entries(cmds as Record<string, unknown>)) {
    if (!(COMANDOS_COM_ATALHO as string[]).includes(cmd)) return null;
    if (valor === null) alteracoes[cmd as ShortcutCommand] = null;
    else if (typeof valor === 'string' && normalizaSequencia(valor)) alteracoes[cmd as ShortcutCommand] = normalizaSequencia(valor)!;
    else return null;
  }
  return montaMapa(perfil, alteracoes);
}

function salva(perfil: ShortcutProfile, alteracoes: Alteracoes): void {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify({ perfil, alteracoes }));
  } catch {
    // Sem armazenamento (janela privada, dados bloqueados): a alteração vale só nesta sessão.
  }
}

/** Confere se o valor é um perfil conhecido (sem aceitar chaves herdadas, como "toString"). */
function ehPerfil(v: unknown): v is ShortcutProfile {
  return typeof v === 'string' && (Object.keys(SHORTCUT_PROFILES) as string[]).includes(v);
}

const inicial = carregaSalva();

/** Estado dos atalhos. A faixa, a barra de status e o diálogo leem daqui. */
export const useAtalhos = create<AtalhosState>(() => ({
  perfil: inicial.perfil,
  alteracoes: inicial.alteracoes,
  mapa: montaMapa(inicial.perfil, inicial.alteracoes),
  pendente: '',
}));

/** Grava uma nova configuração (perfil + alterações): atualiza o mapa e salva. */
function aplica(perfil: ShortcutProfile, alteracoes: Alteracoes): void {
  useAtalhos.setState({ perfil, alteracoes, mapa: montaMapa(perfil, alteracoes) });
  salva(perfil, alteracoes);
}

export type ResultadoAtalho = { ok: true; mensagem: string } | { ok: false; erro: string };

/** Atribui uma sequência a um comando. Recusa sequência inválida ou em conflito, dizendo quem já a usa. */
export function atribuirAtalho(cmd: ShortcutCommand, raw: string): ResultadoAtalho {
  const seq = normalizaSequencia(raw);
  if (!seq) return { ok: false, erro: 'Use de 1 a 4 letras ou números, sem espaços.' };
  const { perfil, mapa } = useAtalhos.getState();
  const novo: ShortcutMap = { ...mapa, [cmd]: seq };
  const conflito = conflitoDe(mapa, cmd, seq);
  if (conflito) {
    return { ok: false, erro: `"${seq}" já é usada por ${nomeComando(conflito.comando)}${conflito.motivo === 'prefixo' ? ` (começa igual a "${conflito.sequencia}")` : ''}. Escolha outra.` };
  }
  aplica(perfil, alteracoesDe(perfil, novo));
  return { ok: true, mensagem: `${nomeComando(cmd)}: atalho ${seq}.` };
}

/** Tira o atalho de um comando (ele passa a não ter tecla). */
export function removerAtalho(cmd: ShortcutCommand): void {
  const { perfil, mapa } = useAtalhos.getState();
  const novo: ShortcutMap = { ...mapa };
  delete novo[cmd];
  aplica(perfil, alteracoesDe(perfil, novo));
}

/** Volta um comando ao atalho do perfil. */
export function restaurarAtalho(cmd: ShortcutCommand): void {
  const { perfil, alteracoes } = useAtalhos.getState();
  const proximo = { ...alteracoes };
  delete proximo[cmd];
  aplica(perfil, proximo);
}

/** Volta todos os atalhos ao padrão do perfil atual. */
export function restaurarTodos(): void {
  aplica(useAtalhos.getState().perfil, {});
}

/** Troca de perfil: começa do padrão do perfil escolhido (as alterações do perfil anterior são descartadas). */
export function trocarPerfil(perfil: ShortcutProfile): void {
  aplica(perfil, {});
}

/** Conteúdo do arquivo de exportação: perfil e o mapa completo (null = sem atalho). */
export function exportaAtalhos(): string {
  const { perfil, mapa } = useAtalhos.getState();
  const comandos: Record<string, string | null> = {};
  for (const cmd of COMANDOS_COM_ATALHO) comandos[cmd] = mapa[cmd] ?? null;
  return JSON.stringify({ formato: FORMATO, versao: 1, perfil, comandos }, null, 2) + '\n';
}

/**
 * Importa um arquivo exportado (ou escrito à mão). Comandos ausentes voltam ao padrão do perfil;
 * `null` tira o atalho. Recusa arquivo malformado, comando desconhecido ou sequência em conflito.
 */
export function importaAtalhos(texto: string): ResultadoAtalho {
  let dado: { formato?: unknown; versao?: unknown; perfil?: unknown; comandos?: unknown };
  try {
    dado = JSON.parse(texto) as typeof dado;
  } catch {
    return { ok: false, erro: 'O arquivo não é um JSON válido.' };
  }
  if (dado.formato !== FORMATO || dado.versao !== 1) return { ok: false, erro: 'Arquivo que não é de atalhos do Hestia (formato ou versão diferentes).' };
  const perfil = dado.perfil ?? useAtalhos.getState().perfil;
  if (!ehPerfil(perfil)) return { ok: false, erro: 'Perfil desconhecido no arquivo.' };
  const mapa = mapaDeComandos(perfil, dado.comandos);
  if (!mapa) return { ok: false, erro: 'Comandos inválidos: cada comando precisa existir e ter uma sequência de letras e números, ou null.' };
  const conflito = conflitoNoMapa(mapa);
  if (conflito) {
    return { ok: false, erro: `Conflito no arquivo: ${nomeComando(conflito.a)} e ${nomeComando(conflito.b)} usam "${conflito.sequencia}". Nada foi importado.` };
  }
  aplica(perfil, alteracoesDe(perfil, mapa));
  return { ok: true, mensagem: 'Atalhos importados.' };
}

/** Sequência atual de um comando (a da configuração, qualquer perfil). Null se o comando não tem tecla. */
export function atalhoAtual(cmd: ShortcutCommand): string | null {
  return useAtalhos.getState().mapa[cmd] ?? null;
}

/** " (X)" com o atalho atual do comando, ou vazio se não tem tecla: para textos da interface sem letra fixa. */
export function sufixoAtalho(cmd: ShortcutCommand): string {
  const seq = atalhoAtual(cmd);
  return seq ? ` (${seq})` : '';
}

/** Casador da tela: lê o mapa atual e mostra o buffer na barra de status. */
export const casador = new CasadorSequencia(
  () => useAtalhos.getState().mapa,
  (buf) => useAtalhos.setState({ pendente: buf }),
);
