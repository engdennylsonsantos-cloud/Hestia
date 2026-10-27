# Dossiê R2 · ArchiCAD — configuração de JANELAS (diálogo e abas)

**Escopo:** ferramenta Janela (Window) e biblioteca INT do ArchiCAD; janela de canto, claraboia/janela de telhado e porta-balcão quando o comportamento é próprio. Não cobre portas de giro em detalhe (dossiê R1).
**Versões lidas:** AC28 (principal), AC24 (abas de linhas de abertura e nível de detalhe), AC26 (Elementos), AC18 e AC17 (hierarquia antiga, ainda útil para nomes de abas), AC30/AC29 apenas onde a página equivalente foi localizada. Páginas em inglês (INT) e em português (BRA/POR) para fixar a tradução dos campos.
**Convenção:** [DOC] = ajuda oficial lida; [FÓRUM] = comunidade/loja/treinamento; [INFERIDO] = dedução declarada. “NÃO CONFIRMADO” = não achei fonte que feche a lista.

---

## 1. Resumo executivo

1. A janela do ArchiCAD **não é uma família com parâmetros livres**: é um objeto GDL da biblioteca (Basic Window, variantes de correr, guilhotina, arco, multi-sash etc.). O diálogo mostra apenas os parâmetros que aquele objeto expos. Por isso a lista de abas e de opções **varia com o objeto escolhido** — a ajuda oficial diz isso explicitamente.
2. O diálogo tem três camadas: **painéis** (Pré-visualização e Posicionamento, Definições Personalizadas, Planta e Corte, Marcador de Dimensão, Classificação e Propriedades), **páginas principais** (Definições e Abertura, Abertura na Parede, Equipamentos e Acessórios) e **subpáginas** acessadas pelo ícone à direita de cada campo.
3. A dimensão nominal pode ser medida de quatro formas: **Wallhole** (furo), **Unit** (conjunto), **Egress** (largura livre) e **Leaf** (folha). A escolha “Set as Nominal” define o que vai para o quadro e para os campos Width/Height. Tolerância e **Oversize** aumentam o furo de modos diferentes: a tolerância entra na nominal; o oversize não.
4. A **forma** (Shape) define a composição de folhas/painéis e a existência de bandeira (transom) e luz lateral (sidelight). O número de folhas não é um campo único: vem da variante de biblioteca e das caixas da página Shape.
5. As **divisões de caixilho** (muntins) ficam em Sash Type/Sash Options, por folha ou por bandeira: grade H-V, grade editável por hotspots, estilos Prairie, painel customizado; com número de panes horizontais/verticais e posição da grade (dentro, fora ou atravessando).
6. O **tipo de abertura** é por componente (folha, luz lateral, bandeira), com ângulo 2D e 3D separados; correr usa distância em vez de ângulo. A biblioteca nomeia pelo menos `Fixed Glass`, `Fixed Sash`, `Side Hung`, `Side Hung Mirrored`, `Tilt and Turn`; os demais tipos vêm das variantes (awning/top hung, double hung, sliding, pivot, hopper).
7. **Moldura**: junta mitrada ou de topo (`Mitered`/`Butt Joint`), largura uniforme ou por lado (`Uniform Frame Width` + `Frame Widths`), espessura do batente e, em portas, `Frame Thickness = Wall Thickness`. Nas janelas não achei um seletor de “Frame Style”; ele aparece nas portas (três estilos, o mais simples é `Block`).
8. **Vidro**: espessura e material/superfície são parâmetros do caixilho; a representação de vidro duplo é um nível de detalhe 2D (`Full – Double Glazing`), não um campo de “tipo de vidro”.
9. O **assentamento** é controlado por Reveal Type + Reveal Depth, com âncora na **face** ou no **núcleo** da parede composta. A âncora no núcleo mantém o afastamento quando o acabamento muda; se a parede perder o núcleo, a âncora volta para a face.
10. O **fechamento da parede** (Wall Closure) gira as camadas da parede para dentro do vão; `Turn Plaster` faz o reboco virar para fora do contorno definido pelo reveal. Wall Closure é 2D (com opção “Show in 3D” no Turn Plaster); **alizar e Turn Plaster são mutuamente exclusivos**.
11. **Peitoril externo** (`Sill`) e **peitoril interno/tábua** (`Board`) são peças distintas; `Threshold` é soleira de porta. O `Sill` tem tipo, espessura, largura, ângulo, nariz e `Slip in Depth`; o `Board` tem curvatura e paralelismo em parede poligonal.
12. **Wall Inset** é o recorte abaixo da janela (radiador): automático, simétrico ou assimétrico, com elevação de base, profundidade e linha de parapeito oculto em 2D. **Masonry Arch** acrescenta arco de alvenaria (stipla/abobadilha), com estilo, rise, keystone, nicho e transpasse.
13. **Brise/sunshade** é acessório com tipo, abertura 3D, símbolo 2D, quadro extra e altura; não existe se a janela tiver luz lateral elevada. **Ganging** alinha janelas vizinhas e apaga as linhas de encontro.
14. **Janela de canto** tem ferramenta própria (`Corner Window`), cria um par espelhado e solidário; a alternativa é usar duas janelas com `Custom Corner` (Frame / Corner Column / Glass). **Claraboia** usa a ferramenta Skylight, é inserida em Telhado ou Shell e, por padrão, é desenhada em planta por projeção 3D.
15. **Representação**: `Symbolic` (símbolo independente do 3D), `Projected` e `Projected with Overhead`; as linhas de abertura são globais por MVO no AC28 (no AC24 havia override por elemento). O nível de detalhe 3D é `Schematic`/`Simplified`/`Full`/`Off`; o 2D é sensível à escala, fixo por escala ou desligado.

