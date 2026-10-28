import { useMemo, type ReactElement } from 'react';
import { resolveStairsOnLevel, stairQuantities, stairValidationIssues } from '@hestia/engine';
import { levelAbove, validateProject, type Id, type Project, type Stair, type StairOpeningMode, type StairSpiralParams, type ValidationIssue } from '@hestia/model';
import { regenSpiralComponents, regenStraightComponents, spiralInfo, spiralOfStair } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { goToIssue } from '../editor/goToIssue.ts';
import { useUi } from '../editor/state.ts';
import { commonOf, patchStairs } from '../editor/stairActions.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { useFormat } from './useUnits.ts';
import { LevelField } from './LevelField.tsx';
import { TypeSelector } from './TypeSelector.tsx';
import { stairOptions } from './typeOptions.ts';


/** Um grau em radianos: os ângulos do caracol são guardados em rad e mostrados em graus. */
const DEG = Math.PI / 180;

/** Avisos e erros de uma escada: os de norma e de croqui (engine) e os de referência do modelo (tipo, nível, topo). */
function issuesOf(p: Project, id: Id): ValidationIssue[] {
  return [...validateProject(p), ...stairValidationIssues(p)].filter((i) => i.elementId === id);
}

/**
 * Propriedades de uma ou mais escadas: tipo, níveis, deslocamentos e abertura da laje (editáveis), quantitativos calculados
 * (só leitura, de uma escada só) e avisos com "Ir para". Cada alteração é uma transação, com um passo de desfazer.
 */
