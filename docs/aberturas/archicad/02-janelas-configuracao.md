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
12. **Wall Inset** é o recorte abaixo da janela (radiador): automático, simétrico ou assimétrico, com elevação de base, profundidade e linha de parapeito oculto em 2D. **Masonry Arch** acrescenta arco de alvenaria (tijolo ou estuque), com estilo, rise, keystone, nicho e transpasse.
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
| Giro (eixo vertical) | Side Hung / Side Hung Mirrored | “Side Hung” é eixo vertical; não confundir com “maxim-ar” brasileiro |
| Maxim-ar (top-hung) | Awning / Top Hung | o nome varia com a biblioteca; abre pelo topo, para fora |
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

---

## 7. Abertura na parede: reveal, assentamento e âncora

### 7.1 Wall Opening (Abertura da Parede)

**Página:** Wall Opening. [DOC AC28 151-15]

| Campo | O que faz | Valores/opções | Padrão | Onde |
|---|---|---|---|---|
| **Reveal Type** | Tipo de requadro/assentamento | lista de tipos + opções “No Reveal” | depende da biblioteca | Wall Opening |
| **Reveal Depth** | Profundidade do requadro (quanto a janela entra na parede) | medida | — | Wall Opening, Reveal, Preview and Positioning |
| **Wall Closure** | Fechamento das camadas da parede composta | predefined / custom / No Closure | No Closure | Wall Opening |
| **Masonry Arch** | Liga o arco de alvenaria | on/off + tipo | off | Wall Opening |
| **Opening Oversizes** | Aumenta o furo à esquerda, direita, acima e abaixo | medidas | 0 | Wall Opening |
| **Wall Opening Surface** | Superfície aplicada às paredes do vão | **Same as Wall Edge** / **Same as Wall Side** | — | Wall Opening |

**Wall Opening Surface — o que muda:**

- `Same as Wall Edge`: a superfície da **borda** da parede é aplicada às paredes do vão.
- `Same as Wall Side`: as superfícies **externa e interna** da parede são aplicadas às paredes do vão, com o **Reveal Depth como linha de divisão** entre elas.
- Em parede curva, a divisão entre as duas superfícies pode ser reta ou em arco (`Hole Surface’s Split is Curved`). [DOC AC28 151-15/21]

### 7.2 Reveal Settings (Definições do Requadro)

**Página:** Reveal Settings. [DOC AC28 151-16; AC18 65; AC17 62]

| Campo | O que faz | Onde |
|---|---|---|
| **Reveal Type** | Escolhe o tipo construtivo do requadro | Reveal |
| **Head dimension** | Dimensão do requadro no topo (verga) | Reveal |
| **Jamb dimension** | Dimensão do requadro nas laterais (ombreiras) | Reveal |
| **Reveal Depth** | Profundidade; é o mesmo valor do Preview and Positioning | Reveal |

A página só entrega tipo + dimensões de cabeça/ombreira + profundidade. **Não há**, na janela padrão, campos separados para “recuo superior”, “recuo inferior” e “recuo lateral” — o controle fino é feito pelo tipo de reveal e pelo `Reveal Depth`. [DOC AC28 151-16]

### 7.3 Anchor Reveal (âncora do requadro)

O Reveal pode ser ancorado em:

- **Wall Face** — face da parede (superfície acabada);
- **Wall Core** — núcleo (a camada estrutural mais próxima, se houver várias).

**Efeito prático:** ancorar no núcleo mantém a janela alinhada quando a espessura do acabamento muda (por exemplo, isolamento mais grosso) e alinha aberturas em paredes compostas que só diferem no revestimento. Se a parede deixar de ter núcleo, a âncora volta automaticamente para “Wall Face” e a profundidade é recalculada para manter a posição. [DOC AC28 040-312]

**Relação com o nosso DEC-1:** o ArchiCAD permite ancorar no núcleo ou na face; o Hestia limita o batente ao núcleo. Não são a mesma decisão: aqui a âncora é uma **referência de posicionamento**, não um limite de profundidade. [INFERIDO]

### 7.4 Assentamento externo (lado de fora)

- O ícone de **sol** e a linha grossa, durante a colocação, indicam o lado **externo** (reveal side); mover o cursor para o lado oposto da parede troca o lado. [DOC AC28 040-306]
- O `Flip` troca o sentido de abertura mantendo a moldura no lugar. [DOC AC28 150-16]
- Em parede inclinada, `Opening Plane` decide se a janela acompanha o plano da parede (`Associated to Wall`) ou fica vertical (`Vertical`). Em parede de perfil complexo, a inclinação vem da `Opening Reference Layer` do perfil. [DOC AC28 040-309]

### 7.5 Parede curva, poligonal e inclinada

| Situação | Comportamento | Fonte |
|---|---|---|
| Parede curva | A janela acompanha a curvatura; o vão é recortado na parede curva; superfícies do vão podem dividir-se em arco | [DOC AC28 040-315; 151-21] |
| Parede poligonal | O `Board` pode seguir o polígono da parede ou ficar paralelo à janela | [DOC AC28 151-25] |
| Parede inclinada | `Opening Plane` = Associated to Wall ou Vertical | [DOC AC28 040-309] |
| Parede de perfil complexo | A inclinação é definida no Profile Manager pela Opening Reference Layer | [DOC AC28 040-309] |

---

## 8. Fechamento da parede (Wall Closure) e alizar (Casing)

### 8.1 Wall Closure (Fechamento da Parede)

**Página:** Wall Closure. [DOC AC28 151-17; AC18 66; AC17 63]

Só é relevante em **parede composta**. A ajuda é explícita: “these settings only affect the display of openings in 2D views”; o Turn Plaster também aparece em corte/elevação e, se `Show in 3D` estiver ligado, no 3D. [DOC AC28 151-17]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Closure Type** | Tipo de fechamento | No Closure; tipos predefinidos; Custom Closure | Wall Closure |
| **Turn Skin on Side** | Em que lados as camadas viram para dentro | Left / Right / Both | Wall Closure |
| **Number of Skins to Turn** | Quantas camadas viram | inteiro | Wall Closure |
| **Number from** | De onde a contagem começa | Outside face / Inside face | Wall Closure |
| **Profile Width** | Largura do elemento de fechamento pré-fabricado (cavity closure) | medida | Wall Closure |
| **Insulation Strip** | Faixa de isolamento no fechamento | on/off + espessura | Wall Closure |
| **Turn Plaster** | Faz o reboco virar no vão | Automatically / número de camadas | Wall Closure |
| **Plaster Skin Definition** | Define o que é “reboco” | Use Wall Finish Component / Plaster Thickness Limit | Wall Closure |
| **Custom Closure** | Fechamento por camada | Select Skin to Edit: Left jamb / Right jamb / Both; escolha da skin; Turn-in Skin; thickness; hatch orientation; separating line pen; Consider Skin as Plaster | Wall Closure |

**Tipos de fechamento predefinidos (AC17 New Features, histórico):** Variable Cavity Closure, Plaster Reveal, Insulated Reveal, Insulation Closure for Renovation, Finish Closure, Air Space Closure. A lista atual pode variar; a ajuda do AC28 só diz “predefined or custom”. [DOC AC17 NewFeatures-43] + [DOC AC28 151-17]

