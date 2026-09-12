# 给 Claude 的 TER terminal admin console 详设与实施计划评审 brief

Dexter：请对以下 implementation-facing 详设与实施计划做独立设计评审。当前只评设计与计划，不实施、不构建、不运行。

## 背景与授权

需求正本是：

`doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md`

本批授权仅为“编写详设与实施计划”。未授权源码实施、生成契约、构建、Web、Android、native、focused runtime、DEV、seed、UAT、部署或 Git。请不要因为文档中出现实施步骤、测试路径或 evidence matrix，就把它理解成实施授权或已取得证据。

需求由两版 POC 分析、Dexter 十轮裁定和作者自组织盲审处置形成；作者盲审不构成对你的独立性。此前四轮独立/对抗复核均为 NO-GO，旧结论只作为待重验输入。不要采信作者自报的“全覆盖、零悬空、所有红夹具”数字，自己重新枚举。

## 本次输入

请按以下顺序读取当前字节：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、适用 Roadmap 授权字段、`project-memory/index.md`、命中的项目记忆、`scripts/README.md`；
2. 需求正本全文，尤其版本沿革、§9、§9.2、§11.3–§11.5；
3. `doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md` 及其点名的 POC，只读；
4. `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`；
5. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`；
6. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`；
7. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md`；
8. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md`；
9. 详设 §9b 所列 owning source；不要只读需求事实表。

设计 bundle 当前状态是 `PROPOSED_BLOCKED_FOR_DEXTER_WIREFRAME_REVIEW`，`IMPLEMENTATION_AUTHORITY=false`，两轮 fresh 独立设计盲审尚未运行。Journey、IA、交互工件中的可见文案/布局是 draft，不是 Dexter 已批准的视觉正本。

## 评审问题

请先判断方案是否解决用户真实问题，以及是否有更小方案；不要只验闭环。重点重验：

- 五层顺序是否正确：形态来源 → 系统键盘原子退役/契约 → 设备标识/调试态 → vendor/primitives/加载态/动态切换 → admin-shell/三节/注入 section；焦点前置探针在第 3 步，完整 A-15 在第 8 步之后；
- `isHostPrimaryDisplay` 是否端到端来自物理显示索引，且 host source 也按物理索引，画布仍按 `displayMode`；Web 和 host snapshot 未就绪中间态是否写清；
- `containerKeys=[]` 的 layer part 与 `admin.sections` section part 是否已有可实施的选择/渲染契约；是否真的只有一个 catalog；
- `selectAvailableParts`/`resolvePart`、LayerStack、SurfaceContext、sample assembly、dev-host 的调用链是否能落实，不是只加字段；
- 设备标识是否为启动期一次 `getDeviceInfo` + 同步纯函数；方法级 capability 是否在非 DEV 构建仍有来源；
- 系统键盘退休是否覆盖公共 prop、vendor、input invariants、render snapshot 的同一原子组；真值表是否比恒真几何判据更强；
- debug 是否能表达 PROD 包调试态，且不是 `__DEV__`/`EnvironmentMode`；降级口令两侧是否都验；
- 动态画布切换是否真正规定并可观测几何、console、焦点、滚动的去留；承载未就绪是否明确为 loading 而非门禁；
- sample-console 注入 section 是否确实是生产 `definedParts`/同一 catalog 消费者，A-18/A-20 是否不能被测试夹具自证；
- 登录、切换、关闭、再次打开是否都由真实动作节点完成；测试 ID 是否挂真实控件而非 wrapper/直接 setter；
- 详设 §3 固定横切机制表、§7 机制行、§9a 全量同步矩阵、§13b 阶段/整体三维对账、计划 §12 逐代码对账是否都可执行；
- A-1 至 A-59 是否逐项重新枚举并有可证伪红夹具；§9.2 停放项是否有行为义务被错误停放；
- static、focused、Web、Android、native、release、visual 证据是否严格分档。

## 输出格式

每条 finding 必须给：

```text
ID
STATUS=CONFIRMED | PARTIALLY_CONFIRMED | REJECTED_WITH_EVIDENCE | UNVERIFIED_REQUIRES_EVIDENCE | DEXTER_DECISION
SEVERITY=M | S | N
仓根相对路径 + 行号或唯一符号
失败场景（优先给恶意但合规实现）
影响面
最小修复方向，并说明为何更小修复不够
是否需要 Dexter 裁决
证据档位
```

最终给 `GO` 或 `NO-GO` 与 `M/S/N` 计数；另列“被推翻的作者结论”和“详设/计划仍漏掉的问题”。不要把历史 review GO、欢迎语文本完整、focused test 或静态结果扩写成完整视觉验收 PASS。

本文件只是可复制的评审话术和输入清单，不是已完成的独立评审。

