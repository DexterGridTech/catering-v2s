const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const findWorkspaceRoot = appDir => {
  let current = path.resolve(appDir)
  while (true) {
    const packagePath = path.join(current, 'package.json')
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
        if (Array.isArray(packageJson.workspaces) && packageJson.workspaces.includes('apps/terminal')) return current
      } catch (_error) {
        // The caller's config loader will report its own resolution failure.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) throw new Error(`[application-base-android] workspace root not found from ${appDir}`)
    current = parent
  }
}

const findDependencyNodeModules = appDir => {
  let current = path.resolve(appDir)
  while (true) {
    const candidate = path.join(current, 'node_modules')
    if (fs.existsSync(path.join(candidate, 'react-native', 'package.json'))) return candidate
    const parent = path.dirname(current)
    if (parent === current) return path.join(findWorkspaceRoot(appDir), 'node_modules')
    current = parent
  }
}

const resolveFromApp = (name, appDir) => {
  const workspaceRoot = findWorkspaceRoot(appDir)
  const moduleDirectories = [
    findDependencyNodeModules(appDir),
    path.join(workspaceRoot, 'node_modules'),
  ]
  for (const moduleDirectory of moduleDirectories) {
    try {
      return require.resolve(path.join(moduleDirectory, name))
    } catch (_error) {
      // Try the next package-manager resolution root.
    }
  }
  return require.resolve(name, {paths: [appDir, workspaceRoot]})
}

const resolveSingleNativeWindRuntime = workspaceRoot => {
  const runtimePath = path.join(workspaceRoot, 'node_modules', 'react-native-css-interop')
  if (!fs.existsSync(path.join(runtimePath, 'package.json'))) {
    throw new Error(`[application-base-android] react-native-css-interop runtime not found at ${runtimePath}`)
  }
  return runtimePath
}

const resolveNativeWindRuntimeModule = (workspaceRoot, moduleName) => {
  const runtimePath = path.resolve(resolveSingleNativeWindRuntime(workspaceRoot))
  const resolvedPath = path.resolve(require.resolve(moduleName, {paths: [workspaceRoot]}))
  if (resolvedPath !== runtimePath && !resolvedPath.startsWith(`${runtimePath}${path.sep}`)) {
    throw new Error(`[application-base-android] react-native-css-interop module escaped runtime root: ${moduleName}`)
  }
  return resolvedPath
}

const pinNativeWindRuntime = (config, workspaceRoot) => ({
  ...config,
  resolver: (() => {
    const runtimePath = resolveSingleNativeWindRuntime(workspaceRoot)
    const currentResolveRequest = config.resolver?.resolveRequest
    return {
      ...config.resolver,
      extraNodeModules: {
        ...config.resolver?.extraNodeModules,
        'react-native-css-interop': runtimePath,
      },
      resolveRequest: (context, moduleName, platform) => {
        if (moduleName === 'react-native-css-interop' || moduleName.startsWith('react-native-css-interop/')) {
          return {
            type: 'sourceFile',
            filePath: resolveNativeWindRuntimeModule(workspaceRoot, moduleName),
          }
        }
        const resolver = currentResolveRequest ?? context.resolveRequest
        return resolver(context, moduleName, platform)
      },
    }
  })(),
})

const createBabelConfig = ({appDir}) => function configureBabel(api) {
  api.cache(true)
  return {
    presets: [
      [resolveFromApp('babel-preset-expo', appDir), {jsxImportSource: 'nativewind'}],
      resolveFromApp('nativewind/babel', appDir),
    ],
  }
}

const createMetroConfig = ({appDir, globalCssPath}) => {
  const workspaceRoot = findWorkspaceRoot(appDir)
  const dependencyNodeModules = findDependencyNodeModules(appDir)
  const workspaceNodeModules = path.join(workspaceRoot, 'node_modules')
  process.env.NODE_PATH = [dependencyNodeModules, workspaceNodeModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter)
  Module._initPaths()
  const {getDefaultConfig} = require(resolveFromApp('expo/metro-config', appDir))
  const {withNativeWind} = require(resolveFromApp('nativewind/metro', appDir))
  const config = getDefaultConfig(appDir)
  const nativeWindConfig = withNativeWind(config, {
    input: resolveFromApp(globalCssPath, appDir),
    configPath: path.join(appDir, 'tailwind.config.cjs'),
    inlineRem: 16,
  })
  return pinNativeWindRuntime(nativeWindConfig, workspaceRoot)
}

const sharedColors = require('@catering-v2s/ui-base-primitives/config/semantic-color-keys')

const createTailwindConfig = ({appDir, content, theme = undefined}) => ({
  content,
  presets: [require(resolveFromApp('nativewind/preset', appDir))],
  theme: theme ?? {extend: {colors: sharedColors}},
  plugins: [],
})

module.exports = {
  createBabelConfig,
  createMetroConfig,
  createTailwindConfig,
  pinNativeWindRuntime,
  resolveNativeWindRuntimeModule,
  resolveSingleNativeWindRuntime,
}
