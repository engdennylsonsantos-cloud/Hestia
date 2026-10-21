# Visualização · relatório da pesquisa externa (fonte primária)

Executa o item **§6 de [`A-pesquisa.md`](A-pesquisa.md)** (prompt de busca refinado). **Data da coleta: 2026-10-21.**
Par: [`B-estado-atual.md`](B-estado-atual.md).

**Ferramentas de acesso usadas.** `webfetch` na página inteira (não no trecho de busca) e `websearch`, no agente principal.

**Hosts que abriram (200):** `help.autodesk.com` (Revit 2026 ENU, incluindo *Specify Line Weights*, *Detail Levels*,
*Visual Styles*, *Project Templates*), `help.graphisoft.com` (Archicad 29 e **30**, © 2026), PDFs públicos da NBR 6492:2021
e cópia integral da NBR 16861:2020.

**Hosts bloqueados.** `helpcenter.graphisoft.com` (**403** — a URL `?p=55323` da §7 de `A-pesquisa.md` não abre; o mesmo
conteúdo foi lido em `help.graphisoft.com`), `autodesk.com/support/...` (**403** — o nome do template padrão veio do
trecho de busca do próprio artigo), `arquivos.ufrrj.br/.../NBR_6492_2021.pdf` (PDF não é aceito pelo leitor; o texto da
norma foi lido em cópia pública com camada de texto).

**Legenda.** `[OFICIAL]` documentação do fabricante ou texto da norma · `[SECUNDÁRIO]` blog, fórum, cópia não oficial ·
`[NÃO ENCONTRADO]` procurou-se e não se achou · `[EXIGE TESTE]` só se responde abrindo o Revit/Archicad.

> **Desvio em relação ao prompt.** O pedido era "cite a URL e a versão; se não houver valor numérico na fonte, diga
> isso". Foram mantidas **duas** tabelas de terceiros (itens c e o texto da NBR 16861), sempre marcadas `[SECUNDÁRIO]`,
> porque são a única forma de obter o número; em nenhum ponto o valor foi estimado ou deduzido.

---

## 1. Tabela-resumo

| Item | Categoria | Resposta em uma linha | Fonte |
|---|---|---|---|
| a | [OFICIAL] | Série de larguras **0,13 / 0,18 / 0,25 / 0,35 / 0,50 / 0,70 / 1,00 / 1,40 / 2,00 mm**, série baseada em **1:√2 (≈1:1,4)**; dentro do grupo, **estreita:larga:extralarga = 1:2:4**; entre grupos consecutivos **1:√2**. Tabela 4 transcrita na §2 | ABNT NBR 16861:2020, 3.2.1 e Tabela 4 (cópia com camada de texto) |
| b | [OFICIAL] | NBR 6492:2021 **não fixa mm por escala**. Dá a Tabela A.2 (mesmos grupos) e a proporção **1, 1/2, 1/4** dentro do grupo e **×2** entre famílias; manda escolher "tipo, tamanho, escala do desenho e métodos de reprodução" | ABNT NBR 6492:2021, A.1.3 e Tabela A.2 (texto integral) |
| c | [OFICIAL] + [SECUNDÁRIO] | Ajuda 2026 dá o mecanismo e **um** exemplo (peso 5: **0,5 mm em 1:100** e **0,7 mm em 1:50**). A tabela completa do template **não é publicada**; a de 16 pesos × escalas foi lida do template padrão (imagem de terceiro) e bate com o exemplo oficial | help.autodesk.com 2026 GUID-C214002D; imagem Engipedia |
| d | [NÃO ENCONTRADO] | A ajuda 2026 **não publica** a escala padrão de Coarse/Medium/Fine. Documenta só que as escalas são organizadas sob os três títulos e que o mapeamento é editável (Manage > Additional Settings > Detail Level, botão *Default*) | help.autodesk.com 2026 GUID-0BB861D5 / GUID-0A0C92EC |
| e | [OFICIAL] | **Ray Trace não existe** no Revit 2026: a lista de estilos tem 6 (Wireframe, Hidden Line, Shaded, Consistent Colors, Textures, Realistic). Foi removido no Revit 2021 e substituído pela luz em tempo real do Realistic | help.autodesk.com 2026 GUID-12C2D6B0, GUID-E84B38F7 + solução aceita Autodesk |
| f | [OFICIAL] | PSD: 4 opções, por **vista**. GOR: regras por **projeto**, combinação por **vista**. MVO: por **vista**, combinações no View Settings. "Fills Display": o painel *Override Fill Display* do MVO **foi eliminado** e migrou para o GOR | help.graphisoft.com Archicad 30 |
| g | [OFICIAL] | O nome atual é **3D Styles** (o antigo "3D Window Settings"): motor **Vectorial** ou **Hardware acceleration**, salvo no **View Settings** (por vista), com *3D Window Size* em comando separado | help.graphisoft.com Archicad 30, 140_UserInterfaceDialogBoxes-46 |

