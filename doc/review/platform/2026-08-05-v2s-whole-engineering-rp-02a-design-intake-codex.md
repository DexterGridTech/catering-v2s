# RP-02a DESIGN Round 1 独立审查处置

REVIEW_CYCLE_ID=WHOLE-ENGINEERING-RP-02A-DESIGN-20260805
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
independentReport=doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round1.md
independentReportSha256=8a0407c8ab26e2b8c183612862b5d75ba13c4857c75ef9b4e36a89f3e90498e0
authorMaterialReadAfterIndependentVerdict=true

## 辩证处置

### M-001 CONFIRMED

当前详设把 121→154 描述成 catalog 直接替换，却没有把 projectEdgeCatalog、R24 error augmentation、P3C query/component projection 与 materialize/codegen 对账纳入 owning source。修复方向采用直接 materialize 当前 generator projection 的结果，使 source catalog、placement/report、root gate 和 generated output 共用一份 154 条具体记录；同时给 projection 增加显式 MATERIALIZED 幂等状态，避免二次展开，并迁移 add/remove error augmentation、移除退役 component baseline、保留 P3C component/query 语义。focused proof 必须包含 edge-codegen --check 与 r5-edge-materialize --check，以及 projected/source/report exact equality。

### M-002 CONFIRMED

getOperationsOrganizationHierarchyExtensionDefinition 的 owner 不是 OperationsOrganizationHierarchyController，而是 OperationsOrganizationExtensionController.hierarchyDefinition。详设、manifest、source reread 与十条 fact 的 owner chain 全部改为实际 controller，并纳入 operations workspace-access/organization-hierarchy OpenAPI、ExtensionDefinitionService 与 controller 的 exact hash。

### M-003 CONFIRMED

manifest 的 implementation-source-reread-discipline.md anchor 使用了不存在的中文标题。修复为当前唯一 heading # Implementation source reread discipline，刷新 manifest hash，并在 Round 2 重新运行 granularity checker。

### S-001 CONFIRMED

projectId 的 forbidden denominator 是四个 create body：diagnostic store、diagnostic contract、platform-admin fixture store、platform-admin fixture contract；不是三个。修复将四处路径/行锚点写成有限条目，并把允许的 query/read 集合按 operationId、调用点与 OpenAPI path 参数登记，focused proof 做 forbidden set 与 allowed set 双向 exact equality，继续禁止 broad grep 或删除合法 scope state。

### S-002 CONFIRMED

crosswalk 证据必须逐行携带 154 条具体 operation 的 operationId、method、path、face、owner、request/response schema、query/path metadata、error base/augmentation、scenarioIds、proof refs 与 source refs；另列 42 registry-only、9 generic catalog-only 的 replacement rows，并由机器断言与 registry、placement、materialized catalog/report、facts exact equality。只做 ID 算术不足以收口。

### N-001 / N-002 RETAIN

保留 operations password recovery 的 start/send/verify/complete 四步与 public invitation 七步分离；保留 static-only、不启动 runtime/HTTP/L2/seed/reset、不从 route 推导 fact、D4/RP-02b deferred 的边界。

## Round 2 进入条件

在同一 cycle 的 Round 2 前，作者会完成上述 design/manifest/input fresh hash 更新，运行 scripts/check/standards-coverage --phase R5、granularity checker self-test 与带报告的 checker，并让同一 independent subagent 只针对 M-001/M-002/M-003/S-001/S-002 定向复核。此 intake 不授权任何 production implementation、contract/generated wire change、database/migration、DEV/UAT、HTTP/L2、seed/reset 或 Git 操作。

---

# RP-02a DESIGN Round 2 独立审查处置

REVIEW_CYCLE_ID=WHOLE-ENGINEERING-RP-02A-DESIGN-20260805
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
independentReport=doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-independent-review-round2.md
independentReportSha256=799ebde236c523e5617bc10f52177161468e01025e000d071fe13d522b6ef415
manifestSha256=a9d28f65154b4ea5e7c37ccf287cf7bff3365b28a19841168a047a7ec8762867
designSha256=1b59e62ba838886e12c2eb2d22ac644ec58c23204e38f3349fa87ac310f09fd7
reviewInputSha256=67677947e66d501e2d6103dd36c152df7e999978cf2e96626477cfd4ee8f4aff
authorMaterialReadAfterIndependentVerdict=true
independentVerdict=GO
severityCounts=M=0/S=0/N=6

## Round 2 辩证处置

Round 2 未发现新的 M/S finding。N-001 至 N-006 均为已关闭设计约束的保留提醒：projection-owned metadata 与 MATERIALIZED identity readback、实际 hierarchy extension owner、source/hash fail-closed、projectId 四个 body + 五个不支持 query 的有限集合与三个契约声明 query、154 行语义 crosswalk、四步 recovery/七步 invitation 与 static-only 边界。全部保留为实施期 evidence/review checklist，不改变当前设计范围。

独立 reviewer 已确认：registry/placement/catalog/facts 分母、projection/codegen/materialize 静态检查、standards coverage、manifest anchor/hash、owner source 与 recovery 顺序均可复算；granularity checker 为 `PASS UNITS=1 FINDINGS=6 VERDICT=GO REVIEW_ROUND=2 REVIEW_BINDING_MODE=EXACT_REVIEWED_MANIFEST`。

本 intake 仅记录作者对独立 Round 2 findings 的处置，不代替独立 verdict；它不授予 production implementation、contract/generated wire、backend/database、DEV/UAT、HTTP/browser L2、seed/reset、business/cleanup PASS 或 Git 权限。下一闸门是 RP-02a implementation package 的独立 implementation review 与 Claude design GO。
