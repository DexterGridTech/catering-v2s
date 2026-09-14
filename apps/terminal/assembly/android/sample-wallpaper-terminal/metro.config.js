const path = require('node:path')
const Module = require('node:module')

const terminalNodeModules = path.resolve(__dirname, '../../../node_modules')
process.env.NODE_PATH = [terminalNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
Module._initPaths()

const {getDefaultConfig} = require('expo/metro-config')
const {withNativeWind} = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, {
  input: require.resolve('@catering-v2s/ui-integration-sample-wallpaper-console/theme/global.css'),
  configPath: './tailwind.config.cjs',
  inlineRem: 16,
})
