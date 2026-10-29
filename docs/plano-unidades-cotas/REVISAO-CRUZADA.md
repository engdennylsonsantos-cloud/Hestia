# Revisão cruzada F3 — unidades, esquadrias e cotas

Escopo: diff `f89a049a..claude/fervent-newton-rfgz3y` (unidades, esquadrias/batente, cotas e merge da GPU). Revisão adversarial: cada achado confirmado foi reproduzido com teste antes da correção, salvo os marcados como abertura. Verificações por commit: `tsc --noEmit`, `eslint` das pastas, `vitest` das pastas, `check-boundaries`, `check-units`. `npm run check` completo: 6610 testes verdes; `openingCatalogo.test.ts` estoura o limite de 5 s sob carga e passa isolado (falha de ambiente, não de código).

| id | arquivo:linha | gravidade | descrição | estado |
|---|---|---|---|---|
| R01 | `packages/tools/src/dims/providers/wall.ts:69` | alta | Cota da parede paralela à esquerda media a partir da face oposta: mostrava 2,00 m onde as faces acabadas distam 1,816 m (o lado direito já estava certo). | corrigido `ccbb305c` |
| R02 | `packages/model/src/dimension.ts:60`, `packages/render/src/plan/notes.ts:64`, `packages/io/src/dxfNotes.ts:58` | média | `dimensionText` tinha `units` opcional e planta/DXF chamavam sem ele: cotas impressas e exportadas ficavam sempre em metros. Parâmetro agora é obrigatório e os dois chamadores passam `unitsOf(p)`. | corrigido `e2c2d9a7` |
| R03 | `apps/web/src/ui/AnnotationProps.tsx:41` | média | Painel da cota mostrava valor em metros fixos, ignorando as unidades do projeto; o seletor "Unidade" não tinha "Projeto" e exibia "Metros" para cotas `unit: 'project'`. | corrigido `ec5fae6c` |
| R04 | `apps/web/src/ui/dialogs/AutoCotaDialog.tsx:38` | média | Diálogo de cotas automáticas ainda usava os apelidos obsoletos `referencia`/`modoAberturas` e valores iniciais fixos, ignorando `dimensionSettingsOf`; não oferecia eixo do núcleo nem vão livre/alizar. | corrigido `e86fbdf7` |
| R05 | `packages/tools/src/dimensionTool.ts:162`, `apps/web/src/ui/OptionsBar.tsx:148` | alta | A ferramenta Cota passou a gravar `unit: 'project'` e omitir `precision`, mas a barra de opções continuou exibindo "Unidade" e "Casas": os dois controles ficaram sem efeito. Voltaram a valer, com "Projeto" como padrão. | corrigido `4c28e1a4` |
| R06 | `apps/web/src/ui/fields.tsx:114` | baixa | Em `ft-in` o valor já traz pés/polegadas e o campo acrescentava um `'` solto como rótulo de unidade. | corrigido `39a345fe` |
| R07 | `apps/web/src/ui/Properties.tsx:258` | baixa | Aviso de peitoril inválido mandava digitar "em metros, como 0,90" mesmo com o projeto em cm/mm/pés. | corrigido `39a345fe` |
| R08 | `packages/engine/src/roofShapes.ts:79`, `packages/engine/src/roofs.ts:90`, `packages/tools/src/roofCheck.ts:116`, `apps/web/src/ui/dialogs/openingType/OpeningTypeDialog.tsx:101` | média | Mensagens de mansarda e de verificações da esquadria (largura/altura/ventilação/batente) eram montadas com `defaultUnits()`, ignorando a unidade do projeto. | corrigido `c0061096` |
| R09 | `apps/web/src/ui/StairProperties.tsx:69`, `packages/tools/src/stairCommands.ts:60`, `packages/tools/src/stairSpiralRun.ts:87`, `packages/tools/src/stairTool.ts:476`, `packages/tools/src/stairRunTool.ts:258` | média | Avisos e recusas da escada (piso mínimo, número de espelhos, caracol e comprimento curto) saíam em metros/cm fixos porque `units` não era propagado até `analyzeDraft`/`planStairRun`/`planSpiralRun`. | corrigido `ec178b1b`, `2b3c69ef` |
| R10 | `packages/model/src/validate.ts:55`, `packages/tools/src/gridTool.ts:133` | baixa | Textos ainda fixavam "o mínimo é 1 mm" e "pelo menos 5 cm" mesmo com o projeto em outra unidade. Passaram por `formatQuantity`. | corrigido `4ae611f9` |
| R11 | `packages/render/src/model3d/indiceDeElementos3d.ts`, `packages/render/src/gpu/controlador.ts` | baixa | Arquivos novos com funções puras sem teste (índice de faixas/caixas e plano de recuperação/mensagem da GPU). | corrigido `ece98ff9`, `5bc51b17` |
| A01 | `packages/render/src/model3d/scene3d.ts:1` | média | 438 linhas efetivas (> 420) sustentadas por `eslint-disable max-lines`. A regra do plano pede divisão; a extração é uma refatoração do port GPU, não uma correção pontual. | aberto |
| A02 | `packages/render/src/gpu/contexto.ts:272`, `packages/render/src/gpu/controlador.ts:135` | baixa | `wrap`, `tryWebGpu` e o ciclo `criarControladorGpu` não têm teste unitário (exigem GPU real); ficam cobertos só pelos e2e/baselines. | aberto |
| A03 | `packages/tools/src/dims/providers/outline.ts:29` | baixa | Cotas de piso/laje/telhado/forro são só de leitura. O D10 permite isso enquanto `outlineEdit.ts` não tiver operação pura por lado; hoje ele só grava o contorno inteiro. | aberto |
| A04 | `packages/tools/src/dims/providers/displacement.ts:19` | baixa | O D10.5 pede distância **e ângulo** no mover/copiar; o provedor exibe só a distância. | aberto |
| A05 | `packages/model/src/grid.ts:154` | baixa | `gridIssue` (modelo) fixa "5 cm" sem receber unidades; o ramo da ferramenta já foi corrigido, o do modelo não tem `Project` à mão. | aberto |

## Decisões para o dono

- **scene3d.ts**: dividir a cena 3D (faixas/sombras/plano) para cumprir 420 linhas, ou aceitar a exceção documentada.
- **Cotas de piso/laje/telhado**: implementar edição por lado (exige operação pura em `outlineEdit.ts`) ou manter leitura.
- **Mover/copiar**: mostrar também o ângulo do deslocamento ou manter só a distância.
- **Prévia de colocação**: manter o "I" disponível durante a colocação e as cotas da prévia sem tom de inválido (hoje o símbolo/polígono fica vermelho, mas as cotas não).
- **Mensagens fixas restantes** (`gridIssue` "5 cm", caracol "30°"): migrar para as unidades do projeto ou tratar como limites técnicos universais.

## Observações de aceite

- `SCHEMA_VERSION` permaneceu 20; `package.json` só ganhou `check-units` na linha do `lint`.
- Sem `any`, `@ts-ignore` ou `console.log` novos em `packages`/`apps`; `check-units --report` = 0 ocorrências.
- `dimensionText` agora exige `units`; todos os chamadores de produção passam `unitsOf(p)`.
- O merge da GPU preserva CPU/GPU e os testes de `lotesGpu`/`faixas`/`sombras`/`picking` rodam verdes.

REVISAO CONCLUIDA 4ae611f9
