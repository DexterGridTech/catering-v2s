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
} as const)

export const baseLayout = Object.freeze({
  scrollContentGap: 12,
} as const)
