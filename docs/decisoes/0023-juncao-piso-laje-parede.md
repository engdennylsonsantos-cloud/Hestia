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

Regra do Revit `[DOC]`: camada de prioridade menor (número maior) não atravessa camada de prioridade igual ou maior; mesma prioridade e mesmo material funde, material diferente deixa linha. No Hestia a fusão depende de material, e isso não pode entrar na regra (P-6). Adotado `[INFERIDO]`: camada de prioridade menor não atravessa igual ou maior. No empate de prioridade, decide a hierarquia por tipo (§1.3): laje corta piso e parede, e piso corta parede. Camadas de mesma prioridade e do mesmo tipo não se cortam: deixam linha de fronteira e não se fundem por material (P-6). A fusão fica como ponto aberto (§9.4).

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

Perímetro externo: o mesmo princípio, com a face externa. Na v1, a regra por camada vale para paredes internas; no perímetro, todas as camadas usam o mesmo contorno (P8 não cobre o perímetro ainda).

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

**Status (P9, 2026-10-22): concluída, §10.** A cota passou a valer por trecho do eixo (`wallAttach.ts`). Nomes dos avisos: `wall-floor-partial` (informativo) e `wall-attach-none` (aviso). O controle está nas Propriedades ("Base no piso", "Topo no piso").

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

**Status (2026-10-22): P1, P2 e P3 concluídas.** P1: contorno associativo no modelo (`outlineSource?` em `Floor`/`Slab`), migração v18→v19 (só avança a versão, pisos/lajes antigos viram estáticos), comandos `detachOutline`/`relinkOutline`, motor (`resolveBoundary`; circuitos movidos de `tools/enclosed.ts` para `engine/enclosed.ts`, com cache por nível) e ferramentas (Piso/Laje gravam a origem; alças de vértice soltam o vínculo). P2: grupo "Contorno" em `FloorProperties`/`SlabProperties` (estado, "Desvincular", "Revincular às paredes"; um passo de desfazer); avisos `contorno-aberto` e `piso-circuito-duplicado` em `packages/engine/src/outlineIssues.ts` (o `model` não importa o `engine`, então fica no motor, como `stairIssues`), ligados em `useIssues.ts`; a barra de status avisa ao soltar por alça. Desvincular congela o circuito visto no contorno gravado. P3: casos de §9.2 cobertos (mover, espessura, porta, apagar parede, dois pisos, migração ida e volta, cache com 200 paredes por nível) e o fluxo `tests/e2e/contorno.mjs`. Ficou de fora (a validar): prévia de área com confirmação antes de revincular (§8.2b); sugestão de semente para pisos de arquivo v18 (hoje ficam como "Sem vínculo", sem botão); o aviso `piso-circuito-duplicado` sai como `warning` (o app só tem erro e aviso); ao revincular um piso que já tinha furos de ilhas, as ilhas podem aparecer duplicadas nos furos, sem efeito na área.

**Status P4 (feita).** Membrana de espessura zero em piso e laje. O resolvedor mantém a camada (`membrane: true`, z0 = z1; `floors.ts`, `slabs.ts`) com o critério `isMembraneLayer` (função Membrana ou espessura abaixo de 1e-6, `packages/model/src/membrane.ts`). Quantitativos: área de face e volume zero (`floorQuantities.ts`, `slabQuantities.ts`). Planta: linha tracejada no contorno (`plan/floors.ts`, `plan/slabs.ts`). Corte: linha na cota da face (`sectionMembrane.ts`, `SectionResult.membranes`, `section/build.ts`). 3D: sem sólido (`model3d/solids.ts`). A prioridade 3 fica em `MEMBRANE_PRIORITY`, sem efeito de junção até P7. As tabelas de piso e laje são por elemento: a membrana entra nas camadas e em `faceAreaByMaterial`, e o CSV não muda. Ajustados só os dois testes que fixavam o descarte (G3 de laje e quantitativo de piso). Regressão visual sem `--update`: os resultados são idênticos ao commit base `4fd93d8` (3d-escada 3,471%, close-lshape-d 0,989%, close-lshape-f 20,669%). Essas falhas já existem no base e não vêm de P4; a baseline não foi alterada.

