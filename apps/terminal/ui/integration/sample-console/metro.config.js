const path = require('node:path')
const Module = require('node:module')

const terminalNodeModules = path.resolve(__dirname, '../../../node_modules')
process.env.NODE_PATH = [terminalNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
Module._initPaths()

const {getDefaultConfig} = require('expo/metro-config')
const {withNativeWind} = require('nativewind/metro')

const config = getDefaultConfig(__dirname)
const workspaceNativeWindRuntime = path.resolve(
  __dirname,
  '../../../../../node_modules/react-native-css-interop',
)

const nativeWindConfig = withNativeWind(config, {
  input: './theme/global.css',
  configPath: './tailwind.config.cjs',
  inlineRem: 16,
})

module.exports = {
  ...nativeWindConfig,
  resolver: {
    ...nativeWindConfig.resolver,
    extraNodeModules: {
      ...nativeWindConfig.resolver?.extraNodeModules,
      'react-native-css-interop': workspaceNativeWindRuntime,
    },
  },
}
