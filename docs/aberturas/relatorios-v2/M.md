# Relatório · tarefa M (parte A) · Diálogo "Propriedades do tipo"

Data: 2026-10-26. Branch: `feat/esq-M`.

## O que foi feito

1. **Validação v2 no modelo** (`packages/model/src/opening.ts`): `openingTypeIssue` passou a conferir os campos
   opcionais do tipo — ângulo 2D/3D em 0..120°, `grid` inteiro em 1..8, `transom.height` positiva e menor que a altura,
   `sidelights.width` positiva e menor que a largura, `leafStyle`/`handle`/`frameStyle` dentro dos conjuntos fechados e
   também `planDisplay`, `detail2d`, `detail3d`, `showSwing`, `swingStyle` e `leafSide`. Campo ausente continua valendo o
   padrão por leitura; o comando `upsertOpeningType` recusa com a 1ª mensagem sem gravar.
2. **Verificações** (`packages/engine/src/openingChecks.ts`, exportado no `index.ts`): função pura
   `openingChecks(type, coreThickness)` com largura livre (`W − 2·J`, NBR 9050, só aviso), altura livre (`H − J` contra
   2,10 m), área útil de ventilação por família (fixa/vão 0, correr 50%, abrir 100%, maxim-ar 90%, basculante 80%),
   profundidade do batente contra o núcleo e presença de verga. Também expõe `openingClearWidth`, `openingClearHeight` e
   `openingVentilationArea`.
3. **Formulário puro** (`apps/web/src/ui/dialogs/openingTypeForm.ts`): `applyFamily` preserva `leafStyle` válido e
   redefine inválido, mantém o `grid` em janela e remove em porta; `newOpeningTypeFromFamily` cria padrões v2 coerentes;
   `alternarTransom`/`alternarSidelight` ligam com valor padrão e desligam removendo o campo; variantes de biblioteca
   (`openingVariants`/`applyVariant`) gravam estilo, divisões, perfil e material.
4. **Diálogo novo** (`apps/web/src/ui/dialogs/openingType/`):
   - `DialogXL` com `.dialog.xl` (1240 × 790 px, `min(..., 100%)`), Esc/clique fora/fechar iguais ao `Dialog`.
   - Cabeçalho com seletor de família, seletor de tipo, Duplicar…, Renomear… e favorito ★.
   - Biblioteca com árvore das famílias da categoria + contagem de tipos do projeto, grade de variantes (espaço `.th`
     reservado para a miniatura da parte B) e botão de recolher.
   - Sete seções recolhíveis (`.pgroup`): Pré-visualização e posicionamento; Definições da folha; Moldura e vidro;
     Planta e corte; Nível de detalhe (destacado); Acabamento (rótulo mantido para o e2e); Identidade e dados BIM.
   - Prévia com abas Planta/Elevação/Corte/3D linhas/3D sombreado (só Elevação habilitada, via `TypePreview`; as demais
     desabilitadas e "Em breve"), Inverter dobradiça/sentido (estado só da prévia), controle de ângulo e faixa de
     Verificações.
   - Rodapé + Novo tipo/Cancelar/Aplicar/OK; erro do modelo aparece sem fechar o diálogo.
5. **CSS** (`apps/web/src/styles.css`): bloco aditivo no fim da seção de diálogos, só com variáveis do tema; biblioteca
   some abaixo de 1100 px.

## Arquivos tocados

- `packages/model/src/opening.ts`, `packages/model/src/opening.test.ts`
- `packages/engine/src/openingChecks.ts`, `packages/engine/src/openingChecks.test.ts`, `packages/engine/src/index.ts`
- `apps/web/src/ui/dialogs/openingTypeForm.ts`, `apps/web/src/ui/dialogs/openingTypeForm.test.ts`
- `apps/web/src/ui/dialogs/OtherDialogs.tsx` (diálogo antigo removido; reexporta o novo com o mesmo nome)
- `apps/web/src/ui/dialogs/openingType/DialogXL.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeDialog.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeHeader.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeLibrary.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeSections.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypePreview.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeDialog.test.ts`
- `apps/web/src/styles.css`

## Testes e verificação

- `npx vitest run packages/model/src packages/engine/src/openingChecks.test.ts packages/engine/src/openingModel.test.ts apps/web/src/ui`
  → **57 arquivos, 697 testes, todos verdes**.
- `npx vitest run apps/web/src/ui` → **22 arquivos, 192 testes, verdes**.
- `npx tsc -p tsconfig.json --noEmit` → limpo.
- `node scripts/check-boundaries.mjs` → `fronteiras ok`.
- `tests/e2e/aberturas-acabamento.mjs` **não foi rodado** (o roteiro pede build e navegador); os rótulos usados por ele
  foram mantidos: `Editar tipo`, `Propriedades do tipo`, `Acabamento` (seção fechada por padrão), `Folga: largura`,
  `Alizar`, `OK`.

## Decisões tomadas

- **Estilos de folha por categoria**: porta aceita os cinco estilos (`flush`, `panel`, `glass`, `louver`, `grille`);
  janela aceita `glass`, `louver` e `grille`. `applyFamily` usa essa tabela para preservar ou redefinir o campo.
- **Ventilação** usa a área nominal `W × H` vezes a fração da família (é o que o critério `correr 120×120 → 0,72 m²`
  exige); largura/altura livres descontam o perfil do batente.
- **Profundidade do batente** é conferida pelo valor pedido no tipo (`frameDepth` ou 0,09 m), sem aplicar o limite do
  núcleo antes da verificação, para o aviso aparecer.
- **Mensagens v2** (usadas nos testes): `Ângulo de abertura 2D: use um valor de 0 a 120°.`,
  `Divisões do caixilho: use colunas e linhas inteiras de 1 a 8.`,
  `Bandeira: a altura deve ser maior que 0 e menor que a altura do tipo.`,
  `Bandeira lateral: a largura deve ser maior que 0 e menor que a largura do tipo.`,
  `Estilo da folha desconhecido.` (e equivalentes para maçaneta/batente).
- **Sete seções**: para conciliar a lista da tarefa (que agrupa folha, bandeiras, moldura e vidro) com o critério de
  sete seções, "Definições da folha" inclui bandeiras e "Moldura e vidro" inclui as divisões, o vidro e o perfil.
- **Acabamento** continua com o rótulo exato `Acabamento` e fechado por padrão, como antes, para o roteiro de navegador.

## Divergências e pendências honestas

- A pasta `_ref/` (protótipo `p5-dialog.js`/`proto.css`) **não existe nesta worktree**; a organização foi seguida pela
  descrição da tarefa, pela decisão 0034 e pela especificação E.
- As vistas reais da prévia (planta, corte, 3D linhas/sombreado) e as miniaturas das variantes são da **parte B**; nesta
  parte a coluna já tem contêiner, abas, estados desabilitados e o espaço `.th` reservado.
- O controle de ângulo da prévia guarda estado local e ainda não gira o desenho porque `TypePreview` não recebe ângulo;
  ele não é gravado no tipo.
- `showSwing`/`swingStyle`/`detail2d`/`detail3d`/`planDisplay` já são editáveis e validados, mas o desenho da planta
  ainda não consome esses campos (parte B).
- O diálogo usa um `DialogXL` próprio (novo arquivo) porque o `Dialog` existente não tipa o tamanho `xl`; o
  comportamento de fechamento é o mesmo.
