# 商品条码与标识、制作信息优化 · implementation review Round 1(Claude 独立复核)

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
VERDICT=NO-GO
M/S/N=1 / 1 / 1
```

- 日期:2026-08-23 · 作者:Claude · 被审:CP 全序列当前生产源码
- **reviewerKind 声明的更正**:话术要求我输出 `reviewerKind=INDEPENDENT_SUBAGENT`。
  ⚠️ **我不是 Codex 治理体系里的 INDEPENDENT_SUBAGENT** —— 那是作者会话内部盲审的角色。
  我是 Dexter 直接发起的**外部独立评审方(Claude)**。两者不可互相冒充,
  故此处如实声明 `reviewerKind=EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`;
  本轮**不构成**作者内部两轮盲审中的任何一轮。
- 会话出处:续接会话。**未采信任何自报数字**,逐项重开 owning source 复算。

---

## 1 · first failure / last known good / broken boundary

```text
FIRST_FAILURE=scripts/dev/catalog-inventory-seed-executor.mjs 第 221-223 行
              normalizedSeedIdentifierValue 对 MNEMONIC 用 toLocaleUpperCase(),
              而 owner / 验收 / migration 三处均用小写规范化
LAST_KNOWN_GOOD=契约、owner、migration、acceptance 四层的 MNEMONIC 规范化(全部小写,逐处亲验一致)
BROKEN_BOUNDARY=seed executor 的 readback 期望值构造层 —— 它是唯一与其余四层不一致的一处
```

**business / cleanup 分开报告**:

```text
BUSINESS=FAIL(见 M-01;静态层其余全绿)
CLEANUP=NOT_APPLICABLE_STATIC_ONLY(本轮未运行任何动态动作,无资源可清理)
```

---

## 2 · 独立复算(不采信自报)

| 项 | 声称 | 我的复算 | 判定 |
|---|---|---|---|
| §9b 16 锚点唯一命中 | 是 | 解析得 16 行,逐行 `grep -cF` **16/16 唯一命中** | ✅ |
| acceptance annotation | 80 | 全 acceptance 目录求和 **80** | ✅ |
| catalog operation | 57 | registry 实测 **57** | ✅ |
| 全平台 operation | 238 | 三份 registry 去重 **238** | ✅ |
| 未新增 resolve operation | 是 | 238 个 operationId 中含 `resolve` 的:**0 个** | ✅ |
| 静态门 | PASS | 本会话 fresh 跑 `--node` **exit=0**,25/25 | ✅ |
| 旧字段退休 | 是 | 生成后契约全文 `skuBarcode`=**0**、`productionProfiles`=**0**;`Detail.item` 与 `SaveRequest.catalogDraft` 的旧字段均**无**,新字段 `identifiers`/`preparationProfile` 就位 | ✅ |
| 42 格进真实 save | 是 | 第 576-605 行逐格发 `saveOperationsCatalogItem`,允许格断言 200+readback,拒绝格断言 typed code **且 version 不变** | ✅ |
| migration fail-closed | 是 | 第 283/289 行 DDL 前 predicate + `RAISE EXCEPTION`;第 421-433 行 **DDL 后 DML 前再跑同一 predicate**(注释逐字写明防漂移) | ✅ |
| SERVICE 拒 BARCODE/PLU | 是 | `CatalogOwnerService.identifierAllowed` 中 `SERVICE -> CATALOG_ITEM && MNEMONIC`,BARCODE/PLU 落入 false;owner 层第 4169/4175 行抛 `CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED` | ✅ |

---

## 3 · Findings

### M-01 · seed readback 的 MNEMONIC 规范化与其余四层相反 —— `CONFIRMED`

- **事实链(四层逐处亲验)**:
  - owner:`CatalogIdentifierFacts.java` 第 210-212 行
    `"MNEMONIC".equals(type) ? identifierValue.toLowerCase(Locale.ROOT) : identifierValue`
  - 验收:`CatalogAcceptanceScenarios.java` 第 594 行
    `"MNEMONIC".equals(type) ? value.toLowerCase(Locale.ROOT) : value`
  - migration:`V20260823_120000_000__...sql` 第 62 行与第 460 行均为 `lower(...)`
  - **seed**:`catalog-inventory-seed-executor.mjs` 第 221-223 行
    `entry.identifierType === "MNEMONIC" ? String(entry.identifierValue).trim().toLocaleUpperCase() : ...`
- **用途定性(已开源码确认,非推断)**:该函数**不是构造请求**,而是
  `sameIdentifierFacts` 里**期望值**的 `normalizedValue`(第 238 行),用于 readback 严格比较。
- **失败场景**:owner 返回 `normalizedValue` 为小写,seed 期望大写 ⇒
  只要 seed 业务图中存在**任一** MNEMONIC,`sameIdentifierFacts` 恒返回 false,seed readback 断言必失败。
  而设计要求 seed 覆盖「MNEMONIC 大小写碰撞」,该用例**必然**触发。
- **影响面**:seed 阶段;⚠️ 但**本轮 seed 未执行**,所以这是**静态可判定的必然失败**,
  不是"跑出来的失败"——正因如此才必须现在报,否则会在授权 seed 后才暴露。
- **同根全集**:`toLocaleUpperCase` 在该文件出现 **1 次**,即本处;
  其余三层(owner/验收/migration)已逐处核对**一致为小写**。⇒ 全集 4/4 已判,缺陷仅 1 处。
- **最小修复**:第 222 行改为 `.toLowerCase()`(与 owner 的 `Locale.ROOT` 语义对齐)。
- **需 Dexter 裁决?** 否。

### S-01 · shape×grain×type 准入矩阵有三个住址,且验收那份是 owner 的逐字复制 —— `CONFIRMED`

- **事实**:同一准入事实同时声明于三处 ——
  1. `scripts/generate/catalog-inventory-p1.mjs` 第 449-478 行 `identifierAdmissionExpected`
     (及第 479 行起 `preparationAdmissionExpected`);
  2. `CatalogOwnerService.java` 的 `identifierAllowed` / `preparationAllowed` **硬编码 switch**;
  3. `CatalogAcceptanceScenarios.java` 第 822-837 行 `identifierAdmissionAllowed` /
     `preparationAdmissionAllowed` —— **与 owner 的 switch 逐字同构**。
- **关键证据**:生成后契约中 `identifierAdmission` / `identifierTypes` /
  `preparationAdmission` 的出现次数**均为 0** ⇒ **准入矩阵没有进入契约**,
  owner 因此**无法从 manifest 派生**,只能硬编码;验收也只能再抄一份。
- **为什么是缺陷而不是风格问题**:验收那份是 owner 的复制品,
  **它证明不了 owner 的准入是对的,只能证明两份抄得一样**。三处任一被改而另两处未改时,
  42 格全绿仍然成立 —— 这正是"同一事实一个住址"要防的失效模式。
  今日三处**取值一致**(我逐 shape 比对过 7×2×3 与 7×3),所以不是 M。
- **同根全集**:准入矩阵共 2 组(identifier 7×2×3、preparation 7×3),
  每组各 3 个住址 ⇒ **6/6 已判**,6 处取值今日全部一致。
- **最小修复**:把 `identifierAdmissionExpected` / `preparationAdmissionExpected` 作为
  **manifest 字段发射到契约**,owner 与验收改为消费同一生成物;
  或退一步,增加一道生成器 self-test,把 owner switch 与生成源逐格对账(红夹具:改 owner 单格即红)。
  前者更彻底,后者更小 —— **建议后者**,因为本批 D-CIPG-03 已裁定不扩契约面。
- **需 Dexter 裁决?** 否(技术形态,在既有边界内)。

### N-01 · `CatalogItemIdentificationEditor` / `CatalogItemPreparationEditor` 的 focused proof 未独立成文件 —— `PARTIALLY_CONFIRMED`

设计 §9b 声明将新建这两个组件。`catalog-management/ui/` 下的 `*.test.tsx` 只有
`CatalogInventoryBomWorkbench` / `CatalogItemDrawer` / `CatalogManagementPage` 三个。
两个新编辑器的行为可能已并入 `CatalogItemDrawer.test.tsx`,**我未逐条核对其断言是否覆盖
业务语言、形态分支、草稿清理、错误定位、失效边界五项**,故标 `PARTIALLY_CONFIRMED` 而非 CONFIRMED。
建议作者在 intake 时给出这五项各自的断言标题;若确实缺失,应升级为 S。

---

## 4 · 未执行项(⛔ 不得被静态或 focused proof 冒充)

以下**全部未执行**,本轮任何结论都不代表它们通过:

1. **编译与 typecheck** —— 未跑;
2. **生成链 P1→tokens→M1→P3 实跑与 exact-set** —— 未跑(我只核了**生成产物**的当前内容);
3. **真实 migration** —— **未执行**。第 283/427 行的双 predicate 是**源码事实**,
   ⛔ 不等于"迁移已通过";其 fail-closed 行为只有真实执行才能证明;
4. **80/80 HTTP acceptance** —— 未跑。42 格逐格 save 是**源码断言存在**,不是"跑绿";
5. **seed 物化与 readback** —— 未执行,且据 M-01 **静态可判定它当前会失败**;
6. **DEV 生命周期** —— 未跑;
7. **browser L2 / UAT** —— 未授权未跑;
   前端 focused proof 只证明渲染输出,**不能代称键盘可达、焦点归还或真实滚动**;
8. **cleanup** —— 无动态动作,`NOT_APPLICABLE_STATIC_ONLY`。

---

## 5 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2
reviewerKind=EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE(非作者内部 INDEPENDENT_SUBAGENT,见文首)
VERDICT=NO-GO
M/S/N=1 / 1 / 1
FIRST_FAILURE=seed executor 第 222 行 MNEMONIC 用 toLocaleUpperCase
LAST_KNOWN_GOOD=owner/验收/migration 三层的小写规范化
BROKEN_BOUNDARY=seed readback 期望值构造层
BUSINESS=FAIL(M-01)
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
SAME_ROOT_SCAN=MNEMONIC 规范化 4/4 层已判(1 处不一致)· 准入矩阵 6/6 住址已判(取值今日一致)· §9b 锚点 16/16 · 三份 registry 3/3
EVIDENCE_TIER=静态读源码 + fresh 跑 node 静态门 + 独立复算 registry/annotation/锚点/契约字段。⛔ 未跑编译、生成链、migration、acceptance、seed、DEV、L2、UAT
```

**NO-GO 的理由与边界**:M-01 是**静态即可判定的必然失败**,且落在设计明确要求覆盖的
「MNEMONIC 大小写碰撞」用例上;它会在获得 seed 授权后才暴露,现在修成本最低。
除此之外,本轮复算的九项分母与守卫**全部成立**,迁移的双 predicate 与 42 格逐格 save 质量很高。
修复 M-01(一行)与 S-01(加一道生成器 self-test)后可进入 Round 2。

**授权边界**:本轮未执行 migration、reset、seed、DEV、browser L2、UAT、部署或任何 Git 操作。
本结论不授权实施以外的任何动作,也不授权新增产品语义。
