# 测试健康闭环整改需求（Claude）

- 目标（Dexter 定调）：**不求自动化测试发现所有问题，只求测试脚本健康闭环。**
- 输入：Claude 扫描报告 + Codex 全面静态审计（`doc/review/platform/2026-08-11-v2s-test-script-full-static-audit-codex.md`）
- 过程：本文经两轮 fresh 独立子 agent 盲审。第一轮推翻我初稿 6 处结论（已自行复算证实并修正，见 §6）；第二轮发现的新问题按"闭环"标尺筛选，只保留直接影响闭环的，其余登记欠账。
- 会话出处：fresh v2s-rooted。本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器。

---

## 0. 闭环的定义（验收就按这四条）

| # | 条件 | 现状 | 违反证据 |
|---|---|---|---|
| C1 | **写了的测试都会被执行** | 破 | 至少 34 个测试文件 + 8 个后端模块 34 个 Java 测试无权威入口 |
| C2 | **红了是真的坏** | 破 | 今天权威入口内 4 个红，**全部**是源码拼写变化，无一是行为坏 |
| C3 | **绿了是真的好** | 破 | 12 个 ACTIVE 门从不执行却被 `existsSync` 认证合格；U11 两条命令自满足 |
| C4 | **失败看得懂** | 破 | 环境缺失与代码缺陷同一种报错；单条失败打印 2 万字符源码；跨进程首败被泛化 |

**范围纪律**：本次只做让这四条成立的最小动作。不建测试分层制度、不改冻结契约、不新建门（除非某条闭环没有更小的办法）。

---

## 1. C1 · 写了的测试都会被执行

### 1.1 事实

- `tools/verify-gates/verify.mjs` 的 `node --test` **直接入口 0 个**；经 `U08`/`U09` → 两个 App 的 `package.json test` **间接跑到 12 个架构测试**。
- **不被任何入口执行**：`scripts/**/*.test.mjs` **27 个**（含 `scripts/generate/` 2 个）、`libraries/frontend/admin-ui-foundation` **3 个**、前端 `features/**/*.test.mjs` **4 个**（零引用）。
- **Java**：verify 只跑 6 个模块 task + 根 task；**8 个模块 34 个测试文件不在表内**，其中 catalog(12)/inventory(9) 是 R5 当前域。它们被 `scripts/test/catalog-inventory-backend-unit.mjs`、`scripts/test/r5-joint-remote-l2.mjs` 与 `scripts/check/catalog-inventory-test-independence.mjs` 引用——**这三者都不是 verify 入口**，所以仍然无权威执行。（不要写成"仅被 backend-unit runner 调用"。）

### 1.2 动作

1. `verify.mjs` 命令表补上：`node --test` 跑 27 个 `scripts/**/*.test.mjs`；`libraries/frontend/admin-ui-foundation` 的 `test`；缺失的 8 个 Java 模块 test task。
2. 前端 runner glob 保持**显式**（`src/tests/architecture/*.test.mjs`），**不要**改成 `src/**/*.test.mjs`——实测 `node --test '<不匹配的 glob>'` 输出 `tests 0 / fail 0`、**EXIT=0**，改宽会把失败模式从"红"变成"绿且空"。要覆盖新目录就显式再加一条 glob。
3. 加一条**分母打印**（不是新门）：verify 结束时打印 `EXECUTED_TEST_FILES=n / DISCOVERED=m`，两者不等即失败。发现集显式枚举，且排除 `apps/**/src/test/java/architecture/fixture/*.java`（8 个无 `@Test` 的 ArchUnit 负例夹具，本就不该独立执行）。

---

## 2. C2 · 红了是真的坏

### 2.1 事实

