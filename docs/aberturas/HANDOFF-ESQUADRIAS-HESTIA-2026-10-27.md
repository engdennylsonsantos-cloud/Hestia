# Retomada: esquadrias (portas e janelas) no Hestia, 2026-10-27

Continua o [HANDOFF da v3](HANDOFF-ESQUADRIAS-v3-2026-10-27.md). Ramo de integração: `esquadrias/v3` (local, a partir de
`integracao/telhados-grades`; **nada foi enviado ao GitHub**). Cada agente trabalhou num ramo `esquadrias/<nome>` com worktree em
`..\wt\<nome>` (fora do repositório).

> **Em outro PC:** comece por [RETOMAR-EM-OUTRO-PC-E-PESQUISA-2026-10-27.md](RETOMAR-EM-OUTRO-PC-E-PESQUISA-2026-10-27.md) (comandos, prompt pronto e resumo da pesquisa). O prompt do E3b está em docs/aberturas/agentes/prompts/E3b.md.

## 0. PARADA DA SESSÃO (estado exato para retomar amanhã)

Os agentes foram interrompidos por limite de sessão e o trabalho foi salvo em commits `wip` nos ramos abaixo (**nenhum foi validado por completo**).
Rode `npx tsc -p tsconfig.json --noEmit` e os testes do pacote em cada ramo antes de mesclar.

| Ramo | Commits | Estado |
|---|---|---|
| `esquadrias/E2a` | `52bb5c94` referência nominal folha × vão (`openingNominal.ts`, validado pelo agente); `c1b55979` parede curva (furo, retorno e batente na mesma geometria); `08d346c9` **wip** (`resolve.ts`, `openingCut.ts`) | parede curva e `nominalRef` feitos; **reveal (Tarefa 2) não confirmado**; falta rodar tsc/testes |
| `esquadrias/E2b` | `141de252` **wip** único: soleira, folga inferior (`leafUndercut`), ferragens (`openingHardware.ts` + peças em `openingModelDoors*.ts`, `openingModelDetails.ts`) | o agente estava rodando typecheck e lint finais; 5 falhas de teste que já existiam em `esquadrias/v3`; **precisa validar tsc, lint e testes dos arquivos novos** |
| `esquadrias/E3b` | `6f6a9d69` `leafPlan` no painel Planta e corte; `360df0f7` **wip** (`nominalRef` na Visão geral) | feito pelo `opencode` (DeepSeek flash); **o processo `opencode` pode continuar rodando em `..wtE3b`**: se estiver, feche-o (Gerenciador de Tarefas, `opencode.exe`/node) antes de mexer no ramo; restam `reveal`, soleira, `tiltAxis`, `leafMaterialId`, `glassKind` |
| `esquadrias/v3` | v3 + E1a + E3a + E3c + E4 mesclados | base para mesclar os três acima na ordem E2a, E2b, E3b |
| `integracao/telhados-grades` | rodada de telhados, grades e planta de cobertura (67 commits sobre a `main`) | `npm run check` verde; ver `docs/handoff/retomada-2026-10-27-telhados-grades.md` |

Ordem de amanhã: (1) conferir/fechar E2a, E2b e E3b e mesclá-los em `esquadrias/v3`; (2) E3b2, E4b, E1b conforme §3; (3) verificação visual; (4) `npm run check`; (5) mesclar `esquadrias/v3` em `integracao/telhados-grades` e esta na `main` **só com confirmação do dono**.

## 1. Regras decididas pelo dono (não reverter)

1. **Batente no núcleo** por padrão (`frameDepthMode: 'core'`). Opções por tipo: `'wall'` (espessura total da parede, como a caixa
   "Frame Thickness = Wall Thickness" do ArchiCAD) e `'fixed'`.
2. **Com batente, sem retorno do acabamento** (padrão "Do not wrap" do Revit). O acabamento só dobra para dentro do vão quando não há
   porta ou janela (vão livre, estilo `block`). Retorno com batente é opt-in: `closure` explícito no tipo (recortado pela pegada do
   batente, que sai da mesma função que monta a peça).
