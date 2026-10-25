import { isCeiling, isFloor, isOpening, isRoof, isRoom, isSlab, isStair, isWall, type Element, type Id, type Project } from '@hestia/model';
import type { ToolOptions } from '@hestia/tools';
import { editor } from '../../editor/controller.ts';
import { editThinLines, thinLinesOn } from '../../editor/graphicsActions.ts';
import { addSheetAction } from '../../editor/sheetActions.ts';
import { toggleRoofProjection, useUi, type DialogKind, type UiState } from '../../editor/state.ts';
import { activateView } from '../../editor/viewTabActions.ts';
import { t, type ActionId, type Txt } from './model.ts';

/** Estado que a faixa lê para decidir "pressionado" e "desabilitado". */
export interface RibbonCtx {
  tool: UiState['tool'];
  selection: Id[];
  view: UiState['view'];
  levelId: Id;
  showGrid: boolean;
  showUnderlay: boolean;
  showRoofProjection: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  options: ToolOptions;
  p: Project;
}

export interface ActionDef {
  label: Txt;
  icon: string;
  /** Explicação em uma frase (segunda linha do tooltip). */
  hint?: Txt;
  run: () => void;
  pressed?: (c: RibbonCtx) => boolean;
  /** Devolve o motivo quando a ação não pode rodar agora; `false` quando pode. */
  disabled?: (c: RibbonCtx) => Txt | false;
}

const openDialog = (dialog: DialogKind, dialogArg: string | null = null): (() => void) => () => useUi.setState({ dialog, dialogArg });

/** Diálogo "Propriedades de tipo" do que está selecionado ou do que a ferramenta ativa vai criar. */
function typeDialogFor(c: RibbonCtx): { dialog: DialogKind; arg: string } | null {
  const o = c.options;
  if (c.tool !== 'select') {
    switch (c.tool) {
      case 'wall': return { dialog: 'wallType', arg: o.wallTypeId };
      case 'door': return { dialog: 'openingType', arg: o.doorTypeId };
      case 'window': return { dialog: 'openingType', arg: o.windowTypeId };
      case 'floor': return { dialog: 'floorType', arg: o.floorTypeId };
      case 'slab': case 'slope': return { dialog: 'slabType', arg: o.slabTypeId };
      case 'ceiling': return o.ceilingTypeId ? { dialog: 'ceilingType', arg: o.ceilingTypeId } : null;
      case 'roof': case 'roofextrusion': case 'roofarrow': return o.roofTypeId ? { dialog: 'roofType', arg: o.roofTypeId } : null;
      case 'stair': case 'stairrun': return o.stair?.typeId ? { dialog: 'stairType', arg: o.stair.typeId } : null;
      default: return null;
    }
  }
  const e: Element | undefined = c.selection.map((id) => c.p.elements[id]).find((x): x is Element => !!x);
  if (!e) return null;
  if (isWall(e)) return { dialog: 'wallType', arg: e.typeId };
  if (isOpening(e)) return { dialog: 'openingType', arg: e.typeId };
  if (isFloor(e)) return { dialog: 'floorType', arg: e.typeId };
  if (isSlab(e)) return { dialog: 'slabType', arg: e.typeId };
  if (isCeiling(e)) return { dialog: 'ceilingType', arg: e.typeId };
  if (isRoof(e)) return { dialog: 'roofType', arg: e.typeId };
  if (isStair(e)) return { dialog: 'stairType', arg: e.typeId };
  return null;
}

const planOrSection = (c: RibbonCtx): boolean => c.view === 'plan' || c.view === 'section';
const noSel = (c: RibbonCtx): Txt | false => (c.selection.length === 0 ? t('Selecione elementos primeiro.', 'Select elements first.') : false);
const stairsIn = (c: RibbonCtx): Array<{ typeId: Id }> => c.selection.map((id) => c.p.elements[id]).filter(isStair);

function thinTarget(): { levelId: Id } | 'section' {
  const ui = useUi.getState();
  return ui.view === 'section' ? 'section' : { levelId: ui.levelId };
}

const sched = (label: Txt, dialog: DialogKind): ActionDef => ({ label, icon: 'schedule', run: openDialog(dialog) });

