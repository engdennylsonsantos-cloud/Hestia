# Decisão 0040 · 3D vetorial na prancha (pontos de vista)

Decidido em 2026-10-30, a partir da avaliação do dono: o 3D da prancha saía como um quadro com o aviso "3D não vai no
PDF". Esta decisão substitui aquele item da decisão [0022](0022-pranchas.md) §2: o 3D passa a sair **vetorial** no SVG,
no PDF e no DXF, com o mesmo desenho e a mesma câmera da aba 3D. Complementa a [0015](0015-graficos-de-vista.md) (estilo
visual) e a [0039](0039-editor-de-layout-da-prancha.md) (editor de layout), sem mudar o modelo das pranchas.

## 1 · Modelo (opcional, sem migração)

- `SheetView3DCamera` (`packages/model/src/sheet.ts`): retrato do `OrbitCamera` da tela — `azimuth` e `elevation` em
  radianos, `distance` em metros, `target { x, y, z }` em metros e `ortho` (projeção ortogonal ou em perspectiva).
  `sheetView3DCameraIssue` recusa valores não finitos e distância ≤ 0, com mensagem em pt-BR.
- `View3DPoint` (`packages/model/src/view3dPoints.ts`): `{ id, name, camera }`. É o ponto de vista do catálogo: nome
  para a lista e para a legenda, câmera para o enquadramento.
- `Project.view3dPoints?: View3DPoint[]`: ausente = nenhum ponto, arquivo antigo abre igual (mesma regra da 0022; sem
  `SCHEMA_VERSION` nova). O catálogo fica fora da resolução dos níveis (`resolveLevels.ts`), que não o usa.
- `SheetViewSource` ganhou `{ kind: '3d'; pointId?: Id; camera?: SheetView3DCamera }`. A prancha guarda o `pointId` e
  resolve a câmera ao desenhar; `camera` é a cópia embutida usada por arquivos antigos e pela exclusão do ponto.
  `cameraDaVista3D` resolve nesta ordem: câmera do ponto referenciado → câmera embutida → `null` (enquadramento padrão).

## 2 · Catálogo de pontos de vista

- Comandos com desfazer/refazer (`applyView3DPointCommand`): `addView3DPoint`, `updateView3DPoint`,
  `removeView3DPoint` e `setView3DPointOrder`. Recusam, sem alterar o projeto: nome vazio, câmera inválida, ponto
  duplicado, ponto inexistente e ordem incompleta ou com id repetido.
- Nome padrão por `defaultView3DPointName`: "Vista 3D", "Vista 3D 2", "Vista 3D 3"… O ponto entra no catálogo com a
  câmera clonada por `makeView3DPoint` (nada de compartilhar o alvo com a tela).
- **Editar o ponto muda todas as pranchas que o usam**: a vista guarda só o `pointId`, então `updateView3DPoint`
  (nome ou câmera) vale no mesmo passo de desfazer para todas as folhas. A interface pode gravar a câmera viva da aba
  3D no ponto (`cameraDaOrbita` → `updateView3DPoint`), mas o comando é o mesmo.
- **Excluir o ponto não deixa prancha em branco**: `removeView3DPoint` copia a câmera do ponto para cada vista que o
  referencia (`{ kind: '3d', camera }`) antes de tirá-lo do catálogo. O desenho continua idêntico e o desfazer devolve a
  referência. `view3DPointsUsage` lista as vistas afetadas para a confirmação na interface.
- **Sem ponto e sem câmera** = enquadramento padrão: `OrbitCamera.fit(box)` em perspectiva, com a proporção do quadro.
  É o caso do comando de inserir a vista 3D sem escolher ponto e dos arquivos anteriores a esta decisão. Um `pointId`
  órfão (ponto apagado por fora do comando) também cai no enquadramento padrão: a prancha não quebra.

## 3 · Composição (`packages/render/src/sheet/`)

- `buildSheetDrawList` trata a vista 3D como as demais: `partsOfViewport` chama `vista3dParts` e devolve `SheetPath[]`
  em mm de papel, recortados ao quadro. A moldura, a legenda e o carimbo continuam no grupo final da folha.
- A montagem é a **mesma da aba 3D**: `vista3d.ts` cria um `ModelScene`, chama `update` com a vista 3D do projeto e lê
  `ModelScene.exportarVetores()` (`packages/render/src/model3d/scene3d.ts`). Esse método lê `this.model` — o mesmo grupo
  que a GPU desenha — e devolve triângulos (malhas, inclusive `InstancedMesh`, com as matrizes de instância) e arestas
  (`LineSegments`). Ficam de fora datum dos níveis, chão, grade, camada de picking e realces.
- O **estilo é forçado para `hiddenLine`** (com arestas e sem sombras): no papel a representação é sempre de linhas. A
  geometria, a visibilidade de categorias e a exibição parcial continuam sendo as da vista 3D do projeto.
