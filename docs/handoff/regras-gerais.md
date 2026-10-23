REGRAS (valem para toda a tarefa):
- Repositório Hestia: monorepo TypeScript (npm workspaces), vitest, eslint (max 420 linhas por arquivo), tsc. Escreva código, comentários e mensagens de UI em português, no estilo dos arquivos vizinhos. Leia CLAUDE.md/README e os docs citados antes de codar.
- Trabalhe SOMENTE neste diretório (é uma git worktree). NUNCA escreva, leia para alterar ou rode comandos em /home/user/Hestia nem em outros diretórios. Não use git push/checkout/reset de outras branches. Não instale dependências.
- Mexa só nos arquivos da sua área. Se precisar exportar algo novo, acrescente a linha em `index.ts` do pacote. Não edite `docs/paridade/ORDEM.json`, `docs/07-STATUS-V1.md` nem `package.json`.
- Mudança de esquema do modelo (types.ts): não incremente `SCHEMA_VERSION`; campos novos devem ser OPCIONAIS, com valor padrão por leitura (como `graphics.ts` faz), sem migração.
- Toda função nova tem teste (vitest, arquivo `.test.ts` ao lado). Nada de console.log nem arquivos de depuração.
- Antes de terminar rode e deixe verde: `npx tsc -p tsconfig.json --noEmit`, `npx eslint <pacotes que tocou>`, `npx vitest run <pacotes que tocou>`. Rode também `node scripts/check-boundaries.mjs`.
- Ao final faça `git add -A && git commit -m "<mensagem>"` (uma ou mais commits) e responda em português: o que mudou, arquivos principais, resultado dos comandos e o que ficou de fora.
- CHECKPOINTS: faça um commit `wip: <o que ficou pronto>` a cada marco que passar em tsc+testes do pacote (o contêiner pode reiniciar a qualquer momento e matar o processo; o que não está em commit corre risco). O commit final tem mensagem `feat(...)`.
