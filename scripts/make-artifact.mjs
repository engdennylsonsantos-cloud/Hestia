// Converte o build de arquivo único em um fragmento para o Artifact do claude.ai:
// sem doctype/html/head/body (o publicador envolve), com <title> e <meta> no topo.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('apps/web/dist/index.html', 'utf8');
const grab = (re) => [...src.matchAll(re)].map((m) => m[0]);
const styles = grab(/<style[\s\S]*?<\/style>/g);
const links = grab(/<link[^>]*fonts[^>]*>/g);
const scripts = grab(/<script[\s\S]*?<\/script>/g);
const root = '<div id="root"></div>';
const out = [
  '<title>Hestia</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...links,
  ...styles,
  root,
  ...scripts,
].join('\n');
writeFileSync('apps/web/dist/artifact.html', out);
console.log(`artifact.html: ${(out.length / 1024).toFixed(0)} kB`);
