# Escadas: regras de dimensionamento e modelo IFC para o Hestia

Data da pesquisa: 2026-10-21. Escopo: somente leitura na web; nenhum arquivo do repositório `/home/user/Hestia` foi alterado.

---

## 0. Estado das fontes (ler primeiro)

**As fontes primárias não puderam ser abertas.** O proxy de egress da sessão bloqueou (403, política de host) ou não resolveu:

- `standards.buildingsmart.org` (schema IFC4, IFC4.3 e Psets oficiais): bloqueado.
- `pt.wikipedia.org`: bloqueado.
- `help.graphisoft.com` (ArchiCAD) e `help.autodesk.com` (Revit): bloqueados.
- `abntcatalogo` / ABNT: bloqueado. Nenhuma norma ABNT foi lida.
- `docs.xbim.net`, `professor.pucgoias.edu.br`, `bombeiros.mg.gov.br`, `site.sanepar.com.br`: WebFetch não resolveu o nome (ENOTFOUND).
- A API do GitHub do buildingSMART também retornou 403 (sessão limitada a repositórios configurados). Não houve tentativa de contornar a política.

Consequência: **todo o conteúdo abaixo vem de trechos de resultados de busca** (calculadoras online, páginas de faculdades, questões de concurso, matérias, PDFs municipais e estaduais, catálogos de normas). Nada foi lido no texto oficial de norma ou de schema. Os números de item de norma citados (6.6.3, 6.6.5, 6.9) são os que aparecem nessas fontes secundárias, não foram conferidos no texto oficial.

Legenda de confiança:

- **[A]** várias fontes secundárias concordam (ainda assim, confirmar no texto oficial).
- **[M]** uma fonte secundária, ou fontes que divergem em detalhe.
- **[?]** não confirmado em nenhuma fonte encontrada.

---

## 1. Dimensões: resumo por tema

### 1.1 Degraus (espelho, piso, fórmula de Blondel)

- **Espelho (e), NBR 9050 (acessibilidade): 16 a 18 cm [A].** Citado como item 6.6.3 em artigo da Revista Mirante (UEG), que cita a edição de 2004. Também em PUC-GO e Omni Calculator. Não confirmado se o item se mantém na edição 2020.
- **Piso (p), NBR 9050: 28 a 32 cm [A].** Mesma origem. Um texto dá mínimo 27 cm [M], divergente.
- **2e + p (Blondel), NBR 9050: 63 a 65 cm [A].** Citado por PUC-GO e Omni.
- **2e + p, NBR 9077 (saídas de emergência): 63 a 64 cm [M].** Citado em projeto do IFB, que usa 63 a 64 para NBR 9077 e 65 para NBR 9050 e NT10. A faixa mais estreita é a que a fonte atribui à NBR 9077.
- **Espelho máximo para uso residencial: 19 cm [M].** Exemplo municipal (Pato Branco-PR, Lei 959/90), piso mínimo 25 cm, 2e + p ≈ 64 cm. Trata-se de exemplo municipal, não de norma federal.
- **Piso mínimo 25 cm [M].** Comentário de site sobre o Corpo de Bombeiros: "alguns estados" exigem 28 cm. Não identificado o estado nem o documento.
- **Faixa de RJ para escada enclausurada (fumaça) [M]:** 0,63 m < 2H + L < 0,64 m, espelho máximo 18 cm, piso mínimo 25 cm. Fonte: questão de concurso do CBM-RJ, não o texto normativo.
- **Lição de consistência:** o espelho de 16 a 18 cm aparece de forma consistente. Piso e limites de 2e+p variam conforme a norma e a jurisdição.

### 1.2 Largura da escada

- **Rota acessível (NBR 9050): recomendável 1,50 m; mínimo admissível 1,20 m [M].** Trecho de site sem URL identificada.
- **Saída de emergência (NBR 9077): a largura depende da população da ocupação.** A tabela não foi encontrada [?]. Edição 2001 citada em artigo; uma edição de 2025 aparece em catálogos [M]. Ver seção 5.
- **Escada de emergência, Espírito Santo (checklist estadual do CBMES): 1,10 m; escada de mezanino: 0,80 m [M].** É checklist de fiscalização estadual, não norma nacional. Fonte: link de checklist do CBMES na seção 6.
- **Residencial unifamiliar: [?].** Nenhuma fonte encontrada. O código de obras municipal é a referência.
- **Largura mínima de patamar em mudança de direção: 1,20 m ou igual à largura da escada [A]** (NBR 9050, item 6.6.5 segundo a fonte, edição 2004).

