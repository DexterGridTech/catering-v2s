SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER 可读性整改 · implementation-facing 详设

## 0. 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-requirements-claude.md
HISTORY_ONLY_SOURCE=doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-analysis-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
OBSERVABILITY_SOURCE=doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
ARCHITECTURE_SOURCE=project-memory/decisions/terminal-architecture-and-stack-rulings.md
BUILD_ORDER_SOURCE=project-memory/decisions/terminal-build-order-and-batches.md
TEMPLATE_SOURCE=doc/decisions/templates/implementation-design-template.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON（本专题只改变代码可读性、目录与开发期诊断，不改变用户 Journey）
IA_REF=NOT_APPLICABLE_WITH_REASON（无页面、表单、导航或用户可见交互变更）
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON（无用户操作契约；startup 日志是开发者诊断输出）
AUTHORIZED=详设与实施计划已获 Dexter 授权；设计 finding M-1/S-1/S-2 已由主 agent 按授权自闭合；进入 CP-0..CP-6 实施
NOT_AUTHORIZED=新增依赖、公共 platform-ports 契约、Android/Web 运行、生产 bundle、DEV、seed、UAT、部署或设备策略变更
IMPLEMENTATION_AUTHORITY=true
REVIEW_CYCLE_ID=TER_READABILITY_DESIGN_2026_09_07
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
```

Roadmap 只记录 program 的授权字段；本轮实施授权来自 Dexter 本会话及已处置的第二轮设计 review。
本文不把当前源码静态事实写成已运行或已验收事实；动态证据仍按实施计划的证据档位单独取得。

分析稿已经被正式需求 supersede，只能用于解释历史裁定；设计输入只读正式需求、既有规范、
项目记忆和当前 owning source。本文所有源码路径均为仓根相对路径；行号只作为当前定位，
实施时以符号和 AST 结构复核，不把行号当稳定身份。

## 1. 第一性目标与方案选择

### 1.1 要解决的真实问题

后续人类开发者现在需要靠文件名、所在层和隐含习惯猜测职责；同类文件散在 `src/` 根、
`model/`、`supports/`、`rnr/` 等非统一目录，测试逃生口还被生产模块直接 import。另一方面，
启动时只有零散的普通日志，读者看不出本次运行实际装配了哪些 module、slice、command、actor、
port、part 和 surface。

本专题因此只做四件相互闭合的事情：

1. 用一张不按层分叉的 15 项目录词表给每个现存源文件一个合法住址；
2. 把 7 条有实例的可读性规则写进既有规范，并让 6 条可机械判定的规则都有真实红夹具；
3. 在不改变业务语义的前提下，归位散文件并按职责拆 3 个会改变执行边界的单元；
4. 在开发构建中由事实 owner 打印 7 组结构化启动事实，并用同一 `startupRunId` 与终态把分层日志串起来。

不做目录编号、不改 package/module/npm 名、不改 command 或 slice 契约、不引入依赖，不把
“文件/函数行数上限”偷偷恢复成规则，也不把 R 档语义伪装成正则门。

### 1.2 方案比较

| 方案 | 处理方式 | 判断 |
|---|---|---|
| A · 只搬文件，靠 review 判断剩余习惯 | 可以快速减少根目录散文件，但目录词表、生产 graph 和 R/L 档位没有可复核闭包；下一次重构会回退 | 拒绝 |
| B · 为所有规则建立 hash/path 基线与跨层聚合器 | 能留下大量台账，却把已退役的 compliance-control 控制面带回本专题，并让 startup 失去 owner 边界 | 拒绝 |
| C · 15 项词表 + 7 条规则 catalog/manifest + L AST checker + R review；owner 直写 startup 事实，logger 只做关联/终态 | 使用当前已有 TypeScript AST、LoggerPort、catalog、onLayout 和 `__DEV__` 编译期常量；改动可按层收口，职责拆分有测试前置 | **采用** |

我选择 C 而不是 A/B，因为它只增加能回答当前实例的最小控制面：规则 catalog 不保存 hash、路径
或批次；startup 不让 assembly 反向读取 kernel；日志关联器不拥有七组事实，只观察 owner 已写出的
类别。这样既能红，又不把已裁退役的台账或新跨层框架带回仓库。

### 1.3 证据档位

- **静态已知**：正式需求列出的 27 个 package、15 项目录词表、12 个包/35 个散文件、现有
  `createRuntime.ts` 的 `src/testing` import、`InputSurfaceFrame` 第 37 行的 `View.onLayout`、
  `LoggerPort` 的 `data` 形状，以及当前 module/catalog/port 类型。
- **设计规定**：本文件的目标路径、AST 算法、descriptor sidecar、startup 字段、阶段顺序和红夹具。
- **实施后才可证明**：真实生产 bundle 的 DCE、完整 test/typecheck、三处职责拆分前后 behavior oracle、
  Android/Web 真实日志。本文不得把这些写成 PASS。
- **未决/停机**：若现有 Metro/Expo 构建不能把 `__DEV__` 当成编译期常量消除 startup 代码，或
  不扩展公共 `PlatformPorts` 就无法从实际 port 对象取得 per-capability descriptor，必须停止并交 Dexter，
  不得用 `environmentMode` runtime flag、端口探测、对象 identity 或公共契约扩展绕过。

## 2. CP 总览与原子边界

| CP | 范围 | 主要输出 | 进入条件 | 退出条件 |
|---|---|---|---|---|
| CP-0 | 规范与 checker 契约 | 既有规范新增词表/规则；`rule-catalog.json`、`checker-manifest.json`、checker 模型红夹具 | 本详设获 DESIGN GO | 文档与 manifest 可逐条对照；不运行、不启用门 |
| CP-1 | `kernel/base` 批 1 | `supports` 归位、testing registry 拆分、dispatcher/persistence 按职责拆；职责→测试矩阵 | CP-0；三处矩阵完整且缺口已先补测试 | focused proof + 独立阶段三维对账 MATCHED |
| CP-2 | `kernel/feature` 批 2 | 12 个散文件按词表归位；仅改 import/export 路径 | CP-1 阶段对账 | focused proof + 独立阶段三维对账 MATCHED |
| CP-3 | `ui/base` 批 3 | model/rnr/context/dev-host/primitives/render/input 归位；InputProvider 按职责拆；4 处 createElement 改写 | CP-2 阶段对账 | focused proof + 独立阶段三维对账 MATCHED |
| CP-4 | 批 4 其余层 | ui feature、integration、adapter、assembly 归位；最后启用全部 L 门 | CP-3 阶段对账 | RD-1/2/4/8/9/11/13 等机械门真实全绿 |
| CP-5 | 批 5 startup | 七组 owner 日志、descriptor、surface measurement 传递、终态和生产 DCE 证明 | CP-4；不改公共 platform-ports 三个类型 | focused proof；未授权真实设备/DEV 运行不写成已验 |
| CP-6 | 全批收口 | 阶段/整体三维对账、逐代码与详设对账、交付 brief | CP-0..5 均完成 | 所有 OPEN 已闭合；才可交 Dexter/Claude 做实施后静态 review |

批 1 单独走一轮完整评审。它同时触及全部 27 个包依赖底座、testing graph 与两个高耦合职责拆分，
因此不与批 2–4 合并；批 5 不提前插入，因为它依赖批 0–4 的最终路径和运行时事实源。

## 3. 模板横切机制对照表

本专题不是业务 Journey、HTTP、数据库或 UI 交互变更，模板要求的固定行不删除；不适用项以理由
明确写出，避免把空白误读成漏项。

| 模板机制 | 当前能力/精确锚点 | 可做观察 | 本批确定形态 | 适用范围 |
|---|---|---|---|---|
| reader node authorization | N/A：无 HTTP/read model | `rg` 证明无新增 route/HTTP owner 依赖 | 不引入 API 读取 | 全批 |
| write authorization/grant | N/A：无业务写入 | source diff 无 command payload/actor owner 变化 | 不改变 command/slice | 全批 |
| cross-owner write/transaction | N/A：无 DB/owner 写入 | 包依赖与 import graph 不新增跨业务写边 | 不建 transaction | 全批 |
| collection shape/pagination | `tools/terminal-readability/rule-catalog.json` 是 7 项有界清单；runtime/catalog 事实来自既有 bounded arrays | JSON 解析后 exact 7 rule IDs；日志输出 count 与 entries 对应 | 不把日志变成无界 registry | catalog、startup facts |
| cache invalidation/refresh | N/A：没有远程缓存 | 无 cache client/import；源码语义保持 | 不新增缓存 | 全批 |
| RTK currentData/isFetching | N/A：本专题无 RTK | `rg` 新增源码零 RTK 读取 | 不适用 | 全批 |
| same fact one home | `createPlatformPorts`、runtime descriptors/actorRegistry、ui catalogs、InputSurfaceFrame `onLayout` | 各组日志 data 可追溯到 owner 事实源；不得手写第二份业务事实 | descriptor/registry/catalog/measurement 分家 | startup 七组 |
| failure visible/no rewrite | `check-static.mjs` 失败带 path/line；startup.failed 记录失败 owner | red fixture non-zero；错误事件不改写为 complete | 失败先保留、无 fallback | checker、startup |
| owner error→HTTP mapping | N/A：无 HTTP | 无新的 problem/HTTP mapping | 不适用 | 全批 |
| idempotency | N/A：无远程 command | 无新增 request/replay API | 不适用 | 全批 |
| generated strings | 现有 moduleName/dependencies 与 package metadata | 新增 rule IDs/category/key 只在其唯一 source 定义；不复制业务文案 | 不生成业务契约字符串 | 规范/checker/startup |
| logging/masking | `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts::createLogger`、`sanitizeLogEvent` | sink 收到 sanitized `LogEvent`；startup data 不含业务输入、密码、token、手机号 | 所有 startup 仍走既有 sanitizer | startup |
| migrations | N/A：无数据库 schema | 无 migration/seed 文件变更 | 不适用 | 全批 |
| shared frontend behavior | N/A：不改业务共享 UI 行为；input/render 只做目录/语义不变拆分 | focused behavior oracle 前后观察相同 | 不引入新 foundation 旁路 | ui/base |
| candidate/dropdown source | N/A：无候选/下拉 | 无新增 candidate source | 不适用 | 全批 |
| encoding/names | `rule-catalog.json` 两列；15 项目录词表；现有 `moduleName` 不动 | exact names/paths；禁止 journey ID 进入 runtime/test 名 | 能力命名，不创建流程命名 | 规范、文件、工具 |
| atomic group | CP-1/3/5 各自含 source、test、import graph 与 readback | 任一组阶段对账 OPEN 即停，不进入下一 CP | 按 CP 原子闭合 | CP-0..6 |

模板 §3a、§9a、§10、§11 在本文均 `NOT_APPLICABLE_WITH_REASON`：没有 UI Journey、业务事实、HTTP
operation、数据库、migration、seed 或 L2；但测试 oracle、日志脱敏与全批对账仍按模板和项目记忆执行。

### 3.1 owner、传递与消费者

| owner fact/API | 事实如何传递 | 允许消费者 | 禁止消费者/证明方式 |
|---|---|---|---|
| `platform-ports::createPlatformPorts` 的 private descriptor reader 与 startup tracker | 绑定工厂的非枚举 sidecar → `createPlatformPorts` → 同一 logger 的 `startup.ports` | platform-ports 自己的 startup writer、既有 logger sink | assembly 读取私有 sidecar；端口探测；defaults identity |
| `runtime::createRuntime` 的 module descriptors、actorRegistry | 已存在 arrays/maps → runtime owner 的四个摘要事件 | runtime startup diagnostics | assembly 反向读取 runtime 私有对象；手写第二份 module/slice/actor 事实 |
| `kernel-base-ui-state::UiCatalog.entries` 与 `RendererCatalog.resolve` | catalog entry → `RenderProvider` effect → `startup.parts` | render logger | DOM/组件树反推；扩展 RendererCatalog 公共枚举 API |
| `InputSurfaceFrame::handleSurfaceLayout` 的真实 View `onLayout` | LocalFrameMetrics → `SurfaceInputFrame` callback → `startup.surfaces` measured event | sample-console assembly 的日志适配 | declared baseline、dev-host preview viewport、其他 surface measurement |
| `terminalSurfaces` package metadata | `sample-console` assembly 创建 surface 前 → `startup.surfaces` declared event | startup diagnostics | 下传给 input 参与布局；把 baseline 当 measured frame |
| `rule-catalog.json` 与 checker manifest | catalog tier 反查 manifest → `check-static.mjs` dispatch | static checker tooling | 只执行 manifest 已登记项；R 规则进入 checker |

每行都必须能在实施后的源码与 focused evidence 中观察到；表本身不能代替行为证据。

## 4. 15 项目录词表与精确归位

实施时把正式需求 §4 原样并入 `doc/platform/terminal-coding-standard.md`，不另造规范正本。
`src/` 根只允许 `index.ts`、`moduleName.ts`、`dependencies.ts`，以及下列目录；目录可按包需取用，
不得因为“看起来统一”给每个包补空目录。

| 目录 | 允许内容 | 本批重点 |
|---|---|---|
| `types/` | 纯 type/interface/类型级常量，零运行时值 | `input/types.ts`、feature `types.ts` |
| `foundations/` | 纯函数/纯工厂，不触 store/网络/平台 API、无 React | `model`、`supports`、`surfacePreview`、testing registry |
| `implementations/` | 已声明端口的真实实现，可触达平台 API | Android 三 adapter、webPlatform/webStorage |
| `features/` | command 驱动业务单元；固定 `actors/commands/slices/variables` | `variables.ts` 进入 `features/variables/` |
| `selectors/` | 跨包读的唯一入口 | 两个 kernel feature `selectors.ts` |
| `application/` | module descriptor/runtime factory 组装入口 | feature `module.ts`、console descriptor/terminal baseline |
| `components/` | React 组件及直接产出 ReactNode 的渲染函数 | `testExpoApp`、`resolvePart` |
| `hooks/` | 一文件一 `useX` hook | 本批不新增 hook 目录 |
| `contexts/` | context 定义及 Provider | `input/context.ts` |
| `defaults/` | 已声明端口默认/不可用实现 | 不承接真实 adapter |
| `parts/` | `definePart` 产物声明 | member desk parts |
| `assembly/` | module/catalog/surface 装配 | console assembly、sample platformPorts |
| `theme/` | 设计 token | 不改主题 |
| `vendor/` | 外部仓内拷贝，原样保留 | `primitives/src/rnr/` |
| `testing/` | 测试逃生口；不公开且生产 graph 不可达 | runtime testing 只留测试读取侧 |

### 4.1 存量归位清单

以下是实施时逐条执行的 12 个包/35 个散文件分母；路径移动只改 import/export，行为与测试断言语义不改。

| 包 | 去向 |
|---|---|
| `apps/terminal/kernel/feature/sample-member-registry` | `commands.ts`→`features/commands/`; `slice.ts`→`features/slices/`; `selectors.ts`→`selectors/`; `types.ts`→`types/`; `errors.ts`→`foundations/`; `module.ts`→`application/` |
| `apps/terminal/kernel/feature/sample-staff-session` | 同上 6 类去向 |
| `apps/terminal/ui/feature/sample-member-desk` | `assembly.ts`→`assembly/`; `commands.ts`→`features/commands/`; `module.ts`→`application/`; `parts.ts`→`parts/` |
| `apps/terminal/ui/feature/sample-staff-auth` | 同上，并将 `variables.ts`→`features/variables/` |
| `apps/terminal/ui/base/dev-host` | `testExpoApp.tsx`→`components/`; `surfacePreview.ts`→`foundations/`; `webPlatform.ts`/`webStorage.ts`→`implementations/` |
| `apps/terminal/ui/integration/sample-console` | `assembly.tsx`→`assembly/`; `baseModuleDescriptors.ts`→`application/`; `terminalSurfaces.ts`→`application/`（该文件读取并校验 package metadata，是运行时组装事实，不是纯类型文件） |
| `apps/terminal/ui/base/input` | `context.ts`→`contexts/`; `types.ts`→`types/` |
| `apps/terminal/ui/base/primitives` | 将 `components.tsx` 的类型移 `types/`，24 个控件按职责一文件一控件移 `components/`；导出集合保持一致 |
| `apps/terminal/adapter/android/device` | `androidDevice.ts`→`implementations/` |
| `apps/terminal/adapter/android/dual-screen` | `imeInsets.ts`→`implementations/` |
| `apps/terminal/adapter/android/persist-kv` | `androidPersistKv.ts`→`implementations/` |
| `apps/terminal/assembly/android/sample-terminal` | `platformPorts.ts`→`assembly/` |

目录改名只有：`ui/base/input/src/model/`→`foundations/`、`kernel/base/state/src/supports/`→`foundations/`、
`ui/base/primitives/src/rnr/`→`vendor/`。`kernel/base/runtime/src/testing/` 保留原名，按 TR-R07 处理。

`surfacePreview.ts` 的归位依据是当前文件没有 React 引用，只有类型和纯几何函数；它进入
`foundations/`，不是 `components/`。`resolvePart.ts` 的 `createElement` 是唯一明示例外，且因直接
产出 ReactNode 进入 `components/`；例外只出现在 `TR-R03` allowlist，不扩展为通配。

## 5. 规则 catalog、checker manifest 与 AST 门

### 5.1 文件落点和格式

新增工具只放在 `tools/terminal-readability/`，复用仓内 TypeScript AST、`tools/terminal-shared`
的 package/path 辅助，不引入依赖。

| 文件 | 唯一职责 |
|---|---|
| `tools/terminal-readability/rule-catalog.json` | 只有 7 行、两列：`ruleId` 与 `tier`；不含 hash、路径、checker、批次或 owner |
| `tools/terminal-readability/checker-manifest.json` | 只列 L 规则的逻辑 `ruleId`、`checkerId`、`enabled`；不列 R 规则，不含源码路径/hash/批次 |
| `tools/terminal-readability/check-static.mjs` | 真实树 checker、catalog/manifest 反查、生产 graph 与目录扫描 |
| `tools/terminal-readability/check-static.test.mjs` | 每条 L 规则的 red/negative control、RD-8/9/11/12/13/14 的模型夹具 |
| `tools/terminal-readability/check-production-bundle.mjs` | 用已存在的 Expo/Metro 构建能力验证 `__DEV__=false` 产物无 startup 诊断代码；不新增依赖 |
| `tools/terminal-skeleton/verify-static.mjs` | 把 readability model/real static 两个子步骤接入既有 terminal static sequence；批 4 才因 manifest enabled 执行完整真实树门 |

`rule-catalog.json` 的唯一内容形态：

```json
[
  {"ruleId":"TR-R01","tier":"R"},
  {"ruleId":"TR-R02","tier":"L"},
  {"ruleId":"TR-R03","tier":"L"},
  {"ruleId":"TR-R04","tier":"L"},
  {"ruleId":"TR-R05","tier":"L"},
  {"ruleId":"TR-R06","tier":"L"},
  {"ruleId":"TR-R07","tier":"L"}
]
```

`checker-manifest.json` 的实现形态：

```json
[
  {"ruleId":"TR-R02","checkerId":"tr-r02-local-export" ,"enabled":false},
  {"ruleId":"TR-R03","checkerId":"tr-r03-create-element","enabled":false},
  {"ruleId":"TR-R04","checkerId":"tr-r04-parameter-count","enabled":false},
  {"ruleId":"TR-R05","checkerId":"tr-r05-control-depth","enabled":false},
  {"ruleId":"TR-R06","checkerId":"tr-r06-source-layout","enabled":false},
  {"ruleId":"TR-R07","checkerId":"tr-r07-testing-graph","enabled":false}
]
```

批 0 只创建两份清单和 checker 模型；批 4 在所有迁移/拆分完成后把 6 个 `enabled` 一次改为 `true`。
checker 通过内置 `CHECKERS[checkerId]` 逻辑映射，不把实现文件路径写进 manifest。任何 unknown rule、重复
rule、tier 不匹配、R 规则出现或 L 规则缺 entry 都失败。

### 5.2 统一扫描分母

- `TR-R01..TR-R07` 的源代码分母是 `apps/terminal/**/src/**` 中本仓 TS/TSX 源文件，包含
  `src/testing/**`；排除 `node_modules/`、`.turbo/`、`.expo/`、`build/`、`dist/`、Android generated tree
  以及 package 外的 `test/**`/checker fixture。只有 TR-R07 的 production graph 从 package `src/index.ts`
  出发并把测试入口排除；checker 自身的 red fixture 单独运行。
- `TR-R06` 以每个 package 的 `src/` 根为单位读取 package manifest；本仓测量分母为 27 个 packages，
  分三层判定：`src/` 根 direct children 中，文件只允许 3 个法定文件、目录必须属于 15 项闭合词表；
  若存在 `src/features/`，其 direct children 目录只允许 `actors`、`commands`、`slices`、`variables`；
  `features/` 之下更深层目录不受本目录名 checker 约束，不递归猜职责。
- `TR-R07` 从每个 package 的 `src/index.ts` 生产入口只追 runtime value import/export，必须按 production
  import graph 读取实际 runtime edge；`import type` 与 type-only export 只解析语法、不计 runtime reachability，
  不单独触发本规则；测试入口和 `./testing` 子路径不进入该分母。
- 真实树 gate 与 model fixture gate 使用同一 AST resolver 和同一 `CHECKERS`，禁止“模型一套、生产另一套”。

### 5.3 七条规则的确切判定

| 规则 | checker/档位 | AST/图算法 | 排除项 | red fixture | negative control |
|---|---|---|---|---|---|
| TR-R01 | R；不进 manifest | 不做机器语义判定；review 读取 owning source 的变更理由和职责→测试矩阵 | 不以行数替代职责；不以关键词判单职责 | 将两个已有职责合回同一函数且移除职责边界 | 两个理由明确、各有 oracle 的单元 |
| TR-R02 | `tr-r02-local-export` | 对每个非 `index.ts` SourceFile 找 `ExportDeclaration`；`moduleSpecifier` 缺失的本地 export block 一律违规。定义处的 `export const/function/class` 合法；带 module specifier 的 re-export 合法 | 所有 `src/**/index.ts` 是公共入口例外；只忽略 trivia，不忽略语句 | 文件最后加入 `export {a, b}` | 定义处 export；index.ts 的显式公共 export；`export {a} from './b'` |
| TR-R03 | `tr-r03-create-element` | TypeChecker 解析 `react` 的 `createElement` named import 与 namespace `React.createElement` 的 CallExpression；别名也解析到同一 symbol | 唯一 allowlist：`apps/terminal/ui/base/render/src/components/resolvePart.ts` | 非 allowlist `.tsx` 调 `createElement` | JSX；普通函数；allowlist 中的动态 part renderer |
| TR-R04 | `tr-r04-parameter-count` | 访问有 body 的 FunctionDeclaration/Expression/Arrow、Method、Constructor、Accessor；`parameters.length > 3` 失败。解构参数按一个参数计，rest 也按一个计 | 无 body 的 overload/type signature 不算可执行函数 | 4 个位置参数的 arrow/function | 3 个参数；将 4 个值收进一个对象参数 |
| TR-R05 | `tr-r05-control-depth` | 每个 function-like 建独立 depth=0 visitor；进入 `if`、`for/for-in/for-of`、`while`、`switch`、`try` 时 child depth+1；`switch case`、`catch`、`finally` 不额外加层；遇 nested function 只新开 visitor，不计入外层；depth>3 失败 | 三元、conditional、`&&`/`||`/`??`、case clause 不计；类型节点不计 | 4 层词法控制嵌套 | 3 层控制嵌套；4 个三元/短路但控制深度≤3 |
| TR-R06 | `tr-r06-source-layout` | 三层判定：枚举 27 个 package `src/` 根 direct children；根 file 只允许 3 个法定名、根 directory 必须属于 15 项 vocabulary；对每个 `src/features/` 再枚举 direct children，目录只允许 `actors`、`commands`、`slices`、`variables`；`features/` 更深层不受本规则目录名约束 | 非 package/generated 目录不计；`features/` 不存在时不虚构；更深层不按文件名猜职责；`testing/` 仍只按 graph 另判 | 根新增 `misc.ts`、`src/unknown/` 或 `src/features/misc/` | 所有根目录合法；`src/features/actors/` 等四项合法；`src/features/actors/foo/` 的更深层目录不由 TR-R06 判定 |
| TR-R07 | `tr-r07-testing-graph` | 以每个 package `src/index.ts` 为 entry，TypeScript resolve 生产 runtime value imports/exports；若可达文件位于同 package `src/testing/**`，失败。type-only import/export 只解析语法、不计入 runtime reachability，故不会单独触发本规则。共享 `foundations/` 合法 | 测试 source、包内测试深路径、跨包 `./testing` consumer 不作为 production entry；type-only edge 不计 | 生产 entry 直接 import `src/testing/startupDiagnostics.ts`，即使 index 不 export | 生产只 import foundations registry；测试走 `./testing` |

TR-R02 的“文件末尾”实例按更强安全定义执行：只要非 index 文件存在本地 export block，就失败，
不会因为在中间插入 export 而漏过；这直接实现“export 写在定义处”。TR-R05 不使用调用次数、源码
字符串或 eslint 输出作为唯一证明，红夹具必须由 AST visitor 的观察结果触发。

### 5.4 RD-7、RD-9、RD-11 的反假绿设计

1. **RD-7**：`check-static.mjs` 的 production graph resolver 不搜 `startup.` 字符串，而检查真实
   module edge。model fixture 的 production entry import `startupDiagnostics.ts`，该 fixture 内用
   `['startup', '.', 'ports'].join('')` 动态生成 category；graph gate 必须红，证明它检查 reachability。
   真实批 5 再执行 `check-production-bundle.mjs`，对 `__DEV__=false` bundle 检查 startup emitter 代码
   被消除；两种证据分开，不把静态 fixture 当真实 bundle。
2. **RD-9**：读取 catalog 的 7 行，断言所有 `tier='R'` 不在 manifest；model mutation 把 TR-R01
   加进 manifest，checker 必须红。R 规则不允许因为写了 regex 就获得 checker entry。
3. **RD-11**：读取 catalog 反查所有 `tier='L'`，逐一要求 manifest entry 且 `enabled=true`；删掉
   任一 entry 或只跑 manifest 已登记的 5 条，model gate 都必须红。批 4 末尾才打开全部 6 条，批中不
   运行这些真实树门。

## 6. testing graph 拆分的精确设计

当前 `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` 第 47–48 行 import
`src/testing`，原因是 register 与测试读取函数和 WeakMap 同模块。最终形态如下：

| 文件 | 内容 | 允许消费者 |
|---|---|---|
| `apps/terminal/kernel/base/runtime/src/foundations/runtimeResourceAccessorRegistry.ts` | 一个模块级 `WeakMap<Runtime, RuntimeResourceRegistry>`、`registerRuntimeResourceAccessor`、内部读取/释放原语 | production `createRuntime` 与同包 testing 读取侧 |
| `apps/terminal/kernel/base/runtime/src/foundations/runtimeStateSyncAccessorRegistry.ts` | 一个模块级 `WeakMap<Runtime, () => StateRuntime \| undefined>`、`registerRuntimeStateSyncAccessor`、内部读取原语 | production `createRuntime` 与同包 testing 读取侧 |
| `apps/terminal/kernel/base/runtime/src/testing/releaseRuntimeForTest.ts` | 只暴露测试 release；从 foundations 取同一个 registry，不再声明 WeakMap/register | package `./testing` 与包内 testing 深路径 |
| `apps/terminal/kernel/base/runtime/src/testing/runtimeStateSyncForTest.ts` | 只暴露测试读取；从 foundations 取同一个 registry，不再声明 WeakMap/register | 包内测试深路径与既有 consumer |
| `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` | 从 `foundations/` import 两个 register；生产不触达 `testing/` | production |

共享一个 foundations registry 是设计要求，不要求 production/test graph 互不相交；必须证明的是
production entry 不可达 `src/testing/**`，否则会因为拆成两份 WeakMap 而读不到生产注册对象。

工具复用 `tools/terminal-shared/typescript-analysis.mjs` 的 TypeScript resolution 形态，新增
`tools/terminal-readability/check-static.mjs::collectProductionImportGraph`；执行入口是
`node tools/terminal-readability/check-static.mjs --rule TR-R07`，批 4 由 `verify-static.mjs`
在既有 TER static sequence 中调用。静态 graph 不执行模块、不调用 factory、不按 export 集合猜可达性。

## 7. 按职责拆分与职责→测试前置

### 7.1 分母反推规则

三处拆分的职责分母不取正式需求里的“至少 N 项”示例，而按以下顺序从 owning source 反推：

1. 打开当前 source 的完整 AST 与所有 exported/private symbol；列出每个 closure、class method、状态字段和
   error/result discriminant，不按文件名猜。
2. 从入口到副作用画状态转移：输入校验、状态写入、外部 port/store 调用、异步完成/超时/late completion、
   cleanup、错误映射、通知/日志；同一转移链不能被拆成两个无主职责。
3. 打开该 owner 的全部 `test/**/*.test.ts(x)`，把每个测试的真实断言映射到 symbol、状态转移和失败分支；
   只出现 mock 调用次数而没有可观察结果的测试不能算 behavior oracle。
4. 形成表后逐项审：每一行必须有 source symbol、职责事实、至少一个 focused behavior oracle；无 oracle 的行
   先补测试，补测仍不得改变业务断言语义，然后才允许改变执行边界。

### 7.2 对照表格式

实施前新增工作文档（不是 evidence/hash 台账）：
`doc/plans/platform/2026-09-07-v2s-terminal-readability-remediation-responsibility-test-matrix-codex.md`。
每行固定字段如下：

```text
ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction
```

`preObservation`/`postObservation` 必须是返回值、状态快照、持久化内容、订阅通知、真实焦点/内容或可见
错误等结果；不得只写“函数被调用一次”。表尾给出 `DENOMINATOR_SOURCE=owning source AST + all owner tests`
和每个 owner 的行数，行数只是核对数量，不是职责判据。

### 7.3 三处预期职责族（不是冻结分母）

| owning source | 反推时至少检查的事实族 | 不能直接当完成条件 |
|---|---|---|
| `kernel/base/runtime/src/foundations/createCommandDispatcher.ts::createCommandDispatcher` | definition/request 校验；request/chain budget；actor invocation/result；journal/ledger；timeout/late completion；peer gateway；reset；resource/cleanup；lifecycle event | 本表的 9 项不是“最终就是 9 项”；必须回到实际 symbol/transition 与 16 个 runtime tests |
| `kernel/base/state/src/foundations/persistenceEngine.ts::PersistenceEngine` 与 `hydrateStateRuntime` | entry descriptor/encoding；storage kind/migration；grouping；hydrate；debounce/queue/health；flush/immediate；result/failure；remove/reset | README 的“七项职责”不是分母；必须读类方法、helper 和 `persistence.test.ts` |
| `ui/base/input/src/components/InputProvider.tsx::InputProvider` | registration/token；edit/value/selection；owner transition/focus/blur；keyboard key dispatch；boundary suspend/restore；snapshot/next-field；capacity/visibility | `useCallback` 数量不是分母；必须读真实 focus/keyboard tests 与 state snapshot |

如果任一职责无法绑定 behavior oracle，实施计划在 CP-1 停止；不得先移动/拆分再用测试追认。

## 8. startup 结构化日志详设

### 8.1 通用字段与终态

七组事件共用既有 `LoggerPort.info/error` 和 `LogWriteInput.data`，不改
`apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts` 导出的
`PlatformPortBindings`、`CreatePlatformPortsInput`、`PlatformPorts`，也不改 `LogContext`。

`data` 最小字段：

```text
startupRunId: string       // createPlatformPorts 的同一 logger state 生成
phase: string              // ports | runtime | render | surface | assembly
sequence: number           // logger state 对 startup.* 写入单调递增
```

`startupRunId` 由 `createPlatformPorts` 在 `__DEV__` 分支创建，格式固定为
`terminal-startup-${nowTimestampMs()}-${processLocalCounter}`；counter 只在当前 JS 进程内单调递增，
不进入公共类型、不进入业务 state。tracker 以 `Set` 记录成功写出的七个 group category，sequence
从 1 开始。logger 先把已脱敏事件交给 sink/console，只有返回 succeeded 才登记 category；sink 失败
不得推进完成集合。`startup.complete` 由同一 tracker 以 guarded terminal write 发出，terminal write
不再参与 group 计数；任一 owner 显式写 `startup.failed` 后 tracker 进入 failed terminal，拒绝后续
automatic complete。

其中 `startup.surfaces` 不是一个单布尔 category：tracker 维护按 `displayMode`/surface key 去重的
`Map<string, {declared: boolean; measured: boolean}>`。assembly 在每个实际创建的
`SurfaceInputFrame(displayMode)` 之前登记该 displayMode 的 declared fact；measurement seam 只在
同一 displayMode 的 `onLayout` callback 后登记 measured fact。至少有一个同一 displayMode 的
declared+measured pair 之前，surfaces group 不算完成，因此 `startup.complete` 不会早于首个真实
`measuredSurfaceFrame`。后续 PRIMARY/SECONDARY frame 仍按 key 去重并补写，不重新发 complete；若
measured 先于 declared，先记录 pending，不得把它误算为已完成。

每组另外只写事实摘要/稳定 key/count，不写姓名、手机号、密码、token、cookie、Authorization、原始 payload、
原始 IP 或输入值。`startup.complete` 是 logger 观察到六个普通 group 加上 surfaces 的 declared+measured
必需事实都成功后的自动终态；
`startup.failed` 由发生启动失败的 owner 在同一 logger 上显式写出。终态同样注入 runId/phase/sequence，
失败后不再自动 complete。logger 只负责关联和终态，不读取 kernel/ui 对象、不拼七组事实、不成为跨层 aggregator。

### 8.2 `startup.ports` 的内部 descriptor

不能通过调用端口探测，也不能与 defaults 做对象 identity 比较。实施在
`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` 内定义不导出的
descriptor reader，并以 `Symbol.for('catering-v2s.platform-ports.descriptor')` 作为非枚举 sidecar key；
这不是 `PlatformPortBindings` 的字段、不是 root export、不是 package public type。

sidecar 的冻结值形态：

```text
PortDescriptor = {
  port: PlatformPortName,
  capabilities: readonly {
    capability: string,
    state: 'real' | 'unavailable',
    source: 'default' | 'adapter' | 'web' | 'fixture'
  }[]
}
```

所有现有 default/real binding factory 在返回对象前（且只在 `__DEV__` 分支）附加自己的 sidecar；
`createPlatformPorts` 仅 `Reflect.get` 读取，不调用方法。sidecar 类型本身只有
`state:'real'|'unavailable'`；缺 sidecar 不是一个可伪造的 descriptor。DEV reader 返回
`descriptorStatus:'missing-descriptor'` 并让 focused test 红，不能猜成 unavailable；TEST/PROD
不读取 descriptor。这样 partial-real 不依赖 identity：`androidDevice` 明确记录
`getDisplayInfo=real`，其余五个 capability=`unavailable`。

attach 分母固定为以下真实 binding 位置，不使用“所有 default factory”这种模糊集合：

| 形态 | 精确位置 | attach 时机 |
|---|---|---|
| default logger singleton | `apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts::consoleLoggerBinding` | 在原有 `Object.freeze` 之前给局部 binding 加 sidecar，再按原语义冻结；不改变 `kind` 或冻结边界 |
| default unavailable singletons | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts::unavailableAppControlPort`、`unavailableConnector.ts::unavailableConnectorPort`、`unavailableDevice.ts::unavailableDevicePort`、`unavailableHotUpdate.ts::unavailableHotUpdatePort`、`unavailableLogUpload.ts::unavailableLogUploadPort`、`unavailablePersistSecure.ts::unavailablePersistSecurePort`、`unavailableScript.ts::unavailableScriptPort`、`unavailableTopologyHost.ts::unavailableTopologyHostPort` | 在导出的 binding 对象定义处、且只在 `__DEV__` 附加非枚举不可写 sidecar；不把 `createUnavailable.ts::createUnavailable` 返回的业务结果误当 port |
| default state-storage factory | `apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts::createProcessMemoryStateStoragePort` | 每次构造 returned binding、冻结前附加 sidecar；`persistKv` 是该 factory 的 `real` default capability |
| Android real/partial adapters | `adapter/android/device/src/implementations/androidDevice.ts::createAndroidDevicePort`、`adapter/android/persist-kv/src/implementations/androidPersistKv.ts::createAndroidPersistKvPort` | 文件迁移后的 factory return 前；当前旧路径分别是 `src/androidDevice.ts` 与 `src/androidPersistKv.ts` |
| Web real/partial adapters | `ui/base/dev-host/src/implementations/webPlatform.ts::createWebDevicePort`、`webStorage.ts::createWebStateStoragePort` | 文件迁移后的 factory return 前；当前旧路径分别是 `src/webPlatform.ts` 与 `src/webStorage.ts` |

