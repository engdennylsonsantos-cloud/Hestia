# RELATÓRIO · PV · Acabamento visual das prévias do diálogo do tipo

## O que foi feito

1. **3D enquadrado na esquadria**
   - `previewProject.ts`: a parede da prévia passou a `largura + 1,2 m` de comprimento e `altura + peitoril + 0,5 m` de altura (antes: `max(3,6; largura + 2,4)` e `max(2,8; ...)`).
   - Novo `previewCamera.ts` (puro): `previewCamera(projeto, opening)` devolve posição, alvo, distância, zoom, yaw (−35°), pitch (20°), FOV (38°), proporção 4:3, caixa englobante e ocupação vertical.
   - A caixa vem do modelo único (`buildOpeningModel` + `partTransformed`), com a folha no estado aberto (`angle3d`; correr todo aberto) e com alizar, verga, peitoril e contraverga. Vão livre sem peças cai no retângulo do furo.
   - Distância calculada para ocupar 70% da altura da área, com folga horizontal (82%) para não estourar as laterais.
   - `previewScene.ts` aplica a câmera na órbita do `ModelScene`; o arrasto e a roda continuam funcionando.
   - O modo 3D linhas continua usando as arestas do pipeline (`ModelScene`/`EdgesGeometry`), com a câmera mais próxima tornando-as legíveis. Nenhum material de aresta foi alterado.

2. **Área de prévia maior**
   - Coluna direita do diálogo: 340 → 460 px; a coluna central cede.
   - Área da prévia: altura mínima de 340 px e proporção 4:3 (`styles.css`); SVGs internos em 440 × 330.
   - Rolagem continua na coluna da prévia; a regra de `< 1100 px` (biblioteca escondida e coluna de 320 px) foi mantida.

3. **Corte em três quadros**
   - Novo `previewSectionFrames(type, options)`: devolve três quadros (`full`, `head`, `sill`) com enquadramentos distintos, cada um com o seu SVG pelo pipeline de seção.
   - `Cabeça`: `H − 0,40` a `H + 0,35` em relação à base do vão, em volta da espessura da parede.
   - `Soleira`: porta de `−0,15` a `+0,35`; janela de `−0,35` a `+0,35`.
   - UI: corte inteiro pequeno à esquerda e os dois detalhes ampliados empilhados à direita, cada um com título pequeno.
   - `previewSectionSvg` foi mantido devolvendo o corte inteiro (compatibilidade); a função nova é a que expõe os três.

4. **Planta ampliada**
   - `previewPlanDetail(type)`: `detail2d = 'scale'` (ou ausente) usa `'high'`; os demais valores fixos são respeitados (`low`, `mid`, `high`, `off`).
   - O desenho `high` do pipeline mostra a folha fechada **e** a aberta, além de alizar/peitoril/verga.
   - Enquadramento: largura do vão, espessura e alcance do arco (raio do modelo único), com 0,6 m de margem.

5. **Elevação**
   - Enquadramento com 0,3 m em volta do vão; o piso/linha de peitoril continua vindo do desenho do projeto.

6. **Valores efetivos dos campos v2**
   - Causa do “Nenhuma” no `ot_p90`: o `<select>` lia `d.handle ?? 'none'`, mas `handle` é ausente no tipo e o padrão por leitura é `openingHandle(tipo) = 'lever'`.
   - O diálogo agora mostra sempre o valor efetivo (`openingHandle`, `openingLeafStyle`, `openingFrameStyle`, `openingAngle2d`, `openingAngle3d`, `openingGrid`, `openingDetail2d`, `openingDetail3d`, `openingPlanDisplay`, `openingSwingStyle`).
   - Novo `openingTypeFields.ts`: `withOpeningField` grava o campo só quando difere do padrão; valor igual ao padrão remove o campo e volta à leitura.

7. **Seletores de componente**
   - Miniaturas com 58 × 42 px dentro de botões de 60 × 46 px (mínimo pedido: 56 × 42).
   - Selecionada destacada com `--accent` e anel `--accent-soft` pelo tema.

8. **Digitação**
   - O debounce de 60 ms da prévia foi mantido; nenhum campo ficou síncrono com o desenho.

