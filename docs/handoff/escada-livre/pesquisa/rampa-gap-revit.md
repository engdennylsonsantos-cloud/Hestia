# Rampa Hestia x Revit: lacunas e especificação do modo LIVE

Legenda: [DOC] = documentado pela Autodesk (ver research/revit-rampa.md). [FORUM] = relato não oficial. [INF] = inferência/conhecimento geral, não confirmado em doc consultada. [PROP] = proposta nossa (não vem do Revit).
Worktree: C:\Users\Dennylson\Desktop\programas\Hestia\wt\rampa-integ. Nenhum código foi alterado.

## 0. Estado atual (lido no código)
- `packages/tools/src/rampTool.ts` (`RampTool`): 1º clique = centro da borda de início; 2º clique = direção + comprimento (modo `length`) ou só direção (modo `slope`, com nota "termina antes/passa do clique"). Número digitado = ângulo. Cria em UMA transação via `createRampFromPlan` (`rampCommands.ts`). Prévia: `rampPartsPreview` (`rampPreview.ts`) + um `label` "inclinação · N lances · X m".
- `packages/tools/src/rampOptions.ts`: `DEFAULT_RAMP_OPTIONS = { shape:'straight', turn:'left', mode:'length' }` (o padrão é `length`; o dono quer `slope`).
- `apps/web/src/ui/RampOptionsBar.tsx`: Forma, Largura, Giro, Prof. do patamar, Modo de entrada, Inclinação (%), Tipo. Nível de topo e deslocamentos NÃO estão na barra: estão em `PlacementProperties.tsx` (linhas ~103-109, grupo "Colocação · Rampa").
- `packages/engine/src/rampPlan.ts` `planRamp`: só reta/L/U; lances com exatamente 2 linhas de espelho; `rampBasis(r)` lê start/dir/width do 1º lance; `rampEdit.ts` `regenRamp` regenera só a partir dessa base (não serve a trajeto livre).
- Avisos de norma: `rampIssues.ts` `rampNormIssues(rr)` depende de `ResolvedRamp` (`resolveRamps`, caro); só aparece depois de criar.
- Escada (`stairRunTool.ts`): mesmo molde de 2 cliques; o caracol tem 3 cliques, `deleteKey()` (Backspace volta um passo), `inputPrompt()` e Enter/clique confirmam. O `Tool` (`packages/tools/src/types.ts`) NÃO tem duplo clique; Enter sem texto chama `confirm()`, Backspace chama `deleteKey?()` (controller.ts ~l.276-292), Esc chama `cancel()`.

## (a) Tabela Revit x Hestia: fluxo de criação

| # | Aspecto | Revit | Hestia hoje | Origem | Lacuna |
|---|---|---|---|---|---|
| 1 | Entrada | Architecture > Circulation > Ramp; aba "Create Ramp Sketch"; Finish Edit Mode / Cancel | Botão ativa a ferramenta; cria ao 2º clique | [DOC] | Sem fase de croqui; não soma trechos |
| 2 | Desenho | Run: Line ou Center-ends Arc; Boundary e Riser para controle fino | Reta/L/U por 2 cliques | [DOC] | Trechos livres (LIVE). Arco fica fora |
| 3 | Base/Top Level + offsets | Propriedades: Base Level/Offset, Top Level/Offset, Multistory Top | Base = nível ativo; Topo/offsets só no painel lateral | [DOC] | Levar para a barra de opções com o desnível visível |
| 4 | Altura vem dos níveis; inclinação é resultado | Sim (H / comprimento do croqui); Ramp Max Slope só avisa | Sim, e há modo `slope` | [DOC]/[INF] | Revit não tem "inclinação → comprimento": é extensão nossa; padrão `slope` é pedido do dono [PROP] |
| 5 | Rampa longa/curta demais | Aviso não bloqueante sugerindo mudar Max Slope / Max Incline Length; dica de ajustar Top Level | Aviso só depois de criar | [FORUM] | Falta/sobra durante o desenho [PROP] |
| 6 | Patamares | Tipo tem Maximum Incline Length (~1200 mm, forum); automático no Run com patamar; manual ao croquiar segmento horizontal | Tabela de norma gera lances+patamares em reta/L/U | [DOC]/[FORUM] | Patamar automático em trecho livre e de giro em qualquer ângulo |
| 7 | Tipo | Thickness, Function, Shape, Material, Max Incline Length, Max Slope | `RampType` com tabela de norma, patamar mín., largura mín. | [DOC] | Hestia já é mais rico |
| 8 | Planta | Seta de subida + Up/Down text | Seta + inclinação em % e 1:X | [DOC] | Ok |
| 9 | Guarda-corpo | Pergunta o tipo ao criar | Fora do escopo | [DOC] | Baixa |
| 10 | Abertura de laje | Manual | Automática | [DOC] | Hestia à frente |
| 11 | Durante o desenho | Croqui + cotas temporárias. O contador "risers created/remaining" é da ESCADA; não achei doc para rampa | Croqui + piso + 1 rótulo | [INF] | Rótulo com falta/sobra [PROP] |
| 12 | Edição | Edit Sketch; arrastar boundary pode quebrar restrições | Propriedades regeneram (`regenRamp`); sem edição de trajeto | [DOC]/[FORUM] | Grips de vértice na rampa livre |
| 13 | Encadeamento | Opção "Chain" na barra do croqui | Após criar, fica pronta (sem encadear) | [INF] | O LIVE já encadeia |
| 14 | Mensagens | Aviso ao Finish | `env.say` + lista de avisos | [INF] | Enriquecer |

