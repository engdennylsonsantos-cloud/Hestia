# Retomada do plano de unidades e cotas — estado em 2026-10-29

O COTAS foi interrompido no meio da Fase F (F1/F2). Nada foi mesclado em `integracao/telhados-grades` nem em `main`.
Branch de trabalho e de entrega: `claude/fervent-newton-rfgz3y` (branch local `plano/cotas`). Hashes abaixo são de
`git log` dessa branch.

## (a) Pronto e integrado, por papel

**UNID — unidades do projeto (completo).** U1 `e0e48404`, U2 `c9392982`, U3 `a205f8d4`, U4 `7c255a28`, U5 `2d3d0740`,
U6 `5926d8af`, U7 `dd7bf0c7`; C0 `680bd5aa`, C1 `0f84094b`, C2 `e3158cea`, C3 `0085828d`, C4 `42c84038`, C5 `cd723de1`,
C6 `e50acb3c`, C7 `8765a9cd`; B1–B4 `6ad01c82`, B5 (atalho UN) `4d63e546`. Inclui diálogo Unidades, `NumField` por
grandeza, `parseQuantityText`, `useUnits`, unidades em `ProjectSettings`, migração de painéis/diálogos/tools/render/io
e a trava `check-units`.

**ESQ — esquadrias/batente (completo).** S1 `0047375d`, S2 `2369a314`, S3 `8cb2aca6`, S4 `134bddf5`, S5 `2a72d477`;
progresso final `1ca10877`; D10.2/D10.3 `dffc4982` e ajuste `d24142d2`. Batente acompanha a espessura acabada da parede,
opção de núcleo, prévia real na colocação, planta do modal com batente e folha.

**COTAS — D0–D9, D11 (completo).** D0 `21568c29`, D1 `543bf803`, D2 `159d5c5f`, D3 `94e89669`, D4 parte 1 `c7a13dc4`,
D5/D7/botão I `0b9dd41f`, D6/D8 parcial/D11 parcial `4ccd01c2`, D4 parte 3 `a185d696`, D9 `52550ff6`;
**M5** `d91c6beb`, D10.1/D10.4/D10.5 `a8e3530b`, **M6** `3913e67a`, D10.2/D10.3 `dffc4982`. D11 tem
`COMO-ADICIONAR-COTA.md` e a decisão `0037`.

**GPU — port (integrado, só SwiftShader).** `8f61f945` (W1/R2/P1/M1), `a3b4052b` (R3/R4/R5), `de1dd44c`, `c3ad4a16`,
`d7068ff7`; merges `f4ea758d`, `020d09af`, `eea38ebe`. **A GPU real não foi testada**; os e2e rodam WebGL2 via
SwiftShader.

**UI — botão H do menu Arquivo (completo).** `25f99bfa`; merge `96a367e4`.

**REVISOR — F3 (completo).** Achados R01 `ccbb305c`, R02 `e2c2d9a7`, R03 `ec5fae6c`, R04 `e86fbdf7`, R05 `4c28e1a4`,
R06/R07 `39a345fe`, R08 `c0061096`, R09 `ec178b1b`/`2b3c69ef`, R10 `4ae611f9`, R11 `ece98ff9`/`5bc51b17`;
registro `c681d6e7`. **REVISAO CONCLUIDA 4ae611f9**. Abertos: A01–A05 (ver `REVISAO-CRUZADA.md`).

## (b) O que falta

- **F1 — suíte e build:** não foi executada no fechamento. Foram feitos só `tsc --noEmit`, `check-boundaries` e
  `check-units` (ver seção e). A revisão F3 registra `npm run check` com 6610 testes verdes, mas é preciso rodar
  `npm run check` e `npm run build` no estado final.
- **F2 — navegador:** as capturas já estão em `capturas/` com o `LEIAME.md` e a reprodutibilidade conferida; falta a
  validação visual do dono (batente/alizar, cotas, unidades ft-in, UN, H) e decidir o que fazer com o nível ausente
  no corte (ver `capturas/LEIAME.md`).
- **F4 — documentação:** consolidar a documentação do plano (o D11 cobre só a extensão de cotas).
- **F5 — entrega:** fechar a entrega na branch e escrever o relatório final da seção 7 do `08-ORQUESTRADOR.md`.

## (c) Decisões para o dono

Copiadas de `REVISAO-CRUZADA.md` (seção "Decisões para o dono"):

- **`scene3d.ts`:** dividir a cena 3D (faixas/sombras/plano) para cumprir 420 linhas, ou aceitar a exceção documentada (A01).
- **Cotas de piso/laje/telhado:** implementar edição por lado (exige operação pura em `outlineEdit.ts`) ou manter leitura (A03).
- **Mover/copiar:** mostrar também o ângulo do deslocamento ou manter só a distância (A04).
- **Prévia de colocação:** manter o "I" disponível durante a colocação e as cotas da prévia sem tom de inválido.
- **Mensagens fixas restantes** (`gridIssue` "5 cm", caracol "30°"): migrar para as unidades do projeto ou tratar como
  limites técnicos universais (A05).

## (d) Ações do dono

1. Regravar as baselines de imagem (`tests/e2e/baseline*`) se a diferença visual for esperada.
2. Validar em GPU real (as capturas e e2e usam SwiftShader).
3. Validar visualmente: batente/alizar, cotas dinâmicas e permanentes, unidades `ft-in`, atalho `UN` e botão `H`.
4. Decidir o merge em `integracao/telhados-grades` e `main` — **nada foi mesclado lá**.

## (e) Como retomar

- Regras do `08-ORQUESTRADOR.md`: o orquestrador **só coordena**, não escreve código de produção; no máximo 3
  subagentes; integração sempre por `git fetch origin claude/fervent-newton-rfgz3y`, `git merge` e
  `git push origin HEAD:claude/fervent-newton-rfgz3y` (nunca `--force`, nunca PR, nunca `main`).
- Modelo: `opencode-go/deepseek-v4.1-flash` (nunca o pro).
- Launchers e prompts usados estão em `docs/plano-unidades-cotas/orquestracao/` (`run-papel.sh`, `run-ui.sh`,
  `run-gpu.sh`, `run-rev.sh`, `gpu.md`, `ui.md`, `rev.md`, `x-*.txt`).
- Relançar o COTAS na Fase F, a partir da raiz do repositório:
  ```bash
  bash docs/plano-unidades-cotas/orquestracao/run-papel.sh cotas opencode-go/deepseek-v4.1-flash \
    "F1/F2 foram interrompidas; retome na Fase F por docs/plano-unidades-cotas/RETOMADA.md"
  ```
  O `run-papel.sh` espera as pastas `../hestia-cotas` e `../hestia-integ` (prompts); ajuste `BASE`/`REPO` se o
  worktree estiver em outro lugar. `CHROME_PATH` deve apontar para um Chrome existente (neste PC funcionou o
  Chrome do sistema; o caminho `ms-playwright/chromium-1243` do script pode não existir).
- No `OPENCODE_PERMISSION`, use **somente barras normais `/`** nos caminhos (inclusive no `external_directory`).

## (f) Problemas conhecidos do ambiente

- `openingCatalogo` e `shortcutConfig` estouram o limite de 5 s sob carga e passam isolados — falha de ambiente.
- Regressão visual da CPU por diferença de fontes/SO nas baselines de imagem.
- Falhas temporárias do serviço do modelo ("cell is at capacity") — relançar o passo.