---

## 2. Mapa do diálogo

### 2.1 Painéis do diálogo (AC28)

| Painel | O que contém | Observações |
|---|---|---|
| **Preview and Positioning** | Width, Height, Sill/Header value + referência, Reveal depth + âncora, Flip, Anchor Point, Opening Plane, preview 2D/3D | Width/Height são a **Nominal Size**; o Reveal aqui é o mesmo da aba Reveal. [DOC AC28 150-16] |
| **Custom Settings** | Interface gráfica do objeto; nome varia (ex.: Basic Window Settings). Contém as páginas principais e subpáginas | Só existe se o objeto tiver UI; senão fica cinza. [DOC AC28 150-15/17] |
| **Floor Plan and Section** | Atributos 2D simplificados, Floor Plan Display, override de linhas/pens/fills | Pode sobrescrever os atributos GDL. [DOC AC28 151-29; AC28 150-18] |
| **Dimension Marker** | Marcador, Subfloor Thickness, unidades de cota | Não altera a posição da janela. [DOC AC28 150-19] |
| **Marker Custom Settings** | Opções do marcador escolhido | Cinza se não houver marcador compatível. |
| **Classification and Properties** | Classificação/IFC e propriedades | Painel de metadados. |
| **Model** (oculto por padrão) | Uma única superfície para o objeto | Habilitar em Options > Work Environment > Tool Settings Dialog Boxes. [DOC AC28 150-19] |

### 2.2 Hierarquia das páginas principais (janela INT)

O caminho curto é **Definições e Abertura → Abertura na Parede → Equipamentos e Acessórios**; o resto são subpáginas acessadas pelo ícone à direita do campo. [DOC AC28 150-17]

| Grupo | Páginas |
|---|---|
| Dimensão e forma | Nominal Sizes and Tolerance; Shape |
| Conjunto | Door/Window Settings and Opening (na janela: Window Settings and Opening) |
| Caixilho | Frame and Sash; Frame Widths; Sash Type/Sash Options; Opening Type and Angle |
| Parede | Wall Opening; Reveal Settings; Wall Closure; Wall Inset (janela); Masonry Arch; Tolerances |
| Acessórios | Fixtures and Fittings; Threshold; Sill; Board; Casing Outside/Inside; Sunshade; Custom Corner |
| Atributos | Model Attributes of Door/Window Opening; Model Attributes of Wall Opening; Model Attributes of Fixtures and Fittings; Floor Plan and Section; Minimal Space |