### Lacunas priorizadas (impacto x esforço)
| Prio | Lacuna | Impacto | Esforço | Depende |
|---|---|---|---|---|
| P1 | Padrão `slope` | Alto | Trivial | nada |
| P2 | Falta/sobra na prévia de reta/L/U | Alto | Baixo | `rampLive.ts` puro |
| P3 | Base/Topo + offsets + desnível na barra | Alto | Baixo | nada |
| P4 | Modo LIVE com patamares automáticos | Muito alto | Alto (várias tarefas) | P2 |
| P5 | Otimizador "Ajustar" | Alto | Médio | P4 |
| P6 | Edição de rampa livre (grips, regen) | Médio | Médio-alto | P4 |
| P7 | Dicas por estado, Backspace, Enter, repetir clique | Médio | Baixo | P4 |
| P8 | Arco, Multistory Top, guarda-corpo | Baixo | Alto | adiar |

## (b) Especificação do modo LIVE [PROP]

### b.1 Conceito
Nova forma `RampShape = 'free'` ("Livre"). O usuário clica vértices. Cada trecho entre vértices é um LANCE (com patamares em linha automáticos quando o desnível passa do máximo da norma); cada vértice com mudança de direção > 3° vira PATAMAR DE GIRO automático. A inclinação é única na rampa toda (como no Revit, e como `resolveRamps` distribui o desnível proporcional ao comprimento). Lance = componente `run` com 2 espelhos (convenção do `planRamp`), logo 3D, corte, IFC, abertura de laje e quantitativos seguem funcionando.

### b.2 Máquina de estados dos cliques
Estados: `IDLE`, `ORIGIN` (1º ponto fixo), `DRAWING` (>= 1 trecho confirmado; o vivo segue o cursor), `REACHED` (desnível total alcançado).
- `IDLE` -> clique: `pts=[P0]`, vai a `ORIGIN`. Dica: "Rampa livre: clique o próximo ponto."
- `ORIGIN` -> clique em P1 (|P1-P0| >= 0,01 m): confirma o trecho 1; vai a `DRAWING` (ou `REACHED` se já fecha H). Número digitado = comprimento do trecho na direção do cursor (`inputPrompt` = "Comprimento (m)").
- `DRAWING` -> clique em Pk: confirma o trecho; se falta ~ 0 (tolerância 0,005 m de desnível) vai a `REACHED`. Clique com o cursor além do topo (modo `slope`): confirma TRUNCADO no ponto onde o desnível fecha e vai a `REACHED`.
- Concluir: Enter (`confirm()`), ou clique repetido sobre o último vértice (< 0,05 m; faz o papel do duplo clique, que o `Tool` não tem), ou clique em `REACHED`. Se ainda falta desnível: o 1º Enter avisa "Faltam 0,60 m de desnível. Enter de novo cria assim; A ajusta."; o 2º Enter cria com aviso de norma (nunca bloqueia, regra 3 do contrato). A = `optimizeRamp` (b.5).
- Backspace (`deleteKey()` devolve true): `REACHED` -> `DRAWING` (remove o último vértice); `DRAWING` com 1 trecho -> `ORIGIN`; `ORIGIN` -> `IDLE`. Com texto digitado o controller só apaga o texto.
- Esc (`cancel()`): descarta o rascunho inteiro (`reset()`); 2º Esc sai da ferramenta (padrão do controller). Nada gravado, nada a desfazer.
- Tab alterna `slope`/`length`; Espaço (`space()`) marca patamar manual no último vértice; Shift/ortogonal vêm do `snap`.
- Ao criar: uma transação "Criar rampa" (padrão atual); volta a `IDLE`.
- Limites: 40 vértices; trecho < 0,01 m ignorado; ângulo < 3° entre trechos = colinear (só patamar em linha da norma).

