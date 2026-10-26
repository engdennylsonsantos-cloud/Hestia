# D · Editor de portas e janelas: o melhor do Revit e do ArchiCAD

Data: 2026-10-26. Escopo: pesquisa e proposta, **sem alterar código do app**. Complementa [A-pesquisa](A-pesquisa.md) (representação), [B-estado-atual](B-estado-atual.md) e a decisão [0017](../decisoes/0017-portas-e-janelas.md). O protótipo navegável desta proposta é [prototipo-editor-esquadrias.html](prototipo-editor-esquadrias.html) (abrir no navegador; usa o CSS real do app).

**Como ler as marcações.** *[DOC]* = página oficial da Autodesk ou da Graphisoft lida nesta rodada (links na §9). *[FÓRUM]* = comunidade, tutorial ou blog. *[PROPOSTA]* = ideia nossa, sem equivalente confirmado. *[NÃO CONFIRMADO]* = não achei fonte; fica como pergunta.

## 1 · Resumo

- O **Revit tem a melhor colocação**: a porta aparece como pré-visualização sobre a parede, o **lado do cursor define o sentido** e o **Espaço inverte a dobradiça**; as cotas temporárias já aparecem antes do clique [DOC].
- O **ArchiCAD tem o melhor editor de tipo**: um diálogo único com biblioteca de miniaturas, pré-visualização em 5 modos, painéis recolhíveis (posicionamento, componentes, planta e corte, marcador, classificação) e **nível de detalhe 2D/3D por esquadria** [DOC].
- O Hestia já tem a base certa (família → tipo → instância, símbolo de planta por família, 3D, corte, elevação, quadro, IFC). O que falta é **experiência**: hoje a pré-visualização é um retângulo, o sentido não segue o cursor, o diálogo do tipo é uma lista longa de campos e o nível de detalhe é fixo.
- Recomendação: **cinco ondas** (§7). A onda 1 (colocação) e a 2 (diálogo do tipo) dão o ganho visível; as famílias novas (onda 4) são a maior fatia de trabalho.

## 2 · Como o Revit faz

### 2.1 Colocação (planta, corte, elevação ou 3D) [DOC]

1. Arquitetura › Porta; escolhe-se o tipo no seletor (ou **Carregar família**).
2. **Tag on Placement** (Etiquetar na colocação) na faixa; na barra de opções: orientação horizontal/vertical da etiqueta e **Leader**.
3. Ao passar o cursor sobre a parede aparece a **pré-visualização**:
   - **Espaço** inverte a mão (dobradiça, esquerda ↔ direita);
   - **o lado em que o cursor está em relação ao eixo da parede** inverte o sentido (*facing*): a documentação diz "mova o cursor para mais perto da borda interna ou externa da parede";
   - as **cotas temporárias** mostram a distância do eixo da porta ao eixo das paredes perpendiculares mais próximas (configurável).
4. Clique insere e corta a parede. Depois da inserção, **setas de inversão** (*flip controls*) e as cotas temporárias editáveis mudam mão e sentido; "Escolher novo hospedeiro" move a porta para outra parede.

*[NÃO CONFIRMADO]* A documentação não diz se a porta abre **para** o lado do cursor ou para o oposto. Tutoriais descrevem "para o lado do cursor"; o protótipo deixa isso como opção ("Abrir: p/ lado do cursor | p/ lado oposto").

### 2.2 Propriedades do tipo e da instância [DOC]

- **Tipo** (Door Type Properties): *Construction* (Wall Closure, Construction Type, **Function** interna/externa), *Materials* (Door Material, Frame Material), *Dimensions* (Thickness, Height, Width, **Rough Width/Height**, Trim Width, Trim Projection Ext/Int), *Identity Data* (Keynote, Model, Manufacturer, Type Comments, URL, Description, Assembly Code, **Type Mark**, **Fire Rating**, Cost, OmniClass), *Analytical* (U, R, SHGC, VLT) e *IFC* (**Operation**, ex.: SINGLE_SWING_LEFT).
- **Instância**: Sill Height, Head Height (não redimensionam), Mark (numeração automática), Phase Created/Demolished.
- A **representação** (arco de giro em planta, "elevation swing") vem de **linhas simbólicas dentro da família**, em subcategorias que se ligam e desligam em Visibilidade/Gráficos; a família nunca é "cortada" pelo plano de corte, o que gera o truque do modelo invisível [FÓRUM]. O nível de detalhe Grosso/Médio/Fino filtra geometria por vista [DOC: "About Family Visibility and Detail Level"].
- Parâmetros como Frame Width/Depth e Number of Panels **não** são de sistema: o autor da família os cria [DOC, conferido em A §3.1]. A decisão 0017 §9 já escolheu **não** copiar esse modelo de autoria.