### 1.3 Patamares e lances

- **Patamar a cada 3,20 m de desnível, e sempre que houver mudança de direção (NBR 9050, item 6.6.5, edição 2004) [A].** Confirmar na edição 2020.
- **Comprimento mínimo do patamar: 1,20 m, ou igual à largura da escada na mudança de direção [A].**
- **Patamar de 0,80 m em lance com mais de 19 degraus [M].** Exemplo municipal (Pato Branco-PR). Cuidado: é o comprimento do patamar, não a largura da escada.
- **Altura máxima de lance sem patamar em NBR 9077: [?].**

### 1.4 Folga de cabeça (altura livre)

- **Altura livre mínima de 2,00 m: NBR 9077 (edição 2001) [M].** Citada em artigo acadêmico (Revista Mirante). Verificar se a edição vigente mantém o valor.
- **Pé-direito livre na NBR 9050 para escadas: [?].** A busca não confirmou nenhum valor. O valor de 2,10 m aparece em faixas livres de calçada e alturas de porta, não em escadas.

### 1.5 Inclinação máxima

- **[?].** Nenhuma fonte encontrada. Derivação: inclinação a partir de e e p (seção 4).

### 1.6 Corrimão

- **Alturas: 0,70 m e 0,92 m do piso, instalados em ambos os lados de escadas e rampas [A].** Citado como NBR 9050:2020, item 6.9, em checklist de Goiás e em questão de concurso. Número do item 6.9 não conferido no texto oficial.
- **Prolongamento: pelo menos 0,30 m nas extremidades [M].** Questão de concurso.
- **Continuidade nos patamares, sem interromper a circulação [M].** Anexo de edital do INSS.
- **Diâmetro de 30 mm a 45 mm para corrimão contínuo [M].** Checklist de Goiás.
- **Ponto de medição da altura: divergente [M].** Divulgação (tupi.fm) diz que na escada a medida vai "da face superior do corrimão até a quina do degrau". Anexo do INSS diz "até o ponto central do piso do degrau". Adotar um critério explícito no Hestia e confirmar na norma.
- **Quando é obrigatório em dois lados e a partir de qual largura: [?].**

### 1.7 Guarda-corpo

- **Altura e regras: [?].** Não pesquisado em profundidade. Norma provável a verificar: NBR 14718 [?].

### 1.8 Degrau em leque (escada em leque)

- **Largura mínima do piso medida a 50 cm do lado menor: [?].** Não encontrado na NBR 9050 nem na busca. Um modelo municipal de Pato Branco trata de escada em leque com regras do código municipal (piso mínimo 25 cm, patamar 0,80 m a partir de 19 degraus) [M].

### 1.9 Piso constante, nariz e superfície

- **Piso e espelho constantes em todo o lance: [?] como regra literal.** Usual em normas e projetos; confirmar.
- **Nariz (bocel): avanço máximo de 1,5 cm [M]** (site) ou **2 cm** (questão de concurso). Espelho vazado proibido [M]. Valores divergentes; confirmar.
- **Superfície antiderrapante e mantida com o uso: [A].** Citado por projeto que menciona NBR 9077 e NBR 9050.

### 1.10 Diferenças por tipo de uso

- **Residencial unifamiliar:** governado pelo código de obras municipal (exemplo: espelho até 19 cm, piso mínimo 25 cm, Pato Branco). Não encontrei texto que confirme se a NBR 9077 se aplica a unifamiliar [?].
- **Uso coletivo (saída de emergência):** NBR 9077, com IT ou NT do Corpo de Bombeiros do estado. Ex.: IT 11/2019 de São Paulo (CBPMESP), NT 11/2022 de Goiás (CBMGO). Largura pela população; tipos de escada pela ocupação e altura. Tabelas não lidas [?].
- **Rota acessível (NBR 9050):** espelho 16 a 18 cm; piso 28 a 32 cm; 2e+p 63 a 65 cm; patamar a cada 3,20 m de desnível; largura recomendada 1,50 m.
- **Escadas de acesso a edificações:** seguem NBR 9050; escadas de saída de emergência seguem NT do Corpo de Bombeiros, baseada em NBR 9050 e NBR 9077 [M] (Sanepar).
- **Não confundir com NR-18 (canteiro de obras):** largura 0,80 m e patamar a cada 2,90 m de altura citados em checklist da CBIC [M]. Não se aplica à edificação concluída.
- **NBR 15575 (desempenho de edificações habitacionais): não pesquisada [?].**

---

## 2. Tabela consolidada

### 2.1 Valores de referência (residencial e uso coletivo)

