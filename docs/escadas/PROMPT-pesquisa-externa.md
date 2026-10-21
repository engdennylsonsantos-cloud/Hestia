# Prompt para o agente externo (pesquisa de escadas com acesso à web)

Copie TUDO que está entre as linhas `=== INÍCIO ===` e `=== FIM ===` e cole em um agente que tenha acesso à web (navegador,
WebFetch ou busca). Ao terminar, ele devolve um relatório único em Markdown; copie esse relatório e cole na conversa com o
Claude Code. O prompt é autocontido: o agente não precisa ver o repositório.

=== INÍCIO ===

Você é um pesquisador técnico. Sua tarefa é CONFIRMAR EM FONTE PRIMÁRIA um conjunto de pontos sobre escadas em BIM
(Revit, ArchiCAD, normas brasileiras e IFC). Um agente anterior fez a pesquisa sem acesso às páginas oficiais (o egresso de
rede bloqueou help.autodesk.com, help.graphisoft.com, standards.buildingsmart.org e a ABNT) e só conseguiu trechos de busca.
Você deve ler as páginas COMPLETAS. Responda em português do Brasil.

## Regras (inegociáveis)
1. NÃO invente. Cada resposta traz: URL completa da página lida, a versão do produto/norma, a data em que você leu e uma
   citação literal curta (até 25 palavras, entre aspas, no idioma original). Sem citação literal, a resposta vale como
   "não confirmado".
2. Classifique cada item em UMA categoria: `[OFICIAL]` (documentação do fabricante ou texto da norma/especificação),
   `[SECUNDÁRIO]` (fórum, blog, curso, artigo, edital: diga qual), `[NÃO ENCONTRADO]` (diga o que tentou) ou
   `[EXIGE TESTE NO PROGRAMA]` (só dá para saber abrindo o Revit/ArchiCAD: descreva o experimento, ver "Protocolo de testes").
3. Se duas fontes divergem, registre as duas, diga qual é mais confiável e por quê. Não escolha em silêncio.
4. Prefira a versão MAIS RECENTE: Revit 2025/2026, ArchiCAD 27–29, IFC4.3 (ADD2), NBR 9050:2020, NBR 9077 (diga qual edição
   está vigente). Quando só achar versão antiga, diga a versão.
5. Se uma página estiver bloqueada (403, DNS, login), diga o host e o erro e tente as alternativas abaixo (web.archive.org,
   espelhos). NÃO tente contornar bloqueio de segurança nem use credenciais que não sejam suas. Se nada funcionar, marque
   `[NÃO ENCONTRADO]` e liste o que o usuário precisa abrir manualmente.

## Método de busca refinado (siga nesta ordem para cada item)
A. Busca com operador de site e termos exatos em inglês, por exemplo: `site:help.autodesk.com "Stair by Component" "Minimum Tread Depth"`,
   `site:help.autodesk.com "Convert to Sketch-Based"`, `site:help.autodesk.com "Edit Sketch" stairs "Riser" "Boundary"`,
   `site:help.graphisoft.com "Stair Settings" "Number of Risers"`, `site:help.graphisoft.com "Stair Tool" "Flight" "Landing"`.
B. Abra a página COMPLETA do resultado (não use só o trecho da busca). Leia o menu lateral da ajuda: as páginas irmãs
   (Stair Type Properties, Stair Instance Properties, Edit Run, Landings, Supports, Multistory Stairs, Cut Mark, Stair Path,
   Railing) costumam estar no mesmo ramo da árvore. Troque o seletor de versão da ajuda para 2025/2026.
C. Fontes de API (confirmam nomes de parâmetros e regras): Revit API Docs (revitapidocs.com ou apidocs.co) para
   `Autodesk.Revit.DB.Architecture.StairsType` (MinRunWidth, MaxRiserHeight, MinTreadDepth, CalculationRule, tipos de apoio,
   patamar), `Stairs`, `StairsRun`, `StairsLanding`, `StairsRunStyle`, `StairsEditScope`, `StairsRunJustification`;
   ArchiCAD API/GDL (archicadapi.graphisoft.com) para o elemento Stair; IFC: ifc43-docs.standards.buildingsmart.org e
   standards.buildingsmart.org/IFC/DEV/IFC4_3/ para IfcStair, IfcStairFlight, IfcStairType, IfcStairFlightType,
   IfcRailing, IfcSlab (LANDING), IfcMember (STRINGER) e os Psets.