## 3 · Como o ArchiCAD faz

### 3.1 Colocação [DOC]

- Só em parede. **Tab** alterna entre paredes sobrepostas.
- O **sol** e uma linha grossa marcam o **lado externo** (*reveal side*); **mover o cursor para o lado oposto** muda-o; Tab também alterna.
- **Anchor Point** (centro ou lado) escolhido no Info Box, com atalho, mesmo durante a colocação.
- O **sentido de abertura** é escolhido com o cursor: quatro setas (dentro/fora × direita/esquerda) mostram a prévia; o **segundo clique** confirma.
- **Flip** (Info Box ou diálogo) inverte o sentido mantendo o batente no lugar.

### 3.2 Diálogo de configuração [DOC]

Painéis recolhíveis, e a lista de bibliotecas à esquerda com **miniaturas** (imagem do usuário):

1. **Preview and Positioning**: largura/altura (*nominal size*); **sill/header medido de uma referência** escolhida; **Reveal** (profundidade do rebaixo) ancorado na **face ou no núcleo** da parede; Flip; Anchor; *Opening Plane* (parede inclinada); **5 modos de prévia** (símbolo 2D, linhas ocultas frontal, linhas ocultas axonométrica, 3D sombreado, imagem predefinida).
2. **Custom Settings** (depende da peça): estilo da **folha** e da **maçaneta** (miniaturas); **Opening Type por componente** (porta articulada: giro lateral ou vai-e-vem), com **ângulo 2D e 3D** separados (em correr vira distância) e *hotspots* editáveis; **bandeira lateral e superior** com direção "igual/oposta à folha"; **Frame Style** (3 estilos, "bloco" no vai-e-vem); **Natural Ventilation** (sobre a moldura ou sobre o vidro).
3. **Nível de detalhe (o trecho circulado na imagem)**: **3D** = *Por OVM* (opções de visualização do modelo), Esquemático, Simplificado, Completo ou Desligado; **2D** = *Sensível à escala*, escala fixa (ex.: 1:200) ou Desligado.
4. **Floor Plan and Section**: *Floor Plan Display* = **Simbólica**, **Projetada**, *Overhead All* ou **Projetada + elementos acima**; atributos 2D (linha, caneta, hachura) simples, ou os parâmetros GDL detalhados.
5. **Model View Options** (da vista, não do tipo): detalhe do símbolo de planta (ex.: "Folha aberta completa"), portas/janelas como completas, só contorno ou vão vazio, e *Opening Line* (planta e corte/elevação/3D).
6. **Dimension Marker**: marcador escolhido numa lista, **Subfloor Thickness** (soma ao peitoril mostrado no marcador sem mover a abertura).
7. **Classification and Properties**, e painel *Model* (superfície única), *Reveal* (só aberturas legadas).

## 4 · Comparativo

