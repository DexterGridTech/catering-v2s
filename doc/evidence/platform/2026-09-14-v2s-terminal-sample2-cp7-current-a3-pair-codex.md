# TER sample2 CP-7 current Android A3 sequential evidence

```text
RUN_ID=ter-sample2-cp7-current-a3-sequential-20260914-02
CAPTURE_WINDOW=2026-09-14 current-run-02
DEVICE=emulator-5554
DEVICE_ROLE=laptop dual-screen
PACKAGE=com.catering.v2s.terminal.samplewallpaper
SOURCE_NOTE=wallpaper/placement source unchanged by the later VirtualKeyboard-only patch
RESULT=W1_W2_W3_SEQUENTIAL_CONFIRMATIONS=PASS
```

## Scope and action trace

This is one same-geometry run, not a set of mirrored bitmap calculations:

1. select and confirm `w1`; read back `w1 selected=true`, confirm disabled;
2. select and confirm `w2`; read back `w2 selected=true`, confirm disabled;
3. select and confirm `w3`; read back `w3 selected=true`, confirm disabled;
4. capture primary and the actual SurfaceFlinger secondary display after each confirmed state.

The `w2 → w3` transition is the second consecutive confirmation required by A3(c). No claim is
made that `compare(w1,w2)` and `compare(w2,w1)` are independent: the metric is symmetric by
construction and those mirrored directions are intentionally absent from this record.

## Checked-in readback

All files below are under
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-current-run-02/`:

| state | primary | secondary | readback |
| --- | --- | --- | --- |
| w1 confirmed | `laptop-w1-confirmed-primary.png` | `laptop-w1-confirmed-secondary.png` | `laptop-w1-confirmed.xml` |
| w2 confirmed | `laptop-w2-confirmed-primary.png` | `laptop-w2-confirmed-secondary.png` | `laptop-w2-confirmed.xml` |
| w3 confirmed | `laptop-w3-confirmed-primary.png` | `laptop-w3-confirmed-secondary.png` | `laptop-w3-confirmed.xml` |

Primary is `2560×1600`; the secondary capture is `1280×720` and uses the actual
SurfaceFlinger virtual display id `11529215047789101945`, not logical display id `2`.

## Fresh image-compare output

The existing `tools/terminal-image-compare/compare.mjs` and the repository ROI metadata were used.
No new comparison semantics were introduced.

| transition | display | changedFraction | P95 | meanAbsDiff | changedCellFraction | output |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| w1 → w2 | primary | 0.8873175498063088 | 242 | 127.5279849197565 | 1 | `laptop-w1-w2-primary-metric.json` |
| w1 → w2 | secondary | 1 | 242 | 137.10243468915343 | 1 | `laptop-w1-w2-secondary-metric.json` |
| w2 → w3 | primary | 0.882721707249585 | 191 | 75.61599739439218 | 1 | `laptop-w2-w3-primary-metric.json` |
| w2 → w3 | secondary | 0.9861866432178932 | 186 | 78.9466344997595 | 1 | `laptop-w2-w3-secondary-metric.json` |

Each metric has `threshold=4`, `grid.columns=8`, `grid.rows=8`, and a fixed full-display ROI
metadata with mask-excluded cells reported in `participatingCellCount`. All four transitions clear
the existing A2/A3 change thresholds. This is supporting Android evidence, not a complete A3/A/F,
Web, release, or visual acceptance verdict.

## Source and cleanup boundary

The run was captured after the responder/ScrollView fix. A later source-only change added
`VirtualKeyboard` stop-propagation for keyboard descendants; it does not alter wallpaper assets,
selector, placement, surface declarations or compare inputs. That relationship is recorded rather
than silently calling an older run “current byte”. A9 current-byte rerun and its cleanup are in
`20260914-a9-runtime-run-02/`.
