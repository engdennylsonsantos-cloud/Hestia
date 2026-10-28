import { useEffect, useState, type ReactElement } from 'react';
import { GRAPHICS_CATEGORIES, graphicsOf, levelGraphicsOf, sectionGraphicsOf, view3dOf, type CategoryOverride, type GraphicsCategory } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { editLevelGraphics, editSectionGraphics, editView3D, type GraphicsEdit } from '../../editor/graphicsActions.ts';
import { useUi } from '../../editor/state.ts';
import { CATEGORY_LABEL, WEIGHTS } from '../graphicsLabels.ts';
import { Check, NumField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

type Override = Partial<CategoryOverride>;
const one = (c: GraphicsCategory, o: Override): { overrides: Partial<Record<GraphicsCategory, Override>> } => ({ overrides: { [c]: o } });

/** Cor de uma categoria: vazia = do projeto. Grava ao sair do seletor (cada movimento seria um passo de desfazer). */
function ColorCell({ id, label, value, onCommit }: { id: string; label: string; value: string | undefined; onCommit: (v: string | undefined) => void }): ReactElement {
  const [draft, setDraft] = useState(value ?? '#808080');
  useEffect(() => setDraft(value ?? '#808080'), [value]);
  if (value === undefined) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="val soft">do projeto</span>
        <button className="chiplink" aria-label={`Definir cor de ${label}`} onClick={() => onCommit(draft)}>Definir</button>
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input id={id} type="color" value={draft} aria-label={`Cor de ${label}`} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onCommit(draft)} />
      <button className="chiplink" onClick={() => onCommit(undefined)}>Do projeto</button>
    </span>
  );
}

/**
 * Visibilidade e gráficos por categoria da vista ativa (decisão 0015 §3): `target` é o id do nível (planta), '3d' ou
 * 'section' (corte/elevação).
 * Cada linha grava o próprio comando (um passo de desfazer por alteração); recusa aparece na linha, nada é gravado.
 * Vazio em peso e cor = o valor do projeto (sem substituição na vista).
 */
export function GraphicsVisibilityDialog({ target }: { target: string }): ReactElement | null {
  const p = useProject();
  const is3d = target === '3d';
  const isSection = target === 'section';
  const lvl = is3d || isSection ? undefined : p.levels.find((l) => l.id === target);
  const [errors, setErrors] = useState<Partial<Record<GraphicsCategory, string>>>({});
  if (!is3d && !isSection && !lvl) return null;
  const g = is3d ? view3dOf(p) : isSection ? sectionGraphicsOf(p) : levelGraphicsOf(p, target);
  const pg = graphicsOf(p);
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const run = (c: GraphicsCategory, o: Override): void => {
    const r: GraphicsEdit = is3d ? editView3D(editor.store, one(c, o)) : isSection ? editSectionGraphics(editor.store, one(c, o)) : editLevelGraphics(editor.store, target, one(c, o));
    setErrors((prev) => ({ ...prev, [c]: r.error ?? undefined }));
  };
  const failed = GRAPHICS_CATEGORIES.filter((c) => errors[c]);
  return (
    <Dialog
      title="Visibilidade e gráficos"
      sub={is3d ? 'Modelo 3D' : isSection ? 'Corte/elevação' : `Planta · ${lvl!.name}`}
      onClose={close}
      size="mid"
      footer={<button className="btn primary" onClick={close}>Fechar</button>}
    >
      <table className="layers" aria-label="Visibilidade e gráficos por categoria">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Visível</th>
            <th>Transparência</th>
            <th>Meio-tom</th>
            <th>Peso de corte</th>
            <th>Peso de projeção</th>
            <th>Cor</th>
          </tr>
        </thead>
        <tbody>
          {GRAPHICS_CATEGORIES.map((c) => {
            const o = g.overrides[c];
            const id = `gv-${c}`;
            const weightOptions = (key: 'cutWeight' | 'projectionWeight'): ReactElement => (
              <select
                id={`${id}-${key === 'cutWeight' ? 'cut' : 'proj'}`}
                className="select"
                aria-label={`${key === 'cutWeight' ? 'Peso de corte' : 'Peso de projeção'} de ${CATEGORY_LABEL[c]}`}
                value={o[key] ?? ''}
                onChange={(e) => run(c, { [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
              >
                <option value="">Do projeto ({pg.categories[c][key]})</option>
                {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            );
            return (
              <tr key={c}>
                <td>{CATEGORY_LABEL[c]}</td>
                <td><Check id={`${id}-vis`} checked={o.visible} onChange={(v) => run(c, { visible: v })} /></td>
                <td>
                  {/* units-ok: porcentagem de transparência */}
                  <NumField id={`${id}-tr`} value={o.transparency} scale={100} decimals={0} unit="%" min={0} max={1} width={64} onCommit={(v) => run(c, { transparency: v })} />
                </td>
                <td><Check id={`${id}-half`} checked={o.halftone} onChange={(v) => run(c, { halftone: v })} /></td>
                <td>{weightOptions('cutWeight')}</td>
                <td>{weightOptions('projectionWeight')}</td>
                <td><ColorCell id={`${id}-color`} label={CATEGORY_LABEL[c]} value={o.color} onCommit={(v) => run(c, { color: v })} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {failed.length > 0 && (
        <div className="vr-error" role="alert">
          {failed.map((c) => <div key={c}>{CATEGORY_LABEL[c]}: {errors[c]}</div>)}
        </div>
      )}
      <p className="hint">Transparência: 0% opaco, 100% invisível. Meio-tom clareia a categoria. Vazio (Do projeto) usa o peso e a cor do projeto.</p>
    </Dialog>
  );
}
