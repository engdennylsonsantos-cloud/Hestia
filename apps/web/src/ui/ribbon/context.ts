import type { Project, Id } from '@hestia/model';
import type { ToolId, ToolOptions } from '@hestia/tools';
import { toolLabel } from '../../editor/i18n.ts';
import { act, option, panel, soonS, stack, t, tool, type RibbonPanel, type RibbonTab, type Txt } from './model.ts';
import { P_CLIPBOARD, P_CREATE, P_GEOMETRY, P_MEASURE, P_MODIFY, P_PROPS, P_SELECT, P_SELECTION_EXTRA, P_VIEW_MOD } from './panelsShared.ts';

/**
 * Aba contextual verde ("Modificar | …"): nasce quando há ferramenta de criação ativa ou seleção, traz painéis do
 * assunto e some quando o assunto acaba. A `key` identifica o assunto: mudou, a faixa seleciona a aba de novo.
 */
export interface ContextTab {
  key: string;
  tab: RibbonTab;
}

/** Ferramentas que colocam algo no projeto (no Revit: "Modificar | Colocar X"). As de edição não abrem aba. */
const PLACE: ReadonlySet<ToolId> = new Set<ToolId>(['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'roofextrusion', 'roofarrow', 'slope', 'stair', 'stairrun', 'room', 'roomsep', 'dimension', 'text']);

const same = <K extends keyof ToolOptions>(key: K, value: ToolOptions[K]) => (o: ToolOptions): boolean => o[key] === value;

/** Modos de desenho (opções da ferramenta) como botões pressionáveis, no painel "Desenhar". */
function drawPanel(id: ToolId): RibbonPanel | null {
  const mk = (...items: ReturnType<typeof option>[]): RibbonPanel => panel('desenhar', t('Desenhar', 'Draw'), stack(...items.slice(0, 3)), ...(items.length > 3 ? [stack(...items.slice(3, 6))] : []));
  switch (id) {
    case 'wall':
      return mk(
        option(t('Linha', 'Line'), 'wall', same('wallShape', 'line'), { wallShape: 'line' }),
        option(t('Arco (3 pontos)', 'Arc (3 points)'), 'detailLine', same('wallShape', 'arc'), { wallShape: 'arc' }),
        option(t('Retângulo', 'Rectangle'), 'plan', same('wallShape', 'rect'), { wallShape: 'rect' }),
      );
    case 'floor':
      return mk(
        option(t('Contorno por pontos', 'Sketch'), 'filledRegion', same('floorMode', 'poly'), { floorMode: 'poly' }, 'floor'),
        option(t('Retângulo', 'Rectangle'), 'plan', same('floorMode', 'rect'), { floorMode: 'rect' }, 'floor'),
        option(t('Área fechada por paredes', 'Pick Walls'), 'room', same('floorMode', 'walls'), { floorMode: 'walls' }, 'floor'),
        option(t('Perímetro externo', 'Outer Perimeter'), 'floor', same('floorMode', 'perimetro'), { floorMode: 'perimetro' }, 'floor'),
        option(t('Furo no piso', 'Hole'), 'close', same('floorMode', 'hole'), { floorMode: 'hole' }, 'floor'),
      );
    case 'slab':
      return mk(
        option(t('Contorno por pontos', 'Sketch'), 'filledRegion', same('slabMode', 'poly'), { slabMode: 'poly' }, 'slab'),
        option(t('Retângulo', 'Rectangle'), 'plan', same('slabMode', 'rect'), { slabMode: 'rect' }, 'slab'),
        option(t('Perímetro externo', 'Outer Perimeter'), 'slab', same('slabMode', 'perimetro'), { slabMode: 'perimetro' }, 'slab'),
        option(t('Furo na laje', 'Hole'), 'close', same('slabMode', 'hole'), { slabMode: 'hole' }, 'slab'),
      );
    case 'ceiling':
      return mk(
        option(t('Contorno por pontos', 'Sketch'), 'filledRegion', (o) => (o.ceilingMode ?? 'poly') === 'poly', { ceilingMode: 'poly' }, 'ceiling'),
        option(t('Retângulo', 'Rectangle'), 'plan', same('ceilingMode', 'rect'), { ceilingMode: 'rect' }, 'ceiling'),
        option(t('Por ambiente', 'By Room'), 'room', same('ceilingMode', 'room'), { ceilingMode: 'room' }, 'ceiling'),
        option(t('Furo no forro', 'Hole'), 'close', same('ceilingMode', 'hole'), { ceilingMode: 'hole' }, 'ceiling'),
      );
    case 'roof':
      return mk(
        option(t('Contorno por pontos', 'Sketch'), 'filledRegion', (o) => (o.roofMode ?? 'poly') === 'poly', { roofMode: 'poly' }, 'roof'),
        option(t('Retângulo', 'Rectangle'), 'plan', same('roofMode', 'rect'), { roofMode: 'rect' }, 'roof'),
        option(t('Por paredes', 'Pick Walls'), 'room', same('roofMode', 'paredes'), { roofMode: 'paredes' }, 'roof'),
        option(t('Furo no telhado', 'Hole'), 'close', same('roofMode', 'hole'), { roofMode: 'hole' }, 'roof'),
      );
    default:
      return null;
  }
}

/** Painéis do assunto de cada categoria selecionada. */
const CATEGORY: Record<string, { label: Txt; panels: RibbonPanel[] }> = {
  wall: { label: t('Paredes', 'Walls'), panels: [panel('modificar-parede', t('Modificar parede', 'Modify Wall'), stack(tool('attachroof', 'small'), tool('detachroof', 'small'), soonS(t('Editar perfil', 'Edit Profile'), 'soon')))] },
  door: { label: t('Portas', 'Doors'), panels: [panel('hospedeiro', t('Hospedeiro', 'Host'), tool('rehost'))] },
  window: { label: t('Janelas', 'Windows'), panels: [panel('hospedeiro', t('Hospedeiro', 'Host'), tool('rehost'))] },
  floor: { label: t('Pisos', 'Floors'), panels: [] },
  slab: { label: t('Lajes', 'Slabs'), panels: [panel('editar-forma', t('Editar forma', 'Shape Editing'), tool('slope'))] },
  ceiling: { label: t('Forros', 'Ceilings'), panels: [] },
  roof: { label: t('Telhados', 'Roofs'), panels: [panel('modificar-telhado', t('Modificar telhado', 'Modify Roof'), tool('roofarrow'))] },
  stair: { label: t('Escadas', 'Stairs'), panels: [panel('escada', t('Escada', 'Stair'), act('stairSketch'), act('stairTypes'), act('schedStairs', 'large', t('Tabela de escadas', 'Stair Schedule')))] },
  room: { label: t('Ambientes', 'Rooms'), panels: [panel('ambiente', t('Ambiente', 'Room'), tool('roomsep'))] },
};

/** Base dos painéis de uma aba contextual, na ordem do Revit. */
const base = (...extra: RibbonPanel[]): RibbonPanel[] => [P_SELECT, P_PROPS, P_CLIPBOARD, P_GEOMETRY, P_MODIFY, P_VIEW_MOD, P_MEASURE, P_CREATE, ...extra];

export function contextTab(toolId: ToolId, selection: readonly Id[], p: Project): ContextTab | null {
  if (toolId !== 'select') {
    if (!PLACE.has(toolId)) return null;
    const draw = drawPanel(toolId);
    const name = { pt: toolLabel(toolId, 'pt'), en: toolLabel(toolId, 'en') };
    return {
      key: `tool:${toolId}`,
      tab: { id: 'ctx', label: { pt: `Modificar | Colocar ${name.pt}`, en: `Modify | Place ${name.en}` }, panels: [P_SELECT, P_PROPS, P_MODIFY, P_MEASURE, P_CREATE, ...(draw ? [draw] : [])] },
    };
  }
  if (selection.length === 0) return null;
  const kinds = new Set<string>();
  for (const id of selection) {
    const k = p.elements[id]?.kind;
    if (k) kinds.add(k);
  }
  if (kinds.size === 0) return null;
  if (kinds.size > 1) {
    return { key: 'sel:multi', tab: { id: 'ctx', label: t('Modificar | Seleção múltipla', 'Modify | Multi-Select'), panels: base(P_SELECTION_EXTRA) } };
  }
  const kind = [...kinds][0]!;
  const cat = CATEGORY[kind];
  const label: Txt = cat ? { pt: `Modificar | ${txtPt(cat.label)}`, en: `Modify | ${txtEn(cat.label)}` } : t('Modificar | Elementos', 'Modify | Elements');
  return { key: `sel:${kind}`, tab: { id: 'ctx', label, panels: base(...(cat?.panels ?? []), P_SELECTION_EXTRA) } };
}

const txtPt = (x: Txt): string => (typeof x === 'string' ? x : x.pt);
const txtEn = (x: Txt): string => (typeof x === 'string' ? x : x.en);