**AC18/AC17 (legado):** além dessas, apareciam `Parameters` (lista “All Parameters”), `Model`, `Reveal`, `Listing and Labeling` e `Tags and Categories`. A página “Graphical Interface Panel for a Window” listava Nominal Sizes, General Settings, Shape, Frame and Sash, Frame Widths, Sash Options, Opening, **Opening Lines**, Reveal, Wall Closure, Custom Closure, Custom Corner, Inside/Outside Casing, Sill, Board, Wall Inset, Sunshade e Masonry Arch. [DOC AC18 Appendix_Tools-56 a -74]

### 2.3 Nomes em português (biblioteca INT / BRA)

| Inglês | PT-BR (ajuda oficial) | Observação |
|---|---|---|
| Nominal Sizes and Tolerance | Tamanhos Nominais e Tolerância | |
| Shape | Forma | |
| Settings and Opening | Definições de Porta/Janela e Abertura | na janela, “Window Settings and Opening” |
| Frame and Sash | Batente e Caixilho | |
| Frame Widths | Larguras dos Batentes | |
| Sash Type/Sash Options | Tipo de Caixilho/Opções de Caixilho | |
| Opening Type and Angle | Tipo de Abertura e Ângulo | |
| Wall Opening | Abertura da Parede | |
| Reveal Settings | Definições do Requadro | “gola” em POR |
| Wall Closure | Fechamento da Parede | |
| Wall Inset | Recorte na Parede | |
| Masonry Arch | Arco de Alvenaria | |
| Threshold | Soleira | |
| Sill | Soleira/Peitoril | peitoril externo |
| Board | Peitoril Interno / Bordo | tábua interna |
| Casing | Guarnição / Alizar / Aro | |
| Sunshade | Toldo / Pára-Sol | brise |
| Custom Corner | Personalizar Canto / Canto Personalizado | |

Fonte dos nomes: [DOC AC28/BRA 151-1..31] e [DOC AC28/POR 151-1].

---

## 3. Dimensões nominais, tolerâncias e vão

**Página:** Nominal Sizes and Tolerance (Tamanhos Nominais e Tolerância). [DOC AC28 151-2; AC24 141-2; AC18 57]

| Campo | O que faz | Valores/opções | Padrão | Onde |
|---|---|---|---|---|
| **Wallhole Dimensions** | Furo bruto na parede | largura = Unit + tolerâncias laterais; altura = Unit + tolerância superior | — | Nominal Sizes |
| **Unit Dimensions** | Tamanho do conjunto (moldura + folhas) | largura/altura totais | — | Nominal Sizes |
| **Egress Dimensions** | Dimensão de passagem/escape | largura do Unit menos a largura do batente | — | Nominal Sizes (AC24/AC28) |
| **Leaf Dimensions** | Dimensão da folha | medida da folha | — | Nominal Sizes (AC24/AC28) |
| **Set as Nominal** | Escolhe qual definição é a nominal | Wallhole / Unit / Egress / Leaf | Unit (implícito) | Nominal Sizes |
| **Transfer Current Nominal Size to Selection** | Ao trocar a definição, transfere o valor antigo para a nova e reajusta as demais | on/off | off | Nominal Sizes |
| **Show Dimensions in Marker** | Dimensão exibida no marcador | Wallhole / Unit / Leaf / Egress | — | Nominal Sizes + Marker Symbol and Text > Content-Dimensions |
| **Uniform Tolerances** | Uma tolerância para todos os lados + tolerância superior | on/off | on | Nominal Sizes |
| **Tolerances** (página) | Tolerâncias laterais e superior individuais | valores por lado | uniforme | Tolerances [DOC AC28 151-20] |
| **Oversize** (página Wall Opening) | Aumenta o furo à esquerda/direita/acima/abaixo | valores em mm/m | 0 | Wall Opening [DOC AC28 151-15] |