3. **Alizar e retorno são exclusivos** (ArchiCAD): com alizar, o retorno é `none`.
4. **Planta só com a folha aberta** em todos os zooms. Campo `leafPlan: 'open' | 'closed' | 'both'` por tipo (padrão `'open'`).
5. **Referência nominal folha × vão** (`nominalRef`): tipos antigos continuam `'opening'` (vão); tipos brasileiros novos entram pela
   folha (`'leaf'`, vão = folha + 0,08 m na largura e + 0,05 m na altura, NBR 15930-2). Implementação: E2a (em andamento).
6. **Diálogo como lista de componentes** (Visão geral, Batente, Folha, Folhas e divisões, Caixilho e vidro, Lado externo, Lado
   interno, Parede e vão, Planta e corte, Quadro e dados), cada família só mostra o que a tabela `openingOptionSupport` marca.
7. **Fora desta rodada:** janela de canto e claraboia. A BRD (`arquivo/feat-esq-BRD`) fica arquivada.

## 2. Estado dos ramos (cada um é um commit-lista pequeno sobre `esquadrias/v3` na ordem de mescla)

| Ramo | O que é | Estado |
|---|---|---|
| `esquadrias/v3` | v3 mesclada (sem BRD) + regras 1 a 4 (E1a) + **E3a, E3c e E4 já mesclados** | tsc limpo; ~15 testes de contagem e 84 goldens de planta vermelhos (ver §4) |
| `esquadrias/E2a` (Sonnet) | folha × vão, reveal, correção da cunha em parede curva | **em andamento** |
| `esquadrias/E2b` (Haiku) | soleira, folga inferior, ferragens (altura da maçaneta, dobradiças, fechadura) | **em andamento** |
| `esquadrias/E3b` (opencode, DeepSeek flash) | controles novos no diálogo para campos já no schema (`leafPlan`, `nominalRef`, `reveal`, soleira, `tiltAxis`, `leafMaterialId`, `glassKind`) | **em andamento**: processo `opencode` em `..\wt\E3b`; log em `.opencode\E3b.log` (termina com a linha "opencode terminou com código"); relatório em `RELATORIO.md` (não commitado); conferir `git log` do ramo |

Mesclar na ordem: **E2a, E2b, E3b**. Em cada worktree: `git -C ..\wt\E1 merge --no-ff esquadrias/<nome>`.

## 3. O que falta (em ordem)

1. Mesclar E2a, E2b e E3b; rodar `npx tsc -p tsconfig.json --noEmit`.
2. **E3b2** (pequeno): controles do diálogo para os campos que E2a e E2b criam (`handleHeight`, `handleInset`, `leafUndercut`, quantidade de
   dobradiças, folgas do vão de `nominalRef: 'leaf'`) e exibir o vão derivado na Visão geral. Os painéis são listas de `field-row`
   protegidas por `support.<chave>`; o comentário no início de `components.ts` explica como acrescentar.
3. **E4b** (Haiku): quadro de esquadrias com folha, vão, material, ferragens e sentido (`packages/engine/src/openingSchedule.ts`; usar os
   acessores do E2a).
4. **E1b** (Haiku, por último, uma vez só): regravar `packages/render/src/plan/ouroZoom.json` (84 chaves), as referências
   `tests/e2e/baseline*` e as capturas de `tests/e2e/out`; ajustar a contagem de peças dos testes listados em §4; conferir a suíte.
5. **Verificação visual no navegador** (planta, elevação e 3D de cada família, com o mostruário `esquadrias`): `npm run build`, Chrome
   (`CHROME_PATH`), roteiros em `tests/e2e/*.mjs`. Conferir: batente no núcleo, acabamento terminando no vão, só a folha aberta,
   parede curva sem cunha de acabamento.
6. `npm run check` completo; depois mesclar `esquadrias/v3` no ramo de integração (`integracao/telhados-grades`) e enviar ao GitHub
   **com a confirmação do dono**.

