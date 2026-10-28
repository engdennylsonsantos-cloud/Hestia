# Plano: unidades do projeto, sistema único de cotas e correções (LEIA PRIMEIRO)

Você é o agente que vai executar este plano no PC do dono. O plano foi escrito para ser seguido **passo a passo, sem pular etapas e sem improvisar**. Cada passo tem: objetivo, arquivos, o que fazer, como testar e a mensagem do commit. Se algo no código real for diferente do que o plano supõe, **leia o código, adapte com o menor desvio possível e anote o desvio em `PROGRESSO.md`**. Nunca invente nomes de função sem conferir com `grep`.

## 0. Contexto em 10 linhas
- Hestia: monorepo TypeScript (npm workspaces). Camadas: `geom → model → engine → tools → render`; `io`; `apps/web` (React). `scripts/check-boundaries.mjs` proíbe DOM/React/three em model, engine e geom.
- O modelo guarda **tudo em metros (SI)**. Isso **não muda**. Unidades só existem na fronteira: texto que o usuário lê e texto que ele digita.
- Hoje não há configuração de unidades: ~355 `toFixed(` em ~107 arquivos, ~71 campos `unit="m"`, ~41 `unit="cm"`, ~60 `scale={100}`, ~100 "m²" soltos.
- Hoje existem 3 vocabulários de referência de cota (`axis|face` em `openingPlacement.ts`; `externa|nucleo|eixo` + `centro|arestas` em `autoCotas.ts`; nada nas ferramentas de parede/linha). Vamos unificar.
- Decisões do dono (valem como lei): ver seção 3.
- Pendências completas e histórico: `docs/PENDENCIAS-2026-10-28-cotas-padroes-esquadrias.md`; pesquisa do Revit: `docs/aberturas/pesquisa-f0/R7-revit-cotas-temporarias.md`.

## 1. Preparação (faça uma vez)
```bash
git fetch origin claude/fervent-newton-rfgz3y
git checkout claude/fervent-newton-rfgz3y
git pull origin claude/fervent-newton-rfgz3y
npm ci
npm run check
```
- Se `npm run check` falhar **antes de você mexer em algo**, anote em `PROGRESSO.md` quais testes falham (linha de base) e siga. Falhas conhecidas por ambiente: regressão visual da CPU (fontes/SO) e e2e. Não conserte o que não é seu.
- Trabalhe **nesta mesma branch** (`claude/fervent-newton-rfgz3y`). Não crie PR, não faça merge em `main` nem em `integracao/telhados-grades`.
- Arquivos do repositório podem ter fim de linha CRLF. **Preserve o fim de linha do arquivo que você edita** (faça substituições pontuais; não reescreva o arquivo inteiro). Arquivos novos: LF.

## 2. Regras de ouro (violou, refaça)
1. Português em código, comentários e textos de interface; estilo dos arquivos vizinhos.
2. Máximo 420 linhas (sem brancas e comentários) por arquivo não-teste (eslint). Se passar, divida em arquivos coesos (nada de `utils2.ts`).
3. **Toda função nova tem teste** (`.test.ts` ao lado). Teste o comportamento, inclusive bordas (zero, negativo, vazio, texto inválido).
4. Campos novos em `types.ts` do modelo são **opcionais** com valor padrão resolvido **na leitura**. **NÃO incremente `SCHEMA_VERSION`**, não faça migração.
5. `model`, `engine` e `geom` não importam DOM, React nem three. Nada de `console.log`.
6. Nada de gambiarra: nada de `any`, `// @ts-ignore`, `eslint-disable` sem justificativa, `setTimeout` para "esperar", cópia de lógica em vez de reutilizar. Se faltar uma abstração, crie-a.
7. Não pule, não desabilite, não "quarentene" teste para ficar verde. Se um teste antigo falha por causa de mudança **intencional** (ex.: formato de número), atualize o valor esperado e escreva no commit por quê.
8. Antes de **cada commit** rode e deixe verde: `npx tsc -p tsconfig.json --noEmit`, `npx eslint <pastas tocadas>`, `npx vitest run <pastas tocadas>`, `node scripts/check-boundaries.mjs`. Ao fim de cada **fase** rode `npm run check` inteiro.
9. Commits pequenos, um por passo (`feat(unidades): U1 ...`). Depois de cada commit: `git push -u origin claude/fervent-newton-rfgz3y` (se falhar por rede, repita até 4 vezes: 2s, 4s, 8s, 16s). Isso protege o trabalho se o PC reiniciar.
10. Atualize `docs/plano-unidades-cotas/PROGRESSO.md` (marque `[x]`, escreva desvios e bloqueios) **no mesmo commit** do passo.
11. Se travar num passo por mais de 3 tentativas: escreva `BLOQUEIO <id>: <causa>` em `PROGRESSO.md`, faça commit, e siga para o próximo passo que não dependa dele. Não fique em laço.
12. Não mexa em `SCHEMA_VERSION`, `package.json` (exceção: no passo C0, acrescentar `&& node scripts/check-units.mjs` ao script `lint`), `docs/paridade/ORDEM.json`, `docs/07-STATUS-V1.md`.
13. Fórmulas e valores numéricos de engenharia: não "chute". Se não sabe, leia o código vizinho e os docs citados.

