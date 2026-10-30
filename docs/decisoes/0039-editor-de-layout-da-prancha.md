# Decisão 0039 — Editor de layout da prancha (zoom, recorte, pan e publicação)

Decidido em 2026-10-30, a partir da avaliação do dono: "a montagem de pranchas está pouco profissional; não consigo
redimensionar o tamanho das vistas, nem dar zoom e pan". Complementa a decisão 0022 sem substituí-la: a 0022 definiu o
modelo mínimo e o PDF; esta define o **editor de layout** (o equivalente ao *Sheet* do Revit e ao *Layout* do ArchiCAD).

## 1 — Modelo (tudo opcional, sem migração)

`SheetViewport` ganhou:

| Campo | Efeito |
| --- | --- |
| `offset?: Vec2` | pan do conteúdo dentro da moldura, em mm de papel (ausente = centrado). |
| `clip?: boolean` | `false` desenha sem recorte à moldura (detalhes que transbordam). Ausente = recorta. |
| `frame?: boolean` | `false` esconde a moldura fina da vista. Ausente = mostra. |
| `label?: { show?, sizeMm?, scaleBar?, rule? }` | legenda da vista (Revit: *View Title*). Ausente = legenda abaixo, 2,5 mm, com linha. |
| `locked?: boolean` | vista travada (*Pin*): não move, não redimensiona, não troca de escala. |
| `anchor?: Vec2` | âncora do conteúdo no papel (mm): onde cai o centro do desenho. Sem ela, vale o centro da caixa + `offset` (arquivos antigos). Com ela, **redimensionar recorta sem mover o desenho** e mover a vista desloca a âncora junto. |

`Sheet` ganhou `revisions?: SheetRevision[]` (`tag`, `date`, `description`, `by?`), `discipline?: string` e
`logo?: string` (reservado). Nenhum campo é obrigatório: arquivo antigo abre igual (mesma regra da 0022).

**Regra de leitura:** `viewportOffset`, `viewportClipped`, `viewportFrameVisible` e `viewportLabel` em
`packages/model/src/sheet.ts` resolvem os padrões num lugar só (render e interface usam as mesmas funções).

## 2 — Comandos

- `updateViewport` já é genérico: carrega os campos novos, valida `offset` finito e `label.sizeMm > 0` e continua
  recusando vista fora da folha (o **clamp** é feito na ação de tela, não no comando).
- Comando novo `setSheetOrder { ids }` reordena as pranchas (as não citadas ficam no fim, na ordem atual).
- Ações da tela (`apps/web/src/editor/sheetActions.ts`), cada uma com **um** passo de desfazer:
  `resizeViewportAction`, `setViewportScaleAction(..., fitFrame)`, `fitViewportAction`,
  `moveViewportContentAction`, `toggleViewportLockAction`. Todas recusam vista travada com mensagem em pt-BR.
- Reordenar/renumerar/revisão em `sheetNumbering.ts`; alinhar/distribuir em `sheetAlign.ts`; inserção em lote e
  escala automática em `sheetInsert.ts`.

## 2.1 — Âncora do conteúdo e gesto sem pulo

O conteúdo era desenhado relativo ao centro da caixa (`toPaper`), então qualquer redimensionamento recentralizava o
desenho. A âncora (`SheetViewport.anchor`, opcional) resolve: `toPaper` usa `viewportAnchor(v)` — a âncora quando
existe, senão centro da caixa + `offset`.

- **Mover** a vista: `at` e `anchor` recebem o mesmo delta (o desenho acompanha a moldura).
- **Redimensionar**: só `at`/`size`; a âncora fica (o desenho não se mexe; a janela recorta). Na primeira vez num
  arquivo antigo, a âncora é gravada com a posição atual do conteúdo, para não pular. **Durante o arraste** o preview
  também não desloca o desenho: só a moldura/recorte se move.
- **Pan do conteúdo** (Alt): só a âncora muda (o `offset` antigo é limpo) e não há mais o limite artificial de 4×.
- **Escala com moldura automática** e **Ajustar moldura**: recentralizam a âncora na caixa nova.
- **Trocar a folha**: ao reposicionar a vista, a âncora acompanha.

O gesto também deixou de ler o estado do React no `pointerup`: `sheetGestures.resolveGesture` calcula a posição a
partir do próprio evento de soltar (e de uma ref síncrona), então o commit é exatamente o que estava sob o ponteiro.

## 2.2 — Ferramenta Alinhar na prancha

