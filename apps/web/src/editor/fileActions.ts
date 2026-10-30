import { editor } from './controller.ts';
import { saveSectionDxf, saveViewDxf } from './dxfExport.ts';
import { saveProjectIfc } from './ifcExport.ts';
import { savePdf } from './savePdf.ts';
import { pranchaDaPlantaAtual, sheetsPdfOf } from './sheetActions.ts';
import { useUi, type ThemePref } from './state.ts';

/** Ações do menu Arquivo (abrir, exportar, tema). Mensagens de resultado vão para a barra de status. */

const say = (status: string): void => useUi.setState({ status });
const why = (e: unknown): string => (e instanceof Error ? e.message : 'falha desconhecida');

export async function openProjectFile(f: File | undefined): Promise<void> {
  if (!f) return;
  const r = editor.openFromText(await f.text(), f.name);
  say(r.ok ? `Aberto: ${f.name}` : `Não foi possível abrir: ${r.error}`);
}

export async function exportDxf(): Promise<void> {
  const ui = useUi.getState();
  // A planta de cobertura não tem DXF próprio: sairia a planta de piso do nível, como se fosse a que está na tela.
  if (ui.view === 'plan' && ui.planKind === 'roof') return say('A planta de cobertura ainda não exporta DXF: abra a planta de piso do nível.');
  try {
    const areaPlanId = ui.view === 'plan' && ui.planKind === 'area' ? ui.areaPlanId : null;
    say(ui.view === 'section' && ui.sectionId ? await saveSectionDxf(editor.project, ui.sectionId) : await saveViewDxf(editor.project, { levelId: ui.levelId, areaPlanId, showRoofProjection: ui.showRoofProjection }));
  } catch (e) {
    say(`Não foi possível exportar o DXF: ${why(e)}`);
  }
}

export async function exportPdf(): Promise<void> {
  try {
    // Sem prancha: cria uma com a planta do nível atual (ação com desfazer) e exporta essa.
    let bytes = sheetsPdfOf(editor.project);
    if (!bytes) {
      pranchaDaPlantaAtual(editor.store, useUi.getState().levelId);
      bytes = sheetsPdfOf(editor.project);
    }
    say(bytes ? await savePdf(`${editor.project.name || 'projeto'}-pranchas.pdf`, bytes) : 'Nenhuma prancha para exportar.');
  } catch (e) {
    say(`Não foi possível exportar o PDF: ${why(e)}`);
  }
}

export async function exportIfc(): Promise<void> {
  try {
    say(await saveProjectIfc(editor.project));
  } catch (e) {
    say(`Não foi possível exportar o IFC: ${why(e)}`);
  }
}

export const nextTheme = (t: ThemePref): ThemePref => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system');
