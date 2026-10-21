# A · Pesquisa: estilos visuais, escala e pesos de linha (Revit e ArchiCAD)

Data da pesquisa: 2026-10-21. Escopo: fontes de fabricante e de norma, sem alteração de código.
Par: `B-estado-atual.md` (o que o Hestia faz hoje, com caminhos de arquivo).

## 0. Limite de acesso e como ler este documento

**Não consegui abrir as fontes primárias diretamente.** Tentativas feitas em 2026-10-21:

- `help.autodesk.com` (páginas de ajuda do Revit): `curl` via proxy de saída respondeu **403** (`CONNECT tunnel failed`). É negação de política, e pela regra do próprio ambiente não insisti.
- `help.graphisoft.com` (e `helpcenter`/`gdl`): `curl` via proxy também respondeu **403**; `WebFetch` não resolveu o nome.
- PDFs de norma e material de disciplina (UFRN, IFSC, USP, UFV) e `abntcatalogo`/`gov.br`: `curl` com código 000; `WebFetch` sem resolução de nome.

Por isso, **o conteúdo abaixo vem de trechos que a ferramenta de busca devolveu**, que citam o texto da página. Não é leitura integral. Cada afirmação traz a URL e a versão da ajuda quando a busca as informou. Antes de qualquer decisão de produto, abrir as URLs listadas na seção 7 e confirmar.

Marcações usadas:

- **[DOC]**: documentação oficial (Autodesk, Graphisoft, ABNT), conhecida só por trecho de busca. Equivale a `[DOC-busca]`.
- **[FÓRUM]**: comunidade, blog, tutorial de terceiros, questão de concurso, ou resposta de fórum. Não é fonte oficial.
- **[INFERIDO]**: dedução minha a partir de uma fonte, sem afirmação explícita dela.
- **[NÃO CONFIRMADO]**: não achei fonte. Quando há um valor "da memória", ele aparece marcado assim e **não deve ser usado**.

Data de acesso de todas as fontes: 2026-10-21.

---

## 1. Revit (Autodesk)

### 1.1 Estilos visuais (Visual Styles)

**O que faz.** Define como a vista desenha o modelo: só arestas, arestas sem as ocultas, sombreado, cor de material ou realista.
**Onde fica.** Barra de controle da vista (ícone de Visual Style) [DOC busca, 2023].
**Escopo.** Por vista. Vale para a vista ativa; entra em modelo de vista [INFERIDO a partir de "per view" e da inclusão de "Background" em modelo de vista; verificar].

| Estilo | Comportamento segundo a ajuda | Marcação |
|---|---|---|
| Wireframe | Mostra todas as arestas e linhas, sem superfícies desenhadas. | [DOC busca, 2026] `GUID-12C2D6B0-71ED-490E-9CC6-AD3C635F092B` |
| Hidden Line | Mostra arestas, exceto as obstruídas por superfícies. Módulo Autodesk Learn diz que a maioria das vistas-padrão usa Hidden Line. | [DOC busca, 2026]; Learn [FÓRUM] |
| Shaded | Sombreado, com opção de luz indireta e sombras. | [DOC busca, 2026] |
| Consistent Colors | Superfícies sombreadas segundo as configurações de cor do material. | [DOC busca, 2026] |
| Realistic | Aparece com transparência nos trechos encontrados. Comportamento detalhado **não confirmado**. | [NÃO CONFIRMADO] |
| Ray Trace | Página de 2026 **não** lista o estilo segundo o trecho. A página de 2018 o listava como estilo com transparência. A API (`DisplayStyle`) diz que definir a vista como raytrace entra em modo restrito e não aceita atribuição direta. | [DOC busca, 2018 e API via rvtdocs] **Conflito não resolvido.** |

Transparência: Hidden Line, Shaded e Realistic (2026) [DOC busca].

### 1.2 Graphic Display Options

**Onde fica.** Barra de controle da vista, ícone Visual Style, opção *Graphic Display Options* [DOC busca, 2023 "Specify the Background for a 3D View"].
**Escopo.** Por vista. O parâmetro *Background* é guardado em modelo de vista ("Save as View Template") [DOC busca, 2023].