checker 的 attach denominator 就是上述 1 个 logger、8 个 unavailable singleton、1 个 state-storage factory、
2 个 Android factory、2 个 Web factory 共 14 个位置；fixture 另列，不计入真实分母。singleton 的 sidecar
必须在定义处附加，factory 的 sidecar 必须在 returned binding 冻结前附加；每个位置逐 capability 对照公开
interface，少一项、错误 key、可枚举、可写或未冻结 sidecar 都由 descriptor-protocol checker 判红。

每个 port 的 capability 清单来自当前公开 interface，实施时不得手写少项：

| port | capability keys |
|---|---|
| `logger` | `write`（由 `LoggerBinding.kind` 形成 real descriptor） |
| `persistKv` / `persistSecure` | `read`, `write`, `remove`, `readMany`, `writeMany`, `removeMany`, `listKeys`, `clear` |
| `device` | `getDeviceInfo`, `getDisplayInfo`, `getSystemStatus`, `getPowerStatus`, `subscribePowerStatus`, `unsubscribePowerStatus` |
| `appControl` | `resetRuntime`, `exitApplication`, `clearHostDataCache`, `setFullscreen`, `getFullscreen`, `setKioskMode`, `getKioskMode`, `showNativeLoading`, `hideNativeLoading` |
| `script` | `execute`, `getStats`, `clearStats` |
| `connector` | `call`, `subscribe`, `unsubscribe`, `on` |
| `hotUpdate` | `downloadPackage`, `writeBootMarker`, `readBootMarker`, `readActiveMarker`, `readRollbackMarker`, `clearBootMarker`, `confirmLoadComplete` |
| `logUpload` | `uploadLogsForDate` |
| `topologyHost` | `start`, `stop`, `getStatus`, `getDiagnosticsSnapshot` |

