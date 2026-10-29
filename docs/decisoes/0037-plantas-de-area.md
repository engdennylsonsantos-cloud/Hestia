# 0037 · Plantas de área, linhas de referência e rótulo compartilhado

Complementa a [0018](0018-ambientes.md). Implementa a planta de área como vista própria, com o desenho do
Revit (diagonais de referência), rótulo único por ambiente e cor só depois de configurar o esquema.

## Decisões

| # | Decisão | Motivo |
|---|---|---|
| 1 | Planta de área é uma vista persistida (`AreaPlan`), um por pavimento; não é `planKind` | Precisa guardar escala, gráficos, esquema, legenda e quadro; `planKind` é estado de sessão |
| 2 | O rótulo é do **modelo** (`Room.labelPosition`, `labelRotation`, `labelLeader`), não da vista | Arrastar na planta de piso move também na planta de área, cortes e qualquer vista futura |
| 3 | Todo ambiente com circuito fechado já aparece com rótulo; não há "gerar etiqueta" | O rótulo é derivado do ambiente; `RoomTag` só guarda ajustes por vista (campos, orientação, visibilidade) |
| 4 | Linhas de referência = **duas diagonais** que atravessam o ambiente e se cruzam no ponto de referência | Pedido do produto; substitui o "X" pequeno no ponto |
| 5 | Ponto de referência = centroide; se cair fora do polígono/furo, polo de inacessibilidade | Ambiente em L/U/pilar continua com o cruzamento dentro da área útil |
| 6 | Sem cor por padrão (`fill: none`); cor só com `ColorScheme` aplicado à planta | Revit: cor é esquema de vista, não atributo do ambiente; o Interior Fill não imprime |
| 7 | Chamada padrão fora do ambiente = **duas linhas cruzadas**; opções reta, cotovelo e nenhuma | Atende o desenho pedido e mantém o do Revit disponível |
| 8 | "Geral" é uma **prancha** com uma vista por pavimento + quadro geral agregado | Sobrepôr pavimentos é ilegível; reutiliza `Sheet`/`SheetViewport` |
| 9 | DXF próprio com camadas `AMBIENTES`, `AMBIENTES_REFERENCIA`, `AMBIENTES_CHAMADA`, `AMBIENTES_TEXTO` | O DXF da planta de piso perderia as diagonais e a chamada |
| 10 | IFC: `Name` = número, `LongName` = nome, `PredefinedType = SPACE`, `Pset_SpaceCommon`, `NetPerimeter`/`GrossPerimeter`/`NetVolume` | Correções de schema apontadas na pesquisa (docs/areas/C) |
| 11 | Categoria de ambiente é atributo do modelo (`categoryId`) e a lista de categorias é editável (nome, código, cor, hachura) | Destrava cor por categoria, legenda, quadro e classificação IFC |
| 12 | A planta de área desenha o perímetro do ambiente (padrão fino), além das diagonais | O contorno é o que fecha a leitura da área |
| 13 | Selecionar o ambiente na planta de área destaca preenchimento e contorno; clicar dentro dele seleciona | Sem destaque não se sabe o que está sendo editado |
| 14 | Cor de área só aparece em planta de área; a planta de piso usa o preenchimento neutro do tema | Evita "planta colorida" onde a cor não significa área |

## Modelo

- `Project.areaPlans?: AreaPlan[]`, `roomCategories?`, `colorSchemes?` — opcionais, sem migração de dados.
- `Room`: `referencePoint?`, `labelPosition?`, `labelRotation?`, `labelLeader?`, `categoryId?`.
- `AreaPlan`: `levelId`, `scale`, `graphics`, `tags` (ajustes), `legend?`, `table?`, `schemeId?`.
- Comandos: `addAreaPlan`, `updateAreaPlan`, `removeAreaPlan`, `addRoomTag`, `updateRoomTag`,
  `removeRoomTag`, `setRoomReference`, `setRoomLabel`, `upsertRoomCategory`, `removeRoomCategory`,
  `upsertColorScheme`, `removeColorScheme`.

## Consequências

- O ponto que localiza o circuito (`point`) não muda ao arrastar o rótulo ou a referência; a área nunca
  muda por causa de anotação.
- Apagar o ambiente remove os rótulos das plantas; apagar uma planta não apaga ambientes.
- Duplicata no mesmo circuito não soma na tabela/quadro. Número repetido no nível gera **aviso** (como no
  Revit), não erro.
- Pé-direito zero/negativo é erro de modelo e o IFC não exporta o espaço sem aviso.
- A planta de piso continua com o rótulo completo; a decisão de mostrar só o nome fica para a etapa de
  acabamento da planta de piso.

## Testes

`areaPlan.test.ts` (modelo), `roomReference.test.ts` (centroide, polo, diagonais, cache, separador),
`roomCreateBulk.test.ts` (lote com face interna e separador), `areaPlan.test.ts` (render sem cor/com cor,
rótulo dentro/fora), `areaPlanSheet.test.ts` (prancha + quadro), `areaPlanActions.test.ts` (ações) e
`areaPlanDxf.test.ts` (camadas).
