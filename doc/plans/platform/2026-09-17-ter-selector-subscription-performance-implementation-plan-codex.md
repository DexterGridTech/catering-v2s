# TER React UI selector 订阅性能优化 · 实施计划

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=DESIGN
IMPLEMENTATION_AUTHORITY=false
DESIGN=doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md
REQUIREMENTS=本轮 Dexter 直接任务与上述详设 §0/§4；无重复业务需求稿
AUTHORIZED=本轮编写详设、实施计划、review handoff 与只读核验材料
NOT_AUTHORIZED=implementation、typecheck/test/static 执行、Web、Metro、Android、DEV、设备、seed、UAT、部署、Git
```

本计划是未来实施的有序步骤，不表示已经修改源码，也不表示任何验证档位已经 PASS。只有 Dexter 另行授权 implementation 后，才能执行 §4 以后的写入与命令。

## 1 · 执行前硬前置

### 1.1 权威与源码重读

进入 implementation 前，主 agent 必须从仓库根重新读取：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前 Roadmap 的授权字段、`project-memory/index.md` 全部 kernel、六维命中的 TER memory、`scripts/README.md`；
2. `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md` 全文与本 handoff 的 review 结论；
3. `doc/platform/terminal-coding-standard.md` 的 TR-03 及本批拟新增 TR-15；
4. `apps/terminal/ui/base/render/src/contexts/RenderContext.ts`、`createRenderSnapshotReader.ts`、`RenderProvider.tsx`、`useRenderSnapshot.ts`、`useUiStateSelector.ts`、`useUiVariable.ts`、`src/index.ts`、`package.json`、`terminal-invariants.json`；`RenderContextValue` public type 与 framework-private subscription accessor 必须一并核对；
5. `ScreenContainer.tsx`、`LayerStack.tsx`、`AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、`AdminSectionContent.tsx`、`adminSection.ts`、`DisplayContextSection.tsx`、`RuntimeSection.tsx`；
6. render/admin owned tests、`tools/terminal-ui-render/check-static.mjs` 及其 self-test；
7. 当前 `node_modules/use-sync-external-store/with-selector` 的版本、导出和许可证元数据。传递依赖的存在不是直接依赖契约，若当前版本或 package-manager 解析不成立，停在 B0。

### 1.2 不开工条件

以下任一项未满足，不得写实现：

- 详设与实施计划尚未完成 Dexter/Claude DESIGN review；
- 当前 direct snapshot caller 分母、admin raw pass-through 分母和 public export 分母无法由源码重算；
- `use-sync-external-store/with-selector` 不能作为 `ui-base-render` 的直接依赖，`@types/use-sync-external-store` 不能作为该包的 direct devDependency，或需要新增 Provider/复制 store 才能使用；
- TR-15 文字与 TR-03、现有 actor/foundation 例外产生未裁决冲突；
- 需要修改用户可见 Journey、布局、命令/state owner、Web/Android 运行链才能达成 selector 目标；
- Dexter 没有另行给予 implementation authority。

### 1.3 执行纪律

- 所有代码、测试、package、脚本、规范与 README 变更只能由主 agent 写入；fresh 子 agent 只读审查/对账。
- Git 由 Dexter 控制；本计划不要求任何 Git 操作。
- 每个实际变更点写入前，逐项重开对应详设段落、原始任务、命中 memory 与 owning source；focused proof 后按同一材料回读。
- 每个 CP 完成后、下一 CP 开始前，安排 fresh 独立子 agent 做步骤级三维对账；全部 CP 完成后、任何整体测试之前，再做全批三维对账。
- 三维对账不能替代交付前逐代码与详设对账；任何一项 `OPEN` 都不能写“实施就绪”。

## 2 · 变更批次与依赖