`startup.ports.data` 只输出上述 descriptor 数组、端口总数和 `descriptorStatus`；不执行端口方法。
`createPlatformPorts` 在完成 root `PlatformPorts` 组装后、返回前，用同一 private startup logger state
写出唯一的 `startup.ports` 事件；因此 assembly 不需要读取 port 私有结构，也不需要新增跨层 port
diagnostics API。`createLogger`、`scope` 与 `withContext` 共享同一 private startup tracker，不能因
创建 scoped logger 而生成第二个 `startupRunId` 或重置 sequence。
这不是新增 registry、`seal()` 或可变 public factory 形态：`createPlatformPorts` 返回值的十个 binding
和冻结 root 语义保持不变；唯一新增的是 `__DEV__` 下的一次结构化诊断写入。TEST/PROD 不执行这段写入。
实施时为 default 全 unavailable、Android device partial-real、Android persist-kv real、Web device partial-real、
Web persist-kv real 各有一个 focused red/green oracle；若公共类型需要增加 provenance 字段或改变三类已导出
类型，立即停机交 Dexter，不能自行接受。

sidecar 协议选择“无 public helper 的唯一 internal protocol”：所有 factory 使用完全相同的
`Symbol.for('catering-v2s.platform-ports.descriptor')` 字面量和上述冻结字段形状；该字面量只在本详设
定义的 factory attach sites 出现。`check-static.mjs` 的 descriptor-protocol checker 必须扫描这些
attach sites，发现不同 key、缺字段、非枚举/非冻结或 capability 不属于对应 interface 即红；fixture
故意使用错误 key 和缺一项 capability 各红一次。这样不扩展 public `index.ts`，也不允许各包自行发明
第二个 sidecar 协议。