| Tema | Revit | ArchiCAD | Hestia hoje | Adotar |
|---|---|---|---|---|
| Pré-visualização ao colocar | símbolo completo + cotas | prévia do vão + setas de sentido | **retângulo** (`openingTool.ts:122`) | Revit |
| Sentido de abertura | **lado do cursor** | cursor + 2º clique | Tab inverte; opções fixas na paleta | Revit (cursor) + Tab como inversão |
| Dobradiça | **Espaço** | Flip | Espaço (já existe) | manter |
| Âncora de colocação | — | **centro/lado** | só centro | ArchiCAD |
| Captura | cotas aos eixos vizinhos | — | encosto, batente, centro de outra abertura | somar centro do trecho e folga da quina |
| Alças após inserir | **flip arrows** + cotas editáveis | Flip no Info Box | só checkbox na paleta | Revit |
| Etiqueta na colocação | **Tag on Placement** | marcador por tipo | etiqueta existe, sem opção | Revit |
| Biblioteca | Load Family (arquivo) | **miniaturas por categoria** | seletor + favoritos | ArchiCAD |
| Prévia no diálogo | uma vista | **5 modos** | 1 elevação (`TypePreview`) | ArchiCAD |
| Detalhe 2D/3D | por vista (Grosso/Médio/Fino) | **por esquadria e por vista** | fixo | ArchiCAD |
| Exibição em planta | símbolo na família | **Simbólica/Projetada** | só simbólica (0017 §8) | ArchiCAD |
| Ângulo de abertura | — | **2D e 3D separados** | 90° fixo | ArchiCAD |
| Dados BIM do tipo | **Fire, U, SHGC, Cost, IFC Operation** | classificação, propriedades | código, descrição | Revit |
| Autoria de família | parâmetros livres | GDL | **schema fechado** (0017 §9) | manter fechado |

## 5 · O que o Hestia já tem (e onde)

- Famílias: 10 em `packages/model/src/opening.ts:43-54`; símbolo de planta em `packages/geom/src/openingSymbol.ts`; 3D em `packages/render/src/model3d/openingParts.ts`; corte/elevação em `packages/render/src/section/build.ts`; quadro em `packages/engine/src/openingSchedule.ts`.
- Tipo: dimensões, família/folhas, retorno do vão, identidade, esquadria (perfil, profundidade, folha, vidro) e **acabamento** (folga, alizar, soleira, verga, contraverga) em `apps/web/src/ui/dialogs/OtherDialogs.tsx:55-232`; campos opcionais com padrão por leitura (`openingExtras.ts`), sem migração.
- Instância: `flipHand`, `flipFacing`, `sillOverride`, `mark` (`packages/model/src/types.ts`).
- Ferramenta: captura (`snapOffset`), posição digitada, favoritos; Espaço = dobradiça (`controller.ts:313`), Tab = sentido (`openingTool.ts:39`).
- 3D: botão "Abrir vãos" (`View3DSettings.openOpenings`).

**Lacunas** (nesta ordem de impacto): prévia sem símbolo; sentido não segue o cursor; sem cotas temporárias na colocação nem alças pós-inserção; diálogo sem agrupamento nem biblioteca; sem nível de detalhe por tipo/vista; sem ângulo de abertura; sem famílias de embutir, vai-e-vem, dobrável, sanfonada, seccionada, janela de abrir, guilhotina, pivotante, veneziana; sem dados de fogo/acústica/térmica; sem verificações no tipo.

## 6 · Proposta

### 6.1 Colocação (o que o protótipo demonstra)

| Entrada | Efeito |
|---|---|
| Cursor sobre a parede | pré-visualização com o **símbolo real** (folha + arco) e vão cortado; **zona de captura maior que a parede** (≈ 16 px; uma parede de 14 cm em 1:100 tem ~5 px) |
| Lado do cursor em relação ao eixo | define o **sentido**; com **histerese de 3 px** na linha de eixo, para não "tremer" |
| **Espaço** | inverte a dobradiça |
| **Tab** | inverte o sentido (por cima da regra do cursor) |
| Digitar `1,20` + **Enter** | posição exata ao início da parede (já existe) |
| Clique | insere; a ferramenta continua; **Esc** sai |
| Sol ☀ | marca o lado externo da fachada (ArchiCAD) |

Captura inteligente (liga/desliga): **centro do trecho** (entre paredes perpendiculares), **folga da quina** configurável (padrão 10 cm), encosto em outra abertura e **eixo alinhado**. As **cotas temporárias** (eixo ou face do batente) aparecem antes do clique; depois de inserir, o número é um campo editável, e **alças ⇅ ⇄** invertem sentido e dobradiça. Opções na faixa contextual: *Sentido* (cursor/manual), *Abrir* (para o lado do cursor/oposto), *Âncora* (centro/dobradiça/trinco), *Etiquetar na colocação*.

