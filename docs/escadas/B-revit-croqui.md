# Revit: escadas por croqui (sketch) - comportamento de referência

Data da pesquisa: 2026-10-21. Escopo: somente leitura na web. Nenhum arquivo do repositório /home/user/Hestia foi editado.

## Status da pesquisa e limites de fonte

- As páginas de `help.autodesk.com` NÃO puderam ser abertas. O proxy de egresso respondeu 403 (negação de política) ao CONNECT para `help.autodesk.com:443`, registrado em `/__agentproxy/status`. O `WebFetch` também falhou com `getaddrinfo ENOTFOUND` para todos os hosts testados. Não houve tentativa de contornar o bloqueio.
- Por isso, tudo que está marcado como **confirmado** vem de **trechos da busca (WebSearch)** que citam o texto da ajuda oficial. Não é leitura integral da página. Trechos de página oficial são tratados como confirmados, mas com esta ressalva.
- Fontes de comunidade e blogs são marcadas como `não oficial`. Os itens `[?]` não foram confirmados por nenhuma fonte lida.
- A versão da ajuda varia (2014 a 2024). Não foi achada página oficial para Revit 2025 ou 2026. Nomes de menu podem ter mudado.

Legenda de fontes: `[O#]` = oficial (Autodesk Help), `[N#]` = não oficial. Lista completa de URLs no fim.

## 0. Disponibilidade e localização por versão

- **Stair by Sketch como comando separado (legado).** Documentado nas ajudas de 2014 a 2017, na aba Architecture, grupo Circulation, menu suspenso Stair, opção "Stair by Sketch". [O4][O3]
- **A partir de ~2018**, o ícone separado de Stair by Sketch saiu. Há uma única ferramenta Stair, que abre por padrão no modo de componente. O croqui passou a ser acessado por dentro dela. [N5]
- **Ajuda atual (Revit LT 2024):** Stair > grupo Components > selecionar Run > Create Sketch. Depois, aba Modify | Create Stair > Sketch Run > grupo Draw (Boundary, Riser, Stair Path). [O-busca: GUID-0EF16913 versão 2024 RevitLT-ArchDes]
- **Ajuda oficial recomenda** o método por componente como preferido. O croqui é "método alternativo", e "Stair by Component is generally the preferred approach". [O-busca: GUID-0EF16913 e GUID-D4861B15]
- **Estado do comando legado em Revit 2026:** `[?]`. Não foi confirmado se existe como comando oculto ou foi removido.

## 1. As três ferramentas do modo croqui

Fluxo geral: entrar no croqui do Run e desenhar os limites e os espelhos. Ao concluir (Finish Edit Mode), o Revit gera a escada. [O1][O5]

### 1.1 Boundary (limites esquerdo e direito)

- Há dois limites: esquerdo e direito. Cada um é uma linha, ou uma sequência de segmentos (retas e arcos) conectados. [O1][O-busca 0EF16913]
- **Os limites esquerdo e direito não podem se tocar.** A ajuda diz para não conectá-los entre si. [O1]
- Limites em leque ou curvos são feitos com arcos encadeados a retas. [O-busca]
- Limites devem ficar **ao longo das laterais** da escada, não cruzando a frente de um piso (degrau). [N3]
- **Quebrar o limite onde a inclinação muda**: em patamar, em virada (winder) ou onde o "stringer" muda de inclinação. [N-fórum antigo, 2005; N3]
- **Quebrar o limite onde encontra o patamar.** Assim o corrimão acompanha o patamar e a inclinação. Ferramenta: selecionar a escada e usar Modify | Create Stairs Sketch > Modify > Split. [O1]
- **Cor no modo croqui:** limites em verde, Stair Path em azul, espelhos em preto. [N2 ou fórum de comunidade; `[?]` sobre a fonte exata]

### 1.2 Riser (linhas de espelho)

