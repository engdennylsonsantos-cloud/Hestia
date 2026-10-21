import { useMemo, type ReactElement } from 'react';
import { resolveStairsOnLevel, stairQuantities, stairValidationIssues } from '@hestia/engine';
import { levelAbove, validateProject, type Id, type Project, type Stair, type StairOpeningMode, type ValidationIssue } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { goToIssue } from '../editor/goToIssue.ts';
import { useUi } from '../editor/state.ts';
import { commonOf, patchStairs } from '../editor/stairActions.ts';
import { duplicateStairTypeFor } from '../editor/stairTypeActions.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { LevelField } from './LevelField.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/** Avisos e erros de uma escada: os de norma e de croqui (engine) e os de referência do modelo (tipo, nível, topo). */
function issuesOf(p: Project, id: Id): ValidationIssue[] {
  return [...validateProject(p), ...stairValidationIssues(p)].filter((i) => i.elementId === id);
}

/**
 * Propriedades de uma ou mais escadas: tipo, níveis, deslocamentos e abertura da laje (editáveis), quantitativos calculados
 * (só leitura, de uma escada só) e avisos com "Ir para". Cada alteração é uma transação, com um passo de desfazer.
 */
export function StairProperties({ stairs }: { stairs: Stair[] }): ReactElement {
  const p = useProject();
  const ids = stairs.map((s) => s.id);
  const typeId = commonOf(stairs, (s) => s.typeId);
  const base = commonOf(stairs, (s) => s.baseOffset);
  const top = commonOf(stairs, (s) => s.topLevelId ?? '');
  const topOff = commonOf(stairs, (s) => s.topOffset);
  const height = commonOf(stairs, (s) => s.height);
  const openingMode = commonOf(stairs, (s) => s.openingMode);
  const openingHeadroom = commonOf(stairs, (s) => s.openingHeadroom);
  const openingMargin = commonOf(stairs, (s) => s.openingMargin);
  const openingRect = commonOf(stairs, (s) => s.openingRect);
  const mark = commonOf(stairs, (s) => s.mark);
  const comments = commonOf(stairs, (s) => s.comments);
  const single = stairs.length === 1 ? stairs[0]! : null;
  const type = typeId.mixed ? null : p.stairTypes[typeId.value];
  const noLevelAbove = single ? levelAbove(p, single.levelId) === null : false;
  const noOpening = !openingMode.mixed && openingMode.value === 'none';
  const headroomOff = !openingMode.mixed && openingMode.value !== 'headroom';

  const quantities = useMemo(() => {
    if (!single) return null;
    const r = resolveStairsOnLevel(p, single.levelId).find((x) => x.id === single.id);
    return r ? stairQuantities(r) : null;
  }, [p, single]);
  const issues = useMemo(() => (single ? issuesOf(p, single.id) : []), [p, single]);

  const patch = (targets: Id[], value: Partial<Stair>): void => patchStairs(editor.store, targets, value);

  const duplicateType = (): void => {
    if (typeId.mixed) return;
    const id = duplicateStairTypeFor(editor.store, ids, typeId.value);
    if (id) useUi.setState({ dialog: 'stairType', dialogArg: id });
  };

  return (
    <>
      <div className="typesel">
        <div className="row">
          <select id="prop-stairtype" className="select" value={typeId.mixed ? '' : typeId.value} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de escada">
            {typeId.mixed && <option value="">variados</option>}
            {Object.values(p.stairTypes).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'stairType', dialogArg: typeId.value })}>Editar tipo…</button>
          <button className="btn small" disabled={typeId.mixed} onClick={duplicateType}>Duplicar tipo</button>
        </div>
      </div>
      <Group title="Restrições">
        <LevelField ids={ids} label="Nível base" />
        <Row label="Nível de topo" htmlFor="p-stop">
          <select id="p-stop" className="select" value={top.mixed ? '' : top.value} onChange={(e) => patch(ids, { topLevelId: e.target.value || null })}>
            {top.mixed && <option value="">variados</option>}
            <option value="">Automático (nível acima)</option>
            {p.levels.map((l) => <option key={l.id} value={l.id}>Até {l.name}</option>)}
          </select>
        </Row>
        <Row label="Desloc. da base" htmlFor="p-sbase"><NumField id="p-sbase" value={base.value} mixed={base.mixed} onCommit={(v) => patch(ids, { baseOffset: v })} unit="m" /></Row>
        <Row label="Desloc. do topo" htmlFor="p-stopoff"><NumField id="p-stopoff" value={topOff.value} mixed={topOff.mixed} onCommit={(v) => patch(ids, { topOffset: v })} unit="m" /></Row>
        {!top.mixed && top.value === '' && noLevelAbove && (
          <Row label="Altura" htmlFor="p-sheight"><NumField id="p-sheight" value={height.value} mixed={height.mixed} min={0.1} onCommit={(v) => patch(ids, { height: Math.max(0.1, v) })} unit="m" /></Row>
        )}
        <Row label="Abertura da laje" htmlFor="p-sopenmode">
          <select id="p-sopenmode" className="select" value={openingMode.mixed ? '' : openingMode.value} onChange={(e) => e.target.value && patch(ids, { openingMode: e.target.value as StairOpeningMode })}>
            {openingMode.mixed && <option value="">variados</option>}
            <option value="headroom">Pé-direito livre</option>
            <option value="full">Contorno completo</option>
            <option value="none">Sem abertura</option>
          </select>
        </Row>
        <Row label="Pé-direito livre (m)" htmlFor="p-sopenh">
          <NumField
            id="p-sopenh"
            value={openingHeadroom.value}
            mixed={openingHeadroom.mixed}
            disabled={headroomOff}
            placeholder={type ? fmt(type.minHeadroom) : undefined}
            min={0}
            onCommit={(v) => patch(ids, { openingHeadroom: v })}
            onClear={() => patch(ids, { openingHeadroom: null })}
          />
        </Row>
        <Row label="Folga lateral (m)" htmlFor="p-sopenm"><NumField id="p-sopenm" value={openingMargin.value} mixed={openingMargin.mixed} disabled={noOpening} min={0} onCommit={(v) => patch(ids, { openingMargin: v })} /></Row>
        <Row label="Furo retangular" htmlFor="p-sopenrect"><Check id="p-sopenrect" checked={openingRect.value} mixed={openingRect.mixed} disabled={noOpening} onChange={(v) => patch(ids, { openingRect: v })} /></Row>
      </Group>
      <Group title="Dimensões">
        {single && quantities ? (
          <>
            <Row label="Nº de espelhos"><span className="val">{quantities.riserCount}</span></Row>
            <Row label="Altura do espelho"><span className="val">{fmt(quantities.riserHeight, 3)} m</span></Row>
            <Row label="Piso médio"><span className="val">{fmt(quantities.treadMean, 3)} m</span></Row>
            <Row label="Largura"><span className="val">{fmt(quantities.width)} m</span></Row>
            <Row label="Área em planta"><span className="val">{fmt(quantities.planArea)} m²</span></Row>
            <Row label="Volume"><span className="val">{fmt(quantities.volume, 3)} m³</span></Row>
          </>
        ) : (
          <div className="hint">{single ? 'Escada sem geometria válida: veja os avisos.' : 'Selecione uma escada para ver os quantitativos.'}</div>
        )}
      </Group>
      <Group title={`Avisos (${issues.length})`} open={issues.length > 0}>
        {issues.length === 0 ? (
          <div className="hint">Sem avisos.</div>
        ) : (
          issues.map((i, k) => (
            <div className="prow" key={`${i.code}-${k}`} style={{ alignItems: 'start' }}>
              <span className="lbl" style={{ color: i.severity === 'error' ? 'var(--danger, #b42318)' : undefined }}>{i.message}</span>
              <button className="chiplink" onClick={() => goToIssue(i)}>Ir para</button>
            </div>
          ))
        )}
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-smk"><TextField id="p-smk" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-scm"><TextField id="p-scm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
      {type && <div className="hint">{type.runStyle === 'monolithic' ? 'Estilo monolítico.' : 'Estilo de piso e espelho.'} Espelho máximo {fmt(type.maxRiser * 100, 0)} cm.</div>}
    </>
  );
}
