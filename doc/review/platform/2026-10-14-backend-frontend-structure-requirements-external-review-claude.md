# 前后台重点代码结构优化正式需求：外部独立静态评审（Claude）

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN（正式需求；Dexter 转交的外部评审，不重开内部 cycle）
ACTION_1_VARIANT=1-B 文档提取＋owning source 静态读回
REVIEWED_SHA256=07ebaf95e16e78b1951ae52ca65e38bb5d451bfd757f87a09e667bfd7a232120（本轮亲算）
VERDICT=NO-GO
M/S/N=0/1/3
L1_ENGINEERING=STATIC_ONLY；14 族与源码基本一致；R-04 与“不改 TER 生产代码”冲突（S-1）
L2_USER_VISIBLE=需求语义层；菜单、远控、Page 无新增任务；R-13 状态文案落点不清（N-2）
L3_UNVERIFIED=非空（§6）；S-1 关闭后只能给 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=每条 finding 内列出
DESIGN_GAPS=2（§7）
TEMPLATE_COVERAGE=需求工件；Journey/IA/UI/详设四模板逐节 NOT_APPLICABLE（本期无新页面/控件），后续详设逐节适用
EVIDENCE_TIER=SOURCE_ONLY_STATIC_REQUIREMENTS_REVIEW
reviewerKind=EXTERNAL_CLAUDE
```

S-1 只需在 §2/R-04 补一段边界说明；三条 N 都是落点或验收措辞不精确，不阻断 GO。

## 1 · 会话出处与独立性

- 非 fresh：本会话是续接会话（之前做过 TER 远控需求/设计外部评审和竞品研读），v2s 仓根发起；未参与起草本需求或分析稿。
- 阅读顺序：先读正式需求全文、分析稿、AGENTS/CLAUDE/BLUEPRINT/平台入口、memory 路由与 R-READ-01～10、相关源码，形成全部 finding 后，才读 R3 与 intake。
- 未读：`.runtime/`。四份模板正文、third-party 标准与 foundation-charter 本轮只按需检索，未逐节重读；T1 详设/计划只做关键词检索。

## 2 · 问题理解与方案合理性

**问题对不对**：真实维护问题是“同一事实有第二份声明、同一资源生命周期有两份实现、装饰因素成了隐藏准入”，改一处要去别处补。分析稿 14 族都是这种模式，我对其中的关键事实做了读回：
- TDS codec 的 `TOPIC_KEYS` 与 canonical `topicKeys` 逐项相同，而 codec 已注入 `TerminalConnectionProtocol`（`TerminalConnectionFrameCodec.java:24-45`）；
- 两条物化方法重复 tempfile/摘要/限长/删除，且摘要初始化失败时只有 ZIP 路径删临时文件（`PlatformAssetService.java:211-217` 与 `:1400-1405`）；
- `skuPreparationDiffers` 两处逐字相同（`CatalogItemService.java:4443`、`CatalogWorkbenchReadService.java:1323`）；
- 菜单以 `menuIconByKey[key]` 过滤（`OperationsApp.tsx:143`），当前 26 个 catalog key 都有图标，所以去掉过滤今天没有可见变化；
- 远控 parser 手写了 INPUT_RESULT/SESSION_END 等闭集（`RemoteControlWorkspace.tsx:99-133`）。

**方案优不优**：我自己的方案也是“owner 内提纯＋消费现 canonical/foundation＋窄入口”。更小的替代（只加注释）消除不了第二份闭集。更大的替代（统一目录、加 registry、搬 TER 机制）被 §1/§6 明确拒绝。B-4/B-5 延后、B-7 不新建容器是对的。

**代价配不配**：整体匹配当前阶段。唯一需要警惕的复杂度来自 R-17 的最终全量 acceptance 与动态前两轮查漏；这是后台规范 R-READ-07 与实施模板的既有义务，不是本需求新增。

## 3 · 重点逐项核验

| 重点 | 结论 |
|---|---|
| 1 五项建议与 14 族；Catalog 页签、IAM FQCN 延后；B-7 | 成立。§2 表 14 族全覆盖；D-04/D-05 与 R-07 把两项留在后续且不算本期阻断；R-14 不建 dependency bag/registry |
| 2 业务边界保护；不照搬 TER | 成立。R-01/R-02/R-06 保留 facade、事务、锁/CAS、receipt、readback；§1 明确不搬 actor/selector/ParameterDefinition |
| 3 topic、远控闭集、资产准入 | topic 与 binding/SQL 区分成立（R-03 L76）。资产：公共入口只准图片（`validUsageContentType`，`PlatformAssetService.java:1319-1328`），R-05 保持准入、不放开视频成立。远控闭集派生见 S-1 |
| 4 住址与 foundation 复用 | 成立。`asyncGeneration`、cursor identity、`useSalesMenuReadModel` 均存在；R-11 宿主/远控分工清楚。窄入口范围见 N-3 |
| 5 扩展字段 | 方向成立：14 条写路径都把 `JsonNode` 交给 `ExtensionSubmissionWireMapper`，对象形状已支持 SET/CLEAR。验收与空值映射见 N-1 |
| 6 标签与领域状态；可证伪验收；R-READ-07 与动态前日志 | R-17 L137-138 准确保留 R-READ-07 与两轮查漏；V 表可证伪且不要求现在伪造运行证据。R-13 落点见 N-2 |

## 4 · Findings

### S-1 · R-04 改的生成器同时输出到 TER，需求却写“不授权改 TER 生产代码”（CONFIRMED）

**位置**：需求 §2 L40“不授权改 TER 生产代码”、§0 L28；R-04 L80“扩现 `terminal-remote-control-protocol.mjs`，从现 canonical 输出运行期值”。

**仓内事实**：
- 生成器只渲染一份内容，写到两个目标：`scripts/generate/terminal-remote-control-protocol.mjs:10-12`（TER `apps/terminal/kernel/base/remote-control/src/generated/terminalRemoteControlProtocol.ts` 与 operations-admin 生成物）、`:222-230`；check 模式逐个比对，不一致即报 `TERMINAL_REMOTE_PROTOCOL_GENERATED_DRIFT`（`:235-237`）。
- TER 生成物被 TER 生产代码消费（`parseRemoteControlMessage.ts:1`），而该包当前字节正处于 T1 重构中（新出现 `src/declarations/`，actor/slice/index 已变）。
- TER 自己的 parser 也手写了同一批 reason 闭集（`parseRemoteControlMessage.ts:26,35` 一带）；这属于 T1 的同根，不是本批范围。

**反例**：实施者按 R-04 扩生成器后：
- 只重生成 admin 一侧，TER 生成物 drift，生成 check 失败；
- 两侧都重生成，则改了 T1 在途包里的生成文件，与 §2 字面冲突，也可能和 T1 的同包改动交叠；
- 或者为避开冲突给生成器加“按目标分别渲染”，凭空多出一层生成复杂度。

**影响**：本期唯一的跨仓区接缝没有写清，按原文没有一条干净的合法路径。

**最小修正**：在 R-04 补一句：生成器给两个现有目标输出相同的新增运行期常量（additive export）；TER 生成物只由生成器重写，不手改，TER 消费代码不改、不接入；详设按当前字节重读 `outputPaths`，若 T1 已调整 TER 输出位置则跟随。§2 的“不改 TER 生产代码”相应注明“生成器派生的 additive 生成物除外”。不选“分目标渲染”，因为它为一个可选常量增加生成器分支。

**需 Dexter 裁决**：措辞修正不需要；与在途 T1 的先后顺序由 Dexter 统筹，需求只需写明这一依赖。

### N-1 · R-12 的验收说明与空值映射不够精确（CONFIRMED）

**位置**：R-12 L112-114、V-12/V-13 L177-178、§5 L185“已有真实HTTP能力覆盖SET/CLEAR与代表创建/更新”。

**仓内事实**：
- 现 acceptance 的扩展值全部用 legacy 数组提交（`ExtensionAcceptanceScenarios.java:301-307`、`:482`、`:523-524`），全仓测试中 CLEAR 只出现在 mapper 单测（`ExtensionSubmissionWireMapperTest.java:22`）。真实 HTTP 层目前没有 CLEAR 场景，也没有对象形状的有值提交。
- 现前端把 `undefined`/`null`/`''` 都视为“无值”：原值存在时发 CLEAR，原值不存在时不建字段（`organizationExtensionValues.ts:42-45`）。需求列了 false/0/DATE/省略/空提交，没有列 `''`。
- 前端切到对象后，legacy 数组在生产侧不再有提交者；剩下的只是测试和 acceptance fixture。R3 写“legacy仍有生产提交者”，指的正是将被改掉的这段前端。

**影响**：
- L185 的说法容易被读成“现有 H 已覆盖”，于是对象形状的 SET/CLEAR 没有任何真实 HTTP 证明；
- `''` 若被当成 SET 空串，会改变现有清空语义；
- legacy 支路去留由实施者自行判断。

**最小修正**：
- L185 改为“现 acceptance 只覆盖 legacy 数组 SET，没有 HTTP CLEAR；H 须在现 `ExtensionAcceptanceScenarios` 补对象形状的代表 SET（含 false/0/DATE）与 CLEAR=null 读回”。
- R-12 补一句“表单 undefined/null/'' 在原值存在时为 CLEAR，否则不建 key”。
- R-12 写明测试/fixture 不算“使用者”；若前端是最后的生产提交者，详设按“删除过时代码”原则决定删除 legacy 支路并迁移 fixture，或给出保留理由。

**需 Dexter 裁决**：否。

### N-2 · R-13 只描述了一种状态，页面实际有两类、四种未知处理（CONFIRMED）

**位置**：R-13 L118“未知值继续符合现‘状态未知’……不得增加不存在的 VOIDED”；V-14 L179。

**仓内事实**：`ProjectTerminalUpdatePage.tsx` 当前有：
- 规则状态表格 Tag：非 ENABLED 一律显示“停用”（`:755-756`）；
- 规则详情：未知显示“状态未知”（`:1086`、`:1311-1312`）；
- 规则门店列表的门店状态：`UNKNOWN`→“未知”，`VOIDED`→“已作废”，其他值→“启用”（`:1124-1131`）。

foundation 的 `lifecycleLabel` 对未知值直接返回 raw 值，VOIDED 的文案是“作废”（`lifecycleLabels.ts:3-7,17-19`）；`organizationStoreStatusLabels` 在别处已经复用这份 foundation 文案。

**影响**：
- “保持现未知反馈”与“复用 foundation”在三个位置的结论各不相同；
- 门店状态里 VOIDED 真实存在，“不增加 VOIDED”只适用于规则状态；
- 直接套 `LifecycleStatusTag` 会让未知值裸显，或把“已作废”改成“作废”，改变用户可见文案；
- 实施者也可能去改 foundation 的 `lifecycleLabel`，影响两个 App。

**最小修正**：R-13 点名两类状态。已知值复用 `LIFECYCLE_LABELS`/`LIFECYCLE_COLORS`，未知值用 feature 内显式 fallback，不改 foundation 的 `lifecycleLabel`。门店状态保留现“已作废/未知”文案；若要统一为“作废”，需 Dexter 确认文案。表格 Tag 把未知显示为“停用”，属于现有偏差：统一为“状态未知”，或保持不变，二选一并写明。

**需 Dexter 裁决**：只在决定统一文案时需要。

### N-3 · D-02 是通用规则，R-09/V-08 只点名两项，其余跨 feature 深引用没有归属（CONFIRMED）

**位置**：D-02 L24；R-09 L101“至少覆盖 remote-control 与扩展字段”；V-08 L174。

**仓内事实**：operations-admin 当前还有以下跨 feature 引用对方 `model/` 内部文件：
- `organization-structure/model/organizationStatus`：5 处（business-channel、store-management、store-profile）；
- `store-operating-rules/model/useStoreOperatingRuleGate`：5 处（catalog、inventory、sales-menu、store-service-point）；
- `business-channel/model/businessChannelCodeLabels`：1 处（sales-menu）。

`audit-history` 已有 `index.ts`，是正例。前端规范没有 feature 公开边界条文。

**影响**：按 R-16“把自由发挥收小”的要求，这三项做不做由实施者决定。V-08 也只验两项，其余同类引用既不在范围内，也没有写排除理由。

**最小修正**：R-09 把这三项列为本期同根（各补一个窄出口，消费方改引用，不搬 owner），或明确写“本期不处理及理由”。我倾向列入：成本是几行导出，正是 D-02 的原意。R-15 已规定 feature 边界规则若要写入，须指定唯一正本。

**需 Dexter 裁决**：否，D-02 已覆盖。

## 5 · 与 R3/intake 对照（形成结论后阅读）

- R3 对同一 SHA 给出 GO 0/0/0。差异：
  - S-1：R3 没有核对生成器的双目标输出；
  - N-1：R3 把“legacy 仍有生产提交者”当作保留理由，但这个提交者就是本期要改的前端；
  - N-2：R3 已注意到“未知返回 raw”，但没有枚举页面内三处不同的状态处理；
  - N-3：R3 未扫描其他深引用。
- R3 写 `L3_UNVERIFIED=空`。本需求虽无新增 UI，但菜单、Page、远控、扩展 Drawer 的实际行为都没有人验证过，按 review-standard 应列为未验证。
- 历史 verdict 只对应各自字节，本文不继承。

## 6 · 未验证项

| 项 | 状态 |
|---|---|
| 全部详设、实现、生成、编译、测试、verify、H/L2、DEV、seed、cleanup | NOT_RUN |
| 第三方库行为 | 本需求不选新依赖，未核 |
| TER T1 在途改动对生成器的最终影响 | UNVERIFIED，详设按当前字节重读 |
| 1134 个生产文件全量语义 | 未审，只核了 14 族代表实例与上述同根 |

用产品负责人能直接核对的话说，以下几件事还没有人看过：
- 菜单项、远控开始/结束、更新页列表与详情切换在重构后是否和现在一样；
- 十个扩展字段 Drawer 的填写、清空、日期、是/否能否原样保存和读回；
- 更新页里规则状态和门店状态的文字是否保持不变。

## 7 · DESIGN_GAPS

1. `verification-governance` 仍没有 M/S/N 定义。本文沿用以往口径：S 表示按原文没有合法实现路径或会产生功能缺陷，N 表示落点或一致性问题。这一口径需要 Dexter 确认。
2. 治理正本规定 DESIGN 两轮硬上限，而本 cycle 依据 Dexter“直至go”追加了 R3，与之前远控需求的情形相同。两者的关系仍未写入治理正本。这是治理层面的缺口，不是对本需求的 finding。

## 8 · 授权声明

本文是外部静态需求评审，只新写本文件，其余路径只读。本结论不授权详设定稿、实施、需求/规范/记忆/源码/测试/生成器/契约/依赖修改，也不授权生成、编译、构建、测试、verify、DEV、reset/seed、Web、设备、L2、UAT 或部署；不扩大在途 TER T1 范围。
