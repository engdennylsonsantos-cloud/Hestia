import { useEffect, useState } from 'react';
import { useUi } from '../editor/state.ts';

/** Escuro se o usuário escolheu escuro, ou se o tema do host/sistema for escuro. */
export function useDark(): boolean {
  const theme = useUi((s) => s.theme);
  const read = (): boolean => {
    if (theme !== 'system') return theme === 'dark';
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    setDark(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = (): void => setDark(read());
    mq.addEventListener('change', on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', on);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return dark;
}