Ordem sugerida: P1, P2 e P3 primeiro (gate). P4 e P6 em paralelo. P5 depois de P4. P7 depois de P5. P8 depois de P7. P9 depois de P3. P10 só depois de P-4. O contorno associativo vem antes do término por camada, como pede o dono.

**Status da P6 (implementada).** Corte e planta ordenados por cota. A linha oculta não segue mais a ordem de inserção, e a parede embutida não some mais; §3 descreve a regra atual.

- **Corte.** A linha oculta é feita por peça (uma por origem em cada material), não por material. Quem fica por cima é a cota de topo do elemento inteiro (`sectionOcclusion.ts`, `cotaKeys`; peças em `sectionCut.ts`). Regra adotada: (a) o elemento de maior cota de topo prevalece no ponto; (b) parede com base e topo dentro da faixa de cotas de piso, laje, forro, telhado ou escada que a toca em planta não é ocultada por ele (`[INFERIDO]`; é o pedido de `INV-D` §7, lacuna 6); (c) empate de topo: a parede fica por cima; o resto pela ordem da lista.
- **Desvio em relação à proposta original do §3.** A hierarquia do §1.3 (piso corta parede) não entra na linha oculta, porque faria a parede embutida sumir do corte, que é o problema medido (0,200 m³ sozinha, 0,000 m³ com o piso). Ela continua valendo para os quantitativos (P5 e P7). Quando o piso é o único a conter a parede em cota, o total do conjunto não perde área: a parede fica inteira e o piso perde só a faixa comum.
- **Planta.** Pisos e lajes são pintados em ordem crescente da cota da face superior no centro da caixa do contorno (`plan/surfaces.ts`). Empate: lajes antes dos pisos, como antes; as paredes continuam por cima.
- **Testes.** `packages/engine/src/sectionCota.test.ts` (caso medido e laje sob piso), `sectionOcclusion.test.ts` (regras, empate e propriedade com 10 sementes fixas: soma das áreas visíveis igual à união, não menor que a do elemento mais alto) e `packages/render/src/plan/surfaces.test.ts` (ordem dos preenchimentos em `buildPlanDrawList`, empate e ocultos).
- **Regressão visual** (`npm run build` e `node tests/e2e/visual-regression.mjs`, sem `--update`): 0,000% em todos os casos.
- **Fora da P6:** quantitativos líquidos (P5), hierarquia de junção (P7), inversão por par (P10, se P-4 for decidida) e término por camada (P8). `docs/paridade/pisos.md` e `lajes.md` não têm item de ordem de corte e planta, então não foram alterados.

**Status da P5 (feita).** Tipos padrão e quantitativos líquidos.