| 批次 | 主题 | 预计改动 | 进入条件 | 收口条件 |
|---|---|---|---|---|
| B0 | preflight 与分母冻结 | 只读 source/doc/test inventory | 详设/计划 review 通过、implementation 已授权 | 分母、anchor、直接依赖可执行；无 scope drift |
| B1 | selector framework core | `useUiStateSelector`、`useRenderStatus`、`useUiCatalogContext`、safe/public 与 private context seam、snapshot internal seam、runtime/type direct dependencies、core focused tests | B0 | selector-aware render-count proof、status/identity/unsubscribe/equality-too-broad proof、public context type closure、typecheck |
| B2 | production consumer migration | render 五个宿主、`useUiVariable`、admin shell/section contract 与 consumers、focused regressions | B1 且 B1 三维对账 MATCHED | direct full snapshot production caller=0；行为 focused proof 通过 |
| B3 | framework standard/enforcement | TR-15、render invariant、静态 checker/self-test、README、active stale-contract cleanup | B2 且 B2 三维对账 MATCHED | public/dependency/static closure 与规范示例回源码 MATCHED |
| B4 | verification and delivery closure | 全批三维对账、逐代码与详设对账、四包 typecheck/owned tests、terminal static、review handoff | B3 且全批三维对账 MATCHED | 所有计划项 `MATCHED`；未授权档位仍 OPEN/N-A；交 Dexter/Claude review |

B1～B3 是本批原子实现，不允许以“只新增 hook”“只迁移一个 App”作为可交付子目标。B4 是证据收口，不新增产品机制。

## 3 · 变更分母与 owning source

### 3.1 B1 framework core

| 文件/符号 | 写入内容 | 详设对照 |
|---|---|---|
| `apps/terminal/ui/base/render/package.json` | 以当前 lock 可解析版本增加 `use-sync-external-store` 直接 dependency，并增加 `@types/use-sync-external-store` direct devDependency；两者版本以 B0 当前解析为准 | 详设 §1、§5.1、§9a |
| `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts` | 使用 `useSyncExternalStoreWithSelector`；root unavailable、默认 `Object.is`、selector identity 语义 | 详设 §4.1、§5.1 |
| `apps/terminal/ui/base/render/src/hooks/useRenderStatus.ts` | status-only subscription | 详设 §5.2 |
| `apps/terminal/ui/base/render/src/hooks/useUiCatalogContext.ts`（实际路径以 preflight 为准） | catalog context 的 typed selector 与窄 equality | 详设 §5.3 |
| `apps/terminal/ui/base/render/src/contexts/RenderContext.ts` | public context 不暴露 `stateSource`/`snapshotReader`；private accessor 只给 render framework hooks | 详设 §5.1、§5.2、§9.1 |
| `apps/terminal/ui/base/render/src/hooks/useRenderSnapshot.ts` | 删除 public full snapshot hook；保留 internal snapshot reader | 详设 §5.4 |
| `apps/terminal/ui/base/render/src/index.ts` | 新增两个/必要时三个 hook export，删除旧 export | 详设 §9.1 |
| `apps/terminal/ui/base/render/terminal-invariants.json` | actual public surface 与 dependency/invariant 同步 | 详设 §7.2、§9.1 |
| `apps/terminal/ui/base/render/test/renderState.test.tsx` | render-count、selected change、status、identity、stale closure、过宽 equality、teardown cases | 详设 §7.1 |
| `apps/terminal/ui/base/render/test/renderProps.test.tsx` | full-root 例外明确注释或改为窄 probe | 详设 §7.1 |

B1 不修改业务 selector owner、slice、Runtime public API、SurfaceRoot 的业务行为或任何 Web/Android 文件。

### 3.2 B2 production consumers

| 文件/符号 | 写入内容 | 详设对照 |
|---|---|---|
| `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx` | status/context/placement 分离订阅；参数和默认 placement 稳定 | 详设 §6、§9a |
| `apps/terminal/ui/base/render/src/components/LayerStack.tsx` | status/context/layers 分离订阅；保留 filter/sort/fallback | 详设 §6 |
| `apps/terminal/ui/base/render/src/hooks/useUiVariable.ts` | 底层改用 selector-aware hook，保留 injected variable reader | 详设 §6 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx` | boolean layers selector；不再读 full snapshot | 详设 §6 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx` | status/context/sections 选择；删除 raw root/source pass-through | 详设 §6 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx` | 同 laptop，保持现有 mobile 行为 | 详设 §6 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx` | 删除 `stateRoot/stateSource` props/构造 | 详设 §6、§9a |
| `apps/terminal/ui/base/admin-shell/src/types/adminSection.ts` | 删除 raw state 字段，保留其余 section context contract | 详设 §6、§8 |
| `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx` | 直接使用 owner selectors + `useUiStateSelector` | 详设 §6 |
| `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx` | 使用 `useRenderStatus` | 详设 §6 |
| render/admin existing tests | 补行为与 render isolation proof；不改 testID/业务断言意图 | 详设 §7.1、§11 |

