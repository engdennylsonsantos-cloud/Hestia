# Retomada do plano de unidades e cotas — histórico (encerrado em 2026-10-29)

> **Documento histórico.** A frente foi **mesclada no `main`** e não precisa mais ser retomada por uma branch
> de trabalho. O estado final, os gates e as pendências estão em
> [`docs/integracao/cotas-2026-10-29.md`](../integracao/cotas-2026-10-29.md) e em
> [`PROGRESSO-COTAS.md`](PROGRESSO-COTAS.md). As instruções antigas de `git fetch`/`push` na branch
> `claude/fervent-newton-rfgz3y` **não valem mais** (a branch foi arquivada com tag `archive/*`).
>
> Linha do tempo da integração: merge `cab2d5fd`, gates `9e46c3ba`, registro `181b75f5`, R03 `65fd6bc2`
> mergeado em `adb416ef`.

## O que foi entregue

**UNID — unidades do projeto (completo).** U1 `e0e48404`, U2 `c9392982`, U3 `a205f8d4`, U4 `7c255a28`,
U5 `2d3d0740`, U6 `5926d8af`, U7 `dd7bf0c7`; C0 `680bd5aa`, C1 `0f84094b`, C2 `e3158cea`, C3 `0085828d`,
C4 `42c84038`, C5 `cd723de1`, C6 `e50acb3c`, C7 `8765a9cd`; B1–B4 `6ad01c82`, B5 (atalho UN) `4d63e546`.
Inclui diálogo Unidades, `NumField` por grandeza, `parseQuantityText`, `useUnits`, unidades em
`ProjectSettings`, migração de painéis/diálogos/tools/render/io e a trava `check-units`.

**ESQ — esquadrias/batente (completo).** S1 `0047375d`, S2 `2369a314`, S3 `8cb2aca6`, S4 `134bddf5`,
S5 `2a72d477`; progresso final `1ca10877`; D10.2/D10.3 `dffc4982` e ajuste `d24142d2`. Batente acompanha a
espessura acabada da parede, opção de núcleo, prévia real na colocação, planta do modal com batente e folha.

**COTAS — D0–D11 (completo).** D0 `21568c29`, D1 `543bf803`, D2 `159d5c5f`, D3 `94e89669`, D4 parte 1
`c7a13dc4`, D5/D7/botão I `0b9dd41f`, D6/D8 parcial/D11 parcial `4ccd01c2`, D4 parte 3 `a185d696`, D9
`52550ff6`; **M5** `d91c6beb`, D10.1/D10.4/D10.5 `a8e3530b`, **M6** `3913e67a`, D10.2/D10.3 `dffc4982`.
D11 tem `COMO-ADICIONAR-COTA.md` e a decisão `0037`.

**GPU — port (integrado, só SwiftShader).** `8f61f945` (W1/R2/P1/M1), `a3b4052b` (R3/R4/R5), `de1dd44c`,
`c3ad4a16`, `d7068ff7`; merges `f4ea758d`, `020d09af`, `eea38ebe`. **A GPU real não foi testada.**

**UI — botão H do menu Arquivo (completo).** `25f99bfa`; merge `96a367e4`.

**REVISOR — F3 (completo).** R01 `ccbb305c`, R02 `e2c2d9a7`, R03 `ec5fae6c` (correção final `65fd6bc2`,
mergeada em `adb416ef`), R04 `e86fbdf7`, R05 `4c28e1a4`, R06/R07 `39a345fe`, R08 `c0061096`, R09
`ec178b1b`/`2b3c69ef`, R10 `4ae611f9`, R11 `ece98ff9`/`5bc51b17`; registro `c681d6e7`.
**REVISÃO CONCLUÍDA 4ae611f9.**

## O que restou (fora da entrega original)

- **F2** — validação no navegador feita na maioria dos itens, mas restam os defeitos registrados (undo de
  colocação não atômico, cotas temporárias sobrepostas após "I", `hostedConflicts` sem chamador, criação de eixo
  sem cota unificada) e a validação do build na porta 8080, do batente no 3D e de `ft-in` no fluxo completo.
- **F4** — documentação consolidada em 2026-10-29 (este conjunto de arquivos); o que resta é a decisão do dono
  sobre A01 e a regravação de baselines de imagem, se a diferença visual for esperada.
- **F5** — entrega concluída com o merge no `main` (`cab2d5fd`/`adb416ef`); resta a validação visual do dono.
- **A01–A05** — A01 aberto (decidir dividir `scene3d.ts` ou aceitar a exceção), A02 aberto (teste de GPU real),
  A03 pendente e por ora somente leitura, A04/A05 em implementação por outro agente. Ver
  [`REVISAO-CRUZADA.md`](REVISAO-CRUZADA.md) e o relatório final.

## Decisões já tomadas

- **`hostedConflicts`**: manter a confirmação "Excluir elementos e continuar" e documentar o desvio. Não é
  regressão.
- **D10.6** (escadas, ambientes e seções): fora do escopo.

## Notas de ambiente (histórico)

- `openingCatalogo` e `shortcutConfig` estouram o limite de 5 s sob carga e passam isolados — falha de ambiente.
- Regressão visual da CPU por diferença de fontes/SO nas baselines de imagem.
- Falhas temporárias do serviço do modelo ("cell is at capacity") — relançar o passo.
- Os launchers de orquestração em `orquestracao/` e os prompts em `prompts/` ficam como registro histórico; não
  apontam mais para a branch de entrega.