---

## 2. Item por item

### (a) NBR 16861:2020, seção 3.2.1 — largura de linhas

**Texto da norma (literal, 3.2.1):**

> A largura (representada nesta Norma por d) de todos os tipos de linhas deve ser uma das seguintes, de acordo com o
> tipo, dimensão, método de projeção, quantidade de linhas e escala do desenho: 0,13 mm; 0,18 mm; 0,25 mm; 0,35 mm;
> 0,50 mm; 0,70 mm; 1,00 mm; 1,40 mm; 2,00 mm.
>
> Esta série está baseada na relação 1:√2 (≈ 1:1,4), utilizada na série padronizada ISO-A dos formatos da folha de desenho.
> As larguras das linhas estreitas, largas e extralargas devem ter a relação 1:2:4.
>
> […] A relação das larguras de linhas entre um grupo de linhas e o seu grupo consecutivo é 1:√2. Para representação e
> escrita de símbolos gráficos em desenhos projetivos, sem norma específica, recomenda-se utilizar as larguras indicadas
> na última coluna da Tabela 4 (aproximadamente a largura média entre a largura da linha estreita e a largura da linha
> larga), observando as especificidades de cada setor.
>
> As larguras de linha 0,13 mm e 0,18 mm não podem ser utilizadas quando o desenho se destinar a reproduções ou
> impressões que necessitem de redução. A largura de qualquer linha deve ser constante ao longo de toda a extensão da
> linha. As larguras das linhas utilizadas em uma vista devem ser as mesmas utilizadas nas outras vistas, quando as
> vistas forem desenhadas na mesma escala.

**Tabela 4 – Grupo de linhas (dimensões em milímetros):**

| Designação do grupo | 0,25 | 0,35 | 0,50 | 0,70 | 1,00 |
|---|---|---|---|---|---|
| **Extralarga** | 0,50 | 0,70 | 1,00 | 1,40 | 2,00 |
| **Larga** | 0,25 | 0,35 | 0,50 | 0,70 | 1,00 |
| **Estreita** | 0,13 | 0,18 | 0,25 | 0,35 | 0,50 |
| **Símbolos gráficos** | 0,18 | 0,25 | 0,35 | 0,50 | 0,70 |

**O que não se respondeu.** A "recomendação de uso por tipo de linha" está na Tabela 6 (3.5 *Tipos de linhas e suas
aplicações*) e na Tabela 7 (3.6 *Hierarquia de linhas*); na cópia lida as duas estão como imagem e não têm camada de
texto legível — ficam `[NÃO ENCONTRADO]` aqui, sem reconstrução por memória. A norma não dá valor por escala; a escolha
é declarada como dependente de "tipo, dimensão, método de projeção, quantidade de linhas e escala".

**Fonte.** Cópia integral da ABNT NBR 16861:2020 (impressão de 16/06/2021, uso exclusivo UFCE), em
<https://pdfcoffee.com/nbr16861-desenho-tecnico-requisitos-para-linhas-e-escrita-pdf-free.html> `[SECUNDÁRIO]` ·
conferência de escopo e da série em <https://acervodigital.ufpr.br/xmlui/bitstream/handle/1884/71934/2021_Resumo_NBRs_Des_Tec_Arq.pdf?sequence=1> e
<https://www.normas.com.br/visualizar/abnt-nbr-nm/12921/abnt-nbr16861-desenho-tecnico-requisitos-para-representacao-de-linhas-e-escrita>.