Reaproveita a captura do Alinhar do modelo (`AlignTool` + `alignFeaturesAt`) e segue o mesmo gesto: o primeiro clique
define a **referência**, o segundo o que se move; `Ctrl+clique` acumula alvos, `Tab` alterna a feição sob o cursor e
`Esc` volta um passo (fila → referência → desliga). A referência permanece até o `Esc`, permitindo alinhar várias
vistas ao mesmo eixo.

- **Candidatas**: faces, eixos, ombreiras, arestas de piso/laje/escada e linhas de grade **dentro** das vistas (captura
  do modelo, convertida para mm de papel), mais a **moldura da vista** (4 bordas + centros) e as **bordas/centro da
  folha**. A distância é recalculada no papel e só entra quem está a até 8 px do cursor; geometria ganha da moldura no
  empate.
- **O que move**: só a **vista** (`at` + `anchor`), nunca o modelo. Quando a referência e o alvo são da mesma vista, a
  ferramenta recusa ("a vista de referência não se move").
- **Eixo**: a reta de referência define o eixo; o delta é a componente perpendicular que faz as duas retas coincidirem
  (vertical → só X; horizontal → só Y; diagonais → o vetor perpendicular).
- **Sem afastamento** (0 mm) nesta versão; alinhamento com *gap* fica para depois.
- Na tela: linha cheia da referência, tracejada da candidata, fila em âmbar e fantasma da vista de destino com o
  deslocamento em mm. A seleção normal some enquanto a ferramenta está ativa.

## 2.3 — Ferramenta Mover na prancha

Mesmo gesto do Mover do modelo: **(1) escolher a vista → (2) ponto base → (3) destino**, com captura de pontos, cota
temporária e distância digitada. O primeiro clique escolhe a vista clicando na **moldura** ou em **qualquer linha do
desenho dentro dela** — o alvo é sempre a viewport inteira; depois o ponto base é que decide se você está pegando um
canto da caixa ou um canto de parede. Se já houver vista selecionada, a ferramenta começa direto no ponto base.

- **Captura de pontos** (`sheetSnapPoints`): extremidades, interseções e meios dos traços desenhados + cantos, meios e
  centro da moldura + cantos, meios e centro da folha. Deduplicado a 0,05 mm, prioridade interseção > extremidade >
  meio > moldura > folha, tolerância de 8 px.
- **Fantasma** da moldura + desenho no destino, cota `distância · ângulo`, marcador do ponto capturado e do ponto base.
- **Digitar**: com o ponto base dado, dígitos montam a distância (mm); `Enter` aplica na direção do cursor, `Backspace`
  apaga, `Esc` cancela.
- **Mover várias**: com 2+ vistas selecionadas, todas andam pelo mesmo delta, num único desfazer.
- Ao aplicar, a ferramenta **sai** (paridade com o Mover do modelo). Vista travada recusa; o limite da folha encosta e
  avisa.
- O arraste direto continua como atalho; o Mover é o modo preciso. Pan do conteúdo continua no Alt+arrastar.

## 2.4 — Faixa contextual na prancha

Com uma prancha aberta, as ferramentas do ribbon que não se aplicam à folha ficam **desativadas** (acinzentadas, com o
motivo no tooltip): só **Selecionar**, **Mover** e **Alinhar** continuam ativos. Vale para todas as abas (Modificar,
Arquitetura, Inserir, Anotar), como a faixa contextual do Revit. O arraste do Navegador, a barra da prancha e o menu de
contexto continuam funcionando.

## 3 — Composição (`packages/render/src/sheet/`)

- `toPaper` soma `offset`: o pan move o conteúdo, a moldura fica.
- Grupo da vista só recebe `clip` quando `clip !== false`.
- Moldura da vista respeita `frame`; a legenda respeita `label` (texto, linha e barra de escala de 20 mm em 4
  segmentos).
- Carimbo aceita `discipline` no cabeçalho e desenha a **tabela de revisões** acima do bloco clássico;
  `stampHeightOf(sheet)` dá a altura real (o `freeSpot` usa essa altura para não colocar vista sobre o carimbo).

## 4 — Interface (`apps/web/src/ui/sheet/`)

O antigo `SheetView.tsx` (um arquivo só, sem câmera) virou:

| Arquivo | Papel |
| --- | --- |
| `SheetStage.tsx` | palco: câmera, gestos, atalhos, barra inferior |
| `SheetCanvas.tsx` | SVG da folha; grupos de vista **memoizados** (arraste não refaz a geometria) |
| `SheetControlBar.tsx` | barra inferior (o lugar da Barra de Controle de Vista) |
| `sheetCamera.ts` | matemática de zoom/pan/enquadramento (pura, testada) |
| `sheetSelection.ts` | alças, redimensionamento com mínimo e proporção, clamp, acerto de alvo |
| `sheetSnap.ts` | encaixe em bordas/centros/grade e guias |

