# Plano: unidades do projeto, sistema único de cotas e correções (LEIA PRIMEIRO)

O plano é executado por **um orquestrador que cria 3 subagentes em paralelo** (UNID e ESQ: DeepSeek v4.1 flash; COTAS: o modelo mais capaz disponível, Sonnet em esforço médio). **Se você é o orquestrador, leia `08-ORQUESTRADOR.md` e não codifique.** Se você é um subagente, seu prompt está em `prompts/`. **Leia `07-DIVISAO-AGENTES.md` logo depois deste arquivo: ele diz qual é o seu papel, quais passos e arquivos são seus e quando esperar os outros.** Se você for o único agente, execute tudo na ordem da seção 4. O plano foi escrito para ser seguido **passo a passo, sem pular etapas e sem improvisar**. Cada passo tem: objetivo, arquivos, o que fazer, como testar e a mensagem do commit. Se algo no código real for diferente do que o plano supõe, **leia o código, adapte com o menor desvio possível e anote o desvio no seu arquivo de progresso**. Nunca invente nomes de função sem conferir com `grep`.

## 0. Contexto em 10 linhas
- Hestia: monorepo TypeScript (npm workspaces). Camadas: `geom → model → engine → tools → render`; `io`; `apps/web` (React). `scripts/check-boundaries.mjs` proíbe DOM/React/three em model, engine e geom.
- O modelo guarda **tudo em metros (SI)**. Isso **não muda**. Unidades só existem na fronteira: texto que o usuário lê e texto que ele digita.
- Hoje não há configuração de unidades: ~355 `toFixed(` em ~107 arquivos, ~71 campos `unit="m"`, ~41 `unit="cm"`, ~60 `scale={100}`, ~100 "m²" soltos.
- Hoje existem 3 vocabulários de referência de cota (`axis|face` em `openingPlacement.ts`; `externa|nucleo|eixo` + `centro|arestas` em `autoCotas.ts`; nada nas ferramentas de parede/linha). Vamos unificar.
- Decisões do dono (valem como lei): ver seção 3.
- Pendências completas e histórico: `docs/PENDENCIAS-2026-10-28-cotas-padroes-esquadrias.md`; pesquisa do Revit: `docs/aberturas/pesquisa-f0/R7-revit-cotas-temporarias.md`.

## 1. Preparação (faça uma vez; cada agente em sua própria pasta de trabalho)
```bash
git fetch origin claude/fervent-newton-rfgz3y
git worktree add ../hestia-<SEU-PAPEL> -b plano/<seu-papel> origin/claude/fervent-newton-rfgz3y
cd ../hestia-<SEU-PAPEL>
npm ci
npm run check
```
(`<SEU-PAPEL>` = `unid`, `esq` ou `cotas`. Se `git worktree` falhar, clone o repositório numa pasta nova e faça `git checkout -B plano/<seu-papel> origin/claude/fervent-newton-rfgz3y`.)
- Se `npm run check` falhar **antes de você mexer em algo**, anote em seu arquivo de progresso quais testes falham (linha de base) e siga. Falhas conhecidas por ambiente: regressão visual da CPU (fontes/SO) e e2e. Não conserte o que não é seu.
- **Branch de integração única: `claude/fervent-newton-rfgz3y`.** Você commita na sua branch local `plano/<seu-papel>` e integra por **fast-forward** (protocolo na seção 5 do `07-DIVISAO-AGENTES.md`). Nunca faça `push --force`, nunca crie PR, nunca faça merge em `main` nem em `integracao/telhados-grades`.
- Arquivos do repositório podem ter fim de linha CRLF. **Preserve o fim de linha do arquivo que você edita** (substituições pontuais; não reescreva o arquivo inteiro). Arquivos novos: LF.

