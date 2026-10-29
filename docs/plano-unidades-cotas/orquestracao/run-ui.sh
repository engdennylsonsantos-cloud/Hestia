#!/bin/bash
# uso: run-papel.sh <papel> <modelo> [instrucao-extra]
P=$1; M=$2; EXTRA=$3
BASE=/c/Users/Dennylson/Desktop/programas/Hestia
DIR="C:\Users\Dennylson\Desktop\programas\Hestia\hestia-$P"
REPO=$BASE/Hestia/docs/plano-unidades-cotas/prompts
export OPENCODE_PERMISSION='{"edit":"allow","read":"allow","external_directory":{"C:/Users/Dennylson/Desktop/programas/Hestia/hestia-antes/*":"allow","C:/Users/Dennylson/AppData/Local/ms-playwright/*":"allow"},"bash":{"*":"deny","npm *":"allow","npx *":"allow","node *":"allow","git add *":"allow","git commit *":"allow","git merge *":"allow","git fetch *":"allow","git push origin HEAD:claude/fervent-newton-rfgz3y":"allow","git status*":"allow","git diff*":"allow","git log*":"allow","git show *":"allow","ls*":"allow","cat *":"allow","grep *":"allow","rg *":"allow","head *":"allow","tail *":"allow","wc *":"allow"}}'
export CHROME_PATH='C:\Users\Dennylson\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe'
cd "$BASE/hestia-$P"
opencode run "Execute a tarefa descrita no arquivo anexo até o fim e termine com o RELATÓRIO FINAL. $EXTRA" -m "$M" --dir "$DIR" --title "plano-$P" -f "/c/Users/DENNYL~1/AppData/Local/Temp/claude/c--Users-Dennylson-Desktop-programas-Hestia/1467c624-59bb-4349-afe9-6e7151bdc7e6/scratchpad/ui.md" > "$BASE/run-$P.log" 2>&1
echo "EXIT $?" >> "$BASE/run-$P.log"
