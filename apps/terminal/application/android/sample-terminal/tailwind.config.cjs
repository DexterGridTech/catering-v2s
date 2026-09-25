module.exports = require('@catering-v2s/application-base-android/config').createTailwindConfig({
  appDir: __dirname,
  content: [
    './App.tsx',
    './src/**/*.{ts,tsx}',
    '../../../ui/integration/sample-console/src/**/*.{ts,tsx}',
    '../../../ui/base/primitives/src/**/*.{ts,tsx}',
  ],
})
