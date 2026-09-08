REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
reviewerKind=CLAUDE
SOURCE=USER_PROVIDED_CLAUDE_REVIEW
VERDICT=NO-GO
M/S/N=1/2/1
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN

# 经营渠道模板门店可见范围 · Claude DESIGN review

> 本文件保存 Dexter 在本会话提供的 Claude 评审结论，作为评审原文的结构化仓库留痕。它不是 Codex 独立审查，也不替代现有 independent subagent Round 1/2。评审结论只覆盖设计完整性与证据边界，不包括实施、部署、切流、UAT 或产品验收。

## 1. 结论

Claude 结论为 `NO-GO`，M/S/N=`1/2/1`。M-01 是产品裁决硬门；S-01、S-02 为可修设计/证据项；N-01 是当前 owning source 与设计宣称不一致的候选状态门禁说明。

## 2. 已核实成立的设计事实

- ALL 不展开关系行，候选按 ALL 或 SELECTED + EXISTS 动态判断，未来加入项目的门店可被 ALL 覆盖。
- `store_ref` 是 business-channel owner 的 opaque cross-owner reference，无跨 schema FK；关系行不复制门店名称、状态或 project_ref。
- 可见范围变更不触碰既有 `business_channel` 行、status、version、binding 或渠道事件；既有渠道保留。
- owner/API 分层、事务、CAS、锁、审计、权威回读和不使用触发器表达跨表不变式的方向成立。
- 方案采用关系表而非 boolean + JSON；既有关系表形态与查询路径更适合引用集合。
- `BusinessChannelCommandApi.createChannel` 与 `BusinessChannelOwnerApi` 的现有 sales-menu facts 分工已核实，后者不应承接本批 visibility 方法。

## 3. Findings

### M-01：产品决策未收敛（已由 Dexter 在本次裁决关闭）

原 review 要求明确 ALL 是否覆盖未来项目门店、SELECTED 是否允许空、DISABLED/VOIDED 关系处理、保存形态、PROJECT wire 和 visible-store read 形态。

本次 Dexter 裁决：

1. 删除 D-BCV-01；ALL 是动态项目成员开关，不是需要二选一的快照产品问题。
2. D-BCV-02：SELECTED 允许空集合；空集合表示零家门店可从模板新建，不等于停用。
3. D-BCV-03：关系行保留、不级联删除；列表 count 只数非 VOIDED；只读详情读取非 VOIDED；编辑 Drawer 读取全部并标注 VOIDED。
4. D-BCV-04：保存整体替换最终名单，不提交 add/remove diff；和 scope、version、audit 同一 CAS 事务完成。
5. D-BCV-05/06：PROJECT wire 为 `null + []`；同一个 visible-store operation 以 `storeStatusFilter=NON_VOIDED|ALL` 服务只读详情和编辑 Drawer。

### S-01：可见门店数量不能包含作废门店（已在设计中修复）

原 `visibleStoreCount` 设计按关系行数返回，会在唯一关系门店已经 VOIDED 时显示错误的可见门店数量。本次设计已固定为 SELECTED 只统计非 VOIDED 门店；关系行仍保留，编辑侧仍可读到它。

### S-02：UI 控件分母未逐控件枚举（已在设计中修复）

原交互设计只有 foundation 原语名和不完整的建议键，未覆盖范围摘要、scope options、VOIDED 标注、visible-store read、候选表/新建入口等实际 surface。修复后 UI interaction §3.3 逐行列出控件键、稳定 testId、真实挂载节点、`COMPOSITE_OPTION_ANCHOR` 和 L2/静态分母；通用 UI interaction template 也新增同样的强制 roster 段落。

### N-01：候选目标门店 ENABLED 门禁没有现行策略可直接沿用（已在设计中显式补齐）

当前 `BusinessChannelOwnerService.pageStoreTemplateCandidates` 只表达 template 的 workspace/project/operator/status 和 ALL/EXISTS visibility；当前 `OperationsBusinessChannelController.requireStoreProjectPair` 证明门店存在、项目归属和 session scope，但不证明 `organization.store.status=ENABLED`。因此不能笼统写“沿用 organization STORE candidate policy”。

设计已改为：candidate operation 必须在 edge/owner 的明确边界调用 organization owner/task read，取得目标门店 status 并要求 `ENABLED`；DISABLED/VOIDED 目标门店 fail closed，不返回模板候选，直接 create 也必须由 owner 再次拒绝。设计引用当前可复用的 `OrganizationOwnerApi.requireSalesMenuStore` 状态事实入口，但不声称当前 production candidate route 已经完成该门禁；实施时仍须按当前 source/registry 选择并对账 named owner boundary。

## 4. 评审边界

- 本评审没有执行生产代码、契约生成、migration、测试、seed、reset、DEV、backend acceptance、browser L2、UAT 或部署。
- 该 review 不替代 independent subagent review；现有 Round 1/2 原文保持不变，Round 2 已是 independent review cycle 的上限。
- 本文件写入后，Journey、IA、UI interaction、implementation design 和 implementation plan 均发生了当前字节修订，必须对修订后的全量材料做 Claude follow-up review；在 follow-up 完成和 Dexter 另行授权前仍不得实施。