### 8.3 runtime 四组 owner

`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts::createRuntime` 已拥有
`descriptors` 与 `actorRegistry`。在现有 construction/start 边界添加 `if (__DEV__)` 的纯摘要写入：

| category | source | data |
|---|---|---|
| `startup.modules` | `descriptors` | `moduleNames`, `count`, 每个 module 的 `kind` |
| `startup.slices` | `descriptors[].stateSliceNames` | `{moduleName, sliceName}` 数组、count |
| `startup.commands` | `descriptors[].commandNames` 与 definitions key 集合 | `{moduleName, commandName}` 数组、count |
| `startup.actors` | `descriptors[].actorKeys` 与 `actorRegistry.actorCount` | `actorKeys`, `count` |

所有摘要只读当前数组/map，不改变顺序、定义或 runtime state；runtime start catch 只在 `__DEV__` 写
`startup.failed`，原有 `runtime.lifecycle` 错误日志不改语义。

### 8.4 render parts owner

`apps/terminal/ui/base/render/src/components/RenderProvider.tsx::RenderProvider` 在已存在的 React
effect 边界内只执行一次 `startup.parts`。事实源是 `uiCatalog.entries` 与
`rendererCatalog.resolve(entry.rendererKey)`：输出每个 `partKey`、`rendererKey`、resolved tier/guard，
以及 missing renderer key 数组。不得给 `RendererCatalog` 追加枚举公共方法；不得从组件树或 DOM 反推。
effect 只在 `__DEV__` 中执行，使用 ref 防重复；render snapshot、dispatch、part diagnostic 不改变。

