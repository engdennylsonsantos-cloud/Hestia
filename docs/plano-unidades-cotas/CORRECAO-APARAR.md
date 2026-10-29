# Aparar, alças e cotas: abertura hospedada que sai da parede

## Regra do dono
Quando uma operação **encurta** o comprimento de uma parede e uma porta/janela hospedada nela **não cabe mais** entre as
pontas, a operação avisa antes de aplicar. A extensão usada é a **real da esquadria** (`openingExtents(…).frame`), não só
o centro: uma abertura **parcialmente fora** também conta. Aviso e exclusão valem para **qualquer caminho** que mexa nas
pontas, não só a ferramenta Aparar. Translação da parede inteira (comprimento mantido) e giro **levam a abertura junto**:
não avisam.

## Mecanismo único
- `packages/tools/src/hostedLoss.ts` (puro, sem DOM/React): `endsFromCommands` lê `setWallEnds`, `updateElements` com
  `a`/`b`/`sag` e lotes `batch`; `hostedLoss` devolve as aberturas que sairiam (só quando a parede encurta; arco medido
  pelo comprimento do arco); `hostedLossOfCommands` e `hostedLossMessage` fecham o texto do diálogo.
- `packages/tools/src/hostedGuard.ts`: `execWithHostedLoss(env, rótulo, comandos)` aplica a regra uma vez para todos os
  caminhos. Sem abertura afetada, comportamento antigo. Com abertura afetada, chama `env.confirmHostedLoss`; confirmar
  aplica os comandos **e** o `deleteElements` das aberturas **num único passo de desfazer** (Ctrl+Z devolve parede e
  aberturas); cancelar não emite comando nenhum.
- `ToolEnv.confirmHostedLoss` é o gancho único: nos testes é síncrono; na interface abre o diálogo `HostedLossDialog`
  (mesmo estilo dos diálogos simples), com “Cancelar” e “Excluir elementos e continuar”. O controlador expõe
  `editor.applyCommands` para o sistema de cotas usar exatamente a mesma guarda.

## Caminhos cobertos
| Caminho | Onde |
|---|---|
| Aparar/Estender: canto, um elemento e vários (também arestas de anel, que não têm abertura) | `trimTool.ts` → `execWithHostedLoss` |
| Arrastar a alça da ponta da parede (e vizinhas que acompanham) | `selectGrips.ts` |
| Cota de comprimento digitada no campo “Comprimento” | `selectTool.ts` → `lengthEdit.ts` |
| Cotas temporárias axiais/laterais que deslocam pontas e esticam vizinhas | `dims/providers/wall.ts` → `TempDimsOverlay` → `editor.applyCommands` |
| Mover/Copiar/Rotacionar/Espelhar que mudam o comprimento de vizinhas via `wallFollow`/`transformSession` | `edit.ts` → `transformWalls` |
| Junção em T transformada em canto | `joinTool.ts` |
| Alinhar ponta de parede | `alignApply.ts` |

Copiar não encurta (a cópia mantém o comprimento). Dividir parede (`splitWall`) já tem regra própria no modelo: apaga a
abertura que não couber e informa; por isso não passa pela guarda (evita aviso duplicado).

## Prévia do Aparar (três modos)
`trimPreview.ts` desenha no `move()`:
- **Canto**: com a primeira parede escolhida, o tracejado das **duas** paredes no canto;
- **Vários**: com a lista montada por Shift+clique, o tracejado de **cada parede da lista** ao passar na referência;
- **Um elemento**: já existia; segue mostrando a parede que muda (agora pela mesma função).
Em qualquer modo, a extensão real das aberturas que sairiam aparece em **vermelho** (tom `invalid`), sem diálogo — o
diálogo só aparece na confirmação.

## Aparar e junção: eixo com eixo
Aparar usa as interseções dos **eixos** (`frameOfWall`: reta `a→b` ou circunferência do arco), nunca as faces. A junção
guarda as pontas no eixo e só configura o encontro (`setJoin`); a espessura/acabamento não desloca o nó. O teste
`trimHosted.test.ts` cobre paredes de **espessuras diferentes** (alvenaria 14 × alvenaria 9): as duas pontas caem
exatamente em `(3, 0)` e a junção não move nenhuma delas.

## Testes
- `hostedLoss.test.ts`: abertura centrada que continua cabendo; abertura na ponta que sai; parcialmente fora; duas
  aberturas; parede curva; translação não dispara; leitura de lotes/`updateElements`; texto e rótulos.
- `hostedGuard.test.ts`: confirmar aplica e exclui no mesmo undo; cancelar não muda nada; sem abertura não pergunta; sem
  gancho mantém o comportamento antigo; confirmação assíncrona (positiva e negativa).
- `trimHosted.test.ts`: Cancelar/Excluir/Ctrl+Z nos três modos; sem abertura afetada não abre diálogo; eixo × eixo com
  espessuras diferentes; prévia tracejada e vermelha nos três modos.

## Verificação no navegador (Playwright, app desta pasta)
Projeto em branco, parede de 6 m com porta **P-01** em 5,50 e janela **J-01** em 1,50, referência perpendicular:
- Aparar canto/vários: diálogo com “P-01”; **Cancelar** manteve parede de 6 m e as duas aberturas; **Excluir** levou a
  parede a 3 m e removeu só a porta; **Ctrl+Z** devolveu parede e porta.
- Arrastar a alça da ponta de 6 m para 5,5 m: diálogo; excluir deixou a parede em 5,5 m sem a porta.
- Cota de comprimento digitada `5,5`: diálogo e exclusão; `5,9`: **sem diálogo** (a porta ainda cabe) e a janela
  permaneceu.
- Prévia tracejada capturada nos três modos, com a abertura que sairia em vermelho.

Capturas: `capturas/fix-aparar-1-montagem.png` … `fix-aparar-9-sem-dialogo.png` e
`fix-aparar-10-previa-canto.png`, `fix-aparar-11-previa-varios.png`, `fix-aparar-12-previa-unico.png`.

## O que falta
- O diálogo de confirmação dentro de transações compostas (ex.: Alinhar em lote, que abre uma transação externa) pode
  aplicar antes do diálogo em cenários com várias soluções; os caminhos pedidos pelo dono estão cobertos direto.
- A alça do meio de arco (flecha) não muda as pontas e não entra na regra.