### 8.2 Turn Plaster — posição em relação à espessura e ao acabamento

Regras que importam para o nosso mapeamento:

1. O `Turn Plaster` vira a camada de reboco **para fora do contorno da parede** definido no Reveal. [DOC AC28 151-17]
2. `Use Wall Finish Component` considera reboco a camada marcada como **Finish** na parede composta; `Plaster Thickness Limit` considera reboco toda camada até uma espessura limite (ex.: 40 mm). [DOC AC28 151-17]
3. Com reboco virado como “plaster skin”, a **profundidade do jamb é medida na camada resistente** e a largura nominal do reveal pode ficar **maior** que a medida entre as faces de reboco. Sem `Consider Skin as Plaster`, a camada é envolvida como fechamento comum e a largura nominal coincide com a medida entre as camadas envolvidas. [DOC AC28 151-17; AC18 66 — exemplo de 60 mm de jamb e 780 mm nominais]
4. `Turn Plaster` e `Casing` **não podem coexistir** no mesmo lado; se o Turn Plaster estiver cinza, desligue o Casing interno/externo. [DOC AC28 151-17/26]
5. O número de camadas pode ser contado a partir da **face externa** ou da **face interna**; a escolha muda o resultado em paredes com acabamentos diferentes. [DOC AC28 151-17]

### 8.3 Casing Outside/Inside (Alizar externo/interno)

**Páginas:** Casing Outside / Casing Inside. [DOC AC28 151-26; AC18 68/69]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Outside Casing / Inside Casing** | Liga o alizar no lado externo/interno | on/off | Casing Outside/Inside |
| **Casing parameters** | Largura, espessura, offset, overhang, material | medidas/atributos | Casing Outside/Inside |
| **Casing below Sill** | Acrescenta alizar abaixo do peitoril | on/off (só se houver sill) | Casing Inside (AC18) |
| **Attributes** | Fill, material e pen do alizar | atributos | subpágina Attributes |

**Posição:** o alizar é aplicado na **face** da parede (interna ou externa), em volta do vão; a espessura do alizar acrescenta ao volume, mas não altera o furo. Nas pré-visualizações, a espessura da parede é usada para mostrar o alizar no contexto. [DOC AC28 040-307]

**Relação com o acabamento:** como o Casing é aplicado na face, ele cobre a junta entre moldura e parede; é a alternativa ao `Turn Plaster`, que faz o acabamento entrar no vão. O ArchiCAD trata os dois como **exclusivos**. [DOC AC28 151-17/26]

**Não confundir:** `Casing` (alizar/guarnição) não é `Wall Closure` (fechamento das camadas). O primeiro é uma peça de acabamento; o segundo é a continuação das camadas da parede dentro do vão. [INFERIDO a partir das definições]

---

## 9. Peitoril, tábua interna, soleira e pingadeira

### 9.1 Sill (peitoril externo)

**Página:** Sill Settings. [DOC AC28 151-24; AC18 70]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Sill** | Liga o peitoril | on/off | Sill |
| **Sill Type** | Tipo de peitoril | pop-up dependente da biblioteca | Sill |
| **3D Detail** | Nível de detalhe do peitoril no 3D | **Simple** / **Detailed** | Sill |
| **Thickness** | Espessura | medida | Sill |
| **Width** | Largura | medida | Sill |
| **Angle** | Inclinação/queda | graus | Sill |
| **Nosing** | Nariz/saliência frontal | medida | Sill |
| **Slip in Depth** | Quanto o peitoril entra sob a moldura; **máximo = espessura da moldura**; soma-se à Sill Width | medida | Sill |
| **Sill Oversize** (AC18) | Faz a altura do peitoril incluir a espessura; se desligado, vai só até a base | on/off | Sill (AC18) |
| **Is Curved in Curved Walls** | Curva o peitoril em parede curva | on/off | Sill |
| **Attributes** | Fill, material, pen | atributos | subpágina |

**Pingadeira:** não há campo “drip” separado; o efeito de pingadeira é obtido pelo **nosing** + **angle** do tipo de sill. **NÃO CONFIRMADO** como peça independente — na Basic Window não achei um controle com esse nome. [INFERIDO]

### 9.2 Board (tábua/peitoril interno)

**Página:** Board Settings. [DOC AC28 151-25; AC18 71]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Board** | Liga a tábua interna | on/off | Board |
| **Is Curved in Curved Walls** | Acompanha a parede curva | on/off | Board |
| **Board edge** | Em parede poligonal: segue o polígono ou fica paralelo à janela | **Parallel to Wall Polygon** / paralelo à janela | Board |
| **Attributes** | Fill, material, pen (visível em janelas de corte) | atributos | subpágina |

**Semântica:** no ArchiCAD, `Sill` é o peitoril **externo** (a pedra/soleira que joga água para fora) e `Board` é a **tábua interna** (o “peitoril” de dentro). A tradução PT-BR chama Board de “Peitoril Interno” ou “Bordo”. [DOC AC28/BRA 151-24/25] Isso é o inverso de alguns usos brasileiros; no nosso modelo, convém separar `sillExterno` e `boardInterno` para não herdar a ambiguidade.

### 9.3 Threshold (soleira de porta)

**Página:** Threshold. [DOC AC28 151-23]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Threshold Type** | Tipo de soleira | pop-up | Threshold |
| **Threshold Thickness** | Espessura | medida | Threshold |
| **Nosing / side overhangs** | Transpasse frontal e lateral (tipos “Extended”) | medidas | Threshold |

Só aparece em portas (e porta-balcão quando o objeto oferece). A `Sill` é de janela; `Threshold` é de porta. [DOC AC28 151-23/24]

### 9.4 Resumo semântico

| Termo nosso | Peça no ArchiCAD | Onde |
|---|---|---|
| Peitoril externo | `Sill` | Sill Settings |
| Peitoril interno / tábua | `Board` | Board Settings |
| Soleira de porta | `Threshold` | Threshold Settings |
| Pingadeira | `Nosing` + `Angle` do Sill | Sill Settings (sem peça separada) |
| Soleira saliente | `Sill` com nosing/width; ou `Threshold` estendido, em porta | Sill/Threshold |

---

## 10. Wall Inset (recorte abaixo da janela)

**Página:** Wall Inset (só janela). [DOC AC28 151-18; AC24 141-20]

Serve para criar um nicho/recorte abaixo da janela, por exemplo para radiador.

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Wall Inset Size** | Modo de dimensionamento | **Automatic** / **Symmetric** / **Asymmetric** | Wall Inset |
| **Automatic** | Largura do recorte = largura da janela | — | Wall Inset |
| **Symmetric** | Largura e altura fixas, centralizadas na janela | medidas | Wall Inset |
| **Asymmetric** | Transpasses diferentes à direita e à esquerda; altura única | medidas L/R + altura | Wall Inset |
| **Bottom elevation** | Base do recorte; 0 = até o piso | medida | Wall Inset |
| **Depth** | Profundidade do recorte | medida | Wall Inset |
| **Show Hidden Parapet on 2D** | Mostra a linha de parapeito em 2D mesmo quando escondida pela parede/janela | on/off | Wall Inset |

