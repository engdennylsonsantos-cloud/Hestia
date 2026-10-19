import type { ReactElement } from 'react';
import { isOpening, isWall } from '@hestia/model';
import { editor, useProject, useProjectVersion } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';

export function Tutorial(): ReactElement | null {
  const on = useUi((s) => s.tutorial);
  const seen3d = useUi((s) => s.seen3d);
  const view = useUi((s) => s.view);
  const p = useProject();
  useProjectVersion();
  if (!on) return null;
  const els = Object.values(p.elements);
  const walls = els.filter(isWall);
  const steps: Array<[string, boolean]> = [
    ['Desenhe um circuito de paredes (W) — clique nos pontos e feche no primeiro', walls.length >= 4],
    ['Insira uma porta (D) e uma janela (J) sobre as paredes', els.filter(isOpening).length >= 2],
    ['Selecione uma parede e troque o tipo nas Propriedades', walls.some((w) => w.typeId !== p.defaults.wallTypeId)],
    ['Abra o Modelo 3D no navegador de projeto', seen3d || view === '3d'],
    ['Salve o projeto (Ctrl+S)', !editor.store.dirty && els.length > 0],
  ];
  const now = steps.findIndex(([, d]) => !d);
  const close = (): void => {
    editor.markTutorialSeen();
    useUi.setState({ tutorial: false });
  };
  return (
    <div className="tutorial" role="region" aria-label="Primeiros passos">
      <h3>{now === -1 ? 'Tudo certo!' : 'Primeiros passos'}</h3>
      <ol>
        {steps.map(([t, d], i) => (
          <li key={i} className={d ? 'done' : i === now ? 'now' : ''}>
            <span className="dot" />
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <div><button className="btn small" onClick={close}>{now === -1 ? 'Concluir' : 'Dispensar'}</button></div>
    </div>
  );
}