## 3. Decisões do dono (não rediscutir)
- Unidades são **configuração do projeto**, em Propriedades → **"Padrões do projeto"**, com botão **"Unidades…"** (mesmo estilo do "Editar níveis…") que abre um diálogo.
- Referência das cotas também é configuração do projeto, botão **"Cotas…"** ao lado, e troca rápida na barra de opções da ferramenta e clicando na alça (linha de chamada) da cota.
- Referência de **parede**: `eixo`, `face acabada`, `núcleo (eixo do núcleo)`, `face do núcleo`. Referência de **abertura** (porta/janela): `centro`, `vão livre`, `vão externo do batente`, `com alizar`.
- Sistema de cotas **único e reaproveitável**: adicionar a cota dinâmica a uma ferramenta nova (ou esquecida) deve custar poucas linhas (um provedor + registro).
- Cotas dinâmicas aparecem **ao colocar e ao selecionar** (parede, linha, porta, janela, eixo, piso, laje, telhado, mover/copiar). Clicar no valor, digitar e Enter **reposiciona** o elemento. Elemento hospedado **não pode sair da parede**: alerta e nada muda.
- Batente da porta/janela acompanha a **espessura acabada da parede** (padrão) com opção de **espessura do núcleo**, para paredes de todos os tipos e para janelas.
- Estilo visual como o Revit: linhas de chamada com tracinho, texto azul editável, alças, ícone "I" converte em cota permanente.

## 4. Ordem das fases (siga a ordem; cada fase termina com `npm run check` verde e push)
| Fase | Arquivo | Resumo |
|---|---|---|
| A | `01-unidades.md` | Serviço de unidades (model), configuração no projeto, hook web, `NumField` por grandeza |
| B | `02-padroes-do-projeto-ui.md` | Diálogos "Unidades…" e "Cotas…" em Padrões do projeto |
| C | `03-migracao-dos-usos.md` | Migrar TODOS os usos soltos para o serviço, com trava (`check-units`) |
| D | `05-correcoes-e-batente.md` | Batente = espessura acabada; prévia com a porta real; Espaço/Tab; alças de inversão; planta do modal |
| E | `04-sistema-de-cotas.md` | Referências, resolvedores, provedores, sobreposição única, edição, validação, alças, cota permanente |
| F | `06-validacao-final.md` | Suíte completa, build, e2e, revisão cruzada, documentação |

A fase D (correções) é independente de A–C e pode ser antecipada se A travar. A fase E **depende** de A (formatação) e de D (batente/prévia).

## 5. Como reportar
Ao fim de cada fase, escreva em `PROGRESSO.md` um resumo de 5 linhas (o que mudou, arquivos principais, resultado de `npm run check`, desvios, pendências) e faça push. No final, responda ao dono em português com o resumo total.

## 6. Arquivos deste plano
`00-LEIA-ME.md` (este), `PROGRESSO.md` (lista de passos para marcar), `01-unidades.md`, `02-padroes-do-projeto-ui.md`, `03-migracao-dos-usos.md`, `04-sistema-de-cotas.md`, `05-correcoes-e-batente.md`, `06-validacao-final.md`.