- Cada linha de **Riser** representa **uma borda de degrau** (linha de espelho). Ela deve ir de um limite ao outro. [O1]
- As linhas devem ser **conectadas entre os dois limites**. Se a linha passar além de um limite, o Revit **corta** a linha ao criar a escada. [O1][O-busca]
- **Linha de espelho que atravessa a outra ou fica com folga:** comunidade diz que um erro de "milímetro" de folga ou um cruzamento faz o cálculo falhar, com o erro "Can't create stairs". [N3] Conflita com o corte automático da ajuda oficial. `[?]` Precisa de teste no Revit.
- **Ordem e sentido:** `[?]`. As fontes não definem a ordem de desenho nem o sentido de subida. Pela lógica de Stair Path (ver 1.3), a sequência geométrica do espelho é o que importa, não a ordem de clique. Não confirmado.
- **Espelho em aberto ou laço não fechado:** um usuário relatou aviso de linhas sobrepostas e de laço não fechado, rastreado até um espelho faltando. [N3-comunidade]
- **Linha de espelho "topo"** representa o espelho real, sem piso. [O-busca, texto de 2016]
- **Espelho ausente:** o Revit não cria o degrau entre os dois espelhos. Não há fonte com a mensagem exata. `[?]`.
- **Espelhos todos no mesmo plano:** um fórum relata que o croqui é um plano só, e linhas com cotas diferentes podem ser tratadas como interseção. Opinião de fórum. `[?]`

### 1.3 Stair Path (linha de caminhada)

- **Função:** define a linha de caminhada (walk line) usada na **anotação** da escada. Não altera a geometria de degraus. [O-busca]
- **Opcional.** Se não for desenhada, o Revit cria uma automaticamente. [O1][O-busca]
- **Se desenhada,** deve **começar na primeira linha de espelho e terminar na última**. Não pode passar além da primeira nem da última linha. [O-busca, texto de 2016/2017]
- **Sentido de subida:** o guia comunitário diz para desenhar o caminho "da primeira linha até o último degrau", cruzando cada espelho para indicar a direção. [N3] Oficial não confirmado. `[?]`
- **Caminho inválido:** a ajuda oficial diz que, se o caminho passar além das extremidades, ele é inválido. [O-busca]

### 1.4 Regras de validade e erros conhecidos

| Situação | Comportamento / mensagem | Fonte |
|---|---|---|
| Limites esquerdo e direito conectados | Não é permitido pela ajuda. Mensagem exata `[?]` | [O1] |
| Espelho passa além de um limite | Revit corta a linha na criação | [O1] |
| Espelho com folga ou cruzamento | Erro "Can't create stairs" (comunidade) | [N3] |
| Stair Path além do primeiro ou último espelho | Caminho inválido | [O-busca] |
| Limite duplicado sobre outro | Erro de "no more than two boundaries" (fórum de 2006) | `[?]` fonte antiga |
| Linhas sobrepostas ou laço aberto | Aviso de sobreposição (relato de comunidade) | [N3] |
| Número de espelhos x altura total | Revit compara com a altura entre pisos. Mensagem `[?]` | `[?]` |

Não foi achada lista oficial de mensagens de erro para croqui. Qualquer item de mensagem exata precisa ser testado no Revit.

## 2. Como os espelhos são distribuídos

### 2.1 Croqui de Run (Sketch Run) - contagem automática

- Ao desenhar um **Run** por croqui (Create Sketch > Run), o Revit gera os espelhos a partir da altura total e do número de espelhos. [O5][O-busca]
- Durante o desenho, a barra mostra quantos espelhos foram criados e quantos restam (texto aproximado: "9 risers created and 9 remaining"). [N1][O9-vídeo]
- Ao clicar no fim do Run, todos os espelhos calculados são criados. Arrastar além, com zero restante, não cria mais. [N-KnowledgeCity]
- **Número de espelhos:** definido pela altura entre pisos e pela altura máxima de espelho nas propriedades da escada. [O-busca]
- **Desired x Actual:** o número desejado e o real aparecem em Properties > Dimensions no modo croqui ou edição. [N-fórum]. Mudar o número desejado afeta o próximo Run, não os existentes. [N-KnowledgeCity]
- **Labels exatos na barra de opções** ("Actual Number of Risers", "Remaining Risers"): `[?]`. A busca não confirmou os nomes exatos.

### 2.2 Croqui de Boundary + Riser - desenho manual