### (b) NBR 6492:2021 — espessura por elemento, em cortes, projeções e cotas

**A.1.3 (literal):**

> As larguras das linhas devem ser escolhidas de acordo com o tipo, tamanho, escala do desenho e os métodos de
> reprodução. As proporcionalidades dos desenhos, que definem as larguras, são indicadas preferencialmente na Tabela A.2.
>
> Em cada grupo de linhas, as linhas extralarga, larga e estreita seguem a proporção 1, 1/2 e 1/4. Entre as famílias, a
> proporção é múltiplo de 2, conforme a Figura A.1.

**Tabela A.2 – Larguras de linha (pesos gráficos), mm:**

| Grupo | 0,25 | 0,35 | 0,50 | 0,70 | 1,00 |
|---|---|---|---|---|---|
| Extralarga | 0,50 | 0,70 | 1,00 | 1,40 | 2,00 |
| Larga | 0,25 | 0,35 | 0,50 | 0,70 | 1,00 |
| Estreita | 0,13 | 0,18 | 0,25 | 0,35 | 0,50 |

**Uso por elemento (Tabela A.1, literal, trechos):**

| Tipo | Aplicação geral |
|---|---|
| Contínua extralarga | Contornos visíveis de elementos **em corte e seções, quando não são utilizadas hachuras**; limites de importância especial em corte |
| Contínua larga | Contornos visíveis de elementos em corte **quando são utilizadas hachuras**; curvas de nível principais; limites de materiais à vista; representação simplificada de portas, janelas, escadas; contornos de seções rebatidas |
| Contínua estreita | Arestas visíveis à vista; limites de materiais à vista; **linhas de cotas**; **linhas de chamada**; setas de acesso; mudança de nível em planta; hachuras |
| Contínua com zigue-zague estreita | Limites de vistas ou cortes parciais interrompidos |
| Tracejada estreita | Arestas e contornos **não visíveis** |
| Traço e ponto estreita | Linhas de simetria, trajetórias, marcação dos planos de corte |
| Traço e ponto extralarga | Contornos de peças adjacentes; detalhes situados antes do plano de corte |
| Traço e dois pontos estreita | Linhas de centro de gravidade; **projeções de pavimentos em balanço, marquises e beirais** |
| Traço longo e ponto estreita | Linhas de eixo |

**Valor por escala (1:50, 1:100, 1:200):** **não existe na norma.** A NBR 6492:2021 é explícita: a largura depende do
tipo, do tamanho, **da escala** e do método de reprodução, mas não tabela mm por escala. Escalas usuais citadas em A.3.1:
1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:250, 1:500, 1:1000 e 1:2000. Em cotas (A.5.1): linhas de cota
fora do desenho; chamadas param a **2 mm a 3 mm** do objeto; cifras de **2,5 mm ou 1,8 mm**; nos cortes, só cotas
verticais.

**Fonte.** Texto integral da ABNT NBR 6492:2021 (2ª edição, 16.06.2021) em
<https://pdfcoffee.com/nbr-6492-2021-pdf-free.html> `[SECUNDÁRIO]` · cópia institucional em
<https://arquivos.ufrrj.br/arquivos/2021103028882828758439fd707c0a63a/NBR_6492_2021.pdf> e
<https://conecta.ulbra-to.br/app/wwwroot/uploadsv2/3D4573FF-98E6-4B99-9A97-F851F3F10264/nbr-6492-21-representacao-de-projetos-de-arquitetura384669e6371e41d97020a25cb15b6880.pdf> ·
resumo com a mesma conclusão em <https://acervodigital.ufpr.br/xmlui/bitstream/handle/1884/71934/2021_Resumo_NBRs_Des_Tec_Arq.pdf?sequence=1>.

### (c) Revit 2026 — Specify Line Weights e tabela do template

**O que a ajuda oficial diz (literal, 2026):**