### 8.5 surfaces 两个事实、两个 owner

1. `declaredSurfaceSize`：`apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts`
   读取 package.json 静态声明；`sample-console/src/assembly/assembly.tsx` 在每一个实际创建的
   `SurfaceInputFrame(displayMode)` 之前，使用该 displayMode 对应的 package baseline 写一条
   `startup.surfaces` 的 `kind:'declared'` 摘要。它不是一次性把所有 package metadata 当作已存在的
   surface，也不能传给 input 参与布局；没有实际创建的 surface 不构成 measured 配对候选。
2. `measuredSurfaceFrame`：真正接收 pointer tree 的
   `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx::handleSurfaceLayout`（当前第 37 行
   `View.onLayout`）是事实 owner。为 `InputSurfaceFrameProps` 增加一个不依赖 platform-ports 的
   `onMeasuredFrame?: (frame: LocalFrameMetrics) => void`；同尺寸去重后把 `{width,height,ready,orientation}`
   回调给 `sample-console/src/assembly/assembly.tsx::SurfaceInputFrame`。`SurfaceInputFrame` 接收
   `displayMode` 与同一 `LoggerPort`，只把回调事实转成 `startup.surfaces` 的 `kind:'measured'` 事件；
   assembly 不测量、不读取 dev-host viewport、不读取 `terminalSurfaces` 参与几何。

