import type { ReactElement } from 'react';
import { isOpening, isWall } from '@hestia/model';
import { editor, useProject, useProjectVersion } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';

export function Tutorial(): ReactElement | null {
  const on = useUi((s) => s.tutorial);
  const seen3d = useUi((s) => s.seen3d);
  const view = useUi((s) => s.view);
  const tool = useUi((s) => s.tool);
  const p = useProject();
  useProjectVersion();
  // Dispensado uma vez, não volta (a lembrança fica no localStorage, lida com try/catch em controller.ts).
  if (!on || editor.tutorialSeen()) return null;
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
  const shown = now === -1 ? steps.length : now + 1;
  return (
    // Com uma ferramenta de desenho ativa, a faixa encolhe para o contador: o texto não cobre o desenho.
    <div className={`tutorial${tool !== 'select' ? ' compact' : ''}`} role="region" aria-label="Primeiros passos">
      <span className="step-count">{now === -1 ? 'Concluído' : `Passo ${shown} de ${steps.length}`}</span>
      <span className="step-text">{now === -1 ? 'Você usou as ferramentas principais. Explore os demais tipos e o 3D.' : steps[now]![0]}</span>
      <span className="dots" aria-hidden="true">
        {steps.map(([, d], i) => (
          <span key={i} className={`pip${d ? ' done' : i === now ? ' now' : ''}`} />
        ))}
      </span>
      <button className="btn small" onClick={close}>{now === -1 ? 'Concluir' : 'Dispensar'}</button>
    </div>
  );
}
