# Etiqueta de ambiente por vista na UI

Data: 2026-10-29 · Subagente da UI (plantas de área)

## O que mudou

- `apps/web/src/editor/areaPlanActions.ts`
  - `ensureRoomTagAction(store, planId, roomId): RoomTag | null` — devolve a etiqueta do
    ambiente na planta; se a vista ainda usa a automática, cria uma com `autoTag`, `planId`
    correto, campos/orientação padrão e `visible: true`, via `addRoomTag`. É idempotente: com
    etiqueta, não executa comando nem gera passo de desfazer. Sem circuito fechado, devolve
    `null` (não há rótulo para materializar).
  - `updateRoomTagAction(store, planId, roomId, patch): RoomTag | null` — garante a etiqueta e
    emite `updateRoomTag` com `planId`, tudo numa transação (criar + alterar = um só Ctrl+Z).
    Recusa `fields: []` antes de criar qualquer coisa, pois `roomTagIssue` exige ao menos um
    campo. Não toca em `Room.labelPosition`.
  - `removeRoomTagAction(store, planId, roomId): boolean` — remove a etiqueta da vista; o
    ambiente volta ao padrão automático da planta.
  - `RoomTagPatch` exportado como
    `Partial<Omit<RoomTag, 'id' | 'planId' | 'roomId'>>`.
- `apps/web/src/ui/RoomProperties.tsx`
  - Novo grupo **Etiqueta nesta planta de área**, visível só com a vista ativa
    `view === 'plan' && planKind === 'area' && areaPlanId` e **um** ambiente selecionado do
    nível da planta.
  - Checkboxes para Nome, Número, Área, Categoria, Nível, Perímetro, Volume e
    Personalizado; o último campo ligado fica travado (o modelo recusa lista vazia).
  - Texto livre quando **Personalizado** está ligado (ao ligá-lo sem texto, começa com o nome
    do ambiente); selects de orientação (horizontal/vertical) e chamada
    (nenhuma/reta/cotovelo/duas linhas cruzadas); **Visível nesta planta**.
  - Botões **Criar/atualizar etiqueta** e **Voltar ao padrão** (desabilitado sem etiqueta).
  - `TAG_FIELD_OPTIONS` e `toggleTagField(fields, field)` exportados para testar a montagem do
    patch sem DOM. Toda edição passa por `updateRoomTagAction`, então a etiqueta é criada na
    primeira alteração.
  - O grupo **Rótulo (todas as vistas)** continua separado e intocado: posição, rotação e
    chamada compartilhadas seguem em `setRoomLabel`.
- `apps/web/src/ui/Properties.tsx` não precisou mudar: `RoomProperties` lê a vista ativa
  direto do `useUi`.
- Render/modelo não foram alterados; a renderização já lê `plan.tags` e oculta
  `visible: false`.

## Testes

- `apps/web/src/editor/areaPlanActions.test.ts`
  - garantia idempotente (mesma etiqueta, sem novo undo);
  - atualização grava em `plan.tags` (campos, orientação, chamada, personalizado e
    visibilidade) e não em `Room.labelPosition/labelRotation/labelLeader` nem nas etiquetas do
    nível;
  - `fields: []` recusado sem criar etiqueta;
  - criar + alterar num só passo de desfazer;
  - voltar ao padrão remove a etiqueta e o Ctrl+Z a devolve.
- `apps/web/src/ui/RoomProperties.test.ts`
  - `toggleTagField` liga/desliga mantendo a ordem do bloco e nunca esvazia a lista;
  - `TAG_FIELD_OPTIONS` cobre os oito campos do modelo na ordem de exibição.

Comando usado:

```bash
npx tsc --noEmit
npx vitest run apps/web/src/editor/areaPlanActions.test.ts apps/web/src/ui/RoomProperties.test.ts apps/web/src/editor/areaPlanAnotacao.test.ts
```

Resultado: `tsc` sem erros e 3 arquivos / 27 testes passando.

Fora da área: `packages/model`, `packages/render`, `packages/tools` e IFC não foram alterados.