其余已有 `useUiStateSelector` callers 逐个 source-readback 后保持或仅在测试需要时调整；不能因为它们不在 direct snapshot 分母就跳过核对。

### 3.3 B3 enforcement/docs

| 文件/符号 | 写入内容 | 详设对照 |
|---|---|---|
| `doc/platform/terminal-coding-standard.md` | 新增 TR-15：入口、纯度、identity、输出形态、Reselect 边界、窄例外、反例 | 详设 §4 |
| `tools/terminal-ui-render/check-static.mjs` | 既有 checker 增加 selector boundary/public/dependency 机械规则 | 详设 §7.2 |
| `tools/terminal-ui-render/check-static.test.mjs` 或现有 self-test 文件 | 每条新增机械规则 baseline+真实 red mutation+cleanup | 详设 §7.2 |
| `apps/terminal/ui/base/render/README.md` | 更新 selector-aware 调用、status、例外、Reselect 说明 | 详设 §9a、§14 |
| 命中 `useRenderSnapshot` 的 active docs | 仅同步仍被当作当前契约的文字；历史记录不重写 | 详设 §9a |

B3 不建新 AST checker、不把 selector 语义变成字符串 grep、不把历史 plan 改写成伪造实施记录。

## 4 · 逐步执行步骤

### B0 · preflight / 分母冻结

1. 逐点重读详设 §§0、4、6、7、9、11、13c 与本计划 §§1–3。
2. 用 `rg` 重新列出 direct `useRenderSnapshot`、raw `stateRoot/stateSource`、已有 `useUiStateSelector`、所有 render public exports 和现有静态 rule names；将结果保存为实施证据草稿，不用聊天摘要替代。
3. 重开 `use-sync-external-store/with-selector` 的安装版本、类型签名和 `@types/use-sync-external-store` 归属；确认 package manager 直接依赖可解析，不能依赖 `react-redux` 的传递类型，不执行构建或测试。
4. 用 owning source 确认 `createRenderSnapshotReader` 的 status-first/root-reference contract 未漂移；确认 admin section 的状态读取仍只有 DisplayContext/Runtime 两处。
5. 确认没有需要引入第二 Provider、复制 root、改变 selector owner 或改用户可见行为的隐藏前提。

**B0 收口**：输出 `B0_SOURCE_INVENTORY=MATCHED` 或逐项 `OPEN`。若分母无法闭合、依赖不可解析或发现 scope drift，停在 B0；不开始写代码。

### B1 · framework core

1. 在写每个文件前，重新读取对应符号及详设 §5.1–§5.4；先写 `useUiStateSelector` 的 selector-aware 接缝，再写 status/context adapter。
2. 使用官方 `useSyncExternalStoreWithSelector`，selector 只接收 snapshot 中的 root；root unavailable 返回 `undefined`，不调用业务 selector。
3. 对 `useUiCatalogContext` 只比较真实 context 字段；不把 `createCatalogContext` 变成第二 state owner，不在 hook 中写业务默认值。
4. 更新 public index/invariant/package direct dependency；删除旧 public hook，不保留兼容 alias。
5. 在 focused tests 中先保留 existing controls，再加入 F-1～F-6。每个新增 case 必须有可观测 render count/value/reference，不得只看 selector call count。
6. B1 focused proof 中执行真实 production red mutations：
   - 把 hook 改回完整 snapshot subscription：无关新 root 且选择结果相等的 render-count case 必须红；
   - 删除 equality 或把 equality 固定为总 false：稳定 derived output case 必须红；
   - 把 equality 改为总 true，或逐个删除 `displayMode`、`workspace`、`instanceMode`、`surfaceForm` 比较：对应字段变化的 catalog context case 必须红；
   - selector identity 变化不触发重算：identity case 必须红；
   - 把参数化 selector 改为缺依赖的 `useMemo/useCallback([])`：参数变化、root 不变但选择值应更新的 case 必须红；
   - status hook 改为读 root：status/getState boundary case 必须红；
   - 删除 unsubscribe：teardown case 必须红。
