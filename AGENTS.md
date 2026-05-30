<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CRITICAL WORK PROTECTION RULES
1. **NO DESTRUCTIVE ACTIONS ON UNSTAGED WORK:** Do NOT run `git checkout --`, `git reset --hard`, or any commands that discard modified/unstaged files without first asking the user or committing them.
2. **AUTOMATIC BACKUPS:** Always copy a file to a `.bak` version or run a git checkpoint commit (`git commit -am "checkpoint: ..."`) before performing substantial manual or automated changes on files modified by the user (especially `app/page.tsx`).
3. **CHECKPOINT ON DEMAND:** Whenever the user says "checkpoint" or "save", immediately commit all unstaged files so their progress is saved in git history.
