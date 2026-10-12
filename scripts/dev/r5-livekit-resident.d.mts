export type ManagedLivekitResidentIdentity = Readonly<{
  state: 'RUNNING';
  bootId: string;
  containerId: string;
  imageId: string;
  endpointRef: 'LIVEKIT_RESIDENT_ENDPOINT';
  signalTransport: 'WS';
}>;

export function validateLivekitDevBinding(input: Readonly<{
  developmentResident: unknown;
  currentResident: unknown;
  host: unknown;
  fingerprint: unknown;
  expectedBootId: unknown;
}>): ManagedLivekitResidentIdentity;

export function checkLivekitResidentForManagedDev(input: Readonly<{
  host: unknown;
  fingerprint: unknown;
  expectedBootId: unknown;
  developmentResident: unknown;
}>): Promise<ManagedLivekitResidentIdentity>;
