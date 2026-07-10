---
name: memory-sync-rule
description: Standing instruction — update memory on every change and mirror it into the repo
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4d8a7ce1-90f3-43ff-a312-29df9926d782
---

Bengin's standing instruction (2026-07-10): update memory **every time something changes**, and store the memory in GitHub too.

**Why:** he wants project knowledge to survive this machine and be visible in the repo he owns.
**How to apply:** whenever a durable fact changes (decision, gotcha, status milestone), in the SAME work batch: (1) update the local memory files, (2) mirror them to `.claude/memory/` inside the stockguesser repo, (3) include them in the next commit/push. Repo-canonical knowledge additionally lives in CLAUDE.md (conventions/decisions) and PROGRESS.md (session log) — keep all in sync. See [[stockguesser-project-state]], [[bengin-preferences]].
