/** Values that survive the state package's JSON persistence boundary. */
export type StateJsonPrimitive = string | number | boolean | null

export type StateJsonValue =
  | StateJsonPrimitive
  | readonly StateJsonValue[]
  | StateJsonObject

export interface StateJsonObject {
  readonly [key: string]: StateJsonValue
}
