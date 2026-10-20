import { useState, type ReactElement } from 'react';
import {
  defaultExtrusionProfile,
  extrusionFrame,
  insertRoofProfilePoint,
  presetArco,
  presetBorboleta,
  presetDenteSerra,
  presetDuasAguas,
  presetMansarda,
  presetUmaAgua,
  roofProfileError,
  roofProfileSlopeError,
  shiftProfile,
} from '@hestia/engine';
import { isRoof, type Id, type RoofProfilePoint } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { applyRoofPatch } from '../../editor/roofEdgeActions.ts';
import { NumField } from '../fields.tsx';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

const W = 340;
const H = 170;
const PAD_X = 18;
const PAD_TOP = 22;
const PAD_BOT = 26;

/**
 * Seção do telhado por extrusão: t na horizontal (a partir da borda do contorno, em metros), z para cima, beiral na
 * cota 0. Escala única nos dois eixos para a inclinação aparecer como é. As extensões planas além do perfil saem reta.
 */
function SectionChart({ pts, width }: { pts: RoofProfilePoint[]; width: number }): ReactElement {
  const tLo = Math.min(0, ...pts.map((q) => q.t));
  const tHi = Math.max(width, ...pts.map((q) => q.t));
  const zTop = Math.max(0.1, ...pts.map((q) => q.z));
  const zBot = Math.min(0, ...pts.map((q) => q.z));
  const span = Math.max(tHi - tLo, 1e-3);
  const k = Math.min((W - PAD_X * 2) / span, (H - PAD_TOP - PAD_BOT) / Math.max(zTop - zBot, 1e-3));
  const ox = (W - span * k) / 2;
  const base = H - PAD_BOT;
  const x = (t: number): number => ox + (t - tLo) * k;
  const y = (z: number): number => base - (z - zBot) * k;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const outline: RoofProfilePoint[] = first && last ? [{ t: tLo, z: first.z }, ...pts, { t: tHi, z: last.z }] : [];
  const shape = [`${x(tLo).toFixed(1)},${y(0).toFixed(1)}`, ...outline.map((q) => `${x(q.t).toFixed(1)},${y(q.z).toFixed(1)}`), `${x(tHi).toFixed(1)},${y(0).toFixed(1)}`].join(' ');
  const maxZ = Math.max(0, ...pts.map((q) => q.z));
  return (
    <svg className="profile-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Seção do telhado: altura máxima ${fmt(maxZ)} metros`}>
      <line x1={x(0).toFixed(1)} x2={x(0).toFixed(1)} y1={y(zTop).toFixed(1)} y2={y(zBot).toFixed(1)} className="profile-straight" />
      <line x1={x(width).toFixed(1)} x2={x(width).toFixed(1)} y1={y(zTop).toFixed(1)} y2={y(zBot).toFixed(1)} className="profile-straight" />
      <polygon points={shape} className="profile-fill" />
      {pts.map((q, i) => (
        <circle key={i} cx={x(q.t).toFixed(1)} cy={y(q.z).toFixed(1)} r={2.6} className="profile-dot" />
      ))}
      <line x1={(x(tLo) - 8).toFixed(1)} x2={(x(tHi) + 8).toFixed(1)} y1={y(0).toFixed(1)} y2={y(0).toFixed(1)} className="profile-ground" />
      <text x={x(0).toFixed(1)} y={(base + 14).toFixed(1)} className="profile-tick" textAnchor="start">0</text>
      <text x={x(width).toFixed(1)} y={(base + 14).toFixed(1)} className="profile-tick" textAnchor="end">{fmt(width)} m</text>
      <text x={PAD_X} y={12} className="profile-tick">altura máx. {fmt(maxZ)} m</text>
    </svg>
  );
}

/**
 * Perfil de um telhado por extrusão (A9): predefinições (arco, mansarda, dente de serra, borboleta, uma e duas águas),
 * tabela editável de t × z, seção ao vivo e erro em linha. OK grava pelo motor (não aplica se o telhado ficar sem águas).
 * A tabela mostra t a partir da borda do contorno; o perfil guardado usa a mesma origem do referencial da extrusão.
 */
