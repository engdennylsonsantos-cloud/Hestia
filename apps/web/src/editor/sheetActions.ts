import { newSheetId, newViewportId, projectSheets, sheetInnerBox, sheetIssue, sheetOf, viewportIssue, type Command, type Id, type Project, type ProjectStore, type Sheet, type SheetViewport, type SheetViewSource } from '@hestia/model';
import { buildSheetDrawList, type SheetDrawList } from '@hestia/render';
import { exportSheetsPdf } from '@hestia/io';

/**
 * Ações sobre pranchas (decisão 0022): cada uma é um comando com desfazer. O que é função pura (número, posição, cópia)
 * fica aqui para o teste; a tela só chama.
 */

/** Passo da grade para procurar lugar livre (mm). */
const SPOT_STEP = 10;
/** Tamanho padrão de uma vista nova (mm de papel); encolhe se não couber na área de desenho. */
const DEFAULT_SIZE: Record<SheetViewSource['kind'], { w: number; h: number }> = { plan: { w: 180, h: 130 }, section: { w: 180, h: 100 }, '3d': { w: 180, h: 130 } };
export const SCALE_OPTIONS = [20, 25, 50, 100, 200, 500] as const;

/** Número seguinte da prancha: A-101, A-102, … a partir do que já existe. */
export function nextSheetNumber(p: Pick<Project, 'sheets'>): string {
  const used = new Set(projectSheets(p).map((s) => s.number));
  let n = 101 + projectSheets(p).length;
  while (used.has(`A-${n}`)) n++;
  return `A-${n}`;
}

/** Prancha nova, A3 deitada, com o carimbo preenchido com o nome do projeto e a data de hoje. */
export function newSheet(p: Pick<Project, 'sheets' | 'name'>, today = new Date()): Sheet {
  return {
    id: newSheetId(),
    number: nextSheetNumber(p),
    name: 'Nova prancha',
    size: 'A3',
    orientation: 'landscape',
    margin: 10,
    titleBlock: { project: p.name, client: '', author: '', date: today.toLocaleDateString('pt-BR'), revision: '0' },
    viewports: [],
  };
}

/** Limita a posição de `at` para a caixa da vista ficar inteira dentro da área de desenho. */
export function clampedAt(s: Pick<Sheet, 'size' | 'orientation' | 'margin'>, size: { w: number; h: number }, at: { x: number; y: number }): { x: number; y: number } {
  const box = sheetInnerBox(s);
  return {
    x: Math.min(Math.max(at.x, box.x0), box.x1 - size.w),
    y: Math.min(Math.max(at.y, box.y0), box.y1 - size.h),
  };
}

/** Tamanho padrão de uma vista do tipo dado, reduzido para caber na área de desenho. */
export function defaultViewSize(s: Pick<Sheet, 'size' | 'orientation' | 'margin'>, source: SheetViewSource): { w: number; h: number } {
  const box = sheetInnerBox(s);
  const want = DEFAULT_SIZE[source.kind];
  return { w: Math.min(want.w, box.x1 - box.x0), h: Math.min(want.h, box.y1 - box.y0) };
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: SheetViewport): boolean =>
  a.x < b.at.x + b.size.w && b.at.x < a.x + a.w && a.y < b.at.y + b.size.h && b.at.y < a.y + a.h;

/**
 * Lugar para uma vista nova: a primeira posição da grade (passo de 10 mm, de baixo para cima) em que a caixa cabe na
 * área de desenho sem tocar as vistas existentes. Sem lugar livre, o canto inferior esquerdo.
 */
export function freeSpot(s: Pick<Sheet, 'size' | 'orientation' | 'margin' | 'viewports'>, size: { w: number; h: number }): { x: number; y: number } {
  const box = sheetInnerBox(s);
  for (let y = box.y0; y + size.h <= box.y1 + 1e-6; y += SPOT_STEP) {
    for (let x = box.x0; x + size.w <= box.x1 + 1e-6; x += SPOT_STEP) {
      if (!s.viewports.some((v) => overlaps({ x, y, w: size.w, h: size.h }, v))) return { x, y };
    }
  }
  return { x: box.x0, y: box.y0 };
}

/** Comando que duplica a prancha com ids novos (vistas inclusas) e número seguinte. Prancha inexistente: null. */
export function duplicateSheetCommand(p: Pick<Project, 'sheets'>, id: Id): Command | null {
  const src = sheetOf(p, id);
  if (!src) return null;
  const copy: Sheet = {
    ...src,
    id: newSheetId(),
    number: nextSheetNumber(p),
    name: `${src.name} (cópia)`,
    titleBlock: { ...src.titleBlock },
    viewports: src.viewports.map((v) => ({ ...v, id: newViewportId(), at: { ...v.at }, size: { ...v.size } })),
  };
  return { type: 'batch', commands: [{ type: 'addSheet', sheet: copy }] };
}

export const addSheetAction = (store: ProjectStore): Id => {
  const s = newSheet(store.project);
  store.exec({ type: 'addSheet', sheet: s }, 'Criar prancha');
  return s.id;
};

/** Adiciona uma vista (planta, corte ou 3D) na escala dada, no primeiro lugar livre. Erro em pt-BR se recusar. */
export function addViewAction(store: ProjectStore, sheetId: Id, view: SheetViewSource, scale: number): Id {
  const s = sheetOf(store.project, sheetId);
  if (!s) throw new Error('Prancha inexistente');
  const size = defaultViewSize(s, view);
  const at = freeSpot(s, size);
  const vp: SheetViewport = { id: newViewportId(), view, at, size, scale };
  store.exec({ type: 'addViewport', sheetId, viewport: vp }, 'Adicionar vista à prancha');
  return vp.id;
}

/** Move uma vista; a posição é limitada à área de desenho antes de gravar. Devolve a recusa, ou null se gravou. */
export function moveViewportAction(store: ProjectStore, sheetId: Id, vpId: Id, at: { x: number; y: number }): string | null {
  const s = sheetOf(store.project, sheetId);
  const vp = s?.viewports.find((v) => v.id === vpId);
  if (!s || !vp) return 'Vista inexistente';
  const next = clampedAt(s, vp.size, at);
  try {
    store.exec({ type: 'updateViewport', sheetId, id: vpId, patch: { at: next } }, 'Mover vista da prancha');
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Não foi possível mover a vista.';
  }
}

/** Mensagem de recusa para as propriedades da folha (tamanho, margem), ou null se a prancha está válida. */
export function sheetProblem(s: Sheet): string | null {
  return sheetIssue(s) ?? s.viewports.map((v) => viewportIssue(s, v)).find((x) => x !== null) ?? null;
}

/** Desenho de todas as pranchas, na ordem da lista (o que o PDF imprime). */
export function sheetDrawLists(p: Project): SheetDrawList[] {
  return projectSheets(p).map((s) => buildSheetDrawList(p, s.id)).filter((d): d is SheetDrawList => d !== null);
}

/** PDF com uma página por prancha. Sem pranchas: null (nada a exportar). */
export function sheetsPdfOf(p: Project): Uint8Array | null {
  const lists = sheetDrawLists(p);
  if (lists.length === 0) return null;
  return exportSheetsPdf(lists, p.name);
}

