# Paridade · Pranchas e exportação PDF

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte: [docs/04](../04-ROTEIRO.md) Fase 6 (prancha impressa a partir do projeto). Decisão em [docs/decisoes/0022](../decisoes/0022-pranchas.md).

## A · Modelo
- [x] A1 Prancha (`Sheet`) com tamanho A0–A4, orientação, margem e carimbo, opcional em `Project.sheets` **(bloqueante)**
- [x] A2 Vista de prancha (`SheetViewport`): planta, corte/elevação ou 3D, posição, tamanho e escala **(bloqueante)**
- [x] A3 Comandos com desfazer (add/update/remove de prancha e de vista) e recusa para vista fora da folha e escala ≤ 0 **(bloqueante)**
- [x] A4 Mudança de folha ou margem revalida as vistas

## B · Composição
- [x] B1 Lista de desenho da folha em mm de papel: moldura, legenda e carimbo **(bloqueante)**
- [x] B2 Vista escalada 1:S, recortada à caixa; 1 m a 1:100 = 10 mm **(bloqueante)**
- [x] B3 Pesos de linha em mm de papel (`lineWeightMm`), sem o mínimo de 1 px
- [x] B4 Vista 3D como quadro com o aviso "3D não vai no PDF"
- [-] B5 Imagem do 3D no papel: fora desta etapa (sem raster; a decisão pede o quadro)
- [ ] B6 Hachura de padrão de superfície na prancha — pendente

## C · PDF
- [x] C1 Escritor PDF 1.4 sem dependências: catálogo, páginas, Helvetica WinAnsi, xref com offsets reais **(bloqueante)**
- [x] C2 Operadores de caminho, cor, largura em pt, recorte e texto; uma página por prancha **(bloqueante)**
- [x] C3 Teste de estrutura: cabeçalho, fim, xref e número de páginas
- [x] C4 Botão "Exportar PDF" na barra de título, salvando o arquivo como o DXF

## D · Interface
- [x] D1 Navegador: grupo Pranchas com abrir, editar, duplicar, excluir e nova prancha
- [ ] D2 Aba de prancha com a folha em escala de tela (SVG) — implementada; conferir no D6
- [ ] D3 Arrastar vista (limitada à área de desenho) e escala/remoção pela faixa — implementada; conferir no D6
- [ ] D4 Diálogo de propriedades da prancha (folha, margem e carimbo) — implementado; conferir no D6
- [ ] D5 "Adicionar vista": escolhe planta, corte, elevação ou 3D, e a escala — implementado; conferir no D6
- [ ] D6 Conferência visual no navegador (aba de prancha e PDF aberto em leitor) — pendente
- [-] D7 Deslocar o conteúdo dentro da vista (pan): fora desta etapa

## E · Fora desta etapa
- [-] E1 Carimbo com logotipo e campos personalizados; modelos de prancha: depois
- [-] E2 Quantitativos e tabelas na prancha: depois
