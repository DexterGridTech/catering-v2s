# Claude Review Brief：RP-02a implementation-facing 详设

Dexter，请 Claude 对 RP-02a 的 implementation-facing 详设做独立设计复核。该 brief 只请求设计 verdict，不请求实现、运行环境或仓库控制动作。

## 背景与目标

全工程 merged review 已确认 generated route-face registry 已为 154（platform 50 / operations 92 / public 12），但手写 diagnostic facts 仍 144、source catalog 仍 121（projection 后应为 154）、历史测试仍有 147/146/130，store/contract create body 仍发送 owner schema 已删除的 `projectId`，并且 operations recovery 与 public invitation 的步骤分母曾混淆。

RP-02a-U01 的目标是恢复同一根因下的静态契约消费者闭环：

- 154 registry tuples = 154 placement rows = 154 具体 source-backed facts/dispositions；
- 以现有 `projectEdgeCatalog` 的 R24/P3C 投影为唯一语义扩展路径，将 154 具体 catalog 结果 materialize 回 source catalog，并让已 materialized source 的 projection identity readback 保留 error augmentation、component baseline/override 与 query narrowing；
- 只从四个 store/contract create request body 删除 `projectId`，同时从五个不声明该 query 的 operations workload 调用移除 `projectContext()` 注入；保留一个当前 platform overview outbound query、三个 OpenAPI 明确声明 `projectId` 的 operation，以及 `PROJECT_SCOPE`/`SCOPED_STORE_FACTS` 内存 scope；
- operations password recovery 精确为 start/send/verify/complete，public invitation 七步保持独立；
- 静态证据必须有 crosswalk 154 语义行、42 registry-only 与 9 catalog-only replacement rows、双向 exact equality、真实 red mutation 与增量 hook receipts。

## 必读材料（仓根相对路径 + 当前 SHA-256）

1. `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` @ `16b9991ca368eeaf8791271cbab7273cb7958d60d95e78ad1ac2513c4a5f0f3d`
2. `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` @ `50f1b3004566599971420320d95dd0e5db0f27a910a911332bc9b07cd6f83d62`
3. `doc/decisions/2026-08-05-v2s-rp-02a-contract-consumer-recovery.md` @ `e87332a52b4912dd14f03e96df2bc6f131817385f510c50ba0c16d1b045b125e`
4. `doc/decisions/2026-08-05-v2s-rp-02a-implementation-authorization.md` @ `89aac5f0e3ebe862598bfc61a364fccbe72ea1293a387b2531fd4c3ade663c62`
5. `doc/plans/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-design.md` @ `1b59e62ba838886e12c2eb2d22ac644ec58c23204e38f3349fa87ac310f09fd7`
6. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-granularity-manifest.json` @ `a9d28f65154b4ea5e7c37ccf287cf7bff3365b28a19841168a047a7ec8762867`
7. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-input.md` @ `67677947e66d501e2d6103dd36c152df7e999978cf2e96626477cfd4ee8f4aff`
8. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round1.md` @ `8a0407c8ab26e2b8c183612862b5d75ba13c4857c75ef9b4e36a89f3e90498e0`
9. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round2.md` @ `799ebde236c523e5617bc10f52177161468e01025e000d071fe13d522b6ef415`
10. `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-intake-codex.md` @ `b98dfcd47902ec6312100f110849d9e181828c3c910d2da5ccb938f69765acc7`
11. `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` @ `1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824`
12. `doc/evidence/platform/r5-u01-edge-placement-resolution.json` @ `251d54c685f299d12410378d0664b79ce15476d79dca35dbfea9f45a92d21b27`
13. `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` @ `81d7c84aa77c0f0787b3fc7fea6407d79995dde391105e9ac5616bf9b3eff723`
14. `scripts/generate/edge-operation-projections.mjs` @ `575dc2e198393946bb6f9d9931e88c0c79719971de4690a2b2e115d982bad761`
15. `scripts/generate/edge-codegen.mjs` @ `176fc90d04a876a456b882e5d7c059d65decaed10932ba36ad37ae5210d84529`
16. `scripts/generate/r5-edge-materialize.mjs` @ `89b5d3197d1a2d327f95ebd3e1684dafb9bede8ffddc625da788394dfb02dbb4`
17. `contracts/openapi/paths/operations-admin/store-management.paths.yaml` @ `b008219b6332db0f95a11ee51f3c4b34eb3fcbd366711ac4499662bae51931f6`
18. `contracts/openapi/paths/operations-admin/contract-management.paths.yaml` @ `f4797339e35680f48f5a3668dc9746e8de6c0deb83bb6235d27263ac03509e2a`
19. `contracts/openapi/paths/platform-admin/organization-overview.paths.yaml` @ `75083b869a70268071ffe4f01b555da931ef84b15c50df497e4376557ff0aa8a`
20. `contracts/openapi/paths/platform-admin/contract-overview.paths.yaml` @ `b82dc1df4fc37cb8cc9b4f7f506cc164c4d916edde1077a9d79f6d0150f5def7`
21. `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationExtensionController.java` @ `4818653a7aebf2162b87fc89619eab5c97849e86bec7b08d179ccd265649ae5b`
22. `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java` @ `4d4e37679dc643fee7651f5095371958948203c552dcd7fe92df86b5eae54515`
23. `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java` @ `909e8e6877cf57e14b0843e8f9d5243c2e391303dc2c6b6e059f189dc961f633`