### b.3 O que a prévia mostra a cada movimento
1. Trechos confirmados (itens em cache, não recalculados).
2. Trecho vivo do último vértice até o cursor (ou até o ponto de fechamento): lances (piso `tone:'tread'`), patamares em linha e o patamar de giro previsto no vértice quando o cursor vira > 3°.
3. Tracejado do ponto de fechamento até o cursor quando passa do topo (parte "sobrando").
4. Rótulo no cursor com falta/sobra (ver (c)); ponto verde "nível alcançado" em `REACHED`.
5. Sem `resolveRamps`, `rampIssueList` nem interseção/booleana: só aritmética sobre segmentos (ver (f)).

### b.4 Cálculo do falta/sobra em tempo real
Entradas: H = `rampRise(p, draft)` (= `rampTopZ - rampBaseZ`), tipo (`normTable`, `landingMinLength` = P), largura, inclinação de trabalho `s`.
- Modo `slope` (padrão): `s` = barra ou `type.defaultSlope`. Lance sobe `s` por metro; patamar não sobe. `Lf` = soma dos lances (confirmados + vivo). `subiu = s*Lf`; `falta = H - subiu`. Em rampa: `falta/s` m de lance (mais os patamares que a norma pedirá no caminho; por isso o "≈"). Textos: `falta > 0`: "faltam 0,35 m de desnível (≈ 4,2 m de rampa)"; `|falta| <= 0,005`: "nível de topo alcançado"; `falta < 0`: "passou 0,10 m (≈ 1,2 m): a rampa termina antes do cursor".
- Modo `length`: a inclinação final é `s_res = H / Lf` (uniforme). Não há falta de desnível (sempre fecha H); a falta é de COMPRIMENTO frente à meta `s_meta` (barra ou máximo da norma): `faltaL = H/s_meta - Lf`. Texto: "Resulta 9,4 % (1:10,6): acima do máximo de 8,33 %. Faltam ≈ 1,3 m de rampa" ou "Resulta 6,9 % (1:14,5): dentro da norma".
- `layoutSegment(d, c, s, maxRise, P)` (puro): com `d` = distância ao cursor e `c` = desnível já acumulado no lance corrente, `maxRise = rampNormRowFor(type, s)?.maxRise ?? última linha` (regra de `maxRiseFor` em `rampPlan.ts`). Emite lance até `min(d, (maxRise-c)/s)`; ao esgotar `maxRise`, emite patamar `P` (consome `d`, não sobe, `c=0`); repete. Patamar de giro no vértice zera `c`.
- Ponto de fechamento (cursor passou do topo): percorre os pedaços do layout até `Lf = H/s`; O(nº de lances).
- Exemplo A (NBR 9050, `rmt_nbr9050`, s = 1/12, P = 1,20, maxRise 0,80): H = 1,50, cursor a 12,0 m em linha reta. Lance 1 = 9,60 m (sobe 0,80); patamar 1,20; lance 2 = 1,20 m (sobe 0,10). Subiu 0,90; falta 0,60 m (≈ 7,2 m de lance; o lance 2 ainda comporta 0,70, então não há novo patamar). Texto: "faltam 0,60 m de desnível (≈ 7,2 m de rampa)".
- Exemplo B: H = 0,80, cursor a 11,0 m. Fecha em 9,60 m; o cursor subiria 0,917. Texto: "passou 0,12 m (≈ 1,4 m): a rampa termina antes do cursor, a 9,60 m".
- Exemplo C (modo `length`): H = 0,60, trecho de 5,0 m: `s_res = 12 %` (1:8,3) > 8,33 %. `H/s_meta = 7,2`; faltam ≈ 2,2 m. Texto: "Resulta 12,0 % (1:8,3): acima do máximo de 8,33 %. Faltam ≈ 2,2 m de rampa".
- Em reta/L/U (modo `slope`) o mesmo cálculo substitui a nota atual, comparando o clique com `plan.pathLength`.

