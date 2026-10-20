import type { Vec2 } from '@hestia/geom';
import { isOpening, isWall, type Id, type Project, type Wall } from '@hestia/model';
import { resolveAllRoofs, roofAxisReport } from '@hestia/engine';
import { ToolBase } from './base.ts';
import { pickAt } from './pick.ts';
import { pickRoofAt } from './roofPick.ts';
import type { PointerInfo } from './types.ts';

/** Trecho do eixo fora do telhado menor que isto (m) não é avisado (mesma folga do C2). */
const UNCOVERED_TOL = 1e-3;

const fmt = (m: number): string => m.toFixed(2).replace('.', ',');

/** Parede sob o cursor: a própria, ou a que hospeda a abertura (porta/janela). */
function wallUnder(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const hit = pickAt(p, levelId, at, mpp);
  if (!hit) return null;
  const e = p.elements[hit.id];
  if (isWall(e)) return e.id;
  return isOpening(e) ? e.hostId : null;
}

/**
 * Aviso de cobertura de `w` pelo telhado `roofId` (mesma regra do C2, `roofWallIssues`), ou null quando o eixo está todo
 * sob o telhado. Parede curva não acompanha telhado (o perfil é só de parede reta).
 */
export function roofCoverNote(p: Project, w: Wall, roofId: Id): string | null {
  if (w.sag !== 0) return `"${w.id}" é curva e não acompanha o telhado`;
  const rs = resolveAllRoofs(p).filter((r) => r.roofId === roofId);
  const rep = roofAxisReport({ ...w, attachTopRoofId: roofId }, rs);
  if (!rep || rep.uncovered <= UNCOVERED_TOL) return null;
  if (rep.uncovered >= rep.length - UNCOVERED_TOL) return `"${w.id}" está fora deste telhado; o topo fica na altura normal`;
  return `"${w.id}" tem ${fmt(rep.uncovered)} m do eixo fora do telhado`;
}

const WALLS_HINT = 'Anexar topo: clique nas paredes (ou selecione-as antes) e depois Enter. Esc sai.';
const ROOF_HINT = 'Selecione o telhado: o topo das paredes escolhidas segue a face inferior dele. Enter volta às paredes.';

type Stage = 'walls' | 'roof';

/**
 * Anexar topo (Revit: Attach Top/Base). Etapa 1: paredes (as selecionadas ao iniciar, ou clicadas; clicar de novo tira).
 * Etapa 2: clique no telhado. Um comando `updateElements` grava `attachTopToRoof` e `attachTopRoofId` nas paredes, em um
 * único passo de desfazer. Parede sem cobertura total ou curva entra com aviso na barra de status. Enter (ou Tab) alterna
 * entre as etapas. Funciona na planta e na vista 3D (o ponto do clique é o da superfície sob o cursor).
 */
export class AttachRoofTool extends ToolBase {
  readonly id = 'attachroof';
  readonly label = 'Anexar topo';
  readonly hint = WALLS_HINT;
  readonly pick3d = true;
  private stage: Stage = 'walls';
  private walls: Id[] = [];

  protected reset(): void {
    this.stage = 'walls';
    this.walls = [];
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.walls.length > 0 || this.stage === 'roof';
  }

  override start(): void {
    this.reset();
    const p = this.env.project();
    const sel = this.env.selection().filter((id) => isWall(p.elements[id]));
    if (sel.length) {
      this.walls = sel;
      this.toRoof();
    } else this.env.say(WALLS_HINT);
  }

  private toRoof(): void {
    if (!this.walls.length) {
      this.env.say('Escolha ao menos uma parede antes do telhado.');
      return;
    }
    this.stage = 'roof';
    this.env.say(`${this.walls.length} parede(s) escolhida(s). ${ROOF_HINT}`);
  }

