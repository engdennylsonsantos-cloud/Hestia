# Escada caracol (helicoidal) · pesquisa para os dois estilos

**Data da pesquisa:** 2026-10-21. **Escopo:** pesquisa. Nenhum código foi alterado; este arquivo é o único produto.
**Complementa:** `docs/escadas/RELATORIO-pesquisa-externa.md` (2026-10-20), `docs/decisoes/0011-escadas.md`, `docs/decisoes/0012-escada-monolitica.md`.

**Marcações.** `[DOC]` documentado (texto ou trecho de fonte citada). `[DOC-prévio]` lido em 2026-10-20 pelo relatório anterior e **não reconfirmado hoje**. `[SEC]` fonte secundária (fórum, blog, cópia não oficial, catálogo, resumo de busca). `[INFERIDO]` conclusão minha, com a premissa indicada. `[NÃO ENCONTRADO]` procurei e não achei.

**Acesso desta rodada.** `help.autodesk.com`, `help.graphisoft.com`, `codes.iccsafe.org`, `lume.ufrgs.br` e `riut.utfpr.edu.br` retornaram erro de resolução de nome na leitura direta. `gov.br` (CONNECT) retornou 403 do proxy de saída, uma negativa de política, que não foi contornada. Por isso, a leitura desta rodada veio de trechos de busca (datados abaixo). Os textos completos de Revit 2026, ArchiCAD 29, NBR 9050:2020 e IT 11 SP vêm do relatório de 2026-10-20 e estão marcados `[DOC-prévio]`.

---

## Resumo executivo

- **Revit (por componente):** Full-Step Spiral (centro, raio pelo cursor, pode passar de 360°; nº de espelhos pela cota alvo) e Center-Ends Spiral (centro, início, fim; nº de espelhos pelo ponto final; menos de 360°). `[DOC]` / `[DOC-prévio]`
- **Revit não documenta** poste central para espiral nem número máximo de voltas. `[NÃO ENCONTRADO]`
- **ArchiCAD 29:** não há método "Spiral". Espiral = baseline circular ou em arco + Magic Wand. Acima de 360° não é peça única. Não há poste central nativo. `[DOC-prévio]` / `[SEC]`
- **Saída de emergência:** RS (RT 11, item 5.7.1.2, citado no Parecer CBMRS 007/2017) não aceita helicoidal, leque ou espiral. SP (IT 11, 5.7.1.2) só aceita em mezanino e área privativa. `[DOC]` / `[DOC-prévio]`
- **Números de piso no caracol** (SP IT 11 5.7.3.1 c: 15 cm lanço curvo, 7 cm espiral; NBR 9050:2020 6.8.6: 0,55 m da borda interna) são `[DOC-prévio]`. A NBR 9077:2001 (4.7.9.1 c) foi cancelada pela 9077:2025, cujo item equivalente `[NÃO ENCONTRADO]`.
- **IBC/IRC (EUA, comparação):** 26 in de largura livre, piso de 6¾ in a 12 in da borda estreita, altura livre 78 in, espelho ≤ 9½ in. `[SEC]`, com divergência entre edições.
- **Não encontrei norma** para raio mínimo, sobreposição, ângulo por degrau, diâmetro do poste ou espessura da laje helicoidal. Só há exemplos comerciais e acadêmicos `[SEC]`.
- **Altura livre entre voltas:** não há regra normativa encontrada. Com as premissas da seção 4, o mínimo é 15 espelhos por volta para 2,10 m. `[INFERIDO]`
- **Linha de corte:** a NBR 6492:1994 (item 3.3) fala em plano a cerca de 1,50 m, não 1,20 m. `[SEC]`
- **Proposta Hestia:** v1 com menos de 360° por lance (como o Center-Ends), multivoltas por lances com patamar circular, avisos e não bloqueio, perfil normativo "pendente". `[INFERIDO]`

---

## Fontes desta rodada e de 2026-10-20

