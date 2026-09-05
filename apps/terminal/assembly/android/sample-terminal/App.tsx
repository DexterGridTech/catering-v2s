import {useEffect, useState} from 'react'
import {StyleSheet, Text, View} from 'react-native'
import {
  createSurfaceForDisplayIndex,
  type SampleAssembly,
} from '@catering-v2s/ui-integration-sample-console'
import {createSampleTerminalAssembly} from './src/platformPorts'

type AppProps = Readonly<{
  readonly displayIndex?: 0 | 1
}>

let assemblyPromise: Promise<SampleAssembly> | null = null

const getAssembly = (): Promise<SampleAssembly> => {
  if (assemblyPromise === null) assemblyPromise = createSampleTerminalAssembly()
  return assemblyPromise
}

export default function App({displayIndex = 0}: AppProps) {
  const [assembly, setAssembly] = useState<SampleAssembly | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getAssembly().then((nextAssembly) => {
      if (active) setAssembly(nextAssembly)
    }).catch((error: unknown) => {
      if (active) setFailed(true)
      console.error('[sample-terminal] assembly-start-failed', error instanceof Error ? error.name : typeof error)
    })
    return () => { active = false }
  }, [])

  if (failed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>终端运行时启动失败</Text>
      </View>
    )
  }
  if (assembly === null) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>正在启动终端运行时</Text>
      </View>
    )
  }
  return createSurfaceForDisplayIndex(assembly, displayIndex)
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071829',
  },
  fallbackText: {
    color: '#eaf6ff',
  },
})
