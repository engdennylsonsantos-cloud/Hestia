# Divisão do trabalho em 3 agentes

> **Modo de execução:** um único agente **orquestrador** lê `08-ORQUESTRADOR.md`, cria os 3 subagentes abaixo (com os prompts de `prompts/`) e os coordena. Os papéis, marcos e regras abaixo valem para os subagentes.

| Papel | Quem | Modelo | Resumo |
|---|---|---|---|
| **UNID** | agente 1 (PC do dono) | DeepSeek v4.1 flash | Unidades do projeto: Fases A, B e o grosso da C |
| **ESQ** | agente 2 (PC do dono) | DeepSeek v4.1 flash | Correções de portas e janelas (D), migração de `tools`/`render`/`io` (C4, C6) e provedores de cota (D10) |
| **COTAS** | agente 3 | modelo mais capaz disponível (Sonnet, esforço médio) | Núcleo do sistema de cotas (D0–D9, D11) e validação final (F) |

Cada agente trabalha em **pasta e branch locais próprias** e integra tudo na branch única `claude/fervent-newton-rfgz3y` (seção 5).

## 1. Passos de cada agente
- **UNID:** U0 → U1 → U2 → U3 → U4 → U5 → U6 (**marco M1**) → U7 → C0 (**marco M2**) → B1–B4 (**marco M3**) → C1 → C2 → C3 → C5 → C7.
- **ESQ:** S1 → S2 → S3 (**marco M4**) → S4 → S5 → *(espera M2)* C4 → C6 → *(espera M5)* D10.1 → D10.2 → D10.3 → D10.4 → D10.5.
- **COTAS:** D0 → D1 → D2 → D3 → D4 (código novo) → *(espera M1)* D5 → D6 → D7 → D8 (**marco M5**) → *(espera M4)* ligar o D4 em `openingTool.ts` → *(espera M3)* D9 → D11 → F1 a F5.

## 2. Marcos de sincronização
| Marco | Significa | Quem libera | Quem espera |
|---|---|---|---|
| M1 | Fase A integrada até U6 (`formatQuantity`, `parseQuantity`, `parseQuantityText`, `useUnits`/`useFormat`, `NumField quantity`) | UNID | COTAS (D5), ESQ (C4, C6) usam depois de M2 |
| M2 | C0 integrada (`check-units` e linha de base) | UNID | ESQ (C4, C6) |
| M3 | B1–B4 integrados (padrão de diálogo, `DialogKind`) | UNID | COTAS (D9) |
| M4 | S2 e S3 integrados (`openingTool.ts` com a prévia real e redesenho) | ESQ | COTAS (ligar D4 em `openingTool.ts`) |
| M5 | D4–D8 integrados (registro, sobreposição, validação, alças, permanentes) | COTAS | ESQ (D10) |

Como saber que um marco foi liberado: `git fetch origin claude/fervent-newton-rfgz3y` e ler o arquivo de progresso do dono do marco (`git show origin/claude/fervent-newton-rfgz3y:docs/plano-unidades-cotas/PROGRESSO-<PAPEL>.md`) — o item correspondente está `[x]`.
**Enquanto espera um marco, não fique parado:** faça os passos seguintes que não dependem dele. Se não houver nenhum, termine o seu turno com o relatório "aguardando <marco>" (o dono reinicia você quando liberar). Nunca invente a parte do outro agente.
Ao liberar um marco, escreva em negrito no seu progresso `MARCO Mx LIBERADO <hash>` no mesmo commit.