export function RoofProfileDialog({ roofId, onClose }: { roofId: Id; onClose: () => void }): ReactElement | null {
  const p = useProject();
  const roof = p.elements[roofId];
  const [draft, setDraft] = useState<RoofProfilePoint[]>(() => {
    if (!isRoof(roof)) return [];
    return roof.profile.length >= 2 ? roof.profile.map((q) => ({ ...q })) : defaultExtrusionProfile(roof.boundary, roof.dir);
  });
  const [h, setH] = useState(1);
  const [dentes, setDentes] = useState(3);
  if (!isRoof(roof)) return null;
  const frame = extrusionFrame(roof.boundary, roof.dir);
  if (!frame) return null;
  const base = frame.tMin;
  const width = frame.tMax - frame.tMin;
  const rel = draft.map((q) => ({ t: q.t - base, z: q.z }));
  const err = roofProfileError(draft) ?? roofProfileSlopeError(draft);
  const setPts = (next: RoofProfilePoint[]): void => setDraft(next.map((q) => ({ t: q.t, z: q.z })));
  const applyPreset = (pts: RoofProfilePoint[]): void => setDraft(shiftProfile(pts, base));
  const edit = (i: number, change: Partial<RoofProfilePoint>): void => setPts(draft.map((q, k) => (k === i ? { ...q, ...change } : q)));
  const removeAt = (i: number): void => {
    if (draft.length > 2) setPts(draft.filter((_, k) => k !== i));
  };
  const ok = (): void => {
    if (err) return;
    if (applyRoofPatch(editor.store, [roof.id], { profile: draft })) onClose();
  };
  const maxZ = Math.max(0, ...rel.map((q) => q.z));
  return (
    <Dialog
      title="Perfil do telhado"
      sub={`Largura ${fmt(width)} m na transversal`}
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
        <button id="rp-arco" className="btn small" onClick={() => applyPreset(presetArco(width, h))}>Arco</button>
        <button id="rp-mansarda" className="btn small" onClick={() => applyPreset(presetMansarda(width, h * 0.6, width / 5, h))}>Mansarda</button>
        <button id="rp-serra" className="btn small" onClick={() => applyPreset(presetDenteSerra(width, dentes, h))}>Dente de serra</button>
        <button id="rp-borboleta" className="btn small" onClick={() => applyPreset(presetBorboleta(width, h))}>Borboleta</button>
        <button id="rp-agua" className="btn small" onClick={() => applyPreset(presetUmaAgua(width, h))}>Uma água</button>
        <button id="rp-duas" className="btn small" onClick={() => applyPreset(presetDuasAguas(width, h))}>Duas águas</button>
      </div>
      <div className="profile-actions">
        <span className="hint">Altura</span>
        <NumField id="rp-h" value={h} onCommit={(v) => setH(Math.max(0, v))} unit="m" min={0} />
        <span className="hint">Dentes</span>
        <NumField id="rp-dentes" value={dentes} decimals={0} onCommit={(v) => setDentes(Math.max(1, Math.round(v)))} min={1} />
      </div>
      <div className="split">
        <div className="profile-edit">
          <table className="layers profile-table">
            <thead>
              <tr><th>#</th><th>Posição t</th><th>Altura z</th><th /></tr>
            </thead>
            <tbody>
              {rel.map((q, i) => (
                <tr key={i}>
                  <td className="mono">{i + 1}</td>
                  <td><NumField id={`rp-t-${i}`} value={q.t} unit="m" onCommit={(v) => edit(i, { t: v + base })} /></td>
                  <td><NumField id={`rp-z-${i}`} value={q.z} unit="m" onCommit={(v) => edit(i, { z: v })} /></td>
                  <td>
                    <button id={`rp-del-${i}`} className="ibtn" onClick={() => removeAt(i)} disabled={draft.length <= 2} aria-label={`Excluir ponto ${i + 1}`} title={draft.length <= 2 ? 'O perfil precisa de ao menos 2 pontos' : 'Excluir ponto'}>
                      <Icon name="close" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="profile-actions">
            <button id="rp-add" className="btn small" onClick={() => setPts(insertRoofProfilePoint(draft, frame.tMin, frame.tMax))}>+ ponto</button>
          </div>
          {err ? <p className="error profile-error" role="alert">{err}</p> : null}
          <p className="hint profile-hint">t é medido a partir da borda do contorno, na transversal; z é a altura acima do beiral.</p>
        </div>
        <div>
          <SectionChart pts={rel} width={width} />
          <dl className="profile-stats">
            <div><dt>Altura máxima</dt><dd>{fmt(maxZ)} m</dd></div>
            <div><dt>Trechos</dt><dd>{Math.max(0, draft.length - 1)}</dd></div>
            <div><dt>Largura</dt><dd>{fmt(width)} m</dd></div>
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
