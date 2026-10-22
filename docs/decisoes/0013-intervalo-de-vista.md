# Decisão 0013 · Intervalo de vista (view range) da planta

Fonte: docs/05 §5 (Revit View Range). Decidido pelo dono em 2026-10-21: topo padrão do Revit (2,30 m); janelas acima do corte como no
Revit (tracejadas); todos os elementos de uma vez; planta de forro (direção `up`) depois, só com o campo preparado.

## 1 · Modelo
- Cada nível é uma planta: `Level.viewRange: ViewRange` (tipo em `packages/model/src/viewRange.ts`; padrão `{top 2,30; cut 1,20; bottom 0; depth 0; direction 'down'}`,
  cotas relativas à elevação do nível). `SCHEMA_VERSION` 14 → 15 (migração acrescenta o padrão a todos os níveis). Regra: topo ≥ corte ≥ base ≥ profundidade
  (`viewRangeIssues`/`normalizeViewRange`). Comando `setLevelViewRange(levelId, patch)` (desfazer/refazer como os demais).
- `direction: 'up'` é aceita e guardada, mas a planta ainda desenha como 'down' (UI desabilitada, com a nota "em breve").
- A cota `cut` absoluta é `level.elevation + viewRange.cut`.

## 2 · Classificação (engine, `packages/engine/src/viewClass.ts`)
`viewClassOf(range, elevation, z0, z1, { extendBelow })` classifica uma faixa; `classifyLevelEntries` classifica todos os elementos do
nível (ordenados por id) e `classifyLevelForView` devolve o mapa id → estado. Cada elemento do nível tem uma faixa de cotas absolutas
`[z0, z1]` (tabela §3). Estados (`ViewClass`): `cut` | `projection-above` | `projection-below` | `beyond` | `hidden`.
Regra padrão (Z = elevação do nível; top/cut/bottom/depth absolutos = Z + valor):
1. `z0 > top` ou `z1 < depth` → `hidden`.
2. `z0 ≤ cut ≤ z1` → `cut`.
3. `z0 > cut` (inteiro entre corte e topo) → `projection` ACIMA do corte (desenho tracejado).
4. `z1 < cut` e `z1 ≥ bottom` → `projection` ABAIXO do corte (desenho normal, mais leve, sem hachura).
5. `z1 < bottom` e `z1 ≥ depth` → `beyond` (estilo "além": cinza claro, traço contínuo fino).
Categorias com intervalo estendido para baixo (Revit): piso, laje e escada nunca viram `hidden` nem `beyond` por estarem abaixo da base (tratam `bottom = −∞`).
Exceção de produto: a projeção tracejada da cobertura (contorno do telhado acima do corte) continua sendo opção da planta ("Mostrar projeção da cobertura",
padrão ligada), independente do topo, porque é prática de projeto brasileira; a planta de cobertura (D6) não muda.

## 3 · Faixa de cotas por categoria
| Categoria | z0 | z1 |
|---|---|---|
| Parede | cota da base (nível + deslocamento) | topo mais alto do perfil/altura; com `attachTopToRoof`, o topo derivado do telhado |
| Porta/janela | base da parede + peitoril | + altura da abertura |
| Piso | face inferior | face superior |
| Laje | face inferior | face superior |
| Telhado | face inferior do beiral (menor cota das águas menos a espessura do telhado) | cumeeira (maior cota das águas) |
| Escada | `baseZ` | `topZ`; os degraus individuais usam o próprio topo (cheio abaixo do corte, tracejado acima, oculto acima do topo) |

## 4 · Efeitos na planta
- Parede `cut`: contorno e hachura de corte como hoje; `projection`/`beyond`: linha fina, sem hachura.
- Abertura: as aberturas que atravessam o plano de corte furam a parede (como hoje). Abertura cujo vão NÃO cruza o corte (peitoril acima do corte, ou verga abaixo do
  corte) NÃO fura a parede na planta: a parede é desenhada inteira e a abertura aparece como símbolo tracejado (acima do corte e ≤ topo) ou some (> topo). Só afeta
  o desenho da planta (a geometria do modelo, 3D, quantitativos e cortes não mudam).
- Escada: a cota de corte vem da vista (`level.elevation + cut`), substituindo `STAIR_CUT_HEIGHT`; o símbolo de corte aparece só se o plano cruza a escada.
- Piso/laje: preenchimento normal quando `projection` abaixo/`cut`; as de outros níveis seguem como "nível abaixo" apagadas (D4, sem mudança).
- Aviso de vista (`viewRangeWarnings`): "N elemento(s) fora do intervalo de vista" por categoria, listados nas propriedades da vista (Revit mostra isso aos
  poucos; aqui avisamos).