| ID | Fonte | URL | Data de acesso | Forma | Marca |
|---|---|---|---|---|---|
| S1 | Autodesk Revit 2020 ENU, GUID-4E05115C (Center-Ends Spiral) | https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-4E05115C-84C9-4930-95FB-E8B91219B1E6.htm | 2026-10-21 | trecho de busca | [DOC] antigo |
| S2 | Autodesk Revit 2020 ENU, GUID-F521015D (Full-Step Spiral) | https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-F521015D-1703-48EA-847D-184E6C277BDB.htm | 2026-10-21 | trecho de busca | [DOC] antigo |
| S3 | Autodesk Revit 2014 LT, GUID-22EC1748 (Run Component Instance Properties) | https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-22EC1748-A525-43BB-A45E-97D104CF303B.htm | 2026-10-21 | trecho de busca | [DOC] antigo |
| S4 | Autodesk Revit 2026 PTB, GUIDs E36AE889, 2C23930C, 26053199, F521015D, 4E05115C (ajuda atual) | help.autodesk.com/cloudhelp/2026/PTB/Revit-ArchDesign/files/ (GUID informado) | 2026-10-20 | leitura completa | [DOC-prévio] |
| S5 | ArchiCAD 29 Help, Stair Tool (itens 040_Elements-178 a -207) e suporte de 19/09/2026 sobre espiral | help.graphisoft.com (URL exata no relatório de 2026-10-20) | 2026-10-20 | leitura completa | [DOC-prévio] |
| S6 | Parecer Técnico CBMRS 007/2017, citando RT 11 Parte 01/2016, item 5.7.1.2 | https://www.bombeiros.rs.gov.br/upload/arquivos/201707/06175129-parecer-tecnico-n-007-2017-escada-de-emergencia-para-mezanino.pdf | 2026-10-21 | trecho de busca | [DOC] (2017) |
| S7 | Instrução Normativa 062/2025 CBMRS (torres de vigilância) | https://bombeiros.rs.gov.br/upload/arquivos/202506/13085116-instrucao-normativa-n-062-cbmrs-dspci-2025-escadas-em-torres-de-vigilancia-da-ocupacao-h-5.pdf | 2026-10-21 | trecho de busca | [DOC] (2025) |
| S8 | IT 11/2019 CBPMESP, cópia USP FFCLRP, itens 5.5.1.1 d, 5.7.1.2, 5.7.3.1 c, 5.7.5.1 | https://ffclrp.usp.br/dc.php?id=17 | 2026-10-20 | leitura completa | [DOC-prévio] |
| S9 | NBR 9050:2020, itens 6.8.2 e 6.8.6 (leque: 0,55 m da borda interna) | PDF da norma (URL não registrada no relatório) | 2026-10-20 | leitura completa | [DOC-prévio] |
| S10 | NBR 9077:2001, 4.5.1.1 d e 4.7.9.1 c; prefácio da 9077:2025 ("cancela e substitui") | não registrada no relatório | 2026-10-20 | leitura completa | [DOC-prévio] |
| S11 | IBC 1011.10 e IRC R311.7.10.2 (edições 2015 a 2021, citadas por fórum e guia) | thebuildingcodeforum.com; buildingcodetrainer.com/spiral-staircase-code/; tfid.org (2018 Residential Stair Guide) | 2026-10-21 | trecho de busca, conteúdo resumido | [SEC] |
| S12 | NBR 6492:1994, itens 3.3 e 3.4 (cópia de aula) | https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/17702/material/NBR%206492%20editada.pdf | 2026-10-21 | trecho de busca | [SEC] |
| S13 | Graphisoft Community, "Stair Tool Basics: Spiral Stair" (ARCHICAD 21 a 25) | https://community.graphisoft.com:443/t5/Design-articles/Stair-Tool-Basics-Spiral-Stair/ta-p/303671 | 2026-10-21 | trecho de busca | [SEC] |
| S14 | Graphisoft Community, "Howto spiral stair with center column" | https://community.graphisoft.com:443/t5/Modeling/Howto-spiral-stair-with-center-column/td-p/258624 | 2026-10-21 | trecho de busca | [SEC] |
| S15 | UFRGS 2014, "Escadas helicoidais em concreto armado: comparação entre métodos de dimensionamento" | https://lume.ufrgs.br/handle/10183/107516 | 2026-10-21 | trecho de busca | [SEC] |
| S16 | Insumo de custo brasileiro, escada helicoidal galvanizada 1,2 m (tubo central 6", e = 2,65 mm; chapa xadrez e = 3 mm) | https://orcamentor.com/insumo/44380/ | 2026-10-21 | trecho de busca | [SEC] comercial |
| S17 | IFC4.3, `IfcStairFlightTypeEnum` (SPIRAL) | raw.githubusercontent.com (buildingSMART/IFC4.x-development) | 2026-10-20 | leitura completa | [DOC-prévio] |

---

## 1. Revit (escada por componente, espiral)

- **Full-Step Spiral.** Centro, depois raio pelo cursor, depois concluir. Sentido anti-horário por padrão; "Inverter" troca o sentido em edição. Uma dica mostra os limites e o nº de degraus inteiros para atingir a cota alvo. Pode passar de 360°. `[DOC]` S2; `[DOC-prévio]` S4 (GUID-F521015D).
- **Center-Ends Spiral.** Centro, início, sentido pelo cursor, fim. O clique final define o total de espelhos. Limitado a menos de 360°. `[DOC]` S1; `[DOC-prévio]` S4 (GUID-4E05115C). A grafia em inglês é "Center-Ends".
- **Barra de opções** (run por componente): Linha de localização, Deslocamento, Largura real do lance, Patamar automático. `[DOC]` S3; `[DOC-prévio]` S4.
- **Largura.** Parâmetro de tipo "Largura mínima do lance". Aviso: "Actual run width is less than minimum run width defined in stairs type." `[DOC-prévio]` S4 (API 2026).
- **Piso mínimo, onde é medido.** "Define a largura mínima do piso ao longo do caminho central para todos os lances de escada comuns (winder, spiral, straight)." O parâmetro não afeta o croqui. `[DOC-prévio]` S4 (GUID-E36AE889, PTB 2026). Em 2014 (S3), para winder de componente, aparece "Inside Walk Line Offset" e "Minimum Width on Inside Walk Line". Não comparei esse parâmetro com a versão 2026. `[DOC]` antigo.
- **Alças.** Raio da espiral é uma das 6 alças do lance. `[DOC-prévio]` S4 (GUID-0FD4C314).
- **Patamar entre dois lances.** Em 2014 (S3 e busca): patamar automático ligado, profundidade padrão = largura do lance. `[DOC]` antigo. Em 2026: Pick Two Runs exige a mesma sessão de edição e nível coincidente. `[DOC-prévio]` S4 (GUID-2C23930C).
- **Croqui.** Converter para croqui é irreversível. Em lance de croqui, Maximum Riser Height e Minimum Tread Depth não se aplicam. `[DOC-prévio]` S4.
- **Poste central.** `[NÃO ENCONTRADO]`. Os suportes "esquerdo, direito e do meio" são laterais (Stringer ou Carriage). `[DOC-prévio]` S4 (GUID-E36AE889). Não tratam de coluna central.
- **Número máximo de voltas.** `[NÃO ENCONTRADO]`. Só há o limite de 360° do Center-Ends.
- **Nomes em português.** Os nomes exatos de "Center-Ends Spiral" e "Full-Step Spiral" na interface em PT-BR não foram confirmados nesta rodada. `[NÃO ENCONTRADO]` nesta rodada.

## 2. ArchiCAD 29 (Stair Tool, espiral)

- **Sem método Spiral.** Não há "Straight/Polygonal/Spiral/Curved" no Stair Tool atual; esses nomes são do StairMaker (até AC20). `[DOC-prévio]` S5 (AC29, -178/-179).
- **Fluxo.** Desenhar círculo ou arco como baseline, entrar no Stair Tool, escolher a baseline "Right" (ou Left, Center), usar Magic Wand (Space + clique), ajustar turnings. `[DOC-prévio]` S5; `[SEC]` S13 sobre a posição Left, que coloca a escada do lado de fora do círculo.
- **Raio.** É o raio da baseline. Rearrange corrige passos desiguais; Stretch ajusta raio grande demais. `[SEC]` S13.
- **Acima de 360°.** "Spiral staircases that extend beyond a 360-degree turn cannot be modeled as a single piece." Solução: duplicar, Linked Top Story "Not Linked", deslocar, Flight-Start Vertical Cut. `[DOC-prévio]` S5 (suporte de 19/09/2026).
- **Turning types.** Automatic Landing, Winder with Equal Angles, Winder with Equal Goings. `[DOC-prévio]` S5 (AC29, -181). "Equal Angles" é o equivalente de ângulo por degrau constante.
- **Comprimento.** Along Arc / Along Chord só mudam o cálculo do comprimento do segmento. `[DOC-prévio]` S5 (-188).
- **Estrutura.** Monolithic Flat, Stepped, Variable Thickness, Filled; Beam; Landing com espessura própria. `[DOC-prévio]` S5 (-191/-193).
- **Poste central (newel).** `[NÃO ENCONTRADO]` como opção nativa. Na comunidade, a solução é coluna separada ou degrau de aço com estrutura embutida. `[SEC]` S14 e S13.
- **Planta.** Walking Line com seta, Description (Up/Down), Numbering (risers ou treads), Break Mark (nome oficial, não "Breakline Position Height"), Detail Level (Full/Schematic; símbolos 2D). `[DOC-prévio]` S5 (-200 a -202, -179).
- **Furo na laje.** Não automático (Solid Element Operations). `[DOC-prévio]` S5 (-199).
- **IFC.** Stair Tool exporta IfcStair, sem IfcStairFlight na tabela AC29. `[DOC-prévio]` S5 (121_IFC-37/-48/-51).

## 3. Normas e códigos (valores)

Nenhuma fonte desta rodada trouxe texto normativo de escada caracol. Os valores brasileiros vêm do relatório de 2026-10-20 (`[DOC-prévio]`).

| Tema | Valor | Fonte | Status |
|---|---|---|---|
| Piso no lanço curvo, parte mais estreita | ≥ 15 cm | IT 11/2019 SP, 5.7.3.1 c | `[DOC-prévio]` S8 |
| Piso na espiral, parte mais estreita | ≥ 7 cm | IT 11/2019 SP, 5.7.3.1 c | `[DOC-prévio]` S8 |
| Piso do degrau em leque, a 0,55 m da borda interna | "dimensionados conforme 6.8.2" (sem número próprio no texto citado) | NBR 9050:2020, 6.8.6 | `[DOC-prévio]` S9 |
| Borda interna do degrau na posição mais desfavorável | ≥ 15 cm | NBR 9077:2001, 4.7.9.1 c | `[DOC-prévio]` S10. Edição cancelada pela 9077:2025 |
| Uso de helicoidal, leque ou espiral como saída | não aceita | RS RT 11, 5.7.1.2 | `[DOC]` S6 (citação de parecer, 2017) |
| Uso de leque ou espiral como saída | não vale, exceto mezanino e área privativa | SP IT 11/2019, 5.7.1.2 | `[DOC-prévio]` S8 |
| Exceção: torre de vigilância (ocupação H-5) | leque ou espiral permitidos, largura ≥ 0,80 m, até 10 pessoas, acesso restrito | RS IN 062/2025, art. 1 | `[DOC]` S7 |
| Escada caracol em rota acessível | `[NÃO ENCONTRADO]` (permitida ou não) | NBR 9050:2020 | busca sem resultado |
| Blondel (2e + p) em caracol | `[NÃO ENCONTRADO]` específico; geral 0,63 a 0,64 (IT 11, 9077:2001) e 0,63 a 0,65 (9050:2020) | S8, S9 | `[DOC-prévio]` (geral) |
| Altura livre mínima (escada em geral) | 2,00 m (9077:2001); 2,10 m (IT 11 SP; NT 11 GO) | S8, S10 | `[DOC-prévio]` |
| Espiral: largura livre mínima | 26 in = 660 mm | IBC 1011.10 / IRC | `[SEC]` S11 |
| Espiral: piso a 12 in (305 mm) da borda estreita | 6¾ in = 171 mm (um texto dá 7½ in para edição anterior) | IBC 1011.10 | `[SEC]` S11 (divergente) |
| Espiral: raio no walkline | ≤ 24½ in ≈ 0,62 m (máximo, não mínimo) | IRC (edição 2015+) | `[SEC]` S11, não confirmado |
| Espiral: espelho máximo | 9½ in = 241 mm | IBC/IRC | `[SEC]` S11 |
| Espiral: altura livre | 78 in = 1 981 mm (IBC); 6 ft 6 in (IRC) | IBC/IRC | `[SEC]` S11 |
| Espiral: uso restrito | até 250 ft² e até 5 ocupantes, em unidade residencial ou área de produção técnica | IBC 1011.10 | `[SEC]` S11 |
| Planta: plano secante | "aproximadamente 1,50 m do piso" (pode variar por projeto) | NBR 6492:1994, 3.3 | `[SEC]` S12 (divergente de 1,20 m) |
| Corte | plano vertical que divide a edificação | NBR 6492:1994, 3.4 | `[SEC]` S12 |

**Divergências registradas:**
- Piso do caracol de 7 cm (IT 11 SP, espiral) e 15 cm (lanço curvo), contra a 9077:2001 (15 cm na borda interna). Edição diferente e critério diferente (parte mais estreita ou borda interna).
- Piso medido na "borda estreita a 12 in" (IBC) contra "borda interna a 0,55 m" (9050). Os dois pontos não coincidem. A borda estreita do IBC é a interna.
- Espelho e piso: 6¾ in contra 7½ in na mesma regra, conforme a edição.
- Linha de corte: 1,20 m (pedido) contra ~1,50 m (NBR 6492:1994).

## 4. Altura livre entre voltas e degraus por volta

- **Definição do ponto de medição em escada multivolta:** `[NÃO ENCONTRADO]` em todas as fontes lidas.
- **Números de referência:** IBC 78 in (1 981 mm); IRC 6 ft 6 in; NBR 9077:2001 2,00 m; IT 11 SP e NT 11 GO 2,10 m livre. `[SEC]` / `[DOC-prévio]`.
- **Cálculo `[INFERIDO]`.** Premissas: o degrau acima, no mesmo ponto em planta, fica a P = N·h acima (uma volta completa), e a folga sob ele é P − (h + T) no caso monolítico liso (fundo plano por degrau, decisão 0012), com T = structuralDepth / cosθ.
  - Folga ≈ (N − 1)·h − T.
  - Exemplo: h = 0,175 m, T = 0,236 m (decisão 0012, p = 0,28 m, profundidade 0,20 m).
  - N = 14: folga 2,039 m. Atende 2,00 m, não atende 2,10 m.
  - N = 15: folga 2,214 m. Atende 2,10 m.
  - **Mínimo para 2,10 m: 15 espelhos por volta (24° por degrau).** Para 2,00 m: 14 espelhos (25,7°).
- **Poste central, premissa de espessura e = 0,03 m:** folga ≈ N·h − e. Para 2,10 m: N ≥ (2,10 + 0,03) / 0,175 = 12,17, ou seja, 13 espelhos (27,7°). A sobreposição entre degraus altera isso; sem número encontrado.
- **Ângulo por degrau 22,5° a 30°** (pedido): `[NÃO ENCONTRADO]` como norma. Coincide com o intervalo acima, mas é só consequência da altura livre com as premissas.

## 5. Construção

| Item | Valor encontrado | Fonte | Status |
|---|---|---|---|
| Diâmetro do tubo central | 6" (≈ 152 mm), e = 2,65 mm, em escada de 1,2 m de diâmetro | insumo S16 | `[SEC]` comercial |
| Espessura do degrau em aço | chapa xadrez e = 3 mm (S16); chapa de aço t = 25 mm (caso isolado, Piccadilly Circus, Londres) | S16; dlubal.com (referências de projeto) | `[SEC]` |
| Diâmetro externo de fabricante | 1,10 m a 3,00 m, sob medida (fabricante de aço pintado, resultado de busca) | busca 2026-10-21 | `[SEC]`, URL não registrada |
| Largura útil | diâmetro 1,80 m com passagem de 0,80 m | busca 2026-10-21 | `[SEC]` |
| Raio interno mínimo | `[NÃO ENCONTRADO]`. Um manual de software chama de "raio interno" o raio da coluna central (Promob) | S11 / busca | `[SEC]` definição de software |
| Sobreposição entre degraus | `[NÃO ENCONTRADO]` | — | — |
| Largura mínima do degrau em caracol | `[NÃO ENCONTRADO]` na norma brasileira | — | — |
| Espessura da laje helicoidal em concreto | `[NÃO ENCONTRADO]` | UFRGS 2014 (S15): exemplo de 360°, altura 6 m, largura 2 m, NBR 6118:2007 e NBR 6120 | `[SEC]` |
| Relação espessura × vão | `[NÃO ENCONTRADO]` | — | — |

Referências acadêmicas para o caso de concreto: UFRGS 2014 (S15), UTFPR 2019 e UFU 2022 (dois métodos empíricos e um computacional). Nenhuma trouxe espessura ou raio na leitura desta rodada. `[SEC]`

## 6. Representação em planta e 3D

| Item | NBR 6492 | Revit | ArchiCAD | Proposta Hestia |
|---|---|---|---|---|
| Plano de corte (planta) | plano secante a ~1,50 m, "pode variar" (1994) `[SEC]` | distância da marca de corte e seta (`Distance to Cut Mark`) `[DOC-prévio]` | Detail Level, símbolos 2D `[DOC-prévio]` | 1,50 m como padrão a confirmar (1,20 m do pedido diverge) `[INFERIDO]` |
| Seta de sentido | `[NÃO ENCONTRADO]` | texto Up/Down na linha de caminhada `[DOC-prévio]` | Walking Line com seta `[DOC-prévio]` | seta na linha de caminhada + texto SOBE/DESCE |
| Numeração | `[NÃO ENCONTRADO]` | Tread Number, referência e justificativa `[DOC-prévio]` | Numbering (riser ou tread) `[DOC-prévio]` | contínua pela cota, como em 0011 §7 `[INFERIDO]` |
| Voltas acima do corte | `[NÃO ENCONTRADO]` | subcategoria `<Above>` no V/G `[DOC-prévio]` | Detail Level Schematic `[DOC-prévio]` | tracejado ou ocultação, a definir `[INFERIDO]` |
| Poste central na planta | `[NÃO ENCONTRADO]` | — | — | círculo hachurado no eixo `[INFERIDO]` |
| 3D: monolítico × poste | — | Monolithic Run (Structural Depth) `[DOC-prévio]` | Structure por tipo `[DOC-prévio]` | `runStyle` e `spiralStyle` (ver tabela principal) `[INFERIDO]` |

---

## Tabela de parâmetros: Revit | ArchiCAD | NBR | proposta Hestia

| Parâmetro | Revit | ArchiCAD | NBR / código | Proposta Hestia |
|---|---|---|---|---|
| Forma de criação | Full-Step Spiral (raio, >360° ok) e Center-Ends (fim, <360°) `[DOC]` | baseline circular + Magic Wand `[DOC-prévio]` | — | duas entradas: raio + altura (tipo Full-Step) e centro + início + fim (tipo Center-Ends) `[INFERIDO]` |
| Raio | pelo cursor; alça de raio `[DOC-prévio]` | raio da baseline `[SEC]` | raio mínimo `[NÃO ENCONTRADO]`; IRC walkline ≤ 0,62 m `[SEC]` | raio interno do lance + largura; sem mínimo normativo `[INFERIDO]` |
| Ângulo por degrau | derivado de espelhos e raio | Winder with Equal Angles `[DOC-prévio]` | `[NÃO ENCONTRADO]` | 360° / espelhos por volta `[INFERIDO]` |
| Sentido | anti-horário padrão; Inverter `[DOC-prévio]` | Upward/Downward, Left/Right `[DOC-prévio]` | — | horário ou anti-horário; inverter `[INFERIDO]` |
| Nº de espelhos | Full-Step: pela cota alvo; Center-Ends: pelo fim `[DOC]` | drop-down recíproco de nº e altura `[DOC-prévio]` | 2e + p, faixa geral `[DOC-prévio]` | N = teto(H / espelho máximo) `[INFERIDO]` (confirmar arredondamento, A5) |
| Largura | Actual Run Width; Minimum Run Width no tipo `[DOC-prévio]` | `[NÃO ENCONTRADO]` para espiral | IT 11 uso restrito 0,80 m `[DOC-prévio]`; IBC 26 in `[SEC]` | Actual run width + minRunWidth do tipo (já existe) |
| Linha de medição do piso | caminho central (walk line) `[DOC-prévio]` | Walking Line `[DOC-prévio]` | 9050: 0,55 m da borda interna (leque); IT 11 SP: 15/7 cm; IBC: 12 in da borda estreita `[DOC-prévio]/[SEC]` | linha de caminhada explícita; ponto de medição como parâmetro, default a decidir `[INFERIDO]` |
| Número máximo de voltas | sem limite documentado; Center-Ends < 360° `[DOC]` | >360° não é peça única `[DOC-prévio]` | `[NÃO ENCONTRADO]` | v1: < 360° por lance; multivolta por lances com patamar `[INFERIDO]` |
| Patamar | Automatic Landing; profundidade = largura (2014) `[DOC]`; Pick Two Runs `[DOC-prévio]` | Automatic Landing turning `[DOC-prévio]` | 9050: patamar a cada 3,20 m de desnível e em mudança de direção `[DOC-prévio]` | laço fechado, já previsto em 0011 `[INFERIDO]` |
| Poste central | `[NÃO ENCONTRADO]` | `[NÃO ENCONTRADO]` nativo `[SEC]` | `[NÃO ENCONTRADO]` | `spiralStyle: 'centralPost'` com `postRadius` no tipo `[INFERIDO]` |
| Espessura estrutural | Structural Depth `[DOC-prévio]` | Structure e espessura por tipo `[DOC-prévio]` | — | `structuralDepth` já existe (perpendicular, decisão 0012) |
| Croqui | converter é irreversível; sem checagem de espelho `[DOC-prévio]` | — | — | croqui livre; avisos só no gerado (0011 §1 item 9) `[INFERIDO]` |
| Uso como saída | restrito em RS e SP `[DOC]`/`[DOC-prévio]` | — | IRC/IBC: só unidade residencial ou ≤ 250 ft² `[SEC]` | aviso "não é saída de emergência" por padrão, nunca bloqueio `[INFERIDO]` |

---

## Comportamentos observáveis (para testes)

1. Revit Full-Step: a cota alvo define o nº de espelhos; o cursor define o raio; o padrão é anti-horário. `[DOC]`
2. Revit Center-Ends: o clique final define o nº de espelhos; não passa de 360°. `[DOC]`
3. Revit: o piso mínimo é medido no caminho central, e o aviso de largura compara com "Actual run width". `[DOC-prévio]`
4. Revit: converter em croqui é irreversível; o croqui não recebe a checagem de espelho máximo nem de piso mínimo. `[DOC-prévio]`
5. ArchiCAD: a baseline à esquerda ou à direita muda de que lado da circunferência fica o degrau. `[SEC]`
6. ArchiCAD: acima de 360°, a escada precisa ser duplicada. `[DOC-prévio]`
7. Revit e ArchiCAD: não há poste central nativo. `[NÃO ENCONTRADO]`
8. RS e SP: espiral não é saída de emergência, exceto as exceções acima. `[DOC]`

---

## Perguntas que não consegui responder

1. Texto da NBR 9050:2020 sobre escada caracol e helicoidal em rota acessível (proibida ou permitida, e em que condições). `[NÃO ENCONTRADO]`.
2. Itens equivalentes ao 4.7.9.1 da NBR 9077:2001 na edição 9077:2025 vigente (borda interna, piso, raio). `[NÃO ENCONTRADO]`.
3. Texto integral da IT 11/2019 SP, 5.7.1.2 e 5.7.3.1 c, lido novamente nesta rodada. `[DOC-prévio]`, não reconfirmado.
4. Texto integral da IBC 1011.10 e da IRC R311.7.10.2 na edição adotada no Brasil de referência (se houver), com a medição exata do piso e a altura livre. `[SEC]` divergente.
5. Ponto de medição da altura livre em escada multivolta, em qualquer norma brasileira ou código de obras. `[NÃO ENCONTRADO]`.
6. Sobreposição entre degraus, espessura de degrau em aço e diâmetro de poste, com memória de cálculo de fabricante. `[NÃO ENCONTRADO]`.
7. Espessura da laje helicoidal em concreto armado por vão e raio, com exemplo de cálculo. `[NÃO ENCONTRADO]`.
8. Nomes de interface em PT-BR do Revit 2026 para Full-Step Spiral e Center-Ends Spiral. `[NÃO ENCONTRADO]`.
9. Número máximo de voltas por lance, e se existe, no Revit 2026 e no ArchiCAD 29. `[NÃO ENCONTRADO]`.
10. Se o Revit 2026 tem poste ou coluna central para escada espiral. `[NÃO ENCONTRADO]`.
11. Tabela NBR 6492 vigente (edição 2021, se existir) para escada: linha de corte, seta e numeração. `[NÃO ENCONTRADO]`.

**Prompt para outro agente (com acesso à web), copie tudo entre as linhas:**

=== INÍCIO ===

Você é um pesquisador técnico. Responda em português do Brasil. Confirme em fonte PRIMÁRIA os pontos abaixo sobre escada em caracol (helicoidal) em BIM e em normas. Leia as páginas completas, não só trechos de busca.

Regras: (a) não invente; cada resposta traz URL completa, edição/versão, data de leitura e citação literal curta (até 25 palavras, no idioma original); (b) classifique em `[OFICIAL]`, `[SECUNDÁRIO]`, `[NÃO ENCONTRADO]` (diga o que tentou) ou `[INFERIDO]`; (c) se uma página retornar erro de DNS, 403 ou login, registre o host e o erro e NÃO tente contornar bloqueio de segurança.

Perguntas:
1. NBR 9050:2020: texto dos itens sobre escadas em leque e caracol/helicoidal, incluindo se são permitidas em rota acessível e a medida do piso (0,55 m da borda interna?). Cite o item exato.
2. NBR 9077 vigente (edição 2025): itens equivalentes a "escada em leque e espiral" (largura, piso medido na borda interna, espelho, raio, altura livre). Se não houver, diga.
3. IT 11/2019 CBPMESP: itens 5.7.1.2, 5.7.3.1 c e 5.7.5.1, texto literal. Confirme os valores de 15 cm (lanço curvo) e 7 cm (espiral).
4. RT 11 CBMRS (Parte 01/2016): item 5.7.1.2, texto literal, e se a IN 062/2025 mantém a exceção de torres de vigilância.
5. ICC: IBC 1011.10 (Spiral stairways) e IRC R311.7.10.2 nas edições 2021 e 2024: largura livre, piso a 12 in da borda estreita, walkline, raio máximo, espelho máximo, altura livre (headroom). Confirme o ponto de medição do headroom.
6. ABNT NBR 6492 (edição vigente): planta (plano secante), corte, convenções de escada (linha de corte, seta, numeração, voltas acima do corte).
7. Autodesk Revit 2026 (ENU ou PTB) e Revit API 2026: páginas de Full-Step Spiral e Center-Ends Spiral; o número máximo de voltas; se há poste ou coluna central para espiral; o significado de "Minimum Tread Depth" em espiral; os nomes PT-BR dos botões.
8. Graphisoft ArchiCAD 29 Help: Stair Tool, método de espiral, baseline, "Equal Angles", coluna central ou newel, e a convenção de planta.
9. IFC4.3: IfcStairFlightTypeEnum (SPIRAL) e Psets relevantes para espiral.
10. Dimensões de construção de escada caracol com poste central (diâmetro do tubo, espessura do degrau, sobreposição, ângulo por degrau) e de laje helicoidal em concreto (espessura por vão e raio): leia UFRGS 2014 (https://lume.ufrgs.br/handle/10183/107516), UTFPR 2019 e UFU 2022, e fabricantes. Marque como [SECUNDÁRIO] e diga o que foi lido.

Formato: um único bloco Markdown com tabela-resumo (ID | categoria | resposta | fonte), detalhes por ID, divergências entre fontes e lista final de `[NÃO ENCONTRADO]`. Limite: 3.000 palavras.

=== FIM ===

---

## Proposta Hestia (para decidir, não implementada)

- **Estilos:** `StairType.spiralStyle: 'monolithic' | 'centralPost'`, reusando `runStyle` e `structuralDepth` (decisão 0012). `centralPost` adiciona `postRadius` e `overlap` (sobreposição). `[INFERIDO]`
- **Lance:** `generatedBy: 'spiral'` com centro, raio interno, largura, sentido, espelhos totais e espelhos por volta. Limite v1 de menos de 360° por lance, como o Center-Ends. `[INFERIDO]`
- **Motor:** a ordenação dos espelhos por linha média (`stairSketch.ts`) é confiável até 180°. Acima disso, usar a caminhada explícita ou separar em lances (o `generateFanRun` já recusa 360° ou mais). `[INFERIDO]`
- **Monolítico:** `stairBody` aproxima o fundo do leque e da curva por degrau (decisão 0012 §5). Para a espiral contínua, a aproximação deve ser testada pela folga de cabeça. `[INFERIDO]`
- **Normas:** perfil de espiral fica "pendente" até as perguntas 1 a 5 serem respondidas. Usar só avisos, nunca bloqueio, e aviso de uso como saída. `[INFERIDO]`
- **Decisões para o dono:** (a) ponto de medição do piso (9050, IBC ou linha de caminhada); (b) linha de corte 1,20 m ou 1,50 m; (c) multivolta por patamar ou por espiral inteira; (d) cálculo de folga com (N − 1)·h − T ou (N·h − e).
