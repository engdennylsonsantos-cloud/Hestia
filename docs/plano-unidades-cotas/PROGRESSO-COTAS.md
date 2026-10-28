# Progresso do agente COTAS (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): lint (eslint, fronteiras, paridade, densidade) verde com 2 avisos de hooks em OpeningTempDims/ViewportOverlays; typecheck e testes rodados por pasta a cada passo.

- [x] D0 mapa (`04`)
- [x] D1 configuração no modelo
- [x] D2 wallPlanes e openingExtents
- [x] D3 resolvedores
- [x] D4 provedor de esquadrias + registro (código novo; integrar em `openingTool.ts` só depois do marco M4)
- [x] D5 sobreposição única (só depois do marco M1)
- [x] D6 validação de hospedados
- [x] D7 alças trocam referência
- [x] D8 permanentes + autoCotas  → **D4–D8 integrados = marco M5**
- [x] D9 diálogo Cotas… + troca rápida (só depois do marco M3)
- [x] D11 documentação de reaproveitamento e decisão
- [ ] F1 suíte e build (`06`; só quando UNID e ESQ terminarem)
- [ ] F2 navegador
- [ ] F3 revisão cruzada (revise os diffs de UNID e ESQ)
- [ ] F4 documentação
- [ ] F5 entrega

## Desvios
- D2: `axis` = centro da espessura total (`sMid`), como o 04 manda; o `autoCotas` antigo usava `[0,0]` (linha de localização) para 'eixo': coincidem só com `wallCenter` (padrão). Ao migrar o autoCotas (D8) o 'eixo' passa a `sMid`.
- D2: `openingExtents` usa o MODELO REAL (`buildOpeningModel`): `frame` = `model.width/2` (vão externo do conjunto), `clear` = borda interna das ombreiras externas, `casing` = maior |t| das peças `casing` da face pedida (a face de abertura da folha recua 14 mm). Recorte da parede = `roughWidth` = `t.width + roughOversize.w`; em tipos simples `frame` coincide com o recorte (testado); em tipos com composição `model.width` vem do vão nominal da composição e pode diferir de `t.width`. Padrão `openingRef` mantido em `frame`.

- D3: `perpendicularNeighbors` agora devolve `frame` e `point` e testa perpendicularidade com a tangente da hospedeira no ponto de encosto (antes: tangente inicial; paredes curvas eram rejeitadas).
- D4: chaves de override: por ponta `opening:wallLeft|openLeft|wallRight|openRight`; globais (troca rápida do D9) `opening:wall` e `opening:opening`; a específica vence. `DimProvider` ganhou `selectionSubject?` (necessário para o registro montar o sujeito do elemento selecionado). Ordem de `ends` = (a, b) com a ponta de parede em `a` nas duas cotas (a cota direita corre da parede para a esquadria, `offset` negativo).
- D6 feito antes do M1 (puro). D8 parcial: `toPermanent` (sem `refs`: os pontos são faces/bordas, não extremidades de parede) e `autoCotas` com `wallRef`/`openingRef` (apelidos antigos mantidos e testados; 'eixo' agora é o centro da espessura) prontos; falta o botão "I" (overlay, depois do D5). `AutoCotaDialog.tsx` (propriedade UNID, `dialogs/**`) ainda usa os apelidos obsoletos: troco no fim, na Fase F, se a UNID não o fizer.
- D11 parcial: `COMO-ADICIONAR-COTA.md`, `dims/providers/example.test.ts` e decisão `0037` escritos; revisar quando D5/D9 existirem.
- D5/D7/D8-I feitos: `ui/dims/TempDimsOverlay.tsx` (linhas, texto editável, alças, botão I), `dimsView.ts`, `dimsActions.ts`, `useSelectionDims.ts`; `OpeningTempDims.tsx` removido; `Tool.tempDims?` acrescentado em `tools/src/types.ts` (a interface `Tool` mora lá, não em base.ts); `dimOverrides` em `state.ts` (limpo ao trocar ferramenta ou seleção). Sem ambiente de componente no vitest: a lógica está em módulos puros testados; o componente é fino. Enquanto o `openingTool` não implementa `tempDims` (passo 3 do D4, após M4), a prévia de colocação ainda usa as cotas antigas em itens de prévia.
- D9 feito exceto a remoção de `ToolOptions.openingDimMode` (tools/types.ts, state.ts): `openingTool.ts` ainda a lê até o passo 3 do D4 (M4); removo junto com ele. O seletor "Cotas" de `PlacementProperties` já foi trocado por "Cota: parede" e "Cota: esquadria" (sessão, chaves `opening:wall` e `opening:opening`; `clearDimOverride` em state.ts). Diálogo: `DimensionSettingsDialog.tsx` + `dimensionSettingsModel.ts`; botão "Cotas…" ao lado de "Unidades…".
- D4 passo 3 feito (M4 liberado): `openingTool.tempDims(overrides)` usa o provedor; prévia sem cotas em itens; removidos `openingDims*`, `dimensionRefs`, `temporaryDimensions`, `formatMeters`, `ToolOptions.openingDimMode`. `Tool.tempDims?(overrides?)` recebe as trocas de sessão (a ferramenta não enxerga o estado da UI). PlacementProperties migrado para unidades do projeto (PEDIDO da UNID) e linha de base de check-units atualizada.
**MARCO M5 LIBERADO** (D4 a D8 integrados; hash no commit seguinte da branch de integração)
## Bloqueios e pedidos a outros agentes
_(nenhum)_

## Ações pendentes do dono
- Regravar baselines de imagem (`tests/e2e/baseline*`) se a regressão visual indicar diferença esperada.
