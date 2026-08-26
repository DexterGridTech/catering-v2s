# Catalog category-management interaction change

```text
STATUS=DEXTER_ACCEPTED
CONSUMER_FACE=operations-admin
HOST=/operations/:workspace/catalog/{brand-items|store-items}
DEXTER_BROWSER_REVIEW=2026-08-08 comments 1-5 accepted
```

## Interaction map

| User task | Entry | Visible surface | Owner command/readback | Failure recovery |
| --- | --- | --- | --- | --- |
| Rename category | category action menu | `重命名` modal: name only | catalog category update + true category readback | preserve name; show typed conflict/validation message |
| Change parent | category action menu | `更换父分类` modal: target parent only | catalog category reparent + ordered tree readback | preserve selected parent; explain loop/depth/conflict |
| Change sibling order | category action menu | `向上移动` / `向下移动` actions | catalog category reorder + ordered tree readback | disabled at boundary; preserve selection on conflict |
| Delete empty subtree | category action menu | `删除分类` confirmation with subtree count | catalog category delete + tree readback | show references that block deletion; no partial deletion |

The action menu contains none of `停用`, `重新启用`, `作废并重建`, or `移动/排序`.

## Surface contract

```text
UI_SURFACE=tree-node action menu and task-specific Modal/confirmation
ACTOR=有总公司或门店商品编辑权限的运营人员
BUSINESS_GOAL=以真实分类结构组织商品，不制造不可解释的生命周期或编码障碍
FOUNDATION_PRIMITIVE=NONE_WITH_REASON: current task uses existing Ant Design tree/dropdown/modal lifecycle; no app-local replacement of a shared Drawer/overlay primitive is introduced.
TECHNICAL_BOUNDARY=expectedVersion, opaque refs, owner scope grant and typed problem code are never user-facing labels.
```

Low-fidelity task surfaces:

```text
更换父分类                         删除分类
──────────────────────             ──────────────────────
当前分类：咖啡（COFFEE）             将删除：咖啡及 2 个子分类
目标父分类：[饮品（DRINK） ▼]         条件：该树下没有商品引用
                [取消] [确认]       [取消] [删除]
```

`向上移动` and `向下移动` act immediately after explicit owner validation; they do not open a
form because neither task has user-entered business facts.
# SUPERSEDED-BY: 商品分类层级上限已由 `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` §12.4 统一为最多三级；本历史交互中的旧层级假设不得作为实施依据。