7. focused proof 后，主 agent按 B1 变更点回读详设/owning source；然后交 fresh 独立子 agent 做 B1 三维对账。只有逐项 `MATCHED` 才进入 B2；`OPEN` 必须最小修复并由新的 fresh reviewer 复查。

### B2 · render/admin consumer migration

1. 每个宿主文件写入前重开其当前 snapshot 分支、selector 和 props；先改 `ScreenContainer`/`LayerStack`，再改 admin shell contract，最后改 section consumers。
2. 任何参数化 selector 用模块级函数或 `useMemo`/完整依赖；默认 placement、filter 派生和 equality 不产生每次 render 的新 identity。
3. 保持现有 screen/layer fallback、displayMode、layer order、admin launcher 五击入口、section testID、command boundary 和 `runtimeFacts` 不变。
4. 移除 `AdminSectionRenderContext.stateRoot/stateSource` 后，确认所有其他字段仍从同一 owner 传入；不要让 section 从 context 偷读 raw store。
5. `DisplayContextSection` 使用 `selectDisplayRole`/`selectRuntimeInstanceMode`；`RuntimeSection` 使用 `useRenderStatus`；这些改动必须以 focused behavior case 而非字符串检查收口。
6. B2 red mutations：
   - 在任一生产宿主恢复 `useRenderSnapshot` import：B3 static 预检以及 B2 source proof 必须识别；
   - 在 admin context 恢复 raw root/source，或让 section 读取旧字段：typecheck/contract focused case 必须红；
   - 把 placement/layers selector 变为每次返回新对象并移除 equality：相同选择结果 render-count case 必须红；
   - 把 `useRenderStatus` 改回 `stateSource.getStatus()` 直接 render 读取：status hook boundary case 必须红。
7. 用 `rg` 重算 direct full snapshot production denominator，预期为零；测试专用 framework exception 单独列出。
8. B2 focused proof 后主 agent回读所有 B2 source；交 fresh 独立子 agent做三维对账。对账 `OPEN` 不得进入 B3。

### B3 · TR-15、静态门与文档

1. 写规范前重开 TR-03、TER render README、详设 §4；确保 TR-15 是终端规范的新增正本，不把它复制进 review standard 或 memory。
2. 更新 `terminal-ui-render` 既有 checker：
   - public exports/invariant exact 对账；
   - runtime direct dependency exact 对账；
   - `useRenderSnapshot` import/export forbidden boundary；
   - public `RenderContextValue` 不再暴露 `stateSource`/`snapshotReader`；外部 `useRenderContext().stateSource` 变异必须由类型或静态 fixture 捕获；
   - 对全 `apps/terminal/ui/**/src/**/*.{ts,tsx}` 做 production source exact-set scan，allowlist 仅为 render framework internal；若现有 checker 无法稳定实现该跨包门，则保留 exact-set scan + typecheck/review，不得声称机械全包覆盖；
   - 能可靠机械判定的 admin raw pass-through 才建门，否则不建门并在设计/计划标为 focused/review。
3. 每新增一条门都写 baseline control、真实 mutation、预期 failure、cleanup；不能以“文件里没有字符串”作行为 oracle。
4. public context 的 red fixture 在一个非 framework 的 production UI source 中尝试读取 `useRenderContext().stateSource`；该 fixture 必须因 public type 收窄而失败。若只用静态 scan 捕获，也必须记录 allowlist 与全量成员清单。
5. 更新 render README 的代码示例，明确 `useUiStateSelector`、`useRenderStatus`、参数化 selector 和 Reselect 边界；示例回源码核验。
6. 对旧 docs 做 `rg` audit：历史 plan 只记录为 historical；仍宣称 `useRenderSnapshot` 是现行业务 API 的 active 文档才同步。
7. B3 red mutations：删除 static rule、恢复旧 export、从 dependencies 移除 runtime/type direct dependency、把 `useRenderSnapshot` import 重新写入一个 sandbox source、恢复 public `stateSource` 字段；每个 mutation 应非零失败，control baseline 保持通过。
8. B3 proof 后做 fresh 独立三维对账；若规范文字、静态门和源码行为任一不一致，先修再进 B4。

### B4 · 验证、全批对账和交付

B4 执行顺序固定如下：