**Lógica:** o Wall Inset é um **segundo recorte** na parede, abaixo do vão principal. Ele não muda a Nominal Size da janela; é geometria de parede. O `Hidden Parapet` é só representação 2D. [DOC AC28 151-18]

---

## 11. Masonry Arch (arco de alvenaria)

**Página:** Masonry Arch. [DOC AC28 151-19; AC18 74]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Masonry Arch** | Liga o arco | on/off | Masonry Arch |
| **Style** | Estilo do arco | lista (ex.: Jack, arco pleno etc.) | Masonry Arch |
| **Rise** | Flecha do arco | medida | Masonry Arch |
| **Skewback angle** | Ângulo de arranque (estilos “Jack”) | graus | Masonry Arch |
| **Type** | Material do arco | **Stucco** / **Brick** | Masonry Arch |
| **Brick / Mortar thickness** | Dimensões dos tijolos e juntas (se Brick) | medidas | Masonry Arch |
| **Keystone** | Chave do arco | width / oversize / projection | Masonry Arch |
| **Arch height/depth** | Altura e profundidade do arco | medidas | Masonry Arch |
| **Rear Hold Depth** | Profundidade do vão atrás do arco | medida | Masonry Arch |
| **Arch projection** | Saliência horizontal do arco | medida | Masonry Arch |
| **Arch on Header** | Coloca o arco diretamente sobre a verga | on/off | Masonry Arch |
| **Distance arch–header** | Distância se não estiver sobre a verga | medida | Masonry Arch |
| **Niche below Arch** | Cria nicho sob o arco | on/off | Masonry Arch |
| **Horizontal Overhang L/R** | Transpasse horizontal do arco | medidas | Masonry Arch |

**Atributos:** a subpágina `Model Attributes of Wall Opening` permite superfícies/pens do arco; em parede curva, `Hole Surface’s Split is Curved` divide as superfícies do vão em arco. [DOC AC28 151-21]

**Custo:** a própria ajuda alerta que muitos arcos de tijolo aumentam significativamente o tamanho do modelo. [DOC AC28 151-19]

---

## 12. Sunshade (brise/toldo)

**Página:** Sunshade. [DOC AC28 151-27; AC18 73]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Sunshade** | Liga o brise | on/off | Sunshade |
| **Type** | Tipo de brise | pop-up | Sunshade |
| **Open in 3D** | Mostra as folhas móveis abertas no 3D | on/off | Sunshade |
| **3D Opening (Angle)** | Ângulo de abertura no 3D | graus | Sunshade |
| **2D Symbol** | Mostra o símbolo do brise em 2D | on/off; no AC18 não aparece em escalas < 1:100 | Sunshade |
| **Extra Frame** | Mostra o quadro do brise ao lado da janela no 3D | on/off | Sunshade |
| **Shutter Height** | Altura da folha | medida / **Automatic Shutter Height** | Sunshade |
| **Attributes** | Fill, material, pen | atributos | subpágina |

**Restrição:** não está disponível se a janela tiver **luz lateral elevada** (“raised sidelight”). [DOC AC28 151-27]

**Não confundir:** o Sunshade é acessório da janela (persiana/brise). O sombreamento solar do edifício (Solar Study, Sun) é outro assunto. [INFERIDO]

---

## 13. Equipamentos, ganging, espaço mínimo e puxadores

### 13.1 Fixtures and Fittings

**Página:** Fixtures and Fittings. [DOC AC28 151-22]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Casing Outside / Inside** | Liga alizares | on/off | Fixtures |
| **Ganging** | Alinha aberturas vizinhas na horizontal/vertical | on/off por lado | Fixtures |
| **Threshold / Sill / Board / Sunshade** | Liga e escolhe o acessório | on/off + pop-up | Fixtures |
| **Custom Corner** | Adiciona canto personalizado à janela | Right / Left | Fixtures |
| **Handles** | Puxadores (porta; em janela, conforme objeto) | on/off no MVO | Fixtures / MVO |

**Ganging:** é preciso marcar nos **dois** elementos vizinhos; as linhas de encontro (casing, sill, threshold) desaparecem e o conjunto parece uma peça única. Algumas opções ficam cinzas quando o ganging está ativo. [DOC AC28 151-22]

### 13.2 Minimal Space

**Página:** Minimal Space. [DOC AC28 151-30]

Define folgas mínimas de circulação/abertura ao lado da porta (e, conforme o objeto, da janela). A exibição em planta é controlada por Model View Options > Detail Level of Door and Window Symbols > **Minimal Space of Doors**, com pen, tipo de linha e fill. [DOC AC28 151-30; 140-40]

### 13.3 Puxadores e acessórios

- `Accessories in 3D` no MVO liga/desliga puxadores de porta e janela. [DOC AC28 140-40]
- Em portas, a página Handle and Kick Board define puxador por folha, `Uniform Handles`, altura, distância da borda e chapa de proteção (kick board). Em janelas, o puxador depende do objeto. [DOC AC28 151-8]
- O `Minimal Space` de objetos é um parâmetro separado; não confundir com a folga da janela. [DOC AC28 150-11]

---

## 14. Janela de canto (Corner Window)

### 14.1 Ferramenta própria

O ArchiCAD tem uma **ferramenta Corner Window** separada (na seção “More” da caixa de ferramentas, na versão INT). O diálogo é semelhante ao da janela comum e **não há um objeto de biblioteca específico**: a maioria das janelas da biblioteca padrão pode ser usada. [DOC AC28 040-316]

| Regra | Consequência | Fonte |
|---|---|---|
| Só em cantos de parede **reta** | não aceita parede de perfil, trapezoidal ou curva | [DOC AC28 040-316] |
| Um clique em qualquer ponto da parede | encaixa no canto mais próximo e cria uma **cópia espelhada** na parede adjacente | [DOC AC28 040-316] |
| Parâmetros e propriedades | a segunda janela é **idêntica** à primeira; ângulo e posição são ajustados automaticamente | [DOC AC28 040-316] |
| Um par por canto | não se coloca mais de um par no mesmo canto | [DOC AC28 040-316] |
| Ângulo entre paredes | não pode ser 0° nem 180° | [DOC AC28 040-316] |
| Esticar individualmente | permitido, sem quebrar o vínculo entre as duas | [DOC AC28 040-316] |
| Vira janela simples se | arrastar/mirror/rotacionar uma das duas; ângulo virar 0/180°; uma parede for elevada; parede conectada for apagada/arrastada | [DOC AC28 040-316] |

### 14.2 Custom Corner (para duas janelas comuns)

Quando não se usa a ferramenta Corner Window, duas janelas comuns podem ser unidas pelo **Custom Corner** (na página Fixtures and Fittings, marcar Right/Left). [DOC AC28 151-22/31]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Corner Connection Type** | Como as duas janelas se encontram | **Frame** (molduras se tocam) / **Corner Column** (coluna entre elas) / **Glass** (vidro entre as molduras) | Custom Corner |
| **Angle** | Ângulo entre as paredes | graus | Custom Corner |
| **Different Connecting Wall Thickness** | Permite espessuras diferentes nas duas paredes | on/off + espessuras | Custom Corner |