| Parâmetro | Valor | Fonte | Uso | Confiança |
|---|---|---|---|---|
| Espelho (e) | 16 a 18 cm | NBR 9050, item 6.6.3 (via Revista Mirante, UEG) | Acessível / público | [A] |
| Espelho máximo residencial | 19 cm | Pato Branco-PR, Lei 959/90 (exemplo municipal) | Residencial (municipal) | [M] |
| Espelho máximo | 18 cm | RJ CBM (questão), NBR 9050 | Enclausurada / acessível | [M] |
| Piso (p) | 28 a 32 cm | NBR 9050, item 6.6.3 (via Mirante, PUC-GO) | Acessível / público | [A] |
| Piso mínimo | 25 cm | Pato Branco-PR; RJ CBM; comentário CB | Residencial / municipal / emergência | [M] |
| Piso mínimo | 28 cm | Comentário sobre alguns estados (CB) | Emergência (estadual) | [M] |
| 2e + p | 63 a 65 cm | NBR 9050 (via PUC-GO, Omni) | Acessível / público | [A] |
| 2e + p | 63 a 64 cm | NBR 9077 (via projeto IFB) | Saída de emergência | [M] |
| 2e + p | 63 a 64 cm | CBM-RJ, escada enclausurada (questão) | Emergência / enclausurada | [M] |
| Desnível máx. sem patamar | 3,20 m | NBR 9050, item 6.6.5 (ed. 2004, via Mirante) | Acessível / público | [A] |
| Patamar, comprimento mín. | 1,20 m ou largura da escada (mudança de direção) | NBR 9050, item 6.6.5 (ed. 2004) | Acessível / público | [A] |
| Patamar em lance > 19 degraus | 0,80 m | Pato Branco-PR | Residencial (municipal) | [M] |
| Largura de escada, rota acessível | 1,50 m recomendável; 1,20 m mínimo | NBR 9050 (site sem URL) | Acessível / público | [M] |
| Largura de escada de emergência | 1,10 m | Checklist CBMES-ES | Emergência (estadual) | [M] |
| Largura de escada de mezanino | 0,80 m | Checklist CBMES-ES | Mezanino (estadual) | [M] |
| Largura de escada, saída de emergência | Depende da população; tabela não lida | NBR 9077 / IT / NT | Coletivo | [?] |
| Largura residencial unifamiliar | Não encontrado | Código municipal | Residencial | [?] |
| Altura livre mínima | 2,00 m | NBR 9077 (ed. 2001, via Mirante) | Emergência | [M] |
| Pé-direito livre para escada (NBR 9050) | Não encontrado | NBR 9050 | Acessível | [?] |
| Inclinação máxima | Não encontrado | NBR 9050 / NBR 9077 | Ambos | [?] |
| Corrimão, altura | 0,70 m e 0,92 m | NBR 9050:2020, item 6.9 (via Goiás, concurso) | Ambos (ambos os lados) | [A] |
| Corrimão, prolongamento | 0,30 m nas extremidades | Questão de concurso | Ambos | [M] |
| Corrimão, diâmetro | 30 a 45 mm | Checklist de Goiás (item 6.9) | Ambos | [M] |
| Corrimão, ponto de medição | Quina do degrau OU ponto central do piso | Tupi.fm vs anexo INSS | Ambos | [M] (conflito) |
| Corrimão, a partir de qual largura | Não encontrado | NBR 9050 | Ambos | [?] |
| Guarda-corpo, altura | Não encontrado | NBR 14718 (provável) | Ambos | [?] |
| Escada em leque, piso a 50 cm | Não encontrado | NBR 9050 | Ambos | [?] |
| Nariz (bocel), avanço máx. | 1,5 cm ou 2 cm | Site; questão de concurso | Ambos | [M] (conflito) |
| Espelho vazado | Proibido | Questão de concurso | Ambos | [M] |
| Piso antiderrapante | Obrigatório, mantido com o uso | Projeto citando NBR 9077 / NBR 9050 | Ambos | [M] |

### 2.2 Proposta de padrão e limites para o Hestia

Esta seção é proposta de implementação, não norma. Os limites de ERRO e AVISO precisam ser parametrizados por jurisdição (por município e por estado).

**Padrão de geração (valores-alvo):**

- Espelho alvo: **17,5 cm**. Dentro de 16 a 18 cm (NBR 9050) e de 16 a 19 cm (exemplo municipal). [A/M]
- Piso alvo: **28 cm**. Com e = 17,5 cm, 2e + p = 63 cm. Dentro de 28 a 32 (NBR 9050) e de 63 a 65 (NBR 9050). Também dentro de 63 a 64 (NBR 9077, via IFB). [A/M]