**Regra importante:** a tolerância entra no cálculo da **Nominal Size** (Wallhole = Unit + tolerância); o **Oversize** aumenta o furo **sem** alterar a nominal. A própria ajuda alerta para não confundir os dois. [DOC AC28 151-2 e 151-15]

**Dependência:** o furo (wallhole) é o recorte real na parede; a moldura é posicionada dentro do Unit; a folha dentro da moldura; o vidro dentro da folha. O Reveal Depth define quanto o conjunto entra na parede; a âncora (face/núcleo) define de onde essa profundidade é medida. [DOC AC28 150-16; 151-15/16; 040-312]

---

## 4. Forma, folhas, caixilhos e bandeira

### 4.1 Shape (Forma)

**Página:** Shape. [DOC AC28 151-3; AC18 59; AC17 56]

A ajuda atual é deliberadamente curta: “define the configuration of door leaves/window panes and their divisions” e, conforme a janela, permite **adicionar bandeiras (transoms) e opções**. Os controles concretos são desenhados no script de interface do objeto — não há uma lista universal. [DOC AC28 151-3]

O que se pode afirmar com segurança:

| Aspecto | Como o ArchiCAD trata | Fonte |
|---|---|---|
| Quantidade de folhas/painéis | Vem da **variante de biblioteca** e das caixas de composição da página Shape; não é um único campo “nº de folhas” na Basic Window | [DOC AC28 151-3] + [FÓRUM community “specific type of window”] |
| Bandeira (transom) | É uma divisão horizontal com **sash próprio**, editável em Sash Options e Opening Type. A página Shape liga/desliga e posiciona | [DOC AC28 151-3/13] + [FÓRUM] |
| Luz lateral (sidelight) | Componente separado, com tipo de abertura e sentido próprios (“Same as Leaf” / “Opposite to Leaf”) | [DOC AC28 151-13; 151-22] |
| Formas não retangulares (arco, segmento, trapézio, octógono) | Não são um campo da Basic Window; a biblioteca INT traz **objetos próprios** (ex.: “W Arched Cas”, segmentados) e parâmetros de altura de ombro/raio | [DOC AC18 59] + [FÓRUM community “Segmental Arched Transom”] + [INFERIDO] |
| Multi-sash | Variantes “Horizontal Multi-Sash Window” / “Vertical Multi-Sash Window” têm nº de panes e “Multiply Units” | [FÓRUM community “window parameters in AC19”] |

### 4.2 Sash Type / Sash Options (Tipo de Caixilho / Opções)

**Página:** Sash Type/Sash Options. [DOC AC28 151-10; AC18 62; AC17 59]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Seleção da folha/bandeira** | Escolhe qual sash está sendo editado | pop-up “Sash 1”, “Sash 2”, “Transom”… | topo da página |
| **Uniform Sashes** | Aplica o mesmo tipo a todas as folhas | on/off | topo |
| **Sash Type / pattern of mullions** | Padrão de divisão do vidro | No Mullions/Fixed; H-V Grid; **Editable Grid** (H-V Grid Custom); Prairie (Simple/Detailed); Custom Panel; Divided Sash (porta) | página |
| **Panes horizontally / vertically** | Nº de panes na horizontal e na vertical | inteiros | após escolher a grade |
| **Parâmetros da grade** | Largura/espessura dos montantes, proporção, divisão | valores | página |
| **Position** | Onde a grade fica | Inside / Outside / **Throughout** (atravessa os dois lados) | página |
| **Custom Panel** | Usa um painel GDL criado pelo usuário | nome do objeto | página |
| **Editable Grid** | Divisões editáveis por hotspots no projeto | — | nota da página |