## Arquivos tocados

- `apps/web/src/ui/dialogs/openingType/previewProject.ts`
- `apps/web/src/ui/dialogs/openingType/previewViews.ts`
- `apps/web/src/ui/dialogs/openingType/previewScene.ts`
- `apps/web/src/ui/dialogs/openingType/previewCamera.ts` (novo)
- `apps/web/src/ui/dialogs/openingType/previewCamera.test.ts` (novo)
- `apps/web/src/ui/dialogs/openingType/openingTypeFields.ts` (novo)
- `apps/web/src/ui/dialogs/openingType/openingTypeFields.test.ts` (novo)
- `apps/web/src/ui/dialogs/openingType/OpeningTypeSections.tsx`
- `apps/web/src/ui/dialogs/openingType/OpeningTypePreview.tsx`
- `apps/web/src/ui/dialogs/openingType/Preview3D.tsx`
- `apps/web/src/ui/dialogs/openingType/previewProject.test.ts`
- `apps/web/src/ui/dialogs/openingType/previewViews.test.ts`
- `apps/web/src/ui/dialogs/openingType/OpeningTypeDialog.test.ts`
- `apps/web/src/styles.css` (apenas o bloco `.dialog.xl` e filhos)

Nada em `packages/` foi alterado.

## Testes

Comandos finais (Git Bash, na raiz da worktree):

- `npx vitest run apps/web/src/ui` → **28 arquivos, 225 testes verdes**
- `npx tsc -p tsconfig.json --noEmit` → **limpo**
- `node scripts/check-boundaries.mjs` → **fronteiras ok**

Cobertura dos critérios:

- `previewCamera.test.ts`: ocupação vertical entre 0,6 e 0,8 (≈ 0,70) para `ot_p90` com folha a 90°; muda com largura, altura, ângulo e alizar; folha aberta > fechada; vão livre usa o furo.
- `previewProject.test.ts`: parede `largura + 1,2`, altura `altura + peitoril + 0,5`.
- `previewViews.test.ts`: três quadros distintos e não vazios nos 23 `DEFAULT_OPENING_TYPES`; `scale → high`, `low → low`; margens da planta (0,6) e da elevação (0,3).
- `OpeningTypeDialog.test.ts`: seletor de maçaneta mostra `lever` no `ot_p90` e `none` quando o tipo grava `none`; folha, batente e detalhes também mostram o efetivo.
- `openingTypeFields.test.ts`: grava só o que difere do padrão e remove o campo ao voltar ao padrão.

## Decisões e divergências

- **Sem laje fina de piso na porta.** O prompt permitia “senão só a parede”; a prévia usa só a parede (o piso/laje exigiria peça nova fora do modelo único).
- **Centro da órbita = centro da caixa** (vão + folha aberta + alizar), não o centro geométrico do vão. É o que mantém a esquadria centralizada na área com a folha aberta.
- **`previewSectionSvg` continua devolvendo o corte inteiro.** A função nova `previewSectionFrames` é quem devolve os três SVGs; a UI usa a nova. Assim não quebro chamadores/testes existentes.
- **Detalhes do corte mais estreitos que o corte inteiro** (espessura da parede + 0,12/0,18 m) para ficarem realmente ampliados na horizontal.
- **Teste existente atualizado:** `previewProject.test.ts` exigia `max(3,6; largura + 2,4)` e `max(2,8; ...)`, que contradizem o novo critério da tarefa (`largura + 1,2` e `altura + peitoril + 0,5`). Foi atualizado com o motivo.
- **Sem mudança em `packages/render`.** As arestas do 3D linhas já vêm do pipeline; o defeito era de enquadramento, não de material.

## Pendências honestas

- A conferência visual em navegador real não foi feita (o ambiente não tem navegador). Tudo o que está declarado acima foi provado por testes de render em string e de geometria.
- Os arquivos novos foram criados com LF; o Git avisou que os converterá para CRLF no próximo checkout (`core.autocrlf`), como o restante do repositório.
- A laje fina de piso da porta ficou de fora, conforme a alternativa permitida no prompt.
