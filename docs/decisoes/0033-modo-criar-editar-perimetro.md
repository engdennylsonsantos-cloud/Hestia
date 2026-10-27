# 0033 · Modo "Criar/Editar perímetro"

Data: 2026-10-26. Status: **DECIDIDA e implementada.** Código: `apps/web/src/editor/perimeterMode.ts` (sessão, botões),
`packages/tools/src/perimeterTool.ts` (desenho e triângulo), `perimeterCommit*.ts` (gravação), `packages/geom/src/sketchValidate.ts`
(validação).

## 1. Entrada única

Telhado, Piso, Laje e Forro abrem o modo para o próprio alvo (`setTool` chama `begin`). "Editar perímetro", no painel do
elemento, reabre o contorno de um elemento existente. As ferramentas antigas de contorno (contorno por cliques, retângulo,
paredes, ambiente, perímetro externo e furo) não são alcançadas pela faixa: o modo é o único caminho de criação.

## 2. Sessão única e só botões

- Uma sessão por vez. Com o modo aberto, trocar de ferramenta, de vista ou de nível, e começar ou editar outro perímetro, é
  recusado com aviso, e o modo fica.
- Concluir e Cancelar só pelos botões da barra. Enter não conclui (o aviso manda usar o botão). Esc cancela o passo em
  andamento e, sem passo, tira a forma escolhida. Delete não exclui a seleção enquanto o modo está aberto.
- Concluir grava num só passo de desfazer ("Criar perímetro" ou "Editar perímetro") e seleciona o elemento.

## 3. Furos são laços internos do esboço

Não há modo de furo. Um laço dentro do externo vira furo do elemento (`role: 'hole'` em `SketchLoop`). Contorno e furos se
desenham com as mesmas linhas, e o externo é o maior laço.

## 4. Regras de validação

Concluir só habilita com o resultado `ok`: ao menos um laço externo e nenhum problema. Problemas que impedem a gravação:
laço aberto, menos de três lados, lado de comprimento zero, linha que cruza outra do mesmo laço, linhas sobrepostas, laços
que se cruzam ou se tocam, furo fora do externo, laço dentro de furo, dois externos disjuntos e esboço vazio.

Na gravação há outras duas recusas: balanço negativo ou inválido, e inclinação fora da faixa. No telhado, o motor precisa
gerar águas para o contorno (`roofProblem`). Em qualquer recusa nada é criado: o modo fica aberto e o motivo vai para a barra.

## 5. Triângulo só no telhado

Cada aresta do laço externo do telhado tem um triângulo de inclinação: o clique o liga ou desliga ("define inclinação").
Piso, laje e forro não têm triângulo. Balanço e inclinação por aresta, no telhado, se editam pelo grupo de propriedades do
perímetro, com a aresta selecionada.

## 6. O que saiu

- A escolha de aresta por clique no telhado pronto, a tecla I sobre a aresta, o painel "Aresta N" e a tabela de arestas
  em Propriedades. A edição de aresta do telhado passa pelo modo.
- Os modos "Furo" de piso, laje, forro e telhado, com a opção de cada barra e o item da faixa.

## 7. Pendências

- **Contorno vinculado às paredes: resolvido no modo, com uma diferença de origem.** Piso e laje vinculam por "Por
  perímetro" (caixa sobre as paredes) + "Vincular às paredes"; a gravação usa a origem `perimeter` (face externa,
  `linked: true`, semente no lado maior do contorno), não `walls-finish`. A origem `walls-finish` (face de acabamento a
  partir do clique numa área fechada) só existe na ferramenta antiga de piso por paredes, fora da faixa; decidir se ela
  volta ao modo como um "Por ambiente" de piso/laje ou se fica só o perímetro externo. Desvincular e Revincular às
  paredes estão no grupo "Contorno" de piso e laje; piso/laje vinculado continua travado para edição até Desvincular
  (decisão 0031).
- **Forro "No ambiente": resolvido.** A galeria do forro tem "Por ambiente"; com "Acompanhar o ambiente" o forro nasce
  com `roomId` e `roomLinked: true` e o contorno do ambiente (decisão 0021). Desvincular e Revincular ao ambiente estão
  no grupo "Contorno" do forro.
- **Modos de criação antigos** (poly, rect, walls, room, paredes, perímetro): continuam no código, com testes, porque o
  pacote ainda os testa, mas não são alcançáveis pela faixa. O plano de remoção está em
  `docs/pendencias-perimetro.md` §4.
- **Roteiros e2e do vínculo**: `tests/e2e/contorno.mjs` e `tests/e2e/forro-ambiente.mjs` ainda gravam a origem pela API,
  com o comentário defasado de que o modo não a gravaria. Migrar para "Por perímetro"/"Por ambiente" ao revisar os
  roteiros.
