import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

// Ganchos de depuração para testes no navegador (?debug=1). `resolveSlabs` e `resolveFloors` deixam o e2e medir o furo da
// escada na laje e a área de cada camada de piso (decisão 0025); `junctionLevel` e `cutLevelByJunction` deixam o e2e
// conferir o recorte da parede pela junção (0023 §10, P7c parte 2).
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./editor/controller.ts'), import('./editor/state.ts'), import('@hestia/engine')]).then(([c, s, e]) => {
    (window as unknown as { __hestia: unknown }).__hestia = {
      editor: c.editor,
      useUi: s.useUi,
      resolveSlabs: e.resolveSlabs,
      resolveFloors: e.resolveFloors,
      resolveLevel: e.resolveLevel,
      junctionLevel: e.junctionLevel,
      cutLevelByJunction: e.cutLevelByJunction,
      quantifyLevel: e.quantifyLevel,
    };
  });
}