**Validação: AVISO (revisar, não bloqueia):**

- Espelho fora de 16 a 18 cm.
- Piso fora de 28 a 32 cm.
- 2e + p fora de 63 a 65 cm.
- Patamar com comprimento menor que 1,20 m (ou menor que a largura da escada, em mudança de direção).
- Desnível sem patamar maior que 3,20 m.
- Largura menor que 1,20 m em rota acessível.
- Corrimão fora de 0,70 m e 0,92 m, quando exigido.
- Altura livre menor que 2,00 m (verificar antes de marcar como ERRO em emergência).

**Validação: ERRO (bloqueia exportação ou marca inválido):**

- Espelho maior que 19 cm (maior valor encontrado em exemplo municipal).
- Piso menor que 25 cm (menor valor encontrado).
- 2e + p fora de uma faixa larga (proposta: 60 a 66 cm; [?] não normativa).
- Espelho ou piso zero ou negativo; número de espelhos N menor que 1.
- Altura livre menor que 2,00 m em lance de saída de emergência (provisório, ver [?]).

---

## 3. Modelo IFC (buildingSMART)

Observação: as referências ao schema oficial (IFC4, IFC4.3) não foram lidas no site buildingSMART. As informações vêm de resumos de busca e de documentação de terceiros (xbim, Aspose, IFC4.3 summary). Tudo marcado [U] ou [?] precisa de confirmação no schema.

### 3.1 Classes

- **IfcStair** (contêiner). Agrega lances (IfcStairFlight), patamares (IfcSlab) e corrimãos (IfcRailing) por IfcRelAggregates. Geometria "Body" do IfcStair é a soma das geometrias das partes [U].
- **IfcStairFlight** (lance). Atributos diretos na IFC4 (NumberOfRiser, NumberOfTreads, RiserHeight, TreadLength) estão marcados como deprecated; a especificação manda usar o Pset_StairFlightCommon [U]. PredefinedType tipo IfcStairFlightTypeEnum; valores típicos STRAIGHT, WINDER, SPIRAL, CURVED, FREEFORM [?].
- **IfcStairFlightType** (tipo do lance) [U].
- **IfcStairType** / **IfcStairTypeEnum** (forma da escada). Valores confirmados como enumeradores: STRAIGHT_RUN_STAIR e QUARTER_WINDING_STAIR [A, xbim IFC4]. Os demais valores citados no pedido (TWO_STRAIGHT_RUN_STAIR, HALF_WINDING_STAIR, SPIRAL_STAIR, CURVED_RUN_STAIR, FREEFORM) não foram confirmados [?]. A versão 4.3 mostra enumeradores diferentes (ex.: DOUBLE_RETURN_STAIR, QUARTER_TURN_STAIR) [U]. O atributo chamado "ShapeType" não foi confirmado como nome de atributo de IfcStairType em nenhuma versão [?]. Em IFC4, a escada tem entre 0 e 3 patamares para os layouts definidos; acima de 3 ou formas não regulares: USERDEFINED ou NOTDEFINED [U].
- **IfcSlab** com **PredefinedType = LANDING** para patamar [U] (resumo de busca). Confirmar se LANDING pertence a IfcSlabTypeEnum na versão alvo [?].
- **IfcRailing** (corrimão e guarda-corpo). PredefinedType é IfcRailingTypeEnum, opcional. Se o valor for USERDEFINED, ObjectType é obrigatório [U]. Os valores HANDRAIL e GUARDRAIL não foram confirmados [?].
- **IfcRailingType**: tipo do corrimão [U].
- **Stringers (longarinas, "cordas")**: IfcMember com PredefinedType = STRINGER. O valor STRINGER existe em IfcMemberTypeEnum na IFC4.3 [U]. A associação com corrimão não foi confirmada [?].
- **Escada de concreto (laje inclinada)**: IfcSlab ou IfcStair com geometria própria [?].

### 3.2 Atributos e Psets

**Pset_StairFlightCommon (IFC4.3, nome exato da propriedade a confirmar):**

- NumberOfRiser (IfcCountMeasure): número de espelhos. Nome no texto da IFC4 é "NumberOfRisers" (possível erro de digitação) [U].
- NumberOfTreads (IfcCountMeasure): número de pisos [U].
- RiserHeight (IfcPositiveLengthMeasure): espelho; deve ser igual em todos os degraus do lance [U].
- TreadLength (IfcPositiveLengthMeasure): piso; deve ser igual em todos os degraus na linha de caminhada [U].
- NosingLength: avanço do nariz (balanço do piso sobre o espelho de baixo) [U].

