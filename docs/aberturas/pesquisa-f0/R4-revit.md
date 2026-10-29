# R4 - Como o Revit modela esquadrias compostas e perfis

Pesquisa de 2026-10-28. Complementa A, D e E3 (não repete Wall Closure/Wrapping at Inserts, já em A e RETOMAR §B). Legenda: CONFIRMADO (ajuda oficial lida), PROVÁVEL (fontes técnicas/resumo de busca), NÃO CONFIRMADO.

## Resumo para decisão

1. **Dois caminhos no Revit, sem "conjunto" intermediário.** (a) Família de porta com bandeiras: UM componente da categoria Doors, com UM quadro externo; o sidelight é geometria/vidro dentro da família (PROVÁVEL: famílias comerciais expõem "panel, frame e window dimensions" num só tipo). (b) Porta em Curtain Wall: a porta é um curtain panel "porta de curtain wall" (família com "curtain wall" no nome), cercada por mullions do sistema (CONFIRMADO).
2. **Dono do batente.** Caminho (a): o batente pertence à família inteira (ao conjunto); entre porta e sidelight há 0 batentes de parede, e o que os separa é um montante interno do próprio quadro/família (PROVÁVEL; sem doc oficial). Caminho (b): os mullions do curtain wall FAZEM o papel de batente; a ajuda manda apagar o mullion sob a porta; fórum recomenda porta sem frame ("frameless"), pois os mullions são o frame (PROVÁVEL, post de 2008). Portanto no caminho (b) há um mullion compartilhado entre porta e sidelight e nenhum batente por painel.
3. **O Revit nunca dá um batente a cada painel e outro à parede.** O vão na parede é um só (rough opening do host); o "frame" é decisão da família ou dos mullions.
4. **Perfil: biblioteca nomeada, não parâmetros livres.** Mullion Type tem parâmetro "Profile" que escolhe uma família de perfil carregada (CONFIRMADO); formas variantes viram TIPOS da família de perfil (50x100, 65x120) por dimensões rotuladas (PROVÁVEL). Em portas/janelas comuns o frame é extrusão/sweep dentro da família, dimensionado por parâmetros (Frame Width/Depth, Glass Thickness: autorais, não de sistema; já em A).
5. **Mullion: Position (Normal to Face / Parallel to Ground), Angle (-90..90), Offset (a partir do centro do perfil), larguras lado 1/2 e espessura calculadas a partir do perfil custom** (CONFIRMADO).
6. **Alizar:** nas famílias padrão de porta é parâmetro de TIPO: "Trim Width", "Trim Projection Ext", "Trim Projection Int" (PROVÁVEL; listados em Door Type Properties de 2014-2020, mas A diz não estar na lista 2024: conferir). Duas projeções separadas = o alizar existe por face (ext/int), e pode ser zerado em uma. Geometria do trim na família, sobre a face acabada, contornando o batente.
7. **Alizar com bandeira:** NÃO CONFIRMADO em fonte; na prática o trim é geometria da família, então contorna o conjunto quando é um só componente; em curtain wall não há trim de porta.
8. **Recomendação ao Hestia:** imitar o caminho (a) como modelo principal: UM quadro externo pertencente ao conjunto (porta + bandeiras), divisões internas como montantes do mesmo quadro (perfil nomeado de biblioteca, com largura própria), alizar contornando o conjunto, por face (ext/int), parâmetros no TIPO. Do caminho (b) imitar só a ideia de "perfil nomeado reutilizável com posição/offset" para montantes. Vidro: espessura + offset dentro do perfil/rebaixo, não como parâmetro solto.

## Detalhes

**1. Bandeiras**
- Porta em curtain wall: "customize a curtain panel so that it schedules as a door"; só portas de curtain wall substituem painel; desafixar o painel antes (unpin), trocar pelo Type Selector, apagar o mullion sob a porta. CONFIRMADO. https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-4B806EBE-2B46-4889-BC12-77FA23BFBA88.htm
- A ajuda do exemplo não menciona frame (CONFIRMADO por leitura). Fórum: "frameless door, pois os mullions agem como frame" (PROVÁVEL, 2008): https://forums.augi.com/archive/index.php/t-84499.html
- Portas em curtain panel contam em quadro como portas, mas há relatos de marcas duplicadas/auto-numeração (PROVÁVEL; versões antigas).
- Porta com sidelights como família única: listagens comerciais (hollow metal com 2 sidelites) expõem dimensões de painel, frame e janela + tipos aninhados de painel e ferragem (PROVÁVEL; só exemplo comercial). Nenhuma doc oficial descreve "quantos frames" nem o que separa porta e bandeira: NÃO CONFIRMADO (o que aqui chamo de "montante interno do quadro" é inferência da prática de modelagem).
- Curtain panel com porta aninhada: família Curtain Panel com família de porta compartilhada (shared) dentro, para a porta ser etiquetável. PROVÁVEL: https://novedge.com/blogs/design-news/revit-tip-revit-curtain-panel-and-mullion-profile-best-practices

