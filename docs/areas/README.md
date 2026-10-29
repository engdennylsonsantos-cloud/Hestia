# Áreas e ambientes — pesquisa e comparação

Estudo de 29/10/2026 sobre a ferramenta de **Ambientes** (`Room`) do Hestia, comparada com o que
Revit e ArchiCAD realmente fazem, mais auditoria do código atual.

| Arquivo | Conteúdo |
|---|---|
| [E-sintese-comparativa.md](E-sintese-comparativa.md) | **Comece por aqui.** Comparação consolidada, bugs confirmados e backlog P0–P3 |
| [F-proposta-plantas-de-area.md](F-proposta-plantas-de-area.md) | **Proposta completa:** planta de área como vista própria, linhas de referência do ambiente, etiqueta com chamada, quadro e prancha geral |
| [G-implementacao.md](G-implementacao.md) | O que foi implementado, como usar, arquivos e limitações conhecidas |
| [mockup-etiqueta.svg](mockup-etiqueta.svg) | Reference lines (o “X” que atravessa o ambiente) + etiqueta dentro/fora com chamada |
| [mockup-planta-area.svg](mockup-planta-area.svg) | Planta antes (sem cor) e depois do esquema de cores, com legenda e quadro |
| [A-pesquisa-revit.md](A-pesquisa-revit.md) | Revit: Room × Area, Room Bounding, Area and Volume Computations, tags, schedules, Area Plans |
| [B-pesquisa-archicad.md](B-pesquisa-archicad.md) | ArchiCAD: Zone, Inner Edge × Reference Line, 4 áreas, Relation to Zones, Zone Label |
| [C-normas-ifc-representacao.md](C-normas-ifc-representacao.md) | IFC4 IfcSpace/Qto/Pset, IPMS, NBR 12721/15575/6492, representação e UX |
| [D-auditoria-codigo.md](D-auditoria-codigo.md) | Auditoria do código: fluxo, dados, 12 bugs, cobertura de testes, backlog |

## Em uma frase

O Hestia já acerta o essencial (contorno derivado, limite na face de acabamento, vãos fechados,
ilhas como furos, criação em lote e pré-visualização), está à frente do ArchiCAD por não precisar de
`Update Zones` e à frente dos dois por mostrar a área antes do clique; o que falta é **altura/limite
superior**, **método de cálculo**, **etiqueta móvel**, **esquema de cores por vista** e **área bruta**
— depois de corrigir o cache que hoje pode exibir área errada.