**Pset_StairCommon (IFC4.3):**

- Repete as propriedades acima e acrescenta WalkingLineOffset, TreadLengthAtOffset e TreadLengthAtInnerSide (usados em lances com leque/winders) [U].
- TreadLengthAtOffset deve, em geral, coincidir com TreadLength, a menos que o cálculo do código use outra linha de caminhada [U].
- WaistThickness (espessura mínima da cintura da escada, medida perpendicular à rampa até o canto interno do espelho e do piso) aparece no Pset_StairCommon da IFC4.2 [U]. Não confirmado no Pset_StairFlightCommon da 4.3 [?].

### 3.3 Autoria: o que as ferramentas exportam

- **ArchiCAD (Graphisoft):** Stair → IfcStair; Stair Flight → IfcStairFlight; Railing → IfcRailing; balaústres e corrimãos (handrail) → IfcMember. Piso/patamar mapeado como IfcSlab com PredefinedType Landing [U]. O mapeamento varia por versão do ArchiCAD (AC18, AC19, AC25 têm tabelas diferentes). A página AC25 lista IFCStair com tipo de estrutura espacial [U]. Página não lida: acesso bloqueado.
- **Cadwork:** elementos da escada são agregados em IfcStair durante a exportação [U] (resumo de busca).
- **Revit (Autodesk):** não foi possível confirmar. Documentação bloqueada. Não usar como premissa: exportar um modelo de teste e inspecionar com um validador IFC [?].

---

## 4. Fórmulas

Notação: H = desnível em cm; e = espelho; p = piso; N = número de espelhos.

**4.1 Número de espelhos e espelho real**

- N = round(H / e_alvo). Ex.: H = 280 cm e alvo 17,5 cm. N = round(16,0) = 16.
- e_real = H / N. Ex.: 280 / 16 = 17,5 cm.
- Verificar e_real contra os limites de validação (16 a 18 cm; máximo 19 cm como erro).

**4.2 Piso pela fórmula de Blondel**

- Para 2e + p = X (faixa alvo), p = X − 2e.
- Com X = 63 cm e e = 17,5 cm: p = 63 − 35 = 28 cm. Confirmado pela regra.
- Faixa de p para 2e + p entre 63 e 65: p entre 28 e 30 cm (com e = 17,5 cm).
- Faixa de p para 2e + p entre 63 e 64: p entre 28 e 29 cm (com e = 17,5 cm).

**4.3 Comprimento do lance (contagem de pisos)**

- Com N espelhos e patamar no topo, há N − 1 pisos entre o primeiro e o último espelho, pois o último espelho é seguido pelo patamar, não por um piso [U, derivação geométrica].
- Comprimento horizontal do lance (entre a face do 1º espelho e a face do último espelho) = (N − 1) × p.
- Se o patamar for contado como piso, a conta muda para N × p. Escolher explicitamente e documentar no Hestia.
- Exemplo: H = 280 cm, N = 16, p = 28 cm: pisos entre espelhos = 15; comprimento = 15 × 28 = 420 cm, sem profundidade do patamar.

**4.4 Altura livre (folga de cabeça) ao longo da linha de caminhada**

- Altura vertical no ponto x: h_v(x) = Z_laje_superior(x) − Z_topo_do_degrau(x). O mínimo costuma ocorrer no nariz do degrau sob a laje.
- Altura perpendicular à rampa: h_perp = h_v × cos(α), com tan(α) = e / p.
- Exemplo com e = 17,5 cm e p = 28 cm: tan(α) = 0,625; α ≈ 32°; cos(α) ≈ 0,848.
- Verificar o mínimo de 2,00 m (NBR 9077 ed. 2001) [M] na vertical e na perpendicular, conforme a norma aplicável [?].

**4.5 Inclinação**

- tan(α) = e / p. Com 17,5 / 28 = 0,625 → 32°.
- Limite de inclinação máxima: [?].

---

## 5. Pendências de versão e aplicabilidade