> Model line weights are associated to a scale. The width of a particular line weight can change as the scale changes.
> […] The width used for a particular line weight will be applied to the associated scale and larger scales until the
> next range is reached.
>
> For example, line weight 5 at 1:100 scale is assigned a width of .5mm, and at 1:50 scale is assigned a width of .7mm.
> Any lines using line weight 5 will be printed at .5mm for all scales from 1:100 to 1:51. Once the scale of the view is
> 1:50, the lines using line weight 5 will be printed .7mm.

Caminho: **Manage > Settings > Additional Settings > Line Weights**; abas **Model Line Weights**, **Perspective Line
Weights** e **Annotation Line Weights**. Só a tabela de modelo é dependente de escala; perspectiva e anotação têm uma
coluna única. As espessuras são aplicadas por categoria em **Object Styles** (colunas *Projection* e *Cut*).
Fonte: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-C214002D-786D-4E5A-B89B-F60AB04A4460.htm> `[OFICIAL]`.

**Tabela do template padrão — 16 pesos × colunas 1:50, 1:100 e 1:200** `[SECUNDÁRIO]`:

| Peso | 1:50 | 1:100 | 1:200 |
|---|---|---|---|
| 1 | 0,18 | 0,10 | 0,10 |
| 2 | 0,25 | 0,18 | 0,10 |
| 3 | 0,35 | 0,25 | 0,18 |
| 4 | 0,50 | 0,35 | 0,25 |
| 5 | 0,70 | 0,50 | 0,35 |
| 6 | 1,00 | 0,70 | 0,50 |
| 7 | 1,40 | 1,00 | 0,70 |
| 8 | 2,00 | 1,40 | 1,00 |
| 9 | 2,80 | 2,00 | 1,40 |
| 10 | 4,00 | 2,80 | 2,00 |
| 11 | 5,00 | 4,00 | 2,80 |
| 12 | 6,00 | 5,00 | 4,00 |
| 13 | 7,00 | 6,00 | 5,00 |
| 14 | 8,00 | 7,00 | 6,00 |
| 15 | 9,00 | 8,00 | 7,00 |
| 16 | 9,00 | 9,00 | 8,00 |

**Checagem cruzada:** o peso 5 em 1:100 = **0,50 mm** e em 1:50 = **0,70 mm** — exatamente o exemplo da ajuda 2026.
Os valores estão em mm. A tabela é de 2015 e não é documento Autodesk; a convergência com o exemplo oficial é a única
validação disponível sem abrir o Revit.

**Nome do arquivo do template.** A ajuda 2026 **não** nomeia um arquivo: diz que "as installed, Revit provides several
templates for different disciplines", extensão **RTE**, em `%ALLUSERSPROFILE%\Autodesk\RVT 2026\Templates`
(<https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-4C16B54A-7ADA-4DEB-A278-C199B1BC4207.htm> `[OFICIAL]`).
O artigo de suporte da Autodesk (bloqueado para leitura, 403; trecho de busca) diz: **"The default Architectural template
file is named Default.rte"** — é o único nome dado pela Autodesk, e o arquivo instalado varia com idioma/região.
A conferência do nome real exige abrir a pasta acima `[EXIGE TESTE]`.

### (d) Revit 2026 — Detail Levels

**O que a ajuda oficial diz (literal):**

> You can set the detail level for newly created views based on a view scale.
>
> View scales are organized under the detail level headings Coarse, Medium, or Fine. When you create a new view in your
> project and set its view scale, its detail level is automatically set according to the arrangement in the table.
>
> By predefining detail levels, you can affect the display of the same geometry at different view scales.

Caminho: **Manage > Settings > Additional Settings > Detail Level**; as escalas se movem em ordem sequencial (não se
seleciona uma escala isolada) e o botão **Default** volta ao arranjo original. O detalhamento também pode ser sobrescrito
por vista em *View Properties > Detail Level*.
Fonte: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-0BB861D5-27CB-4276-93AE-F2E949B0D466.htm> e
<https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-0A0C92EC-DC99-4E25-B089-605772148718.htm> `[OFICIAL]`.

