function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function buildSdkSafeNodeEvalArgs(script: string): string[] {
  return [
    'node',
    '-e',
    'eval(Buffer.from(process.argv[1],"base64").toString("utf8"))',
    encodeBase64Utf8(script),
  ];
}
