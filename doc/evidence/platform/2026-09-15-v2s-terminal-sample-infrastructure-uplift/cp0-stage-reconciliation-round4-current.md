# CP0/B0 当前源码 fresh 三维对账

## Metadata

- `REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
- `REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation`
- `REVIEW_ROUND=4`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- reviewer：fresh independent verifier（agent `01a0a1df-3e53-7723-a693-fff1dcb50a1b`）
- scope：requirements v3.6、design、plan、project memory、current source/evidence；只读，不运行 test/build/dynamic，不写文件。

## Verdict

`OPEN` / `NOT_MATCHED`。

- R-E6 package-only static repair：`MATCHED`。
- terminal static baseline：当前字节和既有原始输出支持 `MATCHED`，但本轮 reviewer 未重跑。
- root workspace enumeration：源码/checker 形态 `MATCHED`。
- sample2 frozen/full implementation acceptance：`OPEN`，为 first failure 与 broken boundary。

## Evidence

- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md:463-467` 要求 B1–B4 前置同时具备 sample2 implementation acceptance 与 terminal static baseline；picker 缺陷不计入该 sample2 acceptance。
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:66-82` 规定缺少 sample2 frozen evidence 或 static 仍红时 B0 BLOCKED。
- `apps/terminal/ui/feature/sample-wallpaper-picker/package.json:12-21,26-34` 当前没有错误的 `kernel-base-platform-ports` devDependency；`src/dependencies.ts:21` 与 `apps/terminal/skeleton-graph.ts:176-189` 保持空 dev 声明。
- `package.json:8-20` 覆盖 `apps/terminal/assembly/base/*` 与 `apps/terminal/ui/base/*`，满足 root workspace 枚举形态。
- 既有 sample2 evidence `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md:115-121` 仍明确 Web、release、native device、full visual、full A1–A9 matrix 未关闭；`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:57-62` 同样保留 OPEN。

## First failure / broken boundary / last known good

- **first failure**：缺少当前源码绑定的 sample2 frozen/full implementation acceptance proof。
- **broken boundary**：现有证据止于 static、focused 与 Android supporting，不能覆盖 sample2 要求的 Web、release、native-device、完整 visual 与完整 A/F acceptance。
- **last known good**：R-E6 package-only 修复、root workspace 枚举形态、`TERMINAL_STATIC=PASS` 既有原始输出与 sample2 focused/Android supporting evidence；这些不升级为 frozen acceptance。

## Reproduction

```sh
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md | sed -n '463,467p'
nl -ba apps/terminal/ui/feature/sample-wallpaper-picker/package.json | sed -n '12,34p'
nl -ba apps/terminal/ui/feature/sample-wallpaper-picker/src/dependencies.ts | sed -n '1,30p'
nl -ba apps/terminal/skeleton-graph.ts | sed -n '176,189p'
```