### b.5 Algoritmo de otimização ("Ajustar") [PROP]
Quando: tecla A / 2º passo ao concluir com falta/sobra, botão "Ajustar" em `RampProperties.tsx`, e versão "Auto" (inclinação livre dentro da tabela).
Variáveis: inclinação `s`; comprimento do último trecho (opcional: dos anteriores); nº de lances por trecho; patamar `Pk >= P`.
Restrições (norma do tipo; se impossível vira aviso, nunca bloqueia): `s <= smax`; para cada lance `s*Li <= maxRise(s)`; nº de lances <= `maxFlights(s)`; patamar de giro com dimensão >= max(largura, P); `Σ s*Li = H`.
Custo lexicográfico: (1) violações de norma = 0; (2) menor desvio do croqui `Σ|Li_final - Li_desenhado|`; (3) menor `s` (mais suave); (4) menos lances/patamares.
Passos:
1. Candidatos de `s`: o da barra; cada `maxSlope` da `normTable` (1/20, 1/16, 1/12 no NBR); o ajuste exato `s_fit = H/Lf_desenhado`.
2. Para cada `s <= smax`: `Lf_nec = H/s`; `delta = Lf_nec - Lf_desenhado`. `delta < 0`: trunca a partir do fim (nunca antes do 1º trecho). `delta > 0`: estica o último trecho na sua direção (se o último for patamar, alonga o penúltimo).
3. Reaplica `layoutSegment` para posicionar patamares por `maxRise(s)`; equaliza os lances de um trecho (mesmo desnível, como `planRamp`) se nenhum passar de `maxRise`.
4. Calcula o custo; escolhe o menor; empate = menor `s`.
5. Modo `slope` fixo: só o candidato da barra (trunca/estica). Modo `length`: vale `s_fit` se `<= smax`; senão o candidato de menor `delta`. Sem candidato válido: devolve o de menor violação com aviso.
Exemplos (NBR padrão, P = 1,20):
- Ex.1: H = 1,50, desenhado 12,0 m de percurso (Lf = 10,8), barra 1/12. `s_fit = 13,9 %` > 8,33 % (inválido). 8,33 %: n = ceil(1,50/0,80) = 2, Lf = 18,0, percurso 19,2, delta +7,2. 6,25 %: n = 2, Lf = 24, delta +13,2. Vence 8,33 %. Resultado: 2 lances de 9,0 m (0,75 + 0,75), patamar 1,20. Texto: "Ajustado: 8,33 %, 2 lances, +7,2 m no último trecho".
- Ex.2: H = 0,80, desenhado 11,0 m, modo `length`: `s_fit = 7,27 %` (1:13,75) <= 8,33 %, n = 1: aceita, desvio 0. Em `slope` fixo a 8,33 % trunca para 9,60 m (desvio 1,40).
- Ex.3 (Auto): H = 1,20, percurso desenhado 21 m. 5 %: n = 1, percurso 24,0 (delta +3,0). 6,25 %: n = 2, percurso 19,2 + 1,2 = 20,4 (delta -0,6). 8,33 %: n = 2, 15,6 (delta -5,4). Vence 6,25 %; em `length` a inclinação exata vira 1,2/(21-1,2) = 6,06 % (<= 6,25 %, n = 2, mesmo patamar).
- Ex.4: H = 0,80; 5 m em +X, vértice, 6 m em +Y; barra 1/12; largura 1,5, patamar de giro D = 1,5 consome D/2 de cada lado: lances 4,25 + 5,25 = 9,5; necessário 9,6; falta 0,0083 m de desnível (> tolerância): "faltam 0,01 m"; "Ajustar" estica o último trecho 0,10 m.

