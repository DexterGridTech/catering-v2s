# TER Admin console 非登录区详设与实施计划 · Claude review 处置记录

```text
REVIEW_TARGET=DESIGN
REVIEW_SOURCE=doc/review/platform/2026-09-20-ter-admin-console-non-login-implementation-design-review-claude.md
PRIOR_VERDICT=NO-GO
PRIOR_M/S/N=3/2/2
CURRENT_AUTHOR_STATUS=IMPLEMENTATION_IN_PROGRESS_OWNER_FOCUSED_GATES_CLOSED_DYNAMIC_PENDING
INDEPENDENT_ROUND2=doc/review/platform/2026-09-20-ter-admin-console-non-login-design-adversarial-review-round2-codex.md
IMPLEMENTATION_AUTHORITY=true
REVIEW_TIME_SOURCE_TEST_RUNTIME_WRITES=NONE
CURRENT_IMPLEMENTATION_STATUS=STATIC_AND_FOCUSED_OWNER_GATES_CLOSED
```

本文件前述 `REVIEW_TIME_SOURCE_TEST_RUNTIME_WRITES=NONE` 与第 2 节的 OPEN 表述记录本处置记录形成时的设计复评边界；后续实施状态以当前源码、focused 输出和 `doc/evidence/platform/2026-09-20-ter-admin-console-non-login-static-control-reconciliation-codex.md` 为准。当前三条 owner admission gate 已完成 focused readback 与真实 red mutation，动态验证仍未开始。

本记录只处置上一轮 Claude 的 findings，不改写历史评审结论，也不把文档修订宣称为源码修复、测试通过或实现验收。所有状态均以当前仓字节为准；本轮未运行构建、测试、Web、Metro、Android、设备或动态动作。

## 1. 处置结论

| finding | 当前判断 | 处置 | 仍需关闭的边界 |
| --- | --- | --- | --- |
| M-1 non-current surface 字段口径 | `CONFIRMED` | M-1 的目标口径已确定，详设/计划已按目标口径记录；需求 §1.4 登记了旧对称文案是文档漂移，high-fidelity IA/详设/计划保持不对称口径。requirements §5.4 与 frame inventory §5 的两处对称残留已修订并回读；当前语义口径不再保留该两处残留。frame inventory 是语义正本，high-fidelity 是同一 IA-ID 的视觉正本。 | 两处残留修订完成；不需要新增产品裁定。 |
| M-2 MASTER unpair 前置 | `CONFIRMED` | 未把文档修订冒充源码关闭。详设与计划新增 `MASTER_UNPAIR_GUARD` admission blocker：owner 必须以 typed `paired` 作为前置，成功清理 `masterLocator`、`peerIdentity`、`peerReachable` 并 readback；把守卫改回仅检查 `masterLocator` 的 focused red mutation 必须变红。CP-0/CP-1 在该门关闭前停止。 | Dexter 已授权进入实施，但该 blocker 仍 OPEN；不得把实现/测试状态写成 blocker 已关闭。 |
| M-3 Android theme 分母 | `CONFIRMED` | 详设、计划和 CP-0 扫描已纳入 `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors`、其公共 config test 以及两个 Android app 的 Tailwind 继承路径；删除 sharedColors mapping 的 red mutation 记为必红。 | 实施阶段实际 token mapping 与 config test 尚未执行；当前只完成设计/计划闭合。 |
| S-1 mobile 多 surface | `CONFIRMED` | 采用更小的复用修法：不新增 frame，`RUNTIME-M-SINGLE-SURFACE` 增加明确的 `display-facts-error` variant；仍为单列、单 selector、不生成 secondary 矩形，并写入需求、frame inventory、high-fidelity、详设和计划。 | 实施阶段需用 typed display-facts input 证明该 variant 可达；不能用 mock 结构断言冒充设备证据。 |
| S-2 IA_REF 优先级 | `CONFIRMED` | frame inventory 明确负责旅途、可见字段、状态、文案和动作；high-fidelity 明确负责同 IA-ID 的几何、颜色、图标、字体和视觉 token；高保真不得新增/删除/改写语义，冲突先修 IA。详设和计划均引用该规则。 | 后续实现对账必须同时读两份 IA；任一冲突保持 `OPEN`。 |
| N-1 `query-host` 归类 | `CONFIRMED` | action matrix 已写死：`query-host` 仅为 direct-pair 的 internal-only identity/protocol 细节，不生成用户按钮、IA-ID 或独立状态；`pair` 由 `pairByHost` 承接，`unpair` 两侧保留，`enable-host` 保留，`switch-role` 为资格-only/非本批。 | 具体 owner command 仍受 CP-0/CP-1 contract gate 约束。 |
| N-2 token 扫描分母 | `CONFIRMED` | CP-0 扫描已包含 `admin-*`、`sharedColors`、base Android config/test、两个 integration theme/Tailwind 和两个 Android app Tailwind。 | 实施阶段要让扫描和 config test 对实际 mapping 生效。 |

## 2. 当前 admission blockers

以下不是被文档修订“解决”的能力，而是实施开始前必须由 owner 关闭的门：

1. `DISPLAY_FACTS_OWNER`：逐 surface public read model 必须由 display-context/device owner 提供，不能从日志、当前 surface 或推导值补齐。
2. `TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`：topology owner 必须提供 page-level availability 与 direct `pairByHost`，UI 不得以 operation reason 或 raw facts 拼装。
3. `MASTER_UNPAIR_GUARD`：主机在 `peerIdentity` 表示已配对、`masterLocator` 为空的状态下必须能成功解绑，并清理三项事实后 readback。

在本处置记录形成时，上述三项没有对应源码、focused proof 和逐代码/详设对账，因此三条 admission blocker 仍为 OPEN。历史复评时的详设/计划状态曾是 `READY_FOR_REVIEW_WITH_ADMISSION_BLOCKERS` / `IMPLEMENTATION=NOT_AUTHORIZED`；Dexter 后续已明确授权进入实施。当前实现已形成 owner/readback/red-mutation focused 证据，但三条 admission blocker 仍为 OPEN；该证据不等于 Web、Android/native/device、真实视觉或 cleanup 通过，也不授权跳过动态批次边界。

## 3. 复评请求

请 Claude 只对当前字节复评上一轮七项处置，重点核对：

- 需求、frame inventory、high-fidelity、详设、计划是否都使用同一 current/non-current surface 分母；
- `MASTER_UNPAIR_GUARD` 是否被登记到 admission、owner contract、stop condition 与 red mutation，而没有被误报为已修复；
- Android `sharedColors`、公共 config test、两个 app Tailwind 继承路径是否都进入 mapping 分母；
- mobile 多 surface 是否明确为 IA-14/`RUNTIME-M-SINGLE-SURFACE` 的 typed `display-facts-error` variant；
- IA semantic/visual precedence、`query-host` internal-only classification 和 CP-0 scan scope 是否在文档间闭合。

复评请给出 `REVIEW_TARGET=DESIGN`、`GO`/`NO-GO` 与 `M/S/N`，并区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION`。本轮仍不授权源码、测试、依赖、构建、Web/Metro/Android/device、动态验证或 acceptance。