**Tabela de escala padrão por Coarse/Medium/Fine: `[NÃO ENCONTRADO]`.** A ajuda de 2026 descreve o mecanismo e a
existência da tabela, mas **não publica os valores**; eles ficam gravados no projeto/template. Nenhuma fonte primária
encontrada dá o arranjo de fábrica. Não foi estimado.

### (e) Revit 2026 — Visual Styles, Ray Trace e Realistic

**Lista de estilos da ajuda 2026** (títulos das páginas filhas): Wireframe, Transparent Surfaces, Hidden Line, Shaded,
Consistent Colors, Textures, **Realistic** — **Ray Trace não aparece**.
<https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-12C2D6B0-71ED-490E-9CC6-AD3C635F092B.htm> `[OFICIAL]`.

**Definição de Realistic (literal):**

> The Realistic style displays material appearances and artificial lighting.
>
> As you rotate the model, the surfaces display as they may appear in various lighting conditions. Select Show Ambient
> Shadows from the Graphic Display Options dialog to simulate a soft, diffused light. […]
>
> The Realistic visual style instantly displays realistic material appearances in the model view. […] Real-time rendered
> views are not available in drafting views, schedules, or legends.
>
> To display materials using the Realistic visual style, the Use Hardware Acceleration (Direct3D®) option is turned on by
> default.

<https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-E84B38F7-CCD8-4F3E-B580-EE27A07D818A.htm> `[OFICIAL]`.

**Quando o Ray Trace saiu.** Solução aceita no fórum Autodesk, de um *Principal Content Experience Designer* do Revit:

> Raytrace was removed and "real time" lighting effects have been integrated with the "realistic" visual style.

O tópico é de abril de 2020, sobre a atualização para o Revit 2021:
<https://forums.autodesk.com/t5/revit-architecture-forum/no-raytrace-visual-style-option-after-upgrading-to-2021/td-p/9482548> `[SECUNDÁRIO]` (funcionário Autodesk).
Conclusão: **não há Ray Trace no Revit 2026**; o que existe é o Realistic com iluminação em tempo real.

### (f) Archicad 30 (versão atual) — PSD, GOR, MVO e Fills Display

> O prompt diz "ArchiCAD 27 (ou a versão atual)". A versão atual documentada é a **Archicad 30** (© 2026). As páginas da
> AC27 continuam no ar, com os mesmos nomes de opção; as URLs abaixo são da 30.

**(f.1) Partial Structure Display** — <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-94.html> `[OFICIAL]`

- Opções, com o nome exato: **Entire Model** (padrão), **Without Finishes**, **Core Only**,
  **Core of Load-Bearing Elements Only**.
- Onde: pop-up **Partial Structure Display** na **Quick Options Bar** ou **Document > Partial Structure Display**.
- Escopo: "they will be applied to the current window and can be saved separately for each view" → **por vista**
  (também aparece no View Settings como *Structure Display*; fica cinza em viewpoint Manual Update/Drawing).

**(f.2) Graphic Override Rules** — <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-120.html> `[OFICIAL]`

- Onde: **Document > Graphic Overrides > Graphic Override Rules**, ou **Manage Rules** dentro do diálogo de combinações.
- Estrutura: regras (com grupos, busca, *New*, *New Group*) × painéis **Criteria** e **Override Style**.
- Criteria: a primeira linha é sempre **Element Type**; *Add…* acrescenta parâmetros/propriedades (Layer, Layer
  Combination etc.).
- Override Style: **Line Type**, **Fill Type**, **Fill Pen**, **Fill Background Pen** (com ícones para **Drafting Fill**,
  **Cover Fill** e **Cut Fill**) e **Surface** (**Cut** e/ou **Uncut**). As três primeiras regras são os status de
  reforma (**Existing**, **To be Demolished**, **New**) e não podem ser editadas/duplicadas.
- Escopo: a **regra é do projeto**; o que é por vista é a **Graphic Override Combination**, escolhida no **View Settings
  > Graphic Override** (a página do View Settings lista o campo).

**(f.3) Model View Options** — <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-90.html> e
<https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-91.html> `[OFICIAL]`

- Onde: **Document > Model View > Model View Options**.
- Escopo (literal): "Model View Options affect the on-screen and output display of construction elements and certain GDL
  objects throughout the project. **Model View Options can be applied to each view.** Saved Model View Options
  Combinations are part of View Settings."