- **Tipo `ft_acab`** ("Acabamento sobre laje", PS-04): acabamento cerâmico de 1 cm, assentamento de 1 cm e contrapiso de 2 cm, 4 cm no total e nenhuma camada Estrutura (`floor.ts`). `ft_ceram` fica como estava. Nenhum tipo salvo é reescrito, e a migração não muda os projetos existentes. Não houve troca no template: a casa de alto padrão (`templateCasaAltoPadrao.ts`) não tem piso sobre laje (os pisos do térreo são sobre o solo e a laje do pavimento 2 não tem piso acima), então os testes dourados seguem com os mesmos números.
- **Aviso `piso-estrutura-sobre-laje`** (warning, `validateSlabs.ts`): piso com camada Estrutura cuja face inferior fica entre a base da laje do nível e o topo dela mais 1 cm, com área em planta acima de 1 cm² em comum. Não bloqueia. Pisos de acabamento não avisam.
- **Quantitativos líquidos** (`junctionNet.ts`, usado por `floorQuantities.ts` e `quantities.ts`). O volume de interseção é a área da interseção em planta (`@hestia/geom`) vezes a sobreposição de cota de cada camada. Padrão por tipo (§1.3, P-4 adiada): parede perde o que está dentro de piso e de laje; piso perde o que está dentro de laje; laje não é cortada por ninguém, então quantitativo de laje não muda. Só cortam elementos do mesmo nível. Faixa inclinada (laje com caimento, parede com topo em perfil): integração por triângulos, exata quando a faixa é afim dentro do triângulo. Membrana: a face some onde o cortador a engloba.
- **Campos e tabelas.** O volume existente passa a ser o líquido (parede, piso). Novos: `grossVolume` nas camadas e nos totais de piso e parede, e `netArea` (área líquida da face superior) no piso. A área em planta do piso continua bruta (contorno). CSV e rodapés ganham "Volume bruto" e, no piso, "Área líquida" no fim, só quando algum elemento tem corte; sem corte o CSV é o de antes.
- **Testes.** `junctionNet.test.ts` (interseção, padrão por tipo, inclinação, membrana); `netQuantities.test.ts` (parede embutida: 0,23 m × 1,00 m × 0,16 m = 0,0368 m³ descontado uma vez; laje atravessando parede; faixa de 1,3215 m² sob parede por perímetro externo, sem mudar a área do piso; laje cortando piso; `ft_acab` encostado; propriedade em 10 sementes: líquido ≤ bruto, igual à união analítica quando há cruzamento, igual ao bruto sem cruzamento; CSV com e sem coluna extra); `validateSlabs.test.ts` (aviso com `ft_ceram` + `ls_mac12` e sem aviso com `ft_acab`).
- **Fora da P5.** Cruzamento entre níveis (parede de um nível e laje de outro) não é descontado. Os cenários de 0,088 m³ e de 1,322 m² do relatório INV-D não estão nesta worktree: os testes usam casos análogos com valores derivados à mão. Inversão por par (P-4) continua adiada.

**Status da P7 (2026-10-22, parcial).** Junção piso/laje × parede por prioridade de camada. Feito e testado: prioridade efetiva, resolvedor e quantitativos. Pendente: planta, corte e 3D.

- **Prioridade efetiva.** `layerPriority` (`packages/model/src/priority.ts`) vale para piso e laje: o campo "Prioridade de junção (sobrescreve a função)" passa a ter efeito. A dica do campo agora diz "número menor = prioridade maior". Aviso não bloqueante (`temPrioridadeEmpatada`) nos editores de tipo de piso e de laje quando há funções diferentes com a mesma prioridade. Testes em `priority.test.ts`.
- **Resolvedor** (`packages/engine/src/junctionPlanar.ts`). `winsOver`: (1) núcleo (§1.2); (2) número menor vence; (3) empate de prioridade: laje corta piso e parede, piso corta parede, mesmo tipo não resolve. `resolveJunction` devolve, por camada, os prismas resolvidos (a faixa de cota é dividida nas cotas de corte). Só a regra de prioridade é por atributo (`kind`, `priority`, `core`): nenhuma regra lê nome ou material.
- **Quantitativos.** Parede, piso e laje descontam o volume da camada que a vence (`junctionNet.ts`: `cutVolume` e `coveredFaceArea` com `meta` por camada; cortadores são pisos, lajes e paredes do nível). A área de face da membrana também sai onde a face cai dentro de uma camada que a vence. Um elemento não corta as próprias camadas. Campos novos só no motor (`priority` e `core` em `ResolvedFloorLayer`, `ResolvedSlabLayer` e `ResolvedLayer`); nada novo no modelo, sem migração e sem mudar `SCHEMA_VERSION`.
- **Testes dourados.** G-B em L e T executáveis com os tipos padrão e os volumes calculados à mão (`junctionPlanar.test.ts`). G-K (sentido de aumentar o número de prioridade) executado nos dois sentidos. Propriedades em 10 sementes: volume resolvido ≤ bruto, par com vencedor sem sobreposição, sem sobreposição de cota não muda, e troca de nome e material não muda o líquido (`netQuantities.test.ts`).
- **Testes existentes ajustados (justificativa).** Três testes de `netQuantities.test.ts` fixavam a regra por tipo (parede perde tudo o que está em piso). Pela prioridade por camada, o núcleo da parede (1) corta o substrato (2) e o acabamento (4) do piso, e a estrutura do piso (1) corta a parede por empate. A soma da interseção é a mesma (0,0368 m³ no caso de 0,16 m de piso; sai uma vez só). Parede embutida: parede 0,644 para 0,6233 m³ (perde 0,23 × 0,09), piso perde 0,23 × 0,07. Perímetro externo: a faixa de 1,3215 m² perde 0,05 m da parede e 0,07 m do piso. Tabela de paredes: volume líquido 0,623 (era 0,607).
- **Pendente (não entregue nesta fase).** Planta, corte e 3D ainda não consomem a região resolvida: `resolveJunction` existe e é testado, mas nenhum desenho o usa. A planta pinta as paredes por cima do piso, então o efeito visual é nulo; o corte e o 3D exigem resolver também as paredes, com o cache de sólidos de parede. Regressão visual (`npm run build` e `tests/e2e/visual-regression.mjs`, sem `--update`): 21 casos com 0,000%.
- **Pendente de validação no Revit.** (a) G-B: as células de término (S e A até F) dependem de P8. No caso em que o contorno do piso avança sobre o eixo da parede, o empate faz a estrutura do piso cortar o núcleo da parede; a tabela §9.1 supõe contorno no núcleo, sem sobreposição. (b) G-K2 (sentido de prioridade e leitura de "topo"). (c) G-M (membrana com prioridade 3, P-1). (d) Empate: §1.1 diz "mesma prioridade não corta", mas o brief aplica a hierarquia por tipo no empate; a fusão por material continua fora (P-6).
- **Fora desta fase.** Término por camada (P8), parede anexada por trecho (P9) e inversão de corte (P10). Quando duas camadas de elementos diferentes se sobrepõem, o corte pode descontar duas vezes a mesma região; o total fica sempre ≤ bruto.