`SurfaceInputFrame` 增加 `displayMode` 仅作为日志标签；`imeInset` bridge 不变。`dev-host/src/components/testExpoApp.tsx`
只继续测量 preview canvas 来决定外层 stage transform；不得把 preview viewport 冒充 measured frame。
首帧尚未发生 `onLayout` 时不写 measured event；InputSurfaceFrame 现有 `frameMetrics=null` 状态保持。

### 8.6 编译期 dev-only

所有 startup 事件构造与 descriptor sidecar 只放在 `if (__DEV__)` 分支；不使用 `environmentMode`、
`Platform.OS`、`window` 或 runtime feature flag 判定。仓内既有 `babel-preset-expo`/Metro 会把 `__DEV__`
作为构建期常量；实施必须用真实 production export 证明分支被删除，不能只 grep 源码。为使 focused proof
不被现有 Vitest 的 `global.__DEV__=false` 或裸 Node 未定义状态掩盖，增加隔离的
`tools/terminal-readability/vitest.dev.config.ts`（Vite `define: {__DEV__: 'true'}`）与
`vitest.prod.config.ts`（`__DEV__: 'false'`），只收集以下四个专测入口：
`apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts`、
`apps/terminal/kernel/base/runtime/test/startupDiagnostics.dev.test.ts`、
`apps/terminal/ui/base/render/test/startupDiagnostics.dev.test.tsx`、
`apps/terminal/ui/base/input/test/InputSurfaceFrame.measurement.dev.test.tsx`。两套配置都在模块导入前
完成 compile-time define，不改共享 RN setup、不写 `global.__DEV__`。dev harness 观察真实事件，prod
harness 观察无 startup event；真实 Expo/Metro export 仍是最终 DCE 证据。

