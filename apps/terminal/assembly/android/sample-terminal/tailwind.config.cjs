module.exports = require('@catering-v2s/assembly-base-android/config').createTailwindConfig({
  appDir: __dirname,
  darkMode: 'class',
  content: [
    './App.tsx',
    './src/**/*.{ts,tsx}',
    '../../../ui/integration/sample-console/src/**/*.{ts,tsx}',
    '../../../ui/base/primitives/src/**/*.{ts,tsx}',
  ],
})
