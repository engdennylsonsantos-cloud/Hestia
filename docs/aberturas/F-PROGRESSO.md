# Progresso da composição de esquadrias (F1 a F9)

Atualizado a cada fase. Branch de trabalho: `claude/fervent-newton-rfgz3y`. NÃO mesclar na `main` nem em `esquadrias/*` sem confirmação do dono.
Spec: [F1-spec-composicao.md](F1-spec-composicao.md). Contrato de tipos: `packages/model/src/openingComposition.ts`.
Decisões aprovadas pelo dono: recomendações das perguntas 1 a 6 da spec §10 (quadro único com montantes de perfil certo, travessa-base sob vidro no piso, folha efetiva 0,902, divisor 0,05, baguete interior e folga 0,005 sem perfil, mão da dobradiça global com `mirror` por célula). O dono autorizou ir até o fim sem pedir aprovação.

Como retomar: `git fetch origin && git checkout claude/fervent-newton-rfgz3y`, ler esta tabela, continuar na primeira fase não concluída. Agentes trabalham em worktrees e DEVEM começar com `git fetch origin claude/fervent-newton-rfgz3y && git checkout -B <branch-do-worktree> origin/claude/fervent-newton-rfgz3y && npm ci` (o worktree nasce da main). Economia: Haiku (esforço médio) para tarefas com padrão pronto, Sonnet (esforço médio) para modelo, motor e revisão.

| Fase | O quê | Quem | Estado |
|---|---|---|---|
| F1 | Especificação e contrato | Sonnet | concluída |
| F3 | Modelo, migração v19→v20, layout, presets | Sonnet | concluída e mesclada |
| F2 | Testes de aceite do motor (spec §8) | Haiku | concluída e mesclada (71 testes vermelhos de propósito até a F4) |
| F4 | Motor: quadro, membros, células, vidro, alizar | Sonnet | concluída e mesclada (engine+model verdes) |
| F5a | Planta, corte e elevação | Haiku | concluída e mesclada |
| F5b | 3D | Haiku | concluída e mesclada |
| F5c | Quadro de esquadrias, IFC, DXF | Haiku | concluída (quadro e DXF; IFC fora: cada vão sai como caixa única) |
| F6 | Interface: editor de composição (F6a células, F6b perfis/alizar/vidro) | Haiku | concluída, ligada em components.ts |
| F7 | Catálogo de composições e mostruário (24 tipos, 130 no total) | Haiku | concluída e mesclada |
| F9 | Goldens, e2e, revisão independente do motor, suíte completa, publicar no artifact | Haiku + Sonnet | concluída (suíte 6098 testes verde; lint 0 erros; e2e de acabamento OK; planta, elevação e 3D conferidos em captura) |
| F8 | Bay, bow, canto | Sonnet | opcional, fora desta rodada |

## Notas de decisão durante a implementação
- Travessa-base sob vidro lateral até o piso (pergunta 2, aprovada): o modelo (F3) só cria o membro com `frame.sill` explícito, para os exemplos 1 a 4 da spec baterem em números. A F7 (catálogo) liga `frame.sill` nas composições com vidro lateral até o piso.
- A ponte do esquema vive em `withBridgedComposition` (`openingCompositionOf.ts`).

- Ao mesclar a F2 o branch fica com `openingComposition.accept.test.ts` vermelho até a F4 entrar. Ids de célula dos testes: folha, band, lat-e, lat-d, fixa, abrir, painel. O item 7 do aceite ignora peças `stop` (a F4 não deve duplicar a cobertura com peça `stop` separada).
- F4: composições de 2+ células usam o motor novo (`openingModelComposition.ts`, `Members`, `Cells`, `Casing`); tipos de UMA célula seguem nos builders antigos, exceto o alizar, que é o novo para todos (a posição já era a da spec). Papéis novos de peça: `mullion`, `transom`, `bead`. Ids: `jamb-left/right`, `head`, `threshold`, `sill-frame`, `mullion-<k>`, `transom-<k>`, `glass-<cellId>`, `leaf-<cellId>[-parte]`, `bead-<cellId>-<lado>`; alizar `group` `casing-exterior|interior`.
- Correções do coordenador após F4: preset `prf_mad_divisor_5x9` sem rebaixo (como a spec §1); `withBridgedComposition` preserva composição editada direto; folga inferior padrão 7 mm (E2b) em vez de 8 mm; folha de janela fica dentro da luz com 4 mm de folga por lado (Ex. 5 da spec corrigido).
- Fases F5a/b/c, F6a/b e F7 lançadas em paralelo após a F4 (6 agentes Haiku, arquivos disjuntos). A fiação de `components.ts` da interface é feita pelo coordenador ao mesclar F6a e F6b.
- Travessa-base (pergunta 2): em PORTA, `frame.sill` cria uma travessa-base só sob cada célula de vidro/painel que toca o piso (`sill-<cellId>`, ids de peça `sill-frame-<k>`); a folha não sobe. Janela mantém o peitoril de largura total. O catálogo liga `frame.sill` nas portas com vidro/painel lateral até o piso.
- `spanTypeOf` usa sempre o vão da composição de várias células (corte da parede e seção).
- IFC: não alterado (cada vão é exportado como caixa única); limitação registrada.
- Falta: F9 (goldens, e2e, revisão independente do motor, suíte completa, build, publicar no artifact).
- F9, revisão independente do motor (Sonnet, só leitura): achou 4 defeitos confirmados, todos corrigidos e com teste: (1) a migração mudava as peças de dezenas de tipos antigos (despacho comparava com o tipo já normalizado; agora usa o tipo bruto; teste de equivalência exata `openingComposition.equivalence.test.ts` que a spec §8 item 10 exigia); (2) `compositionOfType` ignora bandeira/laterais em famílias de janela que o E3 §7 não aceita; (3) `openingSpanOf`/`leafSizeOf`/`spanTypeOf` seguem a composição sempre que ela existe; (4) `withBridgedComposition` só regenera a composição derivada, preserva a autoral, e compara com `canonComposition` (ordem de chaves). Também: composição inválida cai nos builders por família em vez de gerar geometria negativa.
- Achado baixo NÃO corrigido: ids de peça de célula podem colidir com ids internos da folha (ex.: célula `c1-left` e `leaf-0-left`). Mitigação: usar ids de célula sem hífen no editor.
- Verificação visual (planta e elevação em CPU; 3D com SwiftShader): portas com bandeira, laterais, tudo e painel cego; janelas combinadas; montantes entre módulos; alizar contornando o conjunto. Defeito achado e corrigido: janela alta J-56/J-59 passava do topo da parede (peitoril 0,90 → 0,50; teste: peitoril + altura ≤ 2,80).
- Estado final: composição implementada de F1 a F9. Fica para o dono: validar o alizar no 3D (spec §4), decidir sobre bay/bow/canto (F8), IFC com peças, e a mesclagem em integracao/telhados-grades e main.
