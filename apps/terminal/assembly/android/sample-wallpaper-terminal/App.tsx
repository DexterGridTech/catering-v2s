import {useEffect, useState} from 'react'
import {StyleSheet, Text, View} from 'react-native'
import '@catering-v2s/ui-integration-sample-wallpaper-console/theme/global.css'
import {
  createSurfaceForDisplayIndex,
  type SurfaceForm,
  type WallpaperConsoleAssembly,
} from '@catering-v2s/ui-integration-sample-wallpaper-console'
import {createSampleWallpaperTerminalAssembly} from './src/assembly/platformPorts'

type AppProps = Readonly<{
  readonly displayIndex?: 0 | 1
  readonly surfaceForm?: SurfaceForm
}>

const assemblyPromises: Partial<Record<SurfaceForm, Promise<WallpaperConsoleAssembly>>> = {}

const getAssembly = (surfaceForm: SurfaceForm): Promise<WallpaperConsoleAssembly> => {
  assemblyPromises[surfaceForm] ??= createSampleWallpaperTerminalAssembly({surfaceForm})
  return assemblyPromises[surfaceForm]!
}

export default function App({displayIndex = 0, surfaceForm = 'laptop'}: AppProps) {
  const [assembly, setAssembly] = useState<WallpaperConsoleAssembly | null>(null)

  useEffect(() => {
    let active = true
    void getAssembly(surfaceForm).then((nextAssembly) => {
      if (active) setAssembly(nextAssembly)
    })
    return () => {
      active = false
    }
  }, [surfaceForm])

  if (assembly === null) {
    return (
      <View style={styles.fallback} testID="sample-wallpaper-terminal.loading">
        <Text style={styles.fallbackText}>正在启动壁纸终端…</Text>
      </View>
    )
  }

  return createSurfaceForDisplayIndex(assembly, displayIndex)
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flex: 1,
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#0f172a',
    fontSize: 16,
  },
})
