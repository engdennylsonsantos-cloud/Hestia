import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { applyCommand, type Command } from './commands.ts';
import type { Project } from './types.ts';

enablePatches();

interface Entry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

type Listener = () => void;

/**
 * Armazena o projeto e o histórico. Toda escrita passa por `exec`; transações agrupam
 * vários comandos num único passo de desfazer (arrastar = 1 passo).
 */
export class ProjectStore {
  private present: Project;
  private past: Entry[] = [];
  private future: Entry[] = [];
  private listeners = new Set<Listener>();
  private tx: { label: string; patches: Patch[]; inverse: Patch[] } | null = null;
  /** Incrementa a cada mudança; serve de chave de cache. */
  version = 0;
  /** Versão do último salvamento, para o aviso de alterações não salvas. */
  savedVersion = 0;

  constructor(initial: Project) {
    this.present = initial;
  }

  get project(): Project {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string | null {
    return this.past[this.past.length - 1]?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.future[this.future.length - 1]?.label ?? null;
  }

  get dirty(): boolean {
    return this.version !== this.savedVersion;
  }

  markSaved(): void {
    this.savedVersion = this.version;
    this.emit();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  /** Substitui o projeto inteiro (abrir arquivo) e zera o histórico. */
  load(p: Project): void {
    this.present = p;
    this.past = [];
    this.future = [];
    this.tx = null;
    this.emit();
    this.savedVersion = this.version;
  }

  exec(cmd: Command, label = labelOf(cmd)): void {
    const [next, patches, inverse] = produceWithPatches(this.present, (draft) => {
      applyCommand(draft as Project, cmd);
    });
    if (patches.length === 0) return;
    this.present = next;
    if (this.tx) {
      this.tx.patches.push(...patches);
      this.tx.inverse.unshift(...inverse);
    } else {
      this.past.push({ label, patches, inverse });
      this.future = [];
    }
    this.emit();
  }

  /** Executa vários comandos como um único passo de desfazer. */
  transaction(label: string, fn: () => void): void {
    if (this.tx) {
      fn();
      return;
    }
    this.tx = { label, patches: [], inverse: [] };
    try {
      fn();
    } finally {
      const done = this.tx;
      this.tx = null;
      if (done.patches.length > 0) {
        this.past.push(done);
        this.future = [];
        this.emit();
      }
    }
  }

  undo(): void {
    const e = this.past.pop();
    if (!e) return;
    this.present = applyPatches(this.present, e.inverse);
    this.future.push(e);
    this.emit();
  }

  redo(): void {
    const e = this.future.pop();
    if (!e) return;
    this.present = applyPatches(this.present, e.patches);
    this.past.push(e);
    this.emit();
  }
}

export function labelOf(c: Command): string {
  switch (c.type) {
    case 'addWall':
      return 'Criar parede';
    case 'addFloor':
      return 'Criar piso';
    case 'upsertFloorType':
      return 'Editar tipo de piso';
    case 'deleteFloorType':
      return 'Excluir tipo de piso';
    case 'addSlab':
      return 'Criar laje';
    case 'upsertSlabType':
      return 'Editar tipo de laje';
    case 'deleteSlabType':
      return 'Excluir tipo de laje';
    case 'addRoof':
      return 'Criar telhado';
    case 'addCeiling':
      return 'Criar forro';
    case 'addCeilings':
      return c.ceilings.length === 1 ? 'Criar forro' : 'Criar forros por ambiente';
    case 'updateCeiling':
      return 'Alterar forro';
    case 'removeCeiling':
      return 'Excluir forro';
    case 'upsertCeilingType':
      return 'Editar tipo de forro';
    case 'deleteCeilingType':
      return 'Excluir tipo de forro';
    case 'duplicateCeilingType':
      return 'Duplicar tipo de forro';
    case 'addRoom':
      return 'Criar ambiente';
    case 'updateRoom':
      return 'Alterar ambiente';
    case 'removeRoom':
      return 'Excluir ambiente';
    case 'upsertRoofType':
      return 'Editar tipo de telhado';
    case 'deleteRoofType':
      return 'Excluir tipo de telhado';
    case 'addStair':
      return 'Criar escada';
    case 'upsertStairType':
      return 'Editar tipo de escada';
    case 'deleteStairType':
      return 'Excluir tipo de escada';
    case 'addOpening':
      return c.opening.kind === 'door' ? 'Inserir porta' : 'Inserir janela';
    case 'updateElements':
      return 'Alterar propriedades';
    case 'detachOutline':
      return 'Soltar contorno das paredes';
    case 'relinkOutline':
      return 'Revincular contorno às paredes';
    case 'setWallEnds':
      return 'Ajustar parede';
    case 'setJoin':
      return 'Alterar junção';
    case 'transform':
      return c.copy ? 'Copiar' : c.transform.kind === 'translate' ? 'Mover' : c.transform.kind === 'rotate' ? 'Girar' : 'Espelhar';
    case 'splitWall':
      return 'Dividir parede';
    case 'deleteElements':
      return 'Excluir';
    case 'upsertWallType':
      return 'Editar tipo de parede';
    case 'deleteWallType':
      return 'Excluir tipo de parede';
    case 'upsertMaterial':
      return 'Editar material';
    case 'upsertOpeningType':
      return 'Editar tipo de abertura';
    case 'upsertLevel':
      return 'Editar nível';
    case 'deleteLevel':
      return 'Excluir nível';
    case 'setLevelViewRange':
      return 'Alterar intervalo de vista';
    case 'setProjectGraphics':
      return 'Alterar gráficos do projeto';
    case 'setLevelGraphics':
      return 'Alterar gráficos da vista';
    case 'resetLevelGraphics':
      return 'Restaurar gráficos da vista';
    case 'setView3D':
      return 'Alterar a vista 3D';
    case 'resetView3D':
      return 'Restaurar a vista 3D';
    case 'setSectionGraphics':
      return 'Alterar gráficos do corte';
    case 'resetSectionGraphics':
      return 'Restaurar gráficos do corte';
    case 'setProjectName':
      return 'Renomear projeto';
    case 'setDefaults':
      return 'Padrões do projeto';
    case 'setSettings':
      return 'Configurações do projeto';
    case 'toggleOpeningFavorite':
      return 'Favoritar tipo de abertura';
    case 'addView':
      return 'Criar vista';
    case 'updateView':
      return 'Alterar vista';
    case 'deleteView':
      return 'Excluir vista';
    case 'batch':
      return 'Várias alterações';
    case 'setOpeningHost':
      return 'Trocar parede anfitriã';
    case 'setElementLevel':
      return 'Mudar de nível';
    case 'addDimension':
      return 'Criar cota';
    case 'updateDimension':
      return 'Editar cota';
    case 'removeDimension':
      return 'Excluir cota';
    case 'addText':
      return 'Criar texto';
    case 'updateText':
      return 'Editar texto';
    case 'removeText':
      return 'Excluir texto';
    case 'addSheet':
      return 'Criar prancha';
    case 'updateSheet':
      return 'Editar prancha';
    case 'removeSheet':
      return 'Excluir prancha';
    case 'addViewport':
      return 'Adicionar vista à prancha';
    case 'updateViewport':
      return 'Mover vista da prancha';
    case 'removeViewport':
      return 'Excluir vista da prancha';
  }
}
