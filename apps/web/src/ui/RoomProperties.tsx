import { useMemo, type ReactElement } from 'react';
import { resolveRooms, type ResolvedRoom } from '@hestia/engine';
import { areaPlanOf, DEFAULT_ROOM_CATEGORIES, roomCeilingHeight, type AreaPlan, type Id, type Project, type Room, type RoomTag, type TagField } from '@hestia/model';
import { ensureRoomTagAction, removeRoomTagAction, updateRoomTagAction, type RoomTagPatch } from '../editor/areaPlanActions.ts';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { useFormat } from './useUnits.ts';


const ROOM_DEFAULT_COLOR = '#b8c4d4';

const say = (status: string): void => useUi.setState({ status });

/** Campos da etiqueta de ambiente, na ordem em que aparecem no bloco. */
export const TAG_FIELD_OPTIONS: ReadonlyArray<{ field: TagField; label: string }> = [
  { field: 'name', label: 'Nome' },
  { field: 'number', label: 'Número' },
  { field: 'area', label: 'Área' },
  { field: 'category', label: 'Categoria' },
  { field: 'level', label: 'Nível' },
  { field: 'perimeter', label: 'Perímetro' },
  { field: 'volume', label: 'Volume' },
  { field: 'custom', label: 'Personalizado' },
];

/** Liga ou desliga um campo da etiqueta, mantendo ao menos um (o modelo recusa a lista vazia). */
export function toggleTagField(fields: readonly TagField[], field: TagField): TagField[] {
  const on = new Set(fields);
  if (on.has(field)) {
    if (on.size === 1) return [...fields];
    on.delete(field);
  } else on.add(field);
  return TAG_FIELD_OPTIONS.map((o) => o.field).filter((f) => on.has(f));
}

/** Valor comum a todos os selecionados, ou `mixed` quando divergem. */
function common<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}

function patch(ids: Id[], p: Partial<Room>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

/** Aviso do ambiente sem circuito fechado: o motivo (ponto fora ou circuito aberto). */
export function roomWarning(r: ResolvedRoom): string | null {
  if (r.problem === 'fora') return 'Sem circuito fechado: o ponto interior não está dentro de paredes fechadas.';
  if (r.problem === 'aberto') return 'Circuito aberto: há um vão entre as paredes em volta do ambiente.';
  if (r.duplicateOf !== undefined) return `Mesmo circuito do ambiente "${r.duplicateOf}".`;
  return null;
}

/**
 * Etiqueta do ambiente **nesta planta de área** (`plan.tags`). Os ajustes são da vista: não mexem em
 * `Room.labelPosition` nem no rótulo compartilhado do grupo "Rótulo (todas as vistas)".
 */
export function RoomTagGroup({ room, plan, hasCircuit }: { room: Room; plan: AreaPlan; hasCircuit: boolean }): ReactElement {
  const tag: RoomTag | undefined = plan.tags.find((t) => t.roomId === room.id);
  const fields = tag?.fields ?? plan.graphics.tagDefault.fields;
  const orientation = tag?.orientation ?? plan.graphics.tagDefault.orientation;
  const leader = tag?.leader ?? plan.graphics.tagDefault.leader;
  const save = (patch: RoomTagPatch): void => {
    try {
      if (!updateRoomTagAction(editor.store, plan.id, room.id, patch)) say('O ambiente não tem circuito fechado nesta planta.');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Não foi possível alterar a etiqueta.');
    }
  };
  const toggle = (field: TagField): void => {
    const patch: RoomTagPatch = { fields: toggleTagField(fields, field) };
    // Ao ligar "Personalizado" sem texto, começa com o nome para o rótulo não desaparecer.
    if (field === 'custom' && !fields.includes('custom') && !tag?.custom) patch.custom = room.name;
    save(patch);
  };
  return (
    <Group title="Etiqueta nesta planta de área">
      {hasCircuit ? (
        <>
          <Row label="Campos">
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', padding: '2px 4px' }}>
              {TAG_FIELD_OPTIONS.map((o) => (
                <Check key={o.field} id={`p-tagfield-${o.field}`} checked={fields.includes(o.field)} disabled={fields.length === 1 && fields.includes(o.field)} onChange={() => toggle(o.field)}>
                  {o.label}
                </Check>
              ))}
            </span>
          </Row>
          {fields.includes('custom') && (
            <Row label="Texto" htmlFor="p-tagcustom">
              <TextField id="p-tagcustom" value={tag?.custom ?? ''} placeholder="Texto da etiqueta" onCommit={(v) => save({ custom: v })} />
            </Row>
          )}
          <Row label="Orientação" htmlFor="p-tagorient">
            <select id="p-tagorient" className="select" value={orientation} onChange={(e) => save({ orientation: e.target.value as RoomTag['orientation'] })}>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </Row>
          <Row label="Chamada" htmlFor="p-tagleader">
            <select id="p-tagleader" className="select" value={leader} onChange={(e) => save({ leader: e.target.value as RoomTag['leader'] })}>
              <option value="none">Nenhuma</option>
              <option value="straight">Reta</option>
              <option value="kinked">Com cotovelo</option>
              <option value="crossed">Duas linhas cruzadas</option>
            </select>
          </Row>
          <Row label="Visível nesta planta"><Check id="p-tagvisible" checked={tag?.visible ?? true} onChange={(v) => save({ visible: v })} /></Row>
          <div className="btn-row">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const created = ensureRoomTagAction(editor.store, plan.id, room.id);
                say(created ? (tag ? 'A etiqueta desta planta já está criada.' : 'Etiqueta criada nesta planta.') : 'O ambiente não tem circuito fechado nesta planta.');
              }}
            >
              Criar/atualizar etiqueta
            </button>
            <button type="button" className="btn small" disabled={!tag} onClick={() => say(removeRoomTagAction(editor.store, plan.id, room.id) ? 'Etiqueta voltou ao padrão da planta.' : 'Esta planta já usa o padrão.')}>
              Voltar ao padrão
            </button>
          </div>
          <div className="hint">Estes ajustes valem só nesta planta de área. A posição do rótulo continua compartilhada em “Rótulo (todas as vistas)”.</div>
        </>
      ) : (
        <div className="hint">Sem circuito fechado: feche as paredes em volta do ambiente para a etiqueta aparecer nesta planta.</div>
      )}
    </Group>
  );
}