### b.6 Patamares automáticos
- Em linha: dentro do trecho, a cada `maxRise(s)` de desnível; comprimento `type.landingMinLength`; largura do lance.
- De giro: no vértice com ângulo > 3°. Polígono = fim do lance A recuado D/2 + início do lance B recuado D/2, ligados pelo canto externo (mitra) e pelo interno. `D = landingDepth ?? max(width, landingMinLength)`. Zera o contador de desnível. Retornos agudos (> 150°): tratar como U (`generateUShape`) ou limitar com aviso.
- Manual (Espaço): vértice vira patamar mesmo se colinear.
- Patamar conta no percurso e não tem degraus (regra 5 do contrato).

### b.7 Edição depois de criar
- Modelo: `Ramp` ganha `freePath?: Vec2[]` e `manualLandings?: number[]` (opcionais, sem migração), `shape:'free'`.
- Mover/girar/espelhar: valem pelos componentes; `freePath` deve acompanhar a transformação, senão a regeneração desfaz o movimento.
- Propriedades (largura, inclinação alvo, modo, níveis/offsets): `regenRamp` ganha ramo `free`: refaz os componentes a partir de `freePath`; modo `slope` trunca/estica o último trecho; modo `length` recalcula `s`.
- Grips: um por vértice (mover = `regenRamp` com novo `freePath`), "+" no meio do trecho insere vértice, Delete no grip remove (padrão `stairGrips.ts`). Diferença do Revit, que exige Edit Sketch [PROP].

## (c) Barra de opções e mensagens [PROP]

Barra (`RampOptionsBar.tsx`): Forma [Reta | Em L | Em U | Livre] · Largura · Giro (L/U) · Prof. patamar (L/U/Livre) · Modo de entrada [Inclinação → comprimento (padrão) | Comprimento → inclinação] · Inclinação (%) + 1:X (modo inclinação) · Tipo · BLOCO DE NÍVEIS novo (espelha Base/Top do Revit [DOC]): Base [nível ativo] + Desloc. base · Topo [Automático (nível acima) | Até <Nível>] + Desloc. topo (+ Altura se não há nível acima) · leitura "Desnível: 1,50 m" (= `rampRise`). Os campos continuam em `PlacementProperties.tsx` (mesmo `options.ramp`). Durante o desenho a barra mostra "Desnível 1,50 m · feito 0,90 · falta 0,60 m" (campo `liveStatus` em `ToolOptions` ou leitura da ferramenta; tarefa T9/T10).

Mensagens pt-BR:
- Início: "Rampa livre: clique o ponto inicial. Esc cancela."
- Após o 1º ponto: "Rampa livre: clique o próximo ponto (ou digite o comprimento). Enter conclui, Backspace volta, Esc descarta."
- Rótulo, modo inclinação: "8,33 % (1:12) · faltam 0,35 m de desnível (≈ 4,2 m de rampa)" / "... · nível de topo alcançado" / "... · passou 0,10 m (≈ 1,2 m): termina antes do cursor".
- Rótulo, modo comprimento: "Resulta 9,4 % (1:10,6) · acima do máximo 8,33 % · faltam ≈ 1,3 m".
- Patamares: "Patamar de giro previsto (1,50 x 1,50 m)"; "Patamar automático a cada 0,80 m de desnível".
- Alcançado: "Nível de topo alcançado. Enter ou clique conclui; Backspace volta."
- Concluir com falta: "Faltam 0,60 m de desnível. Enter de novo cria assim; A ajusta."
- Ajustado: "Ajustado: 8,33 %, 2 lances, +7,2 m no último trecho."
- Criada (formato atual): "Rampa criada: 2 lances, 8,33 % (1:12), 19,20 m. Ctrl+Z desfaz."
- Erros: reaproveitar os de `rampTool.ts` (sem nível de topo, topo abaixo da base).
Formatadores `formatRampPercent/Ratio/Slope` já existem em `packages/model/src/ramp.ts`; criar `rampLiveMessages.ts` puro.

