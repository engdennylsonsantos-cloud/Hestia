import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** Corpo da primeira regra simples (sem aninhamento) do seletor. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? '';
}

describe('modal de tipo de escada: layout ocupa a janela', () => {
  it('.stt-main não limita a altura em pixels (a rolagem fica no corpo do diálogo)', () => {
    const main = block('.stt-main');
    expect(main).not.toMatch(/max-height\s*:\s*[^;]*\d+px/);
    expect(main).not.toMatch(/overflow\s*:\s*auto/);
  });

  it('.dialog.wide usa a altura disponível da tela', () => {
    expect(block('.dialog.wide')).toMatch(/height\s*:\s*calc\(100vh\s*-\s*\d+px\)/);
  });
});
