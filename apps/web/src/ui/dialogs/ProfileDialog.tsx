import { useState, type ReactElement } from 'react';
import { getWall, profileError, profileMax, profileMean, wallHeight, wallLength, type Id, type ProfilePoint } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { NumField } from '../fields.tsx';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';
import { ProfilePreview } from './ProfilePreview.tsx';
import { insertPoint, presetDegrau, presetEmpena, presetInclinado, profileRangeError, straightProfile } from './profilePresets.ts';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/**
 * Editar perfil superior de uma parede reta (Revit: Editar perfil). `draft` null = topo reto por altura/nível;
 * a tabela mostra então o topo reto, e a primeira edição cria o perfil. Grava só no OK.
 */
export function ProfileDialog({ wallId, onClose }: { wallId: Id; onClose: () => void }): ReactElement | null {
  const p = useProject();
  const wall = getWall(p, wallId);
  const [draft, setDraft] = useState<ProfilePoint[] | null>(wall?.topProfile ? wall.topProfile.map((q) => ({ ...q })) : null);
  if (!wall) return null;
  const L = wallLength(wall);
  const H = wallHeight(p, wall);
  const pts = draft ?? straightProfile(L, H);
  const err = profileError(pts) ?? profileRangeError(pts, L);
  const setPts = (next: ProfilePoint[]): void => setDraft(next.map((q) => ({ t: q.t, h: q.h })));
  const edit = (i: number, patch: Partial<ProfilePoint>): void => setPts(pts.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const removeAt = (i: number): void => {
    if (pts.length > 2) setPts(pts.filter((_, k) => k !== i));
  };
  const ok = (): void => {
    if (err) return;
    editor.store.exec({ type: 'updateElements', ids: [wall.id], patch: { topProfile: draft } }, 'Editar perfil superior');
    onClose();
  };
  return (
    <Dialog
      title="Perfil superior"
      sub={`Comprimento ${fmt(L)} m · altura reta ${fmt(H)} m`}
      size="mid"
      onClose={onClose}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={ok} disabled={!!err} title={err ?? undefined}>OK</button>
        </>
      }
    >
      <div className="profile-presets" role="group" aria-label="Predefinições de perfil">
        <button id="pf-incl" className="btn small" onClick={() => setPts(presetInclinado(L, H, H + 0.5))}>Inclinado</button>
        <button id="pf-empena" className="btn small" onClick={() => setPts(presetEmpena(L, H, H + 1.5))}>Empena (duas águas)</button>
        <button id="pf-degrau" className="btn small" onClick={() => setPts(presetDegrau(L, Math.max(0.1, H - 0.5), H))}>Degrau</button>
        <button id="pf-remover" className="btn small" onClick={() => setDraft(null)} disabled={draft === null}>Remover perfil</button>
      </div>
      <div className="split">
        <div className="profile-edit">
          <table className="layers profile-table">
            <thead>
              <tr><th>#</th><th>Posição t</th><th>Altura h</th><th /></tr>
            </thead>
            <tbody>
              {pts.map((q, i) => (
                <tr key={i}>
                  <td className="mono">{i + 1}</td>
                  <td><NumField id={`pf-t-${i}`} value={q.t} unit="m" onCommit={(v) => edit(i, { t: v })} /></td>
                  <td><NumField id={`pf-h-${i}`} value={q.h} unit="m" onCommit={(v) => edit(i, { h: v })} /></td>
                  <td>
                    <button id={`pf-del-${i}`} className="ibtn" onClick={() => removeAt(i)} disabled={pts.length <= 2} aria-label={`Excluir ponto ${i + 1}`} title={pts.length <= 2 ? 'O perfil precisa de ao menos 2 pontos' : 'Excluir ponto'}>
                      <Icon name="close" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="profile-actions">
            <button id="pf-add" className="btn small" onClick={() => setPts(insertPoint(pts, L))}>+ ponto</button>
          </div>
          {err ? <p className="error profile-error" role="alert">{err}</p> : null}
          {draft === null && <p className="hint profile-hint">Topo reto. Editar a tabela cria o perfil.</p>}
        </div>
        <div>
          <ProfilePreview pts={pts} length={L} height={H} />
          <dl className="profile-stats">
            <div><dt>Altura máxima</dt><dd>{fmt(Math.max(0, profileMax(pts)))} m</dd></div>
            <div><dt>Altura média</dt><dd>{fmt(profileMean(pts, L))} m</dd></div>
            <div><dt>Comprimento</dt><dd>{fmt(L)} m</dd></div>
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
