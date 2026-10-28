# Progresso da composição de esquadrias (F1 a F9)

Atualizado a cada fase. Branch de trabalho: `claude/fervent-newton-rfgz3y`. NÃO mesclar na `main` nem em `esquadrias/*` sem confirmação do dono.
Spec: [F1-spec-composicao.md](F1-spec-composicao.md). Contrato de tipos: `packages/model/src/openingComposition.ts`.
Decisões aprovadas pelo dono: recomendações das perguntas 1 a 6 da spec §10 (quadro único com montantes de perfil certo, travessa-base sob vidro no piso, folha efetiva 0,902, divisor 0,05, baguete interior e folga 0,005 sem perfil, mão da dobradiça global com `mirror` por célula). O dono autorizou ir até o fim sem pedir aprovação.

Como retomar: `git fetch origin && git checkout claude/fervent-newton-rfgz3y`, ler esta tabela, continuar na primeira fase não concluída. Agentes trabalham em worktrees e DEVEM começar com `git fetch origin claude/fervent-newton-rfgz3y && git checkout -B <branch-do-worktree> origin/claude/fervent-newton-rfgz3y && npm ci` (o worktree nasce da main). Economia: Haiku (esforço médio) para tarefas com padrão pronto, Sonnet (esforço médio) para modelo, motor e revisão.

| Fase | O quê | Quem | Estado |
|---|---|---|---|
| F1 | Especificação e contrato | Sonnet | concluída |
| F3 | Modelo, migração v19→v20, layout, presets | Sonnet | concluída e mesclada |
| F2 | Testes de aceite do motor (spec §8) | Haiku | pendente |
| F4 | Motor: quadro, membros, células, vidro, alizar | Sonnet | pendente |
| F5a | Planta, corte e elevação | Haiku | pendente |
| F5b | 3D | Haiku | pendente |
| F5c | Quadro de esquadrias, IFC, DXF | Haiku | pendente |
| F6 | Interface: editor de composição | Haiku | pendente |
| F7 | Catálogo de composições e mostruário | Haiku | pendente |
| F9 | Goldens, e2e, revisão independente do motor, suíte completa, publicar no artifact | Haiku + Sonnet | pendente |
| F8 | Bay, bow, canto | Sonnet | opcional, fora desta rodada |

## Notas de decisão durante a implementação
- Travessa-base sob vidro lateral até o piso (pergunta 2, aprovada): o modelo (F3) só cria o membro com `frame.sill` explícito, para os exemplos 1 a 4 da spec baterem em números. A F7 (catálogo) liga `frame.sill` nas composições com vidro lateral até o piso.
- A ponte do esquema vive em `withBridgedComposition` (`openingCompositionOf.ts`).
