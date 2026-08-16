# B1 · D-6 删 legacy audit 语句

> 先读 `00-总纲-claude.md`。

| 字段 | 值 |
|---|---|
| CP 数 | **1** |
| 版本 | **第三版**。第二版的原子组与分步行号被独立核验判为**会删错行**,已整体废弃 —— 见 §4 |
| 定位方式 | **逐字锚点。行号只在括号里作参考,以锚点为准** |

---

## 1. 删除集合(穷举验证,这是本册唯一必须存在的内容)

八张死表的**全部引用**。仓内其它位置(Java / 测试 / seed / scripts / tools / contracts)对这八张表的引用为**零**;
`V20260726_210000_000` 里的命中全部是 `*.audit_event`(另一批**活表**)的约束名,与死表无关。

| 表 | 全部引用 |
|---|---|
| `organization.commercial_group_audit` | V25:31 / 37 / 69 / 70 / 71;V26:12 / 72 / 73 / 74;V27:194 / 210 |
| `platform_iam.platform_audit` | V26:102;V27:195 / 211 |
| `platform_workspace.workspace_audit` | V26:150;V27:196 / 212 |
| `platform_asset.asset_audit` | V26:152;V27:197 / 213 |
| `extension.extension_audit` | V26:154;V27:198 / 214 |
| `organization.organization_audit` | V26:160;V27:199 / 215 |
| `workspace_iam.workspace_audit` | V26:166;V27:200 / 216 |
| `contract.contract_audit` | V26:169;V27:201 / 217 |

---

## 2. CP-D6 · 一个 CP,一次删完,一次回放

```text
FILE      src/main/resources/db/migration/ 下三个文件:
            V20260725_170000_000__platform_workspace_and_commercial_group.sql   (79 行)
            V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql (169 行)
            V20260727_010000_000__owner_data_integrity_and_receipt_cutover.sql  (217 行)

LOCATE    **一律用逐字锚点定位,不用行号。** 括号内行号仅供参考。

ACTION    删除 + 改值(**一次做完,中途不回放**)
```

### 2.1 V20260725_170000_000

| # | 逐字锚点 | 删到哪 | (参考行) |
|---|---|---|---|
| 1 | `CREATE TABLE organization.commercial_group_audit (` | 到闭合的 `);` | 31-41 |
| 2 | `ALTER TABLE organization.commercial_group_audit ENABLE ROW LEVEL SECURITY;` | 整行 | 69 |
| 3 | `ALTER TABLE organization.commercial_group_audit NO FORCE ROW LEVEL SECURITY;` 之前那行 `FORCE` | 整行 | 70 |
| 4 | `CREATE POLICY platform_admin_commercial_group_audit_access ON organization.commercial_group_audit` | 到该语句闭合分号 | 71-73 |

⛔ **不得删文件**(前 2 行是 `CREATE SCHEMA`,该文件含全仓 FK 根表)。
⛔ 不得动 `group_workspace` / `commercial_group` / `commercial_group_idempotency` 三张**活表**的 RLS 块
(各 5 行,`USING` 子句在块尾)。

### 2.2 V20260726_090000_000

| # | 逐字锚点 | 动作 |
|---|---|---|
| 1 | `            'platform_admin_commercial_group_audit_access',` | **删整行。⛔ 上一行的逗号原样保留** —— 它不是末项,末项是下一行的 `..._idempotency_access');` |
| 2 | `    IF policy_count <> 4 THEN` | 改成 `<> 3` |
| 3 | `'R5_R3_POLICY_PRECONDITION_FAILED: expected 4 policies, got %'` | `expected 4` 改 `expected 3` |
| 4 | `ALTER TABLE organization.commercial_group_audit DISABLE ROW LEVEL SECURITY;` | 删整行 |
| 5 | `ALTER TABLE organization.commercial_group_audit NO FORCE ROW LEVEL SECURITY;` | 删整行 |
| 6 | `DROP POLICY platform_admin_commercial_group_audit_access ON organization.commercial_group_audit;` | 删整行 |
| 7 | 七条 `CREATE TABLE <schema>.<name>_audit (` —— schema.name 见 §1 表 | 各删到闭合 `);` |

