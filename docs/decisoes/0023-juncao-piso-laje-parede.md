# 0023 · Junção entre piso/laje e parede

Origem: pedido do dono, "a do Revit" (modelo de junção do Revit para piso/laje × parede). Insumos: pesquisa C (`scratchpad/relatorios/res-c-revit-archicad-pisos-lajes.md`) e mapa do estado atual (`scratchpad/wt/inv3/RELATORIO-INV.md`, INV-D, medições em `tests/inv-d*.test.ts`). Código citado como `arquivo:linha`, conferido na worktree.

Status: documento de decisão, sem código. Decisão 10 (contorno associativo, §8): **DECIDIDA**, opção B. Decisões 1 a 9: propostas, salvo as aprovadas em §13 (P-1, P-2, P-3, P-5, P-6 e P-7). **P-4 (inversão de corte): ADIADA** (§13). Pendências: §9.4 e §11.

Legenda: `[DOC]` documentação oficial (Autodesk / Graphisoft). `[SEC]` fórum, blog ou tutorial. `[INFERIDO]` dedução a partir das fontes ou proposta deste documento. `[NÃO ENCONTRADO]` pesquisado e sem fonte. `[DECISÃO n]` decisão já registrada em outro documento de `docs/decisoes/`.

Princípio desta versão (P-6): toda regra usa atributo de camada (função, prioridade, posição em relação ao núcleo, espessura, `wraps`, término). Nenhuma regra depende de nome ou de material. Nomes de tipo e de material aparecem só como identificação ou ilustração nos exemplos.

## Decisões