**Comparação (suporte oficial):**

| Aspecto | Corner Window tool | Duas janelas + Custom Corner |
|---|---|---|
| Tipo de elemento | reconhecido como “Corner Window” | duas “Windows” separadas |
| Automação | encaixa no canto e espelha | ajuste manual do ângulo |
| Flexibilidade | não aceita parede perfilada/inclinada | aceita perfilada, inclinada e dupla-inclinada |
| Assimetria | não é possível sobrescrever | cada lado é independente (ex.: fixa de um lado, correr do outro) |
| Quadro | uma linha | duas linhas (as duas janelas) |

Fonte: [DOC support “How to create corner windows in Archicad?”]

**Leitura para o nosso editor:** a ferramenta Corner Window é um **par vinculado** com geometria derivada; o Custom Corner é uma **relação entre duas instâncias independentes**. São dois modelos diferentes — não dá para representar os dois com um único campo “é canto”. [INFERIDO]

---

## 15. Claraboia / janela de telhado (Skylight)

### 15.1 Ferramenta e colocação

- Ferramenta **Skylight** própria, separada de Door/Window. [DOC AC28 150-20; 040-317]
- Só pode ser inserida em **Telhado (Roof)** ou **Shell**; é automaticamente incorporada ao elemento hospedeiro. Em telhado, ajusta-se à inclinação da água. [DOC AC28 040-317]
- Ao arrastar dentro de um Shell ou de uma água para outra, reposiciona-se e se ajusta automaticamente. [DOC AC28 040-318]
- Em telhado curvo, a opção `Skylights treat segments as curves` (nas Roof Settings) decide se a claraboia acompanha a curvatura ou se comporta como plano. [DOC AC28 040-318]

### 15.2 Skylight Settings

**Painel:** Skylight Preview and Positioning. [DOC AC28 150-20]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Width / Height** | Dimensões da claraboia | medidas | Preview and Positioning |
| **Constraint in Roof** | Como a claraboia se mantém quando o telhado muda | **Horizontal** (mantém posição em planta) / **Vertical** (mantém cota) | Preview and Positioning |
| **Sill or header height** | Altura do ponto de âncora | medida + referência: uma história ou a **Roof Pivot line** | Preview and Positioning |
| **Âncora (sill/header)** | Escolhe o ponto de referência no preview | hotspot no topo ou na base | Preview and Positioning |
| **Flip in Shell** | Inverte a orientação dentro do Shell (de “inside” para “outside” ou vice-versa) | botão | Preview and Positioning |
| **Mirror Library Part** | Espelha o objeto | on/off | Preview and Positioning |

**Painéis semelhantes aos da janela:** Skylight Settings, Floor Plan and Section, Dimension Marker e Marker Settings. O `Sill Height` do marcador pode considerar a diferença entre o nível da história e o peitoril, sem alterar a posição. [DOC AC28 150-20]

### 15.3 Representação em planta

- Por padrão, a claraboia é desenhada em planta por **projeção 3D**, não por símbolo. [DOC AC28 040-317; 150-20]
- Exceção: claraboias migradas de projetos antigos (AC14 ou anterior) podem usar representação **simbólica** por preferência legada. [DOC AC28 150-20]
- A exibição segue as configurações de `Floor Plan Display` (ex.: Show on Story) do **telhado/shell hospedeiro**. [DOC AC28 040-317]
- MVO tem painel próprio `Detail Level of Skylight Symbols` e opções de Construction Elements análogas às de portas/janelas. [DOC AC28 140-39/43]

### 15.4 “Roof window” x “Skylight”

O ArchiCAD não tem uma ferramenta “Roof Window” separada: janelas de telhado são **objetos de biblioteca** (ex.: “Sunlight Pivot Hung”) colocados com a ferramenta **Skylight**. A biblioteca pode oferecer modelos fixos, pivotantes, projetantes etc.; a mecânica de inserção e de representação é a da claraboia. [DOC AC28 150-20] + [FÓRUM: roteiro de telhado que usa “SUNLIGHT PIVOT HUNG 19” com a ferramenta Skylight] + [INFERIDO]

---

## 16. Porta-balcão (Terrace Door)

**Natureza:** no INT, a porta-balcão é normalmente um **objeto da biblioteca de janelas** (pasta “Terrace Doors”), colocado com a ferramenta **Window** e classificado como janela. Isso tem consequências práticas: ela aparece no quadro de janelas, não no de portas. [FÓRUM community “Reveal for Terrace Door”; “Balcony door & window reveal settings”]

| Aspecto | Comportamento | Fonte |
|---|---|---|
| Ferramenta | Window (não Door) | [FÓRUM] |
| Altura | folha vai até o piso; pode ter banda/fixed panel | [INFERIDO] |
| Peitoril | `Sill` disponível em Terrace Doors (novidade AC17) | [DOC AC17 NewFeatures-43] |
| Reveal | em muitos objetos fica **desabilitado** porque a janela tem peitoril e a porta não, e o reveal não consegue ter alturas diferentes dos dois lados | [FÓRUM] |
| Casing/closure | depende do objeto; alguns têm closure de cavidade, outros não | [FÓRUM] |
| Configuração | a mesma das janelas (Shape, Sash, Opening Type, Frame, etc.), com as abas que o objeto expõe | [DOC AC28 151-1] |

**Leitura para o nosso editor:** a porta-balcão não é uma família nova; é uma **janela de altura total** com soleira/limiar e, opcionalmente, bandeira. O nosso `door_swing`/`window_fixed` não cobre bem o caso; o mais próximo é uma janela de 1 ou 2 folhas com `sill = 0` e `threshold`. [INFERIDO]

---

## 17. Ventilação natural

**Página:** Natural Ventilation. [DOC AC28 151-6]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Natural Ventilation** | Liga o componente de ventilação | on/off | Natural Ventilation |
| **Position** | Onde fica o perfil de ventilação | **over Frame** / **over Glazing** | Natural Ventilation |
| **Profile height/width** | Dimensões do perfil de ventilação (por folha, se aplicável) | medidas | Natural Ventilation |
| **Fill attributes** | Atributos de preenchimento do perfil em corte | fill/pen | Floor Plan and Section |

**O que é:** é uma **peça física** (perfil) desenhada sobre a moldura ou sobre o vidro, com altura/largura próprias. Não é cálculo de vazão nem abertura operável; é representação construtiva do ventilador. [DOC AC28 151-6]

---

## 18. Representação 2D, elevação e 3D

### 18.1 Floor Plan Display

**Controle:** `Floor Plan Display`, no painel Floor Plan and Section. [DOC AC28 150-18; 040-308]

| Opção | O que mostra | Quando usar |
|---|---|---|
| **Symbolic** (padrão) | símbolo 2D do objeto, independente do modelo 3D | planta padrão |
| **Overhead All** | contorno do elemento com atributos de “overhead” | elementos acima do plano de corte |
| **Projected** | parte cortada do modelo 3D + parte não cortada (para baixo) | parede inclinada, visual mais realista |
| **Projected with Overhead** | parte cortada + parte acima do plano de corte + parte não cortada | parede inclinada com peças acima do corte |

