---
name: cs-code-structure-recall
description: Locate exact catering-v2s source symbols and references with provider-free fixed-string search.
---
# cs-code-structure-recall

Use `scripts/context/recall-code --query '<exact text>'`. Reopen every relevant source file and confirm with compiler/LSP when available. Search output is only a locator. Do not use global code indexes, semantic providers or generated architecture graphs as truth.

When a source file or package path is renamed, search the old path across production imports, tests, static checkers/mutation fixtures, generated consumers, and current README examples. Classify historical review/plan references separately; do not leave executable consumers pointing at the removed path. Close the move with the owning typecheck/test and any active checker that reads the path.