  private toWalls(): void {
    this.stage = 'walls';
    this.env.say(WALLS_HINT);
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    if (this.walls.length) this.items.push({ kind: 'highlight', ids: this.walls });
    if (this.stage === 'roof') {
      const roof = pickRoofAt(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
      if (roof) this.items.push({ kind: 'highlight', ids: [roof] });
    }
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    const pr = this.env.project();
    const levelId = this.env.levelId();
    const mpp = this.env.metersPerPixel();
    if (this.stage === 'walls') {
      const w = wallUnder(pr, levelId, p.raw, mpp);
      if (!w) {
        this.env.say('Clique numa parede (ou selecione-a antes) e depois Enter.');
        return;
      }
      this.walls = this.walls.includes(w) ? this.walls.filter((id) => id !== w) : [...this.walls, w];
      this.env.say(this.walls.length ? `${this.walls.length} parede(s) escolhida(s). Enter escolhe o telhado.` : WALLS_HINT);
      return;
    }
    const roof = pickRoofAt(pr, levelId, p.raw, mpp);
    if (!roof) {
      this.env.say('Clique sobre um telhado do nível atual. Enter volta às paredes.');
      return;
    }
    this.apply(roof);
  }

  override confirm(): void {
    if (this.stage === 'walls') this.toRoof();
    else this.toWalls();
  }

  override tab(): void {
    this.confirm();
  }

  /** Grava o telhado nas paredes escolhidas, em um único comando (um passo de desfazer). A ferramenta continua ativa. */
  private apply(roofId: Id): void {
    const pr = this.env.project();
    const ids = this.walls.filter((id) => isWall(pr.elements[id]));
    if (!ids.length) {
      this.toWalls();
      this.env.say('As paredes escolhidas não existem mais. Escolha outras.');
      return;
    }
    const notes = ids.flatMap((id) => {
      const w = pr.elements[id];
      const note = isWall(w) ? roofCoverNote(pr, w, roofId) : null;
      return note ? [note] : [];
    });
    this.env.exec({ type: 'updateElements', ids, patch: { attachTopToRoof: true, attachTopRoofId: roofId } });
    this.reset();
    const done = `Topo anexado a ${ids.length} parede(s).`;
    const more = notes.length > 1 ? ` (e mais ${notes.length - 1})` : '';
    this.env.say(notes.length ? `${done} Aviso: ${notes[0]}${more}. Ctrl+Z desfaz.` : `${done} Ctrl+Z desfaz.`);
  }
}

/**
 * Desanexar topo (Revit: Detach Top/Base). Com paredes selecionadas, Enter (ou ao ativar a ferramenta) solta o topo delas;
 * clicar numa parede solta só essa. Cada solta é um comando, com passo próprio de desfazer.
 */
export class DetachRoofTool extends ToolBase {
  readonly id = 'detachroof';
  readonly label = 'Desanexar topo';
  readonly hint = 'Desanexar topo: selecione as paredes e aperte Enter, ou clique numa parede anexada. Esc sai.';
  readonly pick3d = true;

  protected reset(): void {
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return false;
  }

  /** Paredes selecionadas (qualquer uma; as não anexadas são ignoradas com aviso). */
  private selectedWalls(): Id[] {
    const pr = this.env.project();
    return this.env.selection().filter((id) => isWall(pr.elements[id]));
  }

  override start(): void {
    this.reset();
    const sel = this.selectedWalls();
    if (sel.length) this.detach(sel);
    else this.env.say(this.hint);
  }

  override confirm(): void {
    const sel = this.selectedWalls();
    if (sel.length) this.detach(sel);
    else this.env.say('Selecione as paredes antes de Enter, ou clique numa parede anexada.');
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    const w = wallUnder(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!w) {
      this.env.say('Clique numa parede anexada ao telhado.');
      return;
    }
    this.detach([w]);
  }

  /** Solta o topo das paredes `ids` que estão anexadas; uma só alteração, um passo de desfazer. */
  private detach(ids: Id[]): void {
    const pr = this.env.project();
    const attached = ids.filter((id) => {
      const w = pr.elements[id];
      return isWall(w) && w.attachTopToRoof === true;
    });
    if (!attached.length) {
      this.env.say('Nenhuma parede escolhida está anexada ao telhado.');
      return;
    }
    this.env.exec({ type: 'updateElements', ids: attached, patch: { attachTopToRoof: false, attachTopRoofId: undefined } });
    this.env.say(`Topo desanexado de ${attached.length} parede(s). Ctrl+Z desfaz.`);
  }
}
