module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './test-expo/**/*.{ts,tsx}',
    '../../base/primitives/src/**/*.{ts,tsx}',
  ],
  // TER has no dark-variant consumers; class mode avoids CSS Interop 0.2.6's
  // Web media-mode observer calling the unsupported manual color-scheme setter.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: require('@catering-v2s/ui-base-primitives/config/semantic-color-keys'),
    },
  },
  plugins: [],
}
