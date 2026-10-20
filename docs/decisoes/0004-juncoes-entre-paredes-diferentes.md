# 0004 · Junções entre paredes diferentes

Origem: pedido do responsável ("prever junções para paredes diferentes, para não virar bagunça").

| # | Decisão | Efeito |
|---|---|---|
| 1 | Encosto como padrão, com esquadria e esquadro por junção e ordem invertível. **Parte superada:** o esquadro saiu (0010 #1) e o padrão de criação é encosto (0010 #8) | Igual ao Revit na escolha; a interface mostra e altera por parede e pela ferramenta Junção (N) |
| 2 | Esquadria pareia núcleo com núcleo | Espessuras e pilhas de camadas diferentes não desalinham a estrutura |
| 3 | Desempate por espessura do núcleo | Parede robusta nunca é cortada por parede leve de mesma prioridade |
| 4 | Faixas verticais | Parede baixa não faz buraco na alta; vão só fura as faixas que atravessa |
| 5 | Nós de 3+ paredes por setores | Sem sobreposição e sem frestas; paredes iguais saem simétricas |
| 6 | Fechamento de frestas (Clipper) nas regiões e silhuetas | Linhas pesadas não aparecem no meio da parede por erros numéricos de micrômetros |
| 7 | **Superado (0010 #1).** Esquadro (square off) provisório | Marcado `[?]` no docs/05 até haver fonte. O tipo foi removido; a nota no docs/05 (item 9) registra a decisão de projeto |
