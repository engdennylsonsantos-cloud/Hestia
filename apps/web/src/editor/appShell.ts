/**
 * Comportamento de aplicativo de desktop: sem menu de contexto do navegador, sem arrastar imagens, sem zoom da página
 * e sem seleção de texto na interface. Campos de texto, tabelas de dados e o que tem `.selectable` continuam normais.
 * As funções de decisão são puras (testadas com objetos simulados); os ouvintes são registrados uma vez só.
 */

/** Só o que a lógica usa de um elemento. Assim os testes rodam sem DOM. */
export interface AlvoComClosest {
  closest(seletor: string): unknown;
}

/** Onde o usuário digita, cola e seleciona. */
const SELETOR_CAMPO = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Trechos que o usuário pode copiar: `.selectable` e as tabelas de quantitativos, camadas, atalhos e materiais. */
const SELETOR_SELECIONAVEL = '.selectable, .wsched, .layers, .kbtable, .matlist, .dialog .error, .dialog .hint';
/** Elementos que o navegador arrastaria como cópia (imagem, ícone vetorial, link). */
const SELETOR_ARRASTAVEL_NATIVO = 'img, svg, a';
const SELETOR_ARRASTAR_LIBERADO = '[draggable="true"]';
/** O canvas trata pinça e Ctrl+roda sozinho, então o zoom da página fica de fora dele. */
const SELETOR_CANVAS = '.canvas-wrap';

const TECLAS_DE_ZOOM = new Set(['+', '=', '-', '0']);
const CODIGOS_DE_ZOOM = new Set(['NumpadAdd', 'NumpadSubtract']);

function temAncestral(alvo: AlvoComClosest | null | undefined, seletor: string): boolean {
  return !!alvo && alvo.closest(seletor) != null;
}

/** Foco em campo de texto (inclusive área editável). */
export function ehCampoDeTexto(alvo: AlvoComClosest | null | undefined): boolean {
  return temAncestral(alvo, SELETOR_CAMPO);
}

/** Menu de contexto do navegador some; campos e `.selectable` mantêm o menu nativo (copiar e colar). */
export function deveBloquearContextMenu(alvo: AlvoComClosest | null | undefined): boolean {
  return !ehCampoDeTexto(alvo) && !temAncestral(alvo, '.selectable');
}

/** Impede arrastar imagem, ícone ou link para fora da página, exceto o que foi marcado como arrastável. */
export function deveBloquearArrastar(alvo: AlvoComClosest | null | undefined): boolean {
  return temAncestral(alvo, SELETOR_ARRASTAVEL_NATIVO) && !temAncestral(alvo, SELETOR_ARRASTAR_LIBERADO);
}

/** Ctrl/Cmd com +, =, -, 0 (ou as teclas do numérico) é zoom da página. */
export function ehTeclaDeZoomDaPagina(e: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  if (!e.ctrlKey && !e.metaKey) return false;
  return TECLAS_DE_ZOOM.has(e.key) || CODIGOS_DE_ZOOM.has(e.code ?? '');
}

/** Zoom pelo teclado é bloqueado fora de campos de texto: dentro deles, o atalho segue o padrão. */
export function deveBloquearZoomDaPagina(
  e: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean },
  alvo: AlvoComClosest | null | undefined,
): boolean {
  return ehTeclaDeZoomDaPagina(e) && !ehCampoDeTexto(alvo);
}

/** Ctrl+roda com o cursor fora do canvas dispara zoom da página. */
export function deveBloquearZoomPorRoda(
  e: { ctrlKey: boolean; metaKey: boolean },
  alvo: AlvoComClosest | null | undefined,
): boolean {
  return (e.ctrlKey || e.metaKey) && !temAncestral(alvo, SELETOR_CANVAS);
}

/** Ctrl+A fora de campo de texto selecionaria a página inteira. */
export function deveBloquearSelecionarTudo(
  e: { key: string; ctrlKey: boolean; metaKey: boolean },
  alvo: AlvoComClosest | null | undefined,
): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !ehCampoDeTexto(alvo);
}

/** Rede de segurança: seleção por arrasto ou duplo clique só começa em campo ou trecho copiável. */
export function deveBloquearSelecao(alvo: AlvoComClosest | null | undefined): boolean {
  return !ehCampoDeTexto(alvo) && !temAncestral(alvo, SELETOR_SELECIONAVEL);
}

/** Elemento do evento. Se o alvo é texto, sobe ao elemento que o contém. */
function alvoDoEvento(alvo: EventTarget | null): AlvoComClosest | null {
  if (alvo instanceof Element) return alvo;
  if (alvo instanceof Node) return alvo.parentElement;
  return null;
}

let instalado = false;

/** Registra os ouvintes globais uma vez. Chamar de novo não duplica nada. */
export function installAppShell(): void {
  if (instalado || typeof document === 'undefined') return;
  instalado = true;

  document.addEventListener('contextmenu', (e) => {
    if (deveBloquearContextMenu(alvoDoEvento(e.target))) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (deveBloquearArrastar(alvoDoEvento(e.target))) e.preventDefault();
  });
  // passive: false, senão o navegador ignora o preventDefault da roda com Ctrl.
  document.addEventListener(
    'wheel',
    (e) => {
      if (deveBloquearZoomPorRoda(e, alvoDoEvento(e.target))) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('keydown', (e) => {
    const alvo = alvoDoEvento(e.target);
    if (deveBloquearZoomDaPagina(e, alvo) || deveBloquearSelecionarTudo(e, alvo)) e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    if (deveBloquearSelecao(alvoDoEvento(e.target))) e.preventDefault();
  });
}