## 3. Propriedade de arquivos (quem pode editar)
**UNID:** `packages/model/src/units*.ts`, `packages/model/src/types.ts` (campo `units`), `dimension.ts` (C5), `packages/tools/src/numeric.ts` (só U4), `apps/web/src/ui/fields.tsx`, `useUnits.ts`, `dialogs/UnitsDialog*`, `Properties.tsx`, `*Properties.tsx`, `dialogs/**` (exceto `openingType/**`: veja ESQ), `browser/**`, `perimeter/**`, barras e chrome do C3, `scripts/check-units*`, `package.json` (só a linha do `lint`), `packages/geom/src/numberText.ts`, `docs/decisoes/` (decisão de unidades).
**ESQ:** `packages/model/src/openingStyle.ts`, `openingTypes.ts`, catálogos `catalogo*.ts`, `openingTypeLibrary.ts`; `packages/engine/src/openingModel*.ts`, `openingPlan.ts`, `openingPreview*.ts`; `packages/tools/src/openingTool.ts` (S2, S3, até M4), `openingGrips.ts`, e **todo `packages/tools/src/**` não reservado** (C4 e D10); `packages/render/**`, `packages/io/**` (C6); `apps/web/src/ui/OpeningFlipGrips.tsx`, `dialogs/openingType/**`.
**COTAS:** `dimensionSettings.ts`, `wallPlanes.ts`, `openingExtents.ts`, `packages/tools/src/dims/**` (exceto `dims/providers/{wall,line,grid,outline,displacement}.ts`, que são da ESQ), `openingPlacement.ts`, `openingDims.ts`, `openingTool.ts` (depois de M4), `apps/web/src/ui/dims/**`, `OpeningTempDims.tsx`, `ViewportOverlays.tsx`, `PlacementProperties.tsx`, `DimensionSettingsDialog.tsx`, `autoCotas.ts`, `packages/tools/src/base.ts` (método opcional `tempDims`), `apps/web/src/editor/state.ts` (`dimOverrides`, `DialogKind 'dimensions'`; UNID também acrescenta `'units'` ali: mudanças pequenas em linhas distintas, mescle sem medo), documentos de cotas.
Compartilhados com cuidado: `packages/*/src/index.ts` (só acrescente linhas ao final do bloco do seu assunto), `apps/web/src/editor/state.ts`, `Properties.tsx` (COTAS só acrescenta o botão "Cotas…" ao lado de "Unidades…").
Conflito inevitável ao mesclar: resolva mantendo **as duas** intenções, rode as verificações e registre em "Desvios". Nunca descarte o trabalho do outro com `checkout --theirs/--ours` em bloco.

## 4. Regras específicas da divisão
- Se um passo seu exigir arquivo de outro agente, registre `PEDIDO <agente>` e siga adiante (regra 14 do LEIA-ME).
- C5 (UNID) muda a assinatura de `dimensionText` em `dimension.ts` para receber `units`. Quem chama `dimensionText` (render, tools, autoCotas) é ajustado por quem tem a propriedade do chamador; UNID deixa o parâmetro `units` **opcional** (padrão `defaultUnits()`) até todos migrarem, e a ESQ (C6) o torna obrigatório no fim.
- A trava `check-units` cobre todo mundo: arquivo reservado fica na linha de base até o dono migrá-lo.
- F (COTAS) só começa quando `PROGRESSO-UNID.md` e `PROGRESSO-ESQ.md` mostram todos os itens `[x]` ou com BLOQUEIO justificado.

## 5. Protocolo de integração (a cada commit de passo)
Dentro da sua pasta de trabalho, na sua branch local `plano/<papel>`:
```bash
git add -A
git commit -m "<mensagem do passo>"
git fetch origin claude/fervent-newton-rfgz3y
git merge origin/claude/fervent-newton-rfgz3y
```
1. Se o merge trouxe mudanças, rode `npx tsc -p tsconfig.json --noEmit`, `npx eslint <pastas>`, `npx vitest run <pastas tocadas e as dos outros pacotes afetados>` e `node scripts/check-boundaries.mjs`. Conserte o que quebrou **por causa do merge** (mesmo em arquivo de outro agente, se for ajuste mínimo de compilação; registre em "Desvios").
2. `git push origin HEAD:claude/fervent-newton-rfgz3y` (fast-forward). Se for rejeitado porque alguém integrou nesse meio tempo, repita `fetch` + `merge` + verificação, até 3 vezes.
3. **Nunca** `--force`, nunca outra branch remota, nunca PR.
4. Ao fim de cada fase sua: `npm run check` completo antes do push.

## 6. Prompts
Em `prompts/comum.md` (todos) e `prompts/unid.md`, `prompts/esq.md`, `prompts/cotas.md` (por papel). Quem lança os subagentes é o orquestrador (`08-ORQUESTRADOR.md`).