**Ponto-chave:** `Symbolic` e `Projected` podem dar desenhos diferentes para a mesma janela. O Hestia hoje desenha sempre o símbolo simbólico; o ArchiCAD permite os dois. [DOC AC28 150-18] + [INFERIDO]

### 18.2 Atributos 2D: GDL x painel simplificado

Há dois caminhos:

1. **Atributos GDL** definidos na página Floor Plan and Section do Custom Settings (muitos parâmetros por componente: moldura, folha, vidro, grade, alizar, peitoril etc.).
2. **Atributos simplificados** do painel Floor Plan and Section do diálogo (cut/uncut/overhead lines e pens), com checkboxes `Override Object’s Line Types/Pens/Attributes`.

Se o objeto não tiver parâmetro GDL correspondente, o painel simplificado vale sempre. [DOC AC28 151-29]

**Wall Contour Lines:** liga/desliga as linhas de contorno do vão na parede, com opção de linha visível/oculta. [DOC AC28 151-29]

**Use Fills:** liga todos os fills do objeto; desligado, nenhum componente usa fill. [DOC AC28 151-29]

### 18.3 Linhas de abertura

**Versão AC24 (por elemento):** a página `Opening Lines (Door/Window)` permite sobrescrever o MVO só para aquela janela, com opções separadas para **2D Symbolic Display** e **3D Projections**, incluindo pen. Havia também uma página específica para luz lateral/bandeira. [DOC AC24 141-14/15]

**Versão AC28 (centralizado):** o controle é global em **Model View Options > Detail Level of Door and Window Symbols**:

- `Opening Line (Floor Plan)` e `Opening Line (Section/Elevation & 3D)`: liga/desliga, tipo de linha, símbolos (inclusive portas de correr).
- `Opening Line (Global)`: pens para todas as portas/janelas do projeto.
- `Line orientation`: **Hinges** ou **Handle** (afeta a direção da linha em corte/elevação/3D).
- `Arrow orientation` (AC30, via snippet): Opening / Closing / Adaptive.

Fonte: [DOC AC28 140-40; AC24 141-14/15; DOC support “How to make opening lines … dashed”]

**AC29 LU2:** passa a haver **5 tipos** de linha de abertura, atribuíveis por folha/sash; o padrão é Type 1 para portas e Type 3 para janelas. [DOC AC29 LU2 release note] Isso ainda não vale para AC28.

**O que a linha representa:** a “opening line” é a linha simbólica de abertura (dobradiça, correr, basculante etc.), não a junta física. Em 3D, pode ser desenhada no lado da abertura e no lado oposto, com tipos de linha distintos. [DOC AC28 140-40]

### 18.4 Nível de detalhe (LOD)

**Por elemento (AC24):**

| Campo | Valores | Efeito |
|---|---|---|
| **3D Detail Level** | By MVO / **Schematic** / **Simplified** / **Full** / **Off** | Off = só vão vazio |
| **2D Detail Level** | By MVO / **Scale Sensitive** / escala fixa (ex.: 1:200) / Off | Off = nenhum símbolo 2D |

Fonte: [DOC AC24 141-4]

**Por MVO:**

- `Object and Lamp Detail Level`: 2D Full/Medium/Low; corte/elevação/3D Full/Simplified/Schematic. [DOC AC28 140-42]
- `Detail Level of Door and Window Symbols`: níveis de símbolo de porta/janela; exemplos citados pelo suporte: `Full-Opened Leaf` (porta) e `Full-with Double Glazing Line` (janela). [DOC AC28 140-40; DOC support “How can I increase the detail level…”]
- `Detail Level of Skylight Symbols`: painel próprio. [DOC AC28 140-43]

### 18.5 Model Attributes (atributos 3D)

**Página:** Model Attributes of Door/Window Opening. [DOC AC28 151-14]

| Campo | O que faz |
|---|---|
| **Shadow** | Liga sombra do objeto no 3D |
| **Curve Resolution** | Nº de segmentos para componentes curvos; mais detalhe = mais arquivo |
| **Frame Element Joinery** | Mitered / Butt Joint |
| **Frame and Leaf (Sash) 3D Pen** | Pente das partes visíveis no 3D e nas projeções 3D da planta |
| **Surface materials** | Materiais por componente (folha, moldura, grade, vidro, puxador) |

**Model Attributes of Fixtures and Fittings:** materiais/pens de threshold, sill, casing, board e sunshade. [DOC AC28 151-28]

### 18.6 MVO — visibilidade global

**Construction Elements > Door/Window:** [DOC AC28 140-39]

| Opção | Efeito |
|---|---|
| **Show entire Door/Window** | desenha o símbolo completo em planta e corte/elevação |
| **with Marker** | acrescenta o marcador, se houver |
| **Show Opening Only** | mostra só o vão na parede, sem o objeto |
| **with Contours** | o vão mostra contornos em planta |
| **Hide on Floor Plan** | esconde objeto e vão em planta; em corte, só o vão |

**Skylight:** opções análogas (Show Entire / with Markers / Show Opening Only / Hide on Floor Plan). **Opening** (vão livre): Show with Symbol / Show Opening Only / Hide. [DOC AC28 140-39]

---

## 19. Lógica de modelagem (como o ArchiCAD constrói a peça)

### 19.1 Ordem de cálculo

1. **Parede hospedeira e lado externo.** A janela só existe dentro de uma parede; o lado de fora é escolhido na colocação (ícone de sol) e pode ser trocado por Tab/Flip. [DOC AC28 040-306]
2. **Dimensão nominal.** O usuário escolhe se a nominal é Wallhole, Unit, Egress ou Leaf; o valor nominal alimenta Width/Height do diálogo e o quadro. [DOC AC28 151-2]
3. **Furo bruto.** O Wallhole é Unit + tolerâncias laterais/superior. O Oversize, se usado, amplia o furo sem mexer na nominal. [DOC AC28 151-2/15]
4. **Recorte e reveal.** O furo é cortado; o Reveal Type + Reveal Depth posicionam o conjunto na espessura. A âncora (face/núcleo) define a referência. [DOC AC28 151-15/16; 040-312]
5. **Conjunto (Unit).** A moldura ocupa o perímetro; as folhas são repartidas conforme a Shape/variante; cada folha recebe sash type e subdivisões. [DOC AC28 151-3/10/11]
6. **Abertura.** O Opening Type de cada componente define a transformação da folha; os ângulos 2D e 3D são independentes; correr usa distância. [DOC AC28 151-13]
7. **Vidro e grades.** O vidro é uma peça por pane; a grade é posicionada dentro/fora/atravessando; a espessura do vidro e dos montantes é paramétrica. [DOC AC28 151-10/11]
8. **Fechamento da parede.** As camadas da parede composta viram para dentro do vão; o reboco pode virar para fora do contorno do reveal. [DOC AC28 151-17]
9. **Acabamentos.** Alizar nas faces; sill/board/threshold; wall inset como segundo recorte; arco de alvenaria acima; sunshade do lado externo. [DOC AC28 151-18..27]
10. **Representação.** O símbolo 2D é gerado pelo script GDL (ou projetado do 3D); as linhas de abertura vêm do MVO; o nível de detalhe filtra o que aparece. [DOC AC28 151-29; 150-18; 140-40]

