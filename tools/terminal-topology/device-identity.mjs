const emulatorSerialPattern = /^emulator-\d+$/

export const parseAvdNames = output => `${output ?? ''}`
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)

export const parseAdbEmulatorInventory = output => `${output ?? ''}`
  .split(/\r?\n/)
  .map(line => line.trim().match(/^(emulator-\d+)\s+(device|offline|unauthorized)\b/))
  .filter(Boolean)
  .map(match => ({serial: match[1], state: match[2]}))

export const parseAvdNameReply = output => {
  const names = `${output ?? ''}`
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '' && line !== 'OK')
  if (names.length !== 1 || names[0].startsWith('KO:')) throw new Error('ADB emulator console did not return exactly one AVD name')
  return names[0]
}

export const resolveTopologyAvds = ({masterAvdName, slaveAvdName, availableAvdNames, adbEmulators, activeAvds}) => {
  if (typeof masterAvdName !== 'string' || masterAvdName.trim() === '' || typeof slaveAvdName !== 'string' || slaveAvdName.trim() === '') {
    throw new Error('both master and slave AVD names are required')
  }
  if (masterAvdName === slaveAvdName) throw new Error('master and slave AVD names must be distinct')
  const available = new Set(availableAvdNames)
  for (const [role, name] of [['master', masterAvdName], ['slave', slaveAvdName]]) {
    if (!available.has(name)) throw new Error(`${role} AVD name is not present in the current emulator inventory`)
  }
  const onlineSerials = new Set(adbEmulators.filter(item => item.state === 'device').map(item => item.serial))
  const resolve = (role, avdName) => {
    const matches = activeAvds.filter(item => onlineSerials.has(item.serial) && item.avdName === avdName)
    if (matches.length !== 1 || !emulatorSerialPattern.test(matches[0]?.serial ?? '')) {
      throw new Error(`${role} AVD is not uniquely online in the current ADB inventory`)
    }
    return {avdName, serial: matches[0].serial}
  }
  const master = resolve('master', masterAvdName)
  const slave = resolve('slave', slaveAvdName)
  if (master.serial === slave.serial) throw new Error('master and slave AVDs resolved to the same ADB serial')
  return {master, slave}
}

export const parseWmDensityDpi = output => {
  const lines = `${output ?? ''}`.split(/\r?\n/)
  const selected = [...lines].reverse().find(line => /^\s*Override density:\s*\d+\s*$/.test(line))
    ?? [...lines].reverse().find(line => /^\s*Physical density:\s*\d+\s*$/.test(line))
  const densityDpi = Number(selected?.match(/(\d+)\s*$/)?.[1])
  if (!Number.isFinite(densityDpi) || densityDpi <= 0) throw new Error('effective wm density is unavailable')
  return densityDpi
}

export const validateLaptopDisplayShape = ({displays, virtualDisplayCount, densityDpi}) => {
  if (displays.length !== 1 || displays[0]?.id !== 0 || displays[0].width <= 0 || displays[0].height <= 0) {
    throw new Error(`expected exactly one logical display, observed ${displays.length}`)
  }
  if (virtualDisplayCount !== 0) throw new Error(`unexpected SurfaceFlinger Virtual Display count ${virtualDisplayCount}`)
  if (displays[0].width <= displays[0].height) throw new Error('laptop logical display must be landscape')
  if (!Number.isFinite(densityDpi) || densityDpi <= 0) throw new Error('effective wm density is unavailable')
  const shortestEdgeDp = Math.min(displays[0].width, displays[0].height) * 160 / densityDpi
  if (shortestEdgeDp < 600) throw new Error(`shortest logical edge ${shortestEdgeDp}dp is below the laptop threshold 600dp`)
  return {shortestEdgeDp}
}
