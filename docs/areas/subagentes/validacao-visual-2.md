# Validação visual 2 — planta de área (anotações)

Data: 29/10/2026  
Worktree: `C:\Users\Dennylson\Desktop\programas\Hestia\wt\areas-2`  
Branch: `feat/plantas-area-2`  
Objetivo: validar no navegador a cota, o texto e a caixa de texto na **planta de área**, sem alterar código de produção.

**Resultado geral: 41/41 verificações passaram. Nenhum defeito encontrado nesta rodada.**

## Como o app e a planta foram abertos

1. Dev server deste worktree já estava no ar em `http://127.0.0.1:5175/`.
2. Navegador: Google Chrome instalado (`C:\Program Files\Google\Chrome\Application\chrome.exe`), controlado por `playwright-core` do `node_modules` do worktree, com viewport `1600 × 950` e `deviceScaleFactor: 2`.
3. URL usada: `http://127.0.0.1:5175/?debug=1` (os ganchos `window.__hestia` são expostos com `?debug=1`).
4. O projeto padrão abriu como **"Casa térrea, 2 quartos"** (`projeto.hestia.json`), na **Planta de piso: Térreo**, com 8 paredes, 4 portas, 8 janelas e **0 ambientes**.
5. Para criar os ambientes: aba **Arquitetura** → ferramenta **Ambiente** → botão **"Ambientes em todos os circuitos fechados"**. Resultado: **5 ambientes** criados.
6. Para criar a planta de área: no **Navegador de projeto**, clique com o botão direito em **"Plantas de área (Área)"** → **"Criar para todos os níveis"**. Foram criadas 2 plantas (Térreo e Pavimento 2) e a **"Planta de área — Térreo"** abriu automaticamente (`planKind = area`, `areaPlanId = ap_33fc0a2c6`).
7. Cota criada com a ferramenta **Cota alinhada** (botão da barra rápida/aba Anotar): cliques em `(1,0; 1,2)`, `(4,0; 1,2)` e `(2,5; 0,6)` para definir o lado da linha.
8. Texto criado com a ferramenta **Texto**: clique em `(1,6; 2,0)`, digitação de `Texto na planta de area` e `Enter`.
9. Entre cada etapa, `Esc` duas vezes voltou para a ferramenta **Selecionar**.

## Checklist

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Abrir o app e a planta de área pelo fluxo da UI | **PASSOU** | `03-planta-area-aberta.png` |
| 2 | Criar cota na planta de área | **PASSOU** — cota em `plan.annotations.dimensions`, nada no nível | `04-cota-criada.png` |
| 3 | Criar texto na planta de área | **PASSOU** — texto em `plan.annotations.texts`, nada no nível | `05-texto-criado.png` |
| 4 | Hover do texto | **PASSOU** — `hover = txt_2d38cbb89`; realce azul claro com contorno na tela | `06-hover-texto.png`, `06-hover-texto-clip.png` |
| 5 | Hover da cota | **PASSOU** — `hover = dim_870d621e8`; caixa de realce em volta do valor `3,00 m` | `07-hover-cota.png`, `07-hover-cota-clip.png` |
| 6 | Clique com **Selecionar** no texto | **PASSOU** — seleção `["txt_2d38cbb89"]` | `08-selecao-texto.png`, `08-selecao-texto-clip.png` |
| 7 | Caixa de seleção, alça quadrada e destaque do texto | **PASSOU** — texto em azul, caixa azul de 2 px e quadradinho branco com borda azul no canto inferior esquerdo | `08-selecao-texto-clip.png` |
| 8 | Clique com **Selecionar** na cota | **PASSOU** — seleção `["dim_870d621e8"]` | `09-selecao-cota.png`, `09-selecao-cota-clip.png` |
| 9 | Destaque da cota selecionada | **PASSOU** — linhas/extensões e marcas passam para azul de seleção | `09-selecao-cota-clip.png` |
| 10 | Arrastar a alça do texto | **PASSOU** — texto saiu de `(1,60; 2,06)` para `(1,47; 2,69)` | `10-texto-arrastado.png` |
| 11 | Desfazer o arraste | **PASSOU** — `Ctrl+Z` voltou a `(1,60; 2,06)` | `10-texto-arrastado.png` |
| 12 | `Delete` no texto selecionado | **PASSOU** — texto removido da vista; 8 paredes permaneceram | `11-texto-excluido.png` |
| 13 | Desfazer o `Delete` | **PASSOU** — `Ctrl+Z` restaurou o texto | — |
| 14 | Propriedades do texto editam a vista | **PASSOU** — conteúdo alterado para `Texto editado na vista\nSegunda linha` em `plan.annotations`; nível continua com 0 textos | `12-propriedades-texto.png` |
| 15 | Propriedades da cota editam a vista | **PASSOU** — texto da cota alterado para `VÃO LIVRE` em `plan.annotations`; nível continua com 0 cotas | `13-propriedades-cota.png` |
| 16 | **Caixa de texto…** com a ferramenta Texto | **PASSOU** — diálogo abre pelo painel de colocação | `14-dialogo-caixa-texto.png` |
| 17 | Texto multilinha com largura e moldura | **PASSOU** — 3 linhas, `width: 40` mm, `frame: true`; criado em `plan.annotations` | `15-caixa-texto-criada.png` |
| 18 | Caixa de texto pode ser selecionada | **PASSOU** — clique no centro seleciona `txt_bd704b06a` | `16-caixa-texto-selecionada.png` |
| 19 | Seleção por janela em volta de cota/texto | **PASSOU** — janela `(0,2; 2,75) → (4,4; 0,3)` selecionou a cota e o texto: `["dim_870d621e8", "txt_2d38cbb89"]` | `17-janela-selecao.png` |
| 20 | Erros de console/página | **PASSOU** — nenhum erro de aplicação, nenhum `pageerror`, nenhuma requisição falha | — |

