# 0009 · Quinas em encosto e acabamentos

Origem: a ponta do núcleo aparecia na quina externa da casa padrão, com o acabamento da outra parede aparado na face.

| # | Decisão | Motivo |
|---|---|---|
| 1 | Em uma quina de duas paredes (ângulo reto) em encosto, o núcleo da parede que passa chega à face da outra e a quina externa fica exposta | Verificado por geometria: o problema aparece só em L (quina de sólido), não em T nem em paredes colineares |
| 2 | Esquadria resolve a quina: as camadas das duas paredes se encontram na diagonal e nenhuma ponta de núcleo fica exposta | Testado no canto da casa padrão (núcleo não cobre mais o vértice externo) |
| 3 | A casa padrão e a quitinete usam esquadria em todas as quinas | Padrão do projeto |
| 4 | Aviso `wall-corner-butt-finish` (aviso, não erro) em quina de 70° a 110° em encosto com acabamento | Projetos antigos continuam abrindo; o aviso aponta a solução (Junção, tecla N) |
| 5 | A opção "envolver nas extremidades" não se aplica a extremidades unidas por junção | Confirmado: só age em extremidades livres. Mantida como estava |
| 6 | Não foi feito conversor automático para projetos antigos | Trocar a junção é decisão do usuário; a ferramenta Junção faz em um clique por quina |