**Interações** (padrão Revit/ArchiCAD):

- roda do mouse = zoom no ponto sob o cursor; botão do meio ou Espaço+arrastar = pan; duplo clique = enquadrar a vista
  (ou a folha); `Z` = enquadrar; `G` = grade; `0` = 100%.
- clique seleciona; Shift+clique alterna; arrastar move (Shift+seta = 10 mm, seta = 1 mm); `Delete` remove; `Esc`
  limpa.
- 8 alças redimensionam a **região de recorte** (o desenho não muda de escala); Shift no canto mantém a proporção.
- Alt+arrastar move o conteúdo dentro da moldura (pan da vista).
- encaixe nas bordas/centros das outras vistas, na área de desenho e na grade; guias rosa durante o arraste.
- com 2+ vistas: alinhar (6 modos) e distribuir (H/V) num único desfazer.
- barra: zoom, %, Ajustar, 1:1, Ver vista, Grade, Encaixe; com uma vista: escala, Ajustar moldura, Recortar, Moldura,
  Legenda, Travar, Moldura automática; Adicionar vista e Propriedades.

**Arrastar do Navegador** (estilo Revit): as vistas de planta, de área, os cortes/elevações e o 3D são
arrastáveis do Navegador de projeto para a folha (`Node.drag` + `editor/sheetDrag.ts`, MIME
`application/x-hestia-view`). Durante o `dragover` a folha desenha o retângulo tracejado com o nome e a escala, encaixa
nas bordas das outras vistas (guias) e mostra o aviso quando a vista foi reescalada para caber. Ao soltar, a vista entra
**centrada no ponteiro**, na escala natural da vista (1:100 de uma planta, a do corte/elevação), e só desce de escala se
não couber; a nova vista fica selecionada e um único `Ctrl+Z` a remove. Arraste cancelado (Esc ou solto fora) limpa a
prévia pelo `dragend`.

**Moldura automática** (ligada por padrão): trocar 1:100 por 1:50 cresce a moldura junto com o desenho (ArchiCAD).
Desligada, a moldura fica e o desenho é recortado (Revit).

## 5 — Inserção, numeração e publicação

- "Adicionar vistas" com marcação múltipla e escala **Automática** (a maior que cabe), num único desfazer; "Prancha
  por nível" cria uma A3 por nível.
- Renumerar em lote (prefixo, início, passo, casas), mover para cima/baixo, emitir revisão (tag automática `0,1,2…`
  ou `A,B…`, atualiza `titleBlock.revision`).
- Publicar: escolhe pranchas, ordem, um arquivo ou um PDF por prancha, nome base (menu Arquivo › Exportar › Publicar…).

## 6 — Critérios de aceitação

- `packages/model/src/sheet.test.ts`: campos novos, validação, ordem, persistência.
- `packages/render/src/sheet/layout.test.ts`: offset, recorte, moldura, legenda, barra de escala, revisões.
- `apps/web/src/ui/sheet/*.test.ts`: câmera, alças e encaixe (matemática pura).
- `sheetActions.test.ts` / `sheetAlign.test.ts` / `sheetInsert.test.ts` / `sheetNumbering.test.ts`: ações, 1 desfazer
  por gesto, recusas em pt-BR.
- `apps/web/src/ui/sheet/sheetGestures.test.ts`: preview e commit com o mesmo cálculo, encaixe em linhas, arredondamento.
- `apps/web/src/ui/sheet/sheetAlignTool.test.ts`: captura por geometria/moldura/folha, prioridade, delta por eixo.
- `tests/e2e/prancha-editor.mjs` (14 passos): zoom no cursor, move, redimensionar, pan de conteúdo, escala com moldura,
  seleção múltipla + alinhar + desfazer, recorte/legenda/trava, setas e Delete, arrastar do navegador, **redimensionar
  sem mover o desenho**, **pan/arraste rápido sem pulo**, **Alinhar por moldura e por face desenhada**, **Mover por
  moldura e por ponto do desenho (inclusive distância digitada)** e **ferramentas desativadas na prancha**.

## 7 — Fora desta etapa

Alinhar com afastamento (*gap*), rotação de vista na folha, 3D rasterizado no PDF, famílias de carimbo, grade de alinhamento nomeada (*Guide Grid*),
planta fantasma (*Trace & Reference*), nuvens de revisão, vistas dependentes e logotipo embutido no PDF.
