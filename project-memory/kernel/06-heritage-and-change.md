---
id: kernel.heritage-change
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["HERITAGE_READ_ONLY","NO_RUNTIME_FALLBACK","NEW_DECISION_FOR_DRIFT"]
sourceRefs: ["AGENTS.md"]
---
# Heritage and change kernel

- `HERITAGE_READ_ONLY`: all-v2、all-v1、v4 与 v6 只读。
- `NO_RUNTIME_FALLBACK`: Heritage 不得成为 runtime 或 build fallback。
- `NEW_DECISION_FOR_DRIFT`: 旧来源漂移在 v2s 新增 decision 并引用原 path/hash，不回写旧仓。
