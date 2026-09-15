# CP4 system-notice idempotence repair evidence

`REVIEW_TARGET=IMPLEMENTATION_SUPPORT_STAGE_RECONCILIATION`
`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

## First finding

Fresh verifier Huygens found `S-1 CONFIRMED` in CP4: the wallpaper picker
system-notice actor already checked for an existing
`sample.wallpaper.system-notice` layer, but the sample1 auth and member-desk
system-notice actors opened their fixed layer directly. The existing ui-state
actor rejects a duplicate layer id, so a repeated system-failure observation
could produce a duplicate-layer error instead of an idempotent completed
observation.

Owning source:

```text
apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts
apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts
apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts
```

## Repair

The main Codex added the same existing-layer guard to auth and member-desk
before their `openLayer` call. The layer owner, fixed identity, ephemeral
persistence, commands, close paths, and notice body were not changed.

The regression tests dispatch each real feature's
`*SystemFailureObservedCommand` twice through a real test runtime and assert
both results are `completed`, the corresponding PRIMARY stack has exactly one
fixed notice layer, no `ui-state.layer.duplicate-rejected` event was emitted,
and no child `open-layer` command completed with `error`:

```text
apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts
apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx
```

## First test failures and focused re-verification

The first test attempt failed because the new tests imported non-public module
factories from each feature's `src/index.ts`:

```text
TypeError: createSampleStaffAuthModule is not a function
TypeError: createSampleMemberDeskModule is not a function
```

The tests were corrected to import the owning application module directly.
The next attempt then failed because the runtime public command requires a
request id. The tests were corrected to pass a fresh `createRequestId()` for
each observed command. These were test harness boundary failures, not
production behavior failures.

Final focused result:

```text
yarn test  # @catering-v2s/ui-feature-sample-staff-auth
Test Files  1 passed (1)
Tests       8 passed (8)

yarn test  # @catering-v2s/ui-feature-sample-member-desk
Test Files  1 passed (1)
Tests       25 passed (25)

yarn typecheck  # both packages
exit 0
```

The first CP4 fresh report remains the historical first finding. A new CP4
fresh independent read is still required after this repair. Dynamic, release,
Web, full U10/U13, whole-scope, code↔design, and cleanup evidence remain
OPEN.