## 2. Regras de ouro (violou, refaça)
1. Português em código, comentários e textos de interface; estilo dos arquivos vizinhos.
2. Máximo 420 linhas (sem brancas e comentários) por arquivo não-teste (eslint). Se passar, divida em arquivos coesos (nada de `utils2.ts`).
3. **Toda função nova tem teste** (`.test.ts` ao lado). Teste o comportamento, inclusive bordas (zero, negativo, vazio, texto inválido).
4. Campos novos em `types.ts` do modelo são **opcionais** com valor padrão resolvido **na leitura**. **NÃO incremente `SCHEMA_VERSION`**, não faça migração.
5. `model`, `engine` e `geom` não importam DOM, React nem three. Nada de `console.log`.
6. Nada de gambiarra: nada de `any`, `// @ts-ignore`, `eslint-disable` sem justificativa, `setTimeout` para "esperar", cópia de lógica em vez de reutilizar. Se faltar uma abstração, crie-a.
7. Não pule, não desabilite, não "quarentene" teste para ficar verde. Se um teste antigo falha por causa de mudança **intencional** (ex.: formato de número), atualize o valor esperado e escreva no commit por quê.
8. Antes de **cada commit** rode e deixe verde: `npx tsc -p tsconfig.json --noEmit`, `npx eslint <pastas tocadas>`, `npx vitest run <pastas tocadas>`, `node scripts/check-boundaries.mjs`. Ao fim de cada **fase** rode `npm run check` inteiro.
9. Commits pequenos, um por passo (`feat(unidades): U1 ...`). Depois de cada commit, **integre** (seção 5 do `07-DIVISAO-AGENTES.md`: buscar, mesclar a branch de integração, rodar as verificações, `git push origin HEAD:claude/fervent-newton-rfgz3y`). Falha de rede: repita até 4 vezes (2s, 4s, 8s, 16s). Isso protege o trabalho se o PC reiniciar e entrega aos outros agentes o que eles esperam.
10. Atualize **o seu** arquivo de progresso (`PROGRESSO-UNID.md`, `PROGRESSO-ESQ.md` ou `PROGRESSO-COTAS.md`; marque `[x]`, escreva desvios e bloqueios) **no mesmo commit** do passo. Nunca edite o arquivo de progresso de outro agente.
11. Se travar num passo por mais de 3 tentativas: escreva `BLOQUEIO <id>: <causa>` no seu arquivo de progresso, faça commit, e siga para o próximo passo que não dependa dele. Não fique em laço.
12. Não mexa em `SCHEMA_VERSION`, `package.json` (exceção: no passo C0, acrescentar `&& node scripts/check-units.mjs` ao script `lint`), `docs/paridade/ORDEM.json`, `docs/07-STATUS-V1.md`.
13. Fórmulas e valores numéricos de engenharia: não "chute". Se não sabe, leia o código vizinho e os docs citados.
14. **Só edite arquivos da sua propriedade** (`07-DIVISAO-AGENTES.md`, seção 3). Precisa de mudança em arquivo de outro agente? Registre `PEDIDO <agente>: <o que e por quê>` no seu progresso e siga em frente; não edite.

## 3. Decisões do dono (não rediscutir)
- Unidades são **configuração do projeto**, em Propriedades → **"Padrões do projeto"**, com botão **"Unidades…"** (mesmo estilo do "Editar níveis…") que abre um diálogo.
- Referência das cotas também é configuração do projeto, botão **"Cotas…"** ao lado, e troca rápida na barra de opções da ferramenta e clicando na alça (linha de chamada) da cota.
- Referência de **parede**: `eixo`, `face acabada`, `núcleo (eixo do núcleo)`, `face do núcleo`. Referência de **abertura** (porta/janela): `centro`, `vão livre`, `vão externo do batente`, `com alizar`.
- Sistema de cotas **único e reaproveitável**: adicionar a cota dinâmica a uma ferramenta nova (ou esquecida) deve custar poucas linhas (um provedor + registro).
- Cotas dinâmicas aparecem **ao colocar e ao selecionar** (parede, linha, porta, janela, eixo, piso, laje, telhado, mover/copiar). Clicar no valor, digitar e Enter **reposiciona** o elemento. Elemento hospedado **não pode sair da parede**: alerta e nada muda.
- Batente da porta/janela acompanha a **espessura acabada da parede** (padrão) com opção de **espessura do núcleo**, para paredes de todos os tipos e para janelas.
- Estilo visual como o Revit: linhas de chamada com tracinho, texto azul editável, alças, ícone "I" converte em cota permanente.

## 4. Ordem das fases (valem dentro de cada agente; as dependências entre agentes estão no `07`)
| Fase | Arquivo | Resumo | Dono |
|---|---|---|---|
| A | `01-unidades.md` | Serviço de unidades (model), configuração no projeto, hook web, `NumField` por grandeza | UNID |
| B | `02-padroes-do-projeto-ui.md` | Diálogo "Unidades…" em Padrões do projeto | UNID |
| C | `03-migracao-dos-usos.md` | Migrar os usos soltos, com trava (`check-units`) | UNID (C0–C3, C5, C7) e ESQ (C4, C6) |
| D | `05-correcoes-e-batente.md` | Batente = espessura acabada; prévia real; Espaço/Tab; alças; planta do modal | ESQ |
| E | `04-sistema-de-cotas.md` | Sistema único de cotas | COTAS (D0–D9, D11) e ESQ (D10) |
| F | `06-validacao-final.md` | Suíte, build, navegador, revisão cruzada, documentação | COTAS |

## 5. Como reportar
Ao fim de cada fase sua, escreva no seu progresso um resumo de 5 linhas (o que mudou, arquivos principais, resultado de `npm run check`, desvios, pendências) e integre. No final, responda ao dono em português com o resumo total.

## 6. Arquivos deste plano
`00-LEIA-ME.md` (este), `08-ORQUESTRADOR.md`, `prompts/`, `07-DIVISAO-AGENTES.md` (papéis, propriedade, sincronização, prompts), `PROGRESSO-UNID.md`, `PROGRESSO-ESQ.md`, `PROGRESSO-COTAS.md`, `01-unidades.md`, `02-padroes-do-projeto-ui.md`, `03-migracao-dos-usos.md`, `04-sistema-de-cotas.md`, `05-correcoes-e-batente.md`, `06-validacao-final.md`.