- Aqui **cada espelho é desenhado pelo usuário**. Não há cálculo automático de posição. [O1]
- A altura de cada degrau sai da posição de cada linha de espelho (desnível entre linhas) e da altura total entre pisos. Fórmula exata `[?]`.
- **"Pick Lines" para espelhos:** um fórum relata que, ao usar Pick Lines nas linhas de espelho, o Revit definiu "1 espelho criado e 17 restantes" e não funcionou com borda curva. Os exemplos oficiais de Pick Lines são para abertura de piso, não para espelho. [N-fórum; URL não capturada]
- **"Autom. Riser" / "Auto Balance":** nenhuma fonte achou esse recurso no croqui de Boundary + Riser. Não confirmado. `[?]`. Em escada com patamar automático há "Balance the stair runs" em vídeo de escada em switchback. Não explica o balanceamento. [O13-vídeo]

## 3. Degraus em leque, winders e patamares

### 3.1 Winders (degraus de virada)

- Método comunitário: desenhar a borda externa do winder como limite, e acrescentar 2 ou 3 linhas de espelho para os pisos do winder. [N4]
- Sem fonte oficial que defina o desenho de winder por croqui. `[?]`
- Vários relatos de "Can't create stairs" envolvem escada em L com winders. [N3]. Solução citada: quebrar o limite em cada mudança de inclinação. [N3]

### 3.2 Degraus em leque e degraus curvos

- Limites com arcos são permitidos (linha + arco encadeados). [O1][O-busca]
- Espelhos radiais: o Revit aceita, mas há relato de problema. Arcos que aproximam uma elipse e espelhos perpendiculares à elipse geram degraus "chanfrados". [N-fórum elíptica]
- Espelhos radiais em todos os degraus não permitem o patamar largo. [N-fórum; `[?]`]

### 3.3 Patamares (landings) por croqui

- Caminho: Stair > Landing (grupo Components) > Create Sketch > Boundary > desenhar contorno > Finish Edit Mode. [O8][O-busca]
- O contorno do patamar é **fechado**. A ajuda não define o detalhe de como o contorno se liga aos limites das rampas. `[?]`
- O patamar **não é ligado automaticamente** ao croqui do Run. Se o Run mudar de largura, o patamar não muda. Deve ser ajustado à mão. [O7][O8][O-busca]
- Os limites das rampas são divididos (Split) onde encontram o patamar, para o corrimão seguir a inclinação. [O1]

## 4. Edição posterior, conversão e perdas

### 4.1 Edição de croqui

- Selecionar a escada e abrir o croqui para editar. [O-busca, resumo da ajuda sobre "To make changes later, select the stair and open its sketch"]
- Nome exato do comando ("Edit Sketch" ou "Edit Stairs"): `[?]`. Os trechos citam "Edit Stairs" para o caso de converter e para patamar.

### 4.2 Convert to Sketch-Based (converter componente)

- Fluxo (versões 2014/2016): selecionar a escada > Edit Stairs > escolher o Run ou Landing > menu Tools > Convert to Sketch-Based > confirmar. Depois, editar o croqui. [O6]
- **Só pode converter:** Run comum ou patamar automático. [O6]
- **Irreversível após confirmar.** Undo funciona logo após a ação. [O6]
- **O que se perde:** a relação automática com os demais componentes. Por exemplo, a largura do Run não atualiza o patamar convertido. [O6][O7]
- Vídeo oficial de conversão foi gravado no Revit 2013. Pode haver diferença na versão atual. [O6-vídeo]

### 4.3 Croqui x componente

- Escada feita por componente **não pode ser incluída em conjunto (assembly)**. Para isso, usar croqui. [O-busca, ajuda 2014]
- Croqui: sem relação automática entre componentes. [O7]

### 4.4 API

- Escada criada por croqui **não é acessível como objeto Stair** na API (documentação de 2014). Pode estar desatualizado. `[?]` (URL não capturada)

## 5. Fidelidade geométrica

