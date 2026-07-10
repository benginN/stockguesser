---
name: bengin-preferences
description: "How Bengin likes to work — language, deploy cadence, playtest-driven feedback"
metadata: 
  node_type: memory
  type: user
  originSessionId: 4d8a7ce1-90f3-43ff-a312-29df9926d782
---

Bengin (GitHub: benginN, git identity set repo-locally) communicates in Turkish (occasionally mixed with English); reply in Turkish. Not deeply technical about the stack — explain outcomes plainly, avoid jargon dumps.

**Why:** all session messages were Turkish; he tests the game as a player and reports UX findings ("palantir yazınca kabul etmiyor"), not code issues.
**How to apply:** push to `main` after every meaningful milestone so he can test on the live site immediately (he asked for this explicitly — "arada bir repoyu güncelle ki siteden test edebileyim"). When he reports a gameplay annoyance, treat it as a matching/aliases/data issue first, fix root cause, add a regression test, and extend `pipeline/data/aliases.json` liberally. He makes product calls quickly (e.g., GitHub-only forever) — offer a recommendation, not a menu. See [[stockguesser-project-state]].
