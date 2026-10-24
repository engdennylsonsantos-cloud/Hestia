import fs from 'fs';

const file = 'apps/web/src/styles.css';
let content = fs.readFileSync(file, 'utf8');

const revitRootLight = `/* Paleta Canônica Autodesk Revit 2024 */
:root {
  --bg: #dcdfe3;
  --chrome: #e6eaed;
  --ribbon: #f0f3f5;
  --panel: #f7f9fa;
  --sheet: #ffffff;
  --line: #ced5db;
  --line-strong: #b2bcc4;
  --fg: #1a202c;
  --fg-soft: #4a5568;
  --fg-faint: #718096;
  --accent: #0078d4;
  --accent-fg: #ffffff;
  --accent-soft: #deecf9;
  --revit-green: #107c41;
  --revit-green-soft: #dff6dd;
  --revit-green-border: #22c55e;
  --select: #0078d4;
  --warn: #c25e00;
  --danger: #d13438;
  --ok: #107c41;
  --shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
  --font-ui: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  --font-mono: 'Cascadia Code', Consolas, 'SF Mono', Menlo, monospace;
  /* Largura da coluna de rótulo da paleta de propriedades: cabe o rótulo mais longo (22 caracteres a 11 px). */
  --prop-label: 122px;
  --r: 3px;
}`;

const revitRootDark = `:root[data-theme='dark'] {
  --bg: #141414;
  --chrome: #1f1f1f;
  --ribbon: #333333;
  --panel: #252525;
  --sheet: #1e1e1e;
  --line: #383838;
  --line-strong: #484848;
  --fg: #f3f4f6;
  --fg-soft: #a1a1aa;
  --fg-faint: #71717a;
  --accent: #60a5fa;
  --accent-fg: #0f172a;
  --accent-soft: #1e3a5f;
  --revit-green: #4ade80;
  --revit-green-soft: #173827;
  --revit-green-border: #22c55e;
  --select: #3b82f6;
  --warn: #fb923c;
  --danger: #f87171;
  --ok: #4ade80;
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
  color-scheme: dark;
}`;

// Substitui bloco inicial :root
content = content.replace(/\/\* Mesa de desenho[\s\S]*?--r: 5px;\r?\n\}/, revitRootLight);

// Substitui bloco dark
content = content.replace(/:root\[data-theme='dark'\]\s*\{[\s\S]*?color-scheme: dark;\r?\n\}/, revitRootDark);

// Também no media prefers-color-scheme
content = content.replace(/:root:not\(\[data-theme='light'\]\)\s*\{[\s\S]*?color-scheme: dark;\r?\n  \}/, `:root:not([data-theme='light']) {
    --bg: #141414;
    --chrome: #1f1f1f;
    --ribbon: #333333;
    --panel: #252525;
    --sheet: #1e1e1e;
    --line: #383838;
    --line-strong: #484848;
    --fg: #f3f4f6;
    --fg-soft: #a1a1aa;
    --fg-faint: #71717a;
    --accent: #60a5fa;
    --accent-fg: #0f172a;
    --accent-soft: #1e3a5f;
    --revit-green: #4ade80;
    --revit-green-soft: #173827;
    --revit-green-border: #22c55e;
    --select: #3b82f6;
    --warn: #fb923c;
    --danger: #f87171;
    --ok: #4ade80;
    --shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
    color-scheme: dark;
  }`);

// Adiciona estilos para o visual Ribbon Revit e aba contextual verde
const extraRevitCss = `
/* ---- Estilo Autodesk Revit para Ribbon e Abas ---- */
.ribbon-tabs {
  background: var(--chrome);
  padding: 0 4px;
  gap: 1px;
}
.rtab {
  border-radius: 3px 3px 0 0;
  padding: 5px 14px;
  font-size: 11.5px;
  font-weight: 500;
  border: 1px solid transparent;
  border-bottom: 0;
  color: var(--fg-soft);
  transition: background 0.1s;
}
.rtab:hover {
  background: color-mix(in srgb, var(--chrome) 85%, var(--fg) 15%);
  color: var(--fg);
}
.rtab.on {
  background: var(--panel);
  border-color: var(--line-strong);
  border-top: 2px solid var(--accent);
  color: var(--fg);
  font-weight: 600;
}
/* Aba Contextual Verde do Revit */
.rtab.contextual {
  background: var(--revit-green-soft);
  border-color: var(--revit-green-border);
  border-top: 2px solid var(--revit-green-border);
  color: var(--revit-green);
  font-weight: 600;
}
.rtab.contextual:hover {
  background: color-mix(in srgb, var(--revit-green-soft) 85%, var(--fg) 15%);
}

/* Grupo e Painéis do Ribbon Revit */
.rgroup {
  padding: 2px 6px;
  background: transparent;
}
.rgroup-title {
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--fg-faint);
  font-weight: 600;
}
.tbtn.primary-tool {
  min-width: 52px;
  padding: 4px 6px 2px;
}
.tbtn.primary-tool svg {
  width: 26px;
  height: 26px;
}
`;

if (!content.includes('/* ---- Estilo Autodesk Revit para Ribbon e Abas ---- */')) {
  content += '\n' + extraRevitCss;
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated styles.css with Revit design system');