## (d) Pontos de integração
| Ponto | Arquivo / função | Mudança |
|---|---|---|
| Padrão slope | `packages/tools/src/rampOptions.ts` `DEFAULT_RAMP_OPTIONS`; `apps/web/src/editor/state.ts` l.182 usa a constante | `mode:'slope'`; ajustar testes que assumem `length` |
| Tipo de forma | `packages/model/src/rampTypes.ts` (`RampShape`), `ramp.ts` `makeRamp` | `'free'`, `freePath?`, `manualLandings?` |
| Layout puro | novo `packages/engine/src/rampLive.ts`: `layoutSegment`, `liveRemaining`, `optimizeRamp`, `rampPlanNormCheck` | reusa `rampNormRowFor`, `maxRiseFor` |
| Geometria livre | novo `packages/engine/src/rampFree.ts`: `planRampFree(path, H, type, ...)` devolve `RampPlan` | reusa `inlineLanding`, `tagRuns`, `generateStraightRun` (exportar helpers de `rampPlan.ts`) |
| `planRamp` | `rampPlan.ts` | assinatura intacta |
| Regeneração | `rampEdit.ts` `regenRamp` | ramo `free` |
| `rampBasis` | `rampPlan.ts` | continua só reta/L/U |
| Ferramenta | `rampTool.ts` `RampTool` (`move`, `click`, `confirm`, `deleteKey`, `cancel`, `space`, `tab`, `inputPrompt`) | delega a `RampLiveSession` (novo `rampLiveSession.ts`, estado puro) quando `shape==='free'` |
| Criação | `rampCommands.ts` `createRampFromPlan` / `RampCreateInput` | aceitar `freePath`, `manualLandings` |
| Prévia | `rampPreview.ts` `rampPartsPreview` | cache de itens; rótulo vivo |
| Barra | `apps/web/src/ui/RampOptionsBar.tsx` | opção Livre, níveis, desnível, indicador |
| Níveis | `PlacementProperties.tsx` l.103-109 | extrair `RampLevelsFields` compartilhado |
| Propriedades | `apps/web/src/ui/RampProperties.tsx` | botão "Ajustar" |
| Grips | novo `packages/tools/src/rampGrips.ts` (modelo `stairGrips.ts`) | vértices |
| Avisos | `rampIssues.ts` | sem mudança; prévia usa `rampPlanNormCheck` numérico |
| i18n | `apps/web/src/editor/i18n.ts` (pt/en; `i18n.test.ts` exige paridade) | `ramp_shape_free`, `ramp_live_*` |
| IFC/DXF/tabela | componentes genéricos | sem mudança; teste de fumaça |

## (e) Tarefas para o DeepSeek flash
Regras gerais: tocar só os arquivos listados; textos em português; funções puras no engine; seguir o runner dos `.test.ts` vizinhos; rodar typecheck e testes do pacote; um commit por tarefa.

