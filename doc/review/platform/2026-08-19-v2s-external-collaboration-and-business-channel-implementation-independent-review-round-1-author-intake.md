REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_IMPLEMENTATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerVerdict=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-verdict.md
authorIntakeStatus=REPAIRED_AWAITING_ROUND_2

# R5 外部协作与经营渠道实施独立审查 Round 1 · author intake

## Intake boundary

本 intake 由作者在独立 reviewer verdict 之后形成。每条 finding 都重新打开对应的原始 Journey/IA/详设、owning source 与可复现静态证据；没有把静态 PASS 当作运行时 PASS，也没有执行 seed、reset、DEV、Testcontainers、browser L2、UAT 或外部联调。六项 C 继续依赖态，尤其不因 F-07 自行决定 C-04 的最终失败解绑语义。

## Finding-by-finding disposition

| finding | intake | 根因与最小处置 | 产品/权限裁决 |
| --- | --- | --- | --- |
| F-01 | CONFIRMED → REPAIRED_STATIC | P6 的 `COMMERCIAL_GROUP`/`REGION` 与 `EXTERNAL_BINDING` 已贯通现有 platform organization candidate API：edge 白名单接受两种 usage，organization owner read 覆盖 `COMMERCIAL_GROUP`、`REGION`、`PROJECT`、`HEAD_COMPANY`、`STORE` 五类真实投影，沿用统一分页/筛选/selectedId 语义；未新增候选接口。backend `compileJava` 与 `compileTestJava` PASS；新增 controller/service regression tests 已编译，但 app/module test 在方法执行前被 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` 守卫拦截，不能宣称动态或测试 PASS。 | 不需要新裁决；不得把 bindableNodeTypes 当授权。 |
| F-02 | CONFIRMED | page registry 与 shell 仍按无 ref 的静态 segment 精确匹配，已接受的 project/store 深链无法命中，页面又从 ambient session 推 scope。改为现有路由抽象可解析的 ref-bearing route，并以解析出的 ref 形成 query context；保留 session/owner recheck。 | 已接受 Journey 已定形，不是默认产品选择。 |
| F-03 | CONFIRMED | OpenAPI/owner 允许非 `DINE_IN` 的 `dineInForm=null`，edge 却用 `required(...)` 提前拒绝。移除 edge 的错误 required，仅保留 owner policy 的四维校验，并补 focused null regression。 | 不涉及 C 裁决。 |
| F-04 | CONFIRMED | 模板状态命令把资源 ref 当作唯一幂等键，目标状态变化后 hash 必变而 key 不变。按命令语义加入目标状态，保证同一命令重试相同、反向状态切换不同；不放宽 receipt conflict。 | 不涉及 C 裁决。 |
| F-05 | CONFIRMED | binding update edge 只检查 channel/binding 关联，不检查 channel status；UI 也对 disabled channel 暴露维护入口。服务端按 owner 状态先拒绝，UI 同步置灰/解释，保留 owner 最终裁决。 | 不涉及 C 裁决。 |
| F-06 | CONFIRMED | disabled channel 无条件显示恢复草稿，但 stop reason 尚存时 owner 必拒绝。只在无 stop reason 且 owner 允许的条件下渲染/启用恢复动作，并显示 typed 失败语义，不做客户端绕过。 | 不涉及 C 裁决；恢复最终仍由 owner 判定。 |
| F-07 | CONFIRMED（保持依赖态） | C-04 未定的 `UNBINDING` 被提前公开到 source/published schema/generated type。移除未决状态的公开承诺与生成残留，不新增替代状态机；保留 C-04 `[未定]` 和停止规则。 | C-04 仍需 Dexter 将来裁决；本修复不替其定案。 |
| F-08 | CONFIRMED | O2 provider query 没有随 order kind/capability 变化，且候选卡片不展示 governance facts。复用 collaboration candidate read，传入批准的 capability/order filter，依赖变化时清空重查，并展示已批准的认证/节点类型信息。 | 不扩大 provider 规则；`PLANNED` 仍不是 enablement gate。 |
| F-09 | CONFIRMED | OwnerBindingView 只有 type/ref，P4/P5 无业务节点名称；UI 无任务型 lookup。复用组织任务 path/read 能力，以 nullable display facts enrich readback，不能把 UUID 变成用户操作值。 | 不改变 owner fact；只补读模型。 |
| F-10 | CONFIRMED | 表单在 `EXTERNAL` 下保留 `DINE_IN`，只 alert 不阻断，提交才由 owner 拒绝。按已接受清理规则在 access/order kind 变化时联动清空或禁用不相容值，保持 owner typed validation。 | 不涉及 C 裁决。 |
| F-11 | CONFIRMED | 新增两个 scoped page 后，operations-admin 既有 scope denominator 测试仍是旧列表。更新测试分母并保留 exact page keys，避免删掉回归断言。 | 不涉及产品裁决。 |
| F-12 | CONFIRMED | seed plan 只有 template/binding 关系，未声明三条实际 channel 与万象城海底捞的 channel shape。扩展静态 plan 的 channel entities、三条 channel 关系及 POS/QR/KIOSK 事实，validator/executor 只验证声明，不执行 seed。 | 不改变 runtime 或 C-03；channelCode 继续待生成/未决。 |
| F-13 | CONFIRMED | runtime child idempotency key 直接嵌入 `R5`/Journey 词汇，违反能力命名边界。改成能力/动作名，不变更幂等语义。 | 不涉及产品裁决。 |

## Author conclusion

F-01 至 F-13 的 finding 均已逐条确认；F-01 至 F-13 当前均有对应的静态修复或静态保持证据，且没有 `REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE` 被用来掩盖源码缺口。F-07 的修复只撤回未决语义的公开承诺，不代表 C-04 已裁决。F-01 的 edge/owner chain 已通过编译与静态 gate，但新增测试受动态 Testcontainers 守卫限制未执行，因此 Round 2 必须复测该链而不能只复核契约字面量。

## Post-Round-1 repair intake

| finding | current disposition | static recheck / boundary |
| --- | --- | --- |
| F-01 | `CONFIRMED_REPAIRED_STATIC` | `PlatformOrganizationOverviewController`、`StoreCandidateTaskReadService`、generated enum/source OpenAPI 与 platform form 已逐点复读；backend compile/test-compile PASS；Gradle test 在执行前被 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` 拦截。 |
| F-02 | `CONFIRMED_REPAIRED_STATIC` | operations deep routes、page registry/shell match 与 route trace 复读；frontend architecture/UI trace PASS。 |
| F-03 | `CONFIRMED_REPAIRED_STATIC` | non-`DINE_IN` null 语义在 edge/owner 与 focused source assertions 中保持；backend compile 与 business-channel focused static scope PASS。 |
| F-04 | `CONFIRMED_REPAIRED_STATIC` | project template idempotency key 已包含 target status，未改变 receipt conflict 语义。 |
| F-05 | `CONFIRMED_REPAIRED_STATIC` | disabled channel binding update 被 typed policy 拦截，UI maintenance surface 置灰；backend compile 与 boundary gates PASS。 |
| F-06 | `CONFIRMED_REPAIRED_STATIC` | disabled restore draft 依 stop reason/owner policy 控制，未添加客户端绕过。 |
| F-07 | `CONFIRMED_REPAIRED_STATIC_WITH_C04_PENDING` | source/published/generated public `UNBINDING` 已移除；C-04 仍未定，不生成替代状态机。 |
| F-08 | `CONFIRMED_REPAIRED_STATIC` | provider candidate query 已带 capability/order context，`PLANNED` 仍是候选事实而非 enablement gate。 |
| F-09 | `CONFIRMED_REPAIRED_STATIC` | platform binding readback 经 organization task-path presentation read enrich `nodeDisplayPath`，UUID 不作为用户操作值。 |
| F-10 | `CONFIRMED_REPAIRED_STATIC` | `EXTERNAL` 与 `DINE_IN` 不相容状态在 UI 联动清理/禁用，owner typed validation 保留。 |
| F-11 | `CONFIRMED_REPAIRED_STATIC` | operations required-scope denominator 已覆盖两条 deep page，frontend unit scope 已通过。 |
| F-12 | `CONFIRMED_REPAIRED_STATIC` | 本域 seed plan/executor 仅声明输入与验证；14 场景、万象城海底捞三渠道、POS/扫码/自助机与五类绑定覆盖静态自检 PASS。 |
| F-13 | `CONFIRMED_REPAIRED_STATIC` | runtime idempotency key 已去除 Journey/R5 词汇，能力命名 gate PASS。 |

Round 1 修复后授权范围静态 gates：edge-codegen、OpenAPI、operation-handler-bindings、external contract、edge materialize、capability、contract-face、query/backend/database boundaries、Flyway、module dependency、UI trace、logging、code layout、name-code density、production conformity、frontend architecture 均 PASS。未执行 seed、reset、DEV start/restart、Testcontainers、browser L2、UAT 或外部联调。

## Evidence status

当前：`REPAIRED_STATIC_AWAITING_ROUND_2`。

尚未取得动态 HTTP、真实数据库事务、browser L2、runtime logging 或 cleanup 证据；这些仍不在本批当前授权边界内。Round 2 需对 F-01 的实际候选链、F-02 深链、F-05/F-06 状态边界、F-09 task-path 展示与六项 C 依赖态做 fresh 定向核验。