- 前端 72 个 vitest 文件中 **65 个读被测源码文本**做子串断言；真渲染仅 1 处。
- 今天 4 个红全部是拼写漂移：`StoreManagementPage.test.tsx:56` 断言 `'extensionValues: serializedExtensionVa…'`（源码已内联）、`CatalogManagementPage.test.tsx:152`、以及 A 层 2 条（`/gridTemplateColumns/`、`/\.\.\.\(field\.key \? …\)/`）。
- 65 个中 `features/**/ui/` 占 58，`app/` 占 7。58 个中 25 个**文件级**含相对 `import`，但**文件级分类不等于断言级分类**：其中多数只是把导入的契约常量当作 needle 喂给 `expect(source).toContain(...)`，断言对象仍是源码文本（例如 `OperationsLoginPage.test.tsx:15` 的 `for (const operation of [...]) expect(source).toContain(operation)`）。
- **正确表述：3 个 mixed 测试文件含应保留的真值断言**（不是"全仓只有 3 条真值断言"——单是 `CatalogManagementPage.test.tsx` 就有 7 处直接值断言）。**不得用"3 + 55 条断言"作为验收分母。**
- **我的扫描判据有假阴性，实施时必须重做**：初次扫描用 `\b符号\s*\(` 匹配调用，**漏掉泛型调用形式**（`envelopeData<{items: string[]}>(...)`），因此 `inventoryManagement.test.ts` 的 `envelopeData` 被误判为"未调用"。**25 个文件必须用能覆盖泛型调用的判据重新逐条过一遍**，不能沿用我这份粗筛结果。

### 2.2 动作（按断言粒度，不按文件粒度）

**先做 assertion-level inventory，再动手。** 对 25 个文件级 mixed **逐条断言**标注属于"真值"还是"源码文本"，产出一份逐断言清单；只提取前者，其余标为源码文本后删除。**不得按文件整体保留，也不得用文件数当断言分母。**

| 动作 | 对象 |
|---|---|
| **先提取** | 逐断言清单中标为真值的断言 → 移到贴着被测模块的 `<module>.test.ts` |
| 再删 | 同批文件中标为源码文本的断言 + 33 个纯源码文本文件（整文件） |
| 一并删 | `app/` 下 7 个读源码文件的源码文本断言（如 `PlatformApp.test.tsx` 断言 `'icon: <SettingOutlined/>'`） | 7 |
| 直接删 | `platform-admin/src/features/**/*.test.mjs` ×4（零引用、零执行，手跑 6 用例中 2 个已红） | 4 |
| 删断言 | A 层的实现拼写断言（变量名、CSS 属性、JSX 字面、回调参数名） | 见下 |

**已确认必须提取的 3 个文件**（以下是已复算的保留符号，**不是完整清单**——实施时须按修正后的判据补全，特别是泛型调用形式）：

| 文件 | 保留符号（含调用次数） |
|---|---|
| `catalog-management/ui/CatalogManagementPage.test.tsx`（覆盖 `catalogModel` decoder，**今天正红**） | `requireOperationsScopeRef` ×2、`decodeDetail` ×2、`decodePreflight` ×1、`decodeBrandCopyReadback` ×1、`decodeNavigation` ×1 —— **单文件 7 处直接值断言** |
| `inventory-management/ui/inventoryManagement.test.ts` | `shouldRequestInventoryDiagnostics` ×2（:41-42）、**`envelopeData` ×2（:94-95，`toEqual` 全对象断言）** —— 后者是我初次扫描漏掉的 |
| `platform-admin/.../OrganizationOverviewFilters.test.ts` | `filtersForOrganizationTab`、`organizationOverviewQuery`、`ownerFilterOptions`、`updateOrganizationTabQueryState` |

**A 层处置说明**：A 层 12 个文件共约 **224 条**断言（不是 23 条），其中实现拼写不止今天红的 2 条——`rp07-rp08-second-package.test.mjs` 钉死 13 个文件的字面 JSX、`query-filter-submit-boundary.test.mjs` 钉死回调参数名 `searchConfig`。**按判据过一遍，不要只删今天红的**。判据一句话：断言依赖名字/写法而非依赖关系或分母的，删。

**边界（避免误伤）**：A 层其余断言（依赖方向、禁用 API、必须消费生成物、分母集合）是正当的机器门用法，保留。

### 2.3 不做的事

- **不引入** jsdom / `@testing-library`。
- `renderToStaticMarkup`（见 `OperationsRequiredScopeSurface.test.tsx`）**不得泛化为通用组件测试方案**。它只适用于无 effect、无 query/mutation、无导航、无 portal/modal、无交互状态的纯展示或受限边界组件。AntD + RTK Query + Redux + router 的真实业务组件（如 `CatalogItemDrawer`、`StoreCreateDrawer`）不在其适用范围。
- **无法提纯的复杂 UI，本次登记欠账**（§8），不得用静态渲染冒充行为保障。
- **不写**测试分层制度文档。层的约定放进一条记忆即可（§5）。

---

## 3. C3 · 绿了是真的好

