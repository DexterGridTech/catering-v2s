# TER screenPart 机型解析 · CP-3 三维对账（主 agent 兜底）

```text
REVIEW_TARGET=STEP_RECONCILIATION
SCOPE=CP-3 / A-3 pre-filter conflict admission and assembly surface-form selection
REVIEWER_KIND=MAIN_AGENT_FALLBACK
REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE
INDEPENDENT_SUBAGENT_REVIEW=FAILED_UNRESPONSIVE
INDEPENDENT_REVIEWER=Meitner
INDEPENDENT_REVIEWER_ID=01a0a958-7a3f-7000-bf67-8d541a1ec725
INDEPENDENT_REVIEW_PREVIOUS_STATUS=running
INDEPENDENT_REVIEW_FINAL_STATUS=shutdown
INDEPENDENT_REVIEW_ATTEMPTS=4 bounded waits plus finish/interrupt inputs
FALLBACK_EXECUTOR=MAIN_AGENT
VERDICT=MATCHED_FOR_CP3_SCOPE
```

## 为什么进入兜底

CP-3 已派发 fresh、只读、三维对账 reviewer。该 reviewer 在整个受控等待期间没有产生
状态、阶段或 verdict：四次 bounded wait 分别为 30s、30s、60s、60s，随后仍没有输出；
发送一次简短完成提示与一次 interrupt 后，`close` 返回 `previous_status=running`，最终
收到明确的 `shutdown`。没有把缺失输出伪造成独立 reviewer 的 `MATCHED`。

本记录按用户已立规则及项目记忆
`MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE` 接管同一 CP-3 范围：
保留真实 reviewer status 和失败边界，由主 agent 重新读取三维输入、逐项核验并明确标记
为主 agent 兜底；这不是 fresh independent verdict，也不扩展 CP-3 的范围。

## 三维输入与逐项回读

### 1. 需求维度

重读：

- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md` 的
  R-1/R-2（先对未过滤装配输入做同 `partKey` 的机型集合冲突检查，再按当前 `surfaceForm`
  过滤）、R-8（按可渲染行为证明零回归）、R-10a（后续真实 admin sibling 分母）、R-15/R-16
  的当前失败/就绪边界，以及 U-1/U-2/U-4b/U-7b/U-14。
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md`
  的 A-3 建造步骤、focused 集合、红夹具与 CP-4 延后边界。

核验结论：

| 需求点 | 当前源码/证据 | 结论 |
|---|---|---|
| 先冲突后过滤 | `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx` 的 `selectPartsForSurfaceForm` 在 `assertNoSurfaceFormOverlap(parts)` 后才 `filter`；`createConsoleAssembly` 先生成 `allParts` 再调用它 | MATCHED |
| 每种机型均能发现另一机型冲突 | `apps/terminal/ui/base/console-assembly/test/partSelection.test.ts` 用只在另一 form 重叠的 sibling，分别请求 laptop/mobile，验证过滤前抛错 | MATCHED（CP-3 合成 admission 分母；生产 R-10a 分母留 CP-4） |
| 过滤结果仍保持生产唯一性 | 同一 helper 过滤后执行 `assertUniquePartKeys`，随后才构造 UI/renderer catalog | MATCHED |
| 真实 integration 生产路径 | `sample-console/test/sampleAssembly.test.tsx` 与 `sample-wallpaper-console/test/sample2Assembly.test.tsx` 通过真实 assembly 入口验证 laptop/mobile；sample-console 的手搓 production-name catalog 已改为真实生产路径，剩余手搓用例明确是 non-production catalog unit | MATCHED |
| 跨机型 hydrated container | `sample2Assembly.test.tsx` 先用 laptop 真实 assembly 持久化 `sample.wallpaper-console.waiting` 的 SECONDARY `main` container，再用 mobile 真实 assembly hydrate；selector 无该记录且 sink 收到 `hydrated-container-not-renderable` | MATCHED |
| hydrated layer 不残留空遮罩 | `ui/base/render/test/layerStack.test.tsx` 直接挂载真实 `LayerStack`，current-form-unavailable layer 不产生 backdrop 或 stale layer 节点 | MATCHED |
| R-10a 八条 admin 输入与完整 U-14 | 需求与计划明确延后到 CP-4，当前不是 CP-3 的完成声明 | DEFERRED_TO_CP-4，不作为本步骤 OPEN |

### 2. 详设与 IA 维度

重读：

- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md`
  的 CP-3 决策、U-1/U-2/U-4b/U-7b 执行体、红夹具和 A-4 分母边界。
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md` 的
  IA-06 跨机型恢复规则：失效记录在 hydrate/prune 移除，不以默认覆盖；LayerStack 不产生
  backdrop/空层；单一 catalog 是 section/layer/container 的来源。
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp3-execution-codex.md`
  的 first failure、focused 结果、negative controls 和证据档位。

核验结论：

- `allParts -> selectPartsForSurfaceForm -> createUiCatalog/createRendererCatalog` 是单一
  assembly owner 路径，没有把 filter 下沉到 integration，也没有新建 `(partKey, form)`
  public index。
- overlap 检查覆盖空数组、非法值、重复值与同 key 的 pairwise form intersection；只在
  另一 form 产生 overlap 的夹具证明检查确实发生在 filter 之前。
- A-3 的新增 cross-form container 测试已经按计划经过真实 sample2 assembly，而不是手搓
  catalog；LayerStack 的结构性 render-tree 测试补足了只看 selector 的不足。
- sample-console 文件级 diff 非空仍符合 S-6 修复：U-4b 约束的是具名既有用例实现/断言，
  不是包含 D-1/D-10 手搓测试的整个文件。当前 A-3 没有改写计划点名的既有 layer
  admission/hydration 用例；新 LayerStack 用例是补覆盖，不替换既有护栏。
- CP-3 没有把 U-2 的最终生产 admin 八条分母、U-3 的组件分化或 mechanism whole-batch
  reconciliation 提前宣称完成；这些按计划留给 CP-4/机制批 gate。

结论：`MATCHED_FOR_CP3_DESIGN_AND_IA_SCOPE`。

### 3. 项目记忆与治理维度

本次回读的适用条目：

- `project-memory/operations/implementation-source-reread-discipline.md`：准备仅限当前
  变更点，focused proof 后回读 owning source 与设计片段。
- `project-memory/operations/verification-governance.md`：机器门只做机械判定；真实
  production red mutation；语义不能以字符串/台账冒充；focused 与动态证据分档。
- `project-memory/decisions/deterministic-context-only.md`：规则须绑定真实 gate/fixture，
  或标为 `UNENFORCEABLE_BY_MACHINE`；不恢复退役 compliance traceability 控制面。
- `project-memory/decisions/terminal-build-order-and-batches.md`：真实 import/assembly
  owner 决定批次，机制先于 admin 分化。
- `project-memory/pitfalls/claim-versus-behavior.md`、
  `project-memory/pitfalls/probe-narrower-than-criterion.md`、
  `project-memory/pitfalls/green-by-existence-check.md`：当前证据必须观察行为，不能以
  文件存在、测试名称或更窄的探针替代需求性质。

治理核验结论：

- CP-3 focused 命令实际通过，且包含真实组件行为/selector/render-tree 断言；没有把测试
  名称、退出码或路径存在性当作业务 oracle。
- 首次 typecheck failure 已在 CP-3 evidence 中保留，根因定位为 malformed test fixture 的
  类型边界，最小修复只作用于测试边界，修复后 focused 重验通过。
- native、Android、Web、visual、release 仍保持 OPEN；本记录没有把 focused 证据升格为
  任何动态/视觉结论。
- fresh reviewer 未能产出 verdict 已被显式记录；本记录没有冒充 `FRESH_INDEPENDENT_SUBAGENT`。

结论：`MATCHED_FOR_CP3_GOVERNANCE_SCOPE`。

## 反例与边界复核

| 反例 | 应红位置 | 当前状态 |
|---|---|---|
| 把 `allParts` 直接建 catalog | form-specific real assembly assertions | 已写入 CP-3 negative control；未改源执行 |
| overlap 检查放到 filter 后或删除 | 只影响另一 form 的 sibling overlap fixture | 已写入 CP-3 negative control；未改源执行 |
| 删除 container prune 或只在 A-2 手搓 nonexistent key | A-3 real sample2 cross-form hydration selector/diagnostic | 当前真实测试通过 |
| 删除 LayerStack 的不可用条目过滤 | `layerStack.test.tsx` 会观察到 backdrop/stale layer | 当前真实测试通过 |
| 把 CP-4 admin sibling 分母当作 CP-3 已完成 | CP-4 入口对账 | 明确标记 deferred，不伪造完成 |

## 主 agent 兜底结论

```text
CP-3_STEP_FOCUSED=PASS
CP-3_REQUIREMENTS= MATCHED
CP-3_DESIGN_IA= MATCHED
CP-3_PROJECT_MEMORY= MATCHED
CP-3_DEFERRED_CP4=EXPLICIT
CP-3_NATIVE_ANDROID_WEB_VISUAL_RELEASE=OPEN
CP-3_REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE
CP-3_VERDICT=MATCHED_FOR_CP3_SCOPE
NEXT_GATE=CP-4_ALLOWED
```

该结论只解锁计划中的 CP-4，不代表整批三维对账、implementation review、visual/native/
Android/Web/release 或整体 acceptance 已通过。
