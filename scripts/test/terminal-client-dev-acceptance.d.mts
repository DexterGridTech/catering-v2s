export declare function validateManagedDevManifest(
  manifest: unknown,
  input?: Readonly<{readonly manifestPath?: string}>,
): Readonly<{readonly manifest: Record<string, unknown>; readonly manifestPath: string}>;

export declare function readOperationsPassword(): string;
export declare function readPlatformRootPassword(): string;
