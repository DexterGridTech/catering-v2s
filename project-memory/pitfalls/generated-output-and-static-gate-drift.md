---
id: pitfalls.generated-output-and-static-gate-drift
status: active
layer: routed
taskKinds: ["implementation", "testing", "review"]
domains: ["contract", "backend", "platform"]
consumerFaces: ["all"]
owners: ["backend", "platform"]
impacts: ["contract", "evidence", "architecture"]
triggers: ["implementation", "failure", "review"]
assertions: ["GENERATED_OUTPUT_MUST_FOLLOW_OWNING_SOURCE", "STATIC_TEXT_GATE_MUST_TRACK_REAL_SHAPE"]
sourceRefs: ["doc/plans/platform/2026-08-18-v2s-unified-list-pagination-implementation-design-codex.md", "project-memory/decisions/http-crud-efficiency-design-redlines.md", "project-memory/pitfalls/generated-output-and-static-gate-drift.md"]
---
# Generated output and static gate drift

- **失败模式**：生成的 OpenAPI/Java/TypeScript 与当前 owner 语义不一致，或 materializer 已经把源文件判为 drift；直接编辑 generated 文件或给 consumer 加 fallback 会把问题藏在下一次生成之后。
- **根因**：没有先确认 owning source 链；v2s 对 Heritage 的适配差异没有用 source catalog 的显式 override 表达，或者只更新了代码却没有重跑 materialize/codegen。
- **最小解**：先改 owning schema/catalog/override，运行受控 materialize，再运行 codegen；以生成检查、编译和现有业务 consumer proof 共同确认，不手改 generated 输出。
- **失败模式**：机械文本门把测试断言中用于检查禁用形状的字符串误认为生产 SQL，或者兼容集合仍保留已被合法删除的旧路径。
- **根因**：门的判定式是文本形状而不是语法树，同时 expected compatibility set 没有在源码变更后重新取数。
- **最小解**：保留门的真实不变量与 red self-test，调整测试断言的字符串构造以避免同一禁止 token 被误识别，并按当前源码重取兼容集合；不得通过删除门或放宽正则掩盖真实 SQL。
- **适用边界**：只适用于 source-bound generated chains 与明确采用文本扫描的静态门；不替代业务语义测试，也不允许把测试文本改写当成生产行为证明。
- **反例**：直接给 generated PublicInvitationView 补字段会在下一次 materialize 报 drift；把 SELECT * 的测试断言改成 SELECT 与星号的拼接后，测试仍检查同一 SQL 形状而门只命中真实 SQL。