- **Altura de cada degrau:** altura total entre pisos dividida pelo número de espelhos. Esse é o comportamento-padrão. Não há fonte que confirme a fórmula exata. `[?]`
- **Número de espelhos do Run:** definido pela altura entre pisos e pela altura máxima de espelho. [O-busca]
- **Nosing:** o tipo da escada tem Nosing Length e Nosing Profile. O perfil (1, 2 ou 3 lados) é um sweep na frente do piso. [O-busca, sem URL exata; `[?]`]
- **Espessura da laje/escada ("Waist"):** não encontrei o parâmetro "Waist" nas fontes. `[?]`
- **Escada monolítica:** em Type Properties > Construction, marcar Monolithic Stairs, desmarcar End with Riser, e pôr espessura de espelho e piso em 0. [O12][N-busca]
- **Monolítica com croqui:** relatos de concreto que não preenche o croqui. Solução de comunidade: criar um tipo com profundidade maior que a escada mais alta. [N8]. Outro usuário preferiu montar escada não monolítica e aparentar monolítica. [N8]
- **Contorno qualquer:** o degrau segue o contorno dos limites. Limites com arcos são permitidos. A precisão depende de quantos segmentos de arco são usados. [N6]

## 6. Fluxo do usuário (roteiro)

Escada por croqui, método de Run (Revit 2018 e posteriores, conforme a ajuda atual):

1. Abra uma vista de planta no nível onde a escada começa.
2. Vá em Architecture > Circulation > Stair (ferramenta única na versão atual). Em versões antigas (2014 a 2016): Stair > Stair by Sketch. [O4][N5]
3. Na aba Create Stair, no grupo Components, selecione **Run**. [O-busca 2024]
4. Clique **Create Sketch**. A aba muda para Modify | Create Stair > Sketch Run. [O-busca 2024]
5. Opcional: ajuste o número desejado de espelhos e o tipo antes de desenhar, nas Properties. `[?]` quanto à posição exata no painel.
6. No grupo Draw, clique **Boundary**. Desenhe o limite esquerdo (linhas e arcos). Não o conecte ao direito. [O1]
7. Repita para o limite direito.
8. No grupo Draw, clique **Riser**. Desenhe cada linha de espelho de um limite ao outro, na ordem dos degraus. Ordem exata `[?]`.
9. Opcional: clique **Stair Path**. Desenhe a linha de caminhada da primeira linha de espelho até a última. [O-busca]
10. Clique **Finish Edit Mode** (ícone de verificação verde na faixa). O Revit gera a escada. [O1]
11. Para patamar, use Stair > Landing > Create Sketch > Boundary > desenhe o contorno > Finish Edit Mode. [O8]
12. Selecione a escada e use Split para dividir os limites onde encontram o patamar. [O1]
13. Para editar depois, selecione a escada e abra o croqui. [O-busca]

## Resumo para implementação

- Croqui tem três entidades: **Boundary** (limites esquerdo e direito), **Riser** (espelhos) e **Stair Path** (caminhada, opcional). [O1]
- Os limites **não podem se tocar**. Cada limite pode ser composto de segmentos de reta e arco. [O1]
- Espelho é uma linha que vai **de um limite ao outro**. O que passa além é **cortado**. [O1]
- Espelho com folga ou cruzamento causa falha de criação ("Can't create stairs"). A ajuda oficial e a comunidade divergem sobre o corte. Recomendo tratar folga e cruzamento como erro e testar. [N3][O1]
- A altura de cada degrau = altura total entre pisos / número de espelhos. Para Run, o Revit calcula o número. Para croqui manual, o usuário posiciona cada espelho. [O-busca][`[?]` fórmula]
- Stair Path é opcional. Se faltar, o Revit gera um automático. Se existir, começa no 1º espelho e termina no último, sem extrapolar. [O-busca]
- Stair Path controla só a anotação (walk line), não a geometria dos degraus. [O-busca]
- Para Run por croqui, a barra mostra quantos espelhos foram criados e quantos restam. [N1][O9]
- O número desejado de espelhos vale para o próximo Run. Escadas existentes não mudam sozinhas. [N-KnowledgeCity]
- Patamar por croqui: contorno fechado com Boundary, Finish Edit Mode. [O8]
- Limites devem ser divididos (Split) onde encontram o patamar e onde a inclinação muda. Isso mantém o corrimão certo. [O1][N3]
- Winder por croqui: limite externo + 2 ou 3 espelhos. Método comunitário, não oficial. [N4]
- Leque e curvos: limites em arco. Espelhos radiais podem gerar degraus chanfrados em curva elíptica. [N6]
- Croqui não tem vínculo automático entre Run e patamar. Mudança de largura exige ajuste manual. [O7][O8]
- Converter componente para croqui (Convert to Sketch-Based) é irreversível após confirmação. Perde vínculos automáticos. [O6]
- Escada monolítica exige espessuras de espelho e piso em 0 e End with Riser desmarcado. [O12]
- Concreto monolítico no croqui pode não preencher. Solução de comunidade: tipo com espessura maior. [N8]
- O comando legado "Stair by Sketch" existe nas ajudas de 2014 a 2017 e foi fundido à ferramenta Stair em versões seguintes. [O4][O3][N5]
- Para implementação: tratar croqui como fonte de geometria (limites e espelhos) e Stair Path como anotação separada. [O1][O-busca]
- Testar no Revit: mensagem exata de erro, corte de espelho que passa do limite e ordem/sentido dos espelhos. São pontos de maior incerteza. `[?]`

