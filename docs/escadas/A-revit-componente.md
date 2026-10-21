# Revit: escada "por componente" (Stair by Component)

Objetivo: base de referência para o Hestia reproduzir o comportamento de escadas por componente do Revit.

## Aviso sobre as fontes (leia antes)

- **Nenhuma página da Autodesk foi lida na íntegra.** O proxy de saída do ambiente respondeu `403` (negação de política) para `help.autodesk.com:443`. Todas as tentativas de `WebFetch` falharam. Não tentei contornar o bloqueio.
- As afirmações abaixo vêm de **trechos de resultados de busca** (`WebSearch`), que são resumos, não texto literal da página. Por isso as citações entre aspas são só indicativas e **não foram verificadas palavra por palavra**.
- Os trechos são de páginas de ajuda de **Revit 2014 a 2020** (com uma página de API de 2026). Nomes de parâmetros e de interface podem ter mudado em versões posteriores.
- Fontes secundárias (Lynda, Bimpure, blog Novedge, forums, rvtdocs) estão marcadas como tal.
- Itens sem confirmação em fonte oficial estão com `[?]` e a frase "não encontrado em fonte oficial".

Legenda: **[OF]** = Autodesk (help.autodesk.com ou API oficial). **[SEC]** = fonte secundária. **[?]** = não encontrado em fonte oficial.

---

## Fontes consultadas (URL)