**Status da P7b (2026-10-22, parcial).** Planta, corte e 3D de piso e laje usam a junção resolvida. O lado da parede continua pendente.

- **Motor** (`packages/engine/src/junctionLevel.ts`): `junctionLevel(p, levelId)` devolve, por piso e por laje, as partes de cada camada já recortadas por `resolveJunction`, com cache por nível e assinatura de conteúdo (como o circuito de ambientes). Sem sobreposição, `cut` é falso e vale o desenho de antes. `resolveJunction` ganhou dois cortes de par: camadas do mesmo elemento não se cortam, e parede não corta parede (a junção entre paredes é a da própria parede, como nos quantitativos).
- **Planta** (`plan/floors.ts`, `plan/slabs.ts`, `plan/surfaces.ts`): o preenchimento e o contorno do piso e da laje são a região que sobra depois do corte. Cor e hachura continuam as do elemento (camada de topo ou estrutural); cor e hachura por camada ficam para depois.
- **Corte** (`section.ts`): cada camada de piso e de laje corta só as partes resolvidas; a linha oculta por cota (P6) não mudou. Helper `slabQuad` movido para `sectionGeom.ts` (limite de linhas do `section.ts`).
- **3D** (`model3d/solids.ts`, `scene3d.ts`): as extrusões de piso e de laje usam as partes resolvidas. O volume bate com o líquido de `junctionNet`.
- **Pendente (não entregue).** (1) A parede não é recortada em planta, corte nem 3D: o pintor de paredes (`resolve.ts`) não recebe piso nem laje. Por isso a parede embutida aparece inteira e o piso perde só a faixa comum, e o que se vê ainda não é o que se quantifica nesse lado. (2) Laje com caimento fica de fora da junção: a faixa inclinada não se recorta por aproximação plana. (3) Parede com topo inclinado entra como cortadora pelo ponto mais alto. (4) Cor e hachura por camada na planta.
- **Regressão visual.** Três casos novos (`junc-piso-L-nucleo`, `junc-laje-perimetro-parede`, `junc-parede-embutida-piso`), com baselines criadas e lidas. Nenhum mostra recorte visível na planta: sem o lado da parede, a planta fica igual à de antes. Os 21 casos atuais seguem em 0,000%.
- **Testes.** `junctionLevel.test.ts` (cache, sem sobreposição, laje × piso, parede embutida, dono e parede × parede, propriedade em 10 sementes), `junctionSection.test.ts`, `plan/junctionPlan.test.ts`, `model3d/junctionSolids.test.ts`. Nenhum teste existente foi alterado.
- **Paridade.** `pisos.md` C6, `lajes.md` C8 e `paredes.md` E3 seguem `[ ]`: só marcam [x] quando a parede também for recortada.

