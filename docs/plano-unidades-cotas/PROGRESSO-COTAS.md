# Progresso do agente COTAS (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): lint (eslint, fronteiras, paridade, densidade) verde com 2 avisos de hooks em OpeningTempDims/ViewportOverlays; typecheck e testes rodados por pasta a cada passo.

**Estado em 2026-10-29: frente concluída e integrada ao `main` (`adb416ef`).** F1 e F2 fechadas com
ressalvas/defeitos registrados abaixo; F4 e F5 fechadas na branch de documentação. O relatório final está em
[`docs/integracao/cotas-2026-10-29.md`](../integracao/cotas-2026-10-29.md).

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
- [x] F1 suíte e build (`06`; só quando UNID e ESQ terminarem) — **com ressalvas** (ver fechamento)
- [x] F2 navegador — **com defeitos registrados** (ver fechamento)
- [x] F3 revisão cruzada (feita pelo REVISOR; REVISAO CONCLUIDA 4ae611f9)
- [x] F4 documentação (este commit; seções A/B/C das pendências e nota S1–S5)
- [x] F5 entrega (branch publicada; merge no `main` feito pelo dono em `cab2d5fd`/`adb416ef`)

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
**MARCO M5 LIBERADO d91c6beb** (D4 a D8 integrados; D5, D7, D9 e D11 também)

## M6 — registro de sujeitos fora de `project.elements` e unidades da ferramenta Cota
- `dims/registry.ts` aceita `DimSubjectKind` = `ElementKind | 'detailLine' | 'perimeterLine' | 'grid'`. `selectionDims` procura primeiro em `project.elements`; se o id não for elemento, tenta os sujeitos na ordem `NON_ELEMENT_KINDS` e chama `selectionSubject(project, id, levelId)` do provedor. `subjectDims(ctx, kind, subject)` cobre sujeitos montados pela ferramenta (rascunho do Perímetro). Testes em `dims/registry.test.ts` (linha de detalhe, nível ativo, grade, id desconhecido, perímetro e precedência de elemento).
- `ui/dims/useSelectionDims.ts`: só documenta que a seleção pode ser sujeito fora de `project.elements`; o overlay já era genérico (nada funcional mudou nele).
- `COMO-ADICIONAR-COTA.md`: ponto de extensão dos três tipos e `subjectDims` documentados.
- PEDIDO UNID atendido: `dimensionTool.ts` grava `Dimension.unit: 'project'` (sem `precision` fixa) nas cotas simples e em sequência; a prévia usa as unidades do projeto. Testes em `dimensionTool.test.ts`.
**MARCO M6 LIBERADO 3913e67a** (registro de sujeitos fora de `project.elements`; a ESQ já pode fazer D10.2 e D10.3).
## Fechamento da Fase F (2026-10-29)

Integração no `main`: merge `cab2d5fd`, gates `9e46c3ba`, registro `181b75f5`; R03 corrigido em `65fd6bc2` e
mergeado em `adb416ef`. Relatório final: [`docs/integracao/cotas-2026-10-29.md`](../integracao/cotas-2026-10-29.md).

**F1 — suíte e build (ok, com ressalvas).** `typecheck` ok, `lint` ok (1 aviso de hook em
`OpeningFlipGrips.tsx`), **7.606 testes** em 667 arquivos, `build` ok, IFC ok (123 testes; `ifc:quality` 0 erros,
round-trip ok, N2 16/16). `check-units` por linha de base: **104 ocorrências herdadas** em 43 arquivos — nenhuma
nova. A01 aberto: `scene3d.ts` com 438 linhas efetivas (> 420, exceção `eslint-disable max-lines`).

**F2 — navegador (ok na maioria, com defeitos).** Passaram unidades (cm/ft²/rad), diálogo "Cotas…", cotas ao
selecionar/editar, parede com porta na ponta, linha/perímetro/eixo/piso, mover/copiar, "I" gerando permanentes,
batente na espessura acabada e prévia de colocação. Defeitos: (1) desfazer de colocação não atômico; (2) cotas
temporárias sobrepostas às permanentes após "I"; (3) `hostedConflicts` sem chamador; (4) criação de eixo sem cota
unificada. Não validados: build na porta 8080, batente no 3D e `ft-in` no fluxo completo.

**Desvios resolvidos.** D4 integrado (prévia e seleção usam o provedor; `AutoCotaDialog` migrado no R04
`e86fbdf7`, sem os apelidos `referencia`/`modoAberturas` obsoletos); D9 fechado (o diálogo "Cotas…" e a troca
rápida valem; `ToolOptions.openingDimMode` removido junto com o D4 passo 3); `tempDims` é o caminho único (não há
mais `OpeningTempDims`/`temporaryDimensions`/`formatMeters` em `packages`/`apps`); D11 revisado após D5/D9.

**Decisão do dono sobre `hostedConflicts`.** O helper de validação continua sem chamador; **mantém-se a
confirmação "Excluir elementos e continuar"** das operações de aparar/redimensionar. O desvio fica documentado e
**não é regressão** (é o comportamento anterior).

**Aberturas.** A01 aberto (decidir divisão ou exceção); A02 aberto (teste de GPU real); A03 pendente e por ora
somente leitura (cotas de piso/laje/telhado/forro); A04/A05 em implementação por outro agente.

**Fora do escopo.** D10.6 (escadas, ambientes e seções) — não implementado por decisão do dono.

## Bloqueios e pedidos a outros agentes
_(nenhum)_

## Ações pendentes do dono
- Decidir A01: dividir `scene3d.ts` ou aceitar a exceção documentada.
- Validar visualmente o que faltou na F2: batente no 3D, `ft-in` e o build na porta 8080.
- Regravar baselines de imagem (`tests/e2e/baseline*`) se a regressão visual indicar diferença esperada — conferir
  antes a etiqueta de nível ausente no corte (`capturas/LEIAME.md`).
- Validar em GPU real (capturas/e2e usam SwiftShader).
- Acompanhar A04/A05 e decidir A03.
