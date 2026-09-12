export const baseTokens = Object.freeze({
  container: 'flex-1 bg-canvas p-6 gap-4',
  containerContent: 'w-full bg-canvas gap-3',
  containerCard: 'w-11/12 max-w-xl self-center rounded-xl border border-border bg-surface p-6 gap-4',
  containerCentered: 'flex-1 items-center justify-center bg-canvas p-6 gap-4',
  // Keep explicit line boxes for all cross-platform text tokens. Android's
  // CJK glyph descent can exceed a size-only Text line box after a surface
  // transform, while the browser derives a different default line height.
  // These token-owned line heights keep the layout box and glyph metrics
  // stable without asking product components about a host scale.
  text: 'text-foreground leading-6',
  heading: 'text-xl leading-7 font-semibold text-foreground',
  label: 'text-sm leading-5 font-medium text-muted-foreground',
  input: 'min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground',
  button: 'self-start min-h-12 rounded-md bg-action px-4 py-3',
  buttonText: 'text-center text-base leading-6 font-semibold text-action-foreground',
  keyboardKey: 'flex-1 self-stretch min-h-12 rounded-md bg-action px-2 py-2',
  keyboardAction: 'flex-1 self-stretch min-h-12 rounded-md border border-border bg-surface px-2 py-2',
  keyboardButtonText: 'text-center text-base leading-6 font-semibold text-action-foreground',
  keyboardActionText: 'text-center text-base leading-6 font-semibold text-foreground',
  status: 'text-sm leading-6 pb-1 text-muted-foreground',
  actions: 'flex-row flex-wrap items-start gap-3',
  // ScrollView's className styles the viewport on native. Keep the content
  // spacing in PrimitiveScrollView's contentContainerStyle so native and web
  // lay out the same direct-child stack.
  scroll: 'w-full flex-1 bg-canvas',
  card: 'w-full rounded-xl border border-border bg-surface p-4 gap-3',
  divider: 'w-full h-px bg-border',
  stack: 'w-full gap-3',
  grid: 'w-full flex-row flex-wrap gap-3',
  center: 'w-full items-center justify-center',
  codeBlock: 'w-full rounded-md border border-border bg-surface p-3 font-mono text-sm leading-5 text-foreground',
  textarea: 'min-h-24 rounded-md border border-border bg-surface px-3 py-3 text-base leading-6 text-foreground',
  checkbox: 'h-6 w-6 items-center justify-center rounded-sm border border-border bg-surface',
  checkboxChecked: 'h-6 w-6 items-center justify-center rounded-sm border border-action bg-action',
  radio: 'h-6 w-6 items-center justify-center rounded-full border border-border bg-surface',
  radioSelected: 'h-6 w-6 items-center justify-center rounded-full border border-action bg-action',
  switch: 'min-w-12 rounded-full border border-border bg-surface px-1 py-1',
  switchChecked: 'min-w-12 rounded-full border border-action bg-action px-1 py-1',
  controlMarker: 'text-center text-base font-semibold text-action-foreground',
  option: 'w-full min-h-12 rounded-md border border-border bg-surface px-3 py-3 text-left text-base text-foreground',
  optionSelected: 'w-full min-h-12 rounded-md border border-action bg-action px-3 py-3 text-left text-base text-action-foreground',
  dataRow: 'w-full flex-row items-center justify-between gap-3 border-b border-border py-3',
  dataLabel: 'flex-1 text-sm leading-5 font-medium text-muted-foreground',
  dataValue: 'flex-1 text-right text-sm leading-5 text-foreground',
  list: 'w-full flex-1 bg-canvas',
  table: 'w-full border border-border bg-surface',
  tableRow: 'w-full flex-row border-b border-border',
  tableCell: 'flex-1 px-3 py-2 text-sm leading-5 text-foreground',
  tabRow: 'w-full flex-row flex-wrap gap-2',
  tab: 'min-h-12 rounded-md border border-border bg-surface px-3 py-3 text-sm leading-5 text-foreground',
  tabSelected: 'min-h-12 rounded-md border border-action bg-action px-3 py-3 text-sm leading-5 text-action-foreground',
} as const)

export const semanticToneTokens = Object.freeze({
  neutral: Object.freeze({foreground: 'text-muted-foreground', background: 'bg-surface', border: 'border-border'}),
  ok: Object.freeze({foreground: 'text-ok-foreground', background: 'bg-ok-background', border: 'border-ok-border'}),
  warn: Object.freeze({foreground: 'text-warn-foreground', background: 'bg-warn-background', border: 'border-warn-border'}),
  error: Object.freeze({foreground: 'text-error-foreground', background: 'bg-error-background', border: 'border-error-border'}),
  info: Object.freeze({foreground: 'text-info-foreground', background: 'bg-info-background', border: 'border-info-border'}),
} as const)

export const buttonToneTokens = Object.freeze({
  neutral: Object.freeze({background: 'bg-action', foreground: 'text-action-foreground', border: 'border-action'}),
  ok: Object.freeze({background: 'bg-ok-background', foreground: 'text-ok-foreground', border: 'border-ok-border'}),
  warn: Object.freeze({background: 'bg-warn-background', foreground: 'text-warn-foreground', border: 'border-warn-border'}),
  error: Object.freeze({background: 'bg-error-background', foreground: 'text-error-foreground', border: 'border-error-border'}),
  info: Object.freeze({background: 'bg-info-background', foreground: 'text-info-foreground', border: 'border-info-border'}),
} as const)

export const baseLayout = Object.freeze({
  scrollContentGap: 12,
} as const)