Detalhe de modelo: `openingFlipFacing` deixa de ser uma caixa solta; vira `facingMode: 'cursor' | 'fixed'` e `openToward`, e o `OpeningTool` calcula `flipFacing` a partir do sinal do deslocamento do cursor ao eixo (`frameOfWall` já dá `n`).

### 6.2 Editor do tipo (diálogo "Propriedades do tipo")

Três colunas: **biblioteca** (árvore de famílias + miniaturas de variantes), **parâmetros** em seções recolhíveis, **pré-visualização** (Planta, Elevação, Corte, 3D linhas, 3D sombreado, com girar arrastando, ângulo de abertura e Inverter). Seções: *Pré-visualização e posicionamento* → *Definições da porta/janela* (folha, maçaneta, tipo de abertura por componente, bandeiras, moldura, ventilação) → *Planta e corte* → *Nível de detalhe* → *Vão bruto e acabamento* (o que já existe) → *Marcador e etiqueta* → *Classificação e propriedades*. Faixa de **verificações** ao vivo (largura livre, altura, ventilação útil, profundidade do batente × núcleo, verga).

### 6.3 Representação

- **Nível de detalhe 2D** no tipo (*por escala | fixo 1:50/1:100/1:200 | desligado*) e **override na vista** (barra de controle: Por escala | Esquemática | Simbólica | Detalhada). Baixo = só o vão e a folha fechada; médio = símbolo de hoje; alto = perfil do batente, folha com espessura, vidro duplo, peitoril saliente.
- **Exibição em planta**: simbólica (hoje) e **projetada** (folha fechada com espessura, mais tracejado do que está acima do corte).
- **Ângulo de abertura 2D e 3D** por tipo, com override por instância; no correr, distância.
- Arco: arco, tracejado ou só linha; canetas por tipo; linhas de abertura em planta e elevação/3D.
- Marcador: círculo, hexágono ou texto; mostrar peitoril; espessura do contrapiso (ArchiCAD).

### 6.4 Famílias novas

| Família | Planta | Observação |
|---|---|---|
| Porta de embutir | folha + cavidade tracejada na parede | exige trecho livre ao lado |
| Porta vai-e-vem | dois arcos | mapeia para ArchiCAD "Double-Acting" |
| Porta dobrável (2/4 folhas) | zigue-zague | |
| Porta sanfonada | zigue-zague fino | |
| Portão seccionado | projeção tracejada para dentro | abre "pelo teto" |
| Janela de abrir (giro, 1/2 folhas) | folha + arco | hoje só existe maxim-ar |
| Janela guilhotina | duas linhas defasadas | movimento vertical |
| Janela pivotante | eixo + folha girada | |
| Janela veneziana | tracejado de aletas | |
| Correr 1 folha de porta e janela de correr de 4 | — | hoje 2 (porta) e 2–3 (janela) |

Cada família nova toca: `opening.ts` (`OPENING_FAMILIES`), `openingSymbol.ts`, `openingParts.ts`, `section/build.ts`, o mapeamento IFC em `ifcExport.ts` e o quadro. O **schema continua fechado** (0017 §9): família é código, não parâmetro do usuário.

### 6.5 Dados BIM do tipo

`fire` (P-30 a P-120, NBR 11742 [FÓRUM]), `acoustic` (Rw), `uval`/`shgc` (janela), `cost`, `maker`, classificação, e **operação IFC derivada da família** (somente leitura). Alimentam o quadro e a exportação.

## 7 · Roteiro em ondas

| Onda | Entrega | Principais arquivos | Risco |
|---|---|---|---|
| **1 · Colocação** | prévia com símbolo, sentido pelo cursor, captura nova, cotas temporárias, alças, etiqueta na colocação, âncora | `packages/tools/src/openingTool.ts` (+ item de overlay `symbol`), `types.ts` do tools, `controller.ts`, renderer de overlay | baixo; regra de negócio já existe |
| **2 · Diálogo do tipo** | seções recolhíveis, biblioteca, 5 prévias, verificações | `OtherDialogs.tsx` (extrair `OpeningTypeDialog`), `TypePreview.tsx`, CSS do diálogo | médio (muita UI; sem mudar dado) |
| **3 · Representação** | detalhe 2D por escala/vista, exibição projetada, ângulo, arco e canetas | `openingSymbol.ts`, `render/plan/symbols.ts`, `View3DSettings`, `ViewControlBar.tsx` | médio; muda baselines visuais |
| **4 · Famílias** | as 9 novas | ver §6.4 | alto (volume) |
| **5 · Dados BIM** | fogo, acústica, térmica, custo, IFC, quadro | `types.ts`, `migrate.ts`, `openingSchedule.ts`, `ifcExport.ts` | baixo |