D. Para nomes em português do Revit/ArchiCAD: procure a ajuda localizada (alterne o idioma para pt-BR) ou captura de tela
   de interface em português; cite a URL.
E. Normas brasileiras: ABNT NBR 9050:2020 e NBR 9077 costumam estar hospedadas em PDF por órgãos públicos (busque
   `NBR 9050:2020 pdf gov.br escadas 6.8`, `NBR 9077 pdf corpo de bombeiros escada largura`), Corpos de Bombeiros estaduais
   (IT 11 do CBPMESP/2019, NT 11 de Goiás/2022, IN 9 de SC) e códigos de obras municipais. Cite o NÚMERO DO ITEM da norma.
F. Alternativas de espelho: web.archive.org/web/*/<url>, Google cache, e o "Autodesk Knowledge Network"
   (knowledge.autodesk.com) e "Autodesk University" (apresentações e handouts) como `[SECUNDÁRIO]`.

## O que confirmar (cada linha é um item; use o ID no relatório)

### Revit, escada por componente (IDs A1–A23)
A1 Nomes em português (pt-BR) dos parâmetros e botões da escada por componente (Stair by Component).
A2 Cliques para desenhar Straight, Full-Step Spiral, Center-Ended Spiral, L-Shape Winder e U-Shape Winder.
A3 Procedimento de Pick Two Runs (patamar entre dois lances).
A4 Forma, dimensões e regra de cálculo do patamar automático (Automatic Landing) em L e U.
A5 Fórmula exata de Desired Number of Risers (arredondamento: round, floor, ceil?) a partir da altura entre níveis e de
   Maximum Riser Height.
A6 Como a "Stair Calculator" (calculadora de regras) funciona e a regra prática usada (2·espelho + piso?).
A7 Nome oficial e comportamento do parâmetro Minimum Run Width e do aviso associado; mensagem exata do aviso.
A8 Actual Run Width e a largura do patamar automático.
A9 Procedimento de Convert to Sketch-Based para lance e para patamar.
A10 Em lance sketchado (custom), o que acontece com Maximum Riser Height e Minimum Tread Depth.
A11 Regra de criação dos apoios (Left/Right/Middle Support, Stringer/Carriage) por posição e tipo.
A12 Espessura e tipo do patamar (Landing Type).
A13 Nosing e Riser Thickness (parâmetros e efeito).
A14 Multistory: Top Level, Multistory Top Level Offset, repetição de lances entre andares.
A15 Lista de avisos de escada na versão atual (incluindo largura mínima, altura de espelho, piso).
A16 Propriedades de Up/Down text, offsets e visibilidade do Tread Number na versão 2024–2026.
A17 Como ocultar/limitar a anotação acima da linha de corte.
A18 Visibilidade por nível de detalhe da escada (Coarse/Medium/Fine).
A19 Alças (grips) editáveis por tipo de lance.
A20 Diferença exata entre Monolithic e Assembled no tipo da escada.
A21 Conteúdo relevante do Revit Learning / Revit Blog da Autodesk sobre escadas por croqui e componente.
A22 Direção do aviso Actual Tread Depth × Minimum Tread Depth: a ajuda diz "exceeds" e uma fonte secundária diz "não pode
   ficar menor". Qual é a regra e o texto exato do aviso?

### Revit, escada por croqui (IDs B1–B14) — o item mais importante
B1 O comando legado "Stair by Sketch" ainda existe em Revit 2025/2026? Onde (aba, menu)? Em qual versão foi fundido?
B2 Nomes exatos dos campos na barra de opções ao desenhar um Run por croqui ("Actual Number of Risers Created", "Remaining",
   "Desired" etc.) e o que cada um mostra.
B3 Existe "Auto" / "Auto Balance" / distribuição automática de espelhos no croqui? Descreva.
B4 Fórmula da altura de cada degrau no croqui e regra do número de espelhos.
B5 Ordem de desenho e sentido de subida dos espelhos; o sentido do Stair Path e o que ocorre se o sentido for invertido.
B6 Diferença entre "espelho que passa do limite" (a ajuda diz que é CORTADO) e "espelho que não toca o limite ou cruza outro
   espelho" (fóruns dizem que é ERRO). Qual é a regra oficial? Mensagens exatas de erro e quando aparecem.
B7 Como o contorno de patamar (landing sketch) se liga ao croqui do Run (regra de união, bordas coincidentes).
B8 Winder por croqui: método oficial (limite externo + espelhos radiais?) e limites.
B9 O parâmetro "Waist"/espessura da laje da escada por croqui e as espessuras de espelho/piso.
B10 Nome do comando para editar o croqui na escada pronta (Edit Sketch / Edit Stairs) na versão atual.
B11 O croqui de escada é acessível pela API na versão atual? (a fonte achada era de 2014)
B12 "Pick Lines" para espelhos e limites: como funciona.
B13 O que se perde ao converter (Convert to Sketch-Based) e se é reversível.
B14 Regras de validade do croqui: limites esquerdo/direito não podem se tocar? arcos? limites precisam ser divididos
   (Split) nos patamares? Liste todas as regras e mensagens.

### ArchiCAD (IDs C1–C18)
C1 Confirme, na página completa, todos os trechos oficiais já citados (baseline por polilinha, segmentos Flight/Landing/Winder,
   Turning Type Landing/Winder, Automatic Landing, Equal Goings/Equal Angles, Stair Settings, estruturas Monolithic/Beam/
   Cantilevered/Stringer, Breakline Position Height, edição de baseline × boundary).
C2 Nomes oficiais dos métodos de geometria (Straight, Polygonal, Spiral, Curved) no Stair Tool atual.
C3 Fluxo de espiral no Stair Tool atual (AC26–AC29).
C4 Método oficial para escada curva (Along Arc / Along Chord tratam só do comprimento?).
C5 Existe campo de fórmula (Stair Formula / Blondel) no painel de configurações?
C6 "Optimal riser", travar número de espelhos ou altura como opções nomeadas.
C7 Número de degraus (treads) com patamares: regra.
C8 Espessura da laje e carcaça no Stair Tool atual.
C9 Corrimão associado à escada ("Railing on Stair"): fluxo e propriedades.
C10 Arrastar para mudar curvatura; Add/Delete Flight, Add/Delete Landing, Insert/Delete Winder; conversão reto/curvo.
C11 Contorno do patamar como objeto separado.
C12 Seta de caminhada, texto Up/Down e numeração de degraus na planta.
C13 Níveis de detalhe da escada.
C14 Furo automático na laje pela escada ("Create Stair Hole") e recorte de paredes.
C15 Patamar exportado como IfcSlab no IFC.
C16 Relação IfcStair × IfcStairFlight na exportação do ArchiCAD.
C17 "Create Stair Using Selection" ainda existe na versão atual?
C18 Quais trechos do StairMaker (AC18) valem para o Stair Tool atual?

### Normas e IFC (IDs D1–D24)
D1 Texto oficial da NBR 9050:2020, itens 6.6.3 (dimensionamento), 6.6.5 (patamares) e 6.9 (corrimão): espelho, piso, 2e+p,
   patamar, corrimão e ponto de medição.
D2 Tabela de larguras de escada da NBR 9077 (edição vigente) por população e ocupação.
D3 IT 11/2019 (CBPMESP) e NT 11/2022 (CBMGO): tabelas de tipos de escada e larguras; regra de 0,63 ou 0,64 do RJ.
D4 Largura mínima de escada residencial unifamiliar (fonte federal ou município de referência, cite qual).
D5 Pé-direito livre (altura de cabeça) para escada na NBR 9050:2020 e em código de obras.
D6 Inclinação máxima de escada na NBR 9050 e NBR 9077.
D7 Escada em leque: piso mínimo a 50 cm do lado menor (confirme o valor e a norma) e largura mínima do piso no lado interno.
D8 Guarda-corpo: altura, carga e norma aplicável (NBR 14718?).
D9 Corrimão: a partir de qual largura é obrigatório em dois lados; ponto de medição da altura (quina ou centro).
D10 Nariz (bocel): avanço máximo (1,5 cm ou 2 cm?).
D11 Piso constante em todo o lance: exigência literal da norma?
D12 NBR 15575: há regra de escada para habitação?
D13 NBR 9077:2025: vigência e conteúdo; existe errata 09/2026?
D14 IfcStairFlight e IfcStair no schema oficial (IFC4 e IFC4.3): nomes exatos, atributos (NumberOfRisers, NumberOfTreads,
   RiserHeight, TreadLength, WaistThickness, TreadLengthAtOffset, TreadLengthAtInnerSide, NosingLength etc.).
D15 IfcStairTypeEnum: lista completa de enumeradores na versão alvo.
D16 IfcStairFlightTypeEnum: valores.
D17 IfcRailingTypeEnum: valores (HANDRAIL, GUARDRAIL...).
D18 IfcSlabTypeEnum: confirmar LANDING.
D19 IfcMemberTypeEnum: confirmar STRINGER.
D20 Pset_StairFlightCommon: lista completa; WaistThickness está no IFC4.3?
D21 Mapeamento do Revit para IFC (IfcStair, IfcStairFlight, IfcSlab LANDING, IfcRailing).
D22 Mapeamento do ArchiCAD para IFC na versão alvo.
D23 Fórmula de patamar em escada de mudança de direção citada em fonte de MG "p = (2h + b)·n + b": verificar na fonte antes de
   qualquer uso; diga se é confiável.
D24 Faixas de erro de 2e+p além de 63–65 (apareceram 58–62 e 60–65 em fontes históricas): qual é a faixa de cada norma/edição.

## Protocolo de testes (para os itens `[EXIGE TESTE NO PROGRAMA]`)
Você não precisa executar, mas DEVE descrever o roteiro exato para o usuário rodar no Revit/ArchiCAD e o que observar. Modelo:
"No Revit 2025: Architecture > Stair > Stair by Component > Run > Custom. Desenhe Boundary esquerdo e direito paralelos
a 1,20 m, 3 m de comprimento; desenhe 5 linhas de espelho que vão de um limite ao outro; repita com UM espelho que passa 20 cm
além do limite; repita com um que não toca o limite; repita com dois espelhos que se cruzam. Registre a mensagem exata do
Revit e se o botão de concluir (check verde) é aceito." Faça roteiros equivalentes para: sentido e ordem dos espelhos,
Stair Path invertido, distribuição automática de espelhos, divisão (Split) de limites no patamar, conversão
(Convert to Sketch-Based) e reversibilidade, winder por croqui, e para o ArchiCAD: tipos de segmento, edição de baseline
× boundary e furo na laje.

## Formato do relatório final (um único bloco Markdown, pronto para colar)
1. Cabeçalho: data, ferramentas de acesso usadas, hosts bloqueados (se algum).
2. Tabela-resumo: `ID | categoria | resposta em uma linha | fonte (URL)`. Todos os IDs acima, mesmo os não encontrados.
3. Seção de detalhes por ID (só os que têm conteúdo útil): resposta, citação literal, URL, versão, data.
4. Seção "Divergências entre fontes".
5. Seção "Experimentos para o usuário rodar" (os roteiros do protocolo).
6. Seção "Recomendações de projeto" (máx. 15 linhas): o que você faria se estivesse implementando, SEPARANDO claramente fato de opinião.
7. Lista final de IDs `[NÃO ENCONTRADO]` e o que o usuário precisa abrir manualmente.
Limite: até ~6.000 palavras. Sem enfeite, sem introdução longa.

=== FIM ===
