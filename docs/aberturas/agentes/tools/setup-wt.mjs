// Cria uma worktree isolada para um agente: branch feat/esq-<nome> a partir de feat/esquadrias-v2, e um node_modules
// cujas entradas são junções para o node_modules do repositório principal, exceto @hestia (que aponta para os pacotes DESTA worktree).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
const [name, base = 'feat/esquadrias-v3'] = process.argv.slice(2);
const MAIN = '<raiz-do-repositorio>';
const WT = `<raiz-do-repositorio>-wt/${name}`;
if (!existsSync(WT)) execFileSync('git', ['worktree', 'add', '-b', `feat/esq-${name}`, WT, base], { cwd: MAIN, stdio: 'inherit' });
const nm = path.join(WT, 'node_modules');
mkdirSync(nm, { recursive: true });
for (const e of readdirSync(path.join(MAIN, 'node_modules'))) {
  if (e === '@hestia') continue;
  const dest = path.join(nm, e);
  if (!existsSync(dest)) symlinkSync(path.join(MAIN, 'node_modules', e), dest, 'junction');
}
const mb = path.join(nm, '@hestia');
mkdirSync(mb, { recursive: true });
for (const p of readdirSync(path.join(WT, 'packages'))) { const d = path.join(mb, p); if (!existsSync(d)) symlinkSync(path.join(WT, 'packages', p), d, 'junction'); }
if (!existsSync(path.join(mb, 'web'))) symlinkSync(path.join(WT, 'apps/web'), path.join(mb, 'web'), 'junction');
const wn = path.join(WT, 'apps/web/node_modules');
if (!existsSync(wn)) symlinkSync(path.join(MAIN, 'apps/web/node_modules'), wn, 'junction');
console.log('ok', WT);
