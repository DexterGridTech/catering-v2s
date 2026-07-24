---
id: operations.roadmap-control-transfer
status: active
layer: routed
taskKinds: ["review","memory-recall"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["product","platform"]
impacts: ["roadmap","governance","heritage"]
triggers: ["session-start","status-question","cutover"]
assertions: ["PREPARED_IS_NOT_ACTIVE","ONE_STATE_OWNER","SOURCE_NO_POST_PASS_WRITE"]
sourceRefs: ["doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md"]
---
# Roadmap control transfer

- `PREPARED_IS_NOT_ACTIVE`: PREPARED target 不得被普通 resolver 当成 active。
- `ONE_STATE_OWNER`: 转移后只有 v2s Registry 解析出的一个状态 owner。
- `SOURCE_NO_POST_PASS_WRITE`: sourcePreparedHash 后不再写 all-v2 source Roadmap。
