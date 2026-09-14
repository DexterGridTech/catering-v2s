declare module '*.jpg' {
  // Expo/RN static image imports are numeric asset references on native and
  // remain accepted by ImageSourcePropType on the web consumer.
  const source: number
  export default source
}
