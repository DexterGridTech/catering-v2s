# 正式需求两轮对抗审查 · 作者 intake 与证据边界

```text
AUTHOR=Codex
AUTHOR_ROLE=REQUIREMENTS_AUTHOR_AND_FINDING_INTAKE
AUTHOR_VERDICT=false
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_REQUIREMENTS_2026-10-02
REVIEW_ROUND_LIMIT=2
CYCLE_STATE=STOPPED_BY_DEXTER
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_AUTHORITY=false
```

## 1 · 对象、原始输入与权限

Dexter 授权：“好的，请根据需求讨论稿生成正式需求文档，并完成两次对抗性review”。

对象：`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`。
原始输入：同目录 `2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md`
§9.1～§9.14；其 §0/§7 为裁决导航，§8/§10 的作者分析不能代替独立核查。

冻结 SHA-256：`43c8c0b56fe009b42512fddbf2513e339483dc7f5daafee49998c4e044c78dfb`。
只生成正式需求与 review 文档，没有开始 Journey/交互/IA/详设/实施计划或源码实施。
正文 R-01～R-16、V-01～V-20 只规定目标；全部动态 NOT_RUN。

## 2 · 独立轮次与原文归档

| 轮次 | reviewer | 原文 artifact | 独立结果及状态 |
| --- | --- | --- | --- |
| R1 | `/root/activation_formal_requirements_r1` | `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-codex.md` | GO_WITH_UNVERIFIED_UI，0M/0S/0N；完整正文与 reviewer 自己的归档补充原样保存；completed |
| R2 无效输入尝试 | `/root/activation_formal_requirements_r2` | `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r2-invalid-attempt-codex.md` | NOT_ISSUED；主动报告输入越界并停止，completed；不算有效 verdict，也不称第三轮 |
| R2 replacement | `/root/activation_formal_requirements_r2_replacement` | `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r2-stopped-by-dexter-codex.md` | STOPPED_BY_DEXTER；停止前已发0/0/0结论摘要，完整报告/清单未返回；不称R2完整归档；对象SHA未改 |

R1 input checklist 在同目录 `2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-input-codex.md`。
R1 reviewer 在首轮 own artifact 补齐 blindReviewDeclaration、固定 verdict block 与实际补读记录；
这是归档补充，不改变对象、不增加 review 轮次。其协作边界补读完成时间和重申结论均来自 reviewer
自己的消息；不追认初次清单没有记录的阅读。

未把主 agent 的判断写成独立 verdict。第二轮 `ROUND_FINAL_DECISION=SELF_DECIDED` 只允许该
独立 reviewer 在自己的最终报告写入；作者不自判 GO、不重置 cycle、不召集第三轮。

## 3 · R1 辩证 intake

M/S/N finding 数量为零，无已确认需求错误、无需求修改点。下列是 R1 标记的后续设计接缝；
其归档补充明确它们不是正本缺少判据或当前 finding。主 agent 重开原条款/源码比对，不能因为
被命名为 DG 就自动增加恢复框架、权限或后台接口。

