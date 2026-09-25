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

const sharedColors = {
  canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
  surface: 'rgb(var(--color-surface) / <alpha-value>)',
  foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
  'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
  border: 'rgb(var(--color-border) / <alpha-value>)',
  action: 'rgb(var(--color-action) / <alpha-value>)',
  'action-foreground': 'rgb(var(--color-action-foreground) / <alpha-value>)',
  'keyboard-surface': 'rgb(var(--color-keyboard-surface) / <alpha-value>)',
  'keyboard-key': 'rgb(var(--color-keyboard-key) / <alpha-value>)',
  'keyboard-action': 'rgb(var(--color-keyboard-action) / <alpha-value>)',
  'keyboard-key-foreground': 'rgb(var(--color-keyboard-key-foreground) / <alpha-value>)',
  'keyboard-action-foreground': 'rgb(var(--color-keyboard-action-foreground) / <alpha-value>)',
  'keyboard-border': 'rgb(var(--color-keyboard-border) / <alpha-value>)',
  'keyboard-focus': 'rgb(var(--color-keyboard-focus) / <alpha-value>)',
  'ok-foreground': 'rgb(var(--color-ok-foreground) / <alpha-value>)',
  'ok-background': 'rgb(var(--color-ok-background) / <alpha-value>)',
  'ok-border': 'rgb(var(--color-ok-border) / <alpha-value>)',
  'warn-foreground': 'rgb(var(--color-warn-foreground) / <alpha-value>)',
  'warn-background': 'rgb(var(--color-warn-background) / <alpha-value>)',
  'warn-border': 'rgb(var(--color-warn-border) / <alpha-value>)',
  'error-foreground': 'rgb(var(--color-error-foreground) / <alpha-value>)',
  'error-background': 'rgb(var(--color-error-background) / <alpha-value>)',
  'error-border': 'rgb(var(--color-error-border) / <alpha-value>)',
  'info-foreground': 'rgb(var(--color-info-foreground) / <alpha-value>)',
  'info-background': 'rgb(var(--color-info-background) / <alpha-value>)',
  'info-border': 'rgb(var(--color-info-border) / <alpha-value>)',
  'admin-shell-surface': 'rgb(var(--color-admin-shell-surface) / <alpha-value>)',
  'admin-shell-foreground': 'rgb(var(--color-admin-shell-foreground) / <alpha-value>)',
  'admin-shell-muted': 'rgb(var(--color-admin-shell-muted) / <alpha-value>)',
  'admin-shell-border': 'rgb(var(--color-admin-shell-border) / <alpha-value>)',
  'admin-content-surface': 'rgb(var(--color-admin-content-surface) / <alpha-value>)',
  'admin-content-foreground': 'rgb(var(--color-admin-content-foreground) / <alpha-value>)',
  'admin-content-muted': 'rgb(var(--color-admin-content-muted) / <alpha-value>)',
  'admin-content-border': 'rgb(var(--color-admin-content-border) / <alpha-value>)',
  'admin-ratio-undeclared': 'rgb(var(--color-admin-ratio-undeclared) / <alpha-value>)',
  'admin-inset': 'rgb(var(--color-admin-inset) / <alpha-value>)',
  'admin-action': 'rgb(var(--color-admin-action) / <alpha-value>)',
  'admin-action-start': 'rgb(var(--color-admin-action-start) / <alpha-value>)',
  'admin-action-end': 'rgb(var(--color-admin-action-end) / <alpha-value>)',
  'admin-action-foreground': 'rgb(var(--color-admin-action-foreground) / <alpha-value>)',
  'admin-focus': 'rgb(var(--color-admin-focus) / <alpha-value>)',
  'admin-surface-current': 'rgb(var(--color-admin-surface-current) / <alpha-value>)',
  'admin-surface-noncurrent': 'rgb(var(--color-admin-surface-noncurrent) / <alpha-value>)',
  'login-surface': 'rgb(var(--color-login-surface) / <alpha-value>)',
  'login-foreground': 'rgb(var(--color-login-foreground) / <alpha-value>)',
  'login-muted': 'rgb(var(--color-login-muted) / <alpha-value>)',
  'login-border': 'rgb(var(--color-login-border) / <alpha-value>)',
  'login-inset': 'rgb(var(--color-login-inset) / <alpha-value>)',
  'login-focus': 'rgb(var(--color-login-focus) / <alpha-value>)',
  'login-action': 'rgb(var(--color-login-action) / <alpha-value>)',
  'login-action-start': 'rgb(var(--color-login-action-start) / <alpha-value>)',
  'login-action-end': 'rgb(var(--color-login-action-end) / <alpha-value>)',
  'login-action-foreground': 'rgb(var(--color-login-action-foreground) / <alpha-value>)',
  'login-icon': 'rgb(var(--color-login-icon) / <alpha-value>)',
}

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
