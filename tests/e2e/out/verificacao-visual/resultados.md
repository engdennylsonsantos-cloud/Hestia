# Verificação visual — resultados da execução

- **Gerado em:** 2026-10-27T03:10:29.047Z
- **URL:** `file:///<usuario-local>/.local/share/opencode/worktree/8fed4c/gpu-r3-picking/apps/web/dist/index.html?debug=1`
- **Navegador:** 155.0.8059.86 (C:\Program Files\Google\Chrome\Application\chrome.exe)
- **Viewport:** 1440×900 (deviceScaleFactor 1)
- **Resumo:** 6 PASS · 0 FAIL · 0 PENDENTE

| Item | Critério | Esperado | Observado | Veredito | Captura |
|---|---|---|---|---|---|
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | 3D aberto | vista 3D ativa com o modelo enquadrado | view=3d; caixa -0.09/-0.09/0.00–8.09/6.09/2.80 | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | paredes retas em caixas instanciadas | pelo menos uma InstancedMesh de parede (4 paredes retas) | 89 caixas de parede em 8 InstancedMesh; 3 malha(s) de parede fora do caminho instanciado | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | portas e janelas em caixas instanciadas | caixas de porta e de janela | 11 peças de porta, 16 peças de janela | **PASS** | [`6-3d-caixas.png`](./6-3d-caixas.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | silhueta vem das caixas instanciadas | esconder a camada instanciada muda a imagem (paredes/aberturas somem) | 18.0% dos pixels mudam | **PASS** | [`6-3d-silhueta-sem-instancias.png`](./6-3d-silhueta-sem-instancias.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | seleção 3D realça a parede | pixels na cor de seleção (azul) sem refazer o modelo | 44686 px alterados, 42134 azuis | **PASS** | [`6-3d-selecao.png`](./6-3d-selecao.png) |
| 6 · 3D com caixas instanciadas (paredes, aberturas, silhueta, seleção) | sem erro de página | nenhum erro de console/pageerror | 0 erro(s) | **PASS** | — |

## Erros de página

Nenhum.