⛔ **不得动 `commercial_group_idempotency` 的三行 teardown** —— 它紧跟在 #4-#6 之后,是**活表**。
⚠️ 第二版在此处栽过:它先删 #1 再按原始行号指 #4-#6,全文上移一行后正好把 idempotency 的第一行删掉。
**用锚点就不会有这个问题。**

### 2.3 V20260727_010000_000

| # | 逐字锚点 | 删到哪 |
|---|---|---|
| 1 | `FOREACH table_name IN ARRAY ARRAY[` 所在的 `DO $$` 块(块内含 `R5_LEGACY_AUDIT_NOT_EMPTY`) | 整块含 `END $$;` |
| 2 | 八条 `DROP TABLE <schema>.<name>_audit;` | 各删整行 |

⛔⛔ **必须保留**含 `INSERT INTO organization.audit_event` 与
`DELETE FROM platform_workspace.audit_event WHERE action='COMMERCIAL_GROUP_INITIALIZED'` 的那一段
(及其上方两个前置校验 `DO $$` 块)。
那是在**两张活表之间**搬 `COMMERCIAL_GROUP_INITIALIZED`,与八张死表无关。
**只删 INSERT 留 DELETE 会直接丢数据。**

⛔ 该文件有 **6 个 `DO $$` 块**,只删含 `R5_LEGACY_AUDIT_NOT_EMPTY` 的那一个。

---

## 3. 验收

```text
INVARIANT ① 三个文件的其余语句逐字不变
          ② 两个 CREATE SCHEMA 保留
          ③ 三张活表的 RLS 与 teardown 逐字不变
PROOF     档 3:reset + 全量 Flyway 回放 + seed 通过
DEPENDS   无
```

**唯一的门 · G-D6**

| 不变量 | 红夹具 | 负控制 | 反例 |
|---|---|---|---|
| reset + 全量回放 + seed 通过 | 临时留下含 `R5_LEGACY_AUDIT_NOT_EMPTY` 的守卫块 ⇒ 回放红 | 只改迁移注释不触发 | 回放通过**只证明 DDL 可执行**,不证明数据正确 —— seed 通过是必要不充分 |

---

## 4. 第二版为什么整体废弃(留档,防再犯)

| 编号 | 第二版 | 事实 |
|---|---|---|
| **M1** | 声明原子组中间态「必报 `relation ... does not exist`」,并标「已按顺序验证成立」 | **错的。** V26 的 policy 计数守卫排在 V27 之前,做完第一步后**首个报错是 `R5_R3_POLICY_PRECONDITION_FAILED: expected 4 policies, got 3`**。而且第二版自己规定「组内不跑回放」⇒ 这个红**在自己的流程下永不可观察**。守一个观察不到、且写错了的红 |
| **M2** | 一个 CP 内先删一行、再按**原始行号**指认后续删除点 | **会删错行。** 删掉那行后全文上移,「第 72-74 行」实际命中原 73/74/**75**,原第 75 行是**活表** `commercial_group_idempotency` 的 teardown —— **直接违反同一 CP 自己的 FORBID**;同时原第 72 行被留下引用已删表,回放失败 |

**根因**:用绝对行号指认一个自己即将移动的目标。
**结构性修复(本版)**:`LOCATE` 一律用**逐字锚点**,行号只进括号作参考;三个文件一次删完,取消原子组与分步。

---

## 5. 未验项

- **本轮未跑回放**。删除集合的完整性是**静态穷举**结论
- 三个文件的行数(79 / 169 / 217)与 §1 引用全集经独立核验为真;**锚点文本未逐条比对源码**
