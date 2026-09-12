import {useEffect, useState} from 'react'
import {StyleSheet, Text, View} from 'react-native'
import '@catering-v2s/ui-integration-sample-console/theme/global.css'
import {
  createSurfaceForDisplayIndex,
  type SampleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-console'
import {createSampleTerminalAssembly} from './src/assembly/platformPorts'

type AppProps = Readonly<{
  readonly displayIndex?: 0 | 1
  readonly surfaceForm?: SurfaceForm
}>

const assemblyPromises: Partial<Record<SurfaceForm, Promise<SampleAssembly>>> = {}

const getAssembly = (surfaceForm: SurfaceForm): Promise<SampleAssembly> => {
  assemblyPromises[surfaceForm] ??= createSampleTerminalAssembly({surfaceForm})
  return assemblyPromises[surfaceForm]!
}

export default function App({displayIndex = 0, surfaceForm = 'laptop'}: AppProps) {
  const [assembly, setAssembly] = useState<SampleAssembly | null>(null)

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
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>正在启动终端…</Text>
      </View>
    )
  }

  return createSurfaceForDisplayIndex(assembly, displayIndex)
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: '#071829',
    flex: 1,
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#eaf6ff',
    fontSize: 16,
  },
})