- A abertura que fura a parede na planta é a que o corte da vista atravessa (`openingsCrossingCut`, em `planWallCuts.ts`).
- O DXF de planta usa a mesma vista que a tela (`planViewOf`, via `dxfGeometryOf` em `apps/web/src/editor/dxfExport.ts`). Cortes, elevações
  e 3D não dependem do intervalo. As tabelas e quantitativos não usam o intervalo: contam todos os elementos do nível.
  No DXF, o que está fora do corte vai para camadas de projeção (`PAREDE_PROJECAO_ACIMA`/`ABAIXO`, `PAREDE_ALEM`, `ABERTURA_ACIMA`/`ABAIXO`/`ALEM`,
  `TELHADO_PROJECAO`, `ESCADA_ACIMA`; as acima do corte são tracejadas); o oculto não sai; a escada usa a cota de corte e o topo da vista;
  pisos e lajes fora do intervalo não saem.
- **Divergência (resolvida):** na tela, o contorno tracejado dos telhados fora do intervalo (`roofs.ts`, `showProjection`) aparece só com a
  preferência "Mostrar projeção da cobertura" ligada. O DXF respeita a mesma preferência: `dxfGeometryOf` recebe
  `showRoofProjection` e só põe o contorno em `TELHADO_PROJECAO` quando ela está ligada (`savePlanDxf` lê o estado da tela).

## 5 · Interface
Propriedades da vista (nível ativo): Topo, Plano de corte, Base, Profundidade (m, relativos ao nível), Direção (Baixo | Cima [em breve]), botão "Restaurar padrão",
lista de avisos. Campos inválidos mostram a mensagem de `viewRangeIssues` e não são gravados.
- "Selecionar" de um aviso põe os elementos na seleção; os ocultos (que a planta não desenha) ganham um contorno fantasma: tracejado fino na cor
  de seleção, sem preenchimento (`hiddenSelectionOps`; paredes pelo contorno, aberturas pelo vão, pisos/lajes/telhados/escadas pela pegada).
- "Mostrar projeção da cobertura" (padrão ligada) é preferência da tela, não do projeto: guardada no navegador em `localStorage`
  (`hestia.roofProjection`, "true"/"false"), como a captura, com leitura e gravação tolerantes a armazenamento indisponível. Não entra no projeto
  nem no desfazer. Alternador na faixa (Vista › Planta) e na aba Vista de Propriedades, com o mesmo estado.

## 6 · Desempenho (`scripts/bench-vista.mts`)
Comando: `npx vite-node scripts/bench-vista.mts` (o cabeçalho do script indica vite-node; `tsx` não está no projeto). `BENCH_RUNS` muda o
número de medidas (padrão 20, após 3 de aquecimento). Não há relatório escrito em `docs/`: os números abaixo são de uma execução em
2026-10-21 neste ambiente (média em ms, mínimo entre parênteses). Entre execuções a média variou até cerca de 15%.

| Cenário (nível térreo, `lv_0`) | Casa (10 paredes) | Sintético (110 paredes, 80 aberturas) |
|---|---|---|
| `resolveLevel` padrão, sem edição | 1,77 (1,14) | 39,41 (33,50) |
| `resolveLevel` padrão, após edição | 52,04 (43,42) | 193,52 (173,75) |
| `resolveLevel` com a vista, sem edição | 1,18 (0,94) | 36,83 (33,22) |
| `resolveLevel` com a vista, após edição (inclui classificação) | 45,23 (39,63) | 200,35 (167,72) |
| `buildPlanDrawList`, redesenho sem edição | 0,47 (0,32) | 12,98 (10,90) |
| `buildPlanDrawList`, após edição | 97,58 (81,59) | 400,34 (349,84) |

Leitura: a classificação pela vista custa pouco perto da resolução (no sintético, 200 contra 194 ms com edição, cerca de 3%). Sem edição, o
redesenho de pan, zoom e hover reaproveita a resolução e a vista (poucos ms). Após uma edição, o redesenho é o custo maior, e o script mede
resolução e desenho juntos. O contorno fantasma de oculto selecionado custa menos de 0,01 ms por quadro no script.

## 7 · Fora desta rodada
- **Planta de forro** (direção `up`): o campo `direction` é aceito e guardado, mas a planta desenha sempre como `down`; a opção "Para cima
  (em breve)" fica desabilitada em Propriedades.
- **Intervalo por vista** em vez de por nível: hoje o intervalo é do nível (`Level.viewRange`); não há vista de planta com intervalo próprio.
- **Sobrescrita por categoria**: o intervalo vale igual para todas as categorias. A única exceção é a regra de piso, laje e escada, que
  estende para baixo (§2). Não há campo para sobrescrever uma categoria.
