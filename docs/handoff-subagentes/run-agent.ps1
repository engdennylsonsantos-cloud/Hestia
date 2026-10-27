param([string]$Id, [string]$Wt, [string]$Task = '')
if (-not $Task) { $Task = $Id }
$sp = '<usuario-local>\AppData\Local\Temp\claude\<projeto-local>\6f989fe3-5519-4857-8a85-4d2c46004763\scratchpad'
$dir = "<pasta-local>\$Wt"
# Regra do opencode: a ultima regra que casa vence, entao o "*":"deny" vem primeiro.
$env:OPENCODE_PERMISSION = '{"edit":"allow","read":"allow","external_directory":{"<usuario-local>\\AppData\\Local\\ms-playwright\\*":"allow"},"bash":{"*":"deny","npm *":"allow","npx *":"allow","node *":"allow","git add *":"allow","git merge *":"allow","git commit *":"allow","git status*":"allow","git diff*":"allow","git log*":"allow","ls*":"allow","cat *":"allow","grep *":"allow","rg *":"allow"}}'
$env:CHROME_PATH = '<usuario-local>\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe'
Set-Location $dir
$msg = "Execute a tarefa descrita nos arquivos anexos (regras comuns + tarefa $Task), ate o fim, e termine com o RELATORIO FINAL."
opencode run $msg -m opencode-go/deepseek-v4.1-flash --dir $dir --title "perim-$Task" -f "$sp\prompts\common.md" -f "$sp\prompts\$Task.md" *> "$sp\run-$Task.log"
