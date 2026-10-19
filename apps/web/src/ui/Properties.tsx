import { useMemo, type ReactElement } from 'react';
import { joinStatus, levelFrames, quantifyLevel } from '@hestia/engine';
import {
  FUNCTION_LABEL,
  isOpening,
  isWall,
  newId,
  type DetailLevel,
  type JoinKind,
  openingSill,
  totalThickness,
  wallLength,
  wallType,
  type Id,
  type LocationLine,
  type Opening,
  type Wall,
  wallArc,
} from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { LOCATION_LABEL } from './OptionsBar.tsx';
import { ProfileRow } from './ProfileRow.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

function common<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}

function patch(ids: Id[], p: Partial<Wall> | Partial<Opening>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

const JOIN_LABEL: Record<JoinKind, string> = { butt: 'Encosto', miter: 'Esquadria', square: 'Esquadro' };

function JoinRows({ wall }: { wall: Wall }): ReactElement {
  const p = useProject();
  const frames = useMemo(() => levelFrames(p, wall.levelId), [p, wall.levelId]);
  const tol = p.settings.joinTolerance;
  const rows = (['a', 'b'] as const).map((end) => {
    const st = joinStatus(frames, wall.id, end, tol);
    const label = end === 'a' ? 'Início' : 'Fim';
    if (st.kind === 'pair') {
      const partner = p.elements[st.partners[0]!.wallId];
      const partnerEnd = st.partners[0]!.end;
      const firstIsMe = !isWall(partner) || wall.order <= partner.order;
      const src = firstIsMe ? wall : partner;
      const srcEnd = firstIsMe ? end : partnerEnd;
      const cfg = srcEnd === 'a' ? src.joinStart : src.joinEnd;
      const ends = [{ wallId: wall.id, end }, ...st.partners];
      const set = (kind: JoinKind, flip: boolean): void => editor.store.exec({ type: 'setJoin', ends, config: { kind, flip } });
      return (
        <div key={end}>
          <Row label={`${label}: junção`} htmlFor={`p-join-${end}`}>
            <select id={`p-join-${end}`} className="select" value={cfg.kind} onChange={(e) => set(e.target.value as JoinKind, cfg.flip)}>
              {(Object.keys(JOIN_LABEL) as JoinKind[]).map((k) => <option key={k} value={k}>{JOIN_LABEL[k]}</option>)}
            </select>
          </Row>
          {cfg.kind !== 'miter' && (
            <Row label="Inverter ordem"><Check id={`p-joinflip-${end}`} checked={cfg.flip} onChange={(v) => set(cfg.kind, v)} /></Row>
          )}
        </div>
      );
    }
    const text = st.kind === 'free' ? 'Livre' : st.kind === 'disallowed' ? 'Não unido' : st.kind === 'tee' ? 'Em T (encosto fixo)' : `Nó com ${st.partners.length + 1} paredes`;
    return <Row key={end} label={`${label}: junção`}><span className="val soft">{text}</span></Row>;
  });
  return <>{rows}</>;
}

function WallProps({ walls }: { walls: Wall[] }): ReactElement {
  const p = useProject();
  const ids = walls.map((w) => w.id);
  const typeId = common(walls, (w) => w.typeId);
  const level = common(walls, (w) => w.levelId);
  const base = common(walls, (w) => w.baseOffset);
  const top = common(walls, (w) => w.topLevelId ?? '');
  const height = common(walls, (w) => w.height);
  const topOff = common(walls, (w) => w.topOffset);
  const loc = common(walls, (w) => w.locationLine);
  const flipped = common(walls, (w) => w.flipped);
  const noS = common(walls, (w) => w.noJoinStart);
  const noE = common(walls, (w) => w.noJoinEnd);
  const sag = common(walls, (w) => w.sag);
  const mark = common(walls, (w) => w.mark);
  const comments = common(walls, (w) => w.comments);
  const single = walls.length === 1 ? walls[0]! : null;
  const t = single ? wallType(p, single) : null;
  const q = useMemo(() => {
    if (!single) return null;
    const lv = single.levelId;
    return quantifyLevel(p, editor.resolved(lv)).walls.find((x) => x.wallId === single.id) ?? null;
  }, [p, single]);

  const duplicateType = (): void => {
    const src = p.wallTypes[typeId.value];
    if (!src) return;
    const copy = { ...src, id: newId('wt'), name: `${src.name} (cópia)` };
    editor.store.transaction('Duplicar tipo', () => {
      editor.store.exec({ type: 'upsertWallType', wallType: copy });
      patch(ids, { typeId: copy.id });
    });
    useUi.setState({ dialog: 'wallType', dialogArg: copy.id });
  };

  return (
    <>
      <div className="typesel">
        <div className="row">
          <select id="prop-walltype" className="select" value={typeId.mixed ? '' : typeId.value} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de parede">
            {typeId.mixed && <option value="">variados</option>}
            {Object.values(p.wallTypes).map((tp) => (
              <option key={tp.id} value={tp.id}>{tp.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'wallType', dialogArg: typeId.value })}>Editar tipo…</button>
          <button className="btn small" disabled={typeId.mixed} onClick={duplicateType}>Duplicar tipo</button>
        </div>
      </div>
      <Group title="Restrições">
        <Row label="Nível base" htmlFor="p-level">
          <select id="p-level" className="select" value={level.mixed ? '' : level.value} onChange={(e) => e.target.value && patch(ids, { levelId: e.target.value })}>
            {level.mixed && <option value="">variados</option>}
            {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Row>
        <Row label="Desloc. da base" htmlFor="p-base"><NumField id="p-base" value={base.value} mixed={base.mixed} onCommit={(v) => patch(ids, { baseOffset: v })} unit="m" /></Row>
        <Row label="Restrição de topo" htmlFor="p-top">
          <select id="p-top" className="select" value={top.mixed ? '' : top.value} onChange={(e) => patch(ids, { topLevelId: e.target.value || null })}>
            {top.mixed && <option value="">variados</option>}
            <option value="">Altura livre</option>
            {p.levels.map((l) => <option key={l.id} value={l.id}>Até {l.name}</option>)}
          </select>
        </Row>
        {!top.mixed && top.value === '' ? (
          <Row label="Altura" htmlFor="p-height"><NumField id="p-height" value={height.value} mixed={height.mixed} onCommit={(v) => patch(ids, { height: Math.max(0.1, v) })} unit="m" /></Row>
        ) : (
          <Row label="Desloc. do topo" htmlFor="p-topoff"><NumField id="p-topoff" value={topOff.value} mixed={topOff.mixed} onCommit={(v) => patch(ids, { topOffset: v })} unit="m" /></Row>
        )}
        <ProfileRow key={ids.join(',')} walls={walls} />
        <Row label="Linha de localização" htmlFor="p-loc">
          <select id="p-loc" className="select" value={loc.mixed ? '' : loc.value} onChange={(e) => e.target.value && patch(ids, { locationLine: e.target.value as LocationLine })}>
            {loc.mixed && <option value="">variados</option>}
            {(Object.keys(LOCATION_LABEL) as LocationLine[]).map((k) => <option key={k} value={k}>{LOCATION_LABEL[k]}</option>)}
          </select>
        </Row>
        <Row label="Flecha do arco" htmlFor="p-sag"><NumField id="p-sag" value={sag.value} mixed={sag.mixed} onCommit={(v) => patch(ids, { sag: v })} unit="m" /></Row>
        <Row label="Inverter lado externo"><Check id="p-flip" checked={flipped.value} mixed={flipped.mixed} onChange={(v) => patch(ids, { flipped: v })} /></Row>
        <Row label="Não unir no início"><Check id="p-nos" checked={noS.value} mixed={noS.mixed} onChange={(v) => patch(ids, { noJoinStart: v })} /></Row>
        <Row label="Não unir no fim"><Check id="p-noe" checked={noE.value} mixed={noE.mixed} onChange={(v) => patch(ids, { noJoinEnd: v })} /></Row>
      </Group>
      {single && (
        <Group title="Junções">
          <JoinRows wall={single} />
        </Group>
      )}
      <Group title="Construção">
        {t ? (
          <>
            <Row label="Espessura total"><span className="val">{fmt(totalThickness(t) * 100, 1)} cm</span></Row>
            {t.layers.map((l, i) => (
              <div className="prow" key={i} style={{ minHeight: 22 }}>
                <span className="lbl" title={FUNCTION_LABEL[l.function]}>{FUNCTION_LABEL[l.function]}</span>
                <span className="val soft" title={p.materials[l.materialId]?.name}>{fmt(l.thickness * 100, 1)} cm</span>
              </div>
            ))}
          </>
        ) : (
          <div className="hint">Selecione uma única parede para ver as camadas.</div>
        )}
      </Group>
      <Group title="Dimensões" open={!!single}>
        {single ? (
          <>
            <Row label="Comprimento"><span className="val">{fmt(wallLength(single), 3)} m</span></Row>
            {wallArc(single) && <Row label="Raio do eixo"><span className="val">{fmt(wallArc(single)!.radius, 3)} m</span></Row>}
            <Row label="Área líquida"><span className="val">{fmt(q?.netFaceArea ?? 0)} m²</span></Row>
            <Row label="Volume"><span className="val">{fmt(q?.volume ?? 0, 3)} m³</span></Row>
          </>
        ) : (
          <Row label="Comprimento total"><span className="val">{fmt(walls.reduce((s, w) => s + wallLength(w), 0), 2)} m</span></Row>
        )}
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-mark"><TextField id="p-mark" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-comm"><TextField id="p-comm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
    </>
  );
}

function OpeningProps({ items }: { items: Opening[] }): ReactElement {
  const p = useProject();
  const ids = items.map((o) => o.id);
  const kinds = new Set(items.map((o) => o.kind));
  const kind = kinds.size === 1 ? items[0]!.kind : null;
  const typeId = common(items, (o) => o.typeId);
  const single = items.length === 1 ? items[0]! : null;
  const type = single ? p.openingTypes[single.typeId] : null;
  const host = single ? p.elements[single.hostId] : null;
  const hand = common(items, (o) => o.flipHand);
  const facing = common(items, (o) => o.flipFacing);
  const mark = common(items, (o) => o.mark);
  return (
    <>
      <div className="typesel">
        <select id="prop-opentype" className="select" value={typeId.mixed ? '' : typeId.value} disabled={!kind} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de abertura">
          {typeId.mixed && <option value="">variados</option>}
          {Object.values(p.openingTypes).filter((t) => !kind || t.kind === kind).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'openingType', dialogArg: typeId.value })}>Editar tipo…</button>
        </div>
      </div>
      <Group title="Restrições">
        {single && (
          <>
            <Row label="Distância ao início" htmlFor="p-off"><NumField id="p-off" value={single.offset} onCommit={(v) => patch(ids, { offset: v })} unit="m" /></Row>
            <Row label="Peitoril" htmlFor="p-sill">
              <NumField id="p-sill" value={type ? openingSill(type, single) : 0} onCommit={(v) => patch(ids, { sillOverride: v })} unit="m" min={0} />
            </Row>
            {single.sillOverride !== null && (
              <div className="prow"><span /><button className="chiplink" onClick={() => patch(ids, { sillOverride: null })}>Usar peitoril do tipo</button></div>
            )}
          </>
        )}
        <Row label="Inverter dobradiça"><Check id="p-hand" checked={hand.value} mixed={hand.mixed} onChange={(v) => patch(ids, { flipHand: v })} /></Row>
        <Row label="Inverter sentido"><Check id="p-facing" checked={facing.value} mixed={facing.mixed} onChange={(v) => patch(ids, { flipFacing: v })} /></Row>
      </Group>
      <Group title="Dimensões" open={!!single}>
        {type && (
          <>
            <Row label="Largura"><span className="val">{fmt(type.width * 100, 0)} cm</span></Row>
            <Row label="Altura"><span className="val">{fmt(type.height * 100, 0)} cm</span></Row>
            <Row label="Anfitriã"><span className="val soft">{host && isWall(host) ? p.wallTypes[host.typeId]?.name ?? '' : ''}</span></Row>
          </>
        )}
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-omark"><TextField id="p-omark" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
      </Group>
    </>
  );
}

function ViewProps(): ReactElement {
  const p = useProject();
  const s = useUi();
  const lvl = p.levels.find((l) => l.id === s.levelId);
  return (
    <>
      <div className="typesel"><strong>{s.view === 'plan' ? `Planta · ${lvl?.name ?? ''}` : 'Modelo 3D'}</strong></div>
      <Group title="Vista">
        <Row label="Nível" htmlFor="v-level">
          <select id="v-level" className="select" value={s.levelId} onChange={(e) => editor.selectLevel(e.target.value)}>
            {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Row>
        <Row label="Elevação"><span className="val">{fmt(lvl?.elevation ?? 0)} m</span></Row>
        <Row label="Grade"><Check id="v-grid" checked={s.showGrid} onChange={(v) => useUi.setState({ showGrid: v })} /></Row>
        <Row label="Subpavimento"><Check id="v-under" checked={s.showUnderlay} onChange={(v) => useUi.setState({ showUnderlay: v })} /></Row>
        <Row label="Etiquetas de parede"><Check id="v-tags" checked={p.settings.showTags} onChange={(v) => editor.store.exec({ type: 'setSettings', patch: { showTags: v } })} /></Row>
        <Row label="Depurar junções"><Check id="v-debugjoins" checked={p.settings.debugJoins} onChange={(v) => editor.store.exec({ type: 'setSettings', patch: { debugJoins: v } })} /></Row>
        <Row label="Nível de detalhe" htmlFor="v-detail">
          <select id="v-detail" className="select" value={p.settings.detail} onChange={(e) => editor.store.exec({ type: 'setSettings', patch: { detail: e.target.value as DetailLevel } })}>
            <option value="coarse">Grosseiro</option>
            <option value="medium">Médio</option>
            <option value="fine">Fino</option>
          </select>
        </Row>
        <div className="prow"><span /><button className="chiplink" onClick={() => useUi.setState({ dialog: 'levels' })}>Editar níveis…</button></div>
      </Group>
      <Group title="3D" open={s.view === '3d'}>
        <Row label="Sombras"><Check id="v-shadows" checked={s.shadows} onChange={(v) => useUi.setState({ shadows: v })} /></Row>
        <Row label="Arestas"><Check id="v-edges" checked={s.edges} onChange={(v) => useUi.setState({ edges: v })} /></Row>
      </Group>
      <Group title="Padrões do projeto" open={false}>
        <Row label="Tolerância de junção" htmlFor="v-jt"><NumField id="v-jt" value={p.settings.joinTolerance} scale={100} decimals={1} unit="cm" min={0.1} onCommit={(v) => editor.store.exec({ type: 'setSettings', patch: { joinTolerance: v } })} /></Row>
        <Row label="Altura de parede" htmlFor="v-wh"><NumField id="v-wh" value={s.options.wallHeight} unit="m" onCommit={(v) => useUi.setState({ options: { ...s.options, wallHeight: v } })} /></Row>
      </Group>
      <div className="hint">Selecione um elemento para ver e editar suas propriedades. Mudar o <em>tipo</em> altera todas as instâncias; mudar a <em>instância</em> altera só a selecionada.</div>
    </>
  );
}

export function Properties(): ReactElement {
  const p = useProject();
  const sel = useUi((s) => s.selection);
  const els = sel.map((id) => p.elements[id]).filter((e) => !!e);
  const walls = els.filter(isWall);
  const ops = els.filter(isOpening);
  return (
    <aside className="side left" aria-label="Propriedades">
      <div className="panel-head">
        <span>Propriedades</span>
        <span style={{ color: 'var(--fg-faint)', fontWeight: 400 }}>
          {walls.length ? `${walls.length} parede${walls.length > 1 ? 's' : ''}` : ops.length ? `${ops.length} abertura${ops.length > 1 ? 's' : ''}` : 'Vista'}
        </span>
      </div>
      <div className="panel-scroll">
        {walls.length > 0 && ops.length === 0 ? <WallProps walls={walls} /> : ops.length > 0 && walls.length === 0 ? <OpeningProps items={ops} /> : walls.length + ops.length > 0 ? (
          <div className="hint">Seleção mista de paredes e aberturas. Selecione apenas um tipo de elemento para editar propriedades.</div>
        ) : <ViewProps />}
      </div>
    </aside>
  );
}