| # | Decisão | Motivo | Tag |
|---|---|---|---|
| 1 | Prioridade de junção por função da camada: Estrutura 1, Substrato 2, Térmica/Ar 3, Acabamento 1 4, Acabamento 2 5 (valores já em `packages/model/src/priority.ts:8-15`). Prioridade efetiva = `priority` da camada, quando definido (§1.1). Membrana: 3, empatada com a térmica | Ordem oficial da ajuda Revit; a membrana não tem número na ajuda (§1.1). Membrana aprovada (P-1) | `[DOC]`; membrana `[INFERIDO]` |
| 2 | Regra do núcleo: camada dentro do núcleo do elemento unido se estende pelo núcleo e atravessa prioridade maior que esteja fora dele. Substitui "até Estrutura [1]" (`docs/05` §9) | Ajuda Revit 2014 ("Applying a Function") | `[DOC]` |
| 3 | Quem corta quem, por padrão: laje estrutural corta piso; piso e laje cortam parede; parede nunca corta piso ou laje. Vale para quantitativos e junção, não para a linha oculta (§3). Inversão por par: ADIADA (P-4) | Hierarquia do Join Geometry (Revit 2023) | `[DOC]`; inversão `[INFERIDO]` |
| 4 | Término por camada: propriedade `Término na junção` por camada de piso e de laje (§2), padrão `auto`, pela posição da camada em relação ao núcleo do piso. Substitui o contorno único por elemento (`floors.ts:47-54`) | O contorno igual para todas as camadas não atende; a regra é por atributo de camada (P-6, P-7) | `[INFERIDO]` |
| 5 | Corte e planta ordenados por cota de topo (feito na P6, §3). A hierarquia de junção entra só nos quantitativos e na junção (P5, P7) | Antes da P6, a ordem de inserção decidia (`sectionOcclusion.ts`, `[INFERIDO]`) | `[INFERIDO]` |
| 6 | Quantitativos líquidos: o elemento cortado perde o volume sobreposto. Tipo padrão `ft_ceram` deixa de trazer camada estrutural para uso sobre laje (tipo novo `ft_acab`) | Estrutura contada duas vezes em `ft_ceram` sobre `ls_mac12` (INV-D §5) | `[INFERIDO]` |
| 7 | Membrana de espessura zero em piso e laje: linha na planta e área de face nos quantitativos, sem volume, como em parede | Hoje é descartada (`floors.ts:45-47`, `slabs.ts:43`); igual à decisão 0005 #8 | `[DECISÃO 0005 #8]` |
| 8 | Parede anexada a piso ou laje é avaliada por trecho, não pelo ponto médio. Controle na propriedade: anexar e desanexar base e topo. Aviso quando só parte da parede está coberta | Hoje decide pelo ponto médio (`wallZ.ts:103-115`); a ajuda diz que só a parte sobre o piso se anexa | `[DOC]` (regra de trecho); `[INFERIDO]` (controle e aviso) |
| 9 | O campo "Prioridade de junção" do tipo de piso e de laje passa a valer como prioridade efetiva da camada (§1.1) | Hoje é editável e não tem efeito (§7) | `[INFERIDO]` |
| 10 | **Contorno associativo: opção B, decidida pelo dono.** O piso ou laje criado a partir das paredes guarda a origem e o contorno é derivado. Edição manual de vértice solta o vínculo | Pedido do dono; mesmo princípio dos ambientes (`0018` #1) | **DECIDIDA** |

## 1. Modelo adotado (Revit)

### 1.1 Prioridade efetiva por camada

Neste documento, "maior prioridade" é número menor (1 é a maior).

Prioridade efetiva da camada = `priority` da camada, quando definido; senão, o número da função:

| Função | Prioridade padrão | Tag |
|---|---|---|
| Estrutura | 1 | `[DOC]` |
| Substrato | 2 | `[DOC]` |
| Térmica / ar | 3 | `[DOC]` |
| Membrana | 3 (aprovada, P-1) | `[INFERIDO]` |
| Acabamento 1 | 4 | `[DOC]` |
| Acabamento 2 | 5 | `[DOC]` |

O campo `priority` já existe em `Layer` e no editor, mas não tem efeito em piso nem em laje (§7). É opcional e aditivo: sem migração, como os demais campos novos.

Regra do Revit `[DOC]`: camada de prioridade menor (número maior) não atravessa camada de prioridade igual ou maior; mesma prioridade e mesmo material funde, material diferente deixa linha. No Hestia a fusão depende de material, e isso não pode entrar na regra (P-6). Adotado `[INFERIDO]`: camada de prioridade menor não atravessa igual ou maior; mesma prioridade não corta e deixa linha de fronteira, sem fusão. A fusão fica como ponto aberto (§9.4).

A ajuda oficial de 2014 não dá número de prioridade à membrana (pesquisa C §1). O 3 foi aprovado pelo dono (P-1). A membrana tem espessura zero: não corta nem é cortada por volume; a prioridade só decide em qual face a linha para. Empatada com a térmica, ela não corta os acabamentos (4 e 5). `priority.ts:4-6` diz "conforme a fonte consultada"; esse comentário deve ser trocado na fase P7. Validar no Revit (teste G-M, §9.3).

A ajuda de 2026 pode separar função e prioridade de junção (`[SEC]`, não verificado: pesquisa C §1, lacuna 2). Por isso o `priority` da camada sobrescreve a função, e o padrão continua sendo a função.

### 1.2 Regra do núcleo

Camada dentro do núcleo do elemento unido se estende pelo núcleo do outro e atravessa camadas de prioridade maior (número menor) que estejam fora do núcleo `[DOC]`. Camadas fora do núcleo seguem a prioridade normal. Isto corrige `docs/05` §9 (ver nota ao fim).

### 1.3 Hierarquia de corte por tipo de elemento

| Par | Quem corta (padrão) | Tag |
|---|---|---|
| Laje estrutural × piso | Laje corta piso | `[DOC]` ("Structural elements cut host elements (walls, roofs, ceilings, and floors)") |
| Piso ou laje × parede | Piso e laje cortam a parede | `[DOC]` ("Floors, ceilings, and roofs cut walls") |
| Parede × piso ou laje | Parede não corta | `[DOC]` |
| Piso × piso e laje × laje (mesmo nível) | Sem regra oficial: aviso de sobreposição, sem corte automático | `[NÃO ENCONTRADO]`; aviso já existe em `validateSlabs.ts:82-135` |

Mapeamento: `slab` é a laje estrutural e `floor` é o piso, que faz o papel de hospedeiro.

Esta hierarquia vale para os quantitativos (§4) e para a junção (P7). Não vale para a linha oculta do corte (§3).

Inversão por par ("Inverter corte" e "Não cortar"): **ADIADA** (P-4, §13). Hoje vale só o padrão acima. Quando for decidida, o equivalente do Join Geometry é: o primeiro escolhido define o material aplicado aos dois `[DOC]`. No Hestia o material fica por camada, então a escolha não define material; define só quem corta `[INFERIDO]`.

### 1.4 O que NÃO se copia

- Join Geometry como passo obrigatório: o Hestia junta sozinho pela hierarquia; o comando manual, se houver, serve só para inverter.
- Butt e Miter: são só entre paredes `[DOC]` (About Wall Joins). Não existe equivalente para piso × parede.
- Retorno (wrapping) de piso ou laje: `[NÃO ENCONTRADO]`. Fora.
- Prioridade por pele do ArchiCAD: só vale como parede segundo `[SEC]`. Não copiar.
- Números de prioridade da ajuda de 2026, enquanto não forem verificados.

## 2. Término por camada

Hoje há um contorno por elemento, igual para todas as camadas (`floors.ts:47-54`, `floorQuantities.ts:52-55`; INV-D §2.1). "Até o núcleo" faz todas as camadas, inclusive o contrapiso, avançarem até o núcleo (INV-D §2.1).

**Propriedade `Término na junção`** (nome da UI), por camada de piso e de laje. Campo opcional e aditivo em `Layer`, como `priority?`: sem migração; arquivo sem o campo abre igual. Fica numa seção avançada do editor de tipo. Os padrões dão o corte correto sem o usuário mexer.

| Valor | Até onde a camada vai na parede |
|---|---|
| `auto` (padrão) | Camada dentro do núcleo do piso: até o núcleo da parede. As demais: até a face de acabamento da parede. `[INFERIDO]` |
| `núcleo` | Até o núcleo da parede |
| `face de acabamento` | Até a face de acabamento da parede |
| deslocamento em cm | Positivo avança sobre a parede; negativo recua. Referência proposta: face de acabamento (ponto aberto, §9.4) |

Com o núcleo do piso na camada estrutural, `auto` reproduz a tabela anterior: estrutura até o núcleo; substrato, acabamento e membrana até a face. `[INFERIDO]`

`Término na junção` não é o `modo` do contorno do piso (§8.2): o modo define o circuito; o término decide, camada a camada, até qual face desse circuito ela vai.

**Exemplo por atributos.** Parede com camada de acabamento de prioridade 4, fora do núcleo, encontra um piso com substrato (prioridade 2) e acabamento (prioridade 4). A camada da parede para no topo da camada de maior prioridade do piso que ela encontra: o substrato (2). Para a camada da parede descer mais, o usuário aumenta o número de prioridade desse substrato (por exemplo, de 2 para 5, ou seja, menor prioridade): a parede passa a atravessá-lo. O mesmo efeito se obtém na camada da parede, diminuindo o número dela (por exemplo, de 4 para 2: prioridade maior, igual à do substrato). Lembrete: número menor = prioridade maior. Nenhum nome ou material entra na regra. Testes: §9.5.

**Limitação.** `[NÃO ENCONTRADO]`: o Revit não documenta término por camada em piso. Isto é melhoria própria, não cópia. Revestimento só até certa altura (barra de revestimento, rodapé, por exemplo) é das faixas verticais da parede (decisão 0005), independente do piso.

**Implementação.** `enclosedRooms` já gera os contornos `'finish' | 'core'` (`packages/tools/src/enclosed.ts:34-41`); o término escolhe um deles por camada. O deslocamento em cm exige um contorno a mais por valor, calculado pelo mesmo circuito.

Perímetro externo: o mesmo princípio, com a face externa. Na v1, a regra por camada vale para paredes internas; no perímetro, todas as camadas usam o mesmo contorno até a fase P8.

## 3. Corte e planta por cota

**Corte, como está (P6, feito).** A linha oculta é feita por peça (uma por origem em cada material) e ordenada pela cota de topo do elemento inteiro (`sectionOcclusion.ts`, `cotaKeys`; peças em `sectionCut.ts`). Regra:
1. O elemento de maior cota de topo prevalece no ponto.
2. Parede com base e topo dentro da faixa de cotas de piso, laje, forro, telhado ou escada que a toca em planta não é ocultada por esse elemento. `[INFERIDO]`; atende o pedido de INV-D §7, lacuna 6.
3. Empate de topo: a parede fica por cima; o resto, pela ordem da lista.

A hierarquia do §1.3 ("piso corta parede") não entra na linha oculta, porque faria a parede embutida sumir do corte. Ela vale para quantitativos (§4, P5) e junção (P7). `[INFERIDO]`

Antes da P6 a ordem de inserção decidia (pisos, lajes, forros, telhados, escadas e paredes, `sectionOcclusion.ts`), e a parede embutida no piso sumia: 0,200 m³ de corte sozinha e 0,000 m³ com o piso (INV-D §4). Hoje ela aparece inteira; o piso perde só a faixa comum, e a área do conjunto não cai.

**Planta, como está (P6, feito).** Pisos e lajes são pintados em ordem crescente da cota da face superior no centro da caixa do contorno (`plan/surfaces.ts`). Empate: lajes antes dos pisos. Paredes continuam por cima. Antes da P6, a ordem fixa era lajes, depois pisos, depois paredes (`plan/build.ts:195-196,237`).

## 4. Quantitativos líquidos e tipos padrão

**Regra.** O elemento cortado (§1.3) perde o volume sobreposto ao que o corta, somente onde as faixas de cota se cruzam. Para piso e laje, subtrai-se a área de face na mesma condição. Nada muda quando o piso assenta na face superior da laje, porque não há sobreposição. `[INFERIDO]`

**Tipo padrão.** `ft_ceram` traz 0,12 m de camada estrutural (concreto, no exemplo; `packages/model/src/floor.ts:33-38`), e `ls_mac12` também tem 0,12 m (`slab.ts:36`). Assentado no topo da laje (deslocamento 0,19 m), o total é 2,88 m³ para 12 m², quando deveria ser 1,44 m³ (INV-D §5). A regra líquida não corrige isso, porque não há sobreposição de cota.

Proposta:
- Criar `ft_acab` (acabamento sobre laje, sem camada estrutural: 0,01 m de acabamento e 0,03 m de substrato), como padrão para pisos em nível com laje.
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

**Proposta.** Decidida em P-3 (§13): perfil de base.
- Avaliação por trecho: o eixo é cortado nos limites dos pisos e lajes do nível. Cada trecho coberto recebe a base na face superior (a mais alta, como hoje); o trecho descoberto fica na cota do nível.
- Implementação: perfil de base (`bottomProfile`), reusando a fatia do `topProfile` (`layerGeom.ts:230`, decisão 0005 #5).
- Controle: na propriedade da parede, "Anexar base ao piso ou laje" e "Desanexar base", com o mesmo para o topo (nível do topo a escolher).
- Aviso `parede-parcialmente-anexada` quando parte do eixo não tem cobertura, com o trecho destacado.
- Topo com perfil superior continua sem anexo (`wallZ.ts:102,105`).

## 7. Campo "Prioridade de junção"

Hoje o campo aparece e é editável em `FloorTypeDialog.tsx:135`, `SlabTypeDialog.tsx:135` e `LayerAdvanced.tsx:52-77`, mas `floors.ts`, `slabs.ts` e os quantitativos não leem `priority`. Só o resolvedor de paredes usa (`resolve.ts:16-17,114-166`).

Proposta: `layerPriority` (`priority.ts:26`) passa a ser usado na junção piso/laje × parede (§1.3) e no término por camada (§2). Sem valor, vale a função (§1.1). O rótulo passa a dizer "Prioridade de junção (sobrescreve a função)".

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

**(d) Lugar no plano.** Entra nas fases P1 a P3, antes do término por camada (P8) e do anexo por trecho (P9), porque ambos dependem de contorno estável e do modo.

Pendência relacionada: o forro (`0021`) usa `roomId` como referência e grava o contorno (`types.ts:347`). Segue B quando criado a partir de ambiente, por P-5 (§13); forro desenhado à mão continua estático.

## 9. Testes dourados (tabela, não implementada)

Convenção: E estrutura, S substrato, A acabamento, M membrana (espessura zero). N face do núcleo da parede. F face de acabamento da parede. Caso padrão G-A: piso pela face F, sem sobreposição; a área é a do espaço livre. Caso G-B: piso pelo núcleo (modo `paredes-nucleo`), com resultado por camada.

Tipos (padrão do código, `floor.ts:33-38` e `slab.ts:36`; paredes em `defaults.ts:67-93`; nomes são só identificação de exemplo, nenhuma regra depende deles): piso F1 `ft_ceram` (A 0,01, S 0,02, S 0,04, E 0,12); piso F2 `ft_acab` (A 0,01, S 0,03, proposta); piso F3 molhado (A 0,01, M 0, S 0,03, E 0,10, exemplo). Parede W1 `wt_alv14` (núcleo 0,14, faces de núcleo a 0,022 e 0,162); W2 `wt_ext19` (núcleo 0,19); W3 `wt_dry` (núcleo de 0,048 m, camada estrutural).

### 9.1 Piso × parede em L e T (caso G-B)

| Piso | Parede | L (canto interno do cômodo) | T (parede passante e ramal) |
|---|---|---|---|
| F1 | W1 | E até N nos dois trechos (esquadria núcleo com núcleo); S e A até F | E até N da passante; o ramal encosta em N; S e A até F |
| F1 | W2 | E até N do bloco 19; S e A até F; acabamento externo fora do circuito | E até N; ramal encosta em N; S e A até F |
| F1 | W3 | E até a face do núcleo da W3. E da parede e E do piso são prioridade 1: sem corte, linha de fronteira | E até a face do núcleo da W3; linha no ramal |
| F2 | W1 | Sem E: N e F coincidem; igual ao padrão | Igual ao padrão |
| F2 | W2 | Igual ao padrão | Igual ao padrão |
| F2 | W3 | Igual ao padrão. Acabamento do piso e acabamento da parede, ambos prioridade 4: sem corte, linha de fronteira | Igual ao padrão |
| F3 | W1 | E até N; M é linha na face F; S e A até F | E até N da passante; M é linha até F no lado do ramal |
| F3 | W2 | E até N; M é linha na face F | E até N; M é linha até F |
| F3 | W3 | E até a face do núcleo da W3; M é linha na face F | E até a face do núcleo da W3; M é linha até F |

Tags: `[DOC]` para núcleo, hierarquia e linha entre camadas de mesma prioridade. `[DECISÃO 0004 #2]` para esquadria núcleo com núcleo, que é decisão do projeto e não pesquisa. `[INFERIDO]` para todas as células de corte por camada. `[NÃO ENCONTRADO]`: a regra oficial de piso × parede por camada (pesquisa C, lacuna 1). Validar no Revit antes da fase P8 (avaliação do programa).

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
| G-Q | `ft_ceram` sobre `ls_mac12`, piso no topo da laje | Aviso `piso-estrutura-sobre-laje`; com `ft_acab`, total de estrutura (concreto no exemplo) 1,44 m³ para 12 m² (hoje 2,88 m³) | `[INFERIDO]` |
| G-C | Parede embutida no piso (base -0,10 m, altura 0,05 m) | Corte: parede inteira (0,200 m³, como sozinha); piso perde só a faixa comum (P6). Quantitativo líquido: parede 0; piso mantém 4,56 m³ (INV-D §4) | `[INFERIDO]` corte (P6); `[DOC]` hierarquia no quantitativo |
| G-T | Parede de 4 m com piso cobrindo metade do eixo | Base 0,05 m no trecho coberto; 0 no trecho descoberto; aviso parcial | `[DOC]` (regra de trecho); aviso `[INFERIDO]` |

### 9.4 Riscos a validar

- A regra oficial de piso × parede por camada não foi encontrada. Só há fórum (pesquisa C, lacunas 1 e 5).
- A prioridade da membrana (3) está aprovada (P-1), mas não tem fonte oficial: validar em G-M.
- Revit 2026 pode ter separado função e prioridade. Não verificado.
- Retorno de piso e ordem de junção em X: não encontrados.
- Páginas bloqueadas na pesquisa (403), como "Layer Join Cleanup" e "Wall Functions". Ver pesquisa C §6, lacuna 9.
- Sentido de "aumentar a prioridade" no exemplo do §2 (número maior = menor prioridade) e a leitura de "topo" da camada: validar com G-K2.
- Referência do deslocamento em cm (§2): face de acabamento, proposta.
- Fusão de mesma prioridade do Revit depende de material: não adotada (P-6). Se o dono quiser fusão, precisa de um atributo de camada próprio, não de material.

### 9.5 Término por camada (caso G-K)

Parede W1 com camada de acabamento de prioridade 4, fora do núcleo; piso F1 com substrato S (2) e acabamento A (4).

| Caso | Entrada | Esperado | Tag |
|---|---|---|---|
| G-K1 | `Término` auto em todas as camadas | Camada de acabamento da parede para no topo do S (maior prioridade do piso que encontra). Acabamentos do piso e da parede, ambos 4: sem corte, linha | `[INFERIDO]` (exemplo do dono, por atributos) |
| G-K2 | Igual a G-K1, mas S do piso com prioridade 5 | A camada da parede deixa de parar no topo do S e desce mais. Resultado a validar no Revit | `[NÃO ENCONTRADO]` |
| G-K3 | Sem o campo `Término` em nenhuma camada | Igual à tabela §9.1 (padrão `auto`). Arquivo sem o campo abre igual | `[INFERIDO]` |

## 10. Plano em fases

| Fase | O que muda (arquivos) | Depende de | Tamanho |
|---|---|---|---|
| P1. Vínculo do contorno | `packages/model/src/types.ts` (origem em `Floor` e `Slab`), `floor.ts`, `slab.ts`, `migrate.ts` (v18 para v19, só avança a versão); `packages/engine/src/floors.ts`, `slabs.ts`, novo `contornoVinculado`, circuitos movidos de `packages/tools/src/enclosed.ts`; `floorTool.ts`, `slabTool.ts` (gravam origem); comandos `vincularContorno` e `desvincularContorno` | Nada | G |
| P2. Vínculo na interface e avisos | `apps/web/src/ui/Properties.tsx` (botões e estado); `validateSlabs.ts` (`contorno-aberto`, `piso-circuito-duplicado`); painel de avisos; alças de `floorTool.ts` (desvincular) | P1 | M |
| P3. Testes do vínculo (gate) | Testes de §9.2 e contador de recálculos por nível | P1, P2 | M |
| P4. Membrana zero | `floors.ts:45-47`, `slabs.ts:43`, `plan/floors.ts`, `plan/slabs.ts`, `model3d/solids.ts` (sem volume), `floorQuantities.ts`, `slabQuantities.ts` | Nada (pode correr em paralelo) | M |
| P5. Quantitativos e tipos padrão | `floor.ts` (tipo `ft_acab`, padrão de piso sobre laje); `validateSlabs.ts` (`piso-estrutura-sobre-laje`); `floorQuantities.ts`, `slabQuantities.ts`, `quantities.ts` (líquido) | P4 | M |
| P6. Corte e planta por cota | `sectionOcclusion.ts`, `section.ts`, `plan/build.ts`, `plan/surfaces.ts` | Nada (medir depois de P5) | M |
| P7. Junção piso/laje × parede | `packages/model/src/priority.ts` (prioridade efetiva, §1.1; troca o comentário de `priority.ts:4-6`); novo resolvedor de hierarquia no motor (padrão por tipo, §1.3); `LayerAdvanced.tsx`, `FloorTypeDialog.tsx:135`, `SlabTypeDialog.tsx:135` | P1, P5 | G |
| P8. Término por camada | `packages/model/src/types.ts` (`Término na junção` em `Layer`, opcional, sem migração); `LayerAdvanced.tsx` (seção avançada); `floors.ts`, `slabs.ts` (`layerExtent`, §2); `floorQuantities.ts:52-55`, `slabQuantities.ts:69-72`, `plan/floors.ts`, `plan/slabs.ts`, `section.ts:193-257`, `model3d/solids.ts:393-446` | P1, P3, P7 | G |
| P9. Parede anexada por trecho | `wallZ.ts` (61-130), `layerGeom.ts` (`withProfile`, 230), `types.ts:166-168` (`bottomProfile`), `Properties.tsx` (controles e aviso) | P3 | G |
| P10. Inverter corte e Não cortar (futura) | Comandos por par e desfazer da junção. Só se P-4 for decidida (com um caso real) | P7, decisão P-4 | M |

**Status (2026-10-22): P1 concluída** — contorno associativo no modelo (`outlineSource?` em `Floor`/`Slab`), migração v18→v19 (só avança a versão, pisos/lajes antigos viram estáticos), comandos `detachOutline`/`relinkOutline`, motor (`resolveBoundary`; circuitos movidos de `tools/enclosed.ts` para `engine/enclosed.ts`, com cache por nível) e ferramentas (Piso/Laje gravam a origem; alças de vértice soltam o vínculo). P2 e P3 seguem pendentes.

Ordem sugerida: P1, P2 e P3 primeiro (gate). P4 e P6 em paralelo. P5 depois de P4. P7 depois de P5. P8 depois de P7. P9 depois de P3. P10 só depois de P-4. O contorno associativo vem antes do término por camada, como pede o dono.

**Status da P6 (implementada).** Corte e planta ordenados por cota. A linha oculta não segue mais a ordem de inserção, e a parede embutida não some mais; §3 descreve a regra atual.

- **Corte.** A linha oculta é feita por peça (uma por origem em cada material), não por material. Quem fica por cima é a cota de topo do elemento inteiro (`sectionOcclusion.ts`, `cotaKeys`; peças em `sectionCut.ts`). Regra adotada: (a) o elemento de maior cota de topo prevalece no ponto; (b) parede com base e topo dentro da faixa de cotas de piso, laje, forro, telhado ou escada que a toca em planta não é ocultada por ele (`[INFERIDO]`; é o pedido de `INV-D` §7, lacuna 6); (c) empate de topo: a parede fica por cima; o resto pela ordem da lista.
- **Desvio em relação à proposta original do §3.** A hierarquia do §1.3 (piso corta parede) não entra na linha oculta, porque faria a parede embutida sumir do corte, que é o problema medido (0,200 m³ sozinha, 0,000 m³ com o piso). Ela continua valendo para os quantitativos (P5 e P7). Quando o piso é o único a conter a parede em cota, o total do conjunto não perde área: a parede fica inteira e o piso perde só a faixa comum.
- **Planta.** Pisos e lajes são pintados em ordem crescente da cota da face superior no centro da caixa do contorno (`plan/surfaces.ts`). Empate: lajes antes dos pisos, como antes; as paredes continuam por cima.
- **Testes.** `packages/engine/src/sectionCota.test.ts` (caso medido e laje sob piso), `sectionOcclusion.test.ts` (regras, empate e propriedade com 10 sementes fixas: soma das áreas visíveis igual à união, não menor que a do elemento mais alto) e `packages/render/src/plan/surfaces.test.ts` (ordem dos preenchimentos em `buildPlanDrawList`, empate e ocultos).
- **Regressão visual** (`npm run build` e `node tests/e2e/visual-regression.mjs`, sem `--update`): 0,000% em todos os casos.
- **Fora da P6:** quantitativos líquidos (P5), hierarquia de junção (P7), inversão por par (P10, se P-4 for decidida) e término por camada (P8). `docs/paridade/pisos.md` e `lajes.md` não têm item de ordem de corte e planta, então não foram alterados.

## 11. Riscos e compatibilidade

- **Arquivos salvos.** v18 abre sem mudança: pisos e lajes viram estáticos. Arquivo v19 não abre em versão antiga, porque versão futura é recusada (decisão 0005 #10). Avisar na release. `priority` e `Término na junção` são campos opcionais: sem migração.
- **Regressão visual.** Capturas de `docs/paridade/` (G6) mudam só onde há sobreposição, membrana ou ordem de corte. Criar um caso novo para cada uma.
- **Quantitativos já exportados.** CSV e DXF mudam em projetos com sobreposição de piso com laje ou de parede com piso. Nota de versão.
- **Tipo padrão.** Projetos antigos mantêm `ft_ceram`. Só projetos novos recebem `ft_acab`.
- **Desempenho.** Circuitos por nível em cache. Medir em P3 com uma casa de referência (200 paredes ou mais). Aceite: editar um nível não recalcula os outros.
- **Forro.** Usa `roomId` gravado (`types.ts:347`). Segue B quando criado de ambiente (P-5, §13).
- **Inversão de corte.** Adiada (P-4). Sem o comando, vale só o padrão por tipo de elemento.
- **Revit 2026.** Pode ter mudado a prioridade de junção. Verificar antes de P7.
- **Pesquisa incompleta.** Por camada entre piso e parede é inferido (§9.1).

## 12. Critérios de aceitação

- Cada fase fecha com os testes dela verdes e `npm run check`.
- Os itens de §9 entram como testes, sem regressão nos casos dourados G3 de pisos e lajes.
- O derivado não é gravado, exceto o último contorno válido de `boundary`. Teste de ida e volta de arquivo, com e sem o campo `Término na junção` (ausente = `auto`).
- Quando a fase fecha, marcar os itens em `docs/paridade/pisos.md` (C1 a C4) e `docs/paridade/lajes.md` (C1 a C3). Esta decisão não altera esses arquivos.

## 13. Decisões do dono (2026-10-22)

- **P-1. Membrana com prioridade 3: APROVADO.** Entre Térmica/Ar (3) e Acabamento 1 (4), no mesmo patamar da térmica. O Revit não numera a membrana na ajuda oficial (`[INFERIDO]`); validar num teste dourado antes de P7.
- **P-2. Tipo novo `ft_acab` (piso de acabamento sobre laje): APROVADO**, sem reescrever tipos já salvos (§4).
- **P-3. Parede parcialmente anexada: perfil de base: APROVADO** (reusa `topProfile`). É o que o Revit faz: "só a parte da parede sobre o piso se anexa" e a altura se ajusta ao contorno, com a parede continuando uma só (`[DOC]` Attach Walls to Other Elements). Dividir a parede não é o comportamento do Revit.
- **P-4: ADIADA.** Agora vale somente o padrão por tipo de elemento (piso e laje cortam parede) nos quantitativos e na junção. A exceção (inverter ou não cortar) por par de elementos, por tipo, ou os dois, será decidida depois, com um caso real. (Referência: o Revit define a hierarquia padrão por tipo e permite inverter e desfazer por par, `[DOC]`; não existe tabela global editável por tipo.)
- **P-5. Forro segue o modelo B** quando criado a partir de ambiente (`roomId`): acompanha o contorno do ambiente, que já é derivado das paredes. Forro desenhado à mão (sem `roomId`) continua estático. É o que o Revit faz: forro automático acompanha as paredes, forro por croqui não.
- **P-6. Regra por atributo de camada, nunca por material: APROVADO.** Nenhuma regra de junção, corte ou término depende de nome ou de material. Exemplos podem citar materiais, só como ilustração.
- **P-7. Propriedade `Término na junção` (por camada, opcional, aditiva, seção avançada do editor de tipo): APROVADA**, com os valores de §2.

## Nota: correções a `docs/05` (não aplicadas nesta tarefa)

1. `docs/05` §7.1, item 2: no Join Geometry, a primeira escolha define só o material aplicado aos dois `[DOC]`. A dominância segue a hierarquia por tipo (§1.3). A frase "a primeira parede escolhida domina" é de fórum `[SEC]`.
2. `docs/05` §9, item sobre o núcleo ("se estendem até a camada de função Estrutura [1]"): a regra oficial é a do núcleo do elemento unido, que atravessa camadas de prioridade maior fora do núcleo `[DOC]` (§1.2).

## Fontes principais (pesquisa C)

- Autodesk, Join Geometry (2023): help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-F3D6884F-F1E3-471B-81FB-ECE93D9C2671.htm
- Autodesk, Applying a Function to a Layer of a Compound Structure (2014): help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1CCD1005-CBDA-4338-8D60-489095D4BB25.htm
- Autodesk, Attach Walls to Other Elements (2026): help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-ED60CE62-B955-45E9-9D7D-00F1552D858C.htm
- Autodesk, Create a Floor (2015): help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-A688CED0-E08C-4ED3-A8E8-14CBE78902BB.htm
- Graphisoft, Basic Intersection Principles (AC25): help.graphisoft.com/START/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-269.htm
