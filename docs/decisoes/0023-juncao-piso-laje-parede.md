# 0023 · Junção entre piso/laje e parede

Origem: pedido do dono, "a do Revit" (modelo de junção do Revit para piso/laje × parede). Insumos: pesquisa C (`scratchpad/relatorios/res-c-revit-archicad-pisos-lajes.md`) e mapa do estado atual (`scratchpad/wt/inv3/RELATORIO-INV.md`, INV-D, medições em `tests/inv-d*.test.ts`). Código citado como `arquivo:linha`, conferido na worktree.

Status: documento de decisão, sem código. Itens 1 a 7 e 9 a 11: propostas para aprovação do dono. **Item 8: DECIDIDA pelo dono (opção B, contorno associativo).** Pendências ao fim.

Legenda: `[DOC]` documentação oficial (Autodesk / Graphisoft). `[SEC]` fórum, blog ou tutorial. `[INFERIDO]` dedução a partir das fontes ou proposta deste documento. `[NÃO ENCONTRADO]` pesquisado e sem fonte. `[DECISÃO n]` decisão já registrada em outro documento de `docs/decisoes/`.

## Decisões

| # | Decisão | Motivo | Tag |
|---|---|---|---|
| 1 | Prioridade de junção por função da camada: Estrutura 1, Substrato 2, Térmica/Ar 3, Acabamento 1 4, Acabamento 2 5 (valores já em `packages/model/src/priority.ts:8-15`). Membrana: 3, empatada com a térmica | Ordem oficial da ajuda Revit; a membrana não tem número na ajuda (ver §1.1) | `[DOC]`; membrana `[INFERIDO]` |
| 2 | Regra do núcleo: camada dentro do núcleo do elemento unido se estende pelo núcleo e atravessa prioridade maior que esteja fora dele. Substitui "até Estrutura [1]" (`docs/05` §9) | Ajuda Revit 2014 ("Applying a Function") | `[DOC]` |
| 3 | Quem corta quem, por padrão: laje estrutural corta piso; piso e laje cortam parede; parede nunca corta piso ou laje. O usuário inverte por par, com o comando "Inverter corte" e "Não cortar" | Hierarquia do Join Geometry (Revit 2023) | `[DOC]`; inversão `[INFERIDO]` |
| 4 | Contorno por camada derivado, não gravado: estrutura até a face do núcleo da parede; substrato, acabamento e membrana até a face de acabamento | Corrige o contorno único por elemento, que hoje é igual para todas as camadas (`floors.ts:47-54`) | `[INFERIDO]` |
| 5 | Corte e planta ordenados por cota e hierarquia, não pela ordem de inserção | Hoje a ordem de inserção decide (`sectionOcclusion.ts:33-50`) | `[INFERIDO]` |
| 6 | Quantitativos líquidos: o elemento cortado perde o volume sobreposto. Tipo padrão `ft_ceram` deixa de trazer concreto estrutural para uso sobre laje (tipo novo `ft_acab`) | Concreto contado duas vezes em `ft_ceram` sobre `ls_mac12` (INV-D §5) | `[INFERIDO]` |
| 7 | Membrana de espessura zero em piso e laje: linha na planta e área de face nos quantitativos, sem volume, como em parede | Hoje é descartada (`floors.ts:45-47`, `slabs.ts:43`); igual à decisão 0005 #8 | `[DECISÃO 0005 #8]` |
| 8 | Parede anexada a piso ou laje é avaliada por trecho, não pelo ponto médio. Controle na propriedade: anexar e desanexar base e topo. Aviso quando só parte da parede está coberta | Hoje decide pelo ponto médio (`wallZ.ts:103-115`); a ajuda diz que só a parte sobre o piso se anexa | `[DOC]` (regra de trecho); `[INFERIDO]` (controle e aviso) |
| 9 | O campo "Prioridade de junção" do tipo de piso e de laje passa a valer, como sobrescrita da função por camada | Hoje é editável e não tem efeito (ver §7) | `[INFERIDO]` |
| 10 | **Contorno associativo: opção B, decidida pelo dono.** O piso ou laje criado a partir das paredes guarda a origem e o contorno é derivado. Edição manual de vértice solta o vínculo | Pedido do dono; mesmo princípio dos ambientes (`0018` #1) | **DECIDIDA** |

## 1. Modelo adotado (Revit)

### 1.1 Prioridade por função

| Função | Prioridade | Tag |
|---|---|---|
| Estrutura | 1 | `[DOC]` |
| Substrato | 2 | `[DOC]` |
| Térmica / ar | 3 | `[DOC]` |
| Membrana | 3 (proposta) | `[INFERIDO]` |
| Acabamento 1 | 4 | `[DOC]` |
| Acabamento 2 | 5 | `[DOC]` |

A ajuda oficial de 2014 não dá número de prioridade à membrana (pesquisa C §1). O valor 3 é proposta: a membrana tem espessura zero, então não corta nem é cortada por volume; a prioridade só decide em qual face a linha para. Empatada com a térmica, ela não corta os acabamentos (4 e 5). `priority.ts:4-6` diz "conforme a fonte consultada"; esse comentário deve ser trocado por esta decisão na fase P7. Validar no Revit antes de fechar (teste G-M, §9.3).

A ajuda de 2026 pode separar função e prioridade de junção (`[SEC]`, não verificado: pesquisa C §1, lacuna 2). Por isso o campo do item 9 é sobrescrita, e o padrão continua sendo a função.

### 1.2 Regra do núcleo

Camada dentro do núcleo do elemento unido se estende pelo núcleo do outro e atravessa camadas de prioridade maior que estejam fora do núcleo `[DOC]`. Camadas fora do núcleo seguem a prioridade normal. Isto corrige `docs/05` §9 (ver nota ao fim).

### 1.3 Hierarquia de corte por tipo de elemento

| Par | Quem corta (padrão) | Tag |
|---|---|---|
| Laje estrutural × piso | Laje corta piso | `[DOC]` ("Structural elements cut host elements (walls, roofs, ceilings, and floors)") |
| Piso ou laje × parede | Piso e laje cortam a parede | `[DOC]` ("Floors, ceilings, and roofs cut walls") |
| Parede × piso ou laje | Parede não corta | `[DOC]` |
| Piso × piso e laje × laje (mesmo nível) | Sem regra oficial: aviso de sobreposição, sem corte automático | `[NÃO ENCONTRADO]`; aviso já existe em `validateSlabs.ts:82-135` |

Mapeamento: `slab` é a laje estrutural e `floor` é o piso, que faz o papel de hospedeiro.

Inversão: "Inverter corte" por par (piso ou laje selecionado com a parede), e "Não cortar" para desligar a junção desse par. É o equivalente do Join Geometry, em que o primeiro escolhido define o material aplicado aos dois `[DOC]`. No Hestia o material fica por camada, então o primeiro escolhido não define material; define só quem corta `[INFERIDO]`.

### 1.4 O que NÃO se copia

- Join Geometry como passo obrigatório: o Hestia junta sozinho pela hierarquia; o comando manual serve só para inverter.
- Butt e Miter: são só entre paredes `[DOC]` (About Wall Joins). Não existe equivalente para piso × parede.
- Retorno (wrapping) de piso ou laje: `[NÃO ENCONTRADO]`. Fora.
- Prioridade por pele do ArchiCAD: só vale como parede segundo `[SEC]`. Não copiar.
- Números de prioridade da ajuda de 2026, enquanto não forem verificados.

## 2. Contorno por camada

Hoje há um contorno por elemento, igual para todas as camadas (`floors.ts:47-54`, `floorQuantities.ts:52-55`; pesquisa INV-D §2.1). "Até o núcleo" faz todas as camadas, inclusive o contrapiso, avançarem até o núcleo (INV-D §2.1).

Mínimo viável, sem guardar nada novo: a função de resolução escolhe, por camada, entre dois contornos já calculados pelo mesmo circuito. `enclosedRooms` já gera os dois, com `'finish' | 'core'` (`packages/tools/src/enclosed.ts:34-41`).

| Camada | Contorno (derivado) | Tag |
|---|---|---|
| Estrutura | Face do núcleo da parede | `[INFERIDO]` |
| Substrato, acabamento | Face de acabamento da parede | `[INFERIDO]` |
| Membrana | Linha na face de acabamento (sem área de volume) | `[INFERIDO]` |

Medido em INV-D §2.1: piso pela face de acabamento = 10,745856 m²; pelo núcleo = 11,039600 m². A diferença de 0,293744 m² é a faixa do núcleo que a estrutura passaria a ocupar.

Perímetro externo: o mesmo princípio, com a face externa. Na v1, a regra por camada vale para paredes internas; no perímetro, todas as camadas usam o mesmo contorno até a fase P8.

## 3. Corte e planta por cota

**Corte.** Hoje a oclusão segue a ordem de inserção: pisos, lajes, forros, telhados, escadas e paredes (`sectionOcclusion.ts:33-50`). Medido em INV-D §4: a parede embutida no piso tem 0,200 m³ de corte sozinha e 0,000 m³ com o piso.

Proposta, em ordem:
1. Hierarquia do §1.3: o elemento cortado perde a região que está dentro do que o corta.
2. Sem corte entre eles: o elemento de topo mais alto (por cota) desenha por cima.
3. Empate: parede sobre piso ou laje. A ordem de inserção só desempata por último.

Com essa regra, a parede embutida no piso some do corte, como já acontece hoje; a diferença é que passa a ser pela hierarquia, não por acaso. A mesma regra sai nos quantitativos (§4). `[INFERIDO]`

**Planta.** Ordem fixa hoje: lajes, depois pisos, depois paredes (`plan/build.ts:195-196,237`). Proposta: pisos e lajes em ordem crescente de topo, paredes sempre por cima. `[INFERIDO]`

## 4. Quantitativos líquidos e tipos padrão

**Regra.** O elemento cortado (§1.3) perde o volume sobreposto ao que o corta, somente onde as faixas de cota se cruzam. Para piso e laje, subtrai-se a área de face na mesma condição. Nada muda quando o piso assenta na face superior da laje, porque não há sobreposição. `[INFERIDO]`

**Tipo padrão.** `ft_ceram` traz 0,12 m de concreto estrutural (`packages/model/src/floor.ts:33-38`), e `ls_mac12` também tem 0,12 m (`slab.ts:36`). Assentado no topo da laje (deslocamento 0,19 m), o total é 2,88 m³ para 12 m², quando deveria ser 1,44 m³ (INV-D §5). A regra líquida não corrige isso, porque não há sobreposição de cota.

Proposta:
- Criar `ft_acab` (acabamento sobre laje, sem estrutura: 0,01 m de acabamento e 0,03 m de substrato), como padrão para pisos em nível com laje.
- Manter `ft_ceram` para piso sobre solo, com a estrutura.
- Não reescrever tipos já salvos: a migração só avança a versão. Só projetos novos recebem o padrão novo.
- Aviso `piso-estrutura-sobre-laje` quando um piso com camada estrutural está sobre a laje do nível, com até 1 cm de tolerância. Não bloqueia.

## 5. Membrana de espessura zero em piso e laje

Hoje a membrana é descartada: `floors.ts:45-47` e `slabs.ts:43` pulam camadas com espessura abaixo de 1e-6 m. Medido em `ls_cobertura`: 3 camadas no tipo, 2 resolvidas e 2 nos quantitativos (INV-D §1).

Proposta, igual à parede (decisão 0005 #8):
- Na planta: linha na face da camada.
- No corte: linha.
- Nos quantitativos: área de face (impermeabilização), sem volume.
- No 3D: sem sólido.

## 6. Parede anexada a piso ou laje

**Hoje.** Base e topo se anexam por cota, pelo ponto médio do eixo (`wallZ.ts:61-77`, `103-115`). Uma parede só parcialmente coberta fica sem ajuste (INV-D §3). Os campos `attachBottomToFloor` e `attachTopToFloor` (`types.ts:166-168`) não têm controle na interface: a única opção de anexar visível é a do telhado (`Properties.tsx:100,158`).

**Revit.** Só a parte da parede sobre o piso se anexa; a altura se ajusta ao contorno; em parede inclinada, o piso precisa cobrir a parede inteira `[DOC]`. A ajuda não diz nada sobre as camadas (pesquisa C §2).

**Proposta.**
- Avaliação por trecho: o eixo é cortado nos limites dos pisos e lajes do nível. Cada trecho coberto recebe a base na face superior (a mais alta, como hoje); o trecho descoberto fica na cota do nível.
- Implementação: um perfil de base (`bottomProfile`), reusando a fatia do `topProfile` (`layerGeom.ts:230`, decisão 0005 #5). A escolha entre perfil e divisão da parede é pendência P-3.
- Controle: na propriedade da parede, "Anexar base ao piso ou laje" e "Desanexar base", com o mesmo para o topo (nível do topo a escolher).
- Aviso `parede-parcialmente-anexada` quando parte do eixo não tem cobertura, com o trecho destacado.
- Topo com perfil superior continua sem anexo (`wallZ.ts:102,105`).

## 7. Campo "Prioridade de junção"

Hoje o campo aparece e é editável em `FloorTypeDialog.tsx:135`, `SlabTypeDialog.tsx:135` e `LayerAdvanced.tsx:52-77`, mas `floors.ts`, `slabs.ts` e os quantitativos não leem `priority`. Só o resolvedor de paredes usa (`resolve.ts:16-17,114-166`).

Proposta: `layerPriority` (`priority.ts:26`) passa a ser usado na junção piso/laje × parede (§1.3) e no corte por camada (§2). Sem valor, vale a função. O rótulo passa a dizer "Prioridade de junção (sobrescreve a função)".

## 8. Contorno associativo

### 8.1 Opções registradas

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| A. Estático | Contorno gravado como lista de pontos (como hoje, `floorTool.ts:267-279`) | Simples; nada muda | Piso descola da parede: após trocar `wt_alv14` por `wt_ext19`, o piso continua 10,745856 m² (INV-D §2.2); áreas erradas sem aviso |
| **B. Associativo (DECIDIDA)** | Origem gravada; contorno derivado no motor a cada mudança | Acompanha a parede, como pede o dono; é o mesmo modelo do ambiente (`0018` #1) | Custo de cálculo por nível; arquivos novos mudam quando a parede muda; edição manual vira exceção |
| C. Guardar e avisar | Contorno gravado, com aviso quando não casa e botão "Refazer pelas paredes" | Controle explícito; sem cálculo contínuo | O usuário precisa agir a cada mudança, o que contraria o pedido do dono |

Decisão: **B**, por decisão do dono. A recomendação anterior (C e depois B) fica superada.

### 8.2 Desenho mínimo viável de B

**(a) Modelo.**
- `origem` no piso e na laje: `{ modo, semente?, vinculado }`.
  - `modo`: `'paredes-face-acabamento'`, `'paredes-nucleo'` ou `'perimetro-externo'`.
  - `semente`: ponto interior em planta, como `Room.point` (`types.ts:459-460`).
  - `vinculado`: `true` ou `false`.
- Por que ponto e não lista de ids de paredes: uma lista quebra ao dividir, juntar ou apagar parede. O circuito é uma propriedade topológica do ponto, como no ambiente (`0018` #1). Se o piso nasce de um ambiente, a semente é o `point` do ambiente; se o ambiente some, fica a semente guardada.
- `boundary` continua existindo. Quando `vinculado` é verdadeiro, guarda o último contorno válido (cache, não editável). Quando é falso, é o contorno manual. Esta é a única exceção ao princípio 1 do README: fica gravado para que um arquivo com circuito aberto ainda mostre o último contorno.
- Furos manuais continuam estáticos. Furos de escada continuam derivados (`floors.ts:36`).
- Resolução: `resolveFloors` e `resolveSlabs` chamam uma função nova `contornoVinculado(p, levelId, origem)` em `packages/engine`. Os circuitos (`enclosedRooms`, `roomAt`, `outerPerimeter`) estão hoje em `packages/tools/src/enclosed.ts:41,63,111`; passam para o motor, porque o princípio 6 do README diz que o núcleo não tem interface.
- Comandos novos, desfazíveis: `vincularContorno` e `desvincularContorno`.

**(b) Edição manual solta o vínculo.**
- Alças de vértice, arrastar aresta, mover, girar ou espelhar piso ou laje vinculados: passam `vinculado` para falso. Aparece o aviso "Contorno solto das paredes" com o botão "Revincular às paredes".
- Revincular usa a origem guardada (modo e semente). O contorno manual é descartado depois de uma prévia de área, com confirmação.
- Copiar: a cópia herda a origem. Se cai no mesmo circuito, vale o aviso de duplicado (c).

**(c) Casos de borda.**

| Caso | Comportamento |
|---|---|
| Parede apagada, movida, espessura ou tipo trocado | Recalcula o nível. Não há referência pendurada |
| Circuito deixa de fechar (parede removida, ou semente cai sobre parede) | Mantém o último contorno válido e mostra o aviso `contorno-aberto`, com "Desvincular" e "Ir para a semente". Não inventa contorno, como o ambiente (`0018` #7), mas mantém a área já medida |
| Semente em circuitos aninhados | Vale o circuito mínimo que contém o ponto, como as ilhas de `0018` #4 |
| Dois pisos no mesmo circuito | Permitido. Aviso `piso-circuito-duplicado`, sem bloquear (mesma regra de `0018` #7) |
| Ambiente apagado | Volta à semente guardada, sem aviso |
| Piso copiado para outro nível | Vincula se houver circuito na semente daquele nível; senão nasce solto, com o último contorno e aviso |
| Perímetro externo, com envelope aberto | Mesmo tratamento do circuito aberto |
| Desfazer | A parede volta por comando; o contorno derivado segue sem entrada própria de desfazer |
| Migração v18 para v19 | Pisos e lajes existentes ganham `origem` ausente, o que quer dizer estáticos. A área não muda. O botão "Revincular às paredes" aparece, com a semente sugerida pelo centro do contorno, aceita só se cair em circuito e casar com a face de acabamento (tolerância de 2 cm). Nunca automático. `[INFERIDO]` |
| Desempenho | Um arranjo de circuitos por nível, em cache pela chave (nível, hash das paredes do nível, modo, semente). Editar parede recalcula só o nível dela. Aceite: teste com contador de recálculos (nível não editado = zero recálculos). Substitui o cache por projeto de `floorTool.ts:80-83` |

**(d) Lugar no plano.** Entra nas fases P1 a P3, antes do contorno por camada (P8) e do anexo por trecho (P9), porque ambos dependem de contorno estável e do modo.

Pendência relacionada: o forro (`0021`) usa `roomId` como referência e grava o contorno (`types.ts:347`). Não segue B nesta decisão (P-5).

## 9. Testes dourados (tabela, não implementada)

Convenção: E estrutura, S substrato, A acabamento, M membrana (espessura zero). N face do núcleo da parede. F face de acabamento da parede. Caso padrão G-A: piso pela face F, sem sobreposição; a área é a do espaço livre. Caso G-B: piso pelo núcleo (modo `paredes-nucleo`), com resultado por camada.

Tipos (padrão do código, `floor.ts:33-38` e `slab.ts:36`; paredes em `defaults.ts:67-93`): piso F1 `ft_ceram` (A 0,01, S 0,02, S 0,04, E 0,12); piso F2 `ft_acab` (A 0,01, S 0,03, proposta); piso F3 molhado (A 0,01, M 0, S 0,03, E 0,10, exemplo). Parede W1 `wt_alv14` (núcleo 0,14, faces de núcleo a 0,022 e 0,162); W2 `wt_ext19` (núcleo 0,19); W3 `wt_dry` (núcleo = perfil de aço 0,048, Estrutura).

### 9.1 Piso × parede em L e T (caso G-B)

| Piso | Parede | L (canto interno do cômodo) | T (parede passante e ramal) |
|---|---|---|---|
| F1 | W1 | E até N nos dois trechos (esquadria núcleo com núcleo); S e A até F | E até N da passante; o ramal encosta em N; S e A até F |
| F1 | W2 | E até N do bloco 19; S e A até F; cerâmica externa fora do circuito | E até N; ramal encosta em N; S e A até F |
| F1 | W3 | E até a face do perfil. E e perfil são prioridade 1 e materiais diferentes: linha, sem corte | E até a face do perfil; linha no ramal |
| F2 | W1 | Sem E: N e F coincidem; igual ao padrão | Igual ao padrão |
| F2 | W2 | Igual ao padrão | Igual ao padrão |
| F2 | W3 | Igual ao padrão. A do piso e a do gesso são prioridade 4 com materiais diferentes: linha | Igual ao padrão |
| F3 | W1 | E até N; M é linha na face F; S e A até F | E até N da passante; M é linha até F no lado do ramal |
| F3 | W2 | E até N; M é linha na face F | E até N; M é linha até F |
| F3 | W3 | E até a face do perfil; M é linha na face F | E até a face do perfil; M é linha até F |

Tags: `[DOC]` para núcleo, hierarquia e linha quando a função casa com material diferente. `[DECISÃO 0004 #2]` para esquadria núcleo com núcleo, que é decisão do projeto e não pesquisa. `[INFERIDO]` para todas as células de corte por camada. `[NÃO ENCONTRADO]`: a regra oficial de piso × parede por camada (pesquisa C, lacuna 1). Validar no Revit antes da fase P8 (avaliação do programa).

### 9.2 Vínculo associativo (B)

| Caso | Entrada | Esperado | Tag |
|---|---|---|---|
| Mover parede | Circuito continua fechado | Área do piso acompanha o novo circuito; sem comando | Decisão do dono |
| Trocar tipo W1 por W2 (0,184 m para 0,242 m) | Piso vinculado | Área vai de 10,745856 m² para 10,635192 m² (espaço medido em INV-D) | Medido |
| Abrir porta ou janela | Circuito inalterado | Área igual à de antes (10,745856 m²) | Decisão do dono; `0018` #3 |
| Apagar parede que fecha o circuito | Circuito aberto | Mantém o último contorno (área inalterada) e mostra `contorno-aberto` | Decisão do dono; `0018` #7 |
| Editar vértice | Piso vinculado | Vira manual, com aviso e botão "Revincular" | Decisão do dono |
| Abrir arquivo v18 | Piso sem origem | Estático, área igual, botão "Revincular" disponível | `[INFERIDO]` |
| Dois pisos no mesmo circuito | Ambos vinculados | Os dois corretos; aviso `piso-circuito-duplicado` | `[INFERIDO]` |
| Edição em outro nível | Parede do nível 2 movida | Nível 1 sem recálculo | `[INFERIDO]` (desempenho) |

### 9.3 Membrana, quantitativos e anexo

| Caso | Entrada | Esperado | Tag |
|---|---|---|---|
| G-M | `ls_cobertura` (membrana 0 m) | Linha na face; área de face igual à da laje; volume da membrana 0 | `[DECISÃO 0005 #8]` |
| G-Q | `ft_ceram` sobre `ls_mac12`, piso no topo da laje | Aviso `piso-estrutura-sobre-laje`; com `ft_acab`, total de concreto 1,44 m³ para 12 m² (hoje 2,88 m³) | `[INFERIDO]` |
| G-C | Parede embutida no piso (base -0,10 m, altura 0,05 m) | Corte da parede: 0; quantitativo líquido da parede: 0; piso mantém 4,56 m³ (INV-D §4) | `[DOC]` hierarquia; `[INFERIDO]` quantitativo |
| G-T | Parede de 4 m com piso cobrindo metade do eixo | Base 0,05 m no trecho coberto; 0 no trecho descoberto; aviso parcial | `[DOC]` (regra de trecho); aviso `[INFERIDO]` |

### 9.4 Riscos a validar

- A regra oficial de piso × parede por camada não foi encontrada. Só há fórum (pesquisa C, lacunas 1 e 5).
- A prioridade da membrana (3) é proposta.
- Revit 2026 pode ter separado função e prioridade. Não verificado.
- Retorno de piso e ordem de junção em X: não encontrados.
- Páginas bloqueadas na pesquisa (403), como "Layer Join Cleanup" e "Wall Functions". Ver pesquisa C §6, lacuna 9.

## 10. Plano em fases

| Fase | O que muda (arquivos) | Depende de | Tamanho |
|---|---|---|---|
| P1. Vínculo do contorno | `packages/model/src/types.ts` (origem em `Floor` e `Slab`), `floor.ts`, `slab.ts`, `migrate.ts` (v18 para v19, só avança a versão); `packages/engine/src/floors.ts`, `slabs.ts`, novo `contornoVinculado`, circuitos movidos de `packages/tools/src/enclosed.ts`; `floorTool.ts`, `slabTool.ts` (gravam origem); comandos `vincularContorno` e `desvincularContorno` | Nada | G |
| P2. Vínculo na interface e avisos | `apps/web/src/ui/Properties.tsx` (botões e estado); `validateSlabs.ts` (`contorno-aberto`, `piso-circuito-duplicado`); painel de avisos; alças de `floorTool.ts` (desvincular) | P1 | M |
| P3. Testes do vínculo (gate) | Testes de §9.2 e contador de recálculos por nível | P1, P2 | M |
| P4. Membrana zero | `floors.ts:45-47`, `slabs.ts:43`, `plan/floors.ts`, `plan/slabs.ts`, `model3d/solids.ts` (sem volume), `floorQuantities.ts`, `slabQuantities.ts` | Nada (pode correr em paralelo) | M |
| P5. Quantitativos e tipos padrão | `floor.ts` (tipo `ft_acab`, padrão de piso sobre laje); `validateSlabs.ts` (`piso-estrutura-sobre-laje`); `floorQuantities.ts`, `slabQuantities.ts`, `quantities.ts` (líquido) | P4 | M |
| P6. Corte e planta por cota | `sectionOcclusion.ts:33-50`, `section.ts:193-308`, `plan/build.ts:195-196,237` | Nada (medir depois de P5) | M |
| P7. Junção piso/laje × parede | `packages/model/src/priority.ts` (comentário e uso de sobrescrita); novo resolvedor de hierarquia no motor; comando "Inverter corte" e "Não cortar"; `LayerAdvanced.tsx`, `FloorTypeDialog.tsx:135`, `SlabTypeDialog.tsx:135` | P1, P5 | G |
| P8. Contorno por camada | `floors.ts`, `slabs.ts` (`layerExtent`), `floorQuantities.ts:52-55`, `slabQuantities.ts:69-72`, `plan/floors.ts`, `plan/slabs.ts`, `section.ts:193-257`, `model3d/solids.ts:393-446` | P1, P3, P7 | G |
| P9. Parede anexada por trecho | `wallZ.ts` (61-130), `layerGeom.ts` (`withProfile`, 230), `types.ts:166-168` (`bottomProfile`), `Properties.tsx` (controles e aviso) | P3 | G |

Ordem sugerida: P1, P2 e P3 primeiro (gate). P4 e P6 em paralelo. P5 depois de P4. P7 depois de P5. P8 depois de P7. P9 depois de P3. O contorno associativo vem antes do corte por camada, como pede o dono.

## 11. Riscos e compatibilidade

- **Arquivos salvos.** v18 abre sem mudança: pisos e lajes viram estáticos. Arquivo v19 não abre em versão antiga, porque versão futura é recusada (decisão 0005 #10). Avisar na release.
- **Regressão visual.** Capturas de `docs/paridade/` (G6) mudam só onde há sobreposição, membrana ou ordem de corte. Criar um caso novo para cada uma.
- **Quantitativos já exportados.** CSV e DXF mudam em projetos com sobreposição de piso com laje ou de parede com piso. Nota de versão.
- **Tipo padrão.** Projetos antigos mantêm `ft_ceram`. Só projetos novos recebem `ft_acab`.
- **Desempenho.** Circuitos por nível em cache. Medir em P3 com uma casa de referência (200 paredes ou mais). Aceite: editar um nível não recalcula os outros.
- **Forro.** Usa `roomId` gravado (`types.ts:347`), diferente de B. Decidir depois (P-5).
- **Revit 2026.** Pode ter mudado a prioridade de junção. Verificar antes de P7.
- **Pesquisa incompleta.** Por camada entre piso e parede é inferido (§9.1).

## 12. Critérios de aceitação

- Cada fase fecha com os testes dela verdes e `npm run check`.
- Os itens de §9 entram como testes, sem regressão nos casos dourados G3 de pisos e lajes.
- O derivado não é gravado, exceto o último contorno válido de `boundary`. Teste de ida e volta de arquivo.
- Quando a fase fecha, marcar os itens em `docs/paridade/pisos.md` (C1 a C4) e `docs/paridade/lajes.md` (C1 a C3). Esta decisão não altera esses arquivos.

## 13. Pendências do dono

- **P-1.** Membrana com prioridade 3 (proposta), ou sem número? Validar no Revit antes de P7 (`[INFERIDO]`).
- **P-2.** Aprovar o tipo novo `ft_acab` como padrão de piso sobre laje, sem reescrever tipos já salvos (§4).
- **P-3.** Parede parcialmente anexada: perfil de base (proposta, reusa `topProfile`) ou dividir a parede no limite do piso (§6).
- **P-4.** "Inverter corte": por par (proposta) ou por tipo?
- **P-5.** O forro (`0021`) passa a seguir o modelo B, ou fica como está?

## Nota: correções a `docs/05` (não aplicadas nesta tarefa)

1. `docs/05` §7.1, item 2: no Join Geometry, a primeira escolha define só o material aplicado aos dois `[DOC]`. A dominância segue a hierarquia por tipo (§1.3). A frase "a primeira parede escolhida domina" é de fórum `[SEC]`.
2. `docs/05` §9, item sobre o núcleo ("se estendem até a camada de função Estrutura [1]"): a regra oficial é a do núcleo do elemento unido, que atravessa camadas de prioridade maior fora do núcleo `[DOC]` (§1.2).

## Fontes principais (pesquisa C)

- Autodesk, Join Geometry (2023): help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-F3D6884F-F1E3-471B-81FB-ECE93D9C2671.htm
- Autodesk, Applying a Function to a Layer of a Compound Structure (2014): help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1CCD1005-CBDA-4338-8D60-489095D4BB25.htm
- Autodesk, Attach Walls to Other Elements (2026): help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-ED60CE62-B955-45E9-9D7D-00F1552D858C.htm
- Autodesk, Create a Floor (2015): help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-A688CED0-E08C-4ED3-A8E8-14CBE78902BB.htm
- Graphisoft, Basic Intersection Principles (AC25): help.graphisoft.com/START/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-269.htm