| 输入 | 作者核验与边界 | 最小处置及替代比较 |
| --- | --- | --- |
| DG-01 副机 HTTP operation/身份 | CONFIRMED_SOURCE_DELTA：`contracts/policy/terminal-client-generation.json` 目前仅 client 的 terminal-binding 目标；生成激活/取消不能被拿来代替副机业务 HTTP。正式稿 R-12 第293～297行明确要求详设列获准 operation/请求身份，禁止复制主机凭证或新增后台接口。 | 留为后续设计准入项；本轮不凭空选择接口/新身份，也不撤回 Dexter 的副机 HTTP 裁决。小于“为证明通信新增正式会员/身份平台”的方案，是复用真实获准 operation 与现有 owner/adapter；若确需新增业务身份或接口再交 Dexter。 |
| DG-02 当前主机/连接/同步就绪 | CONFIRMED_SOURCE_DELTA：topology `createTopologyStateSyncController.ts:255～354` 有方向、修订和 authoritative apply；不能据此声称全部业务输入已绑定当前连接。正式稿 R-10/R-11/R-12 已规定缓存/未到/失效和 current-ready，V-17 列出迟到投影反例。 | 后续详设给有限所需字段/当前身份/修订的准入；复用原 state/topology，不增加另一个通用同步协议或长期轮询。 |
| DG-03 异步完成守卫 | CONFIRMED_SOURCE_DELTA：runtime `createCommandActorDispatcher.ts:289～326` 以 Promise.race 返回 timeout，不能当作已取消 owner handler。正式稿 R-04/R-10/R-12 与 V-04/V-18 明确配置、角色和取消变更后的迟到完成不得绕过准入。 | 后续落在具体 owner 提交处；不把组件隐藏、dispatcher timeout 或全局仲裁当作根因修正。本轮没有添加新的超时/恢复框架。 |
| DG-04 本地 admin 与业务遮罩 | CONFIRMED_SOURCE_DELTA：已有 LMS launcher/layer peer 路径及 MAIN/BRANCH ownership；正式稿 R-11 和 R-13 要求本地打开/认证/关闭且全业务阻断，并禁止放宽 MAIN 写权。 | 后续独立接线管理恢复通道与业务阻断，复用 admin/render/input；不采用“全局禁用输入/dispatcher”或“允许副机写 MAIN”的较小假修复。 |
| DG-05 后续工件与执行证明 | NOT_APPLICABLE_TO_CURRENT_REQUIREMENTS_WRITING：正式稿 R-15/R-16 已列四拓扑、两个sample、Web优先、adapter独立证明和完整 NOT_RUN。具体线框、控件、IA、VM/runner分母尚未获授权设计。 | 后续授权阶段必须逐场景落地，不推成当前 PASS；本轮不提前实施、不要求未受影响的历史全量反复运行。 |

同根范围：四内容、两个 integration、两个管理 tab、两个工作台、激活/取消/配对/换 host/
重启/同步/配置/代理/URL 接缝均按原始裁决和正式稿复读。样例会员仍主机单 owner、两端过程隔离；
LSP 壁纸本机 owner 与 LMS 主机投影分开；终端凭证保留保护，代理密码明文例外不扩大。

## 4 · 输入越界的根因处置

R2 无效尝试的 first failure、last known good、broken boundary 与 reviewer 原话在独立失败记录。
不因等待时间停止 agent；该次是 reviewer 明确报告盲审越界后的受控停止。

同根问题为同一文档混放原始输入与作者分析，粗 sed 范围跨界。最小修复已落实到 replacement
的输入选择和 review checklist：先只查标题，再逐个读取 §0、§7、§9，不能跨 §8/§10；大输出
截断必须补读，不能把摘要或截断当成完整输入。此处无需新增 memory/generator/gate。

## 5 · 证据和剩余工作

- 静态事实：正式需求整理、原裁决/规范/现有源码核对；主 agent 原文保存 reviewer 报告。
- 完整归档的独立 verdict：仅 R1；R2摘要和明确停止另行记录，不宣称两轮完整审查完成。
- 动态：V-01～V-20 全部 NOT_RUN；没有构建、测试、verify、生成、Web/VM、DEV、reset/seed、L2/UAT或部署。
- 历史：旧批次运行仅可作历史背景，未拿来证明本专项。
- 当前处置：Dexter 明确关闭 R2，已受控停止；不再补做或等待第二轮。正式稿保持冻结，任务转为起草后续设计派活话术。


## 6 · Dexter 关闭 R2 与新任务

Dexter 原文及中断前输出保存在 `2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r2-stopped-by-dexter-codex.md`。
本 cycle 根据用户新指令停止，不由作者 SELF_DECIDED 写成完成或 GO。
后续派活只覆盖详设、实施计划与必要设计配套工件、异常测试方案，写完交 Dexter/Claude review。
不自动授予实施或动态执行权限；不得重启本次已关闭的需求 R2。
