# Decisão 0021 · Forros e planta de forro

Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Ceiling e a vista "Ceiling Plan"). Padrão seguido: o mesmo de pisos
(0006) e lajes (0007) para o elemento, e a vista de intervalo (0013) para a direção "Para cima". Esta rodada entrega o modelo,
o motor, a planta de forro, 3D, corte, a ferramenta, a tabela e o DXF.

| # | Decisão | Motivo |
|---|---|---|
| 1 | Forro é elemento próprio (`Ceiling`, `kind: 'ceiling'`) com `typeId`, `levelId`, contorno e furos em planta, `heightOffset`, marca e comentários. Tipos em `ceilingTypes` (`CeilingType`, mesmo formato do piso) | Mesmo padrão de piso e laje: tipo e instância, camadas e quantitativos saem da mesma estrutura |
| 2 | `heightOffset` é a cota do **topo** do forro, em metros acima do nível; padrão 2,60 m. As camadas descem a partir dele, e a face inferior (visível) fica na cota do topo menos a espessura total | Igual ao piso (`heightOffset` é o topo). Com o padrão, o topo do forro fica no pé-direito |
| 3 | Camadas do tipo em ordem do topo para baixo (índice 0 = a de cima), como no piso. Os tipos padrão põem a estrutura em cima e o acabamento visível embaixo | Consistência com `FloorType`/`SlabType` |
| 4 | "Forro no ambiente" grava o contorno e os furos do ambiente no momento da criação (`boundary`/`holes`), com `roomId` como vínculo e `heightOffset` = pé-direito do ambiente. O contorno não acompanha as paredes depois | O ambiente é derivado (0018); gravar o contorno evita que o forro mude sozinho e mantém o criado em um só desfazer |
| 5 | Migração v17 → v18: acrescenta os tipos padrão de forro e o material PVC, sem sobrescrever o que o arquivo já tem | Como os demais tipos padrão (migração 7 e 13); forros são elementos de `elements`, então nada mais é convertido |
| 6 | Comandos: `addCeiling`, `addCeilings` (lote, tudo ou nada), `updateCeiling`, `removeCeiling`, `upsertCeilingType`, `deleteCeilingType` (recusa tipo em uso ou o último), `duplicateCeilingType`. Estão em `ceilingCommands.ts`, fora de `commands.ts`, que passou do limite de linhas | Cada mudança é um comando com desfazer (princípio 2). O lote serve ao "forro por ambiente" |
| 7 | Motor (`ceilings.ts`): `resolveCeilings` (contorno, cota do topo, face inferior e camadas), `ceilingDraftsFromRooms` (um rascunho por ambiente com circuito fechado; ambiente "aberto", "fora" ou duplicado não entra) | A geometria é a mesma para planta, 3D, corte e quantitativos |
| 8 | Quantitativos (`ceilingQuantities.ts`) e tabela (`ceilingSchedule.ts`): área líquida, perímetro, espessura, volume por camada, topo e face inferior, ambiente de origem; CSV com `;`, decimal com vírgula e BOM | Mesmo formato das tabelas de pisos e lajes |
| 9 | Avisos (`ceilingIssues.ts`): forro sem contorno (erro), tipo ausente (erro) e forro cuja face inferior fica acima da parede mais baixa do nível (aviso). Não bloqueia | Revisão do projeto, sem impedir o desenho |
| 10 | Vista para cima: `direction: 'up'` vira a planta de forro. **O topo não limita essa vista** (o forro a 2,60 m aparece com topo padrão de 2,30 m). O que está abaixo do plano de corte não é desenhado (piso, laje e escada saem). Paredes são cortadas no plano de corte, como na planta baixa | Revit (Ceiling Plan) mostra o forro acima do corte. Limitar pelo topo esconderia o forro padrão |
| 11 | Na planta de forro: forro preenchido com a cor do material da primeira camada (índice 0), com a hachura do material em médio/fino com zoom suficiente e a faixa de contorno das lajes. Marca e área com etiquetas ligadas. Sem o desenho de nível abaixo | Mesma regra de superfície das lajes. O nível abaixo é referência de planta baixa e não entra no forro |
| 12 | Na planta baixa forro **não é desenhado** e não gera aviso de intervalo (`viewRangeWarnings` ignora forros em `down`) | Forro está acima do topo da planta baixa; avisar por ele seria ruído |
| 13 | Forro não é recortado por parede: fica onde foi desenhado. Por escada e furo do nível de cima, o forro é recortado (ver 18) | Parede não limita o forro; vão de escada e de furo sim, pois o forro fica sob a laje que os tem |
| 14 | 3D: sólido por camada, na categoria `floor` (visibilidade e transparência dos pisos). Corte e elevação: faixa t×z por camada, com a origem do forro para a seleção (`ceilingId`) | Forro é uma superfície de piso no 3D; o corte usa o mesmo mecanismo dos pisos planos |
| 15 | Ferramenta Forro: contorno por cliques (com comprimento digitado), retângulo e "No ambiente" (clique num ambiente). Na planta de forro, a seleção pega o forro pelo interior ou pela borda | A captura da planta baixa não vê forro, então só a planta de forro é clicável |
| 16 | DXF: forros da planta de forro na camada `FORRO` (polilinhas fechadas, com furos). Planta baixa não leva forro | Camada fixa, como `PISO_` e `LAJE_`; o nome é o pedido no roteiro |
| 17 | Interface: tipos na Árvore de projeto (lista "Forros"), diálogo do tipo com seção ao vivo (reuso do editor de camadas e da seção de laje), propriedades do forro, tabela de forros (Vista e Árvore) | Mesmo fluxo de piso e laje |
| 18 | Recorte do vão (`resolveCeilings`, B6): o forro perde (a) a projeção das escadas que sobem ao nível de cima, pela regra do furo da laje (`stairHolesFor` na cota da face inferior do forro, decisão 0011 §6; escadas com `openingMode` 'none' não entram, como na laje) e (b) os furos próprios dos pisos e lajes do nível de cima. Derivado, nada é gravado; forro coberto por inteiro não é resolvido | Mesma regra da laje: o forro sob a escada fica com o vão que a laje de cima teria |
| 19 | Hachura do forro: `HatchKind` ganha `gesso` (tracejado leve). `CeilingType.hatch` é opcional; o tipo padrão `ct_gesso` a define. O corte e a elevação usam a do tipo, com fallback para a do material. O corte é agrupado por material **e** hachura. Tipos antigos sem o campo seguem a hachura do material até serem editados | Hachura própria do forro sem mudar a cor do material (placa de gesso não tem hachura no material). Campo opcional: sem migração |

## Fora desta rodada
- **Forro por ambiente do nível inteiro** em um comando de interface: o lote (`addCeilings`) e o rascunho (`ceilingDraftsFromRooms`) existem; a ferramenta cria um forro por clique no ambiente.
- **Furos pela ferramenta**: o modelo e o motor aceitam `holes`, mas a ferramenta ainda não os desenha.
- **Vínculo vivo com o ambiente**: o contorno é gravado; quando o ambiente muda, o forro não acompanha.
- **Seção ao vivo** do tipo de forro reusa o componente da laje (mesma forma de dados), sem renderização própria.