- A **câmera é a mesma `OrbitCamera`**: a câmera salva é aplicada por `aplicarCameraNaOrbita` e a proporção do quadro
  entra em `setAspect` (é o *crop region* da vista). Sem câmera, `fit(box)` enquadra o modelo.
- **Projeção e linhas ocultas**: as arestas são projetadas por `projectionMatrix × matrixWorldInverse`, com recorte no
  plano próximo; um z-buffer em CPU rasteriza os triângulos exportados e cada aresta é amostrada (passo de 1,2 px). Um
  ponto é visível quando nenhuma superfície está mais perto que ele (folga proporcional à diagonal do modelo); o teste
  usa o mínimo de uma vizinhança 3×3 para fechar frestas de 1 px. Só as corridas visíveis viram `SheetPath`; uma amostra
  oculta isolada entre duas visíveis é tratada como ruído e não parte o traço.
- O traço sai com **0,18 mm** de espessura e a tinta do desenho (`#16181c`), como a planta em papel.
- **Legenda "Sem escala"**: `captionOf` (`frame.ts`) imprime `${nome} · Sem escala` para o 3D — a câmera define o
  enquadramento, não uma escala de desenho. O carimbo ignora a escala das vistas 3D (`scalesLine`); sem nenhuma vista
  com escala, mostra "Sem escala". O campo `scale` da vista 3D continua no modelo por compatibilidade e não é aplicado.

## 4 · Saída

- O 3D vira `SheetPath[]` como qualquer outra vista. Daí saem, sem raster e sem imagem:
  - **SVG** da aba de prancha (`SheetCanvas`);
  - **PDF** vetorial (`exportSheetsPdf`, `packages/io/src/pdf/sheetsPdf.ts`);
  - **DXF** da prancha (`sheetDxf`, `apps/web/src/editor/dxfSheet.ts`).
- Não há `SheetFill` nem textura para o 3D: só caminhos abertos. Nenhum `<image>` é gerado no SVG da folha.

## 5 · Desempenho e cache

- A cena vetorial é montada **uma vez por objeto de projeto** (`WeakMap<Project, CenaVetorial | null>` em `vista3d.ts`)
  e o `ModelScene` é descartado em seguida; ficam só triângulos, arestas e a caixa. Como o projeto é imutável, qualquer
  edição gera outro objeto e a cena é refeita na próxima composição.
- O **BVH** (`buildTriBvh`) é construído **por cena** e guardado junto com os triângulos. As arestas duplicadas que a GPU
  desenha duas vezes são deduplicadas antes do teste de visibilidade (no papel o traço é o mesmo).
- O z-buffer é montado por vista, na proporção do quadro: **8 px por mm** de papel, com teto de 2400 px no lado maior
  (um A0 a 8 px/mm passaria de 9000 px). O custo cresce com a área do quadro e com o número de arestas amostradas.
- A resolução do z-buffer não aparece no arquivo: ela só decide a visibilidade. O PDF e o DXF continuam vetoriais.

## 6 · Limitações desta etapa

- **Espessura única** de 0,18 mm para todas as arestas; não há peso por categoria nem silhueta com peso próprio no 3D.
- **Sem hachura, sombreado ou transparência**: o papel mostra linhas ocultas removidas, não faces pintadas.
- **Linhas ocultas são omitidas**, não tracejadas.
- O z-buffer é uma **aproximação na resolução de 8 px/mm** (teto de 2400 px): arestas rasantes e coincidentes podem
  sumir ou aparecer; a vizinhança 3×3 e a ponte de uma amostra reduzem, mas não eliminam, o efeito.
- O recorte da vista é o do quadro; o **pan do conteúdo** (`SheetViewport.offset`) não desloca o 3D — para mudar o
  enquadramento, edite o ponto de vista.
- Não há escala métrica no 3D (a legenda diz "Sem escala").

## 7 · Fora de escopo

- Sombreamento, transparência e materiais no 3D da prancha.
- Linhas ocultas tracejadas.
- Escala métrica no 3D, cotas e anotações automáticas dentro da vista 3D.
- Peso de linha por categoria no 3D.

## 8 · Critérios de aceitação

- Catálogo: criar, renomear, editar câmera, reordenar e excluir com desfazer; excluir copia a câmera para as vistas e o
  desfazer restaura a referência; nome vazio e distância zero são recusados (`packages/model/src/view3dPoints.test.ts`).
- Composição: a mesma câmera muda o desenho; sem ponto/câmera o modelo é enquadrado; a vista respeita o quadro; o 3D
  não sai vazio e a legenda é "Sem escala" (`packages/render/src/sheet/vista3d.test.ts`,
  `packages/render/src/sheet/build.test.ts`).
- Saída: o PDF e o DXF usam a mesma lista de desenho da folha; nenhum raster é gerado.
- Ponta a ponta: `tests/e2e/pranchas-3d.mjs` captura a prancha com a vista 3D em `tests/e2e/out/pranchas-3d/`.
