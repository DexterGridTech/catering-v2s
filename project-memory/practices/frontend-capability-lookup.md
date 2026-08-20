---
id: practices.frontend-capability-lookup
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["admin-ui","platform"]
consumerFaces: ["platform-admin","operations-admin"]
owners: ["frontend-platform"]
impacts: ["architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["EXISTING_CAPABILITY_BEFORE_DESCRIBING_BEHAVIOR"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 我需要一个前端能力 —— 先查这张表

**触发时刻**:准备在需求/详设/代码里**描述**一个控件、列表、抽屉、表单或渲染行为。

⛔ **描述之前先查。查到就指向它,不要复述它的行为。**
`libraries/frontend/admin-ui-foundation` 导出 **99 个符号**,AGENTS.md 强制对接。

## 按意图查

| 我要 | 用这个 | 关键约束 / 数据范围 |
|---|---|---|
| **节点/组织候选选择框** | `usePlatformOrganizationCandidates`(platform-admin)/ `useOrganizationCandidates`(operations-admin) | 已包 `useCursorCandidates`;`PAGE_SIZE=50`、debounce、`onPopupScroll` **滚动累加不呈现页码**、`selectedId` 回显、`total` 返回。`subjectType` 现为 `PROJECT/BRAND/TENANT/HEAD_COMPANY/STORE`,`candidateUsage` 现仅 `CONTRACT_LIST` —— **不够就扩枚举,不新建 operation** |
| 任意候选下拉 | `useCursorCandidates` | 同上;⛔ 不要把候选下拉做成管理表格 pager |
| 声明驱动的字段渲染 | `DescriptorFieldRenderer` + `FieldDescriptor` + `DESCRIPTOR_CONTROL_KINDS` | `FieldDescriptor` = `fieldKey`/`dataPath`/`label`/`controlKind`/`tabKey`/`admittedShapes`/`helpText`/`optionSourceRef`。**`helpText` 就是"业务含义"**;`optionSourceRef` 支持 `enum`/`endpoint`(带 `operationId`)/`local` 三种取值来源 |
| 控件类型词表 | `DESCRIPTOR_CONTROL_KINDS`(16 个) | 分四组:`PrimitiveControlKind` 8 个通用 · `TableControlKind` 2 · **`ReadonlyControlKind` 2(只读展示用这个)** · `DomainControlKind` 4(catalog 专用)。⚠️ **别把整表当成"catalog 专用"**,只有 4 个是 |
| 抽屉 surface | `adminDrawerSurfaceProps` / `adminWideDrawerSurfaceProps` / `useDetailDrawer` | 与 `overlayLock` 配套 |
| 抽屉表单生命周期 | `useDrawerFormLifecycle` / `useSubmissionLifecycle` | 含脏表单锁 `useDirtyFormLock` |
| overlay 锁 | `OverlayLockProvider` / `useOverlayLock` / `useShellInteractionLock` | —— |
| 列表状态与查询身份 | `adminListState` / `usePageQuery` / `createPageQueryIdentity` / `createCursorQueryIdentity` / `isCurrentQueryIdentity` | **旧 query 不回写当前 surface** 靠它 |
| 上下文作用域查询参数 | `contextScopedQueryArgs` | scope/tab 切换时的参数隔离 |
| cursor 分页控件 / 栈 | `CursorPagination` / `useCursorStack` / `collectCursorPages` | ⛔ `useCursorStack` **不能**承担需要任意页码跳转的表格 |
| 幂等键 | `createContentIdempotencyKey` / `digestFileContent` | —— |
| 刷新信号 | `createRefreshSignal` / `useRefreshVersion` | ⛔ 不要和精确缓存失效叠加 |
| 错误边界 | `AdminErrorBoundary` | —— |
| 编码+名称展示 | `formatNameCode` / `NameCodeText` / `NameCodePathText` / `formatCodeNamePath` | G-05B 要求编码单独成列时用它 |
| 层级排序 | `adminHierarchyCollator` | —— |
| 省略提示 | `EllipsisTooltip` | —— |
| UUID 上线 | `wireUuid` | —— |
| HTTP protocol / body | `platformHttpProtocol` / `serializeJsonOrMultipartBody` | —— |
| 埋点与日志 | `createSafeLogger` / `createObservedBaseQuery` / `createBeaconLogSink` | 脱敏由 `SafeLogger` 负责 |
| testId | `testId` | —— |

## 仓内页面样板(要抄形态就抄这些)

| 形态 | 样板 |
|---|---|
| 树 + 右侧详情 | `platform-admin/features/organization-contract-overview/ui/PlatformReadPage.tsx` |
| 管理表格 + 启停 + 状态弹窗 | `platform-admin/features/workspace-management/ui/WorkspaceManagementPage.tsx` + `WorkspaceStatusModal.tsx` |
| 集团空间切换 | `platform-admin/app/state/WorkspaceScope.tsx` |
| 候选下拉接线 | `platform-admin/app/queries/usePlatformOrganizationCandidates.ts` |

## 不满足当前需求时怎么办

1. **先确认真的不满足** —— 多数"不满足"是没读参数(如 `selectedId`、`optionSourceRef`);
2. **优先扩枚举/扩参数**,而不是新建(如 `subjectType` 补两个值);
3. 确需新增共享行为 ⇒ **进 foundation**,不在 `apps/frontend/*` 重造(AGENTS.md 强制);
4. 只有 **App 独有的业务 feature** 才留在 App 内,并须在设计中写明为何 foundation 不覆盖。

- **判别式**:我正在写的这一段,是**「必须满足什么」**还是**「它长什么样、怎么动」**?
  后者 ⇒ 停下来查表。