- **NBR 9077:2025 (nova edição):** catálogos listam "07/2025 Publicada nova edição" e "09/2026 Publicada nova edição (inc.err.)" e "09/2026 Publicada Errata" [M]. Não foi possível confirmar a data de vigência nem o conteúdo. A versão de referência do Hestia deve ser fixada por parâmetro.
- **NBR 9050: edição vigente é 2020.** As regras encontradas citam itens 6.6.3, 6.6.5 e 6.9 que aparecem em fontes da edição de 2004 ou 2020, sem separação clara. Confirmar item por item.
- **Corpo de Bombeiros:** cada estado tem IT/NT própria. Encontradas: SP (IT 11/2019, CBPMESP), GO (NT 11/2022), ES (checklist de fiscalização), SC (IN 9 sobre saídas de emergência, com tabela de tipos de escada por altura e ocupação), RJ (questões). Nenhuma tabela foi lida.

---

## 6. Fontes (URLs citadas)

Fontes de resultados de busca (lidas somente como trecho de resultado, não abertas integralmente):

- Revista Mirante (UEG), artigo sobre NBR 9050 e NBR 9077 (item 6.6.3, 6.6.5, altura livre 2 m): https://www.revista.ueg.br/index.php/mirante/article/view/6388/4370
- PUC-GO, material de aula sobre escadas (espelho 16 a 18, 2e+p 63 a 65, exemplo 275 cm): https://professor.pucgoias.edu.br/sitedocente/admin/arquivosUpload/17452/material/ESCADA.pdf
- Omni Calculator, calculadora de escadas (NBR 9050): https://www.omnicalculator.com/pt/construcao/calculadora-escadas
- IFB, projeto de salas de aula (2e+p 63 a 64 NBR 9077; 65 NBR 9050 e NT10): https://ifb.edu.br/attachments/article/22626/5-ProjModif_SalasAula-P8-9_R00_proj%20TAG.pdf
- Pato Branco-PR, modelo de escada em leque (Lei 959/90): https://patobranco.pr.gov.br/wp-content/uploads/2025/02/Modelo-Escada-em-Leque.pdf
- Checklist do CBMES-ES, saída de emergência (escada 1,10 m; mezanino 0,80 m): https://cb.es.gov.br/Media/CBMES/PDF%27s/CAT/Checklist%20Vistoria/1%20-%20Processo%20Simplificado/2%20-%20Saida%20de%20emergencia/CL%20ENE%20Renov%202.0.pdf
- Checklist de acessibilidade de Goiás (item 6.9, corrimão, diâmetro 30 a 45 mm): https://goias.gov.br/seguranca/wp-content/uploads/sites/56/2022/04/lista.pdf
- Anexo de edital do INSS (corrimão contínuo nos patamares; medição até o ponto central do piso): https://www.gov.br/inss/pt-br/centrais-de-conteudo/publicacoes/contratos-e-licitacoes/superintendencia-regional-norte-centro-oeste/processo-no-35014-223638-2021-85-apendice-vii-do-tr-projeto-executivo-3.pdf/@@download/file
- Divulgação sobre corrimão NBR 9050:2020 (medição a partir da quina do degrau): https://www.tupi.fm/?p=2504341
- Corpo de Bombeiros de Goiás, NT 11/2022 Saídas de Emergência: https://www.bombeiros.go.gov.br/wp-content/uploads/2021/03/NT-11_2022_-_Saidas-de-Emergencia.pdf
- USP FFCLRP, cópia da IT 11/2019 (CBPMESP): https://ffclrp.usp.br/dc.php?id=17
- Sanepar, nota técnica 03 (escadas de acesso = NBR 9050; saída de emergência = NT/NPT 11): https://site.sanepar.com.br/sites/site.sanepar.com.br/files/informacoes-tecnicas/mps-versao-2023/nota_tecnica_03_meios_acesso_protecao_r4.pdf
- Catálogo de normas (NBR 9077, edições 2001, 2022, 2025): https://www.normas.com.br/visualizar/abnt-nbr-nm/5346/abnt-nbr9077-saidas-de-emergencia-em-edificios
- CBIC, seminários sobre revisão da NBR 9077: https://cbic.org.br/seminario-apresentacao-de-texto-base-para-revisao-abnt-nbr-9077/
- Questões de concurso CBM-RJ (escada enclausurada, 2H+L): https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-legislacao-aplicada-cbm-rj-401504
- Questões de concurso NBR 9050 (corrimão 0,92/0,70; prolongamento 0,30 m; patamar): https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-nbr-9050-abnt-395809
- Questões de concurso NBR 9077 (altura livre, escada): https://questoes.grancursosonline.com.br/questoes-de-concursos/legislacao-dos-orgaos-nbr-9077-abnt-405185
- Checklist CBIC, NR-18 (canteiro: largura 0,80 m; patamar a cada 2,90 m de altura; não é norma de edificação concluída): https://cbic.org.br/arquivos/manual-sst/2021/CBIC_Manual_SST_2021_AnexoA_Grupo_02_C.pdf

