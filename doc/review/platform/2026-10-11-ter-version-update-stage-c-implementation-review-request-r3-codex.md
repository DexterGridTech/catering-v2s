# TER 更新阶段 C 整批实施结果评审请求

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=TER版本定义、完整更新与热更新阶段C整批当前源码及已有业务运行结果
REVIEW_ROUND=N
AUTHOR=CODEX
```

## 背景

阶段 C 的 CP-01～CP-06 与全批 6b 已有独立 `MATCHED` 记录；两端 Expo Web 主 Journey 和计划内四个 Android 设备 run 均已有业务及 runner cleanup `PASS`。最近一次 `backend-acceptance` 的测试、业务断言和 Testcontainers 资源清理均 `PASS`，但受管 DEV 自动恢复状态为 `FAIL`（`R5_DEV_START=PASS_NOT_CONFIRMED`）；随后通过受管 `scripts/dev/start` 手动恢复并观察到 `R5_DEV_START=PASS`。Dexter 已明确要求不要因自动重启问题延迟阶段 C 业务 review。本请求如实披露该独立生命周期结果，不将其改写为业务失败或 cleanup PASS。

本次不是阶段性子集审查，也不继承先前阶段结论；请基于当前源码与下列既有运行记录，对阶段 C 整批重新判断。未重跑的默认全仓 `scripts/verify` 及计划中已标为不适用/未关闭的预算 projection 门仍为 `NOT_RUN/OPEN`，不能据此推定通过。

## 评审目标

请独立判断当前阶段 C 是否实现了正式需求与详设中的业务目标，重点核实包职责、真实调用链、共享凭证、项目规则选择、FULL/HOT 执行、后台报告读回及主副机边界；并检查用户可见路径是否与批准的 Journey/IA/交互工件一致。请用现有运行记录确认真实业务断言覆盖，不要求重跑已通过场景或默认全仓 verify。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：阶段 A～C 的正式需求与边界。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C 的 owner、状态、command/selector、业务和失败判据。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 顺序、动态执行面、交付判据及未覆盖边界。
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md`：用户任务、页面结构及交互预期。
- `doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-01-evidence-intake-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-02-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-04-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-05-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-cp-06-reconciliation-codex.md`、`doc/review/platform/2026-10-11-ter-version-update-stage-c-6b-reconciliation-codex.md`：阶段记录与全批对账，仅作范围和导航，不替代本轮判断。
- `apps/terminal/kernel/feature/project-basic/`、`apps/terminal/kernel/feature/store-basic/`、`apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/terminal-data-client/`：关键状态 owner、规则选择、凭证和更新执行源码。
- `apps/terminal/ui/integration/sample-console/`、`apps/terminal/ui/integration/sample-wallpaper-console/`：两套 composition 与 UI 主路径。
- `apps/backend/catering-business-server/modules/terminal-update/`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/`：工件/规则/报告 owner 与后台 HTTP 边界。
- `apps/terminal/application/sample-console/`、`apps/terminal/application/sample-wallpaper-console/`、`tools/terminal-automation/`：Android 装配、受管 driver、Journey、日志与 cleanup。
- 下列 `.runtime` manifest 与日志：六个 Web/Android 当前业务 run 及最新 backend-acceptance 的实际结果。

## 独立核验重点

1. 从实际源码提取主要屏幕、控件、用户可见状态与 command 路径，并逐一对照当前 Journey、IA、交互工件；报告静态已证、运行已证和无人验证的用户可见事实。
2. 复核 owner 链：`store-basic` 成功装载后通知 `project-basic`；`project-basic` 读取完整规则快照并选择适用规则；`terminal-update` 执行本机比较、固定、FULL/HOT 更新和上报。业务功能须由 base/adapter 与 owner 承担，不把更新机制泄漏到 integration/application。
3. 复核终端凭证由 TDC 唯一持有、已批准的主到副明文同步、同 App 配对、解绑 command 顺序；副机直接向 CBS 请求，但保持不连 TDS、不独立激活、不上报版本报告。
4. 核实 HTTP 路径的解压后响应边界与压缩处理，确认没有套用 TDS WebSocket 64 KiB 消息限制；核对透明压缩对真实 CBS/OkHttp 调用链的影响和现有 focused 证明。不要仅凭 HTTP 200 判定业务成功。
5. 通过现有真实供给链 run 核对后台上传/规则启用、TER 更新、CBS 报告接收及运营后台历史读回；区分 `taskId=null` observation 与非空 task report。
6. 复核 FULL/HOT 任务、候选规则重核、冷启动续接和同 App 双机隔离，只按阶段 C 判据判断，不把阶段 B/C 之外功能或恶意归档专项带入本轮。
7. 明确自动恢复失败的实际影响：backend-acceptance 业务与 Testcontainers 资源清理结果为 PASS，DEV 自动恢复为 FAIL，之后受管 DEV start 输出 PASS。请把它作为独立 runner/生命周期观察，不扩大成阶段 C 业务 finding，也不要要求重跑业务验收。

## 当前运行记录

| 执行面 | run ID | 业务 | runner/资源 cleanup | 说明 |
|---|---|---|---|---|
| Expo Web console | `87afb762-ea92-44ad-a443-5761feaefeca` | PASS | PASS | store-basic selector 观察到 CBS 门店数据 revision 变化；Web store fixture cleanup PASS。 |
| Expo Web wallpaper | `06e78579-a966-4514-bd40-01b2af4cfbd6` | PASS | PASS | wallpaper 主 Journey。 |
| Android console 供给链/双屏 | `cdede977-e568-42a9-b1de-5148b3db23aa` | PASS | PASS | `update.supply-chain`。 |
| Android wallpaper 供给链/mobile | `24ee070e-76bf-425e-b7aa-55a84ca010ac` | PASS | PASS | `update.supply-chain`。 |
| Android console 同 App 双机 | `039c9a27-c918-4ffe-b94a-ad5a1a36269d` | PASS | PASS | `update.pair`；两台显式设备身份。 |
| Android wallpaper 同 App 双机 | `928cfaa0-6aa7-45d4-b0f6-16f289fcba7d` | PASS | PASS | `update.pair`；业务、双机资源 cleanup PASS；有一条 `LOG_NOT_AVAILABLE` 诊断，保留为日志采集缺口。 |
| backend-acceptance | `r5-tc-1791688651328-25736` | PASS | Testcontainers/远端 runner cleanup PASS；DEV restore FAIL | 真实 `terminal-update.report-lifecycle`。DEV stop PASS；自动恢复返回 `R5_DEV_START=PASS_NOT_CONFIRMED`，之后受管 `scripts/dev/start` 对 run `r5-dev-1791689029498-26901-d4d6a9a6-9847-465d-bb53-038037487c8f` 输出 `R5_DEV_START=PASS`。 |

两个 Web run 的 driver 日志与 Android manifest/log 分别位于 `.runtime/terminal-automation/<runId>/`；backend-acceptance manifest 与日志位于 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791688651328-25736/`。以上记录需要按实际文件复核；历史 CP/6b 文件中的 NOT_RUN 快照不覆盖这些后续运行。

