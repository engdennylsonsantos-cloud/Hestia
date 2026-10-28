import { useMemo, type ReactElement } from 'react';
import { resolveRooms, type ResolvedRoom } from '@hestia/engine';
import { roomCeilingHeight, type Id, type Project, type Room } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { Group, NumField, Row, TextField } from './fields.tsx';
import { useFormat } from './useUnits.ts';


const ROOM_DEFAULT_COLOR = '#b8c4d4';

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

/** Propriedades de um ou mais ambientes: nome, número, ponto interior (leitura), deslocamento, pé-direito, acabamentos e cor, com área, perímetro e volume. */
export function RoomProperties({ rooms }: { rooms: Room[] }): ReactElement {
  const fmt = useFormat();
  const p: Project = useProject();
  const ids = rooms.map((r) => r.id);
  const name = common(rooms, (r) => r.name);
  const number = common(rooms, (r) => r.number);
  const offset = common(rooms, (r) => r.heightOffset ?? 0);
  const ceiling = common(rooms, (r) => roomCeilingHeight(p, r));
  const floorFin = common(rooms, (r) => r.floorFinish ?? '');
  const wallFin = common(rooms, (r) => r.wallFinish ?? '');
  const ceilFin = common(rooms, (r) => r.ceilingFinish ?? '');
  const color = common(rooms, (r) => r.color ?? '');
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
      <Group title="Vista" open={false}>
        <Row label="Cor" htmlFor="p-rcolor">
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input id="p-rcolor" type="color" value={color.value || ROOM_DEFAULT_COLOR} aria-label="Cor do ambiente" onChange={(e) => patch(ids, { color: e.target.value })} />
            <button type="button" className="btn small" disabled={!color.value} onClick={() => patch(ids, { color: undefined })} title="Volta à cor padrão do tema">Padrão</button>
          </span>
        </Row>
      </Group>
    </>
  );
}