- Painéis da AC30: Construction Element Options, Model View Options for Curtain Walls, Stair Options, Railing Options,
  Detail Level of Stair and Railing Symbols, Detail Level of Curtain Wall Door and Window Symbols, Detail Level of Door
  and Window Symbols, Elevator Options, Miscellaneous Settings for Library Parts, MEP Options.

**(f.4) Fills Display** — o nome **não existe mais** como painel do MVO.

- Página de migração (literal): "The **Override Fill Display** panel of Model View Options has been eliminated. Instead,
  overrides are handled by **Graphic Override Rules (GOR)**. These Rules are applied to individual views/viewpoints as
  Graphic Override Combinations."
  <https://help.graphisoft.com/AC/30/INT/Topics/010_MigrationGuide/010_MigrationGuide-16.html> `[OFICIAL]`.
- O painel antigo (AC18 e anteriores) tinha cinco blocos: **Fill background color**, **Cut Fills**, **Cover Fills**,
  **Drafting Fills**, **Zone Fills**
  (<https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Settings/Appendix_Settings-87.htm> `[OFICIAL]`, histórico).
- O que sobrou no lugar: **GOR** para cor/tipo/pena de preenchimento por vista, e a opção de exibição
  **View > On-Screen View Options > True Fill Appearance** (True Fill × bitmap), que é global de janela
  (<https://help.graphisoft.com/AC/30/INT/Topics/025_Attributes/025_Attributes-20.html> e
  <https://help.graphisoft.com/AC/30/INT/Topics/070_Documentation/070_Documentation-7.html> `[OFICIAL]`).
  Em 3D/corte/elevação, a hachura vetorial só aparece com **Surface – Cover fill foreground** marcado no *Model Appearance*.

### (g) Archicad 30 — "3D Window Settings" e motor 3D por vista

**O nome atual é 3D Styles.** A própria documentação da AC26 diz que o motor se escolhe em
**View > 3D View Options > 3D Styles**; as páginas antigas (AC20–AC24) ainda usam "3D Window Settings" com o pop-up
*3D Modeling Engine*.
<https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-46.html> `[OFICIAL]`.

- Definição (literal): "A 3D Style is a collection of settings (**3D Engine**, shading, background, etc.) that determine
  model display in the 3D Window. **The 3D Style is saved with View Settings.** Every time you edit a 3D Style, all views
  using that 3D Style are updated instantly."
- Onde se aplica: pop-up **3D Styles** no menu de contexto da janela 3D, na **Quick Options Bar/Palette** ou na aba da
  janela 3D. Onde se define: **View > 3D View Options > 3D Styles** (lista de estilos do projeto; *New*, *Import*,
  *Export* em XML).
- Motores (literal): **Hardware acceleration** — "This is the default engine"; mostra texturas, navegação rápida, mas
  copy/paste e export saem como bitmap e não se salva a janela 3D como desenho vetorial. **Vectorial** — sem texturas,
  mostra padrões vetoriais das superfícies, imprimível em qualquer escala e salvável como desenho 2D vetorial; "usually
  results in slower navigation". O **3D View Mode** é Wireframe / Hidden Line / Shading (com Hardware acceleration, só
  Wireframe e Shading).
- Opções do motor: **Hardware Acceleration Options** (Settings na linha do motor) —
  <https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-47.html> `[OFICIAL]`.
- **Escopo: por vista.** O motor faz parte do 3D Style, que é salvo no View Settings; o View Settings 3D Only Panel guarda
  as *Image settings* (projeção, sol, filtros, 3D Styles, planos de corte, cutaway e render) e tem
  **Redefine Image settings with current**.
- **3D Window Size** é comando separado (aba/menu de contexto da janela 3D), não faz parte do 3D Style.
- Extra: existe um renderizador físico no 3D Window como recurso experimental (link na página *3D Window*).

---

## 3. O que continua em aberto

