const nodeTagForId = (xml, resourceId) => {
  const escapedId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `${xml ?? ''}`.match(new RegExp(`<node\\b(?=[^>]*\\bresource-id="${escapedId}")[^>]*>`))?.[0] ?? null
}

const nodeText = tag => tag?.match(/\btext="([^"]*)"/)?.[1] ?? ''

export const findImmersiveClingDismissal = xml => {
  const title = nodeTagForId(xml, 'android:id/immersive_cling_title')
  const button = nodeTagForId(xml, 'android:id/ok')
  if (nodeText(title) !== 'Viewing full screen' || nodeText(button) !== 'Got it') return null
  const bounds = button.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  if (bounds === null) return null
  return {
    x: Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2),
    y: Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2),
  }
}
