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

- `HERITAGE_READ_ONLY`: all-v2、all-v1、v4 与 v6 只读；`doc/heritage/registry.json` 登记的本仓冻结文件同样保持字节与 hash pin 不变。写治理同步清单前先与 `required-inventory.json`/`registry.json` 求交；若当前 accepted decision 已精确 supersede 冻结来源锚点，就在该 decision 或获准的新 successor 中表达现行规则，不原位改写冻结文件。未登记的当前来源文件仍须按其授权正常维护。
- `NO_RUNTIME_FALLBACK`: Heritage 不得成为 runtime 或 build fallback。
- `NEW_DECISION_FOR_DRIFT`: 旧来源漂移在 v2s 新增 decision 并引用原 path/hash，不回写旧仓。
