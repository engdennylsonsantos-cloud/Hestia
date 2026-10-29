# Capturas antes/depois do plano de unidades e cotas

Par `antes-*`/`depois-*` da mesma vista, mesma janela (1440×860), mesmo zoom e mesmo projeto de exemplo
(`packages/engine/src/fixtures/casa-2-quartos.hestia.json`). `antes` = build de `f89a049a` (início do plano);
`depois` = estado de `c681d6e7` (revisão F3 integrada).

Como foram geradas (script `tests/e2e/capturas-plano-unidades.mjs`):

```bash
# build atual em apps/web/dist; CHROME_PATH aponta para o Chrome do sistema
CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" \
  node tests/e2e/capturas-plano-unidades.mjs apps/web/dist docs/plano-unidades-cotas/capturas depois depois
```

O `antes` sai do mesmo script contra um build feito a partir de `f89a049a` (worktree separado) e modo `antes`
(`... capturas antes antes`); o modo `antes` para depois da vista de corte e não exercita UN/menu H.

Reprodutibilidade conferida em 2026-10-29: reexecução do modo `depois` sobre o build atual gerou os oito PNGs
byte a byte idênticos aos commitados (mesmos SHA-256). O script também imprime o resultado dos atalhos:
`atalho UN abre o diálogo Unidades: ok` e `botão H abre: ok | fecha: ok`, sem erros de console.
As capturas usam WebGL2 via SwiftShader; **a GPU real não foi testada**.

## Pares

- `planta-selecao` — porta selecionada na planta. Intencional: cotas temporárias passam de `1,50`/`1,50` (sem unidade)
  para `0,99 m`/`0,99 m` (medidas nas faces da esquadria, estilo Revit) e ganham o botão `I`; o painel Propriedades
  deixa de misturar `4,50 m`/`0,00 m`/`90 cm`/`210 cm` e mostra tudo na unidade do projeto (`4,5 m`, `0 m`, `0,90 m`, `2,10 m`).
- `planta-cotas` — planta com a cota permanente de `10,00 m` sob a casa. Sem diferença visível; só o `*` de documento
  modificado no título da janela no `antes`.
- `planta-marca-corte` — planta com a marca de corte (linha tracejada) e a cota de `10,00 m`. Sem diferença visível;
  só o `*` no título do `antes`.
- `3d` — modelo 3D da casa. Geometria idêntica. Diferença cosmética: destaque da aba ativa (`Térreo` × `Modelo 3D`)
  e o `*` no título do `antes`; não é regressão de geometria.
- `corte` — corte A com as duas portas. **Possível regressão**: no `depois` desapareceu a etiqueta de nível
  `Pavimento 2 +3,00` no alto à direita; `Térreo +0,00` continua. As paredes, portas e o contorno do corte estão iguais.
  Não foi identificado commit que explique a mudança; validar antes de aceitar (o script temporário de inspeção
  `tests/e2e/_temp-labels.mjs` foi usado para investigar rótulos, mas não foi commitado).

## Só no `depois` (não há par `antes`)

- `dialogo-unidades-ftin` — diálogo "Unidades do projeto" com comprimento em "Pés e polegadas" (1/16"), comprimento
  pequeno em centímetros, área em ft², vírgula decimal e o exemplo ao vivo (`1234,5678 m → 4050' 5 1/16"` etc.).
  Intencional: formatos de unidade (UNID).
- `planta-ftin` — mesma planta com a cota em `32' 9 11/16"`, elevação `0'0"` e coordenadas da barra de status em
  pés-polegadas. Intencional: unidades do projeto em toda a interface.
- `menu-arquivo-aberto` — menu Arquivo aberto pelo botão `H`, com Exportar (DXF/PDF/IFC), Informações do projeto,
  Opções e Fechar menu. Intencional: botão H do menu Arquivo (UI).

As capturas `ui-menu-H-*.png` são de 2026-10-28, anteriores a este par, e mostram o teste abrir/fechar/reabrir/Esc
do botão H.
