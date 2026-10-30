# Paridade · Pranchas e exportação PDF

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte: [docs/04](../04-ROTEIRO.md) Fase 6 (prancha impressa a partir do projeto). Decisões em [0022](../decisoes/0022-pranchas.md)
e [0039](../decisoes/0039-editor-de-layout-da-prancha.md) (editor de layout).

## A · Modelo
- [x] A1 Prancha (`Sheet`) com tamanho A0–A4, orientação, margem e carimbo, opcional em `Project.sheets` **(bloqueante)**
- [x] A2 Vista de prancha (`SheetViewport`): planta, corte/elevação ou 3D, posição, tamanho e escala **(bloqueante)**
- [x] A3 Comandos com desfazer (add/update/remove de prancha e de vista) e recusa para vista fora da folha e escala ≤ 0 **(bloqueante)**
- [x] A4 Mudança de folha ou margem **reencaixa** as vistas na nova área de desenho, num único desfazer (0039; antes recusava)

## B · Composição
- [x] B1 Lista de desenho da folha em mm de papel: moldura, legenda e carimbo **(bloqueante)**
- [x] B2 Vista escalada 1:S, recortada à caixa; 1 m a 1:100 = 10 mm **(bloqueante)**
- [x] B3 Pesos de linha em mm de papel (`lineWeightMm`), sem o mínimo de 1 px
- [x] B4 Vista 3D como quadro com o aviso "3D não vai no PDF"
- [-] B5 Imagem do 3D no papel: fora desta etapa (sem raster; a decisão pede o quadro)
- [x] B6 Hachura de padrão de superfície na prancha: traços a 45° (e cruzados, pontos ou cobertura) recortados ao polígono pela regra par-ímpar; mesmas definições da planta (`diagonal`, `cross`, `dots`, `solid`) — evidência: `packages/render/src/sheet/hatch.test.ts`

## C · PDF
- [x] C1 Escritor PDF 1.4 sem dependências: catálogo, páginas, Helvetica WinAnsi, xref com offsets reais **(bloqueante)**
- [x] C2 Operadores de caminho, cor, largura em pt, recorte e texto; uma página por prancha **(bloqueante)**
- [x] C3 Teste de estrutura: cabeçalho, fim, xref e número de páginas
- [x] C4 Botão "Exportar PDF" na barra de título, salvando o arquivo como o DXF

## D · Interface
- [x] D1 Navegador: grupo Pranchas com abrir, editar, duplicar, excluir e nova prancha
- [x] D2 Aba de prancha com a folha em escala de tela (SVG) — evidência: `tests/e2e/pranchas.mjs` (captura `02-aba-prancha.png`)
- [x] D3 Arrastar vista (limitada à área de desenho) e escala pela faixa — evidência: `tests/e2e/pranchas.mjs` (remoção não exercida no fluxo)
- [x] D4 Diálogo de propriedades da prancha (folha, margem e carimbo) — evidência: `tests/e2e/pranchas.mjs` (carimbo editado e conferido no PDF)
- [x] D5 "Adicionar vista": escolhe planta, corte, elevação ou 3D, e a escala — evidência: `tests/e2e/pranchas.mjs` (planta 1:100 e corte 1:50)
- [x] D6 Conferência visual no navegador (aba de prancha e PDF aberto em leitor) — evidência: `node tests/e2e/pranchas.mjs` (PDF validado: cabeçalho, xref, uma página, texto do carimbo, raster `prancha.png`)
- [x] D7 Deslocar o conteúdo dentro da vista (pan, Alt+arrastar) — 0039; evidência: `tests/e2e/prancha-editor.mjs`

## F · Editor de layout (0039)
- [x] F1 Câmera da prancha: zoom no ponto sob o cursor, pan (roda/botão do meio/Espaço), enquadrar, 100% e zoom da
  vista selecionada; câmera por prancha na sessão — evidência: `sheetCamera.test.ts`, `tests/e2e/prancha-editor.mjs`
- [x] F2 Seleção (clique, Shift+clique) e 8 alças para redimensionar o recorte, com tamanho mínimo, proporção (Shift) e
  encaixe na área de desenho — evidência: `sheetSelection.test.ts`
- [x] F3 Recorte, moldura e legenda ligáveis por vista; travar vista (não move, não redimensiona, não troca escala)
- [x] F4 Encaixe em bordas/centros/grade com guias; alinhar (6 modos) e distribuir (H/V) num único desfazer —
  evidência: `sheetSnap.test.ts`, `sheetAlign.test.ts`
- [x] F5 Inserção em lote com escala automática (a maior que cabe) e "prancha por nível" — evidência: `sheetInsert.test.ts`
- [x] F6 Renumerar em lote, reordenar e emitir revisão (tag automática; tabela no carimbo) — evidência:
  `sheetNumbering.test.ts`, `packages/render/src/sheet/layout.test.ts`
- [x] F7 Publicar: escolhe pranchas, ordem, um arquivo ou um PDF por prancha, nome base — evidência:
  `tests/e2e/prancha-editor.mjs` (o diálogo abre e lista as pranchas)
- [x] F9 Arrastar uma vista do Navegador (planta, área, corte/elevação, 3D) para a prancha, com prévia do retângulo e
  escala natural (`dragPlacement`), encaixe, seleção e um desfazer — evidência: `sheetInsert.test.ts`,
  `tests/e2e/prancha-editor.mjs`
- [x] F10 Âncora do conteúdo: redimensionar a moldura recorta **sem mover o desenho**; mover a vista desloca a âncora;
  pan do conteúdo sem limite artificial e commit no ponto do ponteiro (sem "pulo") — evidência:
  `sheetActions.test.ts`, `sheetGestures.test.ts`, `tests/e2e/prancha-editor.mjs`
- [x] F11 Alinhar na prancha: referência → alvo, Ctrl+clique acumula, Tab alterna, Esc volta um passo; captura faces/eixos
  do modelo dentro das vistas + moldura + folha; move só a vista, nunca o modelo — evidência: `sheetAlignTool.test.ts`,
  `tests/e2e/prancha-editor.mjs`
- [x] F12 Ferramenta Mover na prancha: escolher a vista pela moldura ou por um ponto do desenho, ponto base → destino,
  captura de pontos (extremidade/interseção/meio/moldura/folha), cota, distância digitada e um desfazer — evidência:
  `sheetSnapPoints.test.ts`, `tests/e2e/prancha-editor.mjs`
- [x] F13 Faixa contextual: com prancha aberta, só Selecionar, Mover e Alinhar ficam ativos; o resto do ribbon é
  desativado com o motivo no tooltip — evidência: `sheetTools.test.ts`
- [x] F8 Ponta a ponta das interações no build real — `tests/e2e/prancha-editor.mjs` (11 passos, sem erro de console)

## E · Fora desta etapa
- [-] E1 Carimbo com logotipo e campos personalizados; modelos de prancha: depois (o campo Sheet.logo está reservado)
- [-] E2 Quantitativos e tabelas na prancha: depois

## Como conferir

`node tests/e2e/pranchas.mjs` e `node tests/e2e/prancha-editor.mjs` (depois de `npm run build`): abrem o app, criam
uma prancha A3 paisagem numa casa de teste,
monta planta 1:100 e corte, arrasta e reescala vistas, edita o carimbo e exporta o PDF. Valida o arquivo (cabeçalho,
xref, uma página por prancha, texto do carimbo) e gera o raster em `test-results/pranchas/`. Precisa de `pdftotext` e
`pdftoppm` (poppler) no sistema.