### 19.2 Dependências (o que limita o quê)

| Dependência | Efeito | Fonte |
|---|---|---|
| Opening Type → Frame Style (porta) | certos tipos limitam os estilos de moldura; double-egress força Block | [DOC AC28 151-4/5] |
| Frame Thickness = Wall Thickness → Uniform Frame Thickness | só libera a espessura variável se o batente igualar a parede e todas as folhas abrirem no mesmo sentido | [DOC AC28 151-5] |
| Reveal Type → Closure Type | os tipos de fechamento disponíveis variam com o reveal | [DOC AC28 151-15/17] |
| Casing ↔ Turn Plaster | mutuamente exclusivos no mesmo lado | [DOC AC28 151-17/26] |
| Ganging → acessórios | suprime linhas de encontro e desabilita opções de sill/board/sunshade | [DOC AC28 151-22] |
| Raised sidelight → Sunshade | sunshade indisponível | [DOC AC28 151-27] |
| Corner Window ↔ par | qualquer edição que desfaça o canto transforma em janelas simples | [DOC AC28 040-316] |
| Skylight → Roof/Shell | não existe fora de telhado/shell; constraint muda com a geometria | [DOC AC28 040-317/319] |
| MVO → representação | o MVO pode esconder, simplificar ou trocar a linha de abertura de todas as janelas | [DOC AC28 140-39/40] |

### 19.3 Geometria: o que é “de verdade” e o que é desenho

- **Modelo 3D:** furo + moldura + folha + vidro + grades + acessórios (sill, board, casing, sunshade, arco). O vidro é sólido em elevação, mas transparente em renderização. [DOC AC28 040-305]
- **Símbolo 2D:** script GDL próprio; pode ser completamente diferente do 3D. `Symbolic` usa o símbolo; `Projected` deriva do 3D. [DOC AC28 150-18]
- **Linhas de abertura:** simbólicas, não geométricas; controladas por MVO (AC28) ou override por elemento (AC24). [DOC AC28 140-40; AC24 141-14]
- **Wall Closure / Turn Plaster:** afetam principalmente o desenho 2D; o Turn Plaster pode aparecer em corte/elevação e, com `Show in 3D`, no 3D. [DOC AC28 151-17]
- **Nominal x real:** a nominal é uma convenção de medição/quadro; o furo real é wallhole; o desenho pode usar tolerâncias e oversizes que não aparecem na nominal. [DOC AC28 151-2/15]

---

## 20. Leitura para o Hestia (o que vale parametrizar)

| Conceito do ArchiCAD | Tradução proposta no nosso modelo | Observação |
|---|---|---|
| Nominal Size (Wallhole/Unit/Egress/Leaf) | `nominalBasis` no tipo | precisamos de um campo para saber o que o Width/Height significa |
| Tolerance + Oversize | `tolerance`, `roughOversize` | já temos `roughOversize`; a tolerância é outra coisa |
| Shape / transom / sidelight | `leaves`, `transom`, `sidelight` | não tentar replicar a árvore GDL |
| Sash Type / panes / grid position | `grid` (H/V, panes, position) | o “Editable Grid” é hotspot, não paramétrico |
| Opening Type + 2D/3D angle | `operation`, `openAngle2D`, `openAngle3D` | correr usa distância |
| Frame width/thickness/joinery | `frameWidth`, `frameDepth`, `joinery` | já temos frameWidth/frameDepth |
| Glass thickness/material | `glassThickness`, `glassMaterial` | “double glazing” é representação |
| Reveal Type/Depth + anchor | `reveal`, `anchor` (face/core) | decidir se o nosso batente é limitado ao núcleo |
| Wall Closure / Turn Plaster | `wallClosure`, `turnPlaster` | conflita com casing |
| Casing in/out | `casing` | já temos casing |
| Sill / Board / Threshold | `sill`, `board`, `threshold` | separar externo/interno |
| Wall Inset | `wallInset` | recorte secundário |
| Masonry Arch | `masonryArch` | peça opcional |
| Sunshade | `sunshade` | brise |
| Corner Window / Custom Corner | `corner` (linked pair) ou `cornerConnection` | dois modelos distintos |
| Skylight | família/tipo próprio | host roof/shell |
| MVO / LOD / Symbolic x Projected | `detailLevel`, `planDisplay` | hoje só simbólico |

**Prioridade sugerida:** (1) nominalBasis; (2) transom/sidelight; (3) grid; (4) wall closure/turn plaster; (5) sill x board x threshold; (6) wall inset; (7) corner/skylight. [INFERIDO]

---

## 21. Checklist dos itens obrigatórios

| Item do pedido | Onde está coberto | Situação |
|---|---|---|
| (a) Lista completa de abas/painéis e conteúdo | §2, §3–§13 | Coberto para a Basic Window INT; a lista varia por objeto |
| (b) Folhas: quantidade, divisões, grade, formas | §4, §19 | Coberto; quantidade depende da variante |
| (c) Opening Type por folha, ângulos 2D/3D, tipos oferecidos | §5 | Coberto; lista exata por objeto é NÃO CONFIRMADA |
| (d) Moldura: larguras, profundidade, estilos | §6 | Coberto; nomes dos 3 estilos de porta NÃO CONFIRMADOS |
| (e) Vidro: espessura, tipos, painéis | §6.3 | Coberto; “tipo de vidro” não é campo da Basic Window |
| (f) Peitoril interno/externo, board, pingadeira, wall inset, masonry arch, sunshade | §9–§12 | Coberto |
| (g) Alizar interno e wall closure: posição na espessura/acabamento | §8 | Coberto em detalhe |
| (h) Assentamento/reveal e âncora, lado externo | §7 | Coberto |
| (i) Ventilação natural | §17 | Coberto |
| (j) Bandeira (transom) | §4.1, §5 | Coberto |
| (k) Linhas de abertura em planta/elevação/3D | §18.3 | Coberto; muda entre AC24 e AC28 |
| (l) Nível de detalhe 2D/3D | §18.4 | Coberto |

---

## 22. Fontes

### 22.1 Ajuda oficial AC28 (INT) — janela

Base: `https://help.graphisoft.com/AC/28/INT/_AC28_Help/`

| Página(s) | URL (modelo) | Tipo | Conteúdo |
|---|---|---|---|
| 151-1 a 151-31 | `151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-N.htm` | [DOC] | Todas as páginas do Custom Settings Panel da janela/porta: nominal, shape, general, frame, sash, opening type, model attributes, wall opening, reveal, closure, wall inset, masonry arch, tolerances, fixtures, threshold, sill, board, casing, sunshade, floor plan/section, minimal space, custom corner. Páginas 32–34 retornaram 404. |
| 150-10 a 150-21 | `150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-N.htm` | [DOC] | Object Tool (10–14), **Door/Window Tool Settings (15)**, Preview and Positioning (16), where to set parameters (17), Symbolic vs Projected (18), other panels/marker (19), **Skylight Tool Settings (20)**, dimension tool (21). |
| 040-305 a 040-319 | `040_ElementsVB/040_ElementsVB-N.htm` | [DOC] | Doors/Windows (305), placement (306), previews (307), floor plan display (308), slanted walls (309), sill/header (310), subfloor (311), anchor reveal (312), empty opening (313), moving (314), curved wall (315), **corner windows (316)**, **skylights (317–319)**. |
| 140-39 a 140-43 | `140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-N.htm` | [DOC] | MVO Construction Elements (39), **Detail Level of Door and Window Symbols (40)**, Elevator (41), Miscellaneous Library Parts (42), Detail Level of Skylight Symbols (43). |