1. B1–B3 全部完成后，任何整体测试之前，由 fresh 独立子 agent按详设 §13b 做全批三维对账；它不是前面步骤报告的汇总。结果逐项只写 `MATCHED`/`OPEN`。
2. 全批三维对账全 `MATCHED` 后，主 agent做 §9.3 的逐代码与详设对账，逐个 symbol/path/contract 对照，不抽样；结果只允许 `MATCHED`/`OPEN`。
3. 只有前两项没有 `OPEN` 才运行以下现有命令（实现授权下）：

   ```bash
   yarn workspace @catering-v2s/ui-base-render typecheck
   yarn workspace @catering-v2s/ui-base-render test
   yarn workspace @catering-v2s/ui-base-admin-shell typecheck
   yarn workspace @catering-v2s/ui-base-admin-shell test
   yarn workspace @catering-v2s/ui-base-console-assembly typecheck
   yarn workspace @catering-v2s/ui-base-console-assembly test
   yarn workspace @catering-v2s/terminal verify:static
   ```

   `ui-base-console-assembly` 只作为跨层 typecheck/回归闭包；若它没有被源码分母影响，仍按计划执行并记录真实结果。
4. 每条命令保留原始输出路径；失败时记录 first failure、last known good、broken boundary，按 owning source 修复后只做必要的 focused 重验。禁止延长 timeout、盲目重跑或把退出码当业务 oracle。
5. 运行完 static/focused 后再做一次 direct caller、public export、dependency、TR-15 示例和旧契约 audit；若实现中出现未列出的生产文件，交付项为 `OPEN`。
6. 生成 `REVIEW_TARGET=IMPLEMENTATION` 交接前不得宣称 implementation/acceptance PASS；本轮用户授权目前只到设计 review，后续需 Dexter 明确 implementation authority。

## 5 · 失败与证据处理

| 故障 | 必须做 | 禁止做 |
|---|---|---|
| typecheck 失败 | 保留首败原文；定位 owning source；修复后按受影响包 focused 重验 | 不靠增 timeout、加 any、恢复兼容出口 |
| owned test 失败 | 记录失败用例与 broken boundary；先确认是 hook 语义还是既有行为漂移 | 不只改测试断言让它变绿 |
| static 失败 | 保留 mutation/control 输出；修 checker 或 source 的真实根因 | 不删除 gate 或改成只检查字符串 |
| selector render count 不符 | 先确认 snapshot/root/equality/selector identity；再修最小边界 | 不复制 store、加 Provider 或写业务缓存 |
| evidence 缺失 | 标为 `OPEN`/`NOT_RUN`，说明所需授权/执行体 | 不以 typecheck、退出码或测试名升格 dynamic/performance |
| cleanup 失败 | 分开记录 business 与 cleanup，按 runner owner 修复 | 不把 business green 当 cleanup green |

本批没有动态长运行；若测试 runner 使用临时 sandbox，cleanup 必须由其现有 runner 输出并单列，不能用进程名/端口猜测资源归属。

## 6 · 每批测试用例与 red mutation 对账

| 批次 | control/proof | 必须红的 mutation |
|---|---|---|
| B1 | render-count isolation、selected change、identity、stale closure、status-only、unavailable、equality、context field completeness、unsubscribe | full snapshot、无 equality、总 true/漏字段 equality、旧 identity、缺依赖闭包、status 读 root、缺 unsubscribe |
| B2 | Screen/Layer behavior、Admin launcher/layout/sections、raw props typecheck、direct caller exact scan | 恢复 snapshot consumer、恢复 raw pass-through、每次新派生对象、status direct read |
| B3 | static baseline、public/invariant exact、runtime/type dependency exact、public context exact、README/source example | 删除 rule、恢复 export、删除 runtime/type direct dependency、重新导入旧 hook、恢复 public raw source |
| B4 | 四包 typecheck、两个 owned test、terminal static、全批/逐代码对账 | 任一前置 OPEN 或 command failure 保持 OPEN；不能改写为 PASS |

## 7 · 逐代码与详设对账安排

### 7.1 对账方法

主 agent在 B4 逐项读取实际源码，按详设 §9a 的每一行核对：路径存在、实际改动符号、owner、调用方向、公共面、测试执行体、static rule、README 与证据分档。每一行都写：