| # | Pendência | Por quê |
|---|---|---|
| 1 | Tabela 6 e Tabela 7 da NBR 16861:2020 (uso por tipo de linha e hierarquia) | estão como imagem na cópia pública, sem camada de texto |
| 2 | NBR 16861 e NBR 6492 na fonte oficial (ABNT Catálogo) | normas pagas; o texto lido é cópia de impressão institucional |
| 3 | Tabela **oficial** de Line Weights do template 2026 | a ajuda não publica; só o exemplo do peso 5 |
| 4 | Nome do arquivo `.rte` instalado | a ajuda 2026 não nomeia; a Autodesk cita "Default.rte"; varia por idioma/região |
| 5 | Escala padrão de Coarse/Medium/Fine | a ajuda não publica o arranjo de fábrica |
| 6 | Ray Trace na 2026 | ausência confirmada na lista oficial; a remoção é de 2021 (fonte: funcionário Autodesk em fórum) |
| 7 | "Fills Display" na AC30 | não existe com esse nome; o painel foi eliminado e migrou para GOR |

## 4. Fontes

**Autodesk (Revit 2026, ENU)**
- Specify Line Weights: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-C214002D-786D-4E5A-B89B-F60AB04A4460.htm>
- Detail Levels: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-0BB861D5-27CB-4276-93AE-F2E949B0D466.htm>
- Set Detail Level Scale Values: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-0A0C92EC-DC99-4E25-B089-605772148718.htm>
- Visual Styles: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-12C2D6B0-71ED-490E-9CC6-AD3C635F092B.htm>
- About Realistic Visual Style: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-E84B38F7-CCD8-4F3E-B580-EE27A07D818A.htm>
- Project Templates: <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-4C16B54A-7ADA-4DEB-A278-C199B1BC4207.htm>
- About the View Range (peso de corte × projeção): <https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF.htm>
- Fórum, remoção do Ray Trace: <https://forums.autodesk.com/t5/revit-architecture-forum/no-raytrace-visual-style-option-after-upgrading-to-2021/td-p/9482548>
- Tabela de pesos padrão (imagem, 2015): <https://www.engipedia.com/revit-line-weights> `[SECUNDÁRIO]`

**Graphisoft (Archicad 30, © 2026)**
- Partial Structure Display: <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-94.html>
- Graphic Override Rules: <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-120.html>
- Model View Options: <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-90.html>
- Define Model View Options: <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-91.html>
- View Settings Dialog Box: <https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-68.html>
- Override Fill Display eliminado: <https://help.graphisoft.com/AC/30/INT/Topics/010_MigrationGuide/010_MigrationGuide-16.html>
- Fill Display Mode (True Fill × bitmap): <https://help.graphisoft.com/AC/30/INT/Topics/025_Attributes/025_Attributes-20.html>
- Display Vector Fills in project views: <https://help.graphisoft.com/AC/30/INT/Topics/070_Documentation/070_Documentation-7.html>
- 3D Styles: <https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-46.html>
- Hardware Acceleration Options: <https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-47.html>
- 3D Window: <https://help.graphisoft.com/AC/30/INT/Topics/050_ViewsVB/050_ViewsVB-17.html>
- 3D Engines (AC26, nome antigo "3D Window Settings"): <https://help.graphisoft.com/AC/26/INT/%5C_AC26_Help/050_ViewsVB/050_ViewsVB-20.htm>
- Model View Options Override Fill Display (AC18, histórico): <https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Settings/Appendix_Settings-87.htm>

**Normas (texto integral em cópia pública; ABNT é a fonte oficial, paga)**
- ABNT NBR 16861:2020: <https://pdfcoffee.com/nbr16861-desenho-tecnico-requisitos-para-linhas-e-escrita-pdf-free.html>
- ABNT NBR 6492:2021: <https://pdfcoffee.com/nbr-6492-2021-pdf-free.html>
- Cópia institucional NBR 6492:2021: <https://arquivos.ufrrj.br/arquivos/2021103028882828758439fd707c0a63a/NBR_6492_2021.pdf>
- Resumo UFPR (NBR 16861 + NBR 6492): <https://acervodigital.ufpr.br/xmlui/bitstream/handle/1884/71934/2021_Resumo_NBRs_Des_Tec_Arq.pdf?sequence=1>