### 22.2 Ajuda oficial AC24 (INT) — abas que o AC28 reorganizou

Base: `https://help.graphisoft.com/AC/24/INT/_AC24_Help/141_DoorWindowCustomSettings/`

| Página | URL | Tipo | Conteúdo |
|---|---|---|---|
| 1 | `141_DoorWindowCustomSettings-1.htm` | [DOC] | Índice completo das abas, incluindo Opening Lines. |
| 2 | `...-2.htm` | [DOC] | Nominal Sizes e tolerâncias. |
| 3 | `...-3.htm` | [DOC] | Shape. |
| 4 | `...-4.htm` | [DOC] | Settings and Opening + **Detail Level 2D/3D**. |
| 13 | `...-13.htm` | [DOC] | Opening Type and Angle. |
| 14 | `...-14.htm` | [DOC] | **Opening Lines (por elemento)**. |
| 15 | `...-15.htm` | [DOC] | Opening Lines — Sidelight/Transom. |
| 18 | `...-18.htm` | [DOC] | Reveal. |
| 20 | `...-20.htm` | [DOC] | **Wall Inset**. |
| 24 | `...-24.htm` | [DOC] | Fixtures and Fittings. |
| 25 | `...-25.htm` | [DOC] | Threshold. |
| 31 | `...-31.htm` | [DOC] | Floor Plan and Section. |

### 22.3 Ajuda oficial AC18 (INT) — hierarquia antiga rica em abas

Base: `https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/`

| Página(s) | URL (modelo) | Tipo | Conteúdo |
|---|---|---|---|
| 25–30 | `Appendix_Tools-N.htm` | [DOC] | Door/Window Tool Settings (26), estrutura do diálogo (27), Preview/Positioning (28), where to set (29), Symbolic vs Projected (30). |
| 41 | `Appendix_Tools-41.htm` | [DOC] | Opening Type and Angle de porta: `Double-Acting` / `Side Hung`. |
| 56–74 | `Appendix_Tools-N.htm` | [DOC] | **Graphical Interface Panel for a Window (56)**: Nominal (57), General (58), Shape (59), Frame and Sash (60), Frame Widths (61), Sash Options (62), Opening (63), **Opening Lines (64)**, Reveal (65), Wall Closure (66), Custom Corner (67), Inside Casing (68), Outside Casing (69), Sill (70), Board (71), **Wall Inset (72)**, Sunshade (73), Masonry Arch (74). |

### 22.4 Ajuda oficial AC17 (INT)

Base: `https://help.graphisoft.com/AC/17/INT/AC17Help/Appendix_Tools/`

| Página | URL | Tipo | Conteúdo |
|---|---|---|---|
| 43 | `Appendix_Tools-43.htm` | [DOC] | Wall Closure de porta (mesma lógica da janela). |
| 56 | `...-56.htm` | [DOC] | Shape. |
| 59 | `...-59.htm` | [DOC] | Sash Options. |
| 60 | `...-60.htm` | [DOC] | Opening. |
| 61 | `...-61.htm` | [DOC] | Opening Lines. |
| 63 | `...-63.htm` | [DOC] | Wall Closure. |
| 64 | `...-64.htm` | [DOC] | Custom Corner. |
| NewFeatures-43 | `../NewFeatures/NewFeatures-43.htm` | [DOC] | Tipos de closure predefinidos; sill em terrace doors; melhorias de documentação. |

### 22.5 Ajuda oficial AC26 (INT) — Elementos

Base: `https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/`

| Página | URL | Tipo | Conteúdo |
|---|---|---|---|
| 290 | `040_ElementsVB-290.htm` | [DOC] | Save 2D Symbols as Objects (contexto de componentes). |
| 305 | `...-305.htm` | [DOC] | Doors/Windows. |
| 316 | `...-316.htm` | [DOC] | Skylights. |
| 317 | `...-317.htm` | [DOC] | Placing/moving skylight. |
| 318 | `...-318.htm` | [DOC] | Skylight constraint relative to roof. |
| 319 | `...-319.htm` | [DOC] | Wall Ends (fim do intervalo de janelas). |

**Nota:** o intervalo 290–330 foi percorrido nos pontos com conteúdo de janela; as páginas 291–304 e 320–330 são objetos/componentes e wall ends, sem parâmetros novos de janela.

### 22.6 Português (oficial)

| URL | Tipo | Conteúdo |
|---|---|---|
| `https://help.graphisoft.com/AC/28/BRA/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-1.htm` | [DOC] | Índice PT-BR com todos os nomes de abas. |
| `https://help.graphisoft.com/AC/28/BRA/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-13.htm` | [DOC] | “Tipo de Abertura e Ângulo”, “luz lateral e bandeira”. |
| `https://help.graphisoft.com/AC/28/POR/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-1.htm` | [DOC] | Índice PT-PT; confirma “Reveal = Gola”, “Board = Bordo”, “Casing = Aro”. |

### 22.7 Apoio (comunidade, suporte, material antigo)

