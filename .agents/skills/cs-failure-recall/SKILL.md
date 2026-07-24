---
name: cs-failure-recall
description: Recall log-first failure rules and locate an exact failure signal in catering-v2s.
---
# cs-failure-recall

Run `scripts/context/recall-failure --query '<exact failure signal>'`, reopen every returned memory/source path, then inspect the run-scoped manifest and logs. Before a second attempt at the same signal, identify first failure, last known good phase and broken boundary. Never substitute timeout growth, polling or magic waits for diagnosis.