- T1 Padrão `slope`. Arquivos: `packages/tools/src/rampOptions.ts`, `rampTool.test.ts`, `rampPreview.test.ts`. Aceite: `DEFAULT_RAMP_OPTIONS.mode==='slope'`; barra abre em "Inclinação → comprimento"; testes ajustados e verdes. Teste: rampa sem opções cria com 1/12 e comprimento H/s.
- T2 Exportar helpers de `packages/engine/src/rampPlan.ts` (`maxRiseFor`, `inlineLanding`, `tagRuns`) e `engine/src/index.ts`. Aceite: comportamento igual; `rampPlan.test.ts` verde.
- T3 `rampLive.ts` (`layoutSegment`, `liveRemaining`) + `rampLive.test.ts` + `index.ts`. Aceite: exemplos A, B, C de b.4; patamar em linha a cada maxRise; tolerância 0,005; sem import de `resolveRamps`.
- T4 `packages/tools/src/rampLiveMessages.ts` + teste. Aceite: strings exatas de (c), vírgula decimal e "≈", casos falta/alcançado/passou/resulta.
- T5 Falta/sobra em reta/L/U: `rampTool.ts` (`move`, `build`) + teste. Aceite: modo slope, H=0,80, clique a 5,0 m -> rótulo com "faltam"; a 11 m -> "passou"; modo length -> "Resulta" ou "dentro da norma".
- T6 Níveis na barra: `RampOptionsBar.tsx`, novo `ui/RampLevelsFields.tsx`, `PlacementProperties.tsx`. Aceite: escolher "Até Nível 2" e offsets muda `options.ramp`; mostra "Desnível: X m"; sem nível acima aparece Altura.
- T7 Modelo free: `packages/model/src/rampTypes.ts`, `ramp.ts`, `index.ts`, schema/migração se existir (`grep RampShape`). Aceite: `'free'` e campos opcionais; projetos antigos carregam; round-trip.
- T8 `rampFree.ts` `planRampFree` + teste. Aceite: 1 trecho == `planRamp` reta; 2 trechos a 90° = lance, patamar de giro, lance; área do patamar >= D x D; soma dos rises = H; sem sobreposição entre lances e patamar; Ex.4.
- T9 `rampLiveSession.ts` (tools, estado puro): IDLE/ORIGIN/DRAWING/REACHED; `click`, `move`, `back`, `finish`, `cancel`, `typeLength`. Aceite: um teste por transição de b.2; Backspace vai até IDLE; clique repetido conclui; truncamento no topo.
- T10 Ligar `RampTool` à sessão + opção "Livre" + `createRampFromPlan` com `freePath`. Aceite: rampa livre de 2 trechos em transação única "Criar rampa"; Ctrl+Z desfaz; `resolveRamps` devolve 2 lances + 1 patamar.
- T11 `optimizeRamp` + teste dos 4 exemplos de b.5. Aceite: Ex.1 8,33 %, 2 lances, +7,2 m; Ex.2 7,27 %; Ex.3 6,06 %; sem candidato válido devolve o de menor violação.
- T12 "Ajustar": tecla A na sessão e botão em `RampProperties.tsx`. Aceite: 1 transação; mensagem "Ajustado: ...".
- T13 `regenRamp` ramo free (`rampEdit.ts`) + teste: largura mantém vértices; slope muda o último trecho; length muda a inclinação.
- T14 `rampGrips.ts` + teste de mover vértice. Depende de T13.
- T15 i18n pt/en. Aceite: `i18n.test.ts` verde.
Ordem: T1,T2,T7 (paralelas) -> T3,T4 -> T5,T6 -> T8 -> T9 -> T10 -> T11 -> T12,T13 -> T14,T15.

## (f) Riscos
- Desempenho: `move` roda a cada pixel. Proibido na prévia: `resolveRamps`, `rampIssueList`, `rampOpenings`/headroom e qualquer `intersection` de `@hestia/geom`. Usar só `layoutSegment` (O(nº de lances)), cache dos trechos confirmados, recalcular só o trecho vivo, ignorar movimentos < 1 px (ou rAF). `rampPartsPreview` chama `stairRunSteps` por lance; para rampas longas desenhar o polígono do lance direto. Meta: 40 vértices < 2 ms por move. Booleanas só na criação.
- Geometria do patamar de giro em ângulos arbitrários (agudos, quase colineares, trecho menor que D/2): lances de comprimento <= 0 ou polígonos autointerceptantes. Mitigar com clamp, aviso "trecho curto demais" e teste de propriedade.
- `rampBasis`/`regenRamp` assumem reta/L/U: esquecer o ramo `free` quebra a edição.
- Mover/girar/espelhar sem atualizar `freePath` desfaz o movimento ao regenerar.
- Tolerância (0,005 m) x arredondamento da UI (2 casas): comparar antes de formatar.
- Duplo clique não existe no `Tool`: usar clique repetido no último vértice; trecho de 0 m já é ignorado.
- Modo slope reinterpreta o clique (trunca); modo length obedece o clique. Deixar claro no rótulo.
- A tabela de norma vem de fonte secundária ("a conferir", `norma-rampa.md`); o otimizador lê a tabela editável do tipo, sem valores fixos.
- Revit: não documenta "inclinação → comprimento" nem falta/sobra para rampas; são propostas nossas. Não prometer paridade nesses itens.
- Fora de escopo: arco, Multistory Top Level, guarda-corpo.
