# 0003 · Renderização e publicação

| # | Tema | Decisão | Motivo |
|---|---|---|---|
| 1 | Backend gráfico | **WebGL2 por padrão**; WebGPU somente com `?gpu=webgpu`, com queda automática para WebGL2 se o dispositivo for perdido | Só consegui validar WebGL2 (em software, via SwiftShader). Em ambiente sem GPU real o WebGPU perdeu o dispositivo logo após iniciar. Ativar por padrão sem ver em GPU real seria risco para o usuário. Promover a padrão depois de testar em hardware |
| 2 | CPU | Planta em Canvas2D, só quando não há WebGL2 nem WebGPU. O 3D fica indisponível nesse caso | Cumpre "CPU somente sem suporte a GPU" |
| 3 | Lista de desenho | Planta é gerada como lista neutra (preenchimentos, traços, rótulos) consumida pelos dois renderizadores | O mesmo desenho sai igual em GPU e CPU e é testável sem navegador |
| 4 | Hachura | Textura repetida em coordenadas do mundo (GPU) e padrão de canvas (CPU), desligada abaixo de 40 px/m | Barato e sem aliasing em zoom baixo |
| 5 | LOD da planta | Linhas de interface entre camadas só aparecem quando a camada tem ≥ 1,6 px de espessura | Evita mancha preta com camadas de 2 mm |
| 6 | Rótulos | Texto em DOM sobreposto ao canvas | Texto nítido e acessível sem pipeline de fontes na GPU |
| 7 | Publicação | Artefato privado (página única com tudo embutido) por decisão 3 do registro 0001 | Sem pipeline de deploy por enquanto |
| 8 | Salvar | No artefato usa a capacidade `downloads` (o viewer confirma). Fora dele baixa o arquivo; em último caso copia o JSON. Autosave em localStorage quando disponível | O download direto é bloqueado dentro do artefato |
| 9 | Tema | Segue o tema do host (`data-theme` ou preferência do sistema) e permite forçar claro/escuro; o atributo original do host é restaurado em "sistema" | Respeita a escolha do viewer |
