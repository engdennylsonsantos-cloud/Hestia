# Orquestrador: como executar o plano com 3 subagentes

Você é o **ORQUESTRADOR**. Você **não escreve código de produção**. Você cria os 3 subagentes (UNID, ESQ, COTAS), acompanha o progresso, relança quem ficou aguardando, resolve problemas de integração e entrega o relatório final ao dono.

## 1. Leitura obrigatória (você)
`00-LEIA-ME.md`, `07-DIVISAO-AGENTES.md` (papéis, marcos, propriedade, protocolo de integração) e os três `PROGRESSO-*.md`. Os prompts dos subagentes estão em `prompts/` (`comum.md` + um por papel).

## 2. Preparação do repositório
```bash
git fetch origin claude/fervent-newton-rfgz3y
git checkout claude/fervent-newton-rfgz3y
git pull origin claude/fervent-newton-rfgz3y
git worktree add ../hestia-unid  -b plano/unid  origin/claude/fervent-newton-rfgz3y
git worktree add ../hestia-esq   -b plano/esq   origin/claude/fervent-newton-rfgz3y
git worktree add ../hestia-cotas -b plano/cotas origin/claude/fervent-newton-rfgz3y
```
Em cada pasta nova: `npm ci`. (Se `git worktree` falhar, clone em pastas novas e faça `git checkout -B plano/<papel> origin/claude/fervent-newton-rfgz3y`.) Alterações locais não commitadas no repositório principal: `git stash` antes e avise no relatório.

## 3. Como criar os subagentes
Use o mecanismo de subagentes do seu ambiente (a ferramenta de tarefas/subagentes do opencode). Se não houver, inicie processos independentes, um por papel, como `docs/handoff-subagentes/run-agent.ps1` faz:
```text
opencode run "Execute o plano descrito nos arquivos anexos até onde for possível e termine com o RELATÓRIO FINAL." \
  -m <modelo> --dir <pasta-do-papel> --title plano-<papel> \
  -f docs/plano-unidades-cotas/prompts/comum.md -f docs/plano-unidades-cotas/prompts/<papel>.md > run-<papel>.log
```
Modelos: **UNID e ESQ → `opencode-go/deepseek-v4.1-flash`**. **COTAS → o modelo mais capaz configurado (Sonnet em esforço médio, se existir no seu opencode; senão o melhor disponível)**. Permissões de cada subagente: editar/ler arquivos, `npm`, `npx`, `node`, e `git` (`add`, `commit`, `merge`, `fetch`, `push origin HEAD:claude/fervent-newton-rfgz3y`, `status`, `diff`, `log`, `show`). Sem `push --force`, sem `git reset --hard`, sem `rm -rf`. Se `push` não puder ser permitido, os subagentes devolvem "PRECISA INTEGRAR <hash>" e **você** integra (seção 5).

## 4. Ordem de lançamento e laço de coordenação
1. Lance **UNID, ESQ e COTAS ao mesmo tempo** (os três têm trabalho independente no começo).
2. Quando um subagente terminar, leia o relatório dele e o progresso (`git fetch origin claude/fervent-newton-rfgz3y` e `git show origin/claude/fervent-newton-rfgz3y:docs/plano-unidades-cotas/PROGRESSO-<PAPEL>.md`).
3. Se ele terminou com **"AGUARDANDO <marco>"**: veja se o marco já foi liberado (linha `MARCO Mx LIBERADO` no progresso do dono). Se sim, **relance** o mesmo papel (mesmos arquivos de prompt; ele continua pelo progresso). Se não, espere o dono do marco terminar e confira de novo.
4. Se terminou por **limite de contexto/erro** com itens pendentes: relance o mesmo papel.
5. Se registrou **BLOQUEIO** ou **PEDIDO**: decida (você pode editar o arquivo pedido apenas se for mudança mínima, ou orientar o dono do arquivo relançando-o com uma instrução extra no prompt) e anote em "Desvios" do seu relatório.
6. Repita até os três progressos estarem completos (todos `[x]` ou BLOQUEIO justificado). O COTAS só executa a Fase F depois disso.
7. No máximo 3 subagentes simultâneos. Economize contexto: leia só relatórios e os arquivos de progresso, não os logs inteiros.

## 5. Integração e conflitos
- Cada subagente integra sozinho pelo protocolo do `07` seção 5. Você confere periodicamente que `origin/claude/fervent-newton-rfgz3y` compila: no repositório principal, `git pull origin claude/fervent-newton-rfgz3y`, `npx tsc -p tsconfig.json --noEmit`, `npx vitest run` (ao fim de cada marco rode `npm run check` completo). Se quebrou, descubra o commit (`git log`, `git bisect` manual), peça a correção ao dono do arquivo (relançando-o com a instrução) ou corrija você mesmo se for ajuste mínimo.
- Integrar por um subagente que não pode dar `push`: na pasta dele `git log -1`; na sua pasta de integração `git merge plano/<papel>`, verifique, `git push origin HEAD:claude/fervent-newton-rfgz3y`.
- Conflito de merge: nunca descarte o trabalho de um lado; mantenha as duas intenções, rode as verificações e registre.

## 6. Regras para você
- Nunca `push --force`, nunca PR, nunca merge em `main` nem em `integracao/telhados-grades` (só o dono decide).
- Não altere o plano sem necessidade; correção de erro do plano vai em commit `docs(plano): ...` e você avisa os subagentes ao relançá-los.
- Mantenha uma tabela viva no seu relatório: papel, passo atual, último marco, último hash, pendências.

## 7. Relatório final ao dono (português)
Fases concluídas e por quem; marcos; bloqueios e pedidos e como foram resolvidos; desvios; resultado de `npm run check` e `npm run build` no estado final de `claude/fervent-newton-rfgz3y`; o que o dono deve validar visualmente (batente, alizar, cotas, unidades `ft-in`); ações do dono (regravar baselines de imagem). Branch de entrega: `claude/fervent-newton-rfgz3y`.