**Sobre a lista exata:** a documentação atual não enumera todos os padrões; nomeia explicitamente `Editable Grid` e `Custom Panel` e mostra a galeria de padrões. A lista de seis valores abaixo vem da documentação oficial antiga da biblioteca Special Edition (AC9), útil como referência histórica, mas **não é garantida para a INT atual**: No Mullions, H-V Grid, H-V Grid Custom, Simple Prairie, Detailed Prairie, Custom Panel. [DOC antigo AC9 SE Illustrated Windows §5.3] Em AC18 aparece ainda `Divided Sash` para portas; a comunidade registra que ele **não está disponível para janelas**. [DOC AC18 62] + [FÓRUM community “specific type of window”]

### 4.3 Contagem e composição de folhas — o que depende do quê

- A **geometria externa** (Unit) é fixa: largura × altura. As folhas são repartidas dentro dela.
- O **tipo de caixilho** (sash type) não muda o número de folhas; muda a divisão interna do vidro.
- A **quantidade de folhas** é decidida na Shape/variante. Em geral: Basic Window = 1 folha (com opção de luz lateral/bandeira); variantes “Double Sash”, “Triple”, “Multi-Sash”, “Sliding” etc. trazem 2, 3 ou n folhas.
- A **bandeira** é uma folha adicional acima, com sash e opening type próprios; a **luz lateral** é uma folha adicional ao lado, com sentido “Same as Leaf” ou “Opposite to Leaf”.
- O **ganging** não muda a geometria das folhas; só suprime linhas de encontro entre aberturas vizinhas. [DOC AC28 151-22]

**[INFERIDO]** Para o nosso editor, isso sugere modelar `leafCount` e `transom` como decisões de **família/tipo**, e `sashType`/`grid` como subdivisões da folha — não tentar reproduzir a árvore GDL inteira.

---

## 5. Tipo de abertura e ângulos

**Página:** Opening Type and Angle (Tipo de Abertura e Ângulo). [DOC AC28 151-13; AC18 63; AC17 60]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Opening Type** | Tipo de abertura **por componente** (folha, luz lateral, bandeira) | pop-up dependente do objeto | página |
| **2D Opening Angle** | Ângulo desenhado no símbolo 2D | graus | página |
| **3D Opening Angle** | Ângulo de abertura no 3D | graus | página |
| **Sidelight/Transom: Opening Direction** | Sentido da luz lateral/bandeira em relação à folha | Same as Leaf / Opposite to Leaf | página |
| **Sidelight/Transom: Opening Type** | Tipo próprio da luz lateral/bandeira | pop-up | página |
| **3D Opening Angle/Distance** | Ângulo (ou distância, se correr) | graus / distância | página |
| **Editable hotspots** | Ajuste gráfico do ângulo no projeto | — | nota |

**Tipos que a biblioteca expõe (nomes confirmados):** `Fixed Glass`, `Fixed Sash`, `Side Hung`, `Side Hung Mirrored`, `Tilt and Turn`. [FÓRUM community “Window Schedule”, parâmetro `stOpeningType`] A documentação de portas confirma `Double-Acting` e `Side Hung`; [DOC AC18 41] as variantes de janela acrescentam, pelos nomes dos objetos e pelos catálogos: casement (side hung), awning/top hung, double hung (guilhotina), sliding (correr), pivot (pivotante), hopper/bottom hung (basculante inferior) e combinações tilt-and-turn. [FÓRUM/LOJA: catálogos e discussões; DOC AC9 SE §5.3 para “double hung”]

**Mapeamento prudente para o nosso vocabulário:**

