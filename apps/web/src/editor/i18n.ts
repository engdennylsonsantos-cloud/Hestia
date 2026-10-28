import { create } from 'zustand';
import { safeGet, safeSet } from './storage.ts';
import type { ToolId } from '@hestia/tools';
import { PT_TABELAS, EN_TABELAS } from './i18nTabelas.ts';

export type Lang = 'pt' | 'en';

const LANG_KEY = 'hestia.lang';

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: (safeGet(LANG_KEY) as Lang) || 'pt',
  setLang: (lang: Lang) => {
    safeSet(LANG_KEY, lang);
    set({ lang });
  },
  toggleLang: () => {
    const next = get().lang === 'pt' ? 'en' : 'pt';
    safeSet(LANG_KEY, next);
    set({ lang: next });
  },
}));

/** Dicionário de traduções oficiais do Autodesk Revit (PT-BR / EN) */
export const I18N = {
  pt: {
    // Abas do Ribbon
    ribbon_arch: 'Arquitetura',
    ribbon_modify: 'Modificar',
    ribbon_annotate: 'Anotar',
    ribbon_view: 'Vista',
    contextual_modify: 'Modificar',

    // Grupos
    grp_build: 'Construir',
    grp_annotate: 'Anotar',
    grp_dimensions: 'Cotas',
    grp_text: 'Texto',
    grp_tags: 'Etiquetas',
    grp_rooms: 'Ambientes',
    grp_selection: 'Seleção',
    grp_modify: 'Modificar',
    grp_attach: 'Anexar',
    grp_measure: 'Medir',
    grp_stair: 'Escada',
    grp_view_3d: 'Vista 3D',
    grp_thin_lines: 'Linhas Finas',

    // Ferramentas principais
    tool_select: 'Modificar',
    tool_wall: 'Parede',
    tool_door: 'Porta',
    tool_window: 'Janela',
    tool_floor: 'Piso',
    tool_slab: 'Laje',
    tool_ceiling: 'Forro',
    tool_roof: 'Telhado',
    tool_slope: 'Inclinação',
    tool_roofarrow: 'Seta de inclinação',
    tool_roofextrusion: 'Telhado por extrusão',
    tool_stair: 'Escada por croqui',
    tool_stairrun: 'Lance de escada',
    tool_room: 'Ambiente',
    tool_dimension: 'Cota alinhada',
    tool_grid: 'Grade',
    tool_roomsep: 'Separador de ambiente',
    tool_text: 'Texto',
    tool_detailLine: 'Linha de detalhe',
    tool_filledRegion: 'Região preenchida',
    tool_tag: 'Etiqueta',
    tool_perimeter: 'Perímetro',
    tool_cotasAuto: 'Cotas automáticas',

    // Modificadores
    tool_move: 'Mover',
    tool_copy: 'Copiar',
    tool_rotate: 'Rotacionar',
    tool_mirror: 'Espelhar',
    tool_array: 'Matriz',
    tool_offset: 'Deslocar',
    tool_parallel: 'Parede paralela',
    tool_trim: 'Aparar/Estender',
    tool_align: 'Alinhar',
    tool_joins: 'Unir geometria',
    tool_split: 'Dividir elemento',
    tool_rehost: 'Trocar hospedeiro',
    tool_attachroof: 'Anexar topo',
    tool_detachroof: 'Desanexar topo',
    tool_measure: 'Medir',
    tool_section: 'Corte',

    // Painéis
    properties_title: 'Propriedades',
    project_browser_title: 'Navegador de projeto',
    type_selector_label: 'Seletor de tipo',
    edit_type_btn: 'Editar Tipo',
    search_project: 'Pesquisar...',

    // Vistas e Árvore
    views_all: 'Vistas (todas)',
    floor_plans: 'Plantas de piso',
    ceiling_plans: 'Plantas de forro',
    views_3d: 'Vistas 3D',
    elevations: 'Elevações',
    sections: 'Cortes',
    schedules: 'Tabelas / Quantitativos',
    sheets: 'Folhas (todas)',
    families: 'Famílias',
    materials: 'Materiais',

    // Barra de Título / QAT
    btn_new: 'Novo',
    btn_open: 'Abrir',
    btn_save: 'Salvar',
    btn_export_dxf: 'Exportar DXF',
    btn_export_pdf: 'Exportar PDF',
    btn_export_ifc: 'Exportar IFC',
    btn_undo: 'Desfazer',
    btn_redo: 'Refazer',

    // Barra de Controle de Vista
    scale: 'Escala',
    detail_fine: 'Alto',
    detail_medium: 'Médio',
    detail_coarse: 'Baixo',
    style_hidden: 'Linha oculta',
    style_shaded: 'Sombreado',
    thin_lines: 'Linhas finas',
    hide_isolate: 'Ocultar/Isolar',
    reset_hide: 'Restaurar',

    ...PT_TABELAS,

    // Dicas da barra de título (tema, ajuda, GPU, alterações)
    tip_dirty: 'Alterações ainda não exportadas',
    tip_engine: 'Motor de desenho em uso',
    tip_starting: 'iniciando…',
    tip_theme: 'Tema',
    tip_theme_system: 'sistema',
    tip_theme_light: 'claro',
    tip_theme_dark: 'escuro',
    tip_help: 'Atalhos de teclado',
    // Barra da Matriz
    arr_kind: 'Tipo',
    arr_kind_linear: 'Linear',
    arr_kind_radial: 'Radial',
    arr_anchor: 'Mover para',
    arr_anchor_second: 'Segundo',
    arr_anchor_last: 'Último',
    arr_count: 'Número de itens',
    arr_angle: 'Ângulo total',
    arr_hint_linear: 'Matriz linear: clique no ponto base e no segundo ponto (espaçamento) — ou digite o espaçamento.',
    arr_hint_radial: 'Matriz radial: clique no centro da matriz. Depois clique para criar os itens, ou digite o ângulo em graus.',
    arr_count_min: 'Número de itens deve ser 2 ou mais; usando 2.',
    arr_angle_zero: 'O ângulo total deve ser diferente de 0°',
    // Diálogo Editar tipo de abertura: lista de componentes
    oc_overview: 'Visão geral',
    oc_frame: 'Batente',
    oc_leaf: 'Folha',
    oc_sashes: 'Folhas e divisões',
    oc_glazing: 'Caixilho e vidro',
    oc_outer: 'Lado externo',
    oc_inner: 'Lado interno',
    oc_wall: 'Parede e vão',
    oc_plan: 'Planta e corte',
    oc_data: 'Quadro e dados',
    oc_list: 'Componentes',
  },
  en: {
    // Ribbon Tabs
    ribbon_arch: 'Architecture',
    ribbon_modify: 'Modify',
    ribbon_annotate: 'Annotate',
    ribbon_view: 'View',
    contextual_modify: 'Modify',

    // Groups
    grp_build: 'Build',
    grp_annotate: 'Annotate',
    grp_dimensions: 'Dimensions',
    grp_text: 'Text',
    grp_tags: 'Tags',
    grp_rooms: 'Room & Area',
    grp_selection: 'Select',
    grp_modify: 'Modify',
    grp_attach: 'Attach',
    grp_measure: 'Measure',
    grp_stair: 'Stair',
    grp_view_3d: '3D View',
    grp_thin_lines: 'Thin Lines',

    // Main Tools
    tool_select: 'Modify',
    tool_wall: 'Wall',
    tool_door: 'Door',
    tool_window: 'Window',
    tool_floor: 'Floor',
    tool_slab: 'Slab',
    tool_ceiling: 'Ceiling',
    tool_roof: 'Roof',
    tool_slope: 'Slope',
    tool_roofarrow: 'Slope Arrow',
    tool_roofextrusion: 'Roof by Extrusion',
    tool_stair: 'Stair by Sketch',
    tool_stairrun: 'Stair by Run',
    tool_room: 'Room',
    tool_dimension: 'Aligned Dimension',
    tool_grid: 'Grid',
    tool_roomsep: 'Room Separator',
    tool_text: 'Text',
    tool_detailLine: 'Detail Line',
    tool_filledRegion: 'Filled Region',
    tool_tag: 'Tag by Category',
    tool_perimeter: 'Perimeter',
    tool_cotasAuto: 'Auto Dimensions',

    // Modifiers
    tool_move: 'Move',
    tool_copy: 'Copy',
    tool_rotate: 'Rotate',
    tool_mirror: 'Mirror',
    tool_array: 'Array',
    tool_offset: 'Offset',
    tool_parallel: 'Parallel Wall',
    tool_trim: 'Trim / Extend',
    tool_align: 'Align',
    tool_joins: 'Join Geometry',
    tool_split: 'Split Element',
    tool_rehost: 'Pick New Host',
    tool_attachroof: 'Attach Top/Base',
    tool_detachroof: 'Detach Top/Base',
    tool_measure: 'Measure',
    tool_section: 'Section',

    // Palettes
    properties_title: 'Properties',
    project_browser_title: 'Project Browser',
    type_selector_label: 'Type Selector',
    edit_type_btn: 'Edit Type',
    search_project: 'Search project...',

    // Views & Tree
    views_all: 'Views (all)',
    floor_plans: 'Floor Plans',
    ceiling_plans: 'Ceiling Plans',
    views_3d: '3D Views',
    elevations: 'Elevations (Building Elevation)',
    sections: 'Sections',
    schedules: 'Schedules / Quantities',
    sheets: 'Sheets (all)',
    families: 'Families',
    materials: 'Materials',

    // Titlebar / QAT
    btn_new: 'New',
    btn_open: 'Open',
    btn_save: 'Save',
    btn_export_dxf: 'Export DXF',
    btn_export_pdf: 'Export PDF',
    btn_export_ifc: 'Export IFC',
    btn_undo: 'Undo',
    btn_redo: 'Redo',

    // View Control Bar
    scale: 'Scale',
    detail_fine: 'Fine',
    detail_medium: 'Medium',
    detail_coarse: 'Coarse',
    style_hidden: 'Hidden Line',
    style_shaded: 'Shaded',
    thin_lines: 'Thin Lines',
    hide_isolate: 'Temporary Hide/Isolate',
    reset_hide: 'Reset',

    // Quantity schedules (*ScheduleDialog)
    ...EN_TABELAS,

    // Title bar tips (theme, help, GPU, unsaved changes)
    tip_dirty: 'Changes not exported yet',
    tip_engine: 'Rendering engine in use',
    tip_starting: 'starting…',
    tip_theme: 'Theme',
    tip_theme_system: 'system',
    tip_theme_light: 'light',
    tip_theme_dark: 'dark',
    tip_help: 'Keyboard shortcuts',
    // Array bar
    arr_kind: 'Type',
    arr_kind_linear: 'Linear',
    arr_kind_radial: 'Radial',
    arr_anchor: 'Move to',
    arr_anchor_second: 'Second',
    arr_anchor_last: 'Last',
    arr_count: 'Number of items',
    arr_angle: 'Total angle',
    arr_hint_linear: 'Linear array: click the base point and the second point (spacing) — or type the spacing.',
    arr_hint_radial: 'Radial array: click the array center. Then click to create the items, or type the angle in degrees.',
    arr_count_min: 'Number of items must be 2 or more; using 2.',
    arr_angle_zero: 'The total angle must be different from 0°',
    // Diálogo Editar tipo de abertura: lista de componentes
    oc_overview: 'Overview',
    oc_frame: 'Frame',
    oc_leaf: 'Leaf',
    oc_sashes: 'Sashes and divisions',
    oc_glazing: 'Sash frame and glass',
    oc_outer: 'Exterior side',
    oc_inner: 'Interior side',
    oc_wall: 'Wall and opening',
    oc_plan: 'Floor plan and section',
    oc_data: 'Schedule and data',
    oc_list: 'Components',
  },
} as const;

/** Retorna a etiqueta traduzida da ferramenta para o idioma ativo */
export function toolLabel(toolId: ToolId, lang: Lang): string {
  const key = `tool_${toolId}` as keyof typeof I18N.pt;
  return I18N[lang][key] || toolId;
}

/** Nome de um comando de atalho no idioma ativo: o mesmo rótulo da ferramenta na faixa (toolLabel). 'atalhos' é a tela de atalhos. */
export function nomeComandoLang(cmd: string, lang: Lang): string {
  if (cmd === 'atalhos') return lang === 'pt' ? 'Atalhos de teclado' : 'Keyboard shortcuts';
  return toolLabel(cmd as ToolId, lang);
}
