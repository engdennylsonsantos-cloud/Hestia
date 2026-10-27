import { TOOL_LABEL, type ToolId } from './registry.ts';

/** Comando que recebe um atalho: uma ferramenta, ou o próprio diálogo de atalhos. */
export type ComandoAtalho = ToolId | 'atalhos';

/** Perfil de atalhos: 'revit' (sequências de duas letras, padrão) ou 'simples' (uma letra por ferramenta). */
export type PerfilAtalhos = 'revit' | 'simples';

/** Mapa comando → sequência de teclas (letras e dígitos, maiúsculas). Comando ausente = sem atalho. */
export type MapaAtalhos = Partial<Record<ComandoAtalho, string>>;

/**
 * Padrões iniciais dos atalhos, em dados: para mudar um padrão, edite a sequência aqui.
 * A configuração do usuário (localStorage, tela Atalhos de teclado) sobrescreve estes valores.
 */
export const PERFIS_ATALHOS: Record<PerfilAtalhos, { nome: string; atalhos: MapaAtalhos }> = {
  revit: {
    nome: 'Revit (duas letras)',
    atalhos: {
      wall: 'WA', door: 'DR', window: 'WN', floor: 'SB', slab: 'LJ', ceiling: 'FR', roof: 'TL', stair: 'ES', stairrun: 'LE',
      slope: 'IN', roofarrow: 'SI', room: 'RM', dimension: 'DI', text: 'TX',
      move: 'MV', copy: 'CO', rotate: 'RO', mirror: 'MM', array: 'AR', offset: 'OF', split: 'SL', trim: 'TR', align: 'AL',
      parallel: 'PP', joins: 'UG', measure: 'ME', section: 'CT', rehost: 'TH', attachroof: 'AT', detachroof: 'DT',
      atalhos: 'KS',
    },
  },
  simples: {
    nome: 'Simples (uma letra)',
    atalhos: {
      wall: 'W', floor: 'F', slab: 'B', roof: 'U', door: 'D', window: 'J', move: 'M', copy: 'C', rotate: 'R', mirror: 'S',
      array: 'A', offset: 'O', parallel: 'G', trim: 'T', align: 'L', joins: 'N', split: 'P', measure: 'E', section: 'K',
      rehost: 'H', stair: 'I', stairrun: 'Q', dimension: 'Y', text: 'X', room: 'Z',
      atalhos: 'V',
    },
  },
};

export const PERFIL_ATALHOS_PADRAO: PerfilAtalhos = 'revit';

/** Ferramentas que ficam sem atalho em cada perfil de fábrica (sem letra livre ou fora da lista aprovada). Podem receber um atalho pela tela. */
export const SEM_ATALHO_NO_PERFIL: Record<PerfilAtalhos, ToolId[]> = {
  revit: ['select', 'roofextrusion'],
  simples: ['select', 'ceiling', 'slope', 'roofarrow', 'roofextrusion', 'attachroof', 'detachroof'],
};

/** Todos os comandos que podem receber atalho: as ferramentas e o diálogo de atalhos. */
export const TODOS_COMANDOS_ATALHO: ComandoAtalho[] = [...(Object.keys(TOOL_LABEL) as ToolId[]), 'atalhos'];
