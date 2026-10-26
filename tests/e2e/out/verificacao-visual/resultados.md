# Verificação visual — resultados da execução

- **Gerado em:** 2026-10-26T21:48:53.849Z
- **URL:** `file:///<usuario-local>/.local/share/opencode/worktree/8fed4c/gpu-a2-visual/apps/web/dist/index.html?debug=1`
- **Navegador:** 155.0.8059.86 (C:\Program Files\Google\Chrome\Application\chrome.exe)
- **Viewport:** 1440×900 (deviceScaleFactor 1)
- **Resumo:** 44 PASS · 1 FAIL · 0 PENDENTE

| Item | Critério | Esperado | Observado | Veredito | Captura |
|---|---|---|---|---|---|
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 12 | texto "8,00 m" visível | 1/1 textos visíveis | **PASS** | [`1-cota-individual-z12.png`](./1-cota-individual-z12.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 12: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-individual-z12.png`](./1-cota-individual-z12.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | texto da cota no zoom 12 | corpo em px > 0 (papel 2,5 mm) | 3.0 px | **PASS** | [`1-cota-individual-z12.png`](./1-cota-individual-z12.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 12 | textos "2,00 m", "1,50 m" e "1,00 m" visíveis | 3/3 textos visíveis | **PASS** | [`1-cota-cadeia-z12.png`](./1-cota-cadeia-z12.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 12: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-cadeia-z12.png`](./1-cota-cadeia-z12.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 60 | texto "8,00 m" visível | 1/1 textos visíveis | **PASS** | [`1-cota-individual-z60.png`](./1-cota-individual-z60.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 60: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-individual-z60.png`](./1-cota-individual-z60.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | texto da cota no zoom 60 | corpo em px > 0 (papel 2,5 mm) | 15.0 px | **PASS** | [`1-cota-individual-z60.png`](./1-cota-individual-z60.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 60 | textos "2,00 m", "1,50 m" e "1,00 m" visíveis | 3/3 textos visíveis | **PASS** | [`1-cota-cadeia-z60.png`](./1-cota-cadeia-z60.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 60: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-cadeia-z60.png`](./1-cota-cadeia-z60.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 220 | texto "8,00 m" visível | 1/1 textos visíveis | **PASS** | [`1-cota-individual-z220.png`](./1-cota-individual-z220.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota individual no zoom 220: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-individual-z220.png`](./1-cota-individual-z220.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | texto da cota no zoom 220 | corpo em px > 0 (papel 2,5 mm) | 55.0 px | **PASS** | [`1-cota-individual-z220.png`](./1-cota-individual-z220.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 220 | textos "2,00 m", "1,50 m" e "1,00 m" visíveis | 3/3 textos visíveis | **PASS** | [`1-cota-cadeia-z220.png`](./1-cota-cadeia-z220.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | cota cadeia no zoom 220: texto dentro da tela | todos os textos da cota dentro do canvas | todos dentro | **PASS** | [`1-cota-cadeia-z220.png`](./1-cota-cadeia-z220.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | texto da cota escala com o zoom | 12 < 60 < 220 (proporcional ao zoom) | 3.0 px → 15.0 px → 55.0 px | **PASS** | — |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | controle: seleção de cota muda o desenho | traço/texto na cor de seleção (azul) | 1282 px alterados, 1282 azuis | **PASS** | [`1-controle-selecao-cota-ativa.png`](./1-controle-selecao-cota-ativa.png) |
| 1 · Cotas individual e em cadeia (zooms 12/60/220) | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | texto em negrito | font-weight 700 | font-weight 700 | **PASS** | [`2-texto-caixa.png`](./2-texto-caixa.png) |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | texto em itálico | font-style italic | font-style italic | **PASS** | [`2-texto-caixa.png`](./2-texto-caixa.png) |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | caixa de texto com alinhamento à direita e quebra | text-align right, white-space normal e mais de uma linha | text-align right, white-space normal, 60 px de altura para 17.3 px de fonte | **PASS** | [`2-texto-caixa-detalhe.png`](./2-texto-caixa-detalhe.png) |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | texto com líder | linha de chamada entre o texto e o modelo | texto "Líder" presente (38×20 px) | **PASS** | [`2-texto-caixa.png`](./2-texto-caixa.png) |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | máscara de região de detalhe cobre o preenchimento | centro da máscara na cor do papel e faixa vizinha ainda amarela | antes: centro 231,226,208 / faixa 231,226,208; depois: centro 251,251,250 / faixa 231,226,208 | **PASS** | [`2-mascara-antes.png`](./2-mascara-antes.png)<br>[`2-texto-caixa.png`](./2-texto-caixa.png) |
| 2 · Texto com caixa (negrito, itálico, alinhamento, quebra, máscara) | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |
| 3 · Etiquetas, líderes e "Etiquetar todos" | etiqueta com líder | texto de etiqueta e linha de chamada visíveis | texto "PA-14"; 4/4 pontos do líder com tinta | **PASS** | [`3-etiqueta-lider.png`](./3-etiqueta-lider.png) |
| 3 · Etiquetas, líderes e "Etiquetar todos" | "Etiquetar todos" cria uma etiqueta por elemento sem etiqueta | 6 etiquetas (4 paredes + porta + janela) | 6 etiquetas; status "5 etiquetas criadas." | **PASS** | [`3-etiquetar-todos.png`](./3-etiquetar-todos.png) |
| 3 · Etiquetas, líderes e "Etiquetar todos" | etiquetas aparecem na vista | rótulos não vazios para as etiquetas criadas | 6 rótulos (3 textos distintos) | **PASS** | [`3-etiquetar-todos-detalhe.png`](./3-etiquetar-todos-detalhe.png) |
| 3 · Etiquetas, líderes e "Etiquetar todos" | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | linha de detalhe contínua | traço contínuo (1 ciclo) | 1 ciclos, ocupação 100.0% | **PASS** | [`4-linhas-detalhe.png`](./4-linhas-detalhe.png) |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | linha de detalhe tracejada | traços e espaços (7/4 px) | 21 ciclos, ocupação 81.6% | **PASS** | [`4-linhas-detalhe.png`](./4-linhas-detalhe.png) |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | linha de detalhe pontilhada | pontos (1/3 px) | 57 ciclos, ocupação 74.9% | **PASS** | [`4-linhas-detalhe.png`](./4-linhas-detalhe.png) |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | tracejado e pontilhado são distintos | pontilhada tem mais ciclos que a tracejada | 21 × 57 ciclos | **PASS** | [`4-linhas-detalhe.png`](./4-linhas-detalhe.png) |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | seleção da linha de detalhe em 1,7× | traço mais grosso (1,7×) e na cor de seleção | 0 px alterados (0.000%), 0 px azuis; selection=["dl-dash"], hover="dl-dash" | **FAIL** | [`4-selecao-1.7x.png`](./4-selecao-1.7x.png) |
| 4 · Linha de detalhe tracejada/pontilhada e seleção 1,7× | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |
| 5 · Rótulos de corte/elevação | rótulo do corte nas duas pontas | dois "A" (placement both) | 2 rótulo(s) "A" | **PASS** | [`5-cortes-elevacoes.png`](./5-cortes-elevacoes.png) |
| 5 · Rótulos de corte/elevação | rótulo da elevação nas duas pontas | dois "Sul" (placement both) | 2 rótulo(s) "Sul" | **PASS** | [`5-cortes-elevacoes.png`](./5-cortes-elevacoes.png) |
| 5 · Rótulos de corte/elevação | linha de corte em traço-ponto | vários ciclos (tracejado) | 34 ciclos, ocupação 81.9% | **PASS** | [`5-cortes-elevacoes.png`](./5-cortes-elevacoes.png) |
| 5 · Rótulos de corte/elevação | linha de elevação contínua | traço contínuo (1–3 ciclos) | 1 ciclos, ocupação 100.0% | **PASS** | [`5-cortes-elevacoes.png`](./5-cortes-elevacoes.png) |
| 5 · Rótulos de corte/elevação | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | 3D aberto | vista 3D ativa com o modelo enquadrado | view=3d; caixa -0.09/-0.09/0.00–8.09/6.09/2.80 | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | paredes retas em caixas instanciadas | pelo menos uma InstancedMesh de parede (4 paredes retas) | 89 caixas de parede em 6 InstancedMesh; 3 malha(s) de parede fora do caminho instanciado | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | portas e janelas em caixas instanciadas | caixas de porta e de janela | 4 peças de porta, 7 peças de janela | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | silhueta vem das caixas instanciadas | esconder a camada instanciada muda a imagem (paredes/aberturas somem) | 18.0% dos pixels mudam | **PASS** | [`6-3d-silhueta-sem-instancias.png`](./6-3d-silhueta-sem-instancias.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | seleção 3D realça a parede | pixels na cor de seleção (azul) sem refazer o modelo | 44712 px alterados, 42134 azuis | **PASS** | [`6-3d-selecao.png`](./6-3d-selecao.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |

## Erros de página

Nenhum.