| Opção | Comportamento | Marcação |
|---|---|---|
| Silhouettes | Escolhe o estilo de linha usado no contorno de silhueta. | [DOC busca, 2026] |
| Cast Shadows / Show Ambient Shadows | Duas caixas separadas. O controle de intensidade (*Shadows*) só funciona com *Cast Shadows* ligado. Show Ambient Shadows aparece na ajuda de 2014. | [DOC busca, 2023 e 2014] |
| Sketchy Lines | Traço à mão na vista. *Jitter* (0 a 10) controla o tremor; *Extension* (0 a 10) controla o avanço dos extremos além das interseções. Recomenda suavização com anti-aliasing. | [DOC busca, 2026] |
| Depth Cueing (Show Depth) | Funde objetos distantes na cor de fundo. *Fade Start*/*Fade End* definem o gradiente; *Fade Limit*, a intensidade no fim. Recomenda definir Far Clipping. Voltado a cortes e elevações segundo o vídeo Revit LT. | [DOC busca, 2026 e vídeo LT 2024] |
| Background | Opções: none, sky, gradient, image. Sky usa cor de chão e é afetado pelos ajustes de sol. Gradient tem céu, horizonte e chão. Horizonte = plano de chão do nível escolhido. Image tem escala e deslocamento. | [DOC busca, 2023] |
| Lighting | Não encontrei a aba com detalhe. Só "Sun Setting" aparece de passagem. | [NÃO CONFIRMADO] |

### 1.3 Detail Level (nível de detalhe)

**O que faz.** Escolhe quanto da geometria aparece: grosseiro, médio ou fino.
**Onde fica.** Propriedades da vista (parâmetro *Detail Level*) e ícone de Detail Level na barra de controle da vista [DOC busca, 2024 "Detail Levels"].
**Escopo.** Por vista (parâmetro de instância: "every view can have a different setting") [DOC busca, 2024].

- **Padrão por escala.** Ao criar a vista e definir a escala, o nível é ajustado automaticamente segundo uma tabela escala → nível [DOC busca, 2024]. **A tabela em si não foi encontrada.** Valores da memória, sem fonte: Fine ≥ 1:50, Medium 1:100, Coarse ≤ 1:200 [NÃO CONFIRMADO; não usar sem verificar].
- **Comportamento.** A estrutura composta de paredes, pisos e telhados aparece no médio e no fino. Estrutura (framing) aparece como linha no grosseiro [DOC busca, 2023 *View Properties* e 2024].
- **Por categoria ou filtro.** Não há nativamente. Pedidos abertos no Revit Ideas [FÓRUM].

### 1.4 Visibility/Graphics Overrides por categoria (VV/VG)

**O que faz.** Sobrescreve a aparência de uma categoria na vista.
**Onde fica.** *Visibility/Graphics* (abas de categorias de modelo, de anotação e importadas) [DOC busca, 2023].
**Escopo.** Vista. Pode ser fixado num modelo de vista [INFERIDO; ver 1.7].

| Recurso | Comportamento | Marcação |
|---|---|---|
| Visibility | Esconde a categoria. | [DOC busca, 2023] |
| Projection Lines / Surface Patterns | Padrão, cor e espessura das linhas de projeção; cor e padrão de hachura de superfície. | [DOC busca, 2023] |
| Cut Lines / Cut Patterns | Idem, para elementos cortados. | [DOC busca, 2023] |
| Halftone | Checkbox por categoria. Esmaece as linhas em direção ao fundo; aplica-se a todos os traços, hachuras e sólidos. **Não altera a cor do material em vistas sombreadas.** | [DOC busca, 2023 e 2026] |
| Projeção e superfície (categorias de anotação e importadas) | Só esses dois tipos de sobrescrita são permitidos para anotação e importadas. | [DOC busca, 2023] |

### 1.5 Sobrescrita por elemento (Override Element Graphics)

**O que faz.** Mesmas opções do item 1.4, para um elemento só.
**Escopo.** Só na vista. **Não é guardada em modelo de vista** [DOC busca, 2023].
**Opções.** Halftone, Projection Lines, Surface Patterns, Surface Transparency (mostra só as linhas, com controle de percentual), Cut Lines, Cut Patterns [DOC busca, 2026].

### 1.6 Filtros (Filters)

**O que faz.** Seleciona elementos por categoria e parâmetro e aplica visibilidade ou sobrescrita.
**Escopo.** A vista. Para várias vistas, usar modelo de vista [DOC busca, 2023 "About Rule-Based Filters", "Apply a Filter"].
**Regras.** Categorias (e parâmetros comuns a elas) e conjuntos de regras aninhados [DOC busca, 2023].
**Precedência.** Ordem na aba Filters; o de cima prevalece [DOC busca, 2023].
**Desligar numa vista.** "Enable in View" [DOC busca, 2023].
**Limite.** O filtro só age sobre as categorias incluídas [FÓRUM, Novedge].

### 1.7 Modelos de vista (View Templates)

**O que faz.** Guarda um conjunto de propriedades de vista e o aplica a várias vistas.
**Onde fica.** Propriedades da vista (*Include*) e *Create a View Template* [DOC busca, 2024 "GUID-A84B0E96-DD75-4D3E-AB24-C723839873FD"].

- Propriedades **não incluídas** no modelo não são alteradas ao aplicá-lo [DOC busca].
- Propriedades **incluídas** ficam acinzentadas no painel de Propriedades enquanto o modelo está atribuído [DOC busca, vídeo Learn; FÓRUM].
- *Aplicar* é ação pontual: depois, o nome do modelo some e os parâmetros voltam a ser editáveis [DOC busca, vídeo Learn].
- Uma vista tem um modelo por vez [FÓRUM, Varsity Tutors; não confirmado em fonte oficial].

### 1.8 Object Styles e Line Weights (espessura por categoria e escala)

**Onde fica.** Manage > Additional Settings > Line Weights (tabela de escala × peso) e Object Styles (por categoria, colunas Projection e Cut) [DOC busca, 2024 "Specify Line Weights"].
**Escopo.** Global ao projeto. Pode ser sobrescrito por vista (ver 1.4) [DOC busca].

- **Tabela escala × peso.** A largura de um peso vale para a sua escala e para as escalas maiores, até a próxima faixa [DOC busca, 2024].
- **Projeção e corte.** Uma parede pode usar peso 1 em projeção e peso 3 em corte (exemplo do texto, não valor padrão). Objeto que não pode ser cortado (mobiliário) usa só o peso de projeção [FÓRUM e DOC busca; exemplo].
- **Valores de 1:50, 1:100 e 1:200 no template padrão.** [NÃO CONFIRMADO].

### 1.9 Isolar e ocultar temporário (Temporary Hide/Isolate)

**Onde fica.** Barra de controle da vista, menu *Temporary Hide/Isolate* [DOC busca, 2015 "GUID-A5E51D5E-8E18-4834-8A2F-8B4E3E6379A1"].
**Opções.** Isolate Category, Hide Category, Isolate Element, Hide Element [DOC busca, 2015].
**Escopo e duração.** Só a vista ativa. Não afeta a impressão. Some ao fechar o projeto, salvo se for aplicado à vista ("Apply Hide/Isolate to View") [DOC busca, 2014/2015].
**Desfazer.** *Reset Temporary Hide/Isolate* restaura tudo. O ícone de lâmpada revela ocultos [DOC busca, 2014/2015; FÓRUM].
**Na API.** `DisableTemporaryViewMode` [FÓRUM, não verificado].

---

## 2. ArchiCAD (Graphisoft)

### 2.1 Model View Options e Partial Structure Display

**O que faz.** Controla quais camadas de paredes, lajes e pilares aparecem na vista (estrutura parcial).
**Onde fica.** Document > Partial Structure Display [DOC busca, helpcenter 55323].
**Escopo.** A janela atual; pode ser guardado por vista salva [DOC busca].
**Opções.** Entire Model (padrão), Without Finishes, Core Only, Core of Load-Bearing Elements Only [DOC busca].

- **Core Only.** Mostra só a estrutura "Core" de compostos e pilares com revestimento. A opção de estrutura portante considera todos os elementos e oculta os não portantes ou indefinidos [DOC busca].
- **Trace Reference.** A estrutura completa pode ficar como referência (Entire Model Display como Trace Reference) [DOC busca].
- **Problemas relatados.** Cotas feitas com a estrutura completa podem sumir em Core Only; caixilhos de portas ficam soltos da parede; topos de parede em portas somem com acabamento turn plaster [FÓRUM].
- **Model View Options.** Atribuída por vista (uma por vista, com marcadores visíveis ou ocultos, por exemplo) [FÓRUM]. Documento oficial não encontrado [NÃO CONFIRMADO].
- **Show Opening Only, With Contours, Fills Display.** Citados em fóruns; sem documentação encontrada [NÃO CONFIRMADO].

### 2.2 Graphic Overrides (sobrescritas gráficas)

**O que faz.** Regras que trocam a aparência de elementos que casam com um critério.
**Onde fica.** Document > Graphic Overrides > Graphic Override Rules [DOC busca, AC26 a AC30 "Graphic Override Rules"].
**Estrutura.** Uma regra tem critério (*Criteria*) e estilo de sobrescrita (*Override Style*). A primeira linha do critério é sempre *Element Type* [DOC busca].
**Combinação.** Uma *Graphic Override Combination* é um conjunto ordenado de regras. Também existe o *Renovation Filter* (por status de renovação) [DOC busca].
**Camadas.** Critério por camada considera só elementos visíveis na *Layer Combination* da vista [DOC busca].
**Preenchimentos.** No estilo, escolhe-se quais categorias de preenchimento são afetadas [DOC busca].
**Escopo.** A combinação é aplicada a uma vista [INFERIDO; a ajuda diz "through a Graphic Override Combination", mas não o vínculo exato; verificar].

### 2.3 Pen Sets (conjuntos de canetas)

**O que faz.** Define cor e espessura de cada índice de caneta.
**Onde fica.** Predefined Pen Sets [DOC busca, AC21 "Predefined Pen Sets for Specific Functions"].
**Escopo.** Projeto inteiro, com um clique. Trocar o pen set mantém os índices atribuídos aos elementos, mas muda cor e espessura de cada índice [DOC busca].
**Por escala.** Não há recurso nativo confirmado. Um guia de terceiros sugere criar pen sets por escala e avisa que reduzir de 1:20 para 1:200 sem traço mais fino deixa o desenho ilegível [FÓRUM].

### 2.4 Layer Combinations

**O que faz.** Define quais camadas estão visíveis.
**Onde fica.** Barra de opções rápidas (Quick Options Bar), ao lado de escala e pen set [DOC busca, AC20].
**Escopo.** A vista [DOC busca].

### 2.5 Escala e vistas salvas

- **Recurso oficial de "scale-dependent display" não encontrado** [NÃO CONFIRMADO].
- Uma vista salva reúne escala, Layer Combination, Model View Options, pen sets e estilos de cota [FÓRUM].
- Marcadores têm tamanho de papel fixo, pelo tamanho do ponto, independentemente da escala [FÓRUM].
- Objetos GDL podem ler a escala pela variável `GLOB_SCALE` (1:50 → 50) [DOC busca, gdl.graphisoft.com "scale sensitivity"].
- Limite citado: falta controle por escala de materiais e de camadas de composto [FÓRUM, wishlist].

### 2.6 Motores 3D e desenho à mão

- **Internal Engine.** Sem texturas; não fotorrealista; mais efeitos que o OpenGL; navegação mais lenta [DOC busca, AC18 "3D Engines"].
- **OpenGL.** Gera imagem em bitmap; mostra texturas; menos efeitos; sem hachura vetorial; a janela não sai como 2D vetorial [DOC busca, AC18].
- **Cineware.** Motor de render baseado em Cinema 4D R21; usa superfícies alternativas que não aparecem na janela 3D [DOC busca, AC25 "Migration of Rendering/Surface Settings to Cineware"; FÓRUM]. Lightworks não está mais disponível [DOC busca, AC25].
- **Sketch rendering.** Render não fotorrealista que imita traço (felt tip, pencil, graphite, marker) [FÓRUM].
- **Onde ver o motor.** View > 3D View Options > 3D Window Settings [FÓRUM; verificar na versão].

---

## 3. Matriz de recursos e escopo

| Recurso | Produto | Onde | Escopo | Comportamento exato |
|---|---|---|---|---|
| Visual Styles | Revit | Barra de controle da vista | Vista | Wireframe a Realistic; Ray Trace em conflito (1.1) |
| Graphic Display Options | Revit | Barra de controle da vista | Vista; o fundo (Background) entra em modelo de vista | Silhueta, sombras, traço à mão, profundidade, fundo (1.2) |
| Detail Level | Revit | Propriedades da vista; barra de controle | Vista | Grosseiro, médio, fino; padrão por escala não confirmado (1.3) |
| VV/VG por categoria | Revit | Visibility/Graphics | Vista; modelo de vista | Visibilidade, linhas, hachuras, transparência, halftone (1.4) |
| Override por elemento | Revit | Na vista, sobre o elemento | Só a vista | Mesmas opções, por elemento; não vai ao modelo de vista (1.5) |
| Filtros | Revit | Vista > Filtros | Vista; modelo | Regras por parâmetro; precedência de cima para baixo (1.6) |
| Modelos de vista | Revit | Propriedades da vista | Vista; aplicado pontualmente | Propriedades incluídas ficam fixas (1.7) |
| Object Styles / Line Weights | Revit | Manage > Line Weights | Projeto; vista pode sobrescrever | Escala × peso; projeção e corte (1.8) |
| Temporary Hide/Isolate | Revit | Barra de controle | Vista ativa | Some ao fechar, salvo se aplicado (1.9) |
| Partial Structure Display | ArchiCAD | Document | Janela; por vista salva | Entire, Without Finishes, Core Only, portante (2.1) |
| Model View Options | ArchiCAD | Vista | Vista (fórum) | Não confirmado (2.1) |
| Graphic Overrides | ArchiCAD | Document > Graphic Overrides | Regras; combinação aplicada à vista | Critério + estilo; ordem (2.2) |
| Pen Sets | ArchiCAD | Configuração | Projeto | Cor e espessura por índice (2.3) |
| Layer Combinations | ArchiCAD | Barra de opções rápidas | Vista | Visibilidade de camadas (2.4) |
| Escala por vista salva | ArchiCAD | Vistas salvas | Vista salva | Combinação de recursos; sem recurso nativo confirmado (2.5) |
| 3D Engines | ArchiCAD | Opções 3D | Janela 3D | Internal, OpenGL, Cineware (2.6) |

---

## 4. Pesos de linha por categoria e escala

### 4.1 O que as fontes permitem afirmar

- **NBR 16861:2020** (*Desenho técnico: requisitos para representação de linhas e escrita*) substitui a **NBR 8403:1984** para tipos e larguras de linha. Escopo confirmado em [normas.com.br](https://www.normas.com.br/visualizar/abnt-nbr-nm/12921/abnt-nbr16861-desenho-tecnico-requisitos-para-representacao-de-linhas-e-escrita) [DOC busca, 2026]. A tabela de larguras estaria na seção 3.2.1, segundo uma cópia de estudo que não consegui abrir [NÃO CONFIRMADO].
- **NBR 6492** (representação de projetos de arquitetura). Segundo questões de concurso, a versão de 2021 manda usar maior espessura nos elementos seccionados nas regiões de corte e mantém hierarquia gráfica entre cortes, projeções e informações secundárias. A hachura de corte é opcional fora dos cortes [FÓRUM, concursos, [link](https://questoes.grancursosonline.com.br/questoes-de-concursos/arquitetura-nbr-6492-representacao-de-projetos-de-arquitetura-429878)]. Isso **não é texto da norma**.
- **Série 0,25 / 0,35 / 0,5 / 0,7 / 1 / 1,4 / 2 mm.** Aparece na **NBR 8402** (escrita), com largura da linha *d* igual a *h*/10 [DOC busca, [IFSC](https://docente.ifsc.edu.br/gianpaulo.medeiros/MaterialDidatico/Desenho%20Mecatr%c3%b4nica%20/aula%202/NBR%208402%20Escrita%20Desenho%20T%c3%a9cnico.pdf)]. **Não é a tabela de traços.**
- **Razão 1:2:4 e larguras 0,13 e 0,18 mm** para desenhos que serão reduzidos. Vêm de questão de concurso de 2023, não da norma [FÓRUM, [Estude Grátis](https://www.estudegratis.com.br/questoes-de-concurso/materia/arquitetura?pag=43)].
- **Revit.** A tabela escala × peso é configurada no template. Os valores padrão para 1:50, 1:100 e 1:200 **não foram encontrados** [NÃO CONFIRMADO].

**Conclusão de fonte.** Não tenho os valores numéricos de ABNT por escala nem os padrões do Revit por escala. Não preencho números a partir da memória.

### 4.2 Tabela 1 · Largura por escala (a preencher com a fonte)

| Escala | Revit (padrão do template) | ABNT (NBR 16861 §3.2.1, a confirmar) | Hestia hoje |
|---|---|---|---|
| 1:50 | **não confirmado** | **não confirmado** | não existe: traços em px de tela, sem escala |
| 1:100 | **não confirmado** | **não confirmado** | idem |
| 1:200 | **não confirmado** | **não confirmado** | idem |

### 4.3 Tabela 2 · Hierarquia por categoria

Os valores de largura do Hestia são os do código (em px de tela, ver `B-estado-atual.md`). A coluna de ABNT e de Revit traz só o que as fontes disseram.

| Categoria | Revit (fonte) | ABNT (fonte) | Hestia hoje (px de tela) |
|---|---|---|---|
| Parede cortada (contorno) | Peso de **corte** (Cut) de Object Styles, normalmente mais grosso que o de projeção. Valor não confirmado [DOC/FÓRUM] | Elemento seccionado com maior espessura em corte [FÓRUM, NBR 6492 2021] | Contorno do conjunto cortado: **2,2** |
| Parede cortada (camadas internas) | Linhas de interface de camadas, não cortado por padrão [NÃO CONFIRMADO] | Traço interno mais leve que o de contorno [DOC busca, NBR 6492 1994, sem valores] | Interfaces de material: **1** (só quando a espessura passa de 1,6 px, ou sempre no fino) |
| Parede em projeção acima do corte | Peso de **projeção** (Projection) [DOC busca] | Não confirmado | Tracejado **1** (padrão 6/3) |
| Parede em projeção abaixo do corte | Peso de projeção [DOC busca] | Não confirmado | **1**, alfa 0,8 |
| Parede "além" | Não confirmado | Não confirmado | **1**, cor de subpavimento |
| Abertura (porta e janela) | Object Styles de portas e janelas; corte e projeção [INFERIDO; valores não confirmados] | Não confirmado | Símbolo de traço principal **1,2** × peso; secundário 0,96 e 0,84 |
| Escada (espelhos e seta) | Não confirmado | Não confirmado | Espelhos, seta e corte: **1,4**; contorno de degrau **1** (tracejado acima do corte) |
| Mobília | Não pode ser cortada: usa só o peso de projeção [FÓRUM e DOC busca] | Não confirmado | **Sem categoria de mobília** no código (busca vazia) |
| Piso e laje | Padrões de corte e hachura [DOC busca] | Não confirmado | Faixa de contorno de **1,5 px**, preenchida (não traço); sem traço próprio |
| Telhado | Não confirmado | Não confirmado | Cumeeira **2,2**; espigão e rincão **1,6** (rincão tracejado 6/3); empena **1,4** (tracejada 12/5); beiral como faixa |
| Corte e elevação (marcas) | Não confirmado | Não confirmado | Tracejada **1,5**; corte **1,2**; elevação **1** |
| Grade | Não confirmado | Não confirmado | **1** (menor e maior, cor distinta) |

Hierarquia qualitativa que as fontes confirmam: **corte mais grosso que projeção** (Revit) e **contorno de corte mais grosso que traço interno** (NBR 6492 1994, texto de busca). Os números e as categorias não confirmados ficam em aberto.

---

## 5. Perguntas que não consegui responder

1. **Valores de 1:50, 1:100 e 1:200** nas tabelas de pesos do Revit (template padrão) e na NBR 16861, §3.2.1. Precisa da norma ou de um template de Revit aberto.
2. **Tabela de escala → Detail Level padrão do Revit.** Os valores da memória não foram confirmados.
3. **Ray Trace no Revit.** A ajuda de 2026 não o lista; a de 2018 o listava. Qual é o estado atual?
4. **Lighting no Graphic Display Options do Revit** (aba completa, sol, luz artificial). Não achei detalhe.
5. **ArchiCAD: Model View Options e Fills Display.** Não achei documentação oficial sobre as opções de preenchimento.
6. **ArchiCAD: vínculo exato da Graphic Override Combination à vista** e a ordem de precedência com a Layer Combination.
7. **ArchiCAD: caminho do motor 3D** na versão atual, e o que cada motor faz com cor de material.
8. **Revit: quais categorias têm peso de corte e de projeção por padrão**, e se mobiliário é sempre "não cortável" no template padrão.
9. **Halftone do Revit com vista sombreada**: a cor do material não muda, mas e a hachura de superfície?
10. **Pesos por escala, em ArchiCAD**: não há resposta de documentação oficial sobre escala-dependência em pen sets.

## 6. Prompt de busca refinado (para a próxima rodada, com acesso a fontes)

> Preciso dos valores numéricos oficiais, com a fonte, para estes itens:
> (a) NBR 16861:2020, seção 3.2.1: tabela de larguras de linha nominais (mm), com a razão entre as séries e a recomendação de uso por tipo de linha. Quero o texto da tabela, não resumo.
> (b) NBR 6492:2021: exigências de espessura de linha por tipo de elemento em cortes, projeções e cotas, e qualquer valor por escala (1:50, 1:100, 1:200).
> (c) Autodesk Revit 2026, "Specify Line Weights" (`help.autodesk.com/cloudhelp/2026/ENU/...`) e a tabela de Line Weights do template padrão: valores de projeção e corte por escala (1:50, 1:100, 1:200). Indique o nome do arquivo do template.
> (d) Autodesk Revit 2026, "Detail Levels": tabela de escala padrão para Coarse, Medium e Fine.
> (e) Autodesk Revit 2026, "Visual Styles": confirmar se Ray Trace aparece, e a definição de Realistic.
> (f) Graphisoft ArchiCAD 27 (ou a versão atual): páginas "Partial Structure Display", "Graphic Override Rules", "Model View Options" e "Fills Display". Quero: nome exato das opções, onde se configura e se é por vista ou por projeto.
> (g) Graphisoft ArchiCAD: "3D Window Settings" e o motor 3D por vista.
> Para cada item, cite a URL e a versão. Se não houver valor numérico na fonte, diga isso, sem estimar.

## 7. Fontes consultadas (todas acessadas por busca em 2026-10-21)

**Autodesk (Revit)**
- Visual Styles (2026): https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-12C2D6B0-71ED-490E-9CC6-AD3C635F092B.htm
- Graphic Display Options (2026): https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-6AFBA7D1-D5BC-4B80-B889-B6D2409CA875.htm
- Specify the Background for a 3D View (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-282AFCEF-AFA0-4454-A1E4-DCE011A6C6BF.htm
- Detail Levels (2024): https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-0BB861D5-27CB-4276-93AE-F2E949B0D466.htm
- Specifying the Detail Level for a View (2014): https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-229C4AE8-9C31-422A-97B7-943607C55D1A.htm
- View Properties (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-8BEBCEF0-CE2C-4635-8C7C-9D03503C0B79.htm
- Override Visibility and Graphic Display of Individual Elements (2026): https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-C8976D73-6590-4D65-9B41-626F48F4D9BB.htm
- Override Graphic Display of Element Categories (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-CFE335EC-D17A-447C-999D-4D2E91C62C77.htm
- About Rule-Based Filters (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-400FD74B-00E0-4573-B3AC-3965E65CBBDB.htm
- Apply a Filter (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-FA7B0AD9-4F0F-4405-9DF7-35D30D7CBE7B.htm
- Create a View Template (2024): https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-A84B0E96-DD75-4D3E-AB24-C723839873FD.htm
- Specify Line Weights (2024): https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-C214002D-786D-4E5A-B89B-F60AB04A4460.htm
- Temporarily Hide or Isolate Elements (2015): https://help.autodesk.com/cloudhelp/2015/ENU/Revit-DocumentPresent/files/GUID-A5E51D5E-8E18-4834-8A2F-8B4E3E6379A1.htm
- API DisplayStyle (rvtdocs, 2020): https://rvtdocs.com/2020/Autodesk.Revit.DB.DisplayStyle

**Graphisoft (ArchiCAD)**
- Partial Structure Display (Help Center): https://helpcenter.graphisoft.com/?p=55323
- Visualizing the Entire Model (AC18): https://help.graphisoft.com/AC/18/INT/AC18Help/03_2_Views_Virtual_Building/03_2_Views_Virtual_Building-144.htm
- 3D Engines (AC18): https://help.graphisoft.com/AC/18/INT/AC18Help/03_2_Views_Virtual_Building/03_2_Views_Virtual_Building-26.htm
- Migration of Rendering/Surface Settings to Cineware (AC25): https://help.graphisoft.com/AC/25/INT/_AC25_Help/011_MigrationGuideOlderVersions/011_MigrationGuideOlderVersions-2.htm
- Predefined Pen Sets for Specific Functions (AC21): https://help.graphisoft.com/AC/21/INT/AC21Help/01_Configuration/01_Configuration-48.htm
- Graphic Override Rules (AC30): https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-120.html
- Graphic Override Rules (AC26): https://help.graphisoft.com/AC/26/INT/_AC26_Help/050_ViewsVB/050_ViewsVB-136.htm
- Quick Options Bar (AC20): https://help.graphisoft.com/AC/20/INT/AC20Help/01_Configuration/01_Configuration-6.htm
- GDL, Scale sensitivity: https://gdl.graphisoft.com/gdl-basics/scale-sensitivity/

**Normas e material de apoio**
- NBR 16861:2020, escopo (normas.com.br): https://www.normas.com.br/visualizar/abnt-nbr-nm/12921/abnt-nbr16861-desenho-tecnico-requisitos-para-representacao-de-linhas-e-escrita
- NBR 8402, série de larguras de escrita (IFSC): https://docente.ifsc.edu.br/gianpaulo.medeiros/MaterialDidatico/Desenho%20Mecatr%c3%b4nica%20/aula%202/NBR%208402%20Escrita%20Desenho%20T%c3%a9cnico.pdf
- NBR 6492, questões de concurso (não é a norma): https://questoes.grancursosonline.com.br/questoes-de-concursos/arquitetura-nbr-6492-representacao-de-projetos-de-arquitetura-429878

**Terceiros (apenas contexto)**
- Novedge, Revit Tip: View Filters: https://novedge.com/blogs/design-news/revit-tip-revit-view-filters-rule-based-visibility-and-consistent-graphics
- Varsity Tutors (View Templates): https://internal.varsitytutors.com/practice/subjects/autodesk-revit/lessons/view-templates