```text
CHANGE=<详设 §9a 行标识>
SOURCE=<仓库相对路径>#<symbol/结构锚点>
DESIGN=<详设章节>
STATUS=MATCHED | OPEN
EVIDENCE=<focused/static/readback 输出相对路径，或 OPEN 原因>
```

禁止用三维对账报告、测试全绿或 `rg` 数量替代逐代码对账。路径和 symbol 若因 source readback 变化，先更新详设/计划并将原项标为 OPEN。

### 7.2 三维对账与逐代码对账的区别

- 步骤级/全批三维对账：fresh 子 agent 以需求目标、详设/规范、源码/证据三维证伪偏移；只输出 `MATCHED`/`OPEN`。
- 交付前逐代码与详设对账：主 agent逐行确认实施实际落点覆盖详设承诺；不抽样。
- implementation review：交 Dexter/Claude 的独立复核；三者不可互替。

## 8 · 设计—实施对账清单

| 设计章节 | 计划落点 | 交付前状态 |
|---|---|---|
| §0 问题与非目标 | B0 分母/范围、B1–B3 禁止项 | MATCHED/OPEN |
| §1 方案 C 与依赖边界 | B1 package direct dependency | MATCHED/OPEN |
| §2 CP 原子顺序 | B1→B2→B3→B4 | MATCHED/OPEN |
| §3 横切机制 | 每批对应 source/test/static | MATCHED/OPEN |
| §4 TR-15 | B3 terminal standard + README | MATCHED/OPEN |
| §5 API 行为 | B1 hooks/invariant/typecheck | MATCHED/OPEN |
| §6 消费者全集 | B2 exact scan + focused tests | MATCHED/OPEN |
| §7 测试/门 | B1/B2/B3 red mutations | MATCHED/OPEN |
| §8 owner 边界 | B1/B2 no new store/owner | MATCHED/OPEN |
| §9 public/source denominator | B0/B4 export/caller audit | MATCHED/OPEN |
| §9a/§9b exact changes/anchors | B4 line-by-line readback | MATCHED/OPEN |
| §10 migration/seed | no data/seed changes | MATCHED/OPEN |
| §11 evidence | B4 tier table; no dynamic overclaim | MATCHED/OPEN |
| §12 out-of-scope | no list virtualization/other perf work | MATCHED/OPEN |
| §13 stop/reconciliation | every CP + whole batch fresh review | MATCHED/OPEN |

## 9 · 交付闸门

交付 Dexter/Claude 前必须全部满足：

- 详设与计划 DESIGN review 结论已记录；
- B0–B3 每个 CP 的步骤级三维对账有 fresh 只读留痕且无 OPEN；
- 全批三维对账在整体测试前完成且无 OPEN；
- 逐代码与详设对账逐行无 OPEN；
- B1/B2/B3 所列 focused/static proof 与真实 red mutations 有输出；
- 四包 typecheck、两个 owned test 和 terminal static 的实际结果已分档；
- `useRenderSnapshot` production caller=0，public invariant、direct dependency、TR-15 和 README 同步；
- native/Android/Web/release/visual/dynamic performance 若未授权或未执行，明确 `N/A`/`OPEN`，不得宣称 PASS；
- `scripts/check/claude-review-handoff --file <repo-relative-request>` 通过；
- 交接文案直接包含背景、目标、阅读路径、独立核验重点、GO/NO-GO 与 M/S/N 格式、授权边界。

在本轮仅有设计授权的状态下，以上 implementation 闸门均为未来计划，不得现在执行或宣称完成。

## 10 · 计划自查

- [x] 按 B0–B4 明确入口、落点、依赖和收口。
- [x] 明确先修订 `useUiStateSelector` 的订阅机制，再迁移生产消费者，再落 TR-15 与静态门。
- [x] 把 Reselect 定位为派生计算/引用稳定工具，没有把它当作订阅隔离替代品。
- [x] 为每个新增机械门列出真实 production red mutation，并明确不可机械证明的部分交 focused/review。
- [x] 明确五个 direct snapshot production consumer、两个共享 hook和 admin raw pass-through 的迁移分母。
- [x] 逐代码与详设对账单独列出，且不与三维对账互替。
- [x] 明确没有 implementation authority、没有动态验证授权；所有未执行档位必须 OPEN/N-A。
- [ ] B0–B4 实施证据：待 implementation authority 与后续执行。