**2. Perfis e vidro**
- Mullion Type: Construction (Profile, Position, Corner Mullion, Thickness), Material, Dimensions (Width on side 1/2). Com perfil custom, espessura e larguras são calculadas. CONFIRMADO: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-DC48E9A8-C040-453B-A2F0-0BBE719F9614.htm
- Angle (-90..90, gira em torno da grid), Position, Offset (do centro do perfil; mullion de canto: relativo aos painéis); Angle e Profile indisponíveis em mullion de canto; Angle não habilitado em circular. CONFIRMADO (via resumo de busca de 2014/2016/2026): https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-9C6F93F4-71C8-4AF0-9A3F-2F41DF8490AA.htm
- Perfil de mullion: template "Profile - Mullion", laço fechado único, origem na interseção dos planos centrais (define Location Line Center/Interior/Exterior); o perfil dá a forma, o tipo de mullion dá o material; tipos de canto (L, V, Quad) referenciam o perfil. PROVÁVEL (Novedge, link acima).
- Painel de vidro: parâmetros "Thickness" e "Glass Offset" como instância; "Frame Depth/Returns" se tem moldura. PROVÁVEL (Novedge).
- Janelas: frame e sash como extrusões presas a planos de referência; parâmetros mínimos Width, Height, Frame Depth/Width, Glass Thickness. PROVÁVEL: https://novedge.com/blogs/design-news/revit-tip-building-flexible-parametric-window-families-in-revit . Window Type Properties oficial inclui Default Sill Height, Window Inset, Glass Pane Material: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-1C03B7DF-89EE-48B1-B501-571745B1D513.htm . "Glazing Rabbet" como termo do Revit: NÃO ENCONTRADO (o rebaixo é uma extrusão separada na família; AUGI t-124851 PROVÁVEL).

**3. Casing/trim**
- Door Type Properties (versões 2014-2020) lista Trim Projection Ext, Trim Projection Int, Trim Width. PROVÁVEL (resumo de busca; página não aprofundada): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-29905EE0-3D7D-422E-A627-5A7A8AC34D7B.htm . Contradiz em parte A (§ lista 2024): conferir ao abrir a página 2024.
- Frame depth costuma ser fórmula: espessura da parede (parâmetro de reporte) + projeção por lado (ex.: 7/16" por lado), AUGI. PROVÁVEL: https://forums.augi.com/archive/index.php/t-56539.html . Tutorial sobre frames em paredes grossas: https://auth.dbr77.com/?p=15670 (terceiros).
- Posição do trim em relação à face acabada: NÃO CONFIRMADO em doc oficial; discussões em fórum (Door Families AND Trim: https://forums.autodesk.com/t5/revit-architecture-forum/door-families-and-trim/m-p/10888976) indicam trim como geometria da família, referenciada aos planos da família, não à camada de acabamento.
- Wrapping at Inserts / Wall Closure: já coberto em A; só confirmado de novo que sem plano "Wall Closure" o Revit aplica um fechamento padrão e que "By Host" delega ao tipo de parede. https://help.autodesk.com/cloudhelp/2020/ENU/RevitLT-Model/files/GUID-2D0B8D5D-2F15-44EC-94FA-0AE5B4C1A76F.htm

**4. Parâmetros e tipos**
- Tipo = o que define o produto (tamanho, material do frame, vidro, nº de painéis); instância = marca, comentários, altura de peitoril etc. PROVÁVEL (Novedge, link janelas). Painel de curtain: Thickness/Glass Offset em instância (Novedge).
- Nomeação: padrão comum "LxA mm, peitoril em X" (exemplo de mercado; NÃO oficial).
- Famílias aninhadas: criar na mesma categoria do pai e ligar parâmetros aos do host (AU class, Autodesk; texto do PDF não extraído, citado via resumo de busca): https://static.au-uw2-stg.autodesk.com/presentation_10688_AS10688_20Revit_20Master_20Class_20Building_20Terrific_20Real-World_20Door_20Families_20PPTX.pdf (PROVÁVEL)

## O que NÃO foi possível confirmar
- Fonte oficial sobre "quantos frames" e o que separa porta de sidelight em família única (só inferência/exemplos comerciais).
- Se o trim de uma porta com sidelights contorna o conjunto no Revit (depende do autor da família).
- Posição exata do trim em relação à face acabada e à camada de acabamento; se o trim é nas duas faces por padrão (existem Ext e Int separados, mas valores padrão não vistos).
- Se Trim Width/Projection existem em Door Type Properties 2024 (aparecem nas versões 2014-2020 pelo resumo de busca).
- Termo "Glazing Rabbet" no Revit; como o usuário escolhe perfil de frame de porta/janela comum (não há seletor nativo: perfil é geometria da família, salvo profile-families carregadas pelo autor).
- Texto do PDF da AU (extração falhou: PDF só de imagens).
