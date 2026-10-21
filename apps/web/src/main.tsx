import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

// Ganchos de depuração para testes no navegador (?debug=1). `resolveSlabs` deixa o e2e medir o furo da escada na laje.
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./editor/controller.ts'), import('./editor/state.ts'), import('@hestia/engine')]).then(([c, s, e]) => {
    (window as unknown as { __hestia: unknown }).__hestia = { editor: c.editor, useUi: s.useUi, resolveSlabs: e.resolveSlabs };
  });
}