/** Propriedades de um ou mais ambientes: nome, número, ponto interior (leitura), deslocamento, pé-direito, acabamentos e cor, com área, perímetro e volume. */
export function RoomProperties({ rooms }: { rooms: Room[] }): ReactElement {
  const fmt = useFormat();
  const p: Project = useProject();
  // Planta de área ativa: a etiqueta da vista só aparece nesse contexto.
  const areaPlanId = useUi((s) => (s.view === 'plan' && s.planKind === 'area' ? s.areaPlanId : null));
  const areaPlan = areaPlanId ? areaPlanOf(p, areaPlanId) : undefined;
  const ids = rooms.map((r) => r.id);
  const name = common(rooms, (r) => r.name);
  const number = common(rooms, (r) => r.number);
  const offset = common(rooms, (r) => r.heightOffset ?? 0);
  const ceiling = common(rooms, (r) => roomCeilingHeight(p, r));
  const floorFin = common(rooms, (r) => r.floorFinish ?? '');
  const wallFin = common(rooms, (r) => r.wallFinish ?? '');
  const ceilFin = common(rooms, (r) => r.ceilingFinish ?? '');
  const color = common(rooms, (r) => r.color ?? '');
  const category = common(rooms, (r) => r.categoryId ?? '');
  const cats = p.roomCategories ?? DEFAULT_ROOM_CATEGORIES;
  const single = rooms.length === 1 ? rooms[0]! : null;
  const resolved = useMemo(() => {
    const levels = [...new Set(rooms.map((r) => r.levelId))];
    return new Map(levels.flatMap((levelId) => resolveRooms(p, levelId).map((r) => [r.roomId, r] as const)));
  }, [p, rooms]);
  const geo = single ? resolved.get(single.id) : undefined;
  const sum = (f: (r: ResolvedRoom) => number): number => rooms.reduce((s, r) => s + (resolved.get(r.id) ? f(resolved.get(r.id)!) : 0), 0);
  const warning = single && geo ? roomWarning(geo) : null;

  return (
    <>
      {warning && <div className="hint warn" role="alert">{warning}</div>}
      <Group title="Dados de identidade">
        <Row label="Nome" htmlFor="p-rname"><TextField id="p-rname" value={name.value} mixed={name.mixed} onCommit={(v) => patch(ids, { name: v })} /></Row>
        <Row label="Número" htmlFor="p-rnum"><TextField id="p-rnum" value={number.value} mixed={number.mixed} onCommit={(v) => patch(ids, { number: v })} /></Row>
        <Row label="Categoria" htmlFor="p-rcat">
          <select id="p-rcat" className="select" value={category.value} onChange={(e) => patch(ids, { categoryId: e.target.value || undefined })}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Row>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => useUi.setState({ dialog: 'roomCategories' })}>Gerenciar categorias…</button>
        </div>
        {single && (
          <Row label="Ponto interior">
            <span className="val" title="Ponto usado para achar o circuito de paredes (somente leitura)">
              {fmt('length', single.point.x)}; {fmt('length', single.point.y)}
            </span>
          </Row>
        )}
      </Group>
      <Group title="Dimensões">
        <Row label="Desloc. da base" htmlFor="p-roff">
          <NumField id="p-roff" value={offset.value} mixed={offset.mixed} onCommit={(v) => patch(ids, { heightOffset: v })} quantity="length" />
        </Row>
        <Row label="Pé-direito" htmlFor="p-rceil">
          <NumField id="p-rceil" value={ceiling.value} mixed={ceiling.mixed} min={0.1} onCommit={(v) => patch(ids, { ceilingHeight: v })} quantity="length" />
        </Row>
        <Row label={rooms.length > 1 ? 'Área total' : 'Área líquida'}><span className="val">{fmt('area', sum((r) => r.area))}</span></Row>
        <Row label={rooms.length > 1 ? 'Perímetro total' : 'Perímetro'}><span className="val">{fmt('length', sum((r) => r.perimeter))}</span></Row>
        <Row label={rooms.length > 1 ? 'Volume total' : 'Volume'}><span className="val">{fmt('volume', sum((r) => r.volume))}</span></Row>
      </Group>
      <Group title="Acabamentos">
        <Row label="Piso" htmlFor="p-rfloor"><TextField id="p-rfloor" value={floorFin.value} mixed={floorFin.mixed} onCommit={(v) => patch(ids, { floorFinish: v })} /></Row>
        <Row label="Parede" htmlFor="p-rwall"><TextField id="p-rwall" value={wallFin.value} mixed={wallFin.mixed} onCommit={(v) => patch(ids, { wallFinish: v })} /></Row>
        <Row label="Forro" htmlFor="p-rceilf"><TextField id="p-rceilf" value={ceilFin.value} mixed={ceilFin.mixed} onCommit={(v) => patch(ids, { ceilingFinish: v })} /></Row>
      </Group>
      {single && (
        <Group title="Rótulo (todas as vistas)">
          <Row label="Posição X" htmlFor="p-lx">
            <NumField id="p-lx" value={(single.labelPosition ?? single.referencePoint ?? single.point).x} unit="m" onCommit={(v) => editor.store.exec({ type: 'setRoomLabel', id: single.id, position: { x: v, y: (single.labelPosition ?? single.referencePoint ?? single.point).y } }, 'Mover rótulo')} />
          </Row>
          <Row label="Posição Y" htmlFor="p-ly">
            <NumField id="p-ly" value={(single.labelPosition ?? single.referencePoint ?? single.point).y} unit="m" onCommit={(v) => editor.store.exec({ type: 'setRoomLabel', id: single.id, position: { x: (single.labelPosition ?? single.referencePoint ?? single.point).x, y: v } }, 'Mover rótulo')} />
          </Row>
          <Row label="Rotação" htmlFor="p-lrot">
            <NumField id="p-lrot" value={single.labelRotation ?? 0} unit="°" onCommit={(v) => editor.store.exec({ type: 'setRoomLabel', id: single.id, position: single.labelPosition ?? null, rotation: v }, 'Girar rótulo')} />
          </Row>
          <Row label="Chamada" htmlFor="p-llead">
            <select id="p-llead" className="select" value={single.labelLeader ?? 'auto'} onChange={(e) => editor.store.exec({ type: 'setRoomLabel', id: single.id, position: single.labelPosition ?? null, leader: e.target.value as 'auto' | 'none' | 'straight' | 'kinked' | 'crossed' }, 'Alterar chamada do rótulo')}>
              <option value="auto">Automática (liga ao sair)</option>
              <option value="none">Sem chamada</option>
              <option value="straight">Reta</option>
              <option value="kinked">Com cotovelo</option>
              <option value="crossed">Duas linhas cruzadas</option>
            </select>
          </Row>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => editor.store.exec({ type: 'setRoomLabel', id: single.id, position: null, leader: 'auto' }, 'Recentralizar rótulo')}>Recentralizar rótulo</button>
          </div>
          <div className="hint">A posição vale na planta de piso, na planta de área e em qualquer vista onde o rótulo aparecer.</div>
        </Group>
      )}
      {single && areaPlan && areaPlan.levelId === single.levelId && (
        <RoomTagGroup room={single} plan={areaPlan} hasCircuit={!!geo?.polygon} />
      )}
      <Group title="Vista" open={false}>
        <Row label="Cor" htmlFor="p-rcolor">
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input id="p-rcolor" type="color" value={color.value || ROOM_DEFAULT_COLOR} aria-label="Cor do ambiente" onChange={(e) => patch(ids, { color: e.target.value })} />
            <button type="button" className="btn small" disabled={!color.value} onClick={() => patch(ids, { color: undefined })} title="Volta à cor padrão do tema">Padrão</button>
          </span>
        </Row>
        <div className="hint">A cor do ambiente aparece só na planta de área; a planta de piso usa o preenchimento padrão do tema.</div>
      </Group>
    </>
  );
}
