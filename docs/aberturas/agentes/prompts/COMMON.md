# Instruções comuns (leia inteiro antes de começar)

Você é um engenheiro TypeScript trabalhando no Hestia (monorepo npm: packages/geom, model, engine, tools, render, io e apps/web). Trabalhe SOMENTE dentro da sua worktree (o diretório atual). Responda e comente em português do Brasil, no estilo do código vizinho.

## Leitura obrigatória
1. `docs/aberturas/E-spec-modelo-unico.md` (especificação; as regras dele mandam).
2. `docs/decisoes/0034-esquadrias-v2.md` e `docs/decisoes/0017-portas-e-janelas.md`.
3. `packages/engine/src/openingModelTypes.ts` (contrato do modelo único).
4. Os arquivos citados na sua tarefa.

## Como trabalhar
- Não pergunte nada: decida, registre a decisão no `RELATORIO.md` e siga.
- Trabalhe em passos pequenos. Ao fim de cada passo: rode os testes do passo, faça `git add` SÓ dos seus arquivos e `git commit -m "feat(esquadrias): <passo>"`.
- Escreva os testes (vitest, `*.test.ts` ao lado do código). Cada critério de aceitação vira teste que falha sem a sua mudança.
- Comandos (Git Bash, a partir da raiz da worktree): `npx vitest run <arquivos>`; `npx tsc -p tsconfig.json --noEmit`; `node scripts/check-boundaries.mjs`. Os testes de propriedade lentos (`property.test.ts`, `*perf.test.ts`) NÃO rode.
- Os arquivos do repositório usam CRLF. Edite com as ferramentas de edição (trocas pontuais); não reescreva arquivos inteiros que já existem nem converta finais de linha.
- Se travar 3 vezes no mesmo erro, registre no RELATORIO.md e passe ao próximo passo; não fique em laço.
- Proibido: `git push`, `git reset --hard`, `git checkout -- <arquivo>`, `git stash`, `npm install`, apagar teste existente, editar `packages/model/src/types.ts` ou `openingModelTypes.ts` (a menos que sua tarefa diga), tocar arquivos fora da sua lista, deixar `console.log` ou código morto.
- Teste existente que contradiz a spec: atualize, e liste cada um no RELATORIO.md com o motivo.
- Ao terminar: `npx tsc -p tsconfig.json --noEmit` e `node scripts/check-boundaries.mjs` limpos, seus testes verdes, tudo commitado, e `RELATORIO.md` na raiz (não commitado em pacote nenhum; só o arquivo) com: o que foi feito, arquivos tocados, testes, divergências da spec, pendências honestas.
- Só diga que algo funciona se um teste que você rodou provou.
