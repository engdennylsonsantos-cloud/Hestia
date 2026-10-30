# Integração final em uma main única: estado ao parar (2026-10-29, 23h30)

Complementa `ESTADO-2026-10-29.md`. A `main` do GitHub NÃO foi alterada por esta frente hoje. Tudo está na branch publicada **`integracao/main-unica`**.

## O que a branch `integracao/main-unica` contém
Partiu de `origin/main` (`fb5db1c0`, "docs: adiciona código de conduta (#3)") e recebeu, nesta ordem:
1. `origin/feat/plantas-area-2` (planta de área), sem conflito.
2. `origin/fix/dxf-cad-compat` (DXF/AutoCAD R12), com 1 conflito em `apps/web/src/editor/dxfRooms.test.ts`.
3. `origin/feat/escada-livre-integ` (escada livre, desenho técnico das prévias, Blondel, rampa e desempenho que ainda não estavam na main), com 1 conflito em `packages/tools/src/stairRunTool.ts` (bloco de imports: união dos dois lados).
4. Commit `199d447b`: regeneração dos hashes de `packages/render/src/plan/ouroZoom.json` (69 de 87 chaves; só valores).

## Verificação
- Primeira suíte completa na integração (antes da regeneração dos hashes): **687 arquivos passaram, 1 falhou; 7772 testes passaram, 69 falharam, todos em `ouroZoom.test.ts`** (hashes de referência da combinação das frentes). `tsc` limpo; eslint 0 erros.
- Depois da regeneração: `ouroZoom.test.ts` 88/88 verde e eslint limpo. **A segunda suíte completa foi INTERROMPIDA ao desligar, então a verificação final NÃO está confirmada.**

## Para retomar (ordem)
1. Rodar a suíte completa na `integracao/main-unica`: `npx vitest run packages apps/web tests --testTimeout=120000 > log` (em segundo plano, sem `timeout` curto); exigir zero falhas, `npx tsc --noEmit` e `npx eslint packages apps/web/src` limpos.
2. `git fetch origin`; se `origin/main` avançou, `git merge origin/main` na integração e reverificar (os hashes de `ouroZoom.json` podem precisar regenerar de novo).
3. Atualizar a main com push normal (fast-forward), **nunca `--force`**: `git push origin integracao/main-unica:main` (só se tudo estiver verde e o dono tiver autorizado).
4. Depois: atualizar este documento e a memória; capturas de tela do modal de tipo de escada e das prévias (suspeita de geometria pequena demais por causa da regra `em/largura ≥ 0,026` do `solveEm`).

## Decisão pendente do dono: rótulo de ambiente no DXF
As frentes divergem em `dxfRooms.test.ts`:
- Planta de área (decisão 0037, commit `211a042d`): o DXF mostra **só o nome** (`Sala`).
- DXF/AutoCAD (commit `aa323200`): esperava `Sala (101) · NN,NN m²` com escapes R12 (`\U+00B7`, `\U+00B2`).
O agente que resolveu o conflito manteve **só o nome** (o código combinado produz isso). A afirmação dele de que "já está na main" estava ERRADA (vem da frente de área, ainda não mesclada). O texto da decisão 0037 é ambíguo ("a planta de piso continua com o rótulo completo"). O dono decide; a mudança é um teste e uma linha de código.

## O que ficou de fora de propósito
- `origin/wip/checkpoint-2026-10-29`: guarda cópias ANTIGAS de arquivos de escada e fixtures IFC enormes (`modelo 01.ifc`, `sala.ifc`); mesclar desfaria o trabalho novo.
- `origin/feat/site-app-marca`, `origin/chore/contribuicao`, `origin/chore/code-of-conduct`: documentação, licença e marca (outra frente).
- Pasta `Hestia\Hestia` do dono: na `main` com 43 alterações não commitadas de outras frentes (planta de área e DXF); não tocar.
- Worktrees de outras frentes com alterações soltas (`E1`, `E3a`, `E3b`, `E3c`, `R1`, `v3trial`) e a branch local `trial/v3` (1 commit só local): não são desta frente.

## Limpeza futura (opcional, não urgente)
Worktrees obsoletos desta frente em `..\wt\` (e-layout, e-model, e-motor, v-render, v-blondel, live-a/b/c, perf-a/b/c, w2-a/b, w3, w4-a/b, rampa-1 a 5, integ2, escada-calculo, modal-escada, escada-altura): o conteúdo está na main ou em branches publicadas; podem ser removidos com `git worktree remove` depois da unificação.