### 3.1 事实（三处假绿，按影响排序）

1. **门执行分母**：`scripts/check` 共 **61** 个，verify 只调 **10** 个。matrix 中 43 条 ACTIVE GATE 规则引用 16 个唯一 ref，其中 12 个未在 `verify.mjs` 文本中出现。
   **但这 12 个不能直接当成"待接线的 12 个门"**：其中一个 ref 就是 **`scripts/verify` 自身**（它当然不会引用自己）。它是 `VERIFY_ROOT`，不是待作为 child 再接线的门；照直接接线会让 verify 递归 spawn 自己。
   **真正需要新增到 verify child execution set 的是 11 个 leaf gate**：`agent-lifecycle`、`business-terminology-traceability`、`code-layout`、`database-operation-budget`、`foundation-standard-actions`、`logging-boundaries`、`project-memory`、`provider-free-context`、`roadmap-program-registry`、`security-boundaries`、`ui-wireframe-traceability`。
   而 `standards-coverage` 对 ACTIVE 门的"强制"证明只是 `fs.existsSync(refPath)`——**文件存在就发合格证**。
2. **U11 自满足**：`scripts/dev/check` → `r5-dev-environment.mjs` 为 `V2S_RUNTIME_ENVIRONMENT` 等**自己填默认值再校验自己填的值**（:28 默认 `"non-production"`，:39 断言等于 `"non-production"`），安全标记永远不会因缺失而红；`scripts/dev/seed --dry-run` 在执行器之前返回，只比对两个 JSON 的中文标签与计数，0.067s，**不碰数据库**。二者都在 verify 的 PASS 行里。
3. **`--validate-only` 名不副实**：只跳过 `U12-standards`，走 `r5-remote-testcontainers.mjs` 的 **7 次调用（U02/U03/U04×2/U05/U06/U07）** 与 `U11-seed-dry-run` 照跑，最后却打印 `R5_VERIFY_VALIDATE_ONLY=PASS` + `REMOTE_TESTCONTAINERS_CLEANUP=PASS`。
4. **HMAC 只验格式**：`backend-performance-testcontainers-196.mjs:70` 的 `hmacValue` 是纯 `/^[A-Za-z0-9_-]{43}$/`，红变异样本 `'invalid'` 只测到正则——格式合法的伪造串能过。**仓内已有正确写法**：`backend-performance-final-acceptance.mjs:129,141-142` 用 `evidenceHmac(hmacKey,…)` + `timingSafeEqual`。

### 3.2 动作

1. **先定义执行映射，再谈接线**：明确 `VERIFY_ROOT`（`scripts/verify` 自身）、`VERIFY_CHILD`（11 个 leaf gate）、`ARCHUNIT_SELECTOR`（matrix 中 `kind=ARCHUNIT` 的 2 条，执行单元是 Java 测试选择器不是脚本）三者的精确执行映射。**`scripts/verify` 只能作为 root，不得作为 child 再 spawn 一次。**
2. **孤儿门按有限 disposition 处置，不按"零引用即退役"**：我测到的 32 个零调用方是一个**未统一口径**的粗数（门可能被其它门、`package.json`、Java 测试或 `tools/` 调用）。须逐个给出 `接线 / 退役 / 保留待用` 的显式 disposition；**零引用本身不构成退役依据**——按 `verification-governance.md` 的 `CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES`，退役仍需"连续五个 package 未触发"的证据。
3. `standards-coverage` **停止用 `existsSync` 认证 ACTIVE 门**，改为对**实际执行 receipt** 做 exact-set 对账。

   **receipt 契约用现成的，不新造 schema**——`contracts/policy/standards-enforcement-execution-catalog.json` 已经是 execution-map artifact（17 条 `entry`，各带 `ref` / `command[]` / `successMarkers[]`），`standards-coverage` 的 `executeActive({root, matrix, catalogPath, refs})` 已经是 producer+consumer，且已有 fail-closed 码 `ENFORCEMENT_EXIT_NONZERO:<ref>`、`ENFORCEMENT_MARKER_MISSING:<ref>:<marker>`、`ENFORCEMENT_REQUESTED_REF_UNKNOWN`、`ENFORCEMENT_DEPENDENCY_HASH_DRIFT`。

   | 要素 | 落点 |
   |---|---|
   | execution-map artifact | `contracts/policy/standards-enforcement-execution-catalog.json`（已存在，需改 ROOT 条目） |
   | receipt 产生者 | 每个 leaf gate 的 stdout `successMarkers` + exit code |
   | receipt 消费者 | `standards-coverage` 的 `executeActive` 返回的 ref 集 |
   | exact-set 判据 | `{ACTIVE GATE refs} − {VERIFY_ROOT} − {ARCHUNIT_SELECTOR}` == `executeActive` 返回集 |
   | fail-closed | 沿用上述四个既有错误码，不新增 |

   **必须修的自引用**：catalog 中 `scripts/verify` 条目的 `command` 现为 `scripts/verify --validate-only`（2 个 marker）。若不先改成 root metadata，`executeActive` 会递归 spawn verify，并因 `--validate-only` 当前仍触发 7 次远端 Testcontainers 而把动态命令拖进静态对账。
   **ArchUnit**：catalog 中 `BackendModuleBoundariesTest` 条目的执行单元是 gradle Java selector，不是脚本，单独归 `ARCHUNIT_SELECTOR`，不计入 11 个 leaf。