TypeScript 的唯一 ambient 落点是 `apps/terminal/terminal-env.d.ts`，内容只声明
`declare const __DEV__: boolean`，不含运行时赋值；`apps/terminal/tsconfig.base.json` 的 `files` 纳入该
文件，所有继承它的 package typecheck 因而可解析同一声明。该声明不能放进共享 RN setup，也不能以
`global.__DEV__`、package-local 重复 `.d.ts` 或 runtime `environmentMode` 替代；Vite/Metro 的 compile-time
define 仍是唯一运行时值来源。设计/计划只规定这个落点，实施时若现有 tsconfig inheritance 不能使四个目标
package 读到它，必须停机报告，不能另造第二个 ambient 入口。

`check-production-bundle.mjs` 的模型/真实判据分开：模型用一个 production entry import
`startupDiagnostics.ts` 的动态-category fixture，graph 门必须红；真实构建用 Expo/Metro 的 production mode，
bundle 中不得出现 `startup.modules`、`startup.slices`、`startup.commands`、`startup.actors`、
`startup.ports`、`startup.parts`、`startup.surfaces`、`startupRunId` 或 `startup.complete/failed` 的
emitter 代码。不能只检查 category 字符串，因为动态拼接会假绿。

## 9. 既有 `createElement` 与行为不变边界