export const ACTIONS: Record<ActionId, ActionDef> = {
  cotasAuto: {
    label: t('Cotas automáticas', 'Auto Dimensions'),
    icon: 'cotasAuto',
    hint: t('Cotas automáticas do nível ativo: escolha o que cotar, por onde medir e em quais lados.', 'Automatic dimensions for the active level.'),
    run: openDialog('cotasAuto'),
  },
  typeProps: {
    label: t('Propriedades de tipo', 'Type Properties'),
    icon: 'type',
    hint: t('Abre o tipo do elemento selecionado (ou o que a ferramenta ativa vai criar).', 'Opens the type of the selected element or of the active tool.'),
    run: () => {
      const d = typeDialogFor(ctxNow());
      if (d) useUi.setState({ dialog: d.dialog, dialogArg: d.arg });
    },
    disabled: (c) => (typeDialogFor(c) ? false : t('Selecione um elemento com tipo, ou ative uma ferramenta de criação.', 'Select an element with a type.')),
  },
  properties: {
    label: t('Propriedades', 'Properties'),
    icon: 'props',
    hint: t('Mostra ou oculta a paleta de propriedades.', 'Show or hide the Properties palette.'),
    run: () => useUi.setState((s) => ({ leftOpen: !s.leftOpen })),
    pressed: (c) => c.leftOpen,
  },
  browser: {
    label: t('Navegador de projeto', 'Project Browser'),
    icon: 'levels',
    hint: t('Mostra ou oculta o navegador de projeto.', 'Show or hide the Project Browser.'),
    run: () => useUi.setState((s) => ({ rightOpen: !s.rightOpen })),
    pressed: (c) => c.rightOpen,
  },
  sameType: {
    label: t('Mesmo tipo', 'Same Type'),
    icon: 'sametype',
    hint: t('Seleciona todas as instâncias do tipo do elemento selecionado.', 'Select all instances of the type.'),
    run: () => { editor.selectAllOfSelectedType(); },
    disabled: noSel,
  },
  sameName: {
    label: t('Mesmo nome', 'Same Name'),
    icon: 'samename',
    hint: t('Seleciona todos os ambientes do nível com o mesmo nome (hoje só ambientes).', 'Select all rooms with the same name.'),
    run: () => { editor.selectAllOfSelectedName(); },
    disabled: (c) => (c.selection.some((id) => isRoom(c.p.elements[id])) ? false : t('Selecione um ambiente primeiro.', 'Select a room first.')),
  },
  moveLevel: {
    label: t('Nível…', 'Level…'),
    icon: 'layers',
    hint: t('Move a seleção para outro nível.', 'Move the selection to another level.'),
    run: () => useUi.setState({ dialog: 'moveLevel', dialogArg: null }),
    disabled: noSel,
  },
  delete: {
    label: t('Excluir', 'Delete'),
    icon: 'close',
    run: () => editor.deleteSelection(),
    disabled: noSel,
  },
  zoomFit: {
    label: t('Enquadrar tudo', 'Zoom to Fit'),
    icon: 'fit',
    run: () => {
      const s = useUi.getState();
      if (s.view === '3d') useUi.setState({ previewTick: s.previewTick + 1 });
      else editor.zoomExtents();
    },
  },
  thinLines: {
    label: t('Linhas finas', 'Thin Lines'),
    icon: 'tl',
    hint: t('Mostra todas as linhas da vista com 1 px de espessura na tela.', 'Show all lines at 1 px on screen.'),
    run: () => {
      const target = thinTarget();
      const r = editThinLines(editor.store, target, !thinLinesOn(editor.project, target));
      if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar as linhas finas.' });
    },
    pressed: (c) => planOrSection(c) && thinLinesOn(c.p, c.view === 'section' ? 'section' : { levelId: c.levelId }),
    disabled: (c) => (planOrSection(c) ? false : t('Só em planta ou corte.', 'Plan or section views only.')),
  },
  grid: { label: t('Grade', 'Grid'), icon: 'grid', hint: t('Grade de desenho na planta.', 'Drawing grid in plan.'), run: () => useUi.setState((s) => ({ showGrid: !s.showGrid })), pressed: (c) => c.showGrid },
  underlay: { label: t('Subpavimento', 'Underlay'), icon: 'layers', hint: t('Mostra o pavimento abaixo, apagado.', 'Show the level below, faded.'), run: () => useUi.setState((s) => ({ showUnderlay: !s.showUnderlay })), pressed: (c) => c.showUnderlay },
  roofProjection: { label: t('Projeção da cobertura', 'Roof Projection'), icon: 'roof', run: toggleRoofProjection, pressed: (c) => c.showRoofProjection },
  graphicsVisibility: {
    label: t('Visibilidade/Gráficos', 'Visibility/Graphics'),
    icon: 'layers',
    hint: t('Visibilidade por categoria e gráficos da vista ativa.', 'Category visibility and graphics of the active view.'),
    run: () => {
      const s = useUi.getState();
      useUi.setState({ dialog: 'graphicsVisibility', dialogArg: s.view === 'section' ? 'section' : s.view === '3d' ? '3d' : s.levelId });
    },
    disabled: (c) => (c.view === 'sheet' ? t('Não vale para pranchas.', 'Not available for sheets.') : false),
  },
  view3d: { label: t('Vista 3D', '3D View'), icon: 'cube', run: () => activateView({ kind: '3d' }) },
  genElevations: {
    label: t('Elevação', 'Elevation'),
    icon: 'plan',
    hint: t('Cria Norte, Sul, Leste e Oeste em volta das paredes do nível ativo (substitui as de mesmo nome).', 'Creates North, South, East and West elevations around the walls.'),
    run: () => editor.generateElevations(),
  },
  newSheet: {
    label: t('Prancha', 'Sheet'),
    icon: 'sheet',
    run: () => {
      try {
        activateView({ kind: 'sheet', sheetId: addSheetAction(editor.store) });
        useUi.setState({ status: 'Prancha criada.' });
      } catch (e) {
        useUi.setState({ status: e instanceof Error ? e.message : 'Operação recusada.' });
      }
    },
  },
  materials: { label: t('Materiais', 'Materials'), icon: 'layers', run: openDialog('materials') },
  levels: { label: t('Nível', 'Level'), icon: 'level', hint: t('Cria e edita os níveis do projeto.', 'Create and edit project levels.'), run: openDialog('levels') },
  lineWeights: { label: t('Espessuras de linha', 'Line Weights'), icon: 'detail', hint: t('Pesos de linha por escala, por categoria e limites de detalhe.', 'Line weights by scale and category.'), run: openDialog('lineWeights') },
  shortcutsConfig: { label: t('Atalhos de teclado…', 'Keyboard Shortcuts…'), icon: 'help', run: openDialog('shortcutsConfig') },
  shortcuts: { label: t('Lista de atalhos', 'Shortcut List'), icon: 'help', run: openDialog('shortcuts') },
  schedWalls: sched(t('Tabela de paredes', 'Wall Schedule'), 'schedule'),
  schedFloors: sched(t('Tabela de pisos', 'Floor Schedule'), 'floorSchedule'),
  schedSlabs: sched(t('Tabela de lajes', 'Slab Schedule'), 'slabSchedule'),
  schedCeilings: sched(t('Tabela de forros', 'Ceiling Schedule'), 'ceilingSchedule'),
  schedRoofs: sched(t('Tabela de telhados', 'Roof Schedule'), 'roofSchedule'),
  schedStairs: sched(t('Tabela de escadas', 'Stair Schedule'), 'stairSchedule'),
  schedRooms: sched(t('Tabela de ambientes', 'Room Schedule'), 'roomSchedule'),
  schedOpenings: sched(t('Tabela de portas e janelas', 'Door/Window Schedule'), 'openingSchedule'),
  stairSketch: {
    label: t('Editar croqui', 'Edit Sketch'),
    icon: 'stair',
    hint: t('Edita o croqui da escada selecionada.', 'Edit the sketch of the selected stair.'),
    run: () => editor.setTool('stair'),
    disabled: (c) => (stairsIn(c).length === 1 ? false : t('Selecione uma única escada.', 'Select a single stair.')),
  },
  stairTypes: {
    label: t('Tipos de escada', 'Stair Types'),
    icon: 'type',
    run: () => {
      const s = stairsIn(ctxNow())[0];
      if (s) useUi.setState({ dialog: 'stairType', dialogArg: s.typeId });
    },
    disabled: (c) => (stairsIn(c).length > 0 ? false : t('Selecione uma escada.', 'Select a stair.')),
  },
};

/** Contexto lido na hora do clique (os `run` nunca usam o valor de um render antigo). */
export function ctxNow(): RibbonCtx {
  const s = useUi.getState();
  return {
    tool: s.tool, selection: s.selection, view: s.view, levelId: s.levelId, showGrid: s.showGrid, showUnderlay: s.showUnderlay,
    showRoofProjection: s.showRoofProjection, leftOpen: s.leftOpen, rightOpen: s.rightOpen, options: s.options, p: editor.project,
  };
}
