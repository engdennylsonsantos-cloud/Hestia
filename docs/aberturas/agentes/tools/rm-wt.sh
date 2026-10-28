#!/bin/bash
# Remove uma worktree sem seguir as junções do node_modules (rmdir remove só o link).
W="$1"
WIN=$(cygpath -w "$W")
for e in "$W"/node_modules/* "$W"/node_modules/.[!.]*; do
  [ -e "$e" ] || continue
  if [ "$(basename "$e")" = "@hestia" ]; then
    for m in "$e"/*; do cmd //c rmdir "$(cygpath -w "$m")" >/dev/null 2>&1; done
    rmdir "$e" 2>/dev/null
  else
    cmd //c rmdir "$(cygpath -w "$e")" >/dev/null 2>&1
  fi
done
[ -e "$W/apps/web/node_modules" ] && cmd //c rmdir "$(cygpath -w "$W/apps/web/node_modules")" >/dev/null 2>&1
rmdir "$W/node_modules" 2>/dev/null
echo "restante em node_modules: $(ls -A "$W/node_modules" 2>/dev/null | wc -l)"