`TR-R03` 的四个真实生产实例只改写法，不改变树或 props：

- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`：JSX 等价改写；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`：JSX 等价改写；
- `apps/terminal/ui/base/render/src/components/RenderProvider.tsx`：保留 Provider value 与 children 关系；
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`：保留 `SurfaceRoot`/Input frame 关系。

`apps/terminal/ui/base/render/src/components/resolvePart.ts` 是唯一 allowlist 例外，不得用它掩盖业务组件
新增 `createElement`。测试可以因路径变化更新 import，但 RD-10 要求断言语义不改；source/test diff
若出现业务结果、state shape、command payload、logger security 或 focus 行为变更，立即停机。

## 10. 失败、停止与不适用

以下任一情况停止当前 CP，报告首败、最后已知正常边界与最小修复，不加 fallback：

1. 目录搬移需要改 package/module/npm 名或层级；
2. testing 拆分后生产仍可达 `src/testing`，或共享 registry 变成两份；
3. 职责矩阵存在无 behavior oracle 的行；
4. 端口 descriptor 只能靠探测、identity、公共类型扩展或跨层 import 才能完成；
5. `__DEV__=false` 的真实 bundle 仍保留 startup emitter，或生产 graph 到达 dev-only fixture/module；
6. 任一 AST checker 只能靠 regex/字符串搜索证明 R 语义，或 red fixture 不红；
7. owner 日志需要 assembly 读取 runtime/render 私有结构；
8. `measuredSurfaceFrame` 退化为 declared size、preview viewport 或其他 surface 的尺寸；
9. 拆分前后 behavior oracle 的可观察结果不相同；
10. 阶段三维对账或最终“逐代码与详设对账”出现无法同根闭合的 OPEN。

本专题明确 N/A：Android 真实启动日志、Web 真实 bundle/pointer、DEV/seed/UAT、数据库/migration、
用户 Journey/L2、平台 IME/方向锁/设备策略。它们不得在本详设里被称为已验事实。

## 11. 验收闭包（实施后才可运行）

| 目标 | 实施后观察 | 不能替代的证据 |
|---|---|---|
| 词表闭合 | `RD-1`：27 个 package `src/` 根 direct children 只含 3 文件/15 目录；每个 `features/` direct children 只含 4 个固定目录 | 人工列目录、文件名直觉 |
| 500 行墓碑 | `RD-3`：500 行硬顶已删除，不恢复，也不参与机器判定 | 把墓碑行当作当前规则或重新设行数门 |
| L 规则有门 | `RD-4/RD-8/RD-11`：catalog 反查 6 个 L；manifest 6 个 enabled；每条模型 red + negative control | 只跑 manifest 已登记项 |
| R 规则不假门 | `RD-9`：TR-R01 不在 manifest；加入它的 mutation red；fresh review 读职责 | regex/关键词 |
| testing 安全 | `RD-2`：production graph 不达 `src/testing`; foundations registry 只有一份 | 只看 root exports |
| 拆分行为 | `RD-10/RD-13`：每行职责 matrix 有真实 behavior oracle；前后观察相同 | test 文件未改动、调用次数 |
| startup 事实 | `RD-5/RD-6/RD-14/RD-15`：7 类 owner 事件来自 registry/catalog/measurement/descriptor；同 runId；complete/failed | 手写常量、普通日志数量 |
| production DCE | `RD-7`：false build 无 startup emitter；dynamic-category graph fixture 会红 | 搜 `startup.` 字符串单独判断 |
| 分层依赖 | `RD-12`：用 `collectProductionImportGraph` 检查最终 graph 无 kernel→ui edge，且 assembly 的 raw import specifier 不指向 runtime/render 的内部路径；kernel import ui 的层级方向由既有 §2-C 门承接 | 只看 package.json 依赖方向 |
| 公共面 | 三个 PlatformPorts 类型成员集合未扩展；所有 import/export 逐条核对 | 只看 typecheck |

## 12. 三维对账与逐代码对账要求

每个 CP focused proof 后、下一个 CP 前，由 fresh 独立子 agent 只读对照三维：

1. 正式需求：目标、15 词表、7 规则、7 组日志、批次与非目标；
2. 本详设/实施计划：每个 path/symbol/AST/字段/失败行为；
3. 项目记忆与 owning source：deterministic context、terminal architecture、coding standard、当前源码事实。

结论只允许 `MATCHED` 或 `OPEN`；任一 OPEN 必须由主 agent 根因修复并 fresh 复查，不能启动下一 CP。
全部 CP 完成、整体测试前，再独立从头做一次全批三维对账，不汇总阶段结论。

“逐代码与详设对账”是另一个独立交付步骤：范围覆盖本详设每一个源码锚点、每一条新增/删除公共面、
每一个测试/README/invariant 同步点，逐代码不抽样；主 agent 执行，fresh 子 agent 只读盲审；记录字段为
`file | symbol | design clause | code observation | MATCHED/OPEN`。行为类条目不得以调用次数、prop、mock
callback、字符串或 transform 前尺寸作为唯一证明。任一 OPEN 未闭合时，只能报告
`IMPLEMENTATION_NOT_READY` 与 `DELIVERY_TO_DEXTER_AND_CLAUDE=BLOCKED`。

## 13. 详设自检

```text
VOCABULARY=15 closed directories; 27 package src roots; 12 packages/35 scattered files
RULES=TR-R01..TR-R07; 6 L + 1 R; no 500-line hard cap; TR-R05 exact AST depth
MANIFEST=ruleId/tier catalog; L-only checker manifest; RD-9/RD-11 reverse checks
TESTING_GRAPH=shared foundations registries; production cannot reach src/testing
RESPONSIBILITY_SPLITS=dispatcher + persistenceEngine + InputProvider; matrix before split
PORT_DESCRIPTOR=internal non-enumerable sidecar; no probe/identity/public PlatformPorts extension
SURFACES=declared package baseline != measured InputSurfaceFrame onLayout fact
STARTUP=seven owner groups; data startupRunId/phase/sequence; complete/failed; __DEV__ DCE
NO_BEHAVIOR_CHANGE=RD-10 focused oracles; imports may move, assertions semantics may not
RECONCILIATION=stage/whole 3D plus separate code/design reconciliation
IMPLEMENTATION_AUTHORITY=true（设计 finding M-1/S-1/S-2 已由主 agent 按 Dexter 授权自闭合；本字段只表示当前已进入实施）
```
