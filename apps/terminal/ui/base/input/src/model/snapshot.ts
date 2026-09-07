export type SnapshotSelection = Readonly<{
  readonly start: number
  readonly end: number
}>

export type InputSnapshot = Readonly<{
  readonly revision: number
  readonly fields: Readonly<Record<string, Readonly<{
    readonly value: string
    readonly selection: SnapshotSelection
  }>>>
}>

export type InputFieldRegistration = Readonly<{
  readonly fieldId: string
  readonly value?: string
  readonly selection?: Readonly<{readonly start: number; readonly end?: number}>
}>

export type InputRegistrationToken = Readonly<{
  readonly fieldId: string
  readonly id: symbol
}>

type LiveField = {
  readonly fieldId: string
  readonly token: InputRegistrationToken
  value: string
  selection: SnapshotSelection
}

const normalizeSelection = (
  value: string,
  selection: Readonly<{readonly start: number; readonly end?: number}> | undefined,
): SnapshotSelection => {
  const requestedStart = selection?.start ?? value.length
  const requestedEnd = selection?.end ?? requestedStart
  const start = Math.min(value.length, Math.max(0, Math.trunc(requestedStart)))
  const end = Math.min(value.length, Math.max(0, Math.trunc(requestedEnd)))
  return start <= end ? {start, end} : {start: end, end: start}
}

const freezeSnapshot = (revision: number, fields: Record<string, {
  value: string
  selection: SnapshotSelection
}>): InputSnapshot => {
  const frozenFields = Object.fromEntries(Object.entries(fields).map(([fieldId, field]) => [
    fieldId,
    Object.freeze({
      value: field.value,
      selection: Object.freeze({...field.selection}),
    }),
  ]))
  return Object.freeze({revision, fields: Object.freeze(frozenFields)})
}

export const createInputRegistry = () => {
  const fields = new Map<string, LiveField>()
  let revision = 0

  const find = (token: InputRegistrationToken): LiveField => {
    const field = fields.get(token.fieldId)
    if (field === undefined || field.token !== token) throw new Error(`Unknown input registration: ${token.fieldId}`)
    return field
  }

  return {
    register: (registration: InputFieldRegistration): InputRegistrationToken => {
      if (fields.has(registration.fieldId)) throw new Error(`Input field already registered: ${registration.fieldId}`)
      const token: InputRegistrationToken = Object.freeze({fieldId: registration.fieldId, id: Symbol(registration.fieldId)})
      const value = registration.value ?? ''
      fields.set(registration.fieldId, {
        fieldId: registration.fieldId,
        token,
        value,
        selection: normalizeSelection(value, registration.selection),
      })
      return token
    },
    updateValue: (token: InputRegistrationToken, value: string): void => {
      const field = find(token)
      field.value = value
      field.selection = normalizeSelection(value, field.selection)
    },
    updateSelection: (
      token: InputRegistrationToken,
      selection: Readonly<{readonly start: number; readonly end?: number}>,
    ): void => {
      const field = find(token)
      field.selection = normalizeSelection(field.value, selection)
    },
    unregister: (token: InputRegistrationToken): void => {
      const field = fields.get(token.fieldId)
      if (field?.token === token) fields.delete(token.fieldId)
    },
    capture: (): InputSnapshot => {
      revision += 1
      const snapshotFields: Record<string, {value: string; selection: SnapshotSelection}> = {}
      for (const field of fields.values()) {
        snapshotFields[field.fieldId] = {
          value: field.value,
          selection: field.selection,
        }
      }
      return freezeSnapshot(revision, snapshotFields)
    },
  }
}

export type InputRegistry = ReturnType<typeof createInputRegistry>