**Status da P8 (2026-10-22, parcial).** Contorno por camada e término na junção para piso e laje vinculados às paredes (circuito, não perímetro).

- **Modelo.** `Layer.termino?` (`packages/model/src/types.ts`, tipo `LayerTermino`): `'auto' | 'nucleo' | 'face' | { cm }`, opcional e aditivo, sem migração e sem mudar `SCHEMA_VERSION`. Padrão por leitura `auto` (`termino.ts`). `upsertFloorType`/`upsertSlabType` recusam deslocamento fora de −30 a +30 cm.
- **Motor** (`packages/engine/src/layerOutline.ts`). `finish` e `core` vêm do mesmo circuito de paredes (`enclosedRooms`, extremos `finish` e `core`). `face` = face de acabamento; `nucleo` = núcleo da parede; `auto` = núcleo para a camada dentro do núcleo do elemento (posição, `layerCoreFlags`), face para as demais; `{cm}` = a face deslocada (`offsetMulti`, positivo avança). `ResolvedFloorLayer` e `ResolvedSlabLayer` ganham `polygon`. `resolveFloors().polygon` continua sendo o contorno base (modo do elemento), então quem não consome camadas não muda.
- **Consumidores.** Quantitativos (`floorQuantities.ts`, `slabQuantities.ts`): área e volume de cada camada com o contorno dela; `junctionNet.ts` usa o mesmo contorno, então a parede perde o que a camada do núcleo ocupa. Corte (`section.ts`, `sectionMembrane.ts`): cada camada usa o seu polígono e a membrana sai na face da própria camada. 3D (`model3d/solids.ts`) e planta (`plan/floors.ts`, `plan/slabs.ts`): o sólido e a linha de membrana usam o polígono da camada. A planta continua pintando o preenchimento do elemento (cor e hachura por camada ficam para depois).
- **Elementos fora do escopo** mantêm o que era: estático, de perímetro externo (todas as camadas no mesmo contorno, como antes) e circuito aberto (último contorno válido em todas as camadas). A exportação IFC e DXF segue com o contorno do elemento.
- **Interface.** Campo "Término na junção" na seção avançada da camada, em `FloorTypeDialog` e `SlabTypeDialog` (`LayerTermino.tsx`, `terminoForm.ts`). Dica: "Vale para pisos e lajes vinculados às paredes".
- **Testes.** `layerOutline.test.ts` (retângulo e L à mão; `auto`; `face`; `nucleo`; `{cm}` positivo e negativo; associativo com espessura de acabamento trocada; independência de nome e material; soma por camada; estático, perímetro e circuito aberto; dez sementes), `layerOutlineSection.test.ts`, `layerOutlineSolids.test.ts`, `termino.test.ts`, `terminoForm.test.ts`. Ajuste justificado em `outlineBound.test.ts`: o contador de recálculos passa de 1 para 2 por nível, porque um piso vinculado com término `auto` agora também calcula o circuito do núcleo (0023 §11: nível não editado continua com zero recálculos).
- **Regressão visual** (`tests/e2e/visual-regression.mjs`, sem `--update`): os 24 casos anteriores seguem em 0,000%, inclusive `junc-piso-L-nucleo`. Dois casos novos, com baseline criada e lida: `junc-piso-retangulo-auto` e `junc-piso-retangulo-cm-menos-1` (cerâmica em `{cm: -1}`). As duas imagens saem iguais, porque a planta pinta o preenchimento do elemento e as paredes cobrem o núcleo estendido. A diferença aparece nos quantitativos e no 3D, não na planta.
- **Pendente (não entregue).** (1) O lado da parede: paredes não são recortadas pela camada do piso em planta, corte e 3D (C6 de pisos e C8 de lajes seguem `[ ]`). (2) Término em perímetro externo. (3) Laje com caimento fora da junção (já era assim). (4) Cor e hachura por camada na planta. (5) IFC e DXF por camada. (6) Validação no Revit de G-B e G-K2 (sentido da prioridade).
- **Achado anterior à P8, não corrigido.** No canto reentrante do L, o circuito de paredes deixa um quadrado d × d sem parede (d = meia espessura), que entra no cômodo, com ou sem esquadria. A conta de área do L em `layerOutline.test.ts` inclui esse quadrado de propósito.


