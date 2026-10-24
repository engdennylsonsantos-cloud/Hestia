import fs from 'fs';

const file = 'apps/web/src/ui/ViewportCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

// Adiciona import do ViewControlBar
if (!content.includes('ViewControlBar')) {
  content = content.replace(
    "import { PlanLabels } from './PlanLabels';",
    "import { PlanLabels } from './PlanLabels';\nimport { ViewControlBar } from './ViewControlBar.tsx';"
  );
}

// Adiciona ViewControlBar dentro do canvas-wrap
if (!content.includes('<ViewControlBar />')) {
  content = content.replace(
    '{ui.view === \'section\' ? <SectionBadge /> : null}',
    '{ui.view === \'section\' ? <SectionBadge /> : null}\n      <ViewControlBar />'
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully added ViewControlBar to ViewportCanvas');