Fontes IFC (apenas URL do resultado de busca; não abertas):

- IFC4 IfcStairFlight: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcsharedbldgelements/lexical/ifcstairflight.htm
- IFC4 IfcStair: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcsharedbldgelements/lexical/ifcstair.htm
- IFC4.3 Pset_StairFlightCommon: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Pset_StairFlightCommon.htm
- IFC4.3 Pset_StairCommon: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Pset_StairCommon.htm
- IFC4.3 IfcStairTypeEnum: https://standards.buildingsmart.org/IFC/DEV/IFC4_3/HTML/lexical/IfcStairTypeEnum.html
- IFC4.3 IfcMemberTypeEnum: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcMemberTypeEnum.htm
- IFC4 IfcRailing: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcsharedbldgelements/lexical/ifcrailing.htm
- xbim, IfcStairTypeEnum (IFC4): https://docs.xbim.net/XbimDocs/documentation/Xbim.Ifc4/Xbim.Ifc4.Interfaces.IfcStairTypeEnum.html
- ArchiCAD, mapeamento de tipos IFC (AC19): https://help.graphisoft.com/AC/19/INT/AC19Help/07_Interoperability/07_Interoperability-76.htm
- ArchiCAD, mapeamento de tipos IFC (AC25): https://help.graphisoft.com/AC/25/INT/_AC25_Help/121_IFC/121_IFC-50.htm
- Cadwork, exportação de escadas: https://kb.cadwork.ch/holzbau/pdf/en/1088
- Blondel (Nicolas-François Blondel, 1618 a 1686): https://encyclopedia.com/people/literature-and-arts/architecture-biographies/nicolas-francois-blondel

---

## 7. Origem da fórmula de Blondel

- O autor é **Nicolas-François Blondel** (1618 a 1686), não "François Blondel" (fonte: Encyclopedia.com). Não confundir com Jacques-François Blondel (1705 a 1774), que publicou outra obra [U].
- A regra aparece no *Cours d'architecture* (1675). Teria sido baseada no passo humano de cerca de dois pés (medida de Paris) e no degrau de um pé [U, resumo de busca].
- Uma fonte afirma que a regra foi aprovada pela Académie royale d'architecture em 28/01/1675 [U].
- Pela medida do pé-do-rei (~32,5 cm), dois pés são ~65 cm, o que explica a faixa 63 a 65 [?, conhecimento prévio].
- Fontes divergem nos limites de 2e + p (58 a 62; 60 a 65; 63 a 65). Não há fonte primária consultada [U].

---

## 8. Resumo para implementação

1. Usar **espelho alvo 17,5 cm** e **piso alvo 28 cm** como padrão; com e = 17,5, 2e + p = 63 cm, dentro das faixas de NBR 9050 (63 a 65) e NBR 9077 (63 a 64).
2. Calcular N = round(H / e_alvo) e recalcular e_real = H / N.
3. Calcular p por Blondel: p = X − 2e, com X escolhido no parâmetro (63, 64 ou 65).
4. Tornar espelho, piso e X **parâmetros por jurisdição**, não constantes no código.
5. Validar espelho entre 16 e 18 cm como AVISO; acima de 19 cm como ERRO (limite máximo encontrado).
6. Validar piso entre 28 e 32 cm como AVISO; abaixo de 25 cm como ERRO (menor valor encontrado).
7. Validar 2e + p entre 63 e 65 cm como AVISO; faixa larga de ERRO só depois de confirmar.
8. Lance sem patamar: alertar acima de 3,20 m de desnível (NBR 9050, ed. 2004; confirmar 2020).
9. Patamar: comprimento mínimo 1,20 m, ou igual à largura da escada em mudança de direção (confirmar).
10. Largura: 1,20 m mínimo em rota acessível; 1,50 m recomendado; emergência pela tabela da IT/NT do estado (não implementar sem a tabela).
11. Altura livre: alertar abaixo de 2,00 m (NBR 9077 ed. 2001; checar edição vigente).
12. Corrimão: 0,70 m e 0,92 m a partir do piso, em ambos os lados quando exigido; prolongamento 0,30 m; diâmetro 30 a 45 mm; **definir o ponto de medição** (quina do degrau ou centro do piso).
13. Contagem de pisos: pisos entre espelhos = N − 1 com patamar no topo; comprimento horizontal = (N − 1) × p. Documentar se o patamar conta como piso.
14. Altura livre ao longo da linha de caminhada: h_perp = h_v × cos(α), tan(α) = e / p.
15. IFC: usar IfcStair como agregador de IfcStairFlight, IfcSlab (LANDING) e IfcRailing, via IfcRelAggregates [U].
16. IFC: gravar número de espelhos, pisos, espelho, piso e nariz em Pset_StairFlightCommon (IFC4.3), não nos atributos deprecated de IfcStairFlight [U].
17. IFC: usar o nome de propriedade **NumberOfRiser** (singular), conferir no schema alvo [U].
18. IFC: Pset_StairCommon para WalkingLineOffset, TreadLengthAtOffset e TreadLengthAtInnerSide em lances com leque [U].
19. IFC: stringers como IfcMember com PredefinedType STRINGER [U].
20. IFC: IfcStairTypeEnum: usar STRAIGHT_RUN_STAIR e QUARTER_WINDING_STAIR (confirmados); demais valores só após leitura do schema da versão alvo [A/?].
21. IFC: não assumir o comportamento do Revit; validar uma exportação de teste em visualizador IFC antes de fechar o mapeamento [?].
22. Limpar o ponto de medição e a faixa de nariz (1,5 cm vs 2 cm) como decisão explícita do projeto, pois as fontes divergem [M].
23. Tratar escada em leque (50 cm) e guarda-corpo como não implementados até obter fonte primária [?].
24. Para residencial unifamiliar, o código municipal deve prevalecer; o Hestia deve permitir perfil "municipal" com os parâmetros da prefeitura [M].
25. Antes de liberar a validação como norma, conferir todos os itens no texto oficial: NBR 9050:2020, NBR 9077 (edição vigente), IT/NT do estado e o schema IFC4 ou IFC4.3.

