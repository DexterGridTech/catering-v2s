---
title: 商品编辑抽屉采用瞬态草稿与关闭丢弃
status: DEXTER_ACCEPTED
createdAt: 2026-08-30
decisionOwner: Dexter
implementationAuthority: false
runtimeAuthority: false
---

# 商品编辑抽屉：内存草稿、dirty guard、整单一次提交

## 1. 裁决

商品编辑抽屉是一次性整单编辑任务。用户打开商品后，编辑中的字段和区段状态只存在当前编辑会话的内存中；点击保存时一次提交整单草稿。关闭抽屉前由统一的 `useDrawerFormLifecycle` dirty guard 确认是否放弃，关闭完成后清空该会话的表单、草稿、区段状态和临时资产。

商品编辑不提供跨关闭、刷新或重新打开的草稿恢复能力。正向运行路径不得读写 `sessionStorage`/`localStorage`，不得出现“检测到未保存内容”“恢复编辑”或同类恢复 Modal，也不得以恢复状态、草稿键、恢复令牌或兼容层替代关闭时清理。

## 2. 用户可见行为

- 修改任一商品事实后，保存栏保持可用，区段 dirty/error 标记只服务当前抽屉会话。
- 点击取消、右上角关闭、遮罩或 Esc 时，所有关闭入口都经过统一 dirty guard；选择“继续编辑”留在当前会话，选择放弃后关闭并丢弃中间态。
- 未发生修改时直接关闭；关闭后再次打开同一商品，内容必须来自最新服务端详情，不得出现上次取消留下的值。
- 保存是商品整单一次提交，不拆成区段保存，也不因关闭而自动保存或后台保留草稿。

## 3. 边界与不变项

- 本裁决只覆盖商品编辑抽屉自身的商品草稿生命周期；商品元数据维护仍是编辑抽屉内的 child task，子任务成功后的候选失效与焦点归还规则不变。
- 服务端详情、候选、权限、版本和保存 readback 仍由 owner/RTK query 提供；内存 draft 不能成为服务端事实。
- 保存失败或结果未知时，当前抽屉仍保留内存草稿供用户处理；这不等于跨关闭持久化。关闭前仍须经过 dirty guard，关闭完成即清空。
- 本裁决不授权 reset、seed、浏览器 L2、UAT、部署或任何数据操作。

## 4. 对既有工件的处理

本裁决覆盖此前商品库工件中“编辑抽屉异常关闭/刷新后从 `sessionStorage` 恢复整单草稿”的路径，仅保留“当前打开会话内的内存草稿 + 关闭 dirty guard”。编辑内元数据 child task 原有“不读写过渡 session”的边界继续有效。

实现与回归证据的最小闭包为：

- `apps/frontend/operations-admin/src/features/catalog-management/model/useCatalogItemDraft.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/model/useCatalogItemEditorSession.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/useCatalogItemEditorWorkspaceState.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemEditorWorkspace.tsx`
- 商品编辑 focused/architecture tests

验证必须证明：当前 feature 不再读写浏览器存储；恢复 Modal 与恢复 API 不存在；关闭路径仍调用 foundation dirty guard，并在 `itemCode` 清空时替换为空商品草稿、重置表单和区段状态。
