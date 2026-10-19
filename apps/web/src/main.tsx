import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

// Ganchos de depuração para testes no navegador (?debug=1).
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./editor/controller.ts'), import('./editor/state.ts')]).then(([c, s]) => {
    (window as unknown as { __hestia: unknown }).__hestia = { editor: c.editor, useUi: s.useUi };
  });
}
