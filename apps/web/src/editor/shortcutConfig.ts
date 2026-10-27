import { create } from 'zustand';
import { PERFIS_ATALHOS, PERFIL_ATALHOS_PADRAO, TODOS_COMANDOS_ATALHO, type ComandoAtalho, type MapaAtalhos, type PerfilAtalhos } from '@hestia/tools';
import { safeGet, safeSet } from './storage.ts';
import { conflitoAtalhos, mensagemConflito, normalizarSequencia } from './shortcuts.ts';

/** Chave do localStorage: perfil escolhido e mapa comando → sequência (preferência do navegador, não do projeto). */
const CHAVE = 'hestia.atalhos';
const FORMATO = 'hestia-atalhos';

export interface EstadoAtalhos {
  perfil: PerfilAtalhos;
  atalhos: MapaAtalhos;
}

/** Cópia dos padrões de um perfil. */
function padraoDo(perfil: PerfilAtalhos): MapaAtalhos {
  return { ...PERFIS_ATALHOS[perfil].atalhos };
}

/** Lê um texto de configuração (localStorage ou arquivo exportado). Valida comandos, sequências e conflitos. */
export function lerAtalhosJson(texto: string): { ok: true; estado: EstadoAtalhos } | { ok: false; erro: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'O arquivo não é um JSON válido.' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, erro: 'Formato inesperado de atalhos.' };
  const o = obj as { formato?: unknown; perfil?: unknown; atalhos?: unknown };
  if (o.formato !== undefined && o.formato !== FORMATO) return { ok: false, erro: 'Este arquivo não é de atalhos do Hestia.' };
  if (!o.atalhos || typeof o.atalhos !== 'object' || Array.isArray(o.atalhos)) return { ok: false, erro: 'Falta o campo "atalhos".' };
  const perfil: PerfilAtalhos = o.perfil === 'simples' || o.perfil === 'revit' ? o.perfil : PERFIL_ATALHOS_PADRAO;
  const conhecidos = new Set<string>(TODOS_COMANDOS_ATALHO);
  const mapa: MapaAtalhos = {};
  for (const [cmd, valor] of Object.entries(o.atalhos as Record<string, unknown>)) {
    if (!conhecidos.has(cmd)) return { ok: false, erro: `Comando desconhecido: "${cmd}".` };
    // Texto vazio significa "sem atalho".
    if (valor === '') continue;
    const seq = typeof valor === 'string' ? normalizarSequencia(valor) : undefined;
    if (!seq) return { ok: false, erro: `Sequência inválida para "${cmd}": use de 1 a 4 letras ou números.` };
    mapa[cmd as ComandoAtalho] = seq;
  }
  const conf = conflitoAtalhos(mapa);
  if (conf) return { ok: false, erro: mensagemConflito(conf) };
  return { ok: true, estado: { perfil, atalhos: mapa } };
}

/** Carrega a configuração salva. Sem armazenamento, sem dado ou dado inválido: padrão do perfil. */
function carregar(): EstadoAtalhos {
  const padrao: EstadoAtalhos = { perfil: PERFIL_ATALHOS_PADRAO, atalhos: padraoDo(PERFIL_ATALHOS_PADRAO) };
  const raw = safeGet(CHAVE);
  if (!raw) return padrao;
  const lido = lerAtalhosJson(raw);
  return lido.ok ? lido.estado : padrao;
}

export const useAtalhos = create<EstadoAtalhos>(() => carregar());

/** Texto do arquivo de atalhos (o mesmo formato usado para exportar e para guardar no navegador). */
export function exportarAtalhos(): string {
  const { perfil, atalhos } = useAtalhos.getState();
  const linhas: MapaAtalhos = {};
  for (const cmd of TODOS_COMANDOS_ATALHO) linhas[cmd] = atalhos[cmd] ?? '';
  return JSON.stringify({ formato: FORMATO, versao: 1, perfil, atalhos: linhas }, null, 2);
}

/** Troca o mapa (validado) e guarda no navegador. Devolve a mensagem de conflito, ou null se aplicou. */
function aplicar(atalhos: MapaAtalhos, perfil: PerfilAtalhos = useAtalhos.getState().perfil): string | null {
  const conf = conflitoAtalhos(atalhos);
  if (conf) return mensagemConflito(conf);
  useAtalhos.setState({ perfil, atalhos });
  safeSet(CHAVE, exportarAtalhos());
  return null;
}

/** Grava uma sequência para um comando. Recusa entrada inválida ou conflito (devolve a mensagem). */
export function atribuirAtalho(cmd: ComandoAtalho, entrada: string): string | null {
  const seq = normalizarSequencia(entrada);
  if (!seq) return 'Use de 1 a 4 letras ou números, sem espaços.';
  return aplicar({ ...useAtalhos.getState().atalhos, [cmd]: seq });
}

/** Tira o atalho de um comando. */
export function removerAtalho(cmd: ComandoAtalho): string | null {
  const prox = { ...useAtalhos.getState().atalhos };
  delete prox[cmd];
  return aplicar(prox);
}

/** Volta um comando ao atalho padrão do perfil atual (ou nenhum, se o perfil não tem). */
export function restaurarAtalho(cmd: ComandoAtalho): string | null {
  const prox = { ...useAtalhos.getState().atalhos };
  const padrao = PERFIS_ATALHOS[useAtalhos.getState().perfil].atalhos[cmd];
  if (padrao) prox[cmd] = padrao;
  else delete prox[cmd];
  return aplicar(prox);
}

/** Volta todos os comandos aos padrões do perfil atual. */
export function restaurarTodos(): string | null {
  return aplicar(padraoDo(useAtalhos.getState().perfil));
}

/** Troca de perfil: os padrões do perfil escolhido substituem as alterações feitas no anterior. */
export function trocarPerfil(perfil: PerfilAtalhos): string | null {
  return aplicar(padraoDo(perfil), perfil);
}

/** Importa um arquivo de atalhos. Devolve a mensagem de erro, ou null se aplicou. */
export function importarAtalhos(texto: string): string | null {
  const lido = lerAtalhosJson(texto);
  if (!lido.ok) return lido.erro;
  return aplicar(lido.estado.atalhos, lido.estado.perfil);
}