4. `r5-dev-environment.mjs` 对 `V2S_RUNTIME_ENVIRONMENT` / `V2S_DEV_DATABASE_URL` / `V2S_DEV_ASSET_ROOT` 改为**缺失即 fail-closed**，不再自造默认值。
5. `U11-seed-dry-run` 的输出改名为其实际含义（如 `SEED_FIXTURE_CONTRACT_CROSS_CHECK`），不再暗示做过 seed 预演。
6. `--validate-only` 必须**真实过滤**命令表只跑静态门，并打印 `EXECUTED=n/m`；未跑的东西不许出现在 PASS 行。**在 `verify.mjs` 内改，不新建门**。此项是 **B0a 的前置**，必须先于接线完成。
7. `hmacValue` 改为**对齐 `final-acceptance.mjs` 的既有写法**做密钥重算；红变异补一个**格式合法但内容伪造**的样本。不要做第二套实现。

**耗时不得预先承诺**：11 个待接线 leaf 都是本地静态检查，静态上不必然突破分钟级；但 `foundation-standard-actions` 会重复调用若干检查。**实施后必须实测 verify 总耗时**；若超预算，按既有治理优先处置最弱的门，**不得遗漏任何 ACTIVE leaf**。

---

## 4. C4 · 失败看得懂

| 症状 | 动作 |
|---|---|
| 环境缺失与代码缺陷同一种报错 | 入口前置探测 Docker/gradle/浏览器/远端主机，缺失抛 typed 码；输出必须能区分 `ENV_*` / `TEST_*` / `HARNESS_*`。**不得**用 `assumeTrue` 静默跳过 |
| 硬编码机器路径 | 删掉 `r5-remote-testcontainers.mjs:32` 的 `/opt/homebrew/Cellar/gradle/9.7.0/libexec` 默认值（该路径在本机不存在，仓内也无 gradlew），改为缺失即 fail-closed |
| 单条失败打印 2 万字符源码 | 断言前先定位片段，禁止整份文件作 `assert.match` 的 actual |
| 跨进程首败被泛化 | Java workload → remote runner → verify 逐层传递**原始首败码**，可追加上下文不得替换 |

Codex 报告中属于"让 Testcontainers 能真正跑通"的条目（入口参数非闭包 TSA-M01、受管 DEV 被抢占 TSA-M02、stall 不消费 heartbeat TSA-M06、终态证据生命周期 TSA-S02–S05、readiness 无过程证据 TSA-S06、`Content-Type` 未落 TSA-S07）**属于 C4/C1 同一目标，一并纳入**，按其报告的最小根因修复执行；实施前由作者重开 owning source 复证。

**退役**（Codex TSA-D01–D03）：删 `r5-platform-admin-l2.mjs`、`r5-platform-admin-l2-fixture-seed.mjs` 及其单测。**顺序强制**：先把 `scripts/check/backend-performance-sql-merge-coverage:398-402` 的 fixture 分母迁到 `r5-joint-remote-l2-fixture.mjs` 并补 exact-set + 红变异，**再**删文件。

---

## 5. 沉淀（最小）

**项目记忆**（`project-memory/`，索引由 `scripts/memory/build-index` 生成，不手改 `index.md`）——只加 2 条：

