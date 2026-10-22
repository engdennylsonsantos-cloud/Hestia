# Decisão 0022 · Pranchas e exportação PDF

Decidido em 2026-10-22 para a tarefa I2 (Fase 6 do roteiro: "prancha impressa a partir do projeto"). Referências:
Revit (*Sheet*, *Viewport*, bloco de título) e ArchiCAD (*Layout*, *Drawing*). Escala e pesos de linha seguem a decisão
0015; anotações da planta seguem a 0019.

## 1 · Modelo (opcional, sem migração, `SCHEMA_VERSION` igual)

- `Project.sheets?: Sheet[]` (`packages/model/src/sheet.ts`). Ausente = nenhuma prancha; arquivo antigo lê como vazio.
- `Sheet { id, number, name, size: 'A0'…'A4', orientation: 'landscape' | 'portrait', margin (mm, padrão 10), titleBlock, viewports }`.
- `TitleBlock { project, client, author, date, revision, scaleNote? }`. Sem `scaleNote`, o carimbo lista as escalas das vistas.
- `SheetViewport { id, view, at, size, scale, title? }`: `view` é `{kind:'plan', levelId}`, `{kind:'section', sectionId}`
  (corte ou elevação) ou `{kind:'3d'}`. `at` é o canto inferior esquerdo e `size` a caixa, ambos em mm de papel; `scale`
  é o denominador (100 = 1:100). O tipo se chama `SheetViewport` para não colidir com o `Viewport` da tela.
- Comandos com desfazer (`packages/model/src/sheetCommands.ts`): `addSheet`, `updateSheet`, `removeSheet`,
  `addViewport`, `updateViewport`, `removeViewport`. Recusam com mensagem pt-BR e não alteram o projeto:
  vista fora da área de desenho (folha menos a margem), escala ≤ 0, caixa sem área, nível ou corte inexistente, margem
  que consome a folha. Mudar tamanho, orientação ou margem revalida todas as vistas.
- A vista é centrada no conteúdo do nível (caixa das paredes) ou da seção (`sectionBox`). Não há deslocamento de
  conteúdo dentro da vista nesta etapa.

## 2 · Composição (`packages/render/src/sheet/`)

- `buildSheetDrawList(project, sheetId)` devolve a folha em **mm de papel**, origem no canto inferior esquerdo, y para
  cima (como o PDF). Um grupo por vista, recortado (`clip`) à caixa da vista, e um grupo final com moldura, legenda de
  cada vista e carimbo (com fundo branco, cobre o que estiver sob ele).
- A vista usa o próprio `buildPlanDrawList` ou `buildSectionDrawList` com zoom `1e6 / escala`: 1 mm de papel vale 1000 px.
  Assim `paperMmToPx` não aplica o mínimo de 1 px (que pioraria os traços de 0,1 mm) e a largura sai como `px / 1000`
  em mm. Um metro a 1:100 mede 10 mm (teste em `build.test.ts`).
- Pesos de linha: vêm da tabela `lineWeightMm` na escala da vista (a escala da prancha substitui a do nível, no
  projeto copiado só para o desenho). Traço de 0,5 mm fica com 0,5 mm no papel.
- Rótulos: texto em `fontPx` (anotações, decisão 0019) sai no tamanho em mm; rótulo sem tamanho próprio sai com 2,5 mm.
  Deslocamentos de rótulo em px de tela viram mm com 96 dpi.
- Vista 3D: sem imagem no papel. O quadro traz o aviso "3D não vai no PDF" (decisão desta etapa).
- Vista com origem inexistente: quadro vazio com a legenda "Vista inexistente".

## 3 · PDF (`packages/io/src/pdf/`)

- Escritor sem dependências, PDF 1.4: catálogo, páginas, uma fonte Helvetica com codificação WinAnsi e um fluxo de
  conteúdo por página. Tabela xref com offsets reais e dicionário de informações com o título do projeto.
- Operadores: `m l h` (caminhos), `S` (traço), `f*` (preenchimento par-ímpar, para furos), `re W n` (recorte), `q Q`,
  `w` (largura em pt = mm × 72/25,4), `d` (traço-vão), `rg RG` (cor), `BT Tf Tm Tj ET` (texto).
- `exportSheetsPdf(sheets, title)`: uma página por prancha, tamanho da folha em pontos. Centralização de texto usa as
  larguras da AFM de Helvetica (ASCII; acentos com a largura da letra base).
- Transparência vira cor já misturada ao branco do papel. Hachura de padrão de superfície não sai no PDF nesta etapa
  (a cor do material sai).
- `apps/web/src/editor/savePdf.ts` salva pelo `<a download>`; o botão **Exportar PDF** fica na barra de título, ao lado
  do DXF.

## 4 · Interface (`apps/web`)

- Navegador de projeto, grupo **Pranchas**: abrir, editar (propriedades), duplicar (com vistas e ids novos, um passo de
  desfazer) e excluir; **Nova prancha** cria A3 deitada com o número seguinte (A-101…).
- Aba de prancha (`view: 'sheet'`, `sheetId`): a folha desenhada em SVG, em mm; arrastar uma vista move a caixa (a
  posição é limitada à área de desenho antes de gravar); faixa acima com escala da vista selecionada, remover vista,
  **Propriedades da prancha** e **Adicionar vista** (planta de um nível, corte ou elevação, 3D; escala 1:20 a 1:500;
  a vista entra no primeiro lugar livre da grade de 10 mm).
- Na aba de prancha, teclas sem Ctrl não acionam ferramentas (o desfazer com Ctrl continua valendo).
- Propriedades da prancha: número, nome, tamanho, orientação, margem e carimbo (projeto, cliente, autor, data,
  revisão, escala em texto). Cada campo grava ao sair e recusa aparece no diálogo.

## 5 · Fora desta etapa

- Deslocar o conteúdo dentro da vista (pan) e escolher o ponto central da vista.
- Carimbo com logotipo, campos personalizados e modelos de prancha; numeração automática por tipo de vista.
- Hachura de padrão de superfície e imagem do 3D no papel.
- Gráficos de vista próprios da prancha: a vista usa os gráficos salvos do nível (ou do corte) e só troca a escala.
- Quantitativos e tabelas na prancha.

## 6 · Critérios de aceitação

- Comandos com desfazer e recusa: `sheet.test.ts` (modelo) e `sheetActions.test.ts` (ações da tela).
- Composição: escala 1:100 (1 m = 10 mm), recorte à caixa, moldura e carimbo por último, 3D como aviso, vista
  inexistente sem quebrar (`build.test.ts`).
- PDF: começa com `%PDF-1.4`, termina com `%%EOF`, cada offset do xref aponta para `N 0 obj`, uma página por prancha,
  traço de 0,5 mm vira 1.417 pt, texto escapado e em WinAnsi (`sheetsPdf.test.ts`).