## 独立核验重点

请从源码和业务原材料重新判断，不把 Round 2 GO 当作替代证据：

1. projection materialize 方案是否真的保留 R24 add/remove error augmentation/selection、退役 component baseline 删除、P3C query/component narrowing，并且 identity projection 不会二次展开；是否存在更小而安全的替代。
2. 154-row crosswalk schema 是否足以约束 registry、placement、catalog、projected report、facts 的 exact equality，42/9 replacement rows 是否能防止 generic alias 假闭环。
3. hierarchy extension 是否绑定实际 `OperationsOrganizationExtensionController.hierarchyDefinition → ExtensionDefinitionService`，而不是 route 名称相近的 hierarchy controller。
4. projectId 的有限分母是否正确：四个 request body 禁止点、五个 unsupported workload query call sites、一个当前 outbound query、三个 contract-declared query operation IDs、两个 in-memory scope records；是否错误删除合法 scope 或遗漏 strict-parser 失败点。
5. 四步 operations recovery 与七步 public invitation 是否保持互斥；RM1 historical number removal、source-backed ten facts 与 static-only business/cleanup boundary 是否可执行。
6. 是否有过度设计、未闭合 source/hash、不可执行 red mutation、隐含 runtime/HTTP/L2 授权或把静态 PASS 冒充 business/cleanup PASS。

## 请交付

请在你回复中给出：

- `GO` 或 `NO-GO`；
- `M/S/N` 数量及逐条证据、风险、最小修复建议；
- 对 Round 2 independent report 的独立判断（可确认、部分确认或拒绝）；
- implementation-facing design 是否可进入静态 implementation package；
- 若 GO，列出必须保留的 N 级 implementation evidence；若 NO-GO，明确阻断点与不应提前实施的范围。

## 授权边界：

本次只授权 Claude 审查 RP-02a implementation-facing 设计，不授权任何 production implementation、契约或 generated wire 修改、backend/frontend/database 修改、DEV/UAT/runtime 启停、HTTP、browser L2、远端 Testcontainers、reset/seed、业务或 cleanup PASS、Roadmap 变更或 Git 操作。若设计 GO，后续仍需 Dexter 单独控制 implementation package，并重新进行 `REVIEW_TARGET=IMPLEMENTATION` 独立复核；Claude 本次不得直接改文件。