| 文件 | id | 内容 |
|---|---|---|
| `operations/test-closed-loop.md` | `operations.test-closed-loop` | §0 的四条闭环条件即验收标尺；写了的测试必须进 verify；层与工具的对应（U 层 `node --test`、A 层只断言边界事实、C 层用 `renderToStaticMarkup` 不引 jsdom） |
| `pitfalls/green-by-existence-check.md` | `pitfalls.green-by-existence-check` | 三种假绿实例：`existsSync` 冒充强制、自己填默认值再校验自己、`node --test` 空 glob EXIT=0；以及"读源码文本断言 = 改名就红改坏不红" |

已有 `operations/verification-governance.md` 追加指针，避免第二套说法。

**设计约束**：**不动** `standards-coverage-matrix.json` 的 `rules[]`。该文件是冻结文档 `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` 的 1:1 投影（`expectedCounts.total: 150` + 逐条 `textSha256`），追加条目会触发 `SOURCE_COUNT_MISMATCH` 直接打红 `U12-standards`。新约束只进上面两条记忆 + matrix 的 `reviewChecklists[]`。

**门**：**不新建门**。四条闭环的落点分别是——C1 在 `verify.mjs` 内加分母打印；C2 是删除动作（可选：把"U 层不得读被测源码"做成已有 `lint:architecture` 里的一条 ESLint 规则，零新门）；C3 是修 `standards-coverage`、`r5-dev-environment.mjs`、`verify.mjs`、`hmacValue` 四处；C4 是改报错。

---

## 6. 批次与验收

| 批次 | 内容 | 验收 |
|---|---|---|
| **B0a** | ① `--validate-only` 改为 static-only（§3.2-6，**必须最先**，因为 catalog 里 ROOT 条目的 command 就是它）；② 把 catalog 中 `scripts/verify` 条目由 runnable 改为 **root metadata**（去掉 `command`，标 `kind: VERIFY_ROOT`），使 `executeActive` 永不 spawn 它；③ **实际接线** 11 个 leaf 进 verify 命令表，并确认每个都真实输出其 `successMarkers` | `executeActive` 不再 spawn `scripts/verify`；11 个 leaf 全部实跑且 marker 命中；`--validate-only` 不再触发任何动态命令（当前仍触发 U02/U03/U04×2/U05/U06/U07 共 7 次远端 Testcontainers） |
| **B0b** | verify 的 `U12-standards` 由普通模式改为**取回实际执行 ref 集**的模式；`standards-coverage` 用该集做 exact-set 对账，移除 `existsSync` 认证（§3.2-3） | `{ACTIVE GATE refs} 去掉 VERIFY_ROOT 与 ARCHUNIT_SELECTOR` **精确等于** `executeActive` 返回的 ref 集；不等即红 |
| **B0c** | 孤儿门有限 disposition（§3.2-2）；逐断言 disposition 后提取 3 个文件的真值断言（§2.2） | 每个孤儿门有显式 `接线/退役/保留待用` 结论；**提取后由 U08/U09 的 Vitest 保留等价真值断言**（这 3 个是 TS/TSX，仍在 Vitest 下运行，不是 `node --test`） |
| **B1** | 按 B0c 产出的**逐断言清单**删除：33 个纯源码文本文件（整文件）+ 25 个 mixed 中标为源码文本的断言 + `app/` 下 7 个文件的源码文本断言 + 4 个孤儿 `.test.mjs`（整文件）+ A 层实现拼写断言（按判据，非只删今天红的 2 条）。**mixed 中"无真值可保留因而整文件删除"的具体数量由逐断言清单决定，不得沿用粗筛的 22** | 两个 App 测试全绿**且**无残余源码文本断言（两条须同真） |
| **B2** | 入口与分母（§1.2）：接线 27 个 `scripts/**` node 测试、3 个 foundation 测试、8 个缺失 Java 模块 task | verify 打印 `EXECUTED/DISCOVERED` 且相等 |
| **B3** | 假绿修复（§3.2-4/5/7） | DEV 环境变量缺失即红；HMAC 伪造红变异通过 |
| **B4** | 失败可读（§4）+ Codex 的 Testcontainers 族 | `ENV_*`/`TEST_*`/`HARNESS_*` 可分；深层首败最外层可见 |
| **B5** | 退役（§4 末，**先迁门**） | 门分母已迁并有红变异后方可删文件 |