## 4. Testes vermelhos conhecidos em `esquadrias/v3` (não são regressões)

- `plan/ouroZoom.test.ts` (84): goldens de planta que mudam por R1, R2 e R4. Regravar só no fim (E1b).
- `model3d/scene3d.test.ts` (7) e `model3d/openingParts.test.ts` (3 a 4): a v3 monta o batente em peça única com perfil em L (8 peças
  em vez de 11 na porta, 13 em vez de 16 na dupla, 4 em vez de 7 na pivotante); folha da pivotante; dobradiça a 0,02 m por causa do
  eixo na face da folha. Ajuste de expectativa.
- `instanciada3d.test.ts` (1): 2,6% de aresta extra com aberturas (limite 1%); hipótese: juntas de tinta do batente em L. Investigar.
- `openingTypeForm.test.ts` ("alizar: 8 a mais na janela") e `openingType/previewViews.test.ts` ("detalhe alto em scale"): dependem da
  contagem de peças do alizar (silhueta única por face na v3).
- `openingCatalogoVistas.test.ts` ("3D equivalentes à cena"): o teste assume uma caixa por peça e a v3 usa prismas de perfil.

## 5. Decisões do E4 que o dono deve rever (catálogo: 82 tipos novos, 43 portas P-12..P-46 e 39 janelas J-12..J-50)

- Corta-fogo: PF-30/60/90/120 como pedido, mas a pesquisa (NBR 11742) só define PF-30 e PF-60.
- Porta-balcão só com 2 folhas (a família de giro não aceita 4); veneziana embaixo e vidro em cima por `leafStyle: 'louver'` + `glassRatio 0,5`
  (campo ainda sem motor).
- Larguras de portas de 2 folhas são o CONJUNTO. Portão basculante e de enrolar usam a família `door_garage`, sem `nominalRef`.
- Veneziana de janela só com 1 folha (a família aceita só 1). Bandeiras como janela fixa (0,90 × 0,40 e 0,90 × 0,60).
- Peitoris não especificados foram escolhidos pelo agente (pivotante 1,00; de abrir 1,10; fixa 1,50 e 1,10; peitoril alto 1,80).
- Os tipos antigos P-01..P-03 (por vão) coexistem com P-12..P-16 (por folha); decidir se os antigos saem.
- O mostruário `esquadrias` agora tem paredes de ~147 m (porta) e ~133 m (janela) para caber os 106 tipos.

## 6. Pesquisa e documentos

`docs/aberturas/archicad/01..04` (dossiês do ArchiCAD e do Brasil), `docs/aberturas/E3-spec-correcoes-v3.md`, decisão 0035 (v3, com o padrão
`core` já corrigido) e este documento. Pontos NÃO confirmados em fonte oficial: padrão da biblioteca do ArchiCAD para "Frame Thickness = Wall
Thickness" e âncora face/núcleo; se o símbolo 2D padrão do ArchiCAD mostra a folha fechada além da aberta (a regra "só aberta" é decisão
do Hestia); lista de tipos de caixilho e vidro do diálogo de janela do ArchiCAD; prática de arremate do reboco no marco (só fabricantes).
Confirmados: Revit "Wrapping at Inserts" padrão "Do not wrap"; ArchiCAD alizar e Turn Plaster exclusivos; ArchiCAD "Frame Thickness = Wall
Thickness", largura de perfil uniforme ou por lado e 3 estilos de batente; "Nominal Sizes" (Wallhole, Unit, Egress, Leaf).

## 7. Limpeza (sem `rm -rf`)

Os worktrees são `..\wt\E1` (este ramo), `E2a`, `E2b`, `E3a`, `E3b`, `E3c`, `E4`, e o descartável `v3trial` (ramo `trial/v3`). Foram criados
com `npm ci` (sem junções): remover com `git worktree remove <pasta>` depois de mesclar o ramo. A pasta `C:\tmp\e3c-base-1516` (export
temporário do E3c) pode ser apagada à mão.