## Pendências `[?]`

1. Confirmar se o comando "Stair by Sketch" existe ou é oculto em Revit 2025 e 2026.
2. Confirmar nomes exatos dos campos na barra de opções do Run ("Actual", "Remaining", "Desired").
3. Confirmar se há "Auto" ou "Auto Balance" para espelhos no croqui manual.
4. Confirmar a fórmula de altura do degrau e a regra de número de espelhos.
5. Confirmar a ordem de desenho e o sentido de subida dos espelhos.
6. Confirmar a diferença entre "espelho passa além do limite" (corte) e "espelho cruza outro" (erro).
7. Confirmar mensagens exatas de erro de croqui e quando aparecem.
8. Confirmar o sentido de desenho do Stair Path (ordem de subida).
9. Confirmar como o contorno de patamar se liga ao croqui do Run (regra de união).
10. Confirmar o comportamento de winder por croqui em fonte oficial.
11. Confirmar o parâmetro "Waist" e a espessura de laje da escada por croqui.
12. Confirmar o nome do comando Edit Sketch / Edit Stairs na versão atual.
13. Confirmar se croqui de escada é acessível pela API na versão atual (a fonte é de 2014).
14. Confirmar o significado de Pick Lines para espelhos e a URL da fonte comunitária.

## Fontes

