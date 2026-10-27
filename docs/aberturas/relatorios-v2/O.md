# Relatório · Tarefa O — colocação de portas e janelas (estilo Revit)

## O que foi feito

- **Prévia com o símbolo real**: a ferramenta agora monta uma `Opening` temporária e usa `openingGeometry` +
  `openingSymbolPaths` para desenhar o símbolo da esquadria como itens `line` (tracejado quando o traço do símbolo
  pede), mantém o retângulo do vão e acrescenta as duas cotas temporárias.
- **Sentido pelo cursor**: `openingFacingMode` (`cursor` padrão / `fixed`) e `openingToward` (`cursor` padrão / `away`).
  O sinal de `s` do cursor em relação ao eixo da parede decide o lado, com histerese de `3 × metersPerPixel` (mantém o
  último lado dentro da faixa). Com `fixed`, vale `openingFlipFacing`. Tab continua invertendo o sentido e Espaço a
  dobradiça, por cima do resultado.
- **Zona de captura da parede**: `hostUnder` ganhou um parâmetro opcional de tolerância em pixels (padrão 10, mantendo
  os demais usos); a ferramenta de abertura passa 16 px. Com a captura desligada (F3) continua valendo só a espessura.
- **Âncora**: `openingAnchor` (`center` padrão, `hinge`, `latch`) converte a posição do cursor para o centro da abertura
  usando a largura do tipo e `flipHand`.
- **Capturas novas** (respeitando `snap.enabled`): centro do trecho livre entre paredes perpendiculares (nota “centro do
  trecho”), folga da quina `openingClear` (padrão 0,10 m; nota “a 10 cm da parede”) e eixo alinhado com outra abertura.
  O trecho livre é calculado pelas faces das perpendiculares; uma abertura que invadisse a faixa de uma perpendicular é
  recusada.
- **Cotas temporárias**: duas cotas na prévia, do eixo da abertura ao eixo das perpendiculares (`openingDimMode: 'axis'`,
  padrão) ou da borda à face (`'face'`), desenhadas no lado do cursor, com valor em metros e vírgula.
- **Interface**: `PlacementProperties` ganhou Sentido, Abrir, Âncora, Folga da quina (cm) e Cotas; os padrões novos estão
  em `DEFAULT_OPTIONS`. A dica de teclado da ferramenta foi atualizada.
- **Prévia inválida**: sem espaço (sobre outra abertura ou sobre parede perpendicular) o símbolo, o retângulo e as cotas
  saem no tom `invalid` (vermelho) e o clique não insere. A posição digitada continua sendo o centro exato (sem captura)
  e passa pelas mesmas validações.

## Arquivos tocados

- `packages/tools/src/openingTool.ts`
- `packages/tools/src/openingPlacement.ts` (novo)
- `packages/tools/src/openingTool.test.ts` (novo)
- `packages/tools/src/types.ts` (campos novos de `ToolOptions` e `PreviewTone` com `'invalid'`)
- `packages/tools/src/infer.ts` (tolerância de `hostUnder` parametrizada; padrão inalterado)
- `packages/render/src/plan/overlay.ts` (cor do tom `invalid`)
- `apps/web/src/ui/PlacementProperties.tsx`
- `apps/web/src/editor/state.ts` (só os padrões das opções novas)
- `RELATORIO.md`

## Testes

Comandos rodados (todos verdes):

- `npx vitest run packages/tools/src/openingTool.test.ts packages/tools/src/openingSnap.test.ts`
- `npx vitest run packages/tools/src/enclosed.test.ts packages/tools/src/clipboard.test.ts packages/tools/src/arrayRadial.test.ts packages/tools/src/tools.test.ts`
- `npx vitest run packages/render/src/plan/overlay.test.ts packages/tools/src/snapFaces.test.ts packages/tools/src/rectWall.test.ts`
- `npx tsc -p tsconfig.json --noEmit`
- `node scripts/check-boundaries.mjs`

`openingTool.test.ts` cobre: lado acima/abaixo, `away`, `fixed`, histerese de 1 px/4 px, Tab e Espaço, âncoras
`hinge`/`latch`, centro do trecho livre, folga da quina, símbolo real + 2 cotas de eixo, cotas de face, prévia inválida
sem inserção, posição digitada exata/validada e a zona de 16 px da parede.

## Decisões e divergências

- A captura “centro do trecho” usa o centro do intervalo entre as **faces** das perpendiculares (e as pontas da parede).
  No teste da parede de 5 m há perpendiculares em 2 m e no fim (5 m); com as meias espessuras descontadas nos dois lados o
  centro do trecho de 3 m dá 3,5 m, como no critério.
- As cotas temporárias mostram só o número (`2,26`), sem “m”, seguindo o exemplo do enunciado.
- A posição digitada permanece o **centro** da abertura (comportamento anterior), e não a âncora do cursor.
- `OptionsBar.tsx` não precisou mudar: para porta/janela a barra já remete às configurações em Propriedades, onde as
  opções novas foram colocadas.

## Pendências honestas

- Não rodei os testes lentos de propriedade/desempenho (`property.test.ts`, `*perf.test.ts`), conforme a instrução comum.
- Não há teste de interface (React) para os campos novos da paleta; a lógica testada está em `openingTool.test.ts`.
- A histerese guarda o último lado entre movimentos do cursor; ao iniciar a ferramenta o lado inicial é `+n`.
