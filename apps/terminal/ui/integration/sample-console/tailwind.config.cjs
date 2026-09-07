module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './test-expo/**/*.{ts,tsx}',
    '../../base/primitives/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        action: 'rgb(var(--color-action) / <alpha-value>)',
        'action-foreground': 'rgb(var(--color-action-foreground) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