export function StairProperties({ stairs }: { stairs: Stair[] }): ReactElement {
  const fmt = useFormat();
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
  // Caracol: só para uma escada com lance `spiral` (os campos regeneram o croqui; ver `regenSpiralComponents`).
  const spiral = useMemo(() => (single ? spiralOfStair(single) : null), [single]);
  const spiralNums = useMemo(() => (single && spiral ? spiralInfo(p, single, spiral.sp) : null), [p, single, spiral]);

  /** Regenera o caracol com as mudanças de um campo, em UM passo de desfazer. Erro vai para a barra de status. */
  const editSpiral = (changes: Partial<StairSpiralParams>): void => {
    if (!single || !spiral) return;
    const r = regenSpiralComponents(p, single, spiral.part, { ...spiral.sp, ...changes });
    if ('error' in r) {
      useUi.setState({ status: `Caracol: ${r.error}` });
      return;
    }
    patchStairs(editor.store, [single.id], { components: r.components }, 'Editar caracol');
  };

  // Reta gerada pela ferramenta: o nº de espelhos é editável (o piso e a altura do espelho se ajustam).
  const straightRisersEditable = single?.components.length === 1 && single.components[0]?.kind === 'run' && single.components[0].generatedBy === 'straight';

  /** Regenera a reta com outro nº de espelhos, em UM passo de desfazer. Erro vai para a barra de status. */
  const editRisers = (n: number): void => {
    if (!single) return;
    const r = regenStraightComponents(single, n, p.stairTypes[single.typeId]?.minTread ?? 0);
    if ('error' in r) {
      useUi.setState({ status: `Escada: ${r.error}` });
      return;
    }
    patchStairs(editor.store, [single.id], { components: r.components }, 'Editar nº de espelhos');
  };

  const quantities = useMemo(() => {
    if (!single) return null;
    const r = resolveStairsOnLevel(p, single.levelId).find((x) => x.id === single.id);
    return r ? stairQuantities(r) : null;
  }, [p, single]);
  const issues = useMemo(() => (single ? issuesOf(p, single.id) : []), [p, single]);

  const patch = (targets: Id[], value: Partial<Stair>): void => patchStairs(editor.store, targets, value);

  return (
    <>
      <TypeSelector
        triggerId="prop-stairtype"
        label="Tipo de escada"
        categoryLabel={`Escadas (${stairs.length})`}
        options={stairOptions(p)}
        selectedId={typeId.mixed ? null : typeId.value}
        editDisabled={typeId.mixed}
        onSelect={(id) => patch(ids, { typeId: id })}
        onEdit={() => useUi.setState({ dialog: 'stairType', dialogArg: typeId.value })}
      />
      <Group title="Restrições">
        <LevelField ids={ids} label="Nível base" />
        <Row label="Nível de topo" htmlFor="p-stop">
          <select id="p-stop" className="select" value={top.mixed ? '' : top.value} onChange={(e) => patch(ids, { topLevelId: e.target.value || null })}>
            {top.mixed && <option value="">variados</option>}
            <option value="">Automático (nível acima)</option>
            {p.levels.map((l) => <option key={l.id} value={l.id}>Até {l.name}</option>)}
          </select>
        </Row>
        <Row label="Desloc. da base" htmlFor="p-sbase"><NumField id="p-sbase" value={base.value} mixed={base.mixed} onCommit={(v) => patch(ids, { baseOffset: v })} quantity="length" /></Row>
        <Row label="Desloc. do topo" htmlFor="p-stopoff"><NumField id="p-stopoff" value={topOff.value} mixed={topOff.mixed} onCommit={(v) => patch(ids, { topOffset: v })} quantity="length" /></Row>
        {!top.mixed && top.value === '' && noLevelAbove && (
          <Row label="Altura" htmlFor="p-sheight"><NumField id="p-sheight" value={height.value} mixed={height.mixed} min={0.1} onCommit={(v) => patch(ids, { height: Math.max(0.1, v) })} quantity="length" /></Row>
        )}
        <Row label="Abertura da laje" htmlFor="p-sopenmode">
          <select id="p-sopenmode" className="select" value={openingMode.mixed ? '' : openingMode.value} onChange={(e) => e.target.value && patch(ids, { openingMode: e.target.value as StairOpeningMode })}>
            {openingMode.mixed && <option value="">variados</option>}
            <option value="headroom">Pé-direito livre</option>
            <option value="full">Contorno completo</option>
            <option value="none">Sem abertura</option>
          </select>
        </Row>
        <Row label="Pé-direito livre" htmlFor="p-sopenh">
          <NumField
            id="p-sopenh"
            value={openingHeadroom.value}
            mixed={openingHeadroom.mixed}
            disabled={headroomOff}
            quantity="length"
            placeholder={type ? fmt('length', type.minHeadroom, { withUnit: false }) : undefined}
            min={0}
            onCommit={(v) => patch(ids, { openingHeadroom: v })}
            onClear={() => patch(ids, { openingHeadroom: null })}
          />
        </Row>
        <Row label="Folga lateral" htmlFor="p-sopenm"><NumField id="p-sopenm" value={openingMargin.value} mixed={openingMargin.mixed} disabled={noOpening} min={0} quantity="length" onCommit={(v) => patch(ids, { openingMargin: v })} /></Row>
        <Row label="Furo retangular" htmlFor="p-sopenrect"><Check id="p-sopenrect" checked={openingRect.value} mixed={openingRect.mixed} disabled={noOpening} onChange={(v) => patch(ids, { openingRect: v })} /></Row>
      </Group>
      {spiral && spiralNums && (
        <Group title="Caracol">
          <Row label="Raio interno" htmlFor="p-spin">
            <NumField id="p-spin" value={spiral.sp.rInner} min={0.05} onCommit={(v) => editSpiral({ rInner: v })} quantity="length" />
          </Row>
          <Row label="Raio externo" htmlFor="p-spout">
            <NumField id="p-spout" value={spiral.sp.rOuter} min={0.05} onCommit={(v) => editSpiral({ rOuter: v })} quantity="length" />
          </Row>
          <Row label="Ângulo inicial" htmlFor="p-spstart">
            <NumField id="p-spstart" value={spiral.sp.startAngle} quantity="angle" onCommit={(v) => editSpiral({ startAngle: v })} />
          </Row>
          <Row label="Varredura" htmlFor="p-spsweep">
            <NumField
              id="p-spsweep"
              value={Math.abs(spiral.sp.sweep)}
              quantity="angle"
              min={30 * DEG}
              max={720 * DEG}
              onCommit={(v) => editSpiral({ sweep: (spiral.sp.sweep < 0 ? -1 : 1) * v })}
            />
          </Row>
          <Row label="Sentido"><span className="val">{spiral.sp.sweep < 0 ? 'horário' : 'anti-horário'}</span></Row>
          {Math.abs(spiral.sp.sweep) > 2 * Math.PI && (
            <>
              {/* units-ok: contagem sem unidade */}
              <Row label="Espelhos por volta"><span className="val">{String(Math.round(spiralNums.perTurn * 10) / 10).replace('.', ',')}</span></Row>
              <Row label="Folga entre voltas"><span className="val">{fmt('length', spiralNums.headroom)}</span></Row>
            </>
          )}
        </Group>
      )}
      <Group title="Dimensões">
        {single && quantities ? (
          <>
            {straightRisersEditable ? (
              <Row label="Nº de espelhos" htmlFor="p-srisers">
                <NumField id="p-srisers" value={quantities.riserCount} decimals={0} min={2} onCommit={(v) => editRisers(Math.round(v))} />
              </Row>
            ) : (
              <Row label="Nº de espelhos"><span className="val">{quantities.riserCount}</span></Row>
            )}
            <Row label="Altura do espelho"><span className="val">{fmt('length', quantities.riserHeight)}</span></Row>
            <Row label="Piso médio"><span className="val">{fmt('length', quantities.treadMean)}</span></Row>
            <Row label="Largura"><span className="val">{fmt('length', quantities.width)}</span></Row>
            <Row label="Área em planta"><span className="val">{fmt('area', quantities.planArea)}</span></Row>
            <Row label="Volume"><span className="val">{fmt('volume', quantities.volume)}</span></Row>
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
      <Group title="Dados de identidade" open={false}>
        <Row label="Marca" htmlFor="p-smk"><TextField id="p-smk" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-scm"><TextField id="p-scm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
      {type && (
        <div className="hint">
          {type.runStyle === 'monolithic' ? 'Estilo monolítico.' : type.runStyle === 'post' ? 'Estilo de poste central, sem espelho.' : 'Estilo de piso e espelho.'} Espelho máximo {fmt('length', type.maxRiser)}.
        </div>
      )}
    </>
  );
}