## 期望结论

请给出符合 `doc/platform/review-standard.md` 的整批 `REVIEW_TARGET=IMPLEMENTATION` 结论：`GO` / `GO_WITH_UNVERIFIED_UI` / `NO-GO`，并给出 `M/S/N`。如有 finding，请附需求/详设位置、精确源码路径与行号、事实与推论、可复验反例、影响、最小修正及是否需要 Dexter 裁决；完整报告同根扫描范围。另列 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS` 与证据档位。未覆盖用户可见面须进入 `L3_UNVERIFIED`，不能把局部运行写成全范围通过。

## 当前字节的差量处置与内部复核

- 13c 首次复核为 `OPEN`，原因是 `scripts/test/terminal-client-generation.test.mjs` 仍断言 CBS HTTP 请求包含 `X-Terminal-Device-Id`，与阶段 C 详设和当前生成物冲突。
- 主 agent 核验 canonical OpenAPI、生成 API、TDS `AuthenticateMessage` 后，仅更新该生成测试：CBS HTTP 请求断言不含该 header，同时保留激活 body 与 TDS AUTHENTICATE 的 `deviceId` 断言。Focused test `node --test scripts/test/terminal-client-generation.test.mjs` 与 Prettier check 均 `PASS`。
- Fresh 独立 13c 差量复核现为 `MATCHED`；结论只覆盖 CP-01 生成契约/测试接缝。
- Fresh 独立整批实施源码 review：`GO_WITH_UNVERIFIED_UI`，`M/S/N=0/0/0`。它未运行测试、构建或 verify；未覆盖证据仍按上文列为 `NOT_RUN/OPEN`，不得升级为通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 C 做一次整批实施结果独立 review。

背景：阶段 C 的 CP-01～CP-06 与全批 6b 有独立 MATCHED 记录；两端 Expo Web 与计划内四个 Android run 已有业务及 runner cleanup PASS。最新 backend-acceptance 的业务和 Testcontainers 资源 cleanup PASS，但受管 DEV 自动恢复失败；之后由受管 scripts/dev/start 恢复并输出 PASS。Dexter 已明确要求不要因 DEV 自动重启问题延迟阶段 C 业务 review。该差异如实保留，不将自动恢复失败改写为业务失败或整体 PASS。

目标：请独立从正式需求、当前详设、Journey/IA/UI、真实源码与下列运行产物核验阶段 C 的完整 owner/command/selector/HTTP/持久化/UI/Android 主流程。不要继承旧 verdict、CP/6b 对账作者结论或将测试源码当作运行证明；无需重跑任何已通过场景或默认全仓 verify。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：正式需求；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md 与 doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md：详设与实施判据；
- doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md、doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md、doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md：获批 Journey 与交互；
- apps/terminal/kernel/feature/project-basic/、apps/terminal/kernel/feature/store-basic/、apps/terminal/kernel/base/terminal-update/、apps/terminal/kernel/base/terminal-data-client/：业务状态 owner 与执行链；
- apps/backend/catering-business-server/modules/terminal-update/、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalupdate/：CBS 上传、规则、报告与运营读取；
- apps/terminal/ui/integration/sample-console/、apps/terminal/ui/integration/sample-wallpaper-console/、apps/terminal/application/sample-console/、apps/terminal/application/sample-wallpaper-console/、tools/terminal-automation/：UI、Android 装配及唯一自动化 driver；
- .runtime/terminal-automation/87afb762-ea92-44ad-a443-5761feaefeca/run-manifest.json 与 runner.log；
- .runtime/terminal-automation/06e78579-a966-4514-bd40-01b2af4cfbd6/run-manifest.json 与 runner.log；
- .runtime/terminal-automation/cdede977-e568-42a9-b1de-5148b3db23aa/run-manifest.json 与 runner.log；
- .runtime/terminal-automation/24ee070e-76bf-425e-b7aa-55a84ca010ac/run-manifest.json 与 runner.log；
- .runtime/terminal-automation/039c9a27-c918-4ffe-b94a-ad5a1a36269d/run-manifest.json 与 runner.log；
- .runtime/terminal-automation/928cfaa0-6aa7-45d4-b0f6-16f289fcba7d/run-manifest.json 与 runner.log；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1791688651328-25736/run-manifest.json 与 gradle.log。

重点核验：主要屏幕事实和用户路径是否符合 Journey；project-basic/store-basic/terminal-update/TDC/CBS 的责任与真实调用链；FULL/HOT 的固定与续接、同 App 双机边界；HTTP 响应压缩及解压上限是否与 WebSocket 64 KiB 边界分离；报告 receipt 与运营历史真实读回；动态运行的业务、runner cleanup、DEV restore 与 LOG_NOT_AVAILABLE 各自准确含义。请静态判断无需重跑不影响范围的验证，勿将上述独立 DEV 生命周期问题扩大成业务 finding。

烦请给出明确 GO、GO_WITH_UNVERIFIED_UI 或 NO-GO，并报告 M/S/N。每项 finding 请列需求/详设判据、精确源码路径与行号、事实/推论、反例、影响、最小修正和是否需要 Dexter 裁决；另列 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS 与证据档位。

授权边界：本次请求只进行阶段 C 整批实施结果 review，不新增代码修改、动态运行、DEV 生命周期、reset/seed、L2、UAT、生产部署或阶段外范围授权。谢谢。
```
