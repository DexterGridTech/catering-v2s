---
name: cs-code-structure-recall
description: Locate exact catering-v2s source symbols and references with provider-free fixed-string search.
---
# cs-code-structure-recall

Use `scripts/context/recall-code --query '<exact text>'`. Reopen every relevant source file and confirm with compiler/LSP when available. Search output is only a locator. Do not use global code indexes, semantic providers or generated architecture graphs as truth.