**诚实提示**：B1 不会让 verify 变快——实测 operations-admin vitest 全量 35.3s，排除 `features/**/ui/*.test.tsx` 后 32.5s，仅约 8%，成本在 Vite transform 不在断言。B1 的收益是**红即真红**。

---

## 7. Dexter 已裁决：日常不跑 L2

**裁决（2026-08-11，Dexter）**：日常 `scripts/verify` **不跑 L2**，维持现状，不为此单独立项。

事实记录：`U10-affected-l2` 调的是静态检查 `scripts/check/affected-l2`；Playwright 需要 verify 不提供的 `R5_L2_OPERATIONS_BASE_URL`，所以日常回归本来就一次也不跑 L2。B1 之后，不被 20 个 L2 覆盖、又非纯函数的东西，日常只有 `tsc --noEmit` + eslint + `vite build` 兜底。已知无 L2 覆盖：双 App 的 audit-history、platform-admin 的密码找回与改密、`workspace-administration`。

**由此产生的执行约束**：
- 本次整改**不得**以"补 L2 覆盖"为由扩大范围；L2 仍只在受管 L2 运行中执行。
- §2.2 的删除照常执行，**不因这三处无 L2 覆盖而保留其源码文本断言**——那些断言本来就不提供行为保障，留着只会继续制造假红。
- 这三处的行为保障缺口**登记进 `HANDOFF.md` 欠账**（与 §8 同批），不在本次做。
- 此裁决不构成"日常回归已覆盖 UI 行为"的依据；任何交付说明不得如此表述。

---

## 8. 本次不做，登记欠账

按"只求健康闭环"筛掉、但已证实存在的问题，登记到 `HANDOFF.md` 不在本次做：

- 门 `--self-test` harness 自身：`tools/verify-gates/cli.mjs:1084-1086` 用裸 `catch` 判红，**不校验失败码**（12 个 action 中 8 个走此路，已实证 `openapi` 的红是错原因）；`:799-804` 在建立干净基线前先篡改输入，使 9 个 surface 的 15 条判据对 self-test 永久不可见。
- L2 场景 switch 的 `default:` fail-open（`catalog-inventory.spec.ts:501-502` 未映射场景静默降级为"testId 可见"）；`tools/catalog-inventory-p4/cli.mjs:69` 的 `43` 是硬编码而策略文件为 41。
- verify 的 `CLEANUP=PASS` 是 stdout 子串匹配，非整行锚定。
- 后端 I 层依赖单台共享远端主机且不可重入（残留资源会让后续所有后端门失败，两个会话不能并发跑 verify）。
- **无法提纯的复杂 UI 组件缺行为保障**：AntD + RTK Query + Redux + router 的业务组件（`CatalogItemDrawer`、`StoreCreateDrawer` 等）既不适用 `renderToStaticMarkup`，日常 verify 又不跑 L2（§7 已裁决）。本次不补，登记欠账。**不得用静态渲染冒充行为保障。**
- 三处无 L2 覆盖的面：双 App 的 audit-history、platform-admin 的密码找回与改密、`workspace-administration`。

## 9. 初稿被证伪的 6 处（不要引用旧结论）

| # | 初稿说法 | 复算结果 |
|---|---|---|
| 1 | 前端"0 渲染"，建组件层需引入 jsdom | 错。`OperationsRequiredScopeSurface.test.tsx` 用 `renderToStaticMarkup` 真渲染，零依赖 |
| 2 | 删 58 个文件，"删除不降低真实覆盖" | 错。58 = 25 mixed + 33 纯，按文件删会毁掉 25 个文件的真值断言 |
| 3 | "`catalogModel` decoder 已有覆盖且今天全绿" | 错。唯一覆盖就是待删文件，且今天正红 |
| 4 | "已被 `catalog-inventory-query-envelope.test.mjs` 守住" | 自相矛盾。该文件正是"无权威入口执行"集合成员 |
| 5 | "按现有 schema 追加 `rules[]` 条目" | 错。追加即打红 `U12-standards` |
| 6 | "交互交给 L2 兜底" | 错。verify 一次也不跑 L2 |

另修正：无入口测试 29 → 34+；`--validate-only` 影响面 U02–U05 → U02–U07 共 7 次；A 层"23 条断言"→ 约 224 条；"6 处空 catch"→ 7 处 catch、0 处空体（4 处命名 `ignored`，2 处带解释注释，应逐条评估而非"清零"）；Java "116 个测试"→ 108 个含 `@Test`（8 个是非测试夹具）；"一到测试就 fail"是会话外事实，标 `UNVERIFIED_EXTERNAL`。

