import { openingTypeById, clampOffset, isOpening, isWall, type Id, type Opening, type Project, type ProjectStore, wallLength } from '@hestia/model';

const fmt = (m: number): string => m.toFixed(2).replace('.', ',');

/** Resultado de trocar o tipo de abertura: o que gravar (posição por abertura) ou o motivo da recusa. */
export type OpeningTypePlan =
  | { ok: true; updates: Array<{ id: Id; offset: number; from: number }> }
  | { ok: false; message: string };

/**
 * Planeja a troca de tipo das aberturas `ids` para `typeId` (Propriedades). O modelo só empurra a abertura para as
 * pontas da parede; aqui se vê se ela ainda cabe: recusa quando a parede é curta demais ou quando a abertura nova
 * sobrepõe outra abertura da mesma parede (decisão de segurança: nada muda em silêncio).
 */
export function planOpeningTypeChange(p: Project, ids: Id[], typeId: Id): OpeningTypePlan {
  const t = openingTypeById(p, typeId);
  if (!t) return { ok: false, message: 'Tipo de abertura inexistente.' };
  const updates: Array<{ id: Id; offset: number; from: number }> = [];
  for (const id of ids) {
    const o = p.elements[id];
    if (!o || !isOpening(o)) continue;
    const host = p.elements[o.hostId];
    if (!isWall(host)) continue;
    if (wallLength(host) < t.width + 0.02) return { ok: false, message: `Parede curta demais para ${t.name}: a abertura não cabe.` };
    const next: Opening = { ...o, typeId };
    const offset = clampOffset(p, next, host);
    const half = t.width / 2;
    // Outras aberturas da mesma parede (as da própria seleção ficam de fora: mudam juntas, com o mesmo tipo).
    const clash = Object.values(p.elements).some((e) => {
      if (!isOpening(e) || e.hostId !== host.id || ids.includes(e.id)) return false;
      const w = (openingTypeById(p, e.typeId)?.width ?? 0.8) / 2;
      return offset + half > e.offset - w + 1e-6 && offset - half < e.offset + w - 1e-6;
    });
    if (clash) return { ok: false, message: `Sem espaço para ${t.name} nesta parede: a abertura sobreporia outra.` };
    updates.push({ id, offset, from: o.offset });
  }
  return { ok: true, updates };
}

/**
 * Troca o tipo das aberturas selecionadas (um só Ctrl+Z) e avisa na barra de status quando alguma foi deslocada para
 * caber. Recusada, nada é gravado e a barra mostra o motivo.
 */
export function changeOpeningType(store: ProjectStore, ids: Id[], typeId: Id, setStatus: (m: string) => void): void {
  const plan = planOpeningTypeChange(store.project, ids, typeId);
  if (!plan.ok) {
    setStatus(plan.message);
    return;
  }
  store.transaction('Trocar tipo de abertura', () => {
    store.exec({ type: 'updateElements', ids, patch: { typeId } });
    for (const u of plan.updates) store.exec({ type: 'updateElements', ids: [u.id], patch: { offset: u.offset } });
  });
  const moved = plan.updates.filter((u) => Math.abs(u.offset - u.from) > 1e-6);
  if (moved.length === 1) setStatus(`A abertura foi deslocada para caber: ${fmt(moved[0]!.from)} → ${fmt(moved[0]!.offset)} m. Ctrl+Z desfaz.`);
  else if (moved.length > 1) setStatus(`${moved.length} aberturas foram deslocadas para caber. Ctrl+Z desfaz.`);
}