Compatibilidade: todo campo novo é **opcional com padrão por leitura** (mesmo método de `openingExtras.ts`), então arquivos antigos não mudam de aparência e `SCHEMA_VERSION` não precisa subir. `kind` redundante entre `Opening` e `OpeningType` (A §4) fica para a migração da onda 5.

## 8 · Decisões que cabem ao dono

1. O **lado do cursor** passa a ser o padrão (com "Manual" disponível)? E a porta abre **para** o cursor ou para o lado oposto?
2. **Tab** continua invertendo o sentido (como hoje) ou passa a alternar paredes sobrepostas (como no ArchiCAD)? O protótipo mantém o Tab atual.
3. Quais famílias da §6.4 entram primeiro? (Sugestão: janela de abrir, porta de embutir, guilhotina.)
4. A **porta pivotante** mantém o eixo a W/4 (provisório, sem fonte)?
5. Biblioteca por **arquivo** (Load Family do Revit) ou só do projeto (hoje)?
6. **Exibição projetada** em planta entra agora ou depois da onda 3?

## 9 · Fontes

**Autodesk (Revit)**
- [Place a Door](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-7E952007-8A5A-4693-8E0F-A847F72F7617.htm): preview, Espaço, lado do cursor, cotas temporárias, Tag on Placement.
- [Part 6: Place Doors (Revit LT)](https://help.autodesk.com/cloudhelp/2019/ENU/RevitLT-GetStarted/files/GUID-6CA4C036-034D-4410-A3AB-5CBC492C3A83.htm): Espaço antes, setas de inversão depois.
- [Door Type Properties](https://help.autodesk.com/cloudhelp/2021/ENU/Revit-ArchDesign/files/GUID-29905EE0-3D7D-422E-A627-5A7A8AC34D7B.htm) e [Door Instance Properties](https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-08C6541F-4974-489E-B941-F365628B2884.htm).
- [About Family Visibility and Detail Level](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-B28F98C2-D3DA-486E-B198-96B8C862F28B.htm); sobre swing em subcategorias: [bimpure](https://www.bimpure.com/blog/fixing-nested-plan-swing-visibility), [cad-notes](https://www.cad-notes.com/creating-revit-family-door/) [FÓRUM].

**Graphisoft (ArchiCAD)**
- [Placing Doors or Windows (AC26)](https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-305.htm): Tab, sol, âncora, setas de sentido, Flip.
- [Door/Window Preview and Positioning Panel](https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-28.htm) e [Door/Window Tool Settings (AC28)](https://help.graphisoft.com/AC/28/INT/_AC28_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-15.htm).
- [Door/Window Settings and Opening](https://help.graphisoft.com/AC/27/INT/_AC27_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-4.htm) (folha, maçaneta, tipo de abertura, moldura, ventilação, nível de detalhe 2D/3D) e [Opening Type and Angle](https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-13.htm).
- [Leaf, Sash and Opening Direction](https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-38.htm): bandeiras "igual/oposta à folha".
- [Floor Plan Display of Doors/Windows](https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-307.htm), [Other Panels in Door/Window Settings](https://help.graphisoft.com/AC/26/INT/_AC26_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-19.htm) (marcador, Subfloor Thickness) e [artigo de suporte sobre detalhe em planta](https://support.graphisoft.com/hc/en-us/articles/30483904951953-How-can-I-increase-the-detail-level-of-doors-and-windows-on-floor-plan).

**Não consegui confirmar** (ficam como proposta): a direção exata do sentido em relação ao cursor no Revit; a lista completa de *Opening Types* por peça no ArchiCAD (varia por peça da biblioteca; a documentação cita giro lateral e vai-e-vem para porta articulada); os rótulos exatos da versão em português do ArchiCAD; a norma brasileira de simbologia (NBR 6492, ver A §3).