## Screenshots

Todos em `C:\Users\Dennylson\AppData\Local\Temp\opencode\areas-2-validacao\final\`:

| Arquivo | Conteúdo |
|---|---|
| `01-inicial.png` | App aberto no projeto padrão, planta de piso |
| `02-ambientes-criados.png` | 5 ambientes criados |
| `03-planta-area-aberta.png` | Planta de área do Térreo aberta, sem cor |
| `04-cota-criada.png` | Cota `3,00 m` criada |
| `05-texto-criado.png` | Texto de anotação criado |
| `06-hover-texto.png` / `06-hover-texto-clip.png` | Hover do texto, com recorte ampliado |
| `07-hover-cota.png` / `07-hover-cota-clip.png` | Hover da cota, com recorte ampliado |
| `08-selecao-texto.png` / `08-selecao-texto-clip.png` | Texto selecionado: caixa + alça quadrada + texto azul |
| `09-selecao-cota.png` / `09-selecao-cota-clip.png` | Cota selecionada: geometria azul |
| `10-texto-arrastado.png` | Texto depois do arraste da alça |
| `11-texto-excluido.png` | Texto removido com `Delete`; cota permanece |
| `12-propriedades-texto.png` | Propriedades do texto com conteúdo multilinha |
| `13-propriedades-cota.png` | Propriedades da cota com `VÃO LIVRE` |
| `14-dialogo-caixa-texto.png` | Diálogo **Caixa de texto** preenchido (3 linhas, 40 mm, moldura) |
| `15-caixa-texto-criada.png` | Caixa criada, selecionada, com moldura |
| `16-caixa-texto-selecionada.png` | Caixa selecionada por clique depois de limpar a seleção |
| `17-janela-selecao.png` | Seleção por janela incluindo cota e texto |
| `18-final.png` | Estado final da vista |
| `resultado.json` | Log estruturado das 41 verificações e dos erros coletados |

O roteiro usado está em `C:\Users\Dennylson\AppData\Local\Temp\opencode\areas-2-validacao\flow-final.mjs` (fora do repositório).

## Erros de console

- **Nenhum erro de aplicação.**
- **Nenhum `pageerror`.**
- **Nenhuma requisição falha.**
- Único 404 observado no dev server: `http://127.0.0.1:5175/favicon.ico`. É o favicon ausente do Vite, não tem relação com a planta de área e foi excluído da contagem.
- Não houve aviso de React, erro de render ou exceção durante hover, seleção, arraste, exclusão, desfazer, propriedades, caixa de texto ou janela.

## Conclusão sobre a caixa de seleção existente

- **Texto selecionado**: a caixa de seleção existente funciona e é visível. O texto fica azul, aparece um retângulo azul de 2 px em volta do bloco e um **quadradinho branco com borda azul no canto inferior esquerdo**, fora do texto. Esse quadradinho é a alça de arraste: puxá-lo moveu o texto, e um único `Ctrl+Z` desfez o movimento.
- **Cota selecionada**: a seleção é comunicada pela **cor azul da geometria** (linha, extensões e marcas). Não há caixa de seleção nem alça quadrada para a cota, o que está de acordo com o desenho atual (`notes.ts` desenha caixa/alça só para textos; a cota usa `look.select` na geometria).
- **Hover**: tanto texto quanto cota ganham realce. No texto, o realce é um preenchimento azul translúcido com contorno; na cota, é uma caixa translúcida em volta do valor. Ambos foram confirmados por estado (`useUi.hover`) e por captura ampliada.
- **Caixa de texto**: a caixa multilinha com largura e moldura também entra no mesmo caminho de seleção do texto (caixa + alça + destaque) e pôde ser selecionada por clique após limpar a seleção.
- **Seleção por janela**: a janela esquerda→direita incluiu cota e texto simultaneamente, confirmando que a seleção por janela alcança `plan.annotations` na planta de área.

## Observações (não são defeitos)

- A **Caixa de texto** nasce no centro do viewport (`5,00; 3,50`), como documentado. Nesta vista, esse ponto caiu sobre a divisa entre os ambientes 1 e 4, então a caixa aparece atravessando a parede. O texto pode ser selecionado e movido normalmente; o comportamento é o esperado pela regra "centro da vista ativa".
- A cota criada manualmente nasceu com `offset = -0,596 m` e texto `3,00 m`, coerente com os pontos clicados.
- A planta de área nasceu com anotações vazias (o nível não tinha cotas/textos), e todas as anotações desta validação ficaram em `AreaPlan.annotations`, sem vazar para o nível.