| Nosso termo | Nome provável no ArchiCAD | Ressalva |
|---|---|---|
| Fixa | Fixed Glass / Fixed Sash | “Glass” = só vidro; “Sash” = caixilho fixo |
| Giro / maxim-ar | Side Hung / Side Hung Mirrored | “Side Hung” é eixo vertical; não confundir com “maxim-ar” brasileiro, que costuma ser top-hung |
| Maxim-ar (top-hung) | Awning / Top Hung | o nome varia com a biblioteca |
| Basculante | Hopper / Bottom Hung / Tilt | “Tilt and Turn” é o sistema duplo |
| Giro-basculante | Tilt and Turn | um sash, dois modos |
| Correr | Sliding | usa distância, não ângulo |
| Guilhotina | Double Hung | duas folhas verticais |
| Pivotante | Pivot | eixo horizontal ou vertical |
| Fixa + bandeira | Fixed + Transom | bandeira é componente separado |

**Atenção:** a lista de opções do pop-up **não é global**; cada objeto da biblioteca oferece o subconjunto que seu script suporta. A própria ajuda diz “available settings depend on the library part”. [DOC AC28 151-13]

---

## 6. Moldura, caixilho e vidro

### 6.1 Frame and Sash (Batente e Caixilho) — janela

**Página:** Frame and Sash. [DOC AC28 151-11; AC18 60; AC17 57]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Frame Element Joinery** | Tipo de junta dos cantos | **Mitered** / **Butt Joint** | página |
| **Uniform Frame Width** | Uma largura de batente para todo o perímetro | on/off | página |
| **Frame width** | Largura visível do batente | medida | página |
| **Frame thickness** | Espessura/profundidade do batente | medida | página |
| **Sash width/thickness** | Dimensões do caixilho da folha | medidas | página |
| **Glass thickness** | Espessura do vidro | medida | página (Frame and Sash / Leaf and Sash Dimension) |
| **Set Frame Widths** | Vai para a página de larguras por lado | botão | página |

**Frame Widths (Larguras dos Batentes):** com `Uniform Frame Width` ligado, um único valor; desligado, valores independentes para cada lado (esquerda, direita, superior, inferior), necessário para janelas de forma complexa. [DOC AC28 151-12; AC18 61]

### 6.2 Estilos de moldura

- Nas **portas**, a página Frame Style and Dimensions oferece **três estilos**; o mais simples chama-se **Block** e é forçado quando o tipo de abertura é “double-egress”. [DOC AC28 151-5]
- Nas **janelas**, a documentação da Basic Window **não mostra** um pop-up “Frame Style”; mostra junta, largura e espessura. [DOC AC28 151-11]
- Os nomes dos outros dois estilos de porta **NÃO CONFIRMADOS** (a ajuda só nomeia Block).
- Para portas, `Frame Thickness = Wall Thickness` iguala batente e parede; `Uniform Frame Thickness` só fica disponível nesse caso e se todas as folhas abrirem no mesmo sentido. [DOC AC28 151-5]

### 6.3 Vidro

| Aspecto | Como aparece | Fonte |
|---|---|---|
| Espessura | `Glass Thickness` no caixilho/folha | [DOC AC28 151-11; 151-9] |
| Material/superfície | Atributos do vidro (surface material) e pente 3D | [DOC AC28 151-14; AC18 62] |
| Painéis | O nº de panes vem do Sash Type; o vidro é uma peça por pane | [DOC AC28 151-10] |
| Vidro duplo | Representação 2D “Full – Double Glazing” (linha dupla), não um campo de composição | [DOC AC28 140-40; AC29 LU2 release note] |
| Elevação | O vidro é representado como **forma sólida**; não é transparente em elevação | [DOC AC28 040-305] |
| Curvas | `Curve Resolution` divide componentes curvos em segmentos; aumenta o arquivo | [DOC AC28 151-14] |

**Não confundir:** “Glass Thickness” é geometria; “Glass Material/Surface” é atributo; “Double Glazing” é detalhe de desenho. O ArchiCAD não tem, na Basic Window, um campo “tipo de vidro” (laminado, temperado, low-e) — isso é material/classificação ou parâmetro de biblioteca específica. **NÃO CONFIRMADO** para todas as variantes.
