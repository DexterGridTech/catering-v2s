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
    if (parent === current) throw new Error(`[assembly-base-android] workspace root not found from ${appDir}`)
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
  return withNativeWind(config, {
    input: resolveFromApp(globalCssPath, appDir),
    configPath: path.join(appDir, 'tailwind.config.cjs'),
    inlineRem: 16,
  })
}

const sharedColors = {
  canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
  surface: 'rgb(var(--color-surface) / <alpha-value>)',
  foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
  'muted-foreground': 'rgb(var(--color-muted-foreground) / <alpha-value>)',
  border: 'rgb(var(--color-border) / <alpha-value>)',
  action: 'rgb(var(--color-action) / <alpha-value>)',
  'action-foreground': 'rgb(var(--color-action-foreground) / <alpha-value>)',
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
}

const createTailwindConfig = ({appDir, content, darkMode = undefined, theme = undefined}) => ({
  ...(darkMode === undefined ? {} : {darkMode}),
  content,
  presets: [require(resolveFromApp('nativewind/preset', appDir))],
  theme: theme ?? {extend: {colors: sharedColors}},
  plugins: [],
})

module.exports = {
  createBabelConfig,
  createMetroConfig,
  createTailwindConfig,
}