**Status da P9 (2026-10-22, feita; lado da junção pendente).** Parede anexada por trecho (P-3, perfil de base).
- **Motor** (`wallAttach.ts`, `wallZ.ts`). O eixo reto é cortado nos pontos em que cruza uma borda de piso ou laje do nível (e nos vértices sobre ele). Cada trecho recebe a face superior mais alta que o cobre (base) ou a face inferior mais baixa do nível de topo (topo), avaliada no ponto médio do trecho; laje inclinada usa a cota da face nesse ponto. Parede curva segue com um trecho só, como antes. O resultado é derivado, sem guardar nada no modelo: `WallZ.bottomProfile` e `WallZ.profile` (degraus, relativos a `z0`), e `ResolvedWall.profileBottom` e `profileTop`. Sem migração e sem mudança de `SCHEMA_VERSION`.
- **Geometria.** `clipBandsToBottom` (`profile.ts`) e `withBottomProfile` (`layerGeom.ts`) recortam as faixas pela base, antes do perfil superior (`resolve.ts`). Planta, corte, 3D e quantitativos leem as mesmas faixas. A área de face usa a altura média (topo médio menos base média).
- **Avisos** (`wallFloorIssues.ts`). `wall-floor-partial` (informativo, severidade nova `info`, grupo "Informações"): só parte do eixo é coberta, e só o trecho coberto foi ajustado. `wall-attach-none` (aviso): anexada, mas nenhum piso ou laje do nível cobre o eixo. O aviso de telhado (`wall-roof-uncovered`) e o perfil superior não entram.
- **Interface** (`Properties.tsx`, `wallFloorActions.ts`). Linhas "Base no piso" e "Topo no piso" (Anexar e Desanexar), e "Nível do topo" quando o topo está ligado. Ligar o topo sem nível de topo usa o nível logo acima; no nível mais alto o botão fica desabilitado e a barra de status explica. Cada passo é um desfazer. Ferramenta: nenhuma.
- **Testes.** `wallFloorProfile.test.ts` (metade coberta com valores à mão; parede toda coberta e sem cobertura iguais ao ajuste anterior; laje inclinada; topo por trecho; dez sementes), `wallFloorIssues.test.ts`, `wallFloorSection.test.ts`, `packages/render/src/model3d/wallFloorSolids.test.ts`, `wallFloorActions.test.ts` e `issuesView.test.ts` (grupo de informação). Nenhum teste existente foi alterado.
- **Regressão visual** (`tests/e2e/visual-regression.mjs`, sem `--update`). Os 26 casos atuais em 0,000%. Caso novo `parede-base-piso-metade` (baseline criada e conferida). A planta não mostra o degrau; ele aparece no corte, no 3D e nos quantitativos.
- **Fora da P9.** (1) O lado da parede: a parede não é recortada pela camada de piso ou laje que vence (E3 de paredes, C6 de pisos, C8 de lajes), como antes. (2) O IFC exporta a parede como caixa, da base mínima ao topo máximo, como já fazia com perfil superior. (3) Abertura: o peitoril vale a partir da base mínima e a área de abertura usa a altura média. (4) Dentro de um trecho coberto por laje inclinada a base usa a cota do ponto médio do trecho (aproximação; o degrau é menor que a inclinação vezes meio trecho). (5) Parede curva não tem base por trecho.

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
