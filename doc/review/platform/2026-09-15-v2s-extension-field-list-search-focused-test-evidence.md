---
title: 扩展字段配置抽屉取消动作 focused test evidence
evidenceKind: FOCUSED_TEST_RUN
reviewTarget: IMPLEMENTATION
reviewCycleId: EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
capturedAt: 2026-09-15T10:13:26+09:00
result: PASS
exitCode: 0
---

# focused test evidence

```text
COMMAND=yarn vitest run src/features/extension-management/ui/ExtensionDefinitionEditDrawer.test.tsx --reporter=verbose
CWD=apps/frontend/platform-admin
RUNNER=vitest 4.1.10
EXIT_CODE=0
TEST_FILES=1 passed
TESTS=2 passed
CLEANUP=NOT_APPLICABLE; no managed process or external resource was created
```

## Raw result summary

```text
RUN v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/frontend/platform-admin

PASS src/features/extension-management/ui/ExtensionDefinitionEditDrawer.test.tsx > extension definition drawer actions > exposes the stable cancel locator on the real footer button and closes on click
PASS src/features/extension-management/ui/ExtensionDefinitionEditDrawer.test.tsx > extension definition drawer actions > disables the real cancel button while a submission is pending

Test Files  1 passed (1)
Tests       2 passed (2)
Start at    10:13:26
Duration    385ms
EXIT_CODE    0
```

The runner emitted only the known React 19 `react-test-renderer is deprecated` warning. The earlier unmount `act` warning was fixed before this captured run and is absent from this result. This focused test is not browser L2 and does not create a managed DEV/Testcontainers resource.