| URL | Tipo | Conteúdo |
|---|---|---|
| `https://community.graphisoft.com/t5/Getting-started/Get-to-Know-Doors-and-Windows/ta-p/303969` | [FÓRUM] | Tutorial de colocação; anchor, reveal, preview. Acesso direto 403; conteúdo lido por snippet de busca. |
| `https://community.graphisoft.com/t5/Project-data-BIM/Window-Schedule/td-p/385987` | [FÓRUM] | Parâmetro `stOpeningType` e nomes `Fixed Glass`, `Fixed Sash`, `Side Hung`, `Side Hung Mirrored`, `Tilt and Turn`. |
| `https://community.graphisoft.com/t5/Libraries-objects/specific-type-of-window-in-Archicad/td-p/695574` | [FÓRUM] | Shape checkboxes (operable/fixed/fixed glass); `Divided Frame` não disponível em janela. |
| `https://community.graphisoft.com/t5/Libraries-objects/Reveal-for-Terrace-Door/td-p/207762` | [FÓRUM] | Terrace door é objeto de janela; reveal desabilitado por alturas diferentes. |
| `https://community.graphisoft.com/t5/Libraries-objects/Balcony-door-amp-window-reveal-settings/td-p/669594` | [FÓRUM] | Porta-balcão classificada como Window; reveal limitado. |
| `https://community.graphisoft.com/t5/Libraries-objects/window-parameters-in-AC19/td-p/293733` | [FÓRUM] | Multi-Sash Window e “Multiply Units”. |
| `https://community.graphisoft.com/t5/Modeling/Segmental-Arched-Transom-or-Window/td-p/144897` | [FÓRUM] | Janelas em arco vêm de objetos próprios da biblioteca; `Curve resolution`. |
| `https://support.graphisoft.com/hc/en-us/articles/28855124123281-How-to-create-corner-windows-in-Archicad` | [DOC suporte] | Comparação Corner Window tool x duas janelas + Custom Corner. |
| `https://support.graphisoft.com/hc/en-us/articles/30483904951953-How-can-I-increase-the-detail-level-of-doors-and-windows-on-floor-plan` | [DOC suporte] | `Full-Opened Leaf`, `Full-with Double Glazing Line`. |
| `https://support.graphisoft.com/hc/en-us/articles/35602813633297-How-to-make-opening-lines-of-windows-and-doors-display-as-dashed-lines-in-elevations` | [DOC suporte] | AC28 centraliza linhas de abertura no MVO; versões antigas têm “Use MVO Settings”. |
| `https://support.graphisoft.com/hc/en-us/articles/22920168965137-How-to-remove-door-and-window-lines-in-3D` | [DOC suporte] | `Show Opening Line in 3D` no MVO. |
| `https://community.graphisoft.com/gowhw84577/attachments/gowhw84577/gs-insights/511/1/AC29%20LU2%20-%20Release%20Note.pdf` | [DOC] | 5 tipos de linha de abertura por sash; padrão Type 1 para portas e Type 3 para janelas; renomeações. |
| `https://gsdownloads.blob.core.windows.net/archive/ftp/techsupport/downloads/library_updates/documentation/AC9_SE_Illustrated_Windows.pdf` | [DOC antigo] | Lista histórica de Sash Style (No Mullions, H-V Grid, H-V Grid Custom, Prairie, Custom Panel), Sill/Stool/Apron. Texto lido por snippet de busca (o PDF bruto não é legível diretamente). **Não é a INT atual.** |
| `https://helpcenter.graphisoft.com/user-guide-chapter/85215/` | [DOC/índice] | Índice de páginas do Custom Settings, incluindo Opening Lines; acesso direto 403, TOC via snippet. |
| `https://community.graphisoft.com/t5/Graphisoft-Insights/Archicad-29-Library-Update-2-Available/ba-p/704217` | [FÓRUM] | Reorganização das abas de abertura e 5 tipos de linha. |

---

## 23. Lacunas (o que não foi possível confirmar)

1. **Lista exata e atual dos Sash Types.** A ajuda mostra a galeria, mas não enumera; a lista de seis valores é do material AC9 Special Edition, não da INT atual. Onde provavelmente está: GDL/UI do objeto Basic Window e o “ArchiCAD Library Reference” da versão instalada. **NÃO CONFIRMADO.**
2. **Nomes dos três estilos de moldura de porta.** Só `Block` é nomeado. Onde: UI do objeto de porta / biblioteca INT. **NÃO CONFIRMADO.**
3. **Lista exata de Opening Types por objeto.** Os nomes confirmados vêm de um parâmetro de quadro (`stOpeningType`) e de discussões; a ajuda só diz “depende do objeto”. Onde: lista de valores do parâmetro no GDL. **NÃO CONFIRMADO para todas as variantes.**
4. **Tipos de vidro (laminado, temperado, low-e, duplo).** A Basic Window expõe espessura/material e uma representação de vidro duplo; não há um campo “tipo de vidro”. Onde: parâmetros de biblioteca específicos ou materiais/classificação. **NÃO CONFIRMADO.**
5. **Controle de forma de janela em arco na Basic Window.** A documentação atual não mostra “shoulder/radius” na Basic Window; os arcos vêm de objetos próprios. Onde: objetos “W Arched/ Segmented” da biblioteca. **NÃO CONFIRMADO para a Basic Window.**
6. **Lista de Reveal Types e suas dimensões.** A página só diz que há tipos e parâmetros de head/jamb/depth; não enumera. Onde: UI do objeto. **NÃO CONFIRMADO.**
7. **Lista de Closure Types no AC28.** A lista de seis tipos é do AC17 New Features; a página atual só diz “predefined or custom”. **NÃO CONFIRMADO para AC28.**
8. **Lista de Sill Types e Board Types.** A página descreve campos comuns (thickness, width, angle, nosing, slip-in), mas não enumera os tipos. **NÃO CONFIRMADO.**
9. **Lista de estilos de Masonry Arch.** A página cita “Jack” e estilos com keystone, mas não dá a lista completa. **NÃO CONFIRMADO.**
10. **Lista de tipos de Sunshade.** A página diz que os controles variam com o tipo, sem enumerar. **NÃO CONFIRMADO.**
11. **Abas específicas da Corner Window.** A ajuda diz que o diálogo é “similar” ao da janela, mas não detalha quais abas somem/aparecem. **NÃO CONFIRMADO.**
12. **Lista completa de painéis da Skylight Settings.** A página descreve Preview/Positioning, Settings e Floor Plan/Marker; o conjunto exato de abas do objeto varia. **NÃO CONFIRMADO.**
13. **Comportamento da porta-balcão na INT atual.** A evidência é de fóruns e de versões antigas; o objeto pode ter mudado. **NÃO CONFIRMADO para AC28.**
14. **A página “Opening Lines” por elemento no AC28.** O AC24 tem; o AC28 não a lista no índice, e o suporte diz que o controle é centralizado no MVO. Não achei uma página AC28 que declare explicitamente a remoção. **NÃO CONFIRMADO.**
15. **Terminologia PT-BR de “maxim-ar” x “basculante”.** A ajuda usa “Side Hung”, “Top Hung”, “Tilt and Turn”; a tradução brasileira varia. Usei os nomes ingleses como âncora. **NÃO CONFIRMADO como tradução única.**
16. **Mapeamento IFC/Classification das janelas.** Não pesquisei as propriedades IFC do objeto; o painel Classification and Properties existe, mas os campos não foram lidos. **NÃO CONFIRMADO.**
17. **Cobertura integral dos intervalos AC18 25–75 e AC26 290–330.** Li as páginas com conteúdo de janela; a seção de portas (AC18 31–55) e páginas de objetos/wall ends (AC26 291–304, 320–330) não foram percorridas em detalhe. Onde: ajuda oficial, seção Door. **LACUNA DE COBERTURA, não de conteúdo de janela.**
18. **Valores padrão (defaults) de cada campo.** A ajuda raramente informa o default; na maioria dos casos só descreve o controle. **NÃO CONFIRMADO.**

---

## 24. Observações finais de uso

- Este dossiê descreve o **diálogo e a lógica**, não prescreve que o Hestia copie a árvore GDL. O valor está em: (a) separar nominal de furo; (b) separar folha de caixilho e de vidro; (c) separar peitoril externo de tábua interna; (d) tratar wall closure e alizar como alternativas; (e) tratar corner/skylight como ferramentas próprias.
- Onde a fonte é fórum, o dado foi marcado; onde a fonte é documentação antiga, também. Nenhuma lista foi inventada: o que não fechou está em §23.
- Para uma próxima rodada, os alvos mais rentáveis são: (1) abrir a UI de uma Basic Window INT e capturar as listas reais de Sash Type, Opening Type, Sill Type, Reveal Type e Closure Type; (2) ler o “ArchiCAD Library Reference” da versão; (3) testar uma janela em parede composta com `Turn Plaster` + `Casing` para fixar a geometria do encontro.