| Ref | Página (título ou descrição) | URL |
|---|---|---|
| S1 | Run tool / "Select the Run Component Tool and Specify Options" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-26053199-6B08-44B9-907C-F5D9AA7CEC81.htm |
| S1b | Mesma página (2020) | https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-26053199-6B08-44B9-907C-F5D9AA7CEC81.htm |
| S2 | "Stair by Component" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-B1B305DF-8DBE-44A7-A7C6-16B70A3B580E.htm |
| S3 | "Landing component types are available from 2 predefined system families" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-68BBA40A-64F9-4F93-BE5A-E4AD8417BAA7.htm |
| S4 | "Boundaries and Riser and Run Lines" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-BC9FC54E-6A88-42E3-BB87-0DFBE8C2E624.htm |
| S5 | "Stair Component Type Properties" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-E36AE889-D507-4288-90BE-FCE2F120C2B6.htm |
| S6 | Página de tipo de escada / "change type properties" (2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-721680B4-A321-4973-BD4A-E7AF402611F7.htm |
| S7 | "Use the Stair Calculator" (2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-4E763B5A-1FFF-4084-BFAC-B587FEB01B3D.htm |
| S8 | "Stair Component Instance Properties" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-541EB756-8376-4522-BFA1-141C22346ED8.htm |
| S9 | Página sobre escada multi-andar (título não confirmado, 2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1FEA4534-95D5-40DD-825A-C7B569224C6D.htm |
| S10 | "Specify the Railing for a New Stair" (2020) | https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-1BE1E53A-4123-4068-B6EF-FFC64DE6A813.htm |
| S11 | "Changing the Railing Type" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1891F903-2B1B-47A7-8F72-2F4692EED77F.htm |
| S12 | "Symbolic Representation for Stairs" (2015) | https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-9A78CD98-5A97-4A0C-98D7-6E29D0ABE4D1.htm |
| S13 | "Stairs Annotations" (2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-180FDD83-9C51-432E-808B-7868B3C2D97E.htm |
| S14 | "Creating a Landing Component by Sketching" (2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-60E69DB2-12D4-42E6-AC9B-5B73F1AB4690.htm |
| S15 | "About Stair by Component" (2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-D4861B15-29FF-49F8-B292-39AD62EBCDD3.htm |
| S16 | "Stair by Sketch" (2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-582D0E9B-2FF1-45CC-8129-910FDC13EBCD.htm |
| S17 | "Stairs and Railings" (API, 2014) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-FAA9B559-53E2-4495-8919-365F228EA17F.htm |
| S18 | "Creating and Editing Stairs" (Revit API, 2016) | https://help.autodesk.com/cloudhelp/2016/ENU/Revit-API/files/GUID-C60041FB-069E-4C89-BE67-A0593E790995.htm |
| S19 | StairsRun.ExtensionBelowRiserBase (Revit API 2026) | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/31d69dbe-84d3-e559-20a0-f50d98c16820.htm |
| S20 | Centro/Spiral (título não confirmado, 2020) | https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-4E05115C-84C9-4930-95FB-E8B91219B1E6.htm |
| S21 | Fórum: fonte de números de degrau (anedótico) | https://forums.autodesk.com/t5/revit-architecture-forum/is-there-a-way-to-change-quot-stairs-tread-number-font-quot/m-p/13210669 |
| SEC1 | Bimpure, "13 tips to understand revit stairs" | https://www.bimpure.com/blog/13-tips-to-understand-revit-stairs |
| SEC2 | Lynda, Revit 2019 "Adding stairs" | https://www.lynda.com/Revit-tutorials/Adding-stairs/697711/731324-4.html |
| SEC3 | Lynda, Revit 2020 "Adding stairs" | https://www.lynda.com/Revit-tutorials/Adding-stairs/5007857/2217516-4.html |
| SEC4 | rvtdocs, BuiltInFailures.StairRampFailures (API 2021) | https://rvtdocs.com/2021/Autodesk.Revit.DB.BuiltInFailures.StairRampFailures |

---

## 1. Fluxo do usuário: Architecture > Stair > Stair by Component

**Confirmado**

- Stair by Component é um método de criação em que a escada é montada a partir de componentes: lances (runs), patamares (landings) e apoios (supports), e opcionalmente corrimãos. [OF] S2, S17 (resumo: "assemblies of runs, landings, supports, and railings").
- O método tem um modo de edição de montagem em que se adicionam componentes comuns e componentes sketchados em planta ou 3D. Os componentes são independentes mas ligados. [OF] S2 (resumo).
- Ao criar um lance, as opções estão no Options bar e na Properties palette. Entre elas: Location Line, Offset, Base/Top, Desired Number of Risers, Actual Riser Height, Tread Depth, Automatic Landing, Actual Run Width. [OF] S1 (resumo da busca).
- Location Line tem opções como Exterior Support Left, Exterior Support Right, Run Left, Center e Run Right. [OF] S1 (resumo).
- Actual Run Width define a largura do lance sem apoios. [OF] S1 (resumo).

**Parâmetros de nível e altura** (Stair Component Instance Properties) [OF] S8:

- **Base Level**: onde a escada começa. Em vista de planta, o nível associado vira a base. [OF] S8 (resumo).
- **Top Level**: por padrão, o nível acima da base, ou Unconnected se não houver nível acima. [OF] S8 (resumo).
- **Desired Stair Height**: editável só quando Top Level é Unconnected. [OF] S8 (resumo).
- **Desired Number of Risers**: calculado a partir da distância vertical entre base e topo. [OF] S8 (resumo: "calculated based on the height between levels").
- **Actual Number of Risers**: normalmente igual ao desejado, mas pode diferir se a sequência de espelhos não for completada. [OF] S8 (resumo).
- **Actual Riser Height**: somente leitura. Deve ser menor ou igual ao Maximum Riser Height do tipo. [OF] S8 (resumo).
- **Actual Tread Depth**: editável por instância. Pode ser ajustado também pela Stair Calculator. [OF] S6/S7 (resumo) e S8.

**Regra do número de espelhos** (secundário)

- SEC2 e SEC3 descrevem: o Revit divide a altura total pelo número de espelhos e obtém a altura real do espelho. Com o tipo padrão de 7" de espelho máximo, aumentar o número desejado para 17 gera aviso de espelho acima do máximo. [SEC] SEC2 (resumo).
- O resumo da busca sugere que o Revit usa o menor número de espelhos que mantém a altura ≤ Maximum Riser Height. A fórmula exata não foi confirmada em fonte oficial. [?] Não encontrado em fonte oficial a fórmula exata de arredondamento.

**Min Tread Depth e Max Riser Height** [OF] S5 (tipo) e S6:

- **Minimum Tread Depth**: largura mínima do piso medida na linha central do caminho, para todos os lances comuns (winder, spiral, straight). [OF] S5 (resumo).
- **Maximum Riser Height**: altura máxima de cada espelho do elemento. [OF] S5 (resumo).
- No nível de instância, o valor de Minimum Tread Depth semeia Actual Tread Depth. Se o valor real ultrapassar o mínimo, o Revit mostra aviso. [OF] S6 (resumo).

**Minimum Run Width**

- Pela busca, a largura mínima é definida no tipo e exclui os stringers. A largura real começa no mínimo e pode ser aumentada. Valor menor gera aviso. [SEC] SEC1 (resumo).
- SEC2 cita um exemplo de mínimo de 3 pés para o tipo de escada usado no tutorial. [SEC] SEC2 (resumo).
- O nome exato do parâmetro "Minimum Run Width" não foi confirmado em página oficial. [?] Não encontrado em fonte oficial.

**Nomes em português**

- Nenhum nome de interface em português foi encontrado nas fontes. [?] Não encontrado em fonte oficial. Os nomes acima são os da versão em inglês.

---

## 2. Tipos de lance (Run)

A galeria Draw de Stair by Component tem cinco ferramentas de lance. [OF] S1 e S2 (resumo):

1. Straight (reto)
2. Full-Step Spiral
3. Center-Ends Spiral (a Autodesk escreve "Center-Ends", não "Center-Ended")
4. L-Shape Winder
5. U-Shape Winder

**Spiral (confirmado parcialmente)** [OF] S20 (resumo, título não confirmado):

- **Center-Ends Spiral**: clique no centro, depois no ponto inicial. Mova o cursor para escolher o sentido (horário ou anti-horário) e clique no ponto final, que define também o número de espelhos. Limitado a menos de 360 graus. Flip inverte a rotação no modo de edição. [OF] S20 (resumo).
- **Full-Step Spiral**: clique no centro e mova o cursor para definir o raio. Uma dica mostra os limites do lance e o número de degraus inteiros necessários para atingir a elevação alvo. Pode passar de 360 graus. Gera espiral anti-horária por padrão. [OF] S20 (resumo).

**Straight**

- O clique exato de desenho não foi confirmado. [?] Não encontrado em fonte oficial nesta pesquisa.

**L-Shape Winder e U-Shape Winder**

- O procedimento de cliques não foi encontrado nas fontes. [?] Não encontrado em fonte oficial.

**Automatic Landing em L/U**

- Automatic Landing vem marcado por padrão. Quando dois lances separados chegam ao próximo nível, o Revit insere um patamar entre eles. Desmarcar impede isso. [OF] S1 (resumo: "Automatic Landing is selected by default").
- Um tutorial indica que a ferramenta de lance também cria apoios e, com Automatic Landing marcado, patamares automáticos. [SEC] SEC2 (resumo).
- A forma exata do patamar automático em L e U não foi confirmada. [?] Não encontrado em fonte oficial.

---

## 3. Edição do lance

**Sketch de lance (Run > Create Sketch)** [OF] S4 e S2 (resumo):

- Para criar lance sketchado: escolher Run, depois Create Sketch. Usar a ferramenta Boundary para as duas bordas (esquerda e direita). Usar a ferramenta Riser para os espelhos. [OF] S4 (resumo).
- Caminho (Stair Path) é opcional. Se o usuário não desenhar, o Revit cria um automaticamente. [OF] S4 (resumo).
- O sketch do caminho alimenta a anotação de caminho (stair path). Para mudar a representação, editar o sketch do caminho. [OF] S4 (resumo).

**Regras do sketch** [OF] S4 (resumo, versão 2014):

- Bordas esquerda e direita não devem se conectar entre si. Podem ser linhas simples ou polilinhas multissegmento.
- Linhas de espelho ligam as bordas. As que ultrapassam as bordas são aparadas na criação do lance.
- O caminho deve começar no primeiro espelho e terminar no último. Não pode passar além do primeiro ou do último espelho.

**Edit Sketch do lance** [OF] S4 (resumo): existe uma ferramenta Edit Sketch com as ferramentas de desenho para alterar o sketch. Um guia mais antigo descreve selecionar a escada, usar Edit Sketch e desenhar.

**Converter lance para sketch (Convert to Sketch-Based)** [OF] S14 (resumo):

- A ferramenta Convert to Sketch-Based converte um componente em componente sketchado. Ela é citada para obter forma irregular a partir de patamar gerado automaticamente. [OF] S14 (resumo).
- O procedimento completo de conversão de lance não foi confirmado. [?] Não encontrado em fonte oficial o passo a passo.

**Efeito de virar sketch sobre as regras de espelho e piso** [OF] S14 e S16 (resumo):

- Componentes sketchados não ficam ligados. Se um lance e um patamar forem sketchados e a largura do lance mudar, a forma do patamar não muda sozinha. O sketch precisa ser atualizado manualmente. [OF] S14 (resumo).
- O comportamento exato sobre Maximum Riser Height e Minimum Tread Depth para lance sketchado não foi confirmado. [?] Não encontrado em fonte oficial.

**Alças (grips)** [?] Não encontrado em fonte oficial a lista de alças por tipo de lance.

---

## 4. Patamares (Landings)

**Tipos e origem** [OF] S3 e S2 (resumo):

- Patamares de componente vêm de duas famílias de sistema predefinidas. [OF] S3 (título). Os nomes exatos das famílias não foram confirmados no trecho. [?]
- Patamares são criados de três formas: automaticamente entre lances, selecionando dois lances (Pick Two Runs), ou sketchados (Create Sketch). [OF] S2 (resumo).

**Automático** [OF] S2 e S1 (resumo): o Revit cria patamar automaticamente entre dois lances que chegam ao mesmo nível quando Automatic Landing está marcado.

**Pick Two Runs** [OF] S2 (resumo): é uma opção que cria patamar a partir de dois lances selecionados. O procedimento de cliques não foi confirmado. [?] Não encontrado em fonte oficial.

**Create Sketch** [OF] S14 (resumo):

- Para sketchar patamar: entrar no modo de edição de montagem, escolher a ferramenta Landing no painel Components, abrir Create Sketch e desenhar o contorno (boundary). O caminho é opcional. Depois, Finish Edit Mode. [OF] S14 (resumo).
- Para patamar em escada nova, o caminho é Architecture > Circulation > Stair. [OF] S14 (resumo).

**Espessura e tipo** [?] Não encontrado em fonte oficial nesta pesquisa. A página de tipo (S5) cita Landing Type e Landing Overlap, mas não a espessura do patamar.

**Relação com os lances** [OF] S5 e S14 (resumo): patamares automáticos seguem os lances. Patamares sketchados não são ligados aos lances e precisam de atualização manual.

---

## 5. Apoios (Supports)

**Confirmado** [OF] S5 (resumo, tipo de escada):

- Left Support determina se o Revit cria Stringer (Closed), Carriage (Open), ou nenhum apoio à esquerda. Parâmetros relacionados: Left Support Type e Left Lateral Offset. [OF] S5 (resumo).
- Middle Support: existe um apoio central. Middle Support Type define o tipo. Middle Support Number define o número de apoios intermediários. [OF] S5 (resumo).
- Stringers podem ser recortados no topo: Do Not Trim, ou Landing Carriage Height (altura diferente em relação ao patamar). [OF] S5 (resumo).

**Geração automática** [OF] S2 (resumo): apoios podem ser gerados junto com os lances, ou ao escolher uma aresta de lance ou patamar.

**Apoios do lance (ex.: Stringer à direita)** [?] Não encontrado em fonte oficial a regra exata de quando cada apoio aparece nas posições laterais e central.

**Apoio em lance sketchado** [?] Não encontrado em fonte oficial.

---

## 6. Tipo da escada (Type Properties)

Grupos e parâmetros confirmados em S5 (resumo, versão 2014) e S6:

**Construction**

- **Monolithic Stairs**: a escada é feita de um só material. [OF] S5.
- **Run Type**: tipo de componente usado para todos os lances. [OF] S5.
- **Landing Type**: tipo de componente usado para todos os patamares. [OF] S5.
- **Landing Overlap**: habilitado quando Monolithic Stairs está ativo. [OF] S5.
- **Calculation Rules**: abre a calculadora de escada. [OF] S5/S6.
- **Extend Below Base**: para quando o pilar do degrau se apoia na face de abertura, e não na superfície do piso. [OF] S5.
- Assembled/Cast-in-place aparecem como categorias de família de escada. A distinção entre Assembled e Monolithic está na configuração Monolithic Stairs. [OF] S5 (resumo). Não encontrado em fonte oficial uma página separada para "Assembled".

**Treads e Risers**

- **Minimum Tread Depth**: ver seção 1. [OF] S5.
- **Maximum Riser Height**: ver seção 1. [OF] S5.
- **Riser Type** e **Riser Thickness**: disponíveis para tipos com espelho. [OF] S5 (resumo).
- **Nosing**: [?] Não encontrado em fonte oficial nesta pesquisa.

**Stringers**

- **Trim Stringers at Top**: três opções (Do Not Trim; Landing Carriage Height; outra). [OF] S5 (resumo).

**Supports**

- Left Support, Left Support Type, Left Lateral Offset, Middle Support, Middle Support Type, Middle Support Number. [OF] S5 (resumo).

**Graphics**

- **Cut Mark Type**: tipo de marca de corte exibido na escada. [OF] S5 (resumo). Detalhes em S12.

**Identity Data**

- **Type Mark**: identificador do tipo, com valor único por escada no projeto. [OF] S5 (resumo).

**Calculation Rules / Stair Calculator** [OF] S7 (resumo):

- Defina primeiro Minimum Tread Depth e Maximum Riser Height. Depois, em Calculation Rules, escolha Use Stair Calculator for slope calculation.
- Informe um valor a multiplicar pelo Rise e um valor a multiplicar pelo Tread Depth. Informe Maximum Result e Minimum Result.
- A calculadora usa o Tread Depth informado nas propriedades da instância. Se o resultado sair da faixa, aparece aviso.
- A calculadora afeta só escadas novas. [OF] S7 (resumo: "computes the tread depth for new stairs only").
- A calculadora aplica uma fórmula de regra prática (ex.: Architectural Graphic Standards). A fórmula exata não foi confirmada. [?] Não encontrado em fonte oficial.

---

## 7. Corrimãos (Railings) gerados automaticamente

**Confirmado** [OF] S10 e S11 (resumo):

- Ao criar a escada, é possível especificar o tipo de corrimão a ser adicionado automaticamente. Escolha None para não criar. [OF] S10 (resumo).
- Position: escolher Treads ou Stringer. [OF] S10 (resumo).
- O padrão vem do tipo de corrimão selecionado no Type Selector no modo de sketch de corrimão. Pode ser trocado depois. [OF] S10 (resumo).
- Flip Railing Direction alterna entre treads e stringers em um corrimão existente. [OF] S10 (resumo).
- Tread/Stringer Offset: ajuste fino de posição. Padrão: "1/2 Stringer Width" para stringers e 1" para treads. [OF] S10 (resumo).

**Não confirmado**

- Stair Path como opção de corrimão. A fonte encontrada (blog Novedge) descreve Stair Path como anotação de planta, não como corrimão. [?] Não encontrado em fonte oficial.

---

## 8. Escada multi-andar (Multistory Stairs)

**Confirmado** [OF] S8 e S9 (resumo):

- **Multistory Top Level**: define o topo da escada em um edifício de vários andares. O Autodesk apresenta como alternativa a sketchar um lance por andar. [OF] S9 (resumo).
- Vantagem citada: uma mudança de corrimão em um lance se propaga para todos os lances. Também reduz o crescimento do arquivo. [OF] S9 (resumo).
- Níveis devem ter espaçamento uniforme. O exemplo citado é 4 m. [OF] S9 (resumo).
- O número de espelhos é derivado da altura entre níveis. Espaçamento irregular gera cálculo inconsistente entre andares. [OF] S9 (resumo).
- **Top Offset**: deslocamento em relação ao Top Level. Não se aplica quando Top Level é Unconnected. [OF] S8 (resumo).

**Não confirmado**

- Parâmetros exatos de Multistory Top Level Offset e a regra de repetição de lances entre andares. [?] Não encontrado em fonte oficial nesta pesquisa.

---

## 9. Representação gráfica

**Confirmado** [OF] S12 e S13 (resumo):

- Customização de representação simbólica, anotação e exibição gráfica de escadas por componente.
- Controles: números de degrau ou espelho, símbolo da linha de corte (cut line mark), anotação de caminho (stair path), e subcategorias como tags de escada e números de degrau.
- **Cut Mark Type**: controla linha e símbolo de corte. Símbolo pode ser Curve, Zigzag ou None. [OF] S12 (resumo).
- **Stair Path Type**: controla setas, opção de seta em full-step e extensões. [OF] S12 (resumo).
- Subcategorias: Cut Marks, Riser Lines, Supports (representação); Stair Paths e Stair Run Tags (anotação). [OF] S12 (resumo).
- Propriedades de texto Up/Down, offsets e exibição do texto do caminho: um resumo de busca diz que a API expõe isso numa classe StairsPath. A classe não foi confirmada em página oficial; a busca específica por "StairsPath" não retornou resultado. [?] Não encontrado em fonte oficial.

**Seta de subida (Up/Down text)** [?] Não encontrado em fonte oficial página atual (2024–2026) para esta configuração.

**Números de degrau (Tread Number)**

- Forum da Autodesk (S21, anedótico): uma resposta diz que a fonte do número de degrau não pode ser trocada, só o tamanho. Tratar como não verificado. [?]
- Como ocultar anotação acima da linha de corte: [?] Não encontrado em fonte oficial confirmada.

**Visibilidade por nível de detalhe** [?] Não encontrado em fonte oficial nesta pesquisa.

---

## 10. Limites e avisos conhecidos

**Confirmado**

- Escada criada por componente não pode ser adicionada a uma montagem (assembly). Para isso, usar Stair by Sketch. [OF] S2/S15 (resumo).
- Componentes sketchados não são ligados. Alterar largura de lance não atualiza o patamar sketchado. [OF] S14 (resumo).
- Stair by Sketch: em Revit LT, era para modificar escadas sketchadas existentes. Escadas novas devem ser criadas por componente. [OF] S16 (resumo, versão 2017 LT).
- Stair by Component é o método preferido, segundo a documentação de 2016. [OF] S16/S15 (resumo).
- Actual Riser Height acima do Maximum Riser Height gera aviso. [OF] S8 e S6 (resumo).
- Aviso de Actual Tread Depth vs. Minimum Tread Depth: CONFLITO. O resumo oficial de S6 diz que o aviso ocorre quando o valor "exceeds" (ultrapassa) o mínimo, o que parece incoerente com um mínimo. A fonte secundária SEC2 diz que a profundidade não pode ficar abaixo do mínimo. A direção exata do aviso não foi validada. [?] Não encontrado em fonte oficial a direção exata do aviso.
- Riser count "menor ou igual" ao máximo. [OF] S8.
- Top Level Unconnected torna Desired Stair Height editável. [OF] S8 (resumo).

**Avisos não confirmados**

- Mensagem literal "Stair is not within the minimum run width". [?] Não encontrado em fonte oficial a mensagem exata.
- Relacionado: `BuiltInFailures.StairRampFailures` tem falha "landing depth is less than run width" (LandingDepthIsLessThanRunWidthWarning). [SEC] SEC4 (rvtdocs, API 2021). Não confirmada em página oficial desta pesquisa.
- Lista completa de avisos de escada: [?] Não encontrado em fonte oficial nesta pesquisa.

---

## Resumo para implementação (Hestia)

Base: comportamento do Revit confirmado em fontes oficiais, salvo quando marcado. Os itens com `[?]` não devem ser implementados como se fossem o comportamento do Revit sem validação.

- Criar escada por componente com 5 modos de lance: Straight, Full-Step Spiral, Center-Ends Spiral, L-Shape Winder, U-Shape Winder.
- Full-Step Spiral: centro + raio; pode passar de 360 graus. Center-Ends Spiral: centro + início + sentido + fim; limitado a menos de 360 graus.
- Oferecer Flip para inverter o sentido da espiral em modo de edição.
- Location Line com opções: Exterior Support Left, Exterior Support Right, Run Left, Center, Run Right.
- Actual Run Width separado da largura com apoios.
- Automatic Landing marcado por padrão. Quando marcado, criar patamar automático entre dois lances que chegam ao mesmo nível.
- Permitir criar patamar por "Pick Two Runs" e por sketch (boundary). Sketch de patamar: caminho opcional.
- Base Level e Top Level; Top Level padrão = nível acima; Unconnected habilita Desired Stair Height.
- Desired Number of Risers derivado da altura entre níveis. Actual Riser Height é somente leitura e deve ser menor ou igual ao Maximum Riser Height.
- Actual Tread Depth editável por instância. Não está validado se o limite é inferior (SEC2) ou superior (texto oficial ambíguo). Ver pendência 23.
- Minimum Tread Depth e Maximum Riser Height vêm do tipo.
- Calculation Rules com calculadora: multiplicadores de Rise e Tread, faixa de resultado mínima e máxima; afeta só escadas novas.
- Minimum Run Width no tipo, excluindo stringers; largura real não pode ficar abaixo do mínimo, com aviso (fonte secundária SEC1/SEC2; não confirmada em página oficial).
- Lance sketchado: bordas esquerda e direita não conectadas; espelhos entre bordas; caminho começa no primeiro espelho e termina no último.
- Componentes sketchados não se atualizam sozinhos quando o lance muda. Marcar como "requer atualização manual".
- Convert to Sketch-Based: converte componente em sketch para ajuste de forma. Passo a passo [?].
- Apoios no tipo: Left Support (Stringer closed, Carriage open, nenhum), Left Lateral Offset, Middle Support, Middle Support Number, Trim Stringers at Top.
- Corrimão automático: tipo escolhido na criação ou None; Position = Treads ou Stringer; Tread/Stringer Offset (padrão: meia largura do stringer, ou 1" para treads).
- Multistory Top Level: uma escada para vários andares; níveis com espaçamento uniforme.
- Representação: Cut Mark Type (Curve, Zigzag, None); Stair Path Type com setas e extensões; subcategorias para tags e números de degrau.
- Escadas por componente não entram em montagem; criar a opção "Stair by Sketch" separada para isso.
- Stair by Sketch: não usar como padrão para escada nova.
- Não reproduzir mensagens de aviso literais sem confirmar o texto exato na versão alvo.
- Tratar Parâmetros em português como pendentes: nenhum nome em português foi encontrado.

---

## Lista de pendências [?]

1. Nomes de interface em português (todos os parâmetros e botões).
2. Procedimento de cliques para L-Shape Winder e U-Shape Winder.
3. Procedimento de cliques para Straight e Pick Two Runs.
4. Forma do patamar automático em L e U (dimensões, regra de cálculo).
5. Fórmula exata de arredondamento do número de espelhos (Desired Number of Risers).
6. Fórmula da Stair Calculator (regra prática usada).
7. Parâmetro "Minimum Run Width" e seu nome oficial.
8. Actual Run Width e Automatic Landing: detalhes da regra de largura.
9. Procedimento de Convert to Sketch-Based para lance e patamar.
10. Comportamento de Maximum Riser Height e Minimum Tread Depth em lance sketchado.
11. Regra de criação de apoios laterais e central por posição.
12. Espessura do patamar e tipo de patamar (Landing Type).
13. Nosing e Riser Thickness em detalhe.
14. Multistory Top Level Offset e repetição de lances entre andares.
15. Mensagem exata de aviso "Stair is not within the minimum run width" e lista de avisos da versão alvo.
16. Propriedades de Up/Down text, offsets e visibilidade do Tread Number em versão atual (2024–2026).
17. Como ocultar anotação acima da linha de corte.
18. Visibilidade por nível de detalhe.
19. Procedimento de alças (grips) por tipo de lance.
20. Diferença exata entre Assembled e Monolithic no tipo.
21. Revit Learning e Revit Blog da Autodesk: não pesquisados nesta sessão. [?]
22. Acesso às páginas completas: bloqueado pelo proxy (403 em help.autodesk.com). Reexecutar com acesso liberado para validar as citações literais.
23. Direção do aviso de Actual Tread Depth vs. Minimum Tread Depth: o texto oficial (resumo) diz "exceeds", a fonte secundária diz "não pode ficar menor". Validar na página oficial e na própria Revit.
