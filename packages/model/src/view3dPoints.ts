import { newId } from './ids.ts';
import { projectSheets, sheetView3DCameraIssue, type SheetView3DCamera, type SheetViewSource } from './sheet.ts';
import type { Id, Project } from './types.ts';

/**
 * Pontos de vista 3D salvos (decisão 0040). Um ponto é nome + câmera; a prancha guarda só o `pointId` e resolve a
 * câmera na hora de desenhar. Editar o ponto (inclusive "atualizar com a câmera atual") muda todas as pranchas que o
 * usam; excluir o ponto copia a câmera para as vistas que o usavam, para nenhuma prancha ficar em branco.
 */
export interface View3DPoint {
  id: Id;
  name: string;
  camera: SheetView3DCamera;
}

/** Pontos de vista do projeto (ausente = nenhum). */
export const projectView3DPoints = (p: Pick<Project, 'view3dPoints'>): View3DPoint[] => p.view3dPoints ?? [];

export function view3DPointOf(p: Pick<Project, 'view3dPoints'>, id: Id): View3DPoint | undefined {
  return projectView3DPoints(p).find((x) => x.id === id);
}

/** Nome padrão de um ponto novo: "Vista 3D" ou "Vista 3D 2", "Vista 3D 3"… */
export function defaultView3DPointName(p: Pick<Project, 'view3dPoints'>): string {
  const nomes = new Set(projectView3DPoints(p).map((x) => x.name));
  if (!nomes.has('Vista 3D')) return 'Vista 3D';
  for (let n = 2; ; n++) if (!nomes.has(`Vista 3D ${n}`)) return `Vista 3D ${n}`;
}

/** Ponto novo a partir de uma câmera (clona o alvo: nada de compartilhar objeto com a tela). */
export function makeView3DPoint(camera: SheetView3DCamera, name: string): View3DPoint {
  return { id: newId('v3d'), name, camera: { ...camera, target: { ...camera.target } } };
}

/**
 * Câmera que a vista da prancha usa: a do ponto referenciado, senão a cópia embutida (arquivos antigos) e, sem
 * nenhuma das duas, null (o desenho enquadra o modelo com a câmera padrão).
 */
export function cameraDaVista3D(p: Pick<Project, 'view3dPoints'>, view: Extract<SheetViewSource, { kind: '3d' }>): SheetView3DCamera | null {
  if (view.pointId !== undefined) {
    const ponto = view3DPointOf(p, view.pointId);
    if (ponto) return ponto.camera;
  }
  return view.camera ?? null;
}

/** Pranchas/vistas que usam o ponto (para a confirmação de exclusão e para a lista da interface). */
export function view3DPointsUsage(p: Pick<Project, 'view3dPoints' | 'sheets'>, pointId: Id): Array<{ sheetId: Id; viewportId: Id }> {
  const out: Array<{ sheetId: Id; viewportId: Id }> = [];
  for (const s of projectSheets(p)) {
    for (const v of s.viewports) if (v.view.kind === '3d' && v.view.pointId === pointId) out.push({ sheetId: s.id, viewportId: v.id });
  }
  return out;
}

/** Comandos do catálogo de pontos de vista 3D (com desfazer, como os demais). */
export type View3DPointCommand =
  | { type: 'addView3DPoint'; point: View3DPoint }
  | { type: 'updateView3DPoint'; id: Id; patch: Partial<Pick<View3DPoint, 'name' | 'camera'>> }
  | { type: 'removeView3DPoint'; id: Id }
  | { type: 'setView3DPointOrder'; ids: Id[] };

/** Recusa em pt-BR se o nome for vazio (o ponto precisa aparecer na lista e na prancha). */
function nomeIssue(name: string): string | null {
  return name.trim() === '' ? 'O nome do ponto de vista não pode ficar vazio.' : null;
}

/** Aplica um comando do catálogo sobre o rascunho do projeto. Lança Error em pt-BR se recusar. */
export function applyView3DPointCommand(p: Project, c: View3DPointCommand): void {
  switch (c.type) {
    case 'addView3DPoint': {
      const nome = nomeIssue(c.point.name);
      if (nome) throw new Error(nome);
      const camera = sheetView3DCameraIssue(c.point.camera);
      if (camera) throw new Error(camera);
      if (projectView3DPoints(p).some((x) => x.id === c.point.id)) throw new Error('Ponto de vista 3D já existe');
      p.view3dPoints = [...projectView3DPoints(p), { ...c.point, name: c.point.name.trim(), camera: { ...c.point.camera, target: { ...c.point.camera.target } } }];
      break;
    }
    case 'updateView3DPoint': {
      const atual = view3DPointOf(p, c.id);
      if (!atual) throw new Error('Ponto de vista 3D inexistente');
      if (c.patch.name !== undefined) {
        const nome = nomeIssue(c.patch.name);
        if (nome) throw new Error(nome);
      }
      if (c.patch.camera) {
        const camera = sheetView3DCameraIssue(c.patch.camera);
        if (camera) throw new Error(camera);
      }
      p.view3dPoints = projectView3DPoints(p).map((x) =>
        x.id === c.id
          ? {
              ...x,
              ...(c.patch.name !== undefined ? { name: c.patch.name.trim() } : {}),
              ...(c.patch.camera ? { camera: { ...c.patch.camera, target: { ...c.patch.camera.target } } } : {}),
            }
          : x,
      );
      break;
    }
    case 'removeView3DPoint': {
      const alvo = view3DPointOf(p, c.id);
      if (!alvo) throw new Error('Ponto de vista 3D inexistente');
      // Antes de sair do catálogo, a câmera vira cópia embutida nas vistas: a prancha continua com o mesmo desenho.
      if (p.sheets) {
        p.sheets = p.sheets.map((s) => ({
          ...s,
          viewports: s.viewports.map((v) =>
            v.view.kind === '3d' && v.view.pointId === c.id
              ? { ...v, view: { kind: '3d', camera: { ...alvo.camera, target: { ...alvo.camera.target } } } }
              : v,
          ),
        }));
      }
      p.view3dPoints = projectView3DPoints(p).filter((x) => x.id !== c.id);
      break;
    }
    case 'setView3DPointOrder': {
      const atuais = projectView3DPoints(p);
      if (c.ids.length !== atuais.length || new Set(c.ids).size !== atuais.length) throw new Error('A ordem dos pontos de vista 3D está incompleta.');
      const porId = new Map(atuais.map((x) => [x.id, x]));
      const proximos = c.ids.map((id) => porId.get(id));
      if (proximos.some((x) => x === undefined)) throw new Error('A ordem dos pontos de vista 3D cita um ponto inexistente.');
      p.view3dPoints = proximos as View3DPoint[];
      break;
    }
  }
}