Oficiais (`[O#]`, lidas por trecho de busca, páginas completas não abertas):
- [O1] Create Stairs by Sketching Boundary and Riser Lines (2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-6C4F7A35-F62B-49A4-92C4-73E9610CA6C8.htm
- [O-busca 0EF16913] Create a Run Component by Sketching (2017): https://help.autodesk.com/cloudhelp/2017/ENU/Revit-Model/files/GUID-0EF16913-06FF-4AA8-B163-52F40849520F.htm ; versão 2024 RevitLT: https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-ArchDes/files/GUID-0EF16913-06FF-4AA8-B163-52F40849520F.htm
- [O3] About Stair by Sketch (2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-AFEF2DC8-FB82-4700-B515-1869590ABD4A.htm
- [O4] Stair by Sketch (2014): https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-582D0E9B-2FF1-45CC-8129-910FDC13EBCD.htm
- [O5] Create Stairs by Sketching a Run (2017): https://help.autodesk.com/cloudhelp/2017/ENU/Revit-Model/files/GUID-CF4B3395-C530-4AD2-961B-6ADB124BF569.htm
- [O6] Converting a Stair Component to a Sketch (2014): https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-E1479F1A-C311-494C-A90A-1CAD3ED7ACE4.htm ; versão 2016: https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-E1479F1A-C311-494C-A90A-1CAD3ED7ACE4.htm
- [O7] About Sketched Stair Components (2018): http://help.autodesk.com/cloudhelp/2018/ENU/Revit-Model/files/GUID-231DC68A-063E-4C5D-BF21-3528D316E853.htm
- [O8] Create a Landing Component by Sketching (2021): https://help.autodesk.com/cloudhelp/2021/ENU/Revit-ArchDesign/files/GUID-60E69DB2-12D4-42E6-AC9B-5B73F1AB4690.htm
- [O9] Video: Create a Stair by Sketching (2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-195B2068-65B1-4862-BBD9-A6E0C6616DCE.htm
- [O12] Zero Tread Thickness for Monolithic Stairs (2014): https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-683EDC6E-B9A7-4FE0-866D-AED0485FA515.htm
- [O13] Video: Create a Switchback Stair (2020): https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-4D12152C-C5BD-475D-91E7-AE5D0919A52E.htm
- [O-busca GUID-D4861B15] About Stair by Component (2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-D4861B15-29FF-49F8-B292-39AD62EBCDD3.htm

Não oficiais (`[N#]`):
- [N1] Lynda, Revit 2019 Adding stairs: https://www.lynda.com/Revit-tutorials/Adding-stairs/697711/731324-4.html
- [N2] Autodesk Community blog, "Revit Hints and Hacks: Stair Sketch - A Challenge": https://forums.autodesk.com/t5/community-blog-aec-english/revit-hints-and-hacks-stair-sketch-a-challenge/ba-p/11504503
- [N3] Autodesk Community, "How to Fix the Infamous Can't create stairs Error for Custom L-Shaped Winders": https://forums.autodesk.com/t5/revit-api-forum/how-to-fix-the-infamous-quot-can-t-create-stairs-quot-error-for/m-p/14155839
- [N4] Arkance, "Creating a Stair with a Winder using Sketch Stair": https://emea.support.arkance.world/hc/lt/articles/36470419580434-Revit-Creating-a-Stair-with-a-Winder-using-Sketch-Stair
- [N5] cad-notes, "Stair by Sketch in Revit 2018": https://www.cad-notes.com/stair-by-sketch-in-revit-2018/
- [N6] Autodesk Community, "Elliptical Stair Sketch": https://forums.autodesk.com/t5/revit-architecture-forum/elliptical-stair-sketch/m-p/11307476
- [N8] Autodesk Community, "Monolithic Stairs Problem, Concrete not following Riser or Thread": https://forums.autodesk.com/t5/revit-architecture-forum/monolithic-stairs-problem-concrete-not-following-riser-or-thread/m-p/9977602
- [N-KnowledgeCity] KnowledgeCity, Revit 2022 advanced modeling: https://www.knowledgecity.com/en/library/CMP1390M2/revit-2022-advanced-modeling/
- Fontes sem URL capturada (marcadas `[?]` no texto): fórum "Can't create run by sketch" (https://forums.autodesk.com/t5/revit-architecture-forum/can-t-create-run-by-sketch/m-p/9924018 apareceu na busca, mas o trecho não foi lido), relato de "Pick Lines" com 1 espelho e 17 restantes, e doc de API 2014 sobre objeto Stair.

## Confirmado x não confirmado (resumo)

1. **Confirmado (trecho oficial):** Boundary esquerdo e direito não se conectam; cada limite aceita retas e arcos; espelhos cortados ao passar do limite; Stair Path opcional, começa e termina nos espelhos extremos; Run mostra espelhos criados e restantes; patamar não se atualiza sozinho.
2. **Confirmado (trecho oficial, versões antigas):** Convert to Sketch-Based é irreversível após confirmação e perde vínculos; "Stair by Sketch" era comando separado até ~2016/2017.
3. **Não confirmado:** comando legado em Revit 2025/2026; nomes exatos da barra de opções; "Auto Balance" para espelhos; fórmula de altura do degrau; ordem e sentido dos espelhos; mensagens exatas de erro; regra de winder oficial; parâmetro "Waist".
4. **Divergência:** a ajuda oficial diz que espelhos que passam do limite são cortados, mas fóruns dizem que folga ou cruzamento quebram a criação. Precisa de teste.
5. **Limitação de fonte:** nenhuma página `help.autodesk.com` foi lida na íntegra (proxy 403 e DNS falho no WebFetch). Todas as afirmações oficiais vêm de trechos de busca. Recomenda-se abrir as URLs [O1], [O5] e [O6] para validar antes de implementar.
