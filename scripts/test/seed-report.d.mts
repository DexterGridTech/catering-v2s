export function materializeGeneratedOperationPath(
  operation: {path: string},
  input?: {pathParameters?: Record<string, string | number | boolean>; queryParameters?: Record<string, string | number | boolean | readonly (string | number | boolean)[]>},
): string;