---

## 9. Pendências [?]

1. Texto oficial da NBR 9050:2020, itens 6.6.3, 6.6.5 e 6.9: confirmar espelho, piso, 2e+p, patamar, corrimão e medição.
2. Tabela de larguras de escada da NBR 9077 (edição vigente, 2001 ou 2025) por população e ocupação.
3. Texto da IT 11/2019 (CBPMESP) e NT 11/2022 (CBMGO): tabelas de tipos de escada e larguras, e a regra de 0,63 ou 0,64 de RJ.
4. Largura mínima de escada residencial unifamiliar: fonte federal ou municipal (código de obras de referência).
5. Pé-direito livre para escada na NBR 9050:2020.
6. Inclinação máxima de escada na NBR 9050 e na NBR 9077.
7. Escada em leque: piso mínimo a 50 cm do lado menor (item citado no pedido, não encontrado).
8. Guarda-corpo: altura, carga e norma aplicável (NBR 14718 a verificar).
9. Corrimão: a partir de qual largura é obrigatório em dois lados; ponto de medição da altura.
10. Nariz (bocel): avanço máximo, 1,5 cm ou 2 cm.
11. Piso constante em todo o lance: se é exigência literal da norma.
12. NBR 15575: se há regra de escada para habitação (não pesquisada).
13. NBR 9077:2025 (vigência, conteúdo; possível errata 09/2026).
14. IfcStairFlight e IfcStair no schema oficial: nomes exatos, enumeradores e atributos (IFC4 e IFC4.3), incluindo ShapeType.
15. IfcStairTypeEnum: lista completa de enumeradores na versão alvo (TWO_STRAIGHT_RUN_STAIR, HALF_WINDING_STAIR, SPIRAL_STAIR, CURVED_RUN_STAIR, FREEFORM etc.).
16. IfcStairFlightTypeEnum: valores (STRAIGHT, WINDER, SPIRAL, CURVED, FREEFORM).
17. IfcRailingTypeEnum: valores (HANDRAIL, GUARDRAIL).
18. IfcSlabTypeEnum: confirmar LANDING.
19. IfcMemberTypeEnum: confirmar STRINGER na versão alvo.
20. Pset_StairFlightCommon: lista completa e WaistThickness (confirmar se está no 4.3).
21. Mapeamento de Revit para IFC (IfcStair, IfcStairFlight, IfcSlab LANDING, IfcRailing): não confirmado; exportar amostra e validar.
22. Mapeamento atual do ArchiCAD para a versão alvo (tabelas variam por versão).
23. Fórmula de patamar em escada de mudança de direção (resultado de busca de MG citando p = (2h + b) n + b): não verificada; não usar sem leitura da fonte.
24. Limites de 2e+p fora de 63 a 65 (faixas de 58 a 62 e de 60 a 65 apareceram em fontes históricas): definir faixa de ERRO do Hestia como decisão de projeto.
