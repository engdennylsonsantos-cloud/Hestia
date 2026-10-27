import { ceilingIssues, outlineIssues, projectIssues, roofEaveIssues, roofSurfaceIssues, roofWallIssues, roomValidationIssues, stairValidationIssues, wallFloorIssues } from '@hestia/engine';
import { validateProject, type Project, type ValidationIssue } from '@hestia/model';

/** Avisos do projeto: os de validação, os de parede que ultrapassa ou fica fora do telhado (C2), os degraus da superfície, os de beiral sobre parede ou abertura, os do croqui e de norma das escadas, os de ambiente, os do contorno associativo de piso e laje e os de abertura/parede do projeto. */
export const avisosDoProjeto = (p: Project): ValidationIssue[] => [...validateProject(p), ...roofWallIssues(p), ...roofSurfaceIssues(p), ...roofEaveIssues(p), ...stairValidationIssues(p), ...roomValidationIssues(p), ...ceilingIssues(p), ...outlineIssues(p), ...wallFloorIssues(p), ...projectIssues(p)];

/** Tempo de silêncio, em ms, antes de calcular os avisos de um projeto. Vale para qualquer tamanho de modelo. */
export const SETTLE_MS = 300;
/** Espera máxima (ms) pela janela ociosa depois das duas pinturas. Passou disso, os avisos são calculados de todo modo. */
export const ESPERA_OCIOSA_MS = 1000;

/** Agenda `tarefa` para o próximo quadro (ou um temporizador, em ambiente sem `requestAnimationFrame`). */
function agendarQuadro(tarefa: () => void): { cancelar: () => void } {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(tarefa);
    return { cancelar: () => cancelAnimationFrame(id) };
  }
  const id = setTimeout(tarefa, 16);
  return { cancelar: () => clearTimeout(id) };
}

/** Agenda `tarefa` para uma janela ociosa do navegador (ou o próximo temporizador, sem `requestIdleCallback`). */
function agendarOcioso(tarefa: () => void): { cancelar: () => void } {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(tarefa, { timeout: ESPERA_OCIOSA_MS });
    return { cancelar: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(tarefa, 0);
  return { cancelar: () => clearTimeout(id) };
}

/**
 * Agenda o cálculo dos avisos de `p` para depois de `ms` (padrão SETTLE_MS). O resultado é o mesmo de `avisosDoProjeto(p)`,
 * só chega depois do primeiro quadro: passado o silêncio, espera **duas pinturas** e uma janela ociosa. Num projeto grande a
 * validação custa segundos; assim ela nunca segura o primeiro quadro da abertura (nem o desenho exato de uma edição), que
 * é o que o usuário vê. Devolve a função que cancela a agenda (troca de projeto ou desmontagem).
 */
export function agendarAvisos(p: Project, receber: (avisos: ValidationIssue[]) => void, ms: number = SETTLE_MS): () => void {
  let feito = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let quadro: { cancelar: () => void } | null = null;
  let ocioso: { cancelar: () => void } | null = null;
  const rodar = (): void => {
    if (feito) return;
    feito = true;
    receber(avisosDoProjeto(p));
  };
  const naJanelaOciosa = (): void => {
    if (feito) return;
    ocioso = agendarOcioso(rodar);
  };
  const noSegundoQuadro = (): void => {
    if (feito) return;
    quadro = agendarQuadro(naJanelaOciosa);
  };
  const noPrimeiroQuadro = (): void => {
    if (feito) return;
    quadro = agendarQuadro(noSegundoQuadro);
  };
  timer = setTimeout(noPrimeiroQuadro, ms);
  return () => {
    feito = true;
    if (timer !== null) clearTimeout(timer);
    quadro?.cancelar();
    ocioso?.cancelar();
  };
}