### 9.1 第二稿经 Codex 独立复核（NO-GO M=2/S=2/N=3）后的修订

| Codex 项 | 我的复算 | 本稿修订 |
|---|---|---|
| M-01 B0 递归与顺序缺口 | **成立**。16 个 ACTIVE GATE ref 中确含 `scripts/verify` **自身**（它不会引用自己，故被我误算进"12 个待接线"）。照原文接线即递归 spawn | 真正 leaf 为 **11 个**并逐个列名；`scripts/verify` 定为 `VERIFY_ROOT`；B0 拆为 **B0a/B0b/B0c**，static-only `--validate-only` 前置 |
| M-02 "25 个都含真值断言"未成立 | **成立，且比其更锐**。逐符号复算：25 个文件级 mixed 中只有 **3 个**真正调用被导入符号，**22 个**只把契约常量当 needle 喂给 `toContain(源码)` | 切分改为 **3 真值 + 55 源码文本**；先做**逐断言 disposition** 再提取 |
| S-01 `renderToStaticMarkup` 不可泛化 | 采纳 | 明确其仅适用于无 effect/无 query/无导航/无 portal/无交互状态的受限组件；复杂 UI 登记欠账 |
| S-02 B0 验收措辞 | 采纳 | 改为"由 U08/U09 的 **Vitest** 保留等价真值断言"；27 个 node 测试接线仍归 **B2** |
| N-01 显式 glob | 一致，保持 | 不变；新增目录必须显式加入有限清单 |
| N-02 catalog/inventory 引用面 | **成立** | 改为"被 backend-unit、joint L2、test-independence 三者引用，**但三者都不是 verify 入口**" |
| N-03 "32 个零调用方"口径 | 采纳 | 改为**有限 disposition**；明确零引用不足以退役，仍需五 package 未触发证据 |
| 分钟级取舍 | 采纳 | 明确**不预先承诺时长**，实施后实测；超预算按既有治理砍最弱门，不得遗漏 ACTIVE leaf |

### 9.2 第三稿经 Codex 最终复核（NO-GO M=2/S=1/N=0）后的修订

| Codex 项 | 我的复算 | 本稿修订 |
|---|---|---|
| M-01 B0b 未定义 receipt 生产/传递路径 | **成立**。复算确认：`verify.mjs:22` 的 `U12-standards` 走的是普通模式，执行 ref 集只存在于 `standards-coverage` 的 `executeActive`；且 `standards-enforcement-execution-catalog.json` 的 17 条里，`scripts/verify` 条目 `command` 就是 `scripts/verify --validate-only`（2 marker）——启用 execute-active 会递归 spawn 并把 7 次远端容器拖进静态对账 | §3.2-3 补全 execution-map / producer / consumer / exact-set / fail-closed 五要素表，**沿用既有 catalog 与四个既有错误码，不新造 schema**；B0a 改为**实际接线 11 个 leaf 并产出 marker**（不再是只"定义映射"），并明确 ROOT 条目须改为 root metadata、`--validate-only` static-only 是其前置；ArchUnit 条目归 `ARCHUNIT_SELECTOR` 不计入 11 leaf |
| M-02 "3 真值 + 55 源码文本"不准确 | **成立，且暴露我判据的假阴性**。正确表述是 3 个**文件**含应保留断言；`CatalogManagementPage.test.tsx` 单文件就有 7 处直接值断言。`envelopeData` 确在 `:94-95` 以 `toEqual` 做全对象断言，我初次扫描用 `\b符号\s*\(` 匹配，**漏掉泛型调用** `envelopeData<{...}>(...)` | 改为 **assertion-level inventory**：三个文件逐个列出保留符号与调用次数；明确"3+55 条断言"不得作验收分母；并写明我的粗筛判据有假阴性，25 个文件须用覆盖泛型调用的判据**重新逐条过一遍**；B1 的删除量改为由逐断言清单决定，不得沿用粗筛的 22 |
| S-01 根/child 分类可保留 | 一致 | 模型不变，按 M-01 落为真实 execution/receipt contract |

## 10. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署；不得据此宣称任何动态、业务、cleanup 或性能结果。Java 测试、Testcontainers、L2 三层本次未执行，相关判断均为静态。
