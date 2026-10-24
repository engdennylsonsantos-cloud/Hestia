import fs from 'fs';

const file = 'apps/web/src/styles.css';
let content = fs.readFileSync(file, 'utf8');

const vcbCss = `
/* ---- Barra de Controle de Vista (View Control Bar do Revit) ---- */
.view-control-bar {
  position: absolute;
  bottom: 8px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  backdrop-filter: blur(4px);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  padding: 3px 8px;
  box-shadow: var(--shadow);
  font-size: 11px;
}
.vc-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.vc-label {
  font-size: 10.5px;
  color: var(--fg-soft);
  font-weight: 500;
}
.vc-select {
  height: 22px;
  padding: 0 4px;
  background: var(--sheet);
  border: 1px solid var(--line);
  border-radius: 2px;
  font-size: 11px;
  color: var(--fg);
}
.vc-sep {
  width: 1px;
  height: 16px;
  background: var(--line);
  margin: 0 2px;
}
.vc-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--fg-soft);
  font-size: 11px;
  font-weight: 600;
}
.vc-btn:hover:not(:disabled) {
  background: var(--chrome);
  border-color: var(--line);
  color: var(--fg);
}
.vc-btn.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.vc-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
`;

if (!content.includes('/* ---- Barra de Controle de Vista (View Control Bar do Revit) ---- */')) {
  content += '\n' + vcbCss;
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully added ViewControlBar styles');
