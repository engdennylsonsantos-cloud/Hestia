# Tarefa E3b: controles novos no diálogo "Editar tipo" (portas e janelas)

Você é um engenheiro TypeScript/React no Hestia (monorepo npm). Trabalhe SOMENTE neste worktree (o diretório atual, ramo esquadrias/E3b). Responda e escreva comentários em português, curtos, no estilo do código vizinho.

## Contexto
O diálogo "Editar tipo" (apps/web/src/ui/dialogs/openingType/) é uma lista de componentes à esquerda (Visão geral, Batente, Folha, Folhas e divisões, Caixilho e vidro, Lado externo, Lado interno, Parede e vão, Planta e corte, Quadro e dados) e um painel à direita. O registro está em `components.ts` (leia o comentário do início: explica como acrescentar um campo ou painel). Cada painel está em `panels/` e é uma lista de linhas `field-row` protegidas por `support.<chave>`, onde `support` vem de `openingOptionSupport(família)` em packages/model/src/openingSupport.ts (fonte única do que vale para cada família). Hoje vários campos do schema (packages/model/src/openingTypes.ts) NÃO têm controle na interface. Você vai acrescentá-los.

## O que fazer (um commit por item)
1. **Planta e corte: `leafPlan`** (Folha em planta): seleção com 3 opções, "Só a aberta" (padrão, valor `'open'`), "Só a fechada" (`'closed'`) e "As duas" (`'both'`). Só aparece para famílias com folha que gira. Veja como os outros selects do painel são feitos e como `openingLeafPlan` lê o padrão em packages/model/src/openingStyle.ts.
2. **Visão geral: `nominalRef`** (Referência do tamanho): seleção "Vão" (`'opening'`, padrão) e "Folha" (`'leaf'`), com uma dica curta: "No Brasil, 80×210 é a folha; o vão na parede é maior". Só se `support.nominalRef` for verdadeiro (se a tabela de suporte ainda marca falso para as portas, NÃO mude o motor: acrescente a chave verdadeira para as famílias de porta com folha numa linha NOVA no fim da tabela, separada das demais, e anote isso no relatório).
3. **Batente: `reveal`** (Recuo do batente, em metros, padrão 0): campo numérico igual aos outros do painel; só aparece quando o modo de profundidade do batente é "Núcleo" ou "Valor fixo" (não em "Parede inteira"). Respeite a unidade e a formatação dos campos numéricos vizinhos.
4. **Lado externo e Lado interno: soleira (`threshold`)**: veja a forma do campo em `openingTypes.ts`. Selecione o tipo de soleira (Nenhuma, Plana, Degrau) e, quando houver, a altura. Só em famílias de porta com `support.threshold`. A soleira vale para a porta inteira: mostre-a no painel do Lado externo e deixe no Lado interno só um aviso curto "A soleira vale para os dois lados (veja Lado externo)".
5. **Folhas e divisões (janela basculante): `tiltAxis`** (Eixo do basculante: central ou excêntrico, conforme o schema) quando `support.tiltAxis`.
6. **Folha / Caixilho e vidro: `leafMaterialId` e `glassKind`**: material da folha (use o mesmo seletor de material que o painel Batente usa para o material do batente) e tipo de vidro (conforme as opções declaradas em `openingTypes.ts`), quando `support.glassKind` / a folha existe.
7. **Testes** (vitest, ao lado do código): em `components.test.ts` ou em arquivo novo ao lado, para cada controle novo: aparece nas famílias certas e some nas erradas (derive a lista da tabela de suporte), e alterar o controle grava o campo no tipo (veja como `OpeningTypeDialog.test.ts` e os testes dos painéis existentes fazem isso).

## Regras
- NÃO edite: packages/engine, packages/render, defaults.ts, openingTypes.ts (o schema já tem os campos; se faltar algum, registre no relatório e não invente), nem os campos de ferragens e folga inferior (`handleHeight`, `handleInset`, `leafUndercut`, `hinges` quantidade): vêm de outro agente e entram depois.
- Cada arquivo não-teste com no máximo 420 linhas (ESLint max-lines). Se um painel passar, divida em arquivo novo em `panels/`.
- Os arquivos do repositório usam CRLF (alguns LF). Edite com trocas pontuais; não reescreva arquivos inteiros nem converta finais de linha.
- Passos pequenos. A cada passo: rode `npx vitest run apps/web/src/ui/dialogs/openingType packages/model/src/openingSupport.test.ts`, `npx tsc -p tsconfig.json --noEmit` e `npx eslint <arquivos que você tocou>`. Faça `git add` SÓ dos seus arquivos (nunca `git add -A`) e `git commit -m "feat(esquadrias): <passo>"` terminando a mensagem com a linha em branco e "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".
- Falhas de teste que JÁ existiam e você deve ignorar: `apps/web/src/ui/dialogs/openingTypeForm.test.ts` ("alizar ... 8 a mais na janela") e `openingType/previewViews.test.ts` ("detalhe alto em scale"). Qualquer outra falha nova é sua.
- Proibido: git push, git reset --hard, git checkout -- <arquivo>, git stash, npm install, apagar teste existente, mexer em package.json ou package-lock.json, editar `packages/render/src/plan/__snapshots__/sketch.test.ts.snap`.
- Se travar 3 vezes no mesmo erro, registre no relatório e passe ao próximo item. Não pergunte nada: decida, registre a decisão no relatório e siga.
- Só diga que algo funciona se um teste que você rodou provou.

## Ao terminar
Escreva `RELATORIO.md` na raiz do worktree (NÃO o commite; é só leitura para mim) com: itens feitos e commits, saída real de tsc/eslint/vitest, decisões, o que ficou de fora e por quê.
