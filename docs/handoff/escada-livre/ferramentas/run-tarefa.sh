#!/bin/bash
# uso: run-tarefa.sh <nome-do-worktree> <arquivo-da-tarefa> <log> [anexos extras...]
WT=$1; TASK=$2; LOG=$3; shift 3
BASE=/c/Users/Dennylson/Desktop/programas/Hestia
DIR="C:\Users\Dennylson\Desktop\programas\Hestia\wt\\$WT"
export OPENCODE_PERMISSION='{"edit":"allow","read":"allow","external_directory":{"C:/Users/Dennylson/Desktop/programas/Hestia/Hestia/node_modules/*":"allow","C:/Users/Dennylson/AppData/Local/Temp/claude/*":"allow"},"bash":{"*":"deny","npm *":"allow","npx *":"allow","node *":"allow","git add *":"allow","git commit *":"allow","git status*":"allow","git diff*":"allow","git log*":"allow","git show *":"allow","git branch*":"allow","git ls-files*":"allow","sed -n *":"allow","find *":"allow","sort *":"allow","diff *":"allow","ls*":"allow","cat *":"allow","grep *":"allow","rg *":"allow","head *":"allow","tail *":"allow","wc *":"allow"}}'
ARGS=()
for f in "$@"; do ARGS+=(-f "$f"); done
cd "$BASE/wt/$WT"
opencode run "Execute a tarefa descrita no arquivo anexo até o fim e termine com o RELATÓRIO FINAL. $EXTRA" -m opencode-go/deepseek-v4.1-flash --dir "$DIR" --title "$WT" -f "$TASK" "${ARGS[@]}" > "$LOG" 2>&1
echo "EXIT $?" >> "$LOG"
